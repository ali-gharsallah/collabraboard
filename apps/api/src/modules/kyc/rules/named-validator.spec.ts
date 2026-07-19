/** Tests R2/R4 — visa lié à la personne nommée, relais et dérogation. Harnais autonome. */
import { NamedValidator, NotAuthorized } from './named-validator';
declare const process: { exit(n: number): void };

const T0 = new Date('2026-01-01T00:00:00Z');
const t = (d = 0): Date => new Date(T0.getTime() + d * 86400000);
let passed = 0, failed = 0; const fails: string[] = [];
function it(name: string, fn: () => void): void { try { fn(); passed++; } catch (e) { failed++; fails.push(`✗ ${name} — ${(e as Error).message}`); } }
function ok(c: boolean, m = 'assertion'): void { if (!c) throw new Error(m); }
function throwsRule(fn: () => void, rule: string): void {
  try { fn(); } catch (e) { if (e instanceof NotAuthorized && e.rule === rule) return; throw new Error(`attendu ${rule}, obtenu ${(e as Error).message}`); }
  throw new Error(`NotAuthorized ${rule} attendue`);
}

// NV-01 (R2) : seul le validateur nommé peut signer sa section
it('NV-01 (R2) seul le validateur nommé signe', () => {
  const nv = new NamedValidator(); nv.assigner('IDENT', 'V1');
  ok(nv.peutViser('IDENT', 'V2') === false);
  throwsRule(() => nv.viser('IDENT', 'V2', t(1)), 'R2');
  ok(nv.viser('IDENT', 'V1', t(2)) === 'V1');
});

// NV-02 (R4) : validateur absent → le relais nommé devient le validateur résolu
it('NV-02 (R4) relais nommé remplace l\'absent', () => {
  const nv = new NamedValidator(); nv.assigner('FISC', 'V2'); nv.definirRelais('V2', 'R2b');
  nv.declarerAbsent('V2', t(1));
  ok(nv.resoudreValidateur('FISC') === 'R2b');
  ok(nv.viser('FISC', 'R2b', t(2)) === 'R2b');          // relais signe
  throwsRule(() => nv.viser('FISC', 'V2', t(3)), 'R2');  // l'absent ne signe plus
});

// NV-03 (R4) : un tiers ne signe que sous dérogation tracée
it('NV-03 (R4) tiers sous dérogation tracée', () => {
  const nv = new NamedValidator(); nv.assigner('IDENT', 'V1');
  throwsRule(() => nv.viser('IDENT', 'V3', t(1)), 'R2');                       // sans dérogation → refus
  const r = nv.viser('IDENT', 'V3', t(2), { decideur: 'PO1', fichePoste: 'FP-CO' });
  ok(r === 'V3');
  ok(nv.log.some(e => e.action === 'derogation_prononcee' && e.decideur === 'PO1'));
});

// NV-04 : sans relais ni absence, la résolution reste le validateur nommé
it('NV-04 résolution par défaut = validateur nommé', () => {
  const nv = new NamedValidator(); nv.assigner('AML', 'MLRO_Nadine');
  ok(nv.resoudreValidateur('AML') === 'MLRO_Nadine');
  ok(nv.peutViser('AML', 'MLRO_Nadine') === true);
});

// NV-05 : traçabilité (refus R2 + visa)
it('NV-05 traçabilité', () => {
  const nv = new NamedValidator(); nv.assigner('IDENT', 'V1');
  try { nv.viser('IDENT', 'V2', t(1)); } catch { /* attendu */ }
  nv.viser('IDENT', 'V1', t(2));
  ok(nv.log[0].action === 'visa_refuse_r2' && (nv.log[0] as any).tentative === 'V2');
  ok(nv.log[nv.log.length - 1].action === 'visa' && (nv.log[nv.log.length - 1] as any).par === 'V1');
});

// NV-06 : absence sans relais → pas de substitution automatique (validateur reste nommé)
it('NV-06 absence sans relais → pas de substitution', () => {
  const nv = new NamedValidator(); nv.assigner('IDENT', 'V1'); nv.declarerAbsent('V1', t(1));
  ok(nv.resoudreValidateur('IDENT') === 'V1');   // pas de relais → reste V1
  throwsRule(() => nv.viser('IDENT', 'V2', t(2)), 'R2');
});

console.log(`\nR2/R4 — ${passed}/${passed + failed} tests verts`);
if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
