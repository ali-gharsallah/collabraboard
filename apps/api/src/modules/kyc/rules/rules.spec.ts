/**
 * Tests de caractérisation R84/R85/R86 — miroir fidèle des suites Python
 * (CPSI bloc 16/17/18 : CK-01..05, HM-01..06, VQ-01..06). Harnais autonome
 * (sans Jest) : compilé par tsc, exécuté par node. Tests AVANT le câblage DB.
 */
import { KycLockService, KycLockError } from './kyc-lock.service';
import { KycHandoff, HandoffError } from './kyc-handoff';
import { QualifiedVisaService, VisaError } from './qualified-visa.service';
declare const process: { exit(n: number): void };

const T0 = new Date('2026-01-01T00:00:00Z');
const t = (d = 0): Date => new Date(T0.getTime() + d * 86400000);

let passed = 0, failed = 0; const fails: string[] = [];
function it(name: string, fn: () => void): void {
  try { fn(); passed++; }
  catch (e) { failed++; fails.push(`✗ ${name} — ${(e as Error).message}`); }
}
function ok(cond: boolean, msg = 'assertion'): void { if (!cond) throw new Error(msg); }
function throws(fn: () => void, Kind?: any): void {
  try { fn(); } catch (e) { if (Kind && !(e instanceof Kind)) throw new Error(`mauvais type: ${(e as Error).constructor.name}`); return; }
  throw new Error('exception attendue');
}

// ══════════ R84 — KycLock (CK-01..05) ══════════
it('CK-01 prise de main', () => {
  const l = new KycLockService();
  l.prendreLaMain('KYC-1', 'ARM_Alice', t(1));
  ok(l.detenteur('KYC-1') === 'ARM_Alice' && !l.estLibere('KYC-1'));
  ok(l.peutConsulter('KYC-1', 'ARM_Alice') === true);
  ok(l.peutConsulter('KYC-1', 'RM_Bob') === false);
});
it('CK-02 demande de main (tracée)', () => {
  const l = new KycLockService();
  l.prendreLaMain('KYC-1', 'ARM_Alice', t(1));
  throws(() => l.prendreLaMain('KYC-1', 'RM_Bob', t(2)), KycLockError);
  const r = l.demanderLaMain('KYC-1', 'RM_Bob', t(2));
  ok(r.detenteur === 'ARM_Alice' && r.demandeurs.includes('RM_Bob'));
  ok(l.log.some((e) => e.action === 'demande_de_main'));
});
it('CK-03 libération', () => {
  const l = new KycLockService();
  l.prendreLaMain('KYC-1', 'ARM_Alice', t(1));
  l.demanderLaMain('KYC-1', 'RM_Bob', t(2));
  l.liberer('KYC-1', 'ARM_Alice', t(3));
  ok(l.estLibere('KYC-1') && l.peutConsulter('KYC-1', 'RM_Bob'));
  l.prendreLaMain('KYC-1', 'RM_Bob', t(4));
  ok(l.detenteur('KYC-1') === 'RM_Bob');
});
it('CK-04 passage de main', () => {
  const l = new KycLockService();
  l.prendreLaMain('KYC-1', 'ARM_Alice', t(1));
  l.demanderLaMain('KYC-1', 'RM_Bob', t(2));
  l.passerLaMain('KYC-1', 'ARM_Alice', 'RM_Bob', t(3));
  ok(l.detenteur('KYC-1') === 'RM_Bob' && !l.demandeurs('KYC-1').includes('RM_Bob'));
  ok(l.peutConsulter('KYC-1', 'ARM_Alice') === false);
});
it('CK-05 garde-fous', () => {
  const l = new KycLockService();
  throws(() => l.demanderLaMain('KYC-1', 'RM_Bob', t(1)), KycLockError); // libre
  l.prendreLaMain('KYC-1', 'ARM_Alice', t(2));
  throws(() => l.liberer('KYC-1', 'RM_Bob', t(3)), KycLockError);        // pas détenteur
  throws(() => l.demanderLaMain('KYC-1', 'ARM_Alice', t(3)), KycLockError); // détenteur lui-même
});

// ══════════ R85 — KycHandoff (HM-01..06) ══════════
const PHASES = ['ARM', 'RM', 'BRM', 'Compliance', 'Validation'];
it('HM-01 next_step + message obligatoire', () => {
  const w = new KycHandoff(PHASES);
  throws(() => w.nextStep('ARM_Alice', '', t(1)), HandoffError);
  ok(w.phaseCourante() === 'ARM');
  ok(w.nextStep('ARM_Alice', 'Identité/Relation complétées, à toi RM.', t(1)) === 'RM');
  ok(w.phaseCourante() === 'RM');
});
it('HM-02 revenir + message ; refus 1re étape', () => {
  const w = new KycHandoff(PHASES);
  w.nextStep('ARM_Alice', 'à toi', t(1));
  throws(() => w.revenir('RM_Bob', '', t(2)), HandoffError);
  w.revenir('RM_Bob', 'Il manque le SOF, je te rends la main.', t(2));
  ok(w.phaseCourante() === 'ARM');
  throws(() => w.revenir('ARM_Alice', 'rien', t(3)), HandoffError);
});
it('HM-03 chemin complet → validation', () => {
  const w = new KycHandoff(PHASES);
  for (const u of ['ARM', 'RM', 'BRM', 'Compliance']) w.nextStep(u, 'passage ' + u, t(1));
  ok(w.phaseCourante() === 'Validation' && w.estDerniere());
  throws(() => w.valider('HoPB', '', t(2)), HandoffError);
  ok(w.valider('HoPB', "Dossier conforme, j'approuve.", t(3)) === 'valide');
});
it('HM-04 validation seulement à la fin ; rejet motivé', () => {
  const w = new KycHandoff(PHASES);
  throws(() => w.valider('RM_Bob', 'trop tôt', t(1)), HandoffError);
  ok(w.rejeter('RM_Bob', 'Incohérence patrimoine/activité.', t(2)) === 'rejete');
});
it('HM-05 terminal : plus aucune transition', () => {
  const w = new KycHandoff(PHASES);
  w.rejeter('RM_Bob', 'motif', t(1));
  throws(() => w.nextStep('x', 'm', t(2)), HandoffError);
  throws(() => w.revenir('x', 'm', t(2)), HandoffError);
  throws(() => w.valider('x', 'm', t(2)), HandoffError);
});
it('HM-06 traçabilité (qui, message, de→à)', () => {
  const w = new KycHandoff(PHASES);
  w.nextStep('ARM_Alice', 'à toi RM', t(1));
  w.revenir('RM_Bob', 'complète le SOF', t(2));
  ok(w.log[0].action === 'next_step' && w.log[0].de === 'ARM' && w.log[0].a === 'RM');
  ok(w.log[0].user === 'ARM_Alice' && w.log[0].message === 'à toi RM');
  ok(w.log[1].action === 'revenir' && w.log[1].message === 'complète le SOF');
});

// ══════════ R86 — QualifiedVisa (VQ-01..06) ══════════
it('VQ-01 OK sans message autorisé', () => {
  const v = new QualifiedVisaService();
  const r = v.apposer('aml/Compliance', 'S. Marchand', 'Compliance', 'OK', '', t(1));
  ok(r.verdict === 'OK' && v.verdict('aml/Compliance') === 'OK' && !v.bloquant('aml/Compliance'));
});
it('VQ-02 NOK message obligatoire + bloquant', () => {
  const v = new QualifiedVisaService();
  throws(() => v.apposer('aml/Compliance', 'S. Marchand', 'Compliance', 'NOK', '', t(1)), VisaError);
  v.apposer('aml/Compliance', 'S. Marchand', 'Compliance', 'NOK', 'SOF incohérent, refus.', t(1));
  ok(v.bloquant('aml/Compliance'));
});
it('VQ-03 CONDITIONAL message obligatoire', () => {
  const v = new QualifiedVisaService();
  throws(() => v.apposer('sofsow/CO', 'L. Morel', 'CO', 'CONDITIONAL', '  ', t(1)), VisaError);
  const r = v.apposer('sofsow/CO', 'L. Morel', 'CO', 'CONDITIONAL', 'OK si justificatif sous 30j.', t(1));
  ok(r.verdict === 'CONDITIONAL' && r.message.startsWith('OK si'));
});
it('VQ-04 retrait par le signataire seul', () => {
  const v = new QualifiedVisaService();
  v.apposer('aml/Compliance', 'S. Marchand', 'Compliance', 'OK', '', t(1));
  throws(() => v.retirer('aml/Compliance', 'Autre', t(2)), VisaError);
  v.retirer('aml/Compliance', 'S. Marchand', t(3));
  ok(v.verdict('aml/Compliance') === null);
});
it('VQ-05 verdict invalide refusé', () => {
  const v = new QualifiedVisaService();
  throws(() => v.apposer('aml/Compliance', 'S. Marchand', 'Compliance', 'PEUT_ETRE' as any, '', t(1)), VisaError);
});
it('VQ-06 traçabilité (verdict + message)', () => {
  const v = new QualifiedVisaService();
  v.apposer('aml/Compliance', 'S. Marchand', 'Compliance', 'CONDITIONAL', 'sous réserve doc', t(1));
  const e = v.log[v.log.length - 1];
  ok(e.action === 'visa' && (e as any).verdict === 'CONDITIONAL' && (e as any).message === 'sous réserve doc');
});

console.log(`\nR84/R85/R86 — ${passed}/${passed + failed} tests verts`);
if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
