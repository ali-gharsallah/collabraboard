/**
 * Câblage Capacité d'équipe — WK-01..05 (R183→R185). Miroir strict de l'amendement, écrit
 * AVANT l'implémentation. La charge dérive, la transparence est structurelle, la
 * répartition est un acte, les points suivent le barème du jour — le bonus reste humain.
 *
 * Harnais : compiler workload.service.ts + ce fichier ;
 *   echo "── Câblage Capacité d'équipe (WK-01..05, R183→R185) ──"; run workload.wiring.spec.js
 */
import { WorkloadService } from './workload.service';
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

function fakePrisma(seed: any = {}) {
  let seq = 0; const id = (p: string) => `${p}-${++seq}`;
  const db = { tenants: seed.tenants ?? [], users: seed.users ?? [], tasks: seed.tasks ?? [], events: [] as any[] };
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => row[k] === v);
  const table = (rows: any[], prefix: string) => ({
    findMany: async ({ where }: any = {}) => rows.filter((x) => match(x, where)),
    findFirst: async ({ where }: any = {}) => rows.find((x) => match(x, where)) ?? null,
    create: async ({ data }: any) => { const r = { id: id(prefix), ...data }; rows.push(r); return r; },
    update: async ({ where, data }: any) => { const r = rows.find((x) => x.id === where.id)!; Object.assign(r, data); return r; },
  });
  const p: any = { _db: db, tenant: table(db.tenants, 'T'), user: table(db.users, 'U'), task: table(db.tasks, 'K'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; },
      findMany: async ({ where }: any = {}) => db.events.filter((e) => match(e, where)) } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
const evts = (p: any, t: string) => p._db.events.filter((e: any) => e.type === t);
const HEAD = { tenantId: 't1', userId: 'u-head', role: 'CO_HEAD' };
const ANNA = { tenantId: 't1', userId: 'u-anna', role: 'CO' };
const TIERS = { tenantId: 't1', userId: 'u-rm1', role: 'RM' };
const J = (d: string) => d + 'T10:00:00.000Z';
const SETTINGS = {
  workloadResponsables: [{ responsableRole: 'CO_HEAD', equipeRole: 'CO' }],
  workloadCapacite: { standardParSemaine: 10, seuilSurchargePct: 80 },
  workloadBareme: [{ depuisLe: '2026-01-01', points: { AML_ALERT: 3, KYC_REVIEW: 2, DOC_CLASSEMENT: 1 } }],
};
const mk = () => {
  const p = fakePrisma({
    tenants: [{ id: 't1', name: 'GWB', settings: JSON.parse(JSON.stringify(SETTINGS)) }],
    users: [
      { id: 'u-head', tenantId: 't1', name: 'I. Vernet', role: 'CO_HEAD' },
      { id: 'u-anna', tenantId: 't1', name: 'A. Blanc', role: 'CO' },
      { id: 'u-marc', tenantId: 't1', name: 'M. Roth', role: 'CO' },
      { id: 'u-rm1', tenantId: 't1', name: 'P. Muller', role: 'RM' }],
    tasks: [
      // Anna : 2 en cours lourdes + 2 faites
      { id: 'k1', tenantId: 't1', assigneeId: 'u-anna', type: 'AML_ALERT', statut: 'EN_COURS', createdAt: J('2026-07-18'), doneAt: null },
      { id: 'k2', tenantId: 't1', assigneeId: 'u-anna', type: 'AML_ALERT', statut: 'OUVERTE', createdAt: J('2026-07-20'), doneAt: null },
      { id: 'k3', tenantId: 't1', assigneeId: 'u-anna', type: 'KYC_REVIEW', statut: 'FAITE', createdAt: J('2026-07-10'), doneAt: J('2026-07-12') },
      { id: 'k4', tenantId: 't1', assigneeId: 'u-anna', type: 'AML_ALERT', statut: 'FAITE', createdAt: J('2026-07-13'), doneAt: J('2026-07-14') },
      // Marc : léger
      { id: 'k5', tenantId: 't1', assigneeId: 'u-marc', type: 'DOC_CLASSEMENT', statut: 'FAITE', createdAt: J('2026-07-15'), doneAt: J('2026-07-15') }],
  });
  return { p, s: new WorkloadService(p, fakeAudit()) };
};

(async () => {
  // ── WK-01 (R183) — tout dérive, rien ne se saisit ──
  await it('WK-01 charge équipe : compteurs, % pondéré, délai moyen — dérivés des tâches', async () => {
    const { s } = mk();
    const eq: any = await s.chargeEquipe(HEAD, 'CO');
    ok(eq.membres.length === 2, 'l\'équipe = les CO');
    const anna = eq.membres.find((m: any) => m.userId === 'u-anna');
    ok(anna.ouvertes === 1 && anna.enCours === 1 && anna.faites === 2, 'qui fait quoi, à l\'état près');
    ok(anna.chargePct === 60, '2 alertes actives × 3 pts / capacité 10 = 60%');
    ok(anna.delaiMoyenJours === 1.5, 'délai moyen des accomplies : (2+1)/2');
    const marc = eq.membres.find((m: any) => m.userId === 'u-marc');
    ok(marc.chargePct === 0 && marc.faites === 1, 'Marc est libre — la répartition se voit');
  });

  // ── WK-02 (R183) — la transparence est structurelle ──
  await it('WK-02 chacun lit SES mesures ; le responsable déclaré lit l\'équipe ; un tiers est refusé tracé', async () => {
    const { p, s } = mk();
    const moi: any = await s.mesuresDe(ANNA, 'u-anna');
    ok(moi.chargePct === 60 && moi.points > 0, 'je vois ma charge et mes points — rien ne m\'est caché');
    await s.mesuresDe(HEAD, 'u-anna');
    await rejects(s.mesuresDe(TIERS, 'u-anna'), 'responsable');
    ok(evts(p, 'workload.acces.refuse').length === 1, 'le refus est tracé');
    await rejects(s.chargeEquipe(ANNA, 'CO'), 'responsable');
  });

  // ── WK-03 (R184) — le signal suggère, l'acte déplace ──
  await it('WK-03 surcharge → signal sans déplacement ; réassigner = acte motivé du responsable', async () => {
    const { p, s } = mk();
    p._db.tasks.push({ id: 'k6', tenantId: 't1', assigneeId: 'u-anna', type: 'AML_ALERT', statut: 'OUVERTE', createdAt: J('2026-07-21'), doneAt: null });
    const sig: any = await s.signalerSurcharges(HEAD, 'CO');
    ok(sig.length === 1 && sig[0].userId === 'u-anna' && sig[0].chargePct === 90, '90% > seuil 80 : Anna signalée');
    ok(evts(p, 'workload.surcharge.signalee').length === 1, 'le signal est un événement');
    ok(p._db.tasks.find((k: any) => k.id === 'k6').assigneeId === 'u-anna', 'RIEN n\'a bougé — le système ne déplace pas');
    await rejects(s.reassigner(HEAD, 'k6', 'u-marc', ''), 'motif');
    await rejects(s.reassigner(ANNA, 'k6', 'u-marc', 'x'), 'responsable');
    await s.reassigner(HEAD, 'k6', 'u-marc', 'Rééquilibrage — Anna à 90%, Marc disponible');
    ok(p._db.tasks.find((k: any) => k.id === 'k6').assigneeId === 'u-marc'
      && evts(p, 'workload.tache.reassignee').length === 1, 'la tâche change de main PAR L\'ACTE, tracé');
  });

  // ── WK-04 (R185) — les points alimentent, l'humain décide ──
  await it('WK-04 points au barème visibles par l\'intéressé ; snapshot RH = événement, pas un bonus calculé', async () => {
    const { p, s } = mk();
    const pts: any = await s.points(ANNA, 'u-anna');
    ok(pts.total === 5 && pts.detail.length === 2, 'KYC_REVIEW 2 + AML_ALERT 3 = 5, le détail dit pourquoi');
    const snap: any = await s.snapshotRh(HEAD, 'CO');
    ok(snap.membres.find((m: any) => m.userId === 'u-anna').points === 5, 'la photographie par personne');
    const e = evts(p, 'rh.bonification.snapshot');
    ok(e.length === 1 && !JSON.stringify(e[0]).toLowerCase().includes('bonus'), 'le moteur fournit la matière — il ne calcule PAS le bonus');
  });

  // ── WK-05 (R185/R29) — le barème du jour de l'accomplissement, à vie ──
  await it('WK-05 barème v2 daté → les accomplissements antérieurs gardent leurs points v1', async () => {
    const { p, s } = mk();
    p._db.tenants[0].settings.workloadBareme.push({ depuisLe: '2026-07-13', points: { AML_ALERT: 10, KYC_REVIEW: 2, DOC_CLASSEMENT: 1 } });
    const pts: any = await s.points(ANNA, 'u-anna');
    // k3 (KYC, fait le 12.07) = barème v1 → 2 ; k4 (AML, fait le 14.07) = barème v2 → 10
    ok(pts.total === 12, 'chaque accomplissement garde le barème de SON jour — jamais rétroactif');
  });

  console.log(`\nCâblage Capacité d'équipe (WK-01..05, R183→R185) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
