/**
 * Câblage Core banking — SY-01..05 (R167→R169). Miroir strict de l'amendement.
 * Le core est un port déclaré ; la synchro est un dérivé tracé lecture seule ; l'inconnu va
 * en quarantaine. Faux Prisma en mémoire. Écrit AVANT l'implémentation.
 *
 * Harnais : compiler core-sync.service.ts + ce fichier ;
 *   echo "── Câblage Core banking (SY-01..05, R167→R169) ──"; run core-sync.wiring.spec.js
 */
import { CoreSyncService } from './core-sync.service';
import { createHash } from 'crypto';
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
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

function fakePrisma(seed: any = {}) {
  let seq = 0; const id = (p: string) => `${p}-${++seq}`;
  const db = { tenants: seed.tenants ?? [], lots: [] as any[], quarantaine: [] as any[], events: [] as any[] };
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => {
    if (v === null) return row[k] == null;
    return row[k] === v;
  });
  const table = (rows: any[], prefix: string) => ({
    findMany: async ({ where }: any = {}) => rows.filter((x) => match(x, where)),
    findFirst: async ({ where }: any = {}) => rows.find((x) => match(x, where)) ?? null,
    create: async ({ data }: any) => { const r = { id: id(prefix), ...data }; rows.push(r); return r; },
    update: async ({ where, data }: any) => { const r = rows.find((x) => x.id === where.id)!; Object.assign(r, data); return r; },
  });
  const p: any = { _db: db, tenant: table(db.tenants, 'T'), coreSyncLot: table(db.lots, 'L'),
    coreQuarantaine: table(db.quarantaine, 'Q'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; },
      findMany: async ({ where }: any = {}) => db.events.filter((e) => match(e, where)) } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
function fakePort(perimetre = ['COMPTES', 'TRANSACTIONS']) {
  return { systeme: 'Avaloq', version: 'ACP 5.6', perimetre,
    lire: async (type: string) => type === 'COMPTES'
      ? [{ compteCore: 'CH-001', solde: 1200000 }, { compteCore: 'CH-002', solde: 350000 }, { compteCore: 'CH-999', solde: 5000 }]
      : [] };
}
const evts = (p: any, t: string) => p._db.events.filter((e: any) => e.type === t);
const CO = { tenantId: 't1', userId: 'i.vernet', role: 'CO' };
const mk = (port?: any, mapping?: any[]) => {
  const p = fakePrisma({ tenants: [{ id: 't1', name: 'GWB', settings: {
    coreMapping: mapping ?? [
      { compteCore: 'CH-001', clientId: 'cli-1', depuisLe: '2026-01-01' },
      { compteCore: 'CH-002', clientId: 'cli-2', depuisLe: '2026-01-01' }] } }] });
  const s = new CoreSyncService(p, fakeAudit(), port === null ? {} : { core: port ?? fakePort() });
  return { p, s };
};

(async () => {
  // ── SY-01 (R167) — pas de port ; hors périmètre ──
  await it('SY-01 sans port → refus R167 ; POSITIONS à un port COMPTES-seul → refus explicite, pas un silence', async () => {
    const { s } = mk(null);
    await rejects(s.importerLot(CO, 'COMPTES'), 'R167');
    const w = mk(fakePort(['COMPTES']));
    await rejects(w.s.importerLot(CO, 'POSITIONS'), 'périmètre');
    ok(evts(w.p, 'core.acces.refuse').length === 1, 'le refus de périmètre est tracé');
  });

  // ── SY-02 (R168) — le lot est signé, le core intouchable ──
  await it('SY-02 lot importé → (source, nb, empreinte) recalculable ; AUCUNE voie d\'écriture vers le port', async () => {
    const port = fakePort();
    const { p, s } = mk(port);
    await s.importerLot(CO, 'COMPTES');
    const lot = p._db.lots[0];
    ok(lot.source === 'Avaloq ACP 5.6' && lot.nbLignes === 3, 'la source et le compte sont portés');
    const lignes = await port.lire('COMPTES');
    ok(lot.shaLot === sha(JSON.stringify(lignes)), 'l\'empreinte du lot se recalcule — dérivé prouvable');
    ok(evts(p, 'core.sync.lot').length === 1, 'l\'import est un événement');
    ok(!('ecrire' in port) && Object.keys(port).every((k) => k !== 'ecrire'), 'le port n\'a PAS d\'écriture');
    ok(typeof (s as any).ecrireVersCore === 'undefined', 'le service n\'expose AUCUNE écriture vers le core — lecture seule par construction');
  });

  // ── SY-03 (R169) — l'inconnu ne se devine pas ──
  await it('SY-03 CH-999 hors mapping → QUARANTAINE + tâche ; les lignes connues passent (R39, rien de bloqué)', async () => {
    const { p, s } = mk();
    const r: any = await s.importerLot(CO, 'COMPTES');
    ok(r.rattaches === 2 && r.enQuarantaine === 1, 'connues passent, inconnue isolée');
    const q = p._db.quarantaine[0];
    ok(q.statut === 'EN_ATTENTE' && q.ligne.compteCore === 'CH-999', 'la ligne attend, jamais devinée');
    ok(evts(p, 'core.sync.quarantaine').length === 1 && evts(p, 'tache.core.resolution').length === 1, 'tracée + tâche');
  });

  // ── SY-04 (R169) — la résolution est un acte humain qui enrichit le mapping ──
  await it('SY-04 résoudre (jeton) → mapping enrichi (date du jour), quarantaine RESOLUE, tracé', async () => {
    const { p, s } = mk();
    await s.importerLot(CO, 'COMPTES');
    const qid = p._db.quarantaine[0].id;
    await rejects(s.resoudreQuarantaine(CO, qid, ''), 'clientId');
    await s.resoudreQuarantaine(CO, qid, 'cli-3');
    ok(p._db.quarantaine[0].statut === 'RESOLUE' && p._db.quarantaine[0].resoluPar === 'i.vernet', 'acte jeton');
    const mapping = (p._db.tenants[0].settings as any).coreMapping;
    ok(mapping.some((m: any) => m.compteCore === 'CH-999' && m.clientId === 'cli-3' && m.depuisLe), 'le mapping est enrichi, daté (pattern R29)');
    ok(evts(p, 'core.sync.resolution').length === 1, 'tracé');
    await rejects(s.resoudreQuarantaine(CO, qid, 'cli-4'), 'déjà');
  });

  // ── SY-05 (garde) — tenant structurel + mapping versionné ──
  await it('SY-05 t2 → refus introuvable ; le mapping respecte depuisLe (une ligne future n\'est pas active)', async () => {
    const { s } = mk(fakePort(), [
      { compteCore: 'CH-001', clientId: 'cli-1', depuisLe: '2026-01-01' },
      { compteCore: 'CH-002', clientId: 'cli-2', depuisLe: '2099-01-01' }]);   // future
    const r: any = await s.importerLot(CO, 'COMPTES');
    ok(r.rattaches === 1 && r.enQuarantaine === 2, 'le mapping FUTUR n\'est pas actif — la date de mise en vigueur fait foi');
    const w2 = mk();
    await rejects(w2.s.importerLot({ tenantId: 't2', userId: 'x', role: 'CO' }, 'COMPTES'), 'introuvable');
  });

  console.log(`\nCâblage Core banking (SY-01..05, R167→R169) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
