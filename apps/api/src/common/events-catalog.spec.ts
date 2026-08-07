/**
 * Catalogue d'événements au WRITE (P-L5-2, dette C6) — emitEvent valide contre le catalogue :
 * type schématisé conforme → écrit avec eventVersion ; non conforme → EvenementNonConformeError,
 * ZÉRO écriture ; type inconnu (ni schéma ni liste d'attente) → refusé ; type en attente →
 * écrit sans validation (migration douce). R49 : le catalogue régit le write — jamais les
 * événements déjà stockés (la lecture reste aux upcasters).
 */
import { emitEvent, EvenementNonConformeError } from './domain-event';
declare const process: { exit(n: number): void };

let passed = 0, failed = 0; const fails: string[] = [];
function it(name: string, fn: () => Promise<void>): Promise<void> {
  return fn().then(() => { passed++; }, (e: Error) => { failed++; fails.push(`✗ ${name} — ${e.message}`); });
}
const ok = (c: boolean, m = 'assertion') => { if (!c) throw new Error(m); };

function fakeClient() {
  const rows: any[] = [];
  return { rows, domainEvent: { create: async ({ data }: any) => { rows.push(data); return data; } } } as any;
}

(async () => {
  // ── type schématisé, payload CONFORME → écrit, eventVersion posé depuis le catalogue ──
  await it('C6 : type schématisé conforme → écrit avec eventVersion du catalogue', async () => {
    const c = fakeClient();
    await emitEvent(c, 't1', 'kyc.lock.acquired', 'K1', { code: 'KYC-1', holder: 'i.vernet' });
    ok(c.rows.length === 1 && c.rows[0].eventVersion === 1 && c.rows[0].type === 'kyc.lock.acquired', 'écrit + version 1');
  });

  // ── type schématisé, payload NON conforme → exception typée, ZÉRO écriture ──
  await it('C6 : champ manquant → EvenementNonConformeError, aucune écriture partielle', async () => {
    const c = fakeClient();
    try { await emitEvent(c, 't1', 'kyc.lock.acquired', 'K1', { code: 'KYC-1' }); throw new Error('aurait dû refuser'); }
    catch (e) { ok(e instanceof EvenementNonConformeError && (e as Error).message.includes('holder'), `erreur typée attendue (${(e as Error).message})`); }
    ok(c.rows.length === 0, 'zéro write');
  });
  await it('C6 : champ INCONNU (strict) → refusé — le payload n\'accueille pas de passager clandestin', async () => {
    const c = fakeClient();
    try { await emitEvent(c, 't1', 'pep.proposition.rejetee', 'p:1', { cle: 'p:1', motif: 'x', par: 'u', extra: true }); throw new Error('aurait dû refuser'); }
    catch (e) { ok(e instanceof EvenementNonConformeError, 'erreur typée attendue'); }
    ok(c.rows.length === 0, 'zéro write');
  });

  // ── type INCONNU du catalogue (ni schéma, ni attente) → refusé ──
  await it('C6 : type inconnu → refusé (un événement ne s\'invente pas au write)', async () => {
    const c = fakeClient();
    try { await emitEvent(c, 't1', 'type.invente.nulle.part', 'X', {}); throw new Error('aurait dû refuser'); }
    catch (e) { ok(e instanceof EvenementNonConformeError && (e as Error).message.includes('inconnu'), 'refus typé'); }
    ok(c.rows.length === 0, 'zéro write');
  });

  // ── type EN ATTENTE (migration douce) → écrit sans validation, version par défaut ──
  await it('C6 : type en attente de schéma → écrit tel quel (migration douce)', async () => {
    const c = fakeClient();
    await emitEvent(c, 't1', 'trip.submitted', 'TR1', { nimporte: 'quoi' });
    ok(c.rows.length === 1 && c.rows[0].eventVersion === undefined, 'écrit, version laissée au défaut DB');
  });

  console.log(`\nCatalogue d'événements au write (C6, L5) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
