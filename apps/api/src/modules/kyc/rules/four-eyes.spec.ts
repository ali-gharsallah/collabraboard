/**
 * Tests R13/R52 — miroir des scénarios croisés (V-02, V-03, R52) du moteur Python.
 * Harnais autonome : tsc + node.
 */
import { SectionFourEyes, FourEyesViolation } from './section-four-eyes';
declare const process: { exit(n: number): void };

const T0 = new Date('2026-01-01T00:00:00Z');
const t = (d = 0): Date => new Date(T0.getTime() + d * 86400000);

let passed = 0, failed = 0; const fails: string[] = [];
function it(name: string, fn: () => void): void {
  try { fn(); passed++; } catch (e) { failed++; fails.push(`✗ ${name} — ${(e as Error).message}`); }
}
function ok(c: boolean, m = 'assertion'): void { if (!c) throw new Error(m); }
function throwsRule(fn: () => void, rule: string): void {
  try { fn(); } catch (e) { if (e instanceof FourEyesViolation && e.rule === rule) return; throw new Error(`attendu ${rule}, obtenu ${(e as Error).message}`); }
  throw new Error(`FourEyesViolation ${rule} attendue`);
}

// FE-01 / V-02 : le préparateur d'une section est exclu de son visa (R13)
it('FE-01 (V-02) préparateur exclu de sa section', () => {
  const fe = new SectionFourEyes();
  fe.contribuer('IDENT', 'V1', t(1));
  ok(fe.peutViser('IDENT', 'V1') === false);
  throwsRule(() => fe.viser('IDENT', 'V1', t(2)), 'R13');
});

// FE-02 / V-03 : exclusion LIMITÉE — préparateur de IDENT peut viser FISC
it('FE-02 (V-03) exclusion limitée à la section', () => {
  const fe = new SectionFourEyes();
  fe.contribuer('IDENT', 'V2', t(1));
  fe.contribuer('FISC', 'U2', t(1));
  ok(fe.peutViser('FISC', 'V2') === true);
  ok(fe.viser('FISC', 'V2', t(2)) === true);
});

// FE-03 : un non-contributeur peut viser sa section
it('FE-03 non-contributeur peut viser', () => {
  const fe = new SectionFourEyes();
  fe.contribuer('IDENT', 'U1', t(1));
  ok(fe.viser('IDENT', 'V1', t(2)) === true);
});

// FE-04 / R52 : tout contributeur du dossier est exclu du visa FINAL
it('FE-04 (R52) contributeur exclu de la finale', () => {
  const fe = new SectionFourEyes();
  fe.contribuer('IDENT', 'U1', t(1));
  fe.contribuer('FISC', 'U2', t(1));
  ok(fe.peutViser('FINAL', 'U1') === false);
  throwsRule(() => fe.viser('FINAL', 'U1', t(2)), 'R52');
  // un non-contributeur peut viser la finale
  ok(fe.viser('FINAL', 'HoPB', t(3)) === true);
});

// FE-05 : contributions et refus sont tracés
it('FE-05 traçabilité (contribution + refus)', () => {
  const fe = new SectionFourEyes();
  fe.contribuer('IDENT', 'V1', t(1));
  try { fe.viser('IDENT', 'V1', t(2)); } catch { /* attendu */ }
  ok(fe.log[0].action === 'contribution' && fe.log[0].acteur === 'V1');
  ok(fe.log[1].action === 'visa_refuse_4yeux' && fe.log[1].section === 'IDENT');
});

// FE-06 : plusieurs préparateurs, exclusion cumulée par section
it('FE-06 préparateurs multiples par section', () => {
  const fe = new SectionFourEyes();
  fe.contribuer('IDENT', 'U1', t(1));
  fe.contribuer('IDENT', 'U3', t(1));
  ok(fe.preparateursDe('IDENT').sort().join(',') === 'U1,U3');
  throwsRule(() => fe.viser('IDENT', 'U3', t(2)), 'R13');
  ok(fe.viser('IDENT', 'V1', t(3)) === true);
});

console.log(`\nR13/R52 — ${passed}/${passed + failed} tests verts`);
if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
