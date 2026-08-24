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
    // « cpsi.client.registered » : littéral du journal JUMEAU cpsi_events, en attente PAR DOCTRINE
    // (vague 3) — exemple STABLE, contrairement aux ex-exemples trip.submitted (schématisé v1)
    // et tuning.btl.campagne (schématisé vague 11).
    await emitEvent(c, 't1', 'cpsi.client.registered', 'TU1', { nimporte: 'quoi' });
    ok(c.rows.length === 1 && c.rows[0].eventVersion === undefined, 'écrit, version laissée au défaut DB');
  });

  // ── Tranche C6 : les 3 ex-creates directs de kyc.service sont schématisés STRICTS ──
  await it('C6 : kyc.created — payload réel du site d\'émission accepté (riskTrace optionnel)', async () => {
    const c = fakeClient();
    await emitEvent(c, 't1', 'kyc.created', 'K1', { code: 'KYC-1', workflow: 'EDD', riskTrace: ['R271'] });
    await emitEvent(c, 't1', 'kyc.created', 'K2', { code: 'KYC-2', workflow: 'STANDARD' });
    ok(c.rows.length === 2 && c.rows[0].eventVersion === 1, 'écrits + version 1');
  });
  await it('C6 : prospect.retour.refuse.detecte — dossiersRefuses typé, passager clandestin refusé', async () => {
    const c = fakeClient();
    await emitEvent(c, 't1', 'prospect.retour.refuse.detecte', 'K1', { code: 'KYC-1', dossiersRefuses: ['KYC-0'] });
    try { await emitEvent(c, 't1', 'prospect.retour.refuse.detecte', 'K1', { code: 'KYC-1', dossiersRefuses: ['KYC-0'], extra: 1 }); throw new Error('aurait dû refuser'); }
    catch (e) { ok(e instanceof EvenementNonConformeError, 'refus strict'); }
    ok(c.rows.length === 1, 'un seul write');
  });
  await it('C6 : kyc.access.modifie — payload complet exigé (champ manquant refusé, zéro write)', async () => {
    const c = fakeClient();
    await emitEvent(c, 't1', 'kyc.access.modifie', 'K1', { question: 'Q1', role: 'ARM', ancienne: 'HIDDEN',
      nouvelle: 'READ', par: 'u1', dateEffet: new Date(0).toISOString(), portee: 'dossier', dossiersTouches: 1 });
    try { await emitEvent(c, 't1', 'kyc.access.modifie', 'K1', { question: 'Q1', role: 'ARM' }); throw new Error('aurait dû refuser'); }
    catch (e) { ok(e instanceof EvenementNonConformeError, 'refus typé'); }
    ok(c.rows.length === 1, 'un seul write');
  });

  // ── Vague 1 de schématisation : familles mros.* / trip.* / training.* (15 types) ──
  await it('C6-V1 : mros.decision — payload réel accepté, passager clandestin refusé (art. 10a : rien de plus que le décidé)', async () => {
    const c = fakeClient();
    await emitEvent(c, 't1', 'mros.decision', 'M1', { decision: 'COMMUNIQUER', motif: 'soupçon fondé',
      par: 'u1', riskCaseId: 'rc-1', dossierSha256: 'abc' });
    try { await emitEvent(c, 't1', 'mros.decision', 'M1', { decision: 'COMMUNIQUER', motif: 'x',
      par: 'u1', riskCaseId: 'rc-1', dossierSha256: 'abc', fuite: true }); throw new Error('aurait dû refuser'); }
    catch (e) { ok(e instanceof EvenementNonConformeError, 'refus strict'); }
    ok(c.rows.length === 1 && c.rows[0].eventVersion === 1, 'un write, version 1');
  });
  await it('C6-V1 : trip.submitted typé (destinations string[], compteurs) · trip.approved = payload VIDE strict', async () => {
    const c = fakeClient();
    await emitEvent(c, 't1', 'trip.submitted', 'TR1', { destinations: ['IR'], avis: 1, signaux: 0 });
    await emitEvent(c, 't1', 'trip.approved', 'TR1', {});
    try { await emitEvent(c, 't1', 'trip.approved', 'TR1', { par: 'u1' }); throw new Error('aurait dû refuser'); }
    catch (e) { ok(e instanceof EvenementNonConformeError, 'payload vide strict'); }
    ok(c.rows.length === 2, 'deux writes');
  });
  await it('C6-V1 : training.reminder — joursRestants NUMÉRIQUE exigé · mros.gel.echeance accepte Date (sortie Prisma)', async () => {
    const c = fakeClient();
    await emitEvent(c, 't1', 'training.reminder', 'F1', { userId: 'u1', code: 'LBA', joursRestants: 7 });
    await emitEvent(c, 't1', 'mros.gel.echeance', 'M1', { echeance: new Date(0) });
    try { await emitEvent(c, 't1', 'training.reminder', 'F1', { userId: 'u1', code: 'LBA', joursRestants: '7' }); throw new Error('aurait dû refuser'); }
    catch (e) { ok(e instanceof EvenementNonConformeError, 'type numérique exigé'); }
    ok(c.rows.length === 2, 'deux writes');
  });

  console.log(`\nCatalogue d'événements au write (C6, L5) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
