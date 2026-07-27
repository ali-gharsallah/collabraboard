/**
 * Test de service — vérifie le CÂBLAGE réel de R13/R2/R52 dans KycService.signVisa
 * et KycService.validate, avec un faux Prisma en mémoire (aucune base requise).
 * Complète les tests de domaine : ici on prouve que requête → règle → exception
 * fonctionne de bout en bout dans le vrai service.
 */
import { KycService } from '../kyc.service';
declare const process: { exit(n: number): void };

let passed = 0, failed = 0; const fails: string[] = [];
function it(name: string, fn: () => Promise<void>): Promise<void> {
  return fn().then(() => { passed++; }, (e: Error) => { failed++; fails.push(`✗ ${name} — ${e.message}`); });
}
function ok(c: boolean, m = 'assertion'): void { if (!c) throw new Error(m); }
async function rejects(p: Promise<unknown>, rulePart: string): Promise<void> {
  try { await p; } catch (e) { if ((e as Error).message.includes(rulePart)) return; throw new Error(`attendu «${rulePart}», obtenu «${(e as Error).message}»`); }
  throw new Error(`exception «${rulePart}» attendue`);
}

// ── Faux Prisma paramétrable ──
type Scenario = {
  kyc: any;                          // { id, code, tenantId, status, createdBy, visas: [...] }
  contributors?: Record<string, string[]>; // sectionCode -> [changedBy...] ; "*" = tout le dossier
  lock?: { holder: string | null };
};
function fakePrisma(sc: Scenario) {
  const all = () => Object.values(sc.contributors ?? {}).flat();
  const st: any = { lock: sc.lock ? { id: 'L1', kycFileId: sc.kyc.id, ...sc.lock } : null, requests: [] };
  const kycLock = {
    findUnique: async () => st.lock,
    upsert: async ({ create, update }: any) => { st.lock = st.lock ? { ...st.lock, ...update } : { id: 'L1', ...create }; return st.lock; },
    update: async ({ data }: any) => { st.lock = { ...st.lock, ...data }; return st.lock; },
  };
  const kycLockRequest = {
    upsert: async ({ create }: any) => { st.requests.push(create.requester); return {}; },
    deleteMany: async () => ({ count: 0 }),
  };
  const base: any = {
    _state: st,
    kycFile: { findFirst: async () => sc.kyc, update: async ({ data }: any) => ({ ...sc.kyc, ...data }) },
    kycVisa: { update: async ({ data }: any) => ({ ...data }) },
    kycLock, kycLockRequest,
    kycQuestionHistory: { findMany: async ({ where }: any) => {
      const code = where?.question?.section?.code;
      const list = code ? (sc.contributors?.[code] ?? []) : all();
      return [...new Set(list)].map((changedBy) => ({ changedBy }));
    } },
    domainEvent: { create: async () => ({}) },
    // R267/OF-10 : le garde « client clôturé » interroge offboarding_files — aucun scénario
    // du corpus n'est clôturé (le bloc offboarding a ses propres FAT e2e).
    offboardingFile: { findFirst: async () => null },
  };
  base.$transaction = async (fn: any) => fn(base);
  return base;
}
const fakeAudit = { log: async () => undefined } as any;
const svc = (sc: Scenario) => new KycService(fakePrisma(sc), fakeAudit);
const svcP = (sc: Scenario) => { const p = fakePrisma(sc); return { s: new KycService(p, fakeAudit), p }; };

const baseVisa = (over: any = {}) => ({ id: 'v1', sectionCode: 'IDENT', requiredRole: 'CO', status: 'PENDING', validateur: null, ...over });

(async () => {
  // ── R13 : un contributeur de la section ne peut pas signer son visa ──
  await it('SV-R13 contributeur de IDENT exclu du visa', async () => {
    const sc: Scenario = { kyc: { id: 'k1', code: 'KYC-1', tenantId: 't1', createdBy: 'X', visas: [baseVisa()] },
      contributors: { IDENT: ['U1'] } };
    await rejects(svc(sc).signVisa({ tenantId: 't1', userId: 'U1', role: 'CO' }, 'KYC-1', 'IDENT'), 'R13');
  });

  // ── R13 : un non-contributeur du même rôle peut signer ──
  await it('SV-R13 non-contributeur (même rôle) signe', async () => {
    const sc: Scenario = { kyc: { id: 'k1', code: 'KYC-1', tenantId: 't1', createdBy: 'X', visas: [baseVisa()] },
      contributors: { IDENT: ['U1'] } };
    const r = await svc(sc).signVisa({ tenantId: 't1', userId: 'CO_Bob', role: 'CO' }, 'KYC-1', 'IDENT');
    ok(r.status === 'SIGNED' && r.signedBy === 'CO_Bob');
  });

  // ── R2 : visa avec validateur nommé — seul lui peut signer ──
  await it('SV-R2 validateur nommé requis', async () => {
    const sc: Scenario = { kyc: { id: 'k1', code: 'KYC-1', tenantId: 't1', createdBy: 'X', visas: [baseVisa({ validateur: 'V1' })] } };
    await rejects(svc(sc).signVisa({ tenantId: 't1', userId: 'U2', role: 'CO' }, 'KYC-1', 'IDENT'), 'R2');
    const r = await svc(sc).signVisa({ tenantId: 't1', userId: 'V1', role: 'CO' }, 'KYC-1', 'IDENT');
    ok(r.status === 'SIGNED' && r.signedBy === 'V1');
  });

  // ── R86 : verdict NOK sans message → refusé ; OK et CONDITIONAL persistés ──
  await it('SV-R86 NOK sans message refusé', async () => {
    const sc: Scenario = { kyc: { id: 'k1', code: 'KYC-1', tenantId: 't1', createdBy: 'X', visas: [baseVisa()] } };
    await rejects(svc(sc).signVisa({ tenantId: 't1', userId: 'CO_Bob', role: 'CO' }, 'KYC-1', 'IDENT', 'NOK', ''), 'R86');
  });
  await it('SV-R86 OK persisté', async () => {
    const sc: Scenario = { kyc: { id: 'k1', code: 'KYC-1', tenantId: 't1', createdBy: 'X', visas: [baseVisa()] } };
    const r = await svc(sc).signVisa({ tenantId: 't1', userId: 'CO_Bob', role: 'CO' }, 'KYC-1', 'IDENT', 'OK', '');
    ok(r.status === 'SIGNED' && r.verdict === 'OK');
  });
  await it('SV-R86 CONDITIONAL avec message persisté', async () => {
    const sc: Scenario = { kyc: { id: 'k1', code: 'KYC-1', tenantId: 't1', createdBy: 'X', visas: [baseVisa()] } };
    const r = await svc(sc).signVisa({ tenantId: 't1', userId: 'CO_Bob', role: 'CO' }, 'KYC-1', 'IDENT', 'CONDITIONAL', 'sous réserve du justificatif');
    ok(r.verdict === 'CONDITIONAL' && r.message === 'sous réserve du justificatif');
  });

  // ── R52 : validation finale — un contributeur du dossier est exclu ──
  await it('VAL-R52 contributeur exclu de la validation finale', async () => {
    const sc: Scenario = { kyc: { id: 'k1', code: 'KYC-1', tenantId: 't1', status: 'UNDER_REVIEW', createdBy: 'X',
      visas: [baseVisa({ status: 'SIGNED' })] }, contributors: { IDENT: ['U1'] } };
    await rejects(svc(sc).validate({ tenantId: 't1', userId: 'U1', role: 'CO_SR' }, 'KYC-1'), 'R52');
  });

  // ── Four-eyes dossier : le créateur ne valide pas ──
  await it('VAL four-eyes créateur', async () => {
    const sc: Scenario = { kyc: { id: 'k1', code: 'KYC-1', tenantId: 't1', status: 'UNDER_REVIEW', createdBy: 'CO_SR_Ann',
      visas: [baseVisa({ status: 'SIGNED' })] } };
    await rejects(svc(sc).validate({ tenantId: 't1', userId: 'CO_SR_Ann', role: 'CO_SR' }, 'KYC-1'), 'Four-eyes');
  });

  // ── Rôle insuffisant pour la validation finale ──
  await it('VAL rôle non habilité', async () => {
    const sc: Scenario = { kyc: { id: 'k1', code: 'KYC-1', tenantId: 't1', status: 'UNDER_REVIEW', createdBy: 'X',
      visas: [baseVisa({ status: 'SIGNED' })] } };
    await rejects(svc(sc).validate({ tenantId: 't1', userId: 'RM_Joe', role: 'RM' }, 'KYC-1'), 'validation finale non autorisée');
  });

  // ── Chemin nominal : CO_SR non-créateur non-contributeur, visas signés → VALIDATED ──
  await it('VAL nominal → VALIDATED', async () => {
    const sc: Scenario = { kyc: { id: 'k1', code: 'KYC-1', tenantId: 't1', status: 'UNDER_REVIEW', createdBy: 'X',
      visas: [baseVisa({ status: 'SIGNED' })] }, contributors: { IDENT: ['U1'] } };
    const r = await svc(sc).validate({ tenantId: 't1', userId: 'CO_SR_Ann', role: 'CO_SR' }, 'KYC-1');
    ok(r.status === 'VALIDATED' && r.validatedBy === 'CO_SR_Ann');
  });

  // ════════ R84 — flux verrou (prendre / demander / passer / libérer) ════════
  const kycLk = { id: 'k1', code: 'KYC-1', tenantId: 't1', createdBy: 'X' };
  await it('LK-01 prendre la main d\'un dossier libre', async () => {
    const { s, p } = svcP({ kyc: kycLk });
    await s.takeLock({ tenantId: 't1', userId: 'ARM_Alice', role: 'ARM' }, 'KYC-1');
    ok(p._state.lock.holder === 'ARM_Alice');
  });
  await it('LK-02 prise refusée si détenu par un autre (R84)', async () => {
    const { s } = svcP({ kyc: kycLk, lock: { holder: 'ARM_Alice' } });
    await rejects(s.takeLock({ tenantId: 't1', userId: 'RM_Bob', role: 'RM' }, 'KYC-1'), 'demandez la main');
  });
  await it('LK-03 libération refusée si non-détenteur', async () => {
    const { s } = svcP({ kyc: kycLk, lock: { holder: 'ARM_Alice' } });
    await rejects(s.releaseLock({ tenantId: 't1', userId: 'RM_Bob', role: 'RM' }, 'KYC-1'), 'détenteur');
  });
  await it('LK-04 libération par le détenteur → libre', async () => {
    const { s, p } = svcP({ kyc: kycLk, lock: { holder: 'ARM_Alice' } });
    await s.releaseLock({ tenantId: 't1', userId: 'ARM_Alice', role: 'ARM' }, 'KYC-1');
    ok(p._state.lock.holder === null);
  });
  await it('LK-05 demander la main d\'un dossier détenu (tracé)', async () => {
    const { s, p } = svcP({ kyc: kycLk, lock: { holder: 'ARM_Alice' } });
    const r = await s.requestHand({ tenantId: 't1', userId: 'RM_Bob', role: 'RM' }, 'KYC-1');
    ok((r as any).requested === true && p._state.requests.includes('RM_Bob'));
  });
  await it('LK-06 passer la main par le détenteur', async () => {
    const { s, p } = svcP({ kyc: kycLk, lock: { holder: 'ARM_Alice' } });
    await s.passHand({ tenantId: 't1', userId: 'ARM_Alice', role: 'ARM' }, 'KYC-1', 'RM_Bob');
    ok(p._state.lock.holder === 'RM_Bob');
  });

  // ════════ R85 — passage de main (message obligatoire, phases persistées) ════════
  const kycHf = (phase, status='IN_PROGRESS') => ({ id: 'k1', code: 'KYC-1', tenantId: 't1', createdBy: 'X', handoffPhase: phase, status });
  await it('HF-01 next sans message refusé (R85)', async () => {
    await rejects(svc({ kyc: kycHf(0) }).handoffNext({ tenantId: 't1', userId: 'ARM_A', role: 'ARM' }, 'KYC-1', ''), 'obligatoire');
  });
  await it('HF-02 next avance de phase', async () => {
    const r: any = await svc({ kyc: kycHf(0) }).handoffNext({ tenantId: 't1', userId: 'ARM_A', role: 'ARM' }, 'KYC-1', 'à toi RM');
    ok(r.phase === 'RM');
  });
  await it('HF-03 back à la première étape refusé', async () => {
    await rejects(svc({ kyc: kycHf(0) }).handoffBack({ tenantId: 't1', userId: 'ARM_A', role: 'ARM' }, 'KYC-1', 'motif'), 'première étape');
  });
  await it('HF-04 valider hors section finale refusé', async () => {
    await rejects(svc({ kyc: kycHf(1) }).handoffValidate({ tenantId: 't1', userId: 'RM_B', role: 'RM' }, 'KYC-1', 'trop tôt'), 'validation');
  });
  await it('HF-05 rejet motivé → rejete', async () => {
    const r: any = await svc({ kyc: kycHf(1) }).handoffReject({ tenantId: 't1', userId: 'RM_B', role: 'RM' }, 'KYC-1', 'Incohérence patrimoine.');
    ok(r.status === 'rejete');
  });
  await it('HF-06 valider à la section finale → valide', async () => {
    const r: any = await svc({ kyc: kycHf(4) }).handoffValidate({ tenantId: 't1', userId: 'HoPB', role: 'CO_SR' }, 'KYC-1', 'Conforme, j\'approuve.');
    ok(r.status === 'valide');
  });

  console.log(`\nCâblage KycService (R13/R2/R52/R86/R84/R85) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
