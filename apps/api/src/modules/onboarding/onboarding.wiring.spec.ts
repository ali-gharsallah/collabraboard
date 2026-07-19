/**
 * Câblage Onboarding — OB-01..OB-06 (R117→R120). Miroir strict de l'amendement.
 * Faux Prisma + FAUX MOTEUR KYC INJECTÉ (le service délègue, ne réimplémente pas — R118).
 *
 * Harnais : compiler onboarding.service.ts + ce fichier ;
 *   echo "── Câblage Onboarding (OB-01..06, R117→R120) ──"; run onboarding.wiring.spec.js
 */
import { OnboardingService } from './onboarding.service';
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
  const db = { tenants: seed.tenants ?? [], onboardings: [] as any[],
    kycs: seed.kycs ?? [] as any[], events: [] as any[] };
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => {
    if (v === null) return row[k] == null;
    if (v && typeof v === 'object' && 'in' in v) return v.in.includes(row[k]);
    return row[k] === v;
  });
  const table = (rows: any[], prefix: string) => ({
    findMany: async ({ where }: any = {}) => rows.filter((x) => match(x, where)),
    findFirst: async ({ where }: any = {}) => rows.find((x) => match(x, where)) ?? null,
    create: async ({ data }: any) => { const r = { id: id(prefix), ...data }; rows.push(r); return r; },
    update: async ({ where, data }: any) => { const r = rows.find((x) => x.id === where.id)!; Object.assign(r, data); return r; },
  });
  const p: any = { _db: db,
    tenant: table(db.tenants, 'T'), onboarding: table(db.onboardings, 'OB'),
    kycFile: table(db.kycs, 'K'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; },
      findMany: async ({ where }: any = {}) => db.events.filter((e) => match(e, where)) } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
const evts = (p: any, t: string) => p._db.events.filter((e: any) => e.type === t);

const RM = { tenantId: 't1', userId: 'a.gharsallah', role: 'RM' };
/** Faux moteur KYC : enregistre l'appel, crée un KycFile status IN_PROGRESS. */
function fakeKycSvc(p: any) {
  const calls: any[] = [];
  return { _calls: calls,
    create: async (ctx: any, dto: any) => {
      calls.push({ ctx, dto });
      return p.kycFile.create({ data: { tenantId: ctx.tenantId, clientName: dto.clientName,
        status: 'IN_PROGRESS' } });
    } };
}
const F4 = { clientName: 'Dupont Holding SA', legalStructure: 'SOC_OPERATIONNELLE',
  rmId: 'a.gharsallah', accountType: 'CURRENT', countryCode: 'CH', clientId: 'c1' };
const mk = (settings: any = {}) => {
  const p = fakePrisma({ tenants: [{ id: 't1', name: 'GWB', settings }] });
  const kyc = fakeKycSvc(p);
  return { p, kyc, s: new OnboardingService(p, fakeAudit(), kyc as any) };
};

(async () => {
  // ── OB-01 (R117) — pas de saut d'étape, transitions tracées ──
  await it('OB-01 PROSPECT→DECISION refusé (illégale) ; PROSPECT→COLLECTE passe, tracé jeton', async () => {
    const { p, s } = mk();
    const ob: any = await s.creer(RM, { prospectNom: 'Dupont Holding SA' });
    ok(ob.etape === 'PROSPECT' && evts(p, 'onboarding.cree').length === 1, 'créé en PROSPECT, tracé');
    await rejects(s.transitionner(RM, ob.id, 'DECISION', {}), 'illégale');
    await s.transitionner(RM, ob.id, 'COLLECTE', { form: F4 });
    const tr = evts(p, 'onboarding.transition');
    ok(tr.length === 1 && tr[0].payload.vers === 'COLLECTE' && tr[0].payload.par === 'a.gharsallah', 'transition tracée, auteur = jeton');
  });

  // ── OB-02 (R117) — refus motivé ──
  await it('OB-02 refus sans motif → R7 ; motivé → REFUSE tracé', async () => {
    const { p, s } = mk();
    const ob: any = await s.creer(RM, { prospectNom: 'X' });
    await rejects(s.transitionner(RM, ob.id, 'REFUSE', {}), 'R7');
    await s.transitionner(RM, ob.id, 'REFUSE', { motif: 'Sanctions : hit confirmé au screening préliminaire' });
    const o = p._db.onboardings[0];
    ok(o.etape === 'REFUSE' && o.motifTerminal.includes('Sanctions') && o.terminePar === 'a.gharsallah', 'motif + auteur');
  });

  // ── OB-03 (R118) — un onboarding, un KYC, créé par LE MOTEUR ──
  await it('OB-03 COLLECTE → moteur KYC appelé avec les 4 infos, KYC lié ; 2e collecte refusée', async () => {
    const { p, kyc, s } = mk();
    const ob: any = await s.creer(RM, { prospectNom: 'Dupont Holding SA' });
    await s.transitionner(RM, ob.id, 'COLLECTE', { form: F4 });
    ok(kyc._calls.length === 1, 'délégation au moteur — jamais un KYC à la main');
    ok(kyc._calls[0].dto.legalStructure === 'SOC_OPERATIONNELLE' && kyc._calls[0].dto.accountType === 'CURRENT', 'les 4 infos transmises');
    const o = p._db.onboardings[0];
    ok(!!o.kycFileId && p._db.kycs[0].id === o.kycFileId, 'KYC lié à l\'onboarding');
    ok(evts(p, 'onboarding.kyc.cree').length === 1, 'tracé');
    await rejects(s.transitionner(RM, ob.id, 'COLLECTE', { form: F4 }), 'illégale');
    ok(kyc._calls.length === 1 && p._db.kycs.length === 1, 'un seul KYC actif par onboarding');
  });
  await it('OB-03 COLLECTE sans les 4 infos → refus', async () => {
    const { s } = mk();
    const ob: any = await s.creer(RM, { prospectNom: 'X' });
    await rejects(s.transitionner(RM, ob.id, 'COLLECTE', { form: { clientName: 'X' } }), '4 infos');
  });

  // ── OB-04 (R119) — pas d'ouverture sans KYC APPROVED ──
  await it('OB-04 OUVERT refusé tant que KYC ≠ APPROVED ; APPROVED → OUVERT + événement', async () => {
    const { p, s } = mk();
    const ob: any = await s.creer(RM, { prospectNom: 'X' });
    await s.transitionner(RM, ob.id, 'COLLECTE', { form: F4 });
    await s.transitionner(RM, ob.id, 'KYC_EN_COURS', {});
    await s.transitionner(RM, ob.id, 'DECISION', {});
    await rejects(s.transitionner(RM, ob.id, 'OUVERT', {}), 'IN_PROGRESS');
    p._db.kycs[0].status = 'APPROVED';                       // le cycle KYC a fait son œuvre
    await s.transitionner(RM, ob.id, 'OUVERT', {});
    ok(p._db.onboardings[0].etape === 'OUVERT' && evts(p, 'onboarding.ouvert').length === 1, 'ouvert, tracé');
  });

  // ── OB-05 (R120) — le SLA alerte une fois, n'abandonne jamais ──
  await it('OB-05 COLLECTE 35 j (SLA 30) → alerte + relance UNE fois, état INCHANGÉ', async () => {
    const { p, s } = mk();
    const ob: any = await s.creer(RM, { prospectNom: 'X' });
    await s.transitionner(RM, ob.id, 'COLLECTE', { form: F4 });
    p._db.onboardings[0].etapeDepuis = new Date(Date.now() - 35 * 86400000).toISOString();
    await s.tickSla(RM, new Date());
    ok(evts(p, 'onboarding.sla.alerte').length === 1 && evts(p, 'tache.onboarding.relance').length === 1, 'alerte + relance');
    ok(p._db.onboardings[0].etape === 'COLLECTE', 'jamais d\'auto-abandon (R39)');
    await s.tickSla(RM, new Date());
    ok(evts(p, 'onboarding.sla.alerte').length === 1, 'une fois');
  });
  await it('OB-05 SLA paramétrable tenant : 40 j sous SLA 60 → silence', async () => {
    const { p, s } = mk({ onboardingSlaJours: { COLLECTE: 60 } });
    const ob: any = await s.creer(RM, { prospectNom: 'X' });
    await s.transitionner(RM, ob.id, 'COLLECTE', { form: F4 });
    p._db.onboardings[0].etapeDepuis = new Date(Date.now() - 40 * 86400000).toISOString();
    await s.tickSla(RM, new Date());
    ok(evts(p, 'onboarding.sla.alerte').length === 0, 'R-Q respecté');
  });

  // ── OB-06 (R120) — le funnel se restitue depuis les événements ──
  await it('OB-06 funnel : chaque étape avec entrée/sortie/durée, reconstruit des événements (R48)', async () => {
    const { p, s } = mk();
    const ob: any = await s.creer(RM, { prospectNom: 'X' });
    await s.transitionner(RM, ob.id, 'COLLECTE', { form: F4 });
    await s.transitionner(RM, ob.id, 'KYC_EN_COURS', {});
    const f: any = await s.funnel(RM, ob.id);
    ok(f.etapes.length === 3, 'PROSPECT + COLLECTE + KYC_EN_COURS');
    ok(f.etapes[0].etape === 'PROSPECT' && !!f.etapes[0].entree && !!f.etapes[0].sortie, 'étape close : entrée + sortie');
    ok(f.etapes[2].etape === 'KYC_EN_COURS' && f.etapes[2].sortie === null, 'étape courante ouverte');
  });

  // ── garde transverse ──
  await it('R117 isolation tenant : onboarding d\'un autre tenant introuvable', async () => {
    const { s } = mk();
    const ob: any = await s.creer(RM, { prospectNom: 'X' });
    await rejects(s.transitionner({ ...RM, tenantId: 't2' }, ob.id, 'COLLECTE', { form: F4 }), 'introuvable');
  });

  console.log(`\nCâblage Onboarding (OB-01..06, R117→R120) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
