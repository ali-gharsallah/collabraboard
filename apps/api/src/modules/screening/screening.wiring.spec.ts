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
import { ScreeningService } from './screening.service';
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
function fakePrisma(clients: any[], scenarios: any[] = []) {
  let seq = 0; const id = (p: string) => `${p}-${++seq}`;
  const db = { clients, scenarios, runs: [] as any[], hits: [] as any[], quals: [] as any[], events: [] as any[] };
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
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; } },
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
  await it('R414 override d\'appel prime sur le scénario, et reste tracé', async () => {
    const { p, s } = mkS([scn(1, '2020-01-01T00:00:00.000Z', { echelle: 50 })]);
    const r: any = await s.run(CTX, { ...CFG, entries: [ENTREE], scenarioCode: 'SCN-SCREEN', moteurConfig: { echelle: 100 } });
    ok(r.hits.length === 1, 'l\'override rétablit l\'échelle 100 → hit');
    ok(p._db.runs[0].config.moteur.echelle === 100, 'la config effective (override) est tracée');
    ok(p._db.runs[0].config.source.scenarioVersion === 1, 'le scénario de base reste tracé');
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

  console.log(`\nCâblage screening (SC-01..04, R100→R103 · R411 · R414 · R415) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
