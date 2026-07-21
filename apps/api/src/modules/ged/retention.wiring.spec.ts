/**
 * La rétention naît au classement — RN-01..04 (R170). Miroir strict de l'amendement.
 * Compile ged-ingestion (MODIFIÉ par R170) + ged-avance (GD-11, INTOUCHÉ) ensemble :
 * le chaînon classement → échéance → proposition est prouvé de bout en bout.
 *
 * Harnais : echo "── Rétention au classement (RN-01..04, R170) ──"; run retention.wiring.spec.js
 */
import { GedIngestionService } from '../ged/ged-ingestion.service';
import { GedAvanceService } from '../ged/ged-avance.service';
declare const process: { exit(n: number): void };

let passed = 0, failed = 0; const fails: string[] = [];
function it(name: string, fn: () => Promise<void>): Promise<void> {
  return fn().then(() => { passed++; }, (e: Error) => { failed++; fails.push(`✗ ${name} — ${e.message}`); });
}
const ok = (c: boolean, m = 'assertion') => { if (!c) throw new Error(m); };

function fakePrisma(seed: any = {}) {
  let seq = 0; const id = (p: string) => `${p}-${++seq}`;
  const db = { tenants: seed.tenants ?? [], documents: [] as any[], versions: [] as any[],
    ingests: [] as any[], events: [] as any[] };
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => {
    if (v === null) return row[k] == null;
    if (v && typeof v === 'object' && 'lte' in v) return row[k] != null && String(row[k]) <= String(v.lte);
    return row[k] === v;
  });
  const table = (rows: any[], prefix: string) => ({
    findMany: async ({ where }: any = {}) => rows.filter((x) => match(x, where)),
    findFirst: async ({ where }: any = {}) => rows.find((x) => match(x, where)) ?? null,
    create: async ({ data }: any) => { const r = { id: id(prefix), ...data }; rows.push(r); return r; },
    update: async ({ where, data }: any) => { const r = rows.find((x) => x.id === where.id)!; Object.assign(r, data); return r; },
  });
  const p: any = { _db: db, tenant: table(db.tenants, 'T'), document: table(db.documents, 'D'),
    documentVersion: table(db.versions, 'V'), gedIngestEntry: table(db.ingests, 'IG'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; },
      findMany: async ({ where }: any = {}) => db.events.filter((e) => match(e, where)) } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
const fakeOcr = () => ({ moteur: 't', lire: async (c: string) => ({ texte: c }) });
const evts = (p: any, t: string) => p._db.events.filter((e: any) => e.type === t);
const CO = { tenantId: 't1', userId: 'i.vernet', role: 'CO' };
const mk = () => {
  const p = fakePrisma({ tenants: [{ id: 't1', name: 'GWB', settings: { gedDocTypes: [
    { code: 'JUSTIF', rolesAutorises: ['CO', 'CF'], retentionAnnees: 10 },
    { code: 'NOTE', rolesAutorises: ['CO', 'CF'] }], gedInboxRoles: ['CO', 'CF'] } }] });
  return { p, ged: new GedIngestionService(p, fakeAudit(), { ocr: fakeOcr() } as any),
    gedA: new GedAvanceService(p, fakeAudit()) };
};
const ing = async (w: any, nom: string) =>
  (await w.ged.ingerer(CO, { canal: 'SCAN', source: 's', nomFichier: nom, contenu: 'x' })).documentId;

(async () => {
  // ── RN-01 (R170) — le type à 10 ans pose l'échéance ──
  await it('RN-01 classer vers JUSTIF (10 ans) → retentionUntil = classement + 10 ans, portée à l\'événement', async () => {
    const { p, ged } = mk();
    const d = await ing({ ged }, 'justif.pdf');
    await ged.classer(CO, d, { typeCode: 'JUSTIF', clientId: 'cli-1' });
    const doc = p._db.documents[0];
    ok(!!doc.retentionUntil, 'l\'échéance est POSÉE');
    const annees = (new Date(doc.retentionUntil).getTime() - Date.now()) / (365.25 * 86400000);
    ok(annees > 9.9 && annees < 10.1, `+10 ans (mesuré ${annees.toFixed(2)})`);
    ok(evts(p, 'ged.classement')[0].payload.retentionUntil === doc.retentionUntil, 'l\'événement la porte');
  });

  // ── RN-02 (R170) — sans durée, pas d'échéance ──
  await it('RN-02 classer vers NOTE (sans durée) → retentionUntil nul, le tick ne propose JAMAIS', async () => {
    const { p, ged, gedA } = mk();
    const d = await ing({ ged }, 'note.pdf');
    await ged.classer(CO, d, { typeCode: 'NOTE', clientId: 'cli-1' });
    ok(p._db.documents[0].retentionUntil == null, 'pas de durée, pas d\'échéance');
    await gedA.tickRetention(CO, new Date(Date.now() + 20 * 365.25 * 86400000));
    ok(!p._db.documents[0].destructionProposee, 'GD-11 ne propose jamais ce document');
  });

  // ── RN-03 (R170 + GD-11 intouché) — le chaînon complet ──
  await it('RN-03 classé sous 10 ans + tick à 11 ans → destruction PROPOSÉE une fois, statut ACTIF (R39)', async () => {
    const { p, ged, gedA } = mk();
    const d = await ing({ ged }, 'justif.pdf');
    await ged.classer(CO, d, { typeCode: 'JUSTIF', clientId: 'cli-1' });
    const plus11 = new Date(Date.now() + 11 * 365.25 * 86400000);
    await gedA.tickRetention(CO, plus11);
    ok(p._db.documents[0].destructionProposee === true, 'PROPOSÉE — le chaînon est complet');
    ok(p._db.documents[0].statut === 'ACTIF', 'toujours ACTIF : l\'échéance propose, elle ne détruit pas');
    await gedA.tickRetention(CO, plus11);
    ok(evts(p, 'ged.destruction.proposee').length === 1, 'UNE seule proposition — pas de harcèlement');
  });

  // ── RN-04 (garde R39) — l'échéance est une date, pas une punition ──
  await it('RN-04 échéance posée → le document vit (ACTIF, consultable) — rien n\'est bloqué', async () => {
    const { p, ged } = mk();
    const d = await ing({ ged }, 'justif.pdf');
    await ged.classer(CO, d, { typeCode: 'JUSTIF', clientId: 'cli-1' });
    ok(p._db.documents[0].statut === 'ACTIF' && !!p._db.documents[0].retentionUntil, 'échéance posée, document vivant');
  });

  console.log(`\nRétention au classement (RN-01..04, R170) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
