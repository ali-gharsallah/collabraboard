/**
 * Câblage screening — SC-01..SC-04 (R100→R103) à travers le SERVICE PERSISTANT.
 * Complète screening-scenarios.spec.ts (domaine pur) : ici on prouve requête → règle →
 * persistance, avec un faux Prisma en mémoire. Gardes API en plus du Gherkin :
 * l'auteur de la qualification vient du JETON (ctx.userId), jamais du body (R101) ;
 * chaque lecture/écriture est scopée tenant.
 *
 * Harnais : compiler screening.service.ts + ce fichier ; exécuter
 *   echo "── Câblage screening (R100→R103) ──"; run screening.wiring.spec.js
 */
import { ScreeningService, partiesSwift, partiesTransactions, hitsVersCsv } from './screening.service';
declare const process: { exit(n: number): void };

let passed = 0, failed = 0; const fails: string[] = [];
function it(name: string, fn: () => Promise<void>): Promise<void> {
  return fn().then(() => { passed++; }, (e: Error) => { failed++; fails.push(`✗ ${name} — ${e.message}`); });
}
const ok = (c: boolean, m = 'assertion') => { if (!c) throw new Error(m); };
async function rejects(p: Promise<unknown>, part: string): Promise<void> {
  try { await p; } catch (e) { if ((e as Error).message.includes(part)) return;
    throw new Error(`attendu «${part}», obtenu «${(e as Error).message}»`); }
  throw new Error(`refus «${part}» attendu`);
}

// ── Faux Prisma : tables en mémoire, filtres tenant réellement appliqués ──
function fakePrisma(clients: any[], scenarios: any[] = [], persons: any[] = [], onboardings: any[] = [], transactions: any[] = [], tenants: any[] = []) {
  let seq = 0; const id = (p: string) => `${p}-${++seq}`;
  const db = { clients, scenarios, persons, onboardings, transactions, tenants, runs: [] as any[], hits: [] as any[], quals: [] as any[], events: [] as any[], tasks: [] as any[] };
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => {
    if (k === 'hit') return match(db.hits.find((h) => h.id === row.hitId) ?? {}, v);
    if (v && typeof v === 'object' && 'in' in v) return v.in.includes(row[k]);
    return row[k] === v;
  });
  const table = (rows: any[], prefix: string) => ({
    findMany: async ({ where }: any = {}) => rows.filter((r) => match(r, where)),
    findFirst: async ({ where }: any = {}) => rows.find((r) => match(r, where)) ?? null,
    create: async ({ data }: any) => { const r = { id: id(prefix), ...data }; rows.push(r); return r; },
    update: async ({ where, data }: any) => { const r = rows.find((x) => x.id === where.id)!; Object.assign(r, data); return r; },
  });
  const p: any = { _db: db,
    client: table(db.clients, 'CLI'), screeningRun: table(db.runs, 'RUN'),
    screeningHit: table(db.hits, 'HIT'), screeningQualification: table(db.quals, 'Q'),
    amlScenario: table(db.scenarios, 'SCN'),                    // R414 : config versionnée du moteur
    person: table(db.persons, 'PER'), onboarding: table(db.onboardings, 'ONB'),   // R100 : sujets étendus
    transaction: table(db.transactions, 'TXN'),                // R100 : contreparties du journal (core banking)
    task: table(db.tasks, 'TSK'),                              // ADR-PEP-001 : tâche compliance de proposition
    tenant: table(db.tenants, 'TEN'),                          // C7 : opt-in allowCallOverride
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; },
      findFirst: async ({ where }: any = {}) => db.events.find((e) => match(e, where)) ?? null },
  };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => { const entries: any[] = [];
  return { entries, log: async (_t: string, _u: string, action: string, target?: string) => { entries.push({ action, target }); } } as any; };

const CTX = { tenantId: 't1', userId: 'i.vernet', role: 'CO' };
const ENTREE = { uid: 'SAN-1', nom_complet: 'Viktor Volkov', alias: ['V. Volkov'], date_naissance: '1965-03-12', type: 'individu' };
const CFG = { liste: 'SECO', version: '2026-07-14', seuil: 85, prefiltre: { minPartages: 2, maxTrigrammes: 12, plafond: 400 } };
const CLIENTS = [
  { id: 'c1', tenantId: 't1', name: 'Viktor Volkov' },
  { id: 'c2', tenantId: 't1', name: 'Jean Dupont' },
  { id: 'c9', tenantId: 't2', name: 'Viktor Volkov' },   // autre tenant — ne doit JAMAIS être screené
];
const mk = () => { const p = fakePrisma(CLIENTS.map((c) => ({ ...c }))); const a = fakeAudit();
  return { p, a, s: new ScreeningService(p, a) }; };

(async () => {
  // ── SC-01 (R100) — le hit est une matière, pas un verdict — persisté ──
  await it('SC-01 run → hit BRUT persisté (score, uid, VERSION), ni alerte ni case', async () => {
    const { p, s } = mk();
    const r: any = await s.run(CTX, { ...CFG, entries: [ENTREE] });
    ok(r.hits.length === 1, 'un hit brut');
    const h = p._db.hits[0];
    ok(h.statut === 'BRUT' && h.score >= 85 && h.entreeUid === 'SAN-1', 'score/uid/statut');
    ok(h.listeVersion === '2026-07-14' && !!h.entreeHash && !!h.at, 'version + empreinte + horodatage');
    ok(h.tenantId === 't1' && h.clientId === 'c1', 'scopé tenant, bon client');
    ok(p._db.events.every((e: any) => !String(e.type).includes('alerte')), 'aucune alerte');
  });
  await it('SC-01 isolation : le client du tenant t2 n\'est jamais screené', async () => {
    const { p, s } = mk();
    await s.run(CTX, { ...CFG, entries: [ENTREE] });
    ok(p._db.hits.every((h: any) => h.clientId !== 'c9'), 'cross-tenant exclu du périmètre');
    ok(p._db.runs[0].perimetre === 2, 'périmètre = clients du tenant seulement');
  });

  // ── SC-02 (R101) — qualification motivée, auteur = jeton ──
  await it('SC-02 sans motif → refus R7 ; motif blanc → refus', async () => {
    const { p, s } = mk();
    await s.run(CTX, { ...CFG, entries: [ENTREE] });
    await rejects(s.qualify(CTX, p._db.hits[0].id, 'FAUX_POSITIF', ''), 'R7');
    await rejects(s.qualify(CTX, p._db.hits[0].id, 'FAUX_POSITIF', '   '), 'R7');
  });
  await it('SC-02 l\'auteur vient du jeton (ctx.userId), jamais du body', async () => {
    const { p, s } = mk();
    await s.run(CTX, { ...CFG, entries: [ENTREE] });
    const q: any = await s.qualify(CTX, p._db.hits[0].id, 'FAUX_POSITIF', 'Homonyme — DdN incompatible');
    ok(q.par === 'i.vernet', 'par = utilisateur du jeton');
    ok(p._db.hits[0].statut === 'QUALIFIE', 'hit qualifié');
  });
  await it('SC-02 double qualification → refus (re-qualification tracée requise)', async () => {
    const { p, s } = mk();
    await s.run(CTX, { ...CFG, entries: [ENTREE] });
    await s.qualify(CTX, p._db.hits[0].id, 'FAUX_POSITIF', 'Homonyme');
    await rejects(s.qualify(CTX, p._db.hits[0].id, 'VRAI_POSITIF', 'Erreur'), 'déjà qualifié');
  });
  await it('SC-02 vrai positif → escalade PROPOSÉE (événement), aucun case exécuté (R39/R44)', async () => {
    const { p, s } = mk();
    await s.run(CTX, { ...CFG, entries: [ENTREE] });
    await s.qualify(CTX, p._db.hits[0].id, 'VRAI_POSITIF', 'Correspondance confirmée pièce d\'identité');
    ok(p._db.events.some((e: any) => e.type === 'screening.escalade.proposee'), 'proposition émise');
    ok(!('cases' in p._db) || (p._db as any).cases === undefined, 'rien d\'exécuté');
  });

  // ── SC-03 (R102) — whitelist datée par empreinte, réapparition ──
  await it('SC-03 faux positif → rejeu même version : hit écarté', async () => {
    const { p, s } = mk();
    await s.run(CTX, { ...CFG, entries: [ENTREE] });
    await s.qualify(CTX, p._db.hits[0].id, 'FAUX_POSITIF', 'Homonyme — DdN incompatible');
    const r2: any = await s.run(CTX, { ...CFG, entries: [ENTREE] });
    ok(r2.hits.length === 0, 'écarté tant que l\'entrée est identique');
  });
  await it('SC-03 entrée modifiée (nouvel alias, V2) → le hit RÉAPPARAÎT, motif V1 conservé', async () => {
    const { p, s } = mk();
    await s.run(CTX, { ...CFG, entries: [ENTREE] });
    await s.qualify(CTX, p._db.hits[0].id, 'FAUX_POSITIF', 'Homonyme — DdN incompatible');
    const E2 = { ...ENTREE, alias: [...ENTREE.alias, 'Victor Volkoff'] };
    const r3: any = await s.run(CTX, { ...CFG, version: '2026-07-21', entries: [E2] });
    ok(r3.hits.length === 1 && r3.hits[0].statut === 'BRUT', 'réapparu non qualifié');
    ok(p._db.quals.length === 1 && p._db.quals[0].motif.includes('Homonyme'), 'la qualification V1 n\'est pas effacée (R48)');
  });

  // ── SC-04 (R103) — preuve de fraîcheur, même sans hit ──
  await it("SC-0B [V2-M46] une entrée au FORMAT D'IMPORT ({id,name}) est screenée comme les autres", async () => {
    // LE défaut le plus grave trouvé de toute la campagne, et le plus silencieux. `run()`
    // construisait son index trigramme sur `dto.entries` BRUTES, alors que la route d'import
    // (`/listes/importer`) les normalise (`ingererListe` : name→nom_complet, id→uid). Un appelant
    // qui envoie le format DOCUMENTÉ de l'import obtenait donc un index sans trigrammes → zéro
    // candidat → ZÉRO HIT — et un run persisté « 0 hit », c'est-à-dire un dossier propre.
    // Les tests ne le voyaient pas : ils parlaient déjà le format interne du moteur.
    const p = fakePrisma(CLIENTS.map((c) => ({ ...c })));
    const s = new ScreeningService(p, fakeAudit());
    await s.run(CTX, { ...CFG, entries: [{ id: "SAN-1", name: "Viktor Volkov", est_entite: false }] } as any);
    const run = p._db.runs[p._db.runs.length - 1];
    ok(run.nbHits === 1, `le hit sort au format d'import (obtenu ${run.nbHits})`);
    ok(p._db.hits.some((h: any) => h.entreeUid === "SAN-1"), "l'uid est repris de `id`");

    // et le format INTERNE continue de marcher à l'identique — la normalisation est idempotente
    const p2 = fakePrisma(CLIENTS.map((c) => ({ ...c })));
    await new ScreeningService(p2, fakeAudit()).run(CTX, { ...CFG, entries: [ENTREE] } as any);
    ok(p2._db.runs[p2._db.runs.length - 1].nbHits === 1, "format interne inchangé");
  });

  await it("SC-00 [V2-M45] un run SANS seuil retombe sur le paramètre GOUVERNÉ, il ne tombe pas en 500", async () => {
    // Trouvé en semant la démonstration par les vraies routes : `seuil` absent de l'appel
    // rendait la comparaison `score >= undefined` toujours fausse — ZÉRO hit, en silence — puis
    // faisait échouer `screeningRun.create` sur une colonne non nulle, en 500. Le repli est le
    // paramètre R-Q `screeningSeuil` (R100), celui que l'écran de paramétrage édite ; à défaut, 85.
    const p = fakePrisma(CLIENTS.map((c) => ({ ...c })), [], [], [], [], [{ id: 't1', settings: { screeningSeuil: 60 } }]);
    const s = new ScreeningService(p, fakeAudit());
    const { seuil: _ignore, ...sansSeuil } = CFG;
    await s.run(CTX, { ...sansSeuil, entries: [ENTREE] } as any);
    const run = p._db.runs[p._db.runs.length - 1];
    ok(!!run, "le run est PERSISTÉ (avant : 500 sur colonne non nulle)");
    ok(run.seuil === 60, `seuil gouverné repris (obtenu ${run.seuil})`);

    // et sans paramètre au registre : le défaut du canon (85), jamais undefined
    const p2 = fakePrisma(CLIENTS.map((c) => ({ ...c })), [], [], [], [], [{ id: 't1', settings: {} }]);
    await new ScreeningService(p2, fakeAudit()).run(CTX, { ...sansSeuil, entries: [ENTREE] } as any);
    ok(p2._db.runs[p2._db.runs.length - 1].seuil === 85, "défaut R100 = 85");
  });

  await it('SC-04 zéro hit → run persisté : périmètre, version, seuil, pré-filtre, horodatage', async () => {
    const { p, s } = mk();
    const AUTRE = { uid: 'SAN-9', nom_complet: 'Personne Introuvable' };
    await s.run(CTX, { ...CFG, entries: [AUTRE] });
    const run = p._db.runs[0];
    ok(p._db.hits.length === 0, 'aucun hit');
    ok(run.nbHits === 0 && run.perimetre === 2, 'trace malgré 0 hit');
    ok(run.listeVersion === '2026-07-14' && run.seuil === 85, 'version + seuil tracés');
    ok(run.prefiltre.plafond === 400, 'le réglage du pré-filtre fait partie de la trace');
    ok(!!run.at && run.tenantId === 't1', 'horodaté, scopé tenant');
  });
  await it('SC-04 audit SCREENING_RUN écrit à chaque passage', async () => {
    const { a, s } = mk();
    await s.run(CTX, { ...CFG, entries: [ENTREE] });
    ok(a.entries.some((e: any) => e.action === 'SCREENING_RUN'), 'passage audité');
  });

  // ── R414 — la config du moteur vient d'un SCÉNARIO VERSIONNÉ (AmlScenario.params), effet daté ──
  // Un scénario dont params.moteur.echelle=50 fait tomber un appariement EXACT (nameScore 50) sous le
  // seuil 85 → 0 hit : preuve que le réglage gouverné pilote réellement le run.
  const scn = (version: number, effectiveFrom: string, moteur: any) => ({
    id: `SCN-${version}`, tenantId: 't1', code: 'SCN-SCREEN', ruleRef: 'R414', fam: 'GV',
    version, effectiveFrom, params: { moteur }, active: true,
  });
  const mkS = (scenarios: any[]) => { const p = fakePrisma(CLIENTS.map((c) => ({ ...c })), scenarios);
    const a = fakeAudit(); return { p, s: new ScreeningService(p, a) }; };

  await it('R414 sans scénario ni override → config par défaut, source null, comportement inchangé', async () => {
    const { p, s } = mk();
    const r: any = await s.run(CTX, { ...CFG, entries: [ENTREE] });
    ok(r.hits.length === 1, 'hit par défaut (echelle 100)');
    ok(p._db.runs[0].config.source === null, 'aucune provenance de scénario');
    ok(Object.keys(p._db.runs[0].config.moteur).length === 0, 'moteur vide → défauts R413');
  });
  await it('R414 scénario en vigueur (echelle 50) → l\'appariement exact tombe sous le seuil : 0 hit', async () => {
    const { p, s } = mkS([scn(1, '2020-01-01T00:00:00.000Z', { echelle: 50 })]);
    const r: any = await s.run(CTX, { ...CFG, entries: [ENTREE], scenarioCode: 'SCN-SCREEN' });
    ok(r.hits.length === 0, 'le réglage gouverné écarte le hit');
    ok(p._db.runs[0].config.source.scenarioVersion === 1, 'provenance tracée (scénario v1)');
    ok(p._db.runs[0].config.moteur.echelle === 50, 'config effective tracée sur le run (rejeu)');
  });
  await it('R414 effet daté (R29) : une V2 à effet FUTUR n\'est pas appliquée → V1 en vigueur', async () => {
    const { p, s } = mkS([
      scn(1, '2020-01-01T00:00:00.000Z', { echelle: 50 }),
      scn(2, '2999-01-01T00:00:00.000Z', { echelle: 100 }),    // ratifiée mais pas encore en vigueur
    ]);
    const r: any = await s.run(CTX, { ...CFG, entries: [ENTREE], scenarioCode: 'SCN-SCREEN' });
    ok(r.hits.length === 0, 'la V2 future ne s\'applique pas (grandfathering)');
    ok(p._db.runs[0].config.source.scenarioVersion === 1, 'c\'est la V1 qui gouverne');
  });
  await it('R414/C7 override d\'appel (opt-in + justification) prime sur le scénario, et reste tracé', async () => {
    const p = fakePrisma(CLIENTS.map((c) => ({ ...c })), [scn(1, '2020-01-01T00:00:00.000Z', { echelle: 50 })],
      [], [], [], [{ id: 't1', settings: { allowCallOverride: true } }]);
    const s = new ScreeningService(p, fakeAudit());
    const r: any = await s.run(CTX, { ...CFG, entries: [ENTREE], scenarioCode: 'SCN-SCREEN',
      moteurConfig: { echelle: 100 }, justification: 'Tuning urgence — faux négatifs sur translittérations' });
    ok(r.hits.length === 1, 'l\'override rétablit l\'échelle 100 → hit');
    ok(p._db.runs[0].config.moteur.echelle === 100, 'la config effective (override) est tracée');
    ok(p._db.runs[0].config.source.scenarioVersion === 1, 'le scénario de base reste tracé');
    ok(p._db.runs[0].config.override.justification.includes('Tuning'), 'C7 : la justification est tracée sur le run');
  });
  await it('C7 : override SANS opt-in tenant (allowCallOverride absent/false) → refus typé', async () => {
    const p = fakePrisma(CLIENTS.map((c) => ({ ...c })), [], [], [], [], [{ id: 't1', settings: {} }]);
    const s = new ScreeningService(p, fakeAudit());
    await rejects(s.run(CTX, { ...CFG, entries: [ENTREE], moteurConfig: { echelle: 100 }, justification: 'x' }), 'allowCallOverride');
  });
  await it('C7 : override avec opt-in mais SANS justification → refus R7', async () => {
    const p = fakePrisma(CLIENTS.map((c) => ({ ...c })), [], [], [], [], [{ id: 't1', settings: { allowCallOverride: true } }]);
    const s = new ScreeningService(p, fakeAudit());
    await rejects(s.run(CTX, { ...CFG, entries: [ENTREE], moteurConfig: { echelle: 100 } }), 'justification');
  });

  // ── R415 — GOUVERNANCE de la config : publier/lister des versions, et REJEU R48/R49 ──
  await it('R415 publier une config sans motif → refus R7', async () => {
    const { s } = mk();
    await rejects(s.publierConfig(CTX, { moteur: { echelle: 50 } } as any), 'R7');
  });
  await it('R415 publier v1 (effet passé) → run(scenarioCode) l\'applique ; configs() la donne en vigueur', async () => {
    const { s } = mk();
    await s.publierConfig(CTX, { moteur: { echelle: 100 }, effectiveFrom: '2020-01-01T00:00:00.000Z', motif: 'seuil initial' });
    const cfgs: any = await s.configs(CTX);
    ok(cfgs.enVigueur && cfgs.enVigueur.version === 1, 'v1 en vigueur');
    const r: any = await s.run(CTX, { ...CFG, entries: [ENTREE], scenarioCode: 'SC-SCREENING' });
    ok(r.hits.length === 1, 'échelle 100 → hit');
  });
  await it('R415/R48/R49 rejeu : après une v2, le run rejoué reproduit ses hits depuis la config PERSISTÉE', async () => {
    const { s } = mk();
    await s.publierConfig(CTX, { moteur: { echelle: 100 }, effectiveFrom: '2020-01-01T00:00:00.000Z', motif: 'v1' });
    const run0: any = await s.run(CTX, { ...CFG, entries: [ENTREE], scenarioCode: 'SC-SCREENING' });
    ok(run0.hits.length === 1, 'run0 a 1 hit sous v1');
    // le monde change : v2 durcit l'échelle → un run NEUF ne verrait plus le hit…
    await s.publierConfig(CTX, { moteur: { echelle: 50 }, motif: 'v2 durcissement' });
    const neuf: any = await s.run(CTX, { ...CFG, entries: [ENTREE], scenarioCode: 'SC-SCREENING' });
    ok(neuf.hits.length === 0, 'v2 en vigueur → run neuf sans hit');
    // …mais le REJEU de run0 rescore avec la config PERSISTÉE (échelle 100), pas la v2 courante.
    const rep: any = await s.replay(CTX, run0.run.id, [ENTREE]);
    ok(rep.identique === true, 'rejeu identique à l\'origine (R48/R49)');
    ok(rep.rejoue.length === 1 && rep.rejoue[0].entreeUid === 'SAN-1', 'le hit d\'origine est reproduit');
  });

  // ── R411 — HISTORISATION/AUDIT : lire les hits d'un SUJET (filtre client) ──
  await it('R411 audit : hits filtrés par client (historique d\'un sujet)', async () => {
    const { p, s } = mk();
    await s.run(CTX, { ...CFG, entries: [ENTREE] });          // produit 1 hit pour c1
    const tous: any[] = await s.hits(CTX, {});
    const deC1: any[] = await s.hits(CTX, { clientId: 'c1' });
    const deX: any[] = await s.hits(CTX, { clientId: 'inexistant' });
    ok(tous.length === 1 && deC1.length === 1 && deC1[0].clientId === 'c1', 'filtre client : le hit du sujet');
    ok(deX.length === 0, 'filtre client : aucun hit pour un sujet sans correspondance');
    ok(p._db.hits[0].detail && typeof p._db.hits[0].score === 'number', 'le hit reste une pièce forensique (score + décomposition)');
  });

  await it('R411 export d\'audit : hit JOINT à sa config (run) et à sa qualification motivée', async () => {
    const { p, s } = mk();
    await s.run(CTX, { ...CFG, entries: [ENTREE] });          // 1 hit pour c1, run avec config
    const hitId = p._db.hits[0].id;
    await s.qualify(CTX, hitId, 'VRAI_POSITIF', 'Correspondance confirmée sur pièce');
    const exp: any = await s.exporterHits(CTX, { clientId: 'c1' });
    ok(exp.total === 1 && exp.parJeton === CTX.userId, 'export tracé (auteur = jeton), 1 ligne');
    const l = exp.lignes[0];
    ok(l.hitId === hitId && l.sujet.id === 'c1' && l.sujet.type === 'client', 'ligne rattachée au hit + sujet typé');
    ok(l.decomposition && typeof l.score === 'number', 'décomposition forensique présente (R411)');
    ok(l.run && l.run.liste === 'SECO' && l.run.version === '2026-07-14', 'config du run qui a produit le hit (R414)');
    ok(l.qualification && l.qualification.verdict === 'VRAI_POSITIF' && l.qualification.par === CTX.userId, 'qualification motivée, auteur = jeton (R101)');
  });
  await it('R411 export d\'audit : hit non qualifié → qualification null, jamais inventée', async () => {
    const { s } = mk();
    await s.run(CTX, { ...CFG, entries: [ENTREE] });
    const exp: any = await s.exporterHits(CTX, {});
    ok(exp.total === 1 && exp.lignes[0].qualification === null, 'un hit BRUT s\'exporte sans verdict (null)');
    ok(exp.lignes[0].statut === 'BRUT', 'statut BRUT préservé');
  });
  await it('R411 export CSV : en-tête stable + ligne, échappement RFC 4180 d\'un motif à virgule', async () => {
    const { p, s } = mk();
    await s.run(CTX, { ...CFG, entries: [ENTREE] });
    await s.qualify(CTX, p._db.hits[0].id, 'FAUX_POSITIF', 'Homonyme, né une autre année');   // motif AVEC virgule
    const csv: string = await s.exporterHitsCsv(CTX, { clientId: 'c1' });
    const lignes = csv.split('\r\n');
    ok(lignes[0].startsWith('at,statut,sujet_type,sujet_id,'), 'en-tête CSV stable');
    ok(lignes[0].endsWith('verdict,motif,qualifie_par,qualifie_at'), 'colonnes qualification en fin');
    ok(lignes.length === 2, 'un hit → une ligne de données');
    ok(lignes[1].includes('"Homonyme, né une autre année"'), 'motif à virgule encadré de guillemets (RFC 4180)');
    ok(lignes[1].includes(',c1,') && lignes[1].includes('FAUX_POSITIF'), 'sujet + verdict présents');
  });
  await it('R411 export CSV pur : hitsVersCsv double les guillemets internes', async () => {
    const csv = hitsVersCsv([{ sujet: { type: 'client', id: 'c1' }, qualification: { motif: 'dit «"VIP"»', verdict: 'VRAI_POSITIF', par: 'i.vernet' } }]);
    ok(csv.split('\r\n').length === 2 && csv.includes('"dit «""VIP""»"'), 'guillemets internes doublés');
  });

  // ── R100 sujets étendus : le screening vise aussi PERSONNES et PROSPECTS (même moteur, même règle) ──
  await it('R100 sujets étendus : screener une PERSONNE puis un PROSPECT (hit typé)', async () => {
    const persons = [{ id: 'per1', tenantId: 't1', nom: 'Viktor Volkov', etat: 'ACTIVE', donnees: { date_naissance: '1965-03-12' } }];
    const onboardings = [{ id: 'onb1', tenantId: 't1', prospectNom: 'Viktor Volkov', etape: 'PROSPECT' }];
    const p = fakePrisma([], [], persons, onboardings); const a = fakeAudit(); const s = new ScreeningService(p, a);
    const rp: any = await s.run(CTX, { ...CFG, entries: [ENTREE], sujet: 'personne' });
    ok(rp.hits.length === 1 && p._db.hits[0].sujetType === 'personne' && p._db.hits[0].clientId === 'per1', 'hit personne : sujet tracé (per1)');
    const ro: any = await s.run(CTX, { ...CFG, entries: [ENTREE], sujet: 'prospect' });
    ok(ro.hits.length === 1 && p._db.hits[1].sujetType === 'prospect' && p._db.hits[1].clientId === 'onb1', 'hit prospect : sujet tracé (onb1)');
    ok(p._db.runs[0].sujetType === 'personne' && p._db.runs[1].sujetType === 'prospect', 'chaque run tracé par type de sujet');
    const dePers: any[] = await s.hits(CTX, { sujetType: 'personne' });
    ok(dePers.length === 1 && dePers[0].clientId === 'per1', 'audit : filtre par type de sujet');
  });

  // ── R100 screening de TRANSACTION : screener les PARTIES d'un virement (donneur/bénéficiaire) ──
  await it('R100 transaction : screener les parties d\'un virement (parties explicites)', async () => {
    const p = fakePrisma([]); const a = fakeAudit(); const s = new ScreeningService(p, a);
    const parties = [
      { id: '11111111-1111-1111-1111-111111111111', name: 'Alice Ordinary' },                     // donneur : sans rapport
      { id: '22222222-2222-2222-2222-222222222222', name: 'Viktor Volkov', dob: '1965-03-12' },    // bénéficiaire : listé
    ];
    const r: any = await s.run(CTX, { ...CFG, entries: [ENTREE], sujet: 'transaction', parties });
    ok(r.hits.length === 1, 'un seul hit : la partie bénéficiaire listée');
    ok(p._db.hits[0].sujetType === 'transaction' && p._db.hits[0].clientId === '22222222-2222-2222-2222-222222222222', 'hit rattaché à la PARTIE + typé transaction');
    ok(p._db.runs[0].sujetType === 'transaction' && p._db.runs[0].perimetre === 2, 'run typé transaction, périmètre = 2 parties');
  });

  // ── R100 branchement FLUX RÉEL : screener les parties d'un virement depuis son message SWIFT brut ──
  await it('R100 SWIFT : partiesSwift isole le NOM (le compte /IBAN de 1re ligne n\'est pas un nom)', async () => {
    const parties = partiesSwift({ reference: 'REF-77',
      donneurOrdre: '/CH9300762011623852957\nAlice Ordinary\n12 Rue du Lac',
      beneficiaire: '/DE89370400440532013000\nViktor Volkov',
      banqueBeneficiaire: 'DEUTDEFF' });
    ok(parties.length === 3, 'trois parties extraites (donneur, bénéficiaire, banque)');
    ok(parties[0].id === 'REF-77:donneur' && parties[0].name === 'Alice Ordinary', 'donneur : nom isolé, id = ref:rôle');
    ok(parties[1].name === 'Viktor Volkov', 'bénéficiaire : nom isolé (IBAN écarté)');
    ok(parties[2].id === 'REF-77:banque' && parties[2].est_entite === true, 'banque = entité');
  });
  await it('R100 SWIFT : partie absente du message = jamais inventée', async () => {
    const parties = partiesSwift({ reference: 'REF-88', beneficiaire: 'Jean Dupont' });
    ok(parties.length === 1 && parties[0].id === 'REF-88:beneficiaire', 'seule la partie présente devient sujet');
  });
  await it('R100 SWIFT : runSwift parse un MT103 réel et screene le bénéficiaire listé (bout en bout)', async () => {
    const p = fakePrisma([]); const a = fakeAudit(); const s = new ScreeningService(p, a);
    const mt103 = ['{1:F01BANKBEBBAXXX0000000000}{2:I103BANKDEFFXXXXN}{4:',
      ':20:REF-2026-42', ':32A:260720CHF12000,', ':50K:/CH9300762011623852957', 'Alice Ordinary',
      ':59:/DE89370400440532013000', 'Viktor Volkov', ':57A:DEUTDEFF', '-}'].join('\n');
    const r: any = await s.runSwift(CTX, { ...CFG, entries: [ENTREE], texte: mt103 });
    ok(r.reference === 'REF-2026-42' && r.type === 'MT103', 'référence + type du virement remontés');
    ok(r.hits.length === 1, 'un seul hit : le bénéficiaire listé (le donneur ne l\'est pas)');
    ok(p._db.hits[0].sujetType === 'transaction' && p._db.hits[0].clientId === 'REF-2026-42:beneficiaire',
      'hit typé transaction, rattaché à (virement:référence, rôle)');
    ok(p._db.runs[0].perimetre === 3, 'périmètre = 3 parties extraites du message');
  });
  await it('R100 SWIFT : message non parsable → refus TYPÉ (jamais deviné)', async () => {
    const p = fakePrisma([]); const s = new ScreeningService(p, fakeAudit());
    await rejects(s.runSwift(CTX, { ...CFG, entries: [ENTREE], texte: 'ceci n\'est pas un message SWIFT' }), 'non parsable');
  });

  // ── R100 branchement CORE BANKING : screener les contreparties du journal transactionnel (R297) ──
  await it('R100 flux : partiesTransactions — une partie par écriture NOMMÉE, écriture sans contrepartie ignorée', async () => {
    const parties = partiesTransactions([
      { refExterne: 'FIX-001', contrepartieNom: 'Viktor Volkov' },
      { refExterne: 'FIX-002', contrepartieNom: '  ' },              // pas de nom → ignorée
      { refExterne: 'FIX-003', contrepartieNom: null },              // pas de nom → ignorée
      { refExterne: 'FIX-004', contrepartieNom: 'Alpha SA' },
    ]);
    ok(parties.length === 2, 'seules les écritures avec contrepartie nommée deviennent des parties');
    ok(parties[0].id === 'FIX-001:contrepartie' && parties[0].name === 'Viktor Volkov', 'id = refExterne:contrepartie');
  });
  await it('R100 flux : runFlux screene le journal (tenant-scopé) et rattache le hit à l\'écriture', async () => {
    const txns = [
      { id: 'x1', tenantId: 't1', refExterne: 'FIX-001', contrepartieNom: 'Viktor Volkov', clientId: 'c1' }, // listé
      { id: 'x2', tenantId: 't1', refExterne: 'FIX-002', contrepartieNom: 'Beta Ltd', clientId: 'c1' },      // sans rapport
      { id: 'x9', tenantId: 't2', refExterne: 'FIX-009', contrepartieNom: 'Viktor Volkov', clientId: 'c9' }, // autre tenant
    ];
    const p = fakePrisma([], [], [], [], txns); const a = fakeAudit(); const s = new ScreeningService(p, a);
    const r: any = await s.runFlux(CTX, { ...CFG, entries: [ENTREE] });
    ok(r.transactions === 2 && r.parties === 2, 'seul le journal du tenant t1 est screené (2 écritures)');
    ok(r.hits.length === 1 && p._db.hits[0].clientId === 'FIX-001:contrepartie', 'un hit, rattaché à (écriture:refExterne, contrepartie)');
    ok(p._db.runs[0].sujetType === 'transaction', 'run typé transaction');
  });
  await it('R100 flux : restriction à un client (dossier) — seules ses écritures sont screenées', async () => {
    const txns = [
      { id: 'x1', tenantId: 't1', refExterne: 'A1', contrepartieNom: 'Viktor Volkov', clientId: 'c1' },
      { id: 'x2', tenantId: 't1', refExterne: 'B1', contrepartieNom: 'Viktor Volkov', clientId: 'c2' },
    ];
    const p = fakePrisma([], [], [], [], txns); const s = new ScreeningService(p, fakeAudit());
    const r: any = await s.runFlux(CTX, { ...CFG, entries: [ENTREE], clientId: 'c2' });
    ok(r.transactions === 1 && p._db.hits[0].clientId === 'B1:contrepartie', 'périmètre = écritures du client c2 seul');
  });

  // ── ADR-PEP-001 (P-L4-1) — routage PEP : hit sur liste PEP → PROPOSITION, jamais une bascule ──
  await it('ADR-PEP-001 : hit sur liste catégorie PEP → pep.proposition.creee + tâche COMPLIANCE, statutPep JAMAIS écrit', async () => {
    const persons = [{ id: 'per1', tenantId: 't1', nom: 'Viktor Volkov', etat: 'ACTIVE', statutPep: false, donnees: { date_naissance: '1965-03-12' } }];
    const p = fakePrisma([], [], persons); const s = new ScreeningService(p, fakeAudit());
    const r: any = await s.run(CTX, { ...CFG, liste: 'PEP-LISTE', entries: [ENTREE], sujet: 'personne', categorie: 'PEP' });
    ok(r.hits.length === 1, 'un hit au-dessus du seuil');
    const prop = p._db.events.find((e: any) => e.type === 'pep.proposition.creee');
    ok(!!prop && prop.payload.personId === 'per1' && prop.payload.hitId === r.hits[0].id
      && prop.payload.listeVersion === CFG.version && typeof prop.payload.score === 'number' && !!prop.payload.decomposition,
      'proposition portant hitId, listeVersion, score, décomposition');
    ok(p._db.tasks.some((t: any) => t.type === 'PEP_PROPOSITION' && t.assigneeId === 'COMPLIANCE' && t.subjectId === 'per1'),
      'tâche assignée au rôle compliance');
    ok(p._db.persons[0].statutPep === false, 'R44 : AUCUNE bascule automatique de statutPep');
  });
  await it('ADR-PEP-001 : idempotence — même hit, même version de liste = UNE seule proposition', async () => {
    const persons = [{ id: 'per1', tenantId: 't1', nom: 'Viktor Volkov', etat: 'ACTIVE', statutPep: false, donnees: {} }];
    const p = fakePrisma([], [], persons); const s = new ScreeningService(p, fakeAudit());
    await s.run(CTX, { ...CFG, liste: 'PEP-LISTE', entries: [ENTREE], sujet: 'personne', categorie: 'PEP' });
    await s.run(CTX, { ...CFG, liste: 'PEP-LISTE', entries: [ENTREE], sujet: 'personne', categorie: 'PEP' });   // rejeu même version
    const props = p._db.events.filter((e: any) => e.type === 'pep.proposition.creee');
    ok(props.length === 1, `une seule proposition attendue (obtenu ${props.length})`);
  });
  await it('ADR-PEP-001 : liste NON-PEP (sanctions) → hit sans proposition de PEPisation', async () => {
    const { p, s } = mk();
    const r: any = await s.run(CTX, { ...CFG, entries: [ENTREE] });                    // catégorie absente = sanctions
    ok(r.hits.length === 1 && !p._db.events.some((e: any) => e.type === 'pep.proposition.creee'),
      'aucune proposition hors catégorie PEP');
  });

  // ── C8 (L5) — IDF PAR RUN : deux runs interleavés (tenants + listes différents) rendent des scores
  //     IDENTIQUES à leurs runs isolés. Scores PARTIELS choisis exprès (un exact=100 masquerait une fuite :
  //     la pondération IDF ne pèse que sur les appariements partiels). ──
  await it('C8 : runs concurrents (tenants/listes différents) → scores identiques aux runs isolés (aucune fuite d\'IDF)', async () => {
    const E1 = [{ uid: 'SAN-1', nom_complet: 'Viktor Volkov', type: 'individu' },
                { uid: 'SAN-2', nom_complet: 'Ivan Petrov', type: 'individu' }];
    const E2 = [{ uid: 'PX-1', nom_complet: 'Viktor Sokolov', type: 'individu' },
                { uid: 'PX-2', nom_complet: 'Andrei Volkov', type: 'individu' },
                { uid: 'PX-3', nom_complet: 'Viktor Volkonsky', type: 'individu' }];   // IDF très différent (viktor/volkov fréquents)
    const CL1 = [{ id: 'c1', tenantId: 't1', name: 'Viktor Volkovv' }];               // partiel (typo) → l'IDF pèse
    const CL2 = [{ id: 'z1', tenantId: 't2', name: 'Viktor Volkonski' }];             // partiel → l'IDF pèse
    const runA = (p: any) => new ScreeningService(p, fakeAudit()).run(CTX, { ...CFG, liste: 'A', seuil: 50, entries: E1 as any });
    const runB = (p: any) => new ScreeningService(p, fakeAudit()).run({ ...CTX, tenantId: 't2' }, { ...CFG, liste: 'B', seuil: 50, entries: E2 as any });
    const rIsoA: any = await runA(fakePrisma(CL1.map((c) => ({ ...c }))));
    const rIsoB: any = await runB(fakePrisma(CL2.map((c) => ({ ...c }))));
    ok(rIsoA.hits.length === 1 && rIsoB.hits.length === 1 && rIsoA.hits[0].score < 100 && rIsoB.hits[0].score < 100,
      'préconditions : un hit PARTIEL de chaque côté');
    const [rA, rB]: any[] = await Promise.all([                                        // INTERLEAVÉ
      runA(fakePrisma(CL1.map((c) => ({ ...c })))), runB(fakePrisma(CL2.map((c) => ({ ...c })))) ]);
    ok(rA.hits[0].score === rIsoA.hits[0].score && rB.hits[0].score === rIsoB.hits[0].score,
      `scores interleavés = isolés (A ${rA.hits[0].score}/${rIsoA.hits[0].score} · B ${rB.hits[0].score}/${rIsoB.hits[0].score})`);
  });

  console.log(`\nCâblage screening (SC-01..04, R100→R103 · R411 · R414 · R415) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
