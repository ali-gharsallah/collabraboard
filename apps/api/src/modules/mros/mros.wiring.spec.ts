/**
 * Câblage Communication MROS — MR-01..MR-06 (R129→R132). Miroir strict de l'amendement.
 * Art. 9 LBA (décision humaine motivée), art. 10 (gel appliqué par le moteur), art. 10a
 * (default-deny + accès tracés). Faux Prisma en mémoire. Écrit AVANT l'implémentation.
 *
 * Harnais : compiler mros.service.ts + ce fichier ;
 *   echo "── Câblage MROS (MR-01..08, R129→R132) ──"; run mros.wiring.spec.js
 */
import { MrosService } from './mros.service';
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
  const db = { tenants: seed.tenants ?? [], comms: [] as any[], cases: seed.cases ?? [] as any[], events: [] as any[] };
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
    tenant: table(db.tenants, 'T'), mrosCommunication: table(db.comms, 'MC'),
    riskCase: table(db.cases, 'RC'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; },
      findMany: async ({ where }: any = {}) => db.events.filter((e) => match(e, where)) } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
const evts = (p: any, t: string) => p._db.events.filter((e: any) => e.type === t);

const MLRO = { tenantId: 't1', userId: 'm.keller', role: 'MLRO' };
const RM = { tenantId: 't1', userId: 'a.gharsallah', role: 'RM' };
const PIECES = [
  { type: 'SIGNAL', id: 'sig-441', sha256: sha('signal-441') },
  { type: 'TRANSACTION', id: 'tx-9001', sha256: sha('tx-9001') },
  { type: 'KYC_EXTRAIT', id: 'k1', sha256: sha('kyc-extrait-k1') },
];
const mk = (settings: any = {}) => {
  const p = fakePrisma({ tenants: [{ id: 't1', name: 'GWB', settings }],
    cases: [{ id: 'rc-77', tenantId: 't1', statut: 'ESCALADEE' },      // R136 : précondition SEMÉE (renforcé, jamais affaibli)
            { id: 'rc-1', tenantId: 't1', statut: 'ESCALADEE' }] });
  return { p, s: new MrosService(p, fakeAudit()) };
};
const decide = (s: MrosService, decision: "COMMUNIQUER" | "NE_PAS_COMMUNIQUER" = 'COMMUNIQUER', motif = 'Soupçon fondé art. 9 : structuration de versements sous seuil, incohérence SOF') =>
  s.decider(MLRO, { riskCaseId: 'rc-77', clientId: 'c1', decision, motif, pieces: PIECES });

(async () => {
  // ── MR-01 (R129) — le rôle habilité décide, motivé ──
  await it('MR-01 RM → refus (rôle) ; MLRO sans motif → R7 ; motivé → décision tracée + dossier né', async () => {
    const { p, s } = mk();
    await rejects(s.decider(RM, { riskCaseId: 'rc-77', clientId: 'c1', decision: 'COMMUNIQUER', motif: 'x', pieces: PIECES }), 'habilité');
    await rejects(decide(s, 'COMMUNIQUER', ''), 'R7');
    const r: any = await decide(s);
    ok(!!r.communicationId && p._db.comms.length === 1, 'dossier créé');
    const e = evts(p, 'mros.decision');
    ok(e.length === 1 && e[0].payload.decision === 'COMMUNIQUER' && e[0].payload.par === 'm.keller', 'décision tracée, jeton');
  });
  await it('MR-01 rôles habilités = paramètre R-Q : tenant avec ["MLRO","CO_SENIOR"] → CO_SENIOR décide', async () => {
    const { s } = mk({ mrosRolesHabilites: ['MLRO', 'CO_SENIOR'] });
    const r: any = await s.decider({ tenantId: 't1', userId: 'c.senior', role: 'CO_SENIOR' },
      { riskCaseId: 'rc-1', clientId: 'c1', decision: 'COMMUNIQUER', motif: 'Soupçon fondé', pieces: PIECES });
    ok(!!r.communicationId, 'paramètre tenant respecté');
  });

  // ── MR-02 (R129) — l'abstention se motive et se trace ──
  await it('MR-02 NE_PAS_COMMUNIQUER motivé → tracé à l\'identique (l\'audit de l\'abstention)', async () => {
    const { p, s } = mk();
    await decide(s, 'NE_PAS_COMMUNIQUER', 'Clarifications reçues : origine documentée (vente immobilière notariée)');
    ok(p._db.comms[0].decision === 'NE_PAS_COMMUNIQUER', 'décision conservée');
    ok(evts(p, 'mros.decision')[0].payload.motif.includes('notariée'), 'motif dans la trace');
  });

  // ── MR-03 (R130) — le dossier se fige : références + empreintes, opposable ──
  await it('MR-03 pièces typées + empreintes + empreinte d\'ensemble ; relecture identique ; modification refusée', async () => {
    const { p, s } = mk();
    const r: any = await decide(s);
    const c = p._db.comms[0];
    ok(c.pieces.length === 3 && c.pieces.every((x: any) => x.type && x.id && /^[0-9a-f]{64}$/.test(x.sha256)), 'références figées');
    ok(/^[0-9a-f]{64}$/.test(c.dossierSha256), 'empreinte d\'ensemble');
    const lu: any = await s.relire(MLRO, r.communicationId);
    ok(JSON.stringify(lu.pieces) === JSON.stringify(PIECES) && lu.dossierSha256 === c.dossierSha256, 'relecture à l\'identique');
    await rejects(s.decider(MLRO, { riskCaseId: 'rc-77', clientId: 'c1', decision: 'COMMUNIQUER',
      motif: 'tentative de re-décision', pieces: PIECES }), 'existe');
  });

  // ── MR-04 (R131) — le gel bloque, la levée est un acte ──
  await it('MR-04 notification transmission → gel posé (échéance 5 j ouvrables) ; transaction BLOQUÉE ; levée motivée → repasse', async () => {
    const { p, s } = mk();
    const r: any = await decide(s);
    await s.saisirNotification(MLRO, r.communicationId, 'TRANSMISSION_AUTORITE');
    await s.poserGel(MLRO, r.communicationId, 'Notification MROS du 19.07 — transmission MP Genève');
    const c = p._db.comms[0];
    ok(c.gelActif === true && !!c.gelEcheance, 'gel actif, échéance posée');
    const v1: any = await s.verifierTransaction(MLRO, 'c1');
    ok(v1.bloquant === true && v1.motif.includes('art. 10'), 'transaction BLOQUÉE avec le motif légal');
    await rejects(s.leverGel(MLRO, r.communicationId, ''), 'R7');
    await s.leverGel(MLRO, r.communicationId, 'Décision autorité : levée ordonnée le 24.07');
    const v2: any = await s.verifierTransaction(MLRO, 'c1');
    ok(v2.bloquant === false, 'levée → transactions repassent');
    ok(evts(p, 'mros.gel.leve').length === 1, 'levée tracée');
  });

  // ── MR-05 (R131) — l'échéance alerte une fois, ne lève jamais ──
  await it('MR-05 échéance dépassée → alerte UNE fois, gel TOUJOURS actif', async () => {
    const { p, s } = mk();
    const r: any = await decide(s);
    await s.saisirNotification(MLRO, r.communicationId, 'TRANSMISSION_AUTORITE');
    await s.poserGel(MLRO, r.communicationId, 'Notification MROS');
    p._db.comms[0].gelEcheance = new Date(Date.now() - 86400000).toISOString();
    await s.tickGel(MLRO, new Date());
    await s.tickGel(MLRO, new Date());
    ok(evts(p, 'mros.gel.echeance').length === 1, 'alerte une fois (R39)');
    ok(p._db.comms[0].gelActif === true, 'JAMAIS de levée automatique');
  });

  // ── MR-06 (R132) — default-deny : le RM ne voit rien, sa tentative se voit ──
  await it('MR-06 RM → refus + mros.acces.refuse tracé ; MLRO → servi + accès tracé', async () => {
    const { p, s } = mk();
    const r: any = await decide(s);
    await rejects(s.lire(RM, r.communicationId), 'habilité');
    ok(evts(p, 'mros.acces.refuse').length === 1 && evts(p, 'mros.acces.refuse')[0].payload.par === 'a.gharsallah', 'tentative tracée');
    const lu: any = await s.lire(MLRO, r.communicationId);
    ok(lu.decision === 'COMMUNIQUER' && evts(p, 'mros.acces').length === 1, 'lecture servie et tracée');
  });

  // ── garde transverse ──
  await it('R129 isolation tenant : communication d\'un autre tenant introuvable', async () => {
    const { s } = mk();
    const r: any = await decide(s);
    await rejects(s.lire({ ...MLRO, tenantId: 't2' }, r.communicationId), 'introuvable');
  });

  // ── MR-07 (R131, V2-M38) — la notification est VALIDÉE, et ne peut pas contredire un gel ──
  await it('MR-07 notification : valeur hors énumération REFUSÉE ; NON_TRANSMISSION sous gel actif REFUSÉE', async () => {
    const { s } = mk();
    const r: any = await decide(s);
    await rejects(s.saisirNotification(MLRO, r.communicationId, 'PEUT-ETRE' as any), 'R131');
    await rejects(s.saisirNotification(MLRO, r.communicationId, undefined as any), 'R131');
    await s.saisirNotification(MLRO, r.communicationId, 'TRANSMISSION_AUTORITE');
    await s.poserGel(MLRO, r.communicationId, 'Notification MROS — transmission');
    // contredire la transmission pendant un gel art. 10 : refusé, la levée est un acte à part
    await rejects(s.saisirNotification(MLRO, r.communicationId, 'NON_TRANSMISSION'), 'lever le gel');
  });

  // ── MR-08 (R131, V2-M38) — on ne lève pas un gel qui n'existe pas ──
  await it('MR-08 levée sans gel actif REFUSÉE — le journal ne porte pas la levée d\'un gel inexistant', async () => {
    const { p, s } = mk();
    const r: any = await decide(s);
    await rejects(s.leverGel(MLRO, r.communicationId, 'levée sans gel'), 'aucun gel actif');
    ok(evts(p, 'mros.gel.leve').length === 0, 'aucun événement de levée émis');
    await s.saisirNotification(MLRO, r.communicationId, 'TRANSMISSION_AUTORITE');
    await s.poserGel(MLRO, r.communicationId, 'motif de pose');
    await s.leverGel(MLRO, r.communicationId, 'motif de levée');
    ok(evts(p, 'mros.gel.leve').length === 1, 'une levée, une seule');
    await rejects(s.leverGel(MLRO, r.communicationId, 'seconde levée'), 'aucun gel actif');
  });

  console.log(`\nCâblage MROS (MR-01..08, R129→R132) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
