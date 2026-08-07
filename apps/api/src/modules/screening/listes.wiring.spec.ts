/**
 * Câblage Ingestion de listes VERSIONNÉE — R409 (L6 · P-L6-1), L6-01..08. Faux Prisma en mémoire.
 * Prouve : bulk immuable (source, version, hash) · idempotence · refus de réécriture d'une version ·
 * delta entité par entité · RESCREENING CIBLÉ du stock (les seules entrées ajoutées/modifiées) ·
 * delisting → hits ouverts en REVUE ACCÉLÉRÉE (jamais de clôture auto, R44) · âge exposé ·
 * conservation ≥ 90 j (purge gardée).
 */
import { ScreeningService } from './screening.service';
import { ListesService } from './listes.service';
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

function fakePrisma(clients: any[]) {
  let seq = 0; const id = (p: string) => `${p}-${++seq}`;
  const db: any = { clients, versions: [], runs: [], hits: [], quals: [], events: [], tasks: [] };
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => {
    if (v && typeof v === 'object' && 'in' in v) return v.in.includes(row[k]); return row[k] === v; });
  const table = (rows: any[], prefix: string) => ({
    findFirst: async ({ where }: any = {}) => rows.find((r) => match(r, where)) ?? null,
    findMany: async ({ where }: any = {}) => rows.filter((r) => match(r, where ?? {})),
    create: async ({ data }: any) => { const r = { id: id(prefix), ...data }; rows.push(r); return r; },
    update: async ({ where, data }: any) => { const r = rows.find((x) => x.id === where.id); Object.assign(r, data); return r; },
    deleteMany: async ({ where }: any) => { const avant = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i], where)) rows.splice(i, 1);
      return { count: avant - rows.length }; },
  });
  const p: any = { _db: db,
    client: table(db.clients, 'CLI'), listeVersion: table(db.versions, 'VER'),
    screeningRun: table(db.runs, 'RUN'), screeningHit: table(db.hits, 'HIT'),
    screeningQualification: table(db.quals, 'Q'), task: table(db.tasks, 'TSK'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; },
      findFirst: async ({ where }: any = {}) => db.events.find((e) => match(e, where)) ?? null },
  };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => {} } as any);
const CTX = { tenantId: 't1', userId: 'i.vernet', role: 'CO' };
const evts = (p: any, t: string) => p._db.events.filter((e: any) => e.type === t);

// Dump « réel » (forme OFAC — normalisé par ingererListe à l'import).
const V1 = [
  { id: 'OFAC-1', entityType: 'Individual', name: 'Viktor Volkov', akas: [], dob: '1965-03-12', nationality: ['RU'] },
  { id: 'OFAC-2', entityType: 'Individual', name: 'Halim Said', akas: [], dob: '1971-01-05', nationality: ['SY'] },
];
const V2 = [
  { id: 'OFAC-1', entityType: 'Individual', name: 'Viktor Volkov', akas: [{ aliasName: 'V. Volkov' }], dob: '1965-03-12', nationality: ['RU'] }, // modifiée
  { id: 'OFAC-3', entityType: 'Individual', name: 'Dmitri Sokolov', akas: [], dob: '1980-02-02', nationality: ['RU'] },                          // ajoutée
];                                                                                                                                              // OFAC-2 retirée
const CLIENTS = [
  { id: 'c1', tenantId: 't1', name: 'Viktor Volkov' },
  { id: 'c2', tenantId: 't1', name: 'Dmitri Sokolov' },
  { id: 'c3', tenantId: 't1', name: 'Halim Said' },
];
const mk = () => { const p = fakePrisma(CLIENTS.map((c) => ({ ...c })));
  const scr = new ScreeningService(p, fakeAudit());
  return { p, scr, l: new ListesService(p, fakeAudit(), scr) }; };

(async () => {
  await it('L6-01 bulk : première version → immuable (hash), événement importee, delta null', async () => {
    const { p, l } = mk();
    const r: any = await l.importer(CTX, { source: 'OFAC', version: 'v1', entries: V1 });
    ok(r.deja === false && r.nEntrees === 2 && typeof r.hash === 'string', 'version créée avec hash');
    ok(p._db.versions.length === 1 && r.delta === null, 'bulk : pas de delta (aucune version antérieure)');
    const ev = evts(p, 'liste.version.importee')[0];
    ok(ev && ev.payload.ajoutees === 2 && ev.payload.retirees === 0, 'événement importee (catalogué C6)');
  });

  await it('L6-02 idempotence : réimporter la même version (mêmes entrées) → deja, une seule ligne', async () => {
    const { p, l } = mk();
    await l.importer(CTX, { source: 'OFAC', version: 'v1', entries: V1 });
    const r: any = await l.importer(CTX, { source: 'OFAC', version: 'v1', entries: V1 });
    ok(r.deja === true && p._db.versions.length === 1, 'aucune seconde ligne');
    ok(evts(p, 'liste.version.importee').length === 1, 'aucun second événement');
  });

  await it('L6-03 immuabilité : même version, entrées DIFFÉRENTES → refus typé', async () => {
    const { l } = mk();
    await l.importer(CTX, { source: 'OFAC', version: 'v1', entries: V1 });
    await rejects(l.importer(CTX, { source: 'OFAC', version: 'v1', entries: V2 }), 'IMMUABLE');
  });

  await it('L6-04 delta entité par entité : v2 → ajoutée OFAC-3, modifiée OFAC-1, retirée OFAC-2', async () => {
    const { l } = mk();
    await l.importer(CTX, { source: 'OFAC', version: 'v1', entries: V1 });
    const r: any = await l.importer(CTX, { source: 'OFAC', version: 'v2', entries: V2 });
    ok(r.delta.ajoutees.length === 1 && r.delta.ajoutees[0] === 'OFAC-3', 'ajoutée détectée');
    ok(r.delta.modifiees.length === 1 && r.delta.modifiees[0] === 'OFAC-1', 'modifiée détectée (alias ajouté)');
    ok(r.delta.retirees.length === 1 && r.delta.retirees[0] === 'OFAC-2', 'retirée détectée');
  });

  await it('L6-05 rescreening CIBLÉ : le run delta ne confronte QUE les entrées ajoutées/modifiées — tracé', async () => {
    const { p, l } = mk();
    await l.importer(CTX, { source: 'OFAC', version: 'v1', entries: V1 });
    const r: any = await l.importer(CTX, { source: 'OFAC', version: 'v2', entries: V2 });
    ok(r.rescreening.entrees === 2, 'sous-liste ciblée = 2 entrées (OFAC-1 modifiée + OFAC-3 ajoutée)');
    ok(r.rescreening.hits === 2, 'hits du delta : c1←OFAC-1 et c2←OFAC-3 (c3/Halim non re-screené)');
    const run = p._db.runs.find((x: any) => x.listeVersion === 'v2');
    ok(!!run && run.perimetre === 3, 'trace R103 : run v2 persisté (stock entier confronté au delta)');
    const ev = evts(p, 'liste.rescreening.cible')[0];
    ok(ev && ev.payload.entrees === 2 && ev.payload.hits === 2, 'événement rescreening.cible (catalogué C6)');
  });

  await it('L6-06 delisting : hit OUVERT sur une entrée retirée → revue ACCÉLÉRÉE (événement + tâche), JAMAIS clôturé', async () => {
    const { p, scr, l } = mk();
    await l.importer(CTX, { source: 'OFAC', version: 'v1', entries: V1 });
    // le stock est screené sur v1 → hit BRUT sur c3 (Halim Said ← OFAC-2)
    await scr.run(CTX, { liste: 'OFAC', version: 'v1', seuil: 85,
      prefiltre: { minPartages: 2, maxTrigrammes: 12, plafond: 400 },
      entries: (p._db.versions[0].entries as any[]) });
    const hitHalim = p._db.hits.find((h: any) => h.entreeUid === 'OFAC-2');
    ok(!!hitHalim && hitHalim.statut === 'BRUT', 'précondition : hit ouvert sur OFAC-2');
    const r: any = await l.importer(CTX, { source: 'OFAC', version: 'v2', entries: V2 });
    ok(r.delisting.retirees === 1 && r.delisting.hitsEnRevue === 1, 'delisting détecté, 1 hit en revue');
    const ev = evts(p, 'liste.delisting.revue')[0];
    ok(ev && ev.payload.uid === 'OFAC-2' && ev.payload.hitId === hitHalim.id, 'événement de revue accélérée');
    ok(p._db.tasks.some((t: any) => t.type === 'REVUE_DELISTING' && t.subjectId === hitHalim.id), 'tâche compliance créée');
    ok(p._db.hits.find((h: any) => h.id === hitHalim.id).statut === 'BRUT', 'R44 : JAMAIS de clôture automatique');
  });

  await it('L6-07 âge de la liste exposé : dernière version par source + ageJours', async () => {
    const { p, l } = mk();
    await l.importer(CTX, { source: 'OFAC', version: 'v1', entries: V1 });
    await l.importer(CTX, { source: 'OFAC', version: 'v2', entries: V2 });
    const dans3j = new Date(new Date(p._db.versions[1].importeLe).getTime() + 3 * 86_400_000);
    const listes: any[] = await l.listes(CTX, dans3j);
    ok(listes.length === 1 && listes[0].version === 'v2' && listes[0].ageJours === 3, 'âge = 3 j sur la dernière version');
  });

  await it('L6-08 conservation ≥ 90 j : purge à 10 j → refus ; à 120 j → purgée', async () => {
    const { p, l } = mk();
    await l.importer(CTX, { source: 'OFAC', version: 'v1', entries: V1 });
    const t0 = new Date(p._db.versions[0].importeLe).getTime();
    await rejects(l.purger(CTX, { source: 'OFAC', version: 'v1' }, new Date(t0 + 10 * 86_400_000)), 'conservation');
    const r: any = await l.purger(CTX, { source: 'OFAC', version: 'v1' }, new Date(t0 + 120 * 86_400_000));
    ok(r.purgee === true && p._db.versions.length === 0, 'purge au-delà de la rétention');
  });

  console.log(`\nCâblage Ingestion de listes versionnée (L6-01..08, R409) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
