/**
 * Câblage Portail transactionnel — TX-01..TX-06 (R140→R143). Miroir strict de l'amendement.
 * Origine réglementaire : FATF 7e Targeted Update (prévention, pas constat) + FINMA 02/2026
 * (le KYC doit nourrir la transaction ; seuils par profil, pas fixes). Le VRAI MrosService est
 * branché comme garde gel-mros : la chaîne R131 → portail se ferme ici.
 * Faux Prisma en mémoire. Écrit AVANT l'implémentation.
 *
 * Harnais : compiler transaction-gate.service.ts (+ mros.service.ts) + ce fichier ;
 *   echo "── Câblage Portail TX (TX-01..06, R140→R143) ──"; run transaction-gate.wiring.spec.js
 */
import { TransactionGateService, gardeGelMros, gardeComportement } from './transaction-gate.service';
import { MrosService } from '../mros/mros.service';
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
  const db = { tenants: seed.tenants ?? [], clients: seed.clients ?? [], comms: seed.comms ?? [],
    cases: seed.cases ?? [], verdicts: [] as any[], events: [] as any[] };
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => {
    if (v === null) return row[k] == null;
    if (v && typeof v === 'object' && 'in' in v) return v.in.includes(row[k]);
    if (v && typeof v === 'object' && 'lte' in v) return row[k] != null && new Date(row[k]) <= new Date(v.lte);
    if (v && typeof v === 'object' && 'gte' in v) return row[k] != null && new Date(row[k]) >= new Date(v.gte);
    return row[k] === v;
  });
  const table = (rows: any[], prefix: string) => ({
    findMany: async ({ where }: any = {}) => rows.filter((x) => match(x, where)),
    findFirst: async ({ where }: any = {}) => rows.find((x) => match(x, where)) ?? null,
    create: async ({ data }: any) => { const r = { id: id(prefix), ...data }; rows.push(r); return r; },
    update: async ({ where, data }: any) => { const r = rows.find((x) => x.id === where.id)!; Object.assign(r, data); return r; },
  });
  const p: any = { _db: db,
    tenant: table(db.tenants, 'T'), client: table(db.clients, 'CLI'),
    mrosCommunication: table(db.comms, 'MC'), riskCase: table(db.cases, 'RC'),
    txVerdict: table(db.verdicts, 'TX'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; },
      findMany: async ({ where }: any = {}) => db.events.filter((e) => match(e, where)) } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
const evts = (p: any, t: string) => p._db.events.filter((e: any) => e.type === t);

const CO = { tenantId: 't1', userId: 'i.vernet', role: 'CO' };
const RM = { tenantId: 't1', userId: 'a.gharsallah', role: 'RM' };
const TX = (over: any = {}) => ({ clientId: 'c1', txRef: 'VIR-' + Math.random().toString(36).slice(2, 8),
  type: 'VIREMENT', montantChf: 12000, devise: 'CHF', ...over });
const mk = (settings: any = {}, seed: any = {}) => {
  const p = fakePrisma({ tenants: [{ id: 't1', name: 'GWB', settings }],
    clients: seed.clients ?? [{ id: 'c1', tenantId: 't1', name: 'Dupont Holding SA',
      riskLevel: 'LOW', volumetrieMensuelleChf: 20000 }],
    comms: seed.comms ?? [], cases: seed.cases ?? [] });
  const mros = new MrosService(p, fakeAudit());
  const s = new TransactionGateService(p, fakeAudit(),
    [gardeGelMros(mros), gardeComportement()]);
  return { p, s, mros };
};

(async () => {
  // ── TX-01 (R140) — le portail décide AVANT, et le gel a enfin son appelant ──
  await it('TX-01 transaction ordinaire → PASSE tracé avec gardes ; gel art. 10 actif → BLOQUE, garde gel-mros identifiée', async () => {
    const { p, s } = mk();
    const r1: any = await s.evaluer(CO, TX());
    ok(r1.verdict === 'PASSE', 'passe');
    ok(p._db.verdicts.length === 1 && p._db.verdicts[0].gardes.some((g: any) => g.code === 'gel-mros'), 'gardes consultées TRACÉES');
    const { p: p2, s: s2 } = mk({}, { comms: [{ id: 'mc1', tenantId: 't1', clientId: 'c1',
      riskCaseId: 'rc-1', decision: 'COMMUNIQUER', gelActif: true }] });
    const r2: any = await s2.evaluer(CO, TX());
    ok(r2.verdict === 'BLOQUE' && /art\. 10/.test(r2.motif), 'BLOQUE avec le motif légal');
    ok(p2._db.verdicts[0].gardes.find((g: any) => g.code === 'gel-mros').resultat === 'BLOQUANT', 'R131 → portail : la boucle est fermée');
  });

  // ── TX-02 (R141) — le pire l'emporte, l'erreur suspend (fail-secure) ──
  await it('TX-02 INFORMATIF + SUSPENSIF → SUSPEND ; garde qui LÈVE → SUSPEND tracé, jamais PASSE', async () => {
    const p = fakePrisma({ tenants: [{ id: 't1', name: 'GWB', settings: {} }],
      clients: [{ id: 'c1', tenantId: 't1', riskLevel: 'LOW', volumetrieMensuelleChf: 20000 }] });
    const info = { code: 'g-info', regle: 'Rx', run: async () => ({ resultat: 'INFORMATIF' as const, detail: 'note' }) };
    const susp = { code: 'g-susp', regle: 'Ry', run: async () => ({ resultat: 'SUSPENSIF' as const, detail: 'doute' }) };
    const boom = { code: 'g-boom', regle: 'Rz', run: async () => { throw new Error('panne interne'); } };
    const s1 = new TransactionGateService(p, fakeAudit(), [info, susp]);
    const r1: any = await s1.evaluer(CO, TX());
    ok(r1.verdict === 'SUSPEND', 'le pire l\'emporte');
    const s2 = new TransactionGateService(p, fakeAudit(), [info, boom]);
    const r2: any = await s2.evaluer(CO, TX());
    ok(r2.verdict === 'SUSPEND', 'erreur → SUSPEND, jamais PASSE (fail-secure)');
    ok(p._db.verdicts[1].gardes.find((g: any) => g.code === 'g-boom').resultat === 'ERREUR', 'l\'erreur elle-même tracée');
  });

  // ── TX-03 (R141) — la sévérité est un paramètre tenant ──
  await it('TX-03 tenant déclasse comportement en INFORMATIF → PASSE + trace informative (R-Q fait foi)', async () => {
    const { p, s } = mk({ txGardes: { comportement: 'INFORMATIF' } });
    const r: any = await s.evaluer(CO, TX({ montantChf: 95000 }));   // écart de profil manifeste
    ok(r.verdict === 'PASSE', 'déclassée → passe');
    ok(p._db.verdicts[0].gardes.find((g: any) => g.code === 'comportement').resultat === 'INFORMATIF', 'trace conservée');
  });

  // ── TX-04 (R142) — le retail « low risk » qui bouge comme un VASP ──
  await it('TX-04 4 conversions crypto 9500 CHF / 48 h sur profil LOW → SUSPEND + signal AML + tâche requalification', async () => {
    const { p, s } = mk();
    for (let i = 0; i < 3; i++)
      await s.evaluer(CO, TX({ type: 'CONVERSION_CRYPTO', montantChf: 9500, txRef: 'CV-' + i }));
    const r: any = await s.evaluer(CO, TX({ type: 'CONVERSION_CRYPTO', montantChf: 9500, txRef: 'CV-3' }));
    ok(r.verdict === 'SUSPEND', 'vélocité + écart de profil → SUSPEND');
    ok(/profil|vélocité/.test(r.motif), 'le motif porte le CALCUL par profil, pas un seuil fixe');
    ok(evts(p, 'signal.aml.comportement').length >= 1, 'signal AML émis (chaîne R80-82)');
    ok(evts(p, 'tache.kyc.requalification').length === 1, 'requalification = tâche HUMAINE (R44)');
  });

  // ── TX-05 (R143) — la file se décide, motivée, sans fuite ──
  await it('TX-05 RM → file refusée tracée ; CO LIBÈRE motivé → tracé ; vue client SANS motif AML', async () => {
    const { p, s } = mk({}, { comms: [] });
    const r: any = await s.evaluer(CO, TX({ type: 'CONVERSION_CRYPTO', montantChf: 90000 }));
    ok(r.verdict === 'SUSPEND', 'suspendue');
    await rejects(s.listerRevue(RM), 'habilité');
    ok(evts(p, 'tx.revue.acces.refuse').length === 1, 'tentative tracée (R112)');
    const file: any[] = await s.listerRevue(CO);
    ok(file.length === 1, 'CO voit la file');
    await rejects(s.decider(CO, r.verdictId, 'LIBERER', ''), 'R7');
    await s.decider(CO, r.verdictId, 'LIBERER', 'Justificatif reçu : achat immobilier documenté, origine vérifiée');
    ok(evts(p, 'tx.revue.decision').length === 1 && evts(p, 'tx.revue.decision')[0].payload.par === 'i.vernet', 'décision tracée, jeton');
    const vueClient: any = await s.vueClient(CO, r.verdictId);
    ok(vueClient.statut && !JSON.stringify(vueClient).match(/AML|soupçon|signal|profil/i), 'AUCUN motif AML côté client (art. 10a)');
  });

  // ── TX-06 (R143) — le SLA de revue alerte, ne libère pas ──
  await it('TX-06 suspension 30 h (SLA 24) → alerte UNE fois, transaction TOUJOURS suspendue', async () => {
    const { p, s } = mk();
    const r: any = await s.evaluer(CO, TX({ type: 'CONVERSION_CRYPTO', montantChf: 90000 }));
    p._db.verdicts[0].at = new Date(Date.now() - 30 * 3600000).toISOString();
    await s.tickRevue(CO, new Date());
    await s.tickRevue(CO, new Date());
    ok(evts(p, 'tx.revue.sla').length === 1, 'une fois (R39)');
    ok(p._db.verdicts[0].verdict === 'SUSPEND', 'JAMAIS de libération automatique');
  });

  // ── garde transverse ──
  await it('R140 isolation tenant : verdict d\'un autre tenant introuvable', async () => {
    const { s } = mk();
    const r: any = await s.evaluer(CO, TX({ type: 'CONVERSION_CRYPTO', montantChf: 90000 }));
    await rejects(s.decider({ ...CO, tenantId: 't2' }, r.verdictId, 'LIBERER', 'x'), 'introuvable');
  });

  console.log(`\nCâblage Portail TX (TX-01..06, R140→R143) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
