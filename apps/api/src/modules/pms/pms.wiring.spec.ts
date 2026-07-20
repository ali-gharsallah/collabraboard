/**
 * Câblage PMS — PF-01..PF-06 (R105→R108) à travers le SERVICE PERSISTANT.
 * Miroir strict des Gherkin de l'amendement R105-R108. Faux Prisma en mémoire,
 * même harnais que personnes.wiring.spec.ts. Écrit AVANT l'implémentation.
 * Lien R104 : l'adéquation (R107) se réévalue sur le riskLevel CLIENT (golden record).
 *
 * Harnais : compiler pms.service.ts + ce fichier ;
 *   echo "── Câblage PMS (PF-01..06, R105→R108) ──"; run pms.wiring.spec.js
 */
import { PmsService } from './pms.service';
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
  const db = { tenants: seed.tenants ?? [], clients: seed.clients ?? [], mandates: seed.mandates ?? [],
    positions: seed.positions ?? [], breaches: [] as any[], events: [] as any[] };
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => {
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
    tenant: table(db.tenants, 'T'), client: table(db.clients, 'CLI'), mandate: table(db.mandates, 'M'),
    position: table(db.positions, 'POS'), pmsBreach: table(db.breaches, 'B'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; } } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
const evts = (p: any, t: string) => p._db.events.filter((e: any) => e.type === t);

const CTX = { tenantId: 't1', userId: 'g.mandats', role: 'RM' };
// Mandat Équilibré : actions 40-60 %, oblig 30-50 %, cash 0-20 % · exclusions armement · max 10 %/position · profil >= MEDIUM
const MANDAT = () => ({ id: 'm1', tenantId: 't1', clientId: 'c1', nom: 'Équilibré', profilRequis: 'MEDIUM', statut: 'ACTIF',
  strategie: { bornes: { ACTIONS: [40, 60], OBLIGATIONS: [30, 50], CASH: [0, 20] },
    exclusions: ['armement'], maxPositionPct: 10 } });
const CLIENT = (rl = 'MEDIUM') => ({ id: 'c1', tenantId: 't1', name: 'Dupont Holding SA', riskLevel: rl });
// Portefeuille dévié SUR UNE SEULE classe : ACTIONS 68 % (>60) · OBLIG 30 % (dans [30,50]) · CASH 2 %
const POS_DERIVE = [
  { id: 'p1', tenantId: 't1', mandateId: 'm1', instrument: 'ACWI ETF', secteur: 'diversifie', classe: 'ACTIONS', valeurChf: 680000 },
  { id: 'p2', tenantId: 't1', mandateId: 'm1', instrument: 'Oblig CH 2031', secteur: 'souverain', classe: 'OBLIGATIONS', valeurChf: 300000 },
  { id: 'p3', tenantId: 't1', mandateId: 'm1', instrument: 'Cash CHF', secteur: 'cash', classe: 'CASH', valeurChf: 20000 },
];
const mk = (over: any = {}) => {
  const p = fakePrisma({ tenants: [{ id: 't1', name: 'GWB', settings: over.settings ?? {} }],
    clients: [CLIENT(over.riskLevel)], mandates: [MANDAT()],
    positions: (over.positions ?? POS_DERIVE).map((x: any) => ({ ...x })) });
  return { p, s: new PmsService(p, fakeAudit()) };
};

(async () => {
  // ── PF-01 (R105) — l'écart se constate, il ne se corrige pas tout seul ──
  await it('PF-01 valorisation → drift détecté (ACTIONS 68 % > 60), tâche, positions INTACTES', async () => {
    const { p, s } = mk();
    const avant = JSON.stringify(p._db.positions);
    const r: any = await s.valoriser(CTX, 'm1');
    const d = evts(p, 'pms.drift.detecte');
    ok(d.length === 1, 'un drift');
    ok(d[0].payload.classe === 'ACTIONS' && d[0].payload.reelPct === 68 && d[0].payload.borne[1] === 60, 'classe, réel, borne portés');
    ok(evts(p, 'tache.pms.regularisation').length === 1, 'tâche de régularisation créée');
    ok(JSON.stringify(p._db.positions) === avant, 'AUCUNE position modifiée par le système');
    ok(p._db.breaches.length === 1 && p._db.breaches[0].statut === 'OUVERT', 'breach ouvert au registre (R108)');
  });
  await it('PF-01 tolérance paramétrable : 60→68 sous tolérance 900 bp → pas de drift', async () => {
    const { p, s } = mk({ settings: { pmsDriftToleranceBp: 900 } });
    await s.valoriser(CTX, 'm1');
    ok(evts(p, 'pms.drift.detecte').length === 0, 'sous tolérance tenant (R-Q)');
  });

  // ── PF-02 (R106) — l'instrument exclu ne passe pas ──
  await it('PF-02 ordre sur secteur exclu → BLOQUÉ, motif exclusion, événement tracé', async () => {
    const { p, s } = mk();
    const r: any = await s.preTrade(CTX, 'm1', { instrument: 'DefenseCorp', secteur: 'armement', classe: 'ACTIONS', montantChf: 10000 });
    ok(r.verdict === 'BLOQUE' && r.motif.includes('exclusion mandat : armement'), 'motif explicite');
    const e = evts(p, 'pms.pretrade.bloque');
    ok(e.length === 1 && e[0].payload.instrument === 'DefenseCorp', 'événement porte l\'instrument');
  });

  // ── PF-03 (R106) — concentration contrôlée avant ──
  await it('PF-03 position résultante 14 % > plafond 10 % → BLOQUÉ avec le calcul ; sous plafond → OK tracé', async () => {
    const { p, s } = mk();
    // total 1 000 000 ; ACWI 680 000 → +? Non : nouvelle ligne pour rester lisible : achat 140 000 d'un titre neuf → 14 % du total résultant? Simplifions : le service calcule (existant+montant)/(total+montant).
    const r1: any = await s.preTrade(CTX, 'm1', { instrument: 'TechCo', secteur: 'tech', classe: 'ACTIONS', montantChf: 163000 }); // 163k/1163k ≈ 14 %
    ok(r1.verdict === 'BLOQUE' && /14(\.|,|\s|%)/.test(r1.motif) && r1.motif.includes('10'), 'calcul position vs plafond dans le motif');
    const r2: any = await s.preTrade(CTX, 'm1', { instrument: 'TechCo', secteur: 'tech', classe: 'ACTIONS', montantChf: 50000 }); // ≈ 4.8 %
    ok(r2.verdict === 'OK', 'sous plafond → passe');
    ok(evts(p, 'pms.pretrade.ok').length === 1, 'le passage aussi se prouve (esprit R103)');
  });

  // ── PF-04 (R107) — le KYC validé resserre, l'humain décide ──
  await it('PF-04 client repasse LOW (propagation R104) → alerte + tâche, mandat INCHANGÉ', async () => {
    const { p, s } = mk();
    p._db.clients[0].riskLevel = 'LOW';                       // effet golden record (R104)
    await s.verifierAdequation(CTX, 'c1');
    ok(evts(p, 'pms.suitability.alerte').length === 1, 'alerte LSFin');
    ok(evts(p, 'tache.pms.revue_mandat').length === 1, 'tâche de revue');
    ok(p._db.mandates[0].profilRequis === 'MEDIUM' && p._db.mandates[0].statut === 'ACTIF', 'mandat jamais rétrogradé automatiquement');
  });
  await it('PF-04 client conforme → aucune alerte', async () => {
    const { p, s } = mk();
    await s.verifierAdequation(CTX, 'c1');
    ok(evts(p, 'pms.suitability.alerte').length === 0, 'MEDIUM porte MEDIUM');
  });

  // ── PF-05 (R107) — adéquation à la souscription ──
  await it('PF-05 client LOW + mandat exigeant HIGH → attachement refusé (LSFin)', async () => {
    const { p, s } = mk({ riskLevel: 'LOW' });
    await rejects(s.attacherMandat(CTX, 'c1', { nom: 'Agressif', profilRequis: 'HIGH',
      strategie: { bornes: { ACTIONS: [70, 100] }, exclusions: [], maxPositionPct: 15 } }), 'inadéquation LSFin');
    ok(p._db.mandates.length === 1, 'aucun mandat créé');
  });

  // ── PF-06 (R108) — registre de breaches, escalade au délai, clôture motivée ──
  await it('PF-06 délai écoulé → escalade UNE fois, breach reste OUVERT ; clôture exige motif + auteur', async () => {
    const { p, s } = mk();
    await s.valoriser(CTX, 'm1');                              // ouvre le breach (PF-01)
    const b = p._db.breaches[0];
    await s.tickBreaches(CTX, new Date(Date.now() + 10 * 86400000));    // 10 j < 30
    ok(evts(p, 'pms.breach.escalade').length === 0, 'pas d\'escalade avant délai');
    await s.tickBreaches(CTX, new Date(Date.now() + 35 * 86400000));    // 35 j
    ok(evts(p, 'pms.breach.escalade').length === 1 && b.statut === 'OUVERT', 'escalade émise, breach toujours ouvert (R39)');
    await s.tickBreaches(CTX, new Date(Date.now() + 40 * 86400000));
    ok(evts(p, 'pms.breach.escalade').length === 1, 'une seule escalade');
    await rejects(s.cloreBreach(CTX, b.id, ''), 'R7');
    const r: any = await s.cloreBreach(CTX, b.id, 'Rééquilibré le 21.07 — ordre O-4411');
    ok(b.statut === 'CLOS' && b.cloturePar === 'g.mandats', 'clôture motivée, auteur = jeton');
    ok(evts(p, 'pms.breach.clos').length === 1, 'clôture tracée');
  });

  // ── garde transverse ──
  await it('R105 isolation tenant : mandat d\'un autre tenant introuvable', async () => {
    const { s } = mk();
    await rejects(s.valoriser({ ...CTX, tenantId: 't2' }, 'm1'), 'introuvable');
  });

  console.log(`\nCâblage PMS (PF-01..06, R105→R108) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
