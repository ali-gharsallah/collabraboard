/**
 * Câblage Risk cases — RK-01..RK-06 (R133→R136). Miroir strict de l'amendement.
 * RK-06 prouve la FERMETURE de la limite du bloc 22 : MrosService.decider exige un cas ESCALADÉ.
 * Faux Prisma en mémoire. Écrit AVANT l'implémentation.
 *
 * Harnais : compiler risk-case.service.ts + mros.service.ts + ce fichier ;
 *   echo "── Câblage Risk cases (RK-01..06, R133→R136) ──"; run risk-case.wiring.spec.js
 */
import { RiskCaseService } from './risk-case.service';
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
  const db = { tenants: seed.tenants ?? [], cases: [] as any[], notes: [] as any[],
    comms: [] as any[], events: [] as any[] };
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => {
    if (v === null) return row[k] == null;
    if (v && typeof v === 'object' && 'in' in v) return v.in.includes(row[k]);
    if (v && typeof v === 'object' && 'lte' in v) return row[k] != null && new Date(row[k]) <= new Date(v.lte);
    return row[k] === v;
  });
  const table = (rows: any[], prefix: string) => ({
    findMany: async ({ where }: any = {}) => rows.filter((x) => match(x, where)),
    findFirst: async ({ where }: any = {}) => rows.find((x) => match(x, where)) ?? null,
    create: async ({ data }: any) => { const r = { id: id(prefix), ...data }; rows.push(r); return r; },
    update: async ({ where, data }: any) => { const r = rows.find((x) => x.id === where.id)!; Object.assign(r, data); return r; },
  });
  const p: any = { _db: db,
    tenant: table(db.tenants, 'T'), riskCase: table(db.cases, 'RC'),
    riskCaseNote: table(db.notes, 'N'), mrosCommunication: table(db.comms, 'MC'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; },
      findMany: async ({ where }: any = {}) => db.events.filter((e) => match(e, where)) } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
const evts = (p: any, t: string) => p._db.events.filter((e: any) => e.type === t);

const AML = { tenantId: 't1', userId: 'n.frei', role: 'AML' };
const MLRO = { tenantId: 't1', userId: 'm.keller', role: 'MLRO' };
const mk = (settings: any = {}) => {
  const p = fakePrisma({ tenants: [{ id: 't1', name: 'GWB', settings }] });
  return { p, s: new RiskCaseService(p, fakeAudit()), mros: new MrosService(p, fakeAudit()) };
};

(async () => {
  // ── RK-01 (R133) — pas de cas vide ──
  await it('RK-01 sans signal → refus ; sur sig-441 → NOUVELLE tracée', async () => {
    const { p, s } = mk();
    await rejects(s.ouvrir(AML, { clientId: 'c1', signalIds: [] }), 'au moins un signal');
    const r: any = await s.ouvrir(AML, { clientId: 'c1', signalIds: ['sig-441'] });
    ok(p._db.cases[0].statut === 'NOUVELLE' && p._db.cases[0].signalIds.includes('sig-441'), 'né du signal');
    ok(evts(p, 'riskcase.ouvert').length === 1 && evts(p, 'riskcase.ouvert')[0].payload.par === 'n.frei', 'tracé, jeton');
  });

  // ── RK-02 (R133) — états fermés, terminaux motivés ──
  await it('RK-02 NOUVELLE→CLOTUREE refusée ; EN_ANALYSE→CLOTUREE sans motif → R7 ; motivée → close', async () => {
    const { p, s } = mk();
    const r: any = await s.ouvrir(AML, { clientId: 'c1', signalIds: ['sig-441'] });
    await rejects(s.transitionner(AML, r.caseId, 'CLOTUREE', 'x'), 'illégale');
    await s.transitionner(AML, r.caseId, 'EN_ANALYSE');
    await rejects(s.transitionner(AML, r.caseId, 'CLOTUREE', ''), 'R7');
    await s.transitionner(AML, r.caseId, 'CLOTUREE', 'Clarifications reçues : origine documentée');
    ok(p._db.cases[0].statut === 'CLOTUREE' && p._db.cases[0].motifTerminal.includes('documentée'), 'close motivée');
  });

  // ── RK-03 (R134) — l'instruction est append-only ──
  await it('RK-03 notes empilées, relecture chronologique auteurs/horodatages ; AUCUNE API d\'édition', async () => {
    const { s } = mk();
    const r: any = await s.ouvrir(AML, { clientId: 'c1', signalIds: ['sig-441'] });
    await s.noter(AML, r.caseId, 'Demande de clarification envoyée au RM');
    await s.noter(MLRO, r.caseId, 'Réponse RM reçue : contrat de vente joint');
    const notes: any[] = await s.notes(AML, r.caseId);
    ok(notes.length === 2 && notes[0].par === 'n.frei' && notes[1].par === 'm.keller', 'chronologie + auteurs');
    ok(notes.every((n) => !!n.at), 'horodatées');
    const svc: any = s;
    ok(svc.modifierNote === undefined && svc.supprimerNote === undefined, 'append-only STRUCTUREL : pas d\'API d\'édition');
  });

  // ── RK-04 (R135) — un signal, un cas actif ──
  await it('RK-04 rattacher OK ; second cas actif → refus ; détaché motivé → rattachable ailleurs', async () => {
    const { p, s } = mk();
    const a: any = await s.ouvrir(AML, { clientId: 'c1', signalIds: ['sig-441'] });
    await s.rattacher(AML, a.caseId, 'sig-442');
    ok(evts(p, 'riskcase.signal.rattache').length === 1, 'rattachement tracé');
    const b: any = await s.ouvrir(AML, { clientId: 'c2', signalIds: ['sig-500'] });
    await rejects(s.rattacher(AML, b.caseId, 'sig-442'), 'déjà instruit');
    await rejects(s.detacher(AML, a.caseId, 'sig-442', ''), 'R7');
    await s.detacher(AML, a.caseId, 'sig-442', 'Faux positif : homonymie levée par date de naissance');
    await s.rattacher(AML, b.caseId, 'sig-442');
    ok(p._db.cases[1].signalIds.includes('sig-442'), 'redevenu rattachable');
  });

  // ── RK-05 (R135) — le SLA alerte, n'instruit pas ──
  await it('RK-05 EN_ANALYSE 20 j (SLA 15) → alerte + tâche UNE fois, état INCHANGÉ ; SLA tenant respecté', async () => {
    const { p, s } = mk();
    const r: any = await s.ouvrir(AML, { clientId: 'c1', signalIds: ['sig-441'] });
    await s.transitionner(AML, r.caseId, 'EN_ANALYSE');
    p._db.cases[0].etatDepuis = new Date(Date.now() - 20 * 86400000).toISOString();
    await s.tickSla(AML, new Date());
    await s.tickSla(AML, new Date());
    ok(evts(p, 'riskcase.sla.alerte').length === 1 && evts(p, 'tache.riskcase.relance').length === 1, 'une fois');
    ok(p._db.cases[0].statut === 'EN_ANALYSE', 'jamais d\'auto-clôture (R39)');
    const { p: p2, s: s2 } = mk({ riskCaseSlaJours: { EN_ANALYSE: 40 } });
    const r2: any = await s2.ouvrir(AML, { clientId: 'c1', signalIds: ['sig-1'] });
    await s2.transitionner(AML, r2.caseId, 'EN_ANALYSE');
    p2._db.cases[0].etatDepuis = new Date(Date.now() - 20 * 86400000).toISOString();
    await s2.tickSla(AML, new Date());
    ok(evts(p2, 'riskcase.sla.alerte').length === 0, 'paramètre R-Q respecté');
  });

  // ── RK-06 (R136) — la chaîne se ferme : signal → cas → escalade → décision MROS ──
  await it('RK-06 décision MROS refusée sur cas non escaladé ; ESCALADEE → décision OK ; clôture refusée si communication active', async () => {
    const { p, s, mros } = mk();
    const r: any = await s.ouvrir(AML, { clientId: 'c1', signalIds: ['sig-441'] });
    await s.transitionner(AML, r.caseId, 'EN_ANALYSE');
    const dto = { riskCaseId: r.caseId, clientId: 'c1', decision: 'COMMUNIQUER' as const,
      motif: 'Soupçon fondé art. 9', pieces: [] };
    await rejects(mros.decider(MLRO, dto), 'ESCALAD');                    // limite du bloc 22 FERMÉE
    await s.transitionner(AML, r.caseId, 'ESCALADEE', 'Structuration confirmée, clarifications insuffisantes');
    await mros.decider(MLRO, dto);
    ok(p._db.comms.length === 1, 'décision passée sur cas escaladé');
    await rejects(s.transitionner(AML, r.caseId, 'CLOTUREE', 'tentative'), 'communication');
  });

  // ── garde transverse ──
  await it('R133 isolation tenant : cas d\'un autre tenant introuvable', async () => {
    const { s } = mk();
    const r: any = await s.ouvrir(AML, { clientId: 'c1', signalIds: ['sig-441'] });
    await rejects(s.noter({ ...AML, tenantId: 't2' }, r.caseId, 'x'), 'introuvable');
  });

  console.log(`\nCâblage Risk cases (RK-01..06, R133→R136) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
