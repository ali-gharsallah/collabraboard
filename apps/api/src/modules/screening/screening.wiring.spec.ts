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
function fakePrisma(clients: any[]) {
  let seq = 0; const id = (p: string) => `${p}-${++seq}`;
  const db = { clients, runs: [] as any[], hits: [] as any[], quals: [] as any[], events: [] as any[] };
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

  console.log(`\nCâblage screening (SC-01..04, R100→R103) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
