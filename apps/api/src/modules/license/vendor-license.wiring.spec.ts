/**
 * Câblage Licence vendor — LC-01..05 (R177→R179). Miroir strict de l'amendement, écrit
 * AVANT l'implémentation. Le module est une licence : registre déclaré, document signé,
 * défaut-refus, acte vendor daté motivé jamais rétroactif, historique append-only.
 *
 * Harnais : compiler vendor-license.service.ts + ce fichier ;
 *   echo "── Câblage Licence vendor (LC-01..05, R177→R179) ──"; run vendor-license.wiring.spec.js
 */
import { VendorLicenseService, MODULES_PRODUIT } from './vendor-license.service';
declare const process: { exit(n: number): void; env: any };

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

function fakePrisma() {
  let seq = 0; const id = (p: string) => `${p}-${++seq}`;
  const db = { licences: [] as any[], events: [] as any[] };
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => row[k] === v);
  const p: any = { _db: db,
    vendorLicense: {
      findMany: async ({ where }: any = {}) => db.licences.filter((x) => match(x, where)),
      create: async ({ data }: any) => { const r = { id: id('L'), ...data }; db.licences.push(r); return r; } },
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; },
      findMany: async ({ where }: any = {}) => db.events.filter((e) => match(e, where)) } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
const evts = (p: any, t: string) => p._db.events.filter((e: any) => e.type === t);
const VENDOR = { userId: 'ali.g', role: 'VENDOR' };
const ADMIN_BANQUE = { userId: 'k.weber', role: 'ADMIN' };
const mk = () => {
  const p = fakePrisma();
  const s = new VendorLicenseService(p, fakeAudit(), { VENDOR_LICENSE_KEY: 'cle-secrete-vendor' });
  return { p, s };
};
const MODS = ['GED', 'KYC', 'OCR', 'WORKFLOWS'];

// Erratum date-relative (2026-07-22, R177→R179) : les dates de ce spec étaient codées en dur
// au jour de rédaction (effetAt='2026-07-21'), or R179 refuse l'effet rétroactif avec une
// fenêtre de grâce de 24h (vendor-license.service.ts) — passé le lendemain, LC-01..05 viraient
// au rouge (« rétroactif ») sans qu'aucun code ne change. On calcule désormais les dates
// relativement à « aujourd'hui » : comportement R179 strictement inchangé, test invariant.
const jour = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const AUJ = jour(0);        // effet immédiat, dans la fenêtre de grâce (jamais rétroactif)
const EXPIRY = jour(365);   // échéance ~1 an, jamais expirée au moment du test
const FUTUR = jour(60);     // effet futur (non rétroactif) — porte le test « motif obligatoire »
const PASSE = jour(-3650);  // franchement passé — porte le test « rétroactif refusé »

(async () => {
  // ── LC-01 (R177) — l'émission signée, le périmètre lisible ──
  await it('LC-01 émettre → licence signée, vérification OK, périmètre lisible avec version', async () => {
    const { p, s } = mk();
    await s.emettre(VENDOR, { instanceId: 'GWB-PROD', version: '2.4.0', modules: MODS,
      effetAt: AUJ, expiry: EXPIRY, motif: 'Contrat initial GWB' });
    const per: any = await s.perimetre('GWB-PROD');
    ok(per.modules.length === 4 && per.version === '2.4.0' && per.expiry === EXPIRY, 'périmètre lisible');
    ok(p._db.licences[0].signature.length > 10, 'signée');
    ok(evts(p, 'vendor.licence.emise').length === 1, 'l\'émission est un événement');
  });

  // ── LC-02 (R177) — la licence altérée est un refus, jamais un module de plus ──
  await it('LC-02 module ajouté à la main dans la licence → « invalide »', async () => {
    const { p, s } = mk();
    await s.emettre(VENDOR, { instanceId: 'GWB-PROD', version: '2.4.0', modules: ['GED'],
      effetAt: AUJ, expiry: EXPIRY, motif: 'x' });
    (p._db.licences[0].modules as string[]).push('AML');   // altération
    await rejects(s.perimetre('GWB-PROD'), 'invalide');
    await rejects(s.assertModule('GWB-PROD', 'AML'), 'invalide');
  });

  // ── LC-03 (R178) — défaut-refus par module, dans les deux sens ──
  await it('LC-03 licencié passe ; non licencié → « non licencié » ; hors registre → « inconnu »', async () => {
    const { s } = mk();
    await s.emettre(VENDOR, { instanceId: 'GWB-PROD', version: '2.4.0', modules: ['GED', 'KYC'],
      effetAt: AUJ, expiry: EXPIRY, motif: 'x' });
    await s.assertModule('GWB-PROD', 'GED');
    await rejects(s.assertModule('GWB-PROD', 'AML'), 'non licencié');
    await rejects(s.assertModule('GWB-PROD', 'TELEPORTATION'), 'inconnu');
    await rejects(s.emettre(VENDOR, { instanceId: 'X', version: '1', modules: ['TELEPORTATION'],
      effetAt: AUJ, expiry: EXPIRY, motif: 'x' }), 'inconnu');
  });

  // ── LC-04 (R179) — l'acte : nouvelle licence, historique append-only, jamais rétroactif ──
  await it('LC-04 retrait OCR = nouvelle licence motivée ; historique ×2 ; rétroactif refusé', async () => {
    const { p, s } = mk();
    await s.emettre(VENDOR, { instanceId: 'GWB-PROD', version: '2.4.0', modules: MODS,
      effetAt: AUJ, expiry: EXPIRY, motif: 'Contrat initial' });
    await s.emettre(VENDOR, { instanceId: 'GWB-PROD', version: '2.4.0', modules: ['GED', 'KYC', 'WORKFLOWS'],
      effetAt: AUJ, expiry: EXPIRY, motif: 'Avenant — OCR non reconduit' });   // effet immédiat : une licence à date future ne s'applique pas encore
    const per: any = await s.perimetre('GWB-PROD');
    ok(per.modules.indexOf('OCR') < 0 && per.modules.length === 3, 'le périmètre courant = la dernière licence');
    const histo: any = await s.historique('GWB-PROD');
    ok(histo.length === 2 && histo[0].modules.length === 4, 'l\'historique garde qui avait quoi, quand');
    await rejects(s.emettre(VENDOR, { instanceId: 'GWB-PROD', version: '2.4.0', modules: ['GED'],
      effetAt: PASSE, expiry: EXPIRY, motif: 'x' }), 'rétroactif');
    await rejects(s.emettre(VENDOR, { instanceId: 'GWB-PROD', version: '2.4.0', modules: ['GED'],
      effetAt: FUTUR, expiry: EXPIRY, motif: '' }), 'motif');
  });

  // ── LC-05 (R179) — l'acte est VENDOR — le profil banque est refusé et tracé ──
  await it('LC-05 admin banque qui émet → refus tracé', async () => {
    const { p, s } = mk();
    await rejects(s.emettre(ADMIN_BANQUE as any, { instanceId: 'GWB-PROD', version: '2.4.0',
      modules: ['GED'], effetAt: AUJ, expiry: EXPIRY, motif: 'x' }), 'vendor');
    ok(evts(p, 'vendor.licence.acces.refuse').length === 1, 'tentative tracée');
  });

  console.log(`\nCâblage Licence vendor (LC-01..05, R177→R179) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
