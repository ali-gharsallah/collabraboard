/**
 * Câblage Business Trip — GARDES RÉGLEMENTAIRES ⚠ de la vague R222–R238 (P-L2-2).
 * Portée : les gardes dont la violation serait un incident de conformité — R223 (avis cross-border
 * ≠ décision, R44), R224 (KYC bloquant avant approbation, LBA), R228 (certification requise) et
 * R237 (résolution À LA DATE DU VOYAGE). Faux-Prisma en mémoire, auteur = jeton. Inverser une de ces
 * gardes doit faire rougir au moins un test (gate L2).
 *
 * Harnais : compiler businesstrip.module.ts + ce fichier ; exécuter le .js émis.
 */
import { BusinessTripService } from './businesstrip.module';
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

// ── Faux Prisma : tables en mémoire, filtres tenant réellement appliqués (equality · in · gte/lte) ──
function fakePrisma(seed: any = {}) {
  let seq = 0; const id = (p: string) => `${p}-${++seq}`;
  const db: any = { tenants: seed.tenants ?? [], trips: seed.trips ?? [], tripVisas: [], kycFiles: seed.kycFiles ?? [],
    certifications: seed.certifications ?? [], crmContacts: seed.crmContacts ?? [], events: [] };
  const T = (x: any) => new Date(x).getTime();
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => {
    if (v && typeof v === 'object' && 'in' in v) return v.in.includes(row[k]);
    if (v && typeof v === 'object' && ('gte' in v || 'lte' in v)) {
      let good = true; if ('gte' in v) good = good && T(row[k]) >= T(v.gte); if ('lte' in v) good = good && T(row[k]) <= T(v.lte); return good;
    }
    return row[k] === v;
  });
  const table = (rows: any[], prefix: string, defaults: any = {}) => ({
    findFirst: async ({ where }: any = {}) => rows.find((r) => match(r, where)) ?? null,
    findMany: async ({ where }: any = {}) => rows.filter((r) => match(r, where ?? {})),
    create: async ({ data }: any) => { const r = { id: id(prefix), ...defaults, ...data }; rows.push(r); return r; },
    update: async ({ where, data }: any) => { const r = rows.find((x) => x.id === where.id); Object.assign(r, data); return r; },
    count: async ({ where }: any = {}) => rows.filter((r) => match(r, where ?? {})).length,
  });
  const p: any = { _db: db,
    tenant: table(db.tenants, 'TEN'), trip: table(db.trips, 'TRIP', { revision: 0 }),
    tripVisa: table(db.tripVisas, 'VISA', { status: 'PENDING' }), kycFile: table(db.kycFiles, 'KYC'),
    certification: table(db.certifications, 'CERT'), crmContact: table(db.crmContacts, 'CRM'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; } },
  };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => {} } as any);
const CTX = { tenantId: 't1', userId: 'approver', role: 'DIR' };
const tenant = (settings: any) => ({ id: 't1', settings });

(async () => {
  // ── R224 ⚠ — un client visité sans KYC VALIDATED lève un signal KYC_NOT_APPROVED ──
  await it('R224 soumettre : client sans KYC approuvé → signal KYC_NOT_APPROVED (sévérité tenant)', async () => {
    const p = fakePrisma({ tenants: [tenant({ tripKycCheckSeverity: 'BLOQUANT_APPROBATION' })],
      trips: [{ id: 'TR1', tenantId: 't1', travelerId: 'trav', status: 'DRAFT', destinations: [], clients: ['c1'], dateStart: '2026-05-01', dateEnd: '2026-05-03' }],
      kycFiles: [{ id: 'K1', tenantId: 't1', clientId: 'c1', status: 'PENDING', createdAt: '2026-01-01' }] });
    const s = new BusinessTripService(p, fakeAudit());
    const maj: any = await s.soumettre(CTX, 'TR1');
    const sig = (maj.signals as any[]).find((x) => x.type === 'KYC_NOT_APPROVED');
    ok(!!sig && sig.severite === 'BLOQUANT_APPROBATION', 'signal KYC bloquant attendu');
  });

  // ── R224 ⚠ — viser un voyage porteur d'un signal KYC bloquant est REFUSÉ ; INFORMATIF ne bloque pas ──
  await it('R224 viser : signal KYC bloquant → refus TRIP_KYC_NOT_APPROVED (jamais l\'auteur du voyage)', async () => {
    const p = fakePrisma({ tenants: [tenant({})],
      trips: [{ id: 'TR2', tenantId: 't1', travelerId: 'trav', status: 'PENDING_APPROVAL', destinations: [], clients: ['c1'],
        signals: [{ type: 'KYC_NOT_APPROVED', severite: 'BLOQUANT_APPROBATION' }] }] });
    // un visa DIR en attente existe : si la garde tombait, viser irait jusqu'au visa (donc le refus vient BIEN de R224).
    p._db.tripVisas.push({ id: 'V1', tenantId: 't1', tripId: 'TR2', role: 'DIR', status: 'PENDING' });
    const s = new BusinessTripService(p, fakeAudit());
    await rejects(s.viser(CTX, 'TR2', 'DIR'), 'TRIP_KYC_NOT_APPROVED');
  });
  await it('R224 viser : signal KYC INFORMATIF → n\'est PAS un motif de refus (le visa passe)', async () => {
    const p = fakePrisma({ tenants: [tenant({})],
      trips: [{ id: 'TR3', tenantId: 't1', travelerId: 'trav', status: 'PENDING_APPROVAL', destinations: [], clients: ['c1'],
        signals: [{ type: 'KYC_NOT_APPROVED', severite: 'INFORMATIF' }] }] });
    p._db.tripVisas.push({ id: 'V2', tenantId: 't1', tripId: 'TR3', role: 'DIR', status: 'PENDING' });
    const s = new BusinessTripService(p, fakeAudit());
    const r: any = await s.viser(CTX, 'TR3', 'DIR');
    ok(r.status === 'APPROVED', 'un signal INFORMATIF ne doit pas bloquer l\'approbation');
  });

  // ── R223 ⚠ — une destination INTERDITE produit un AVIS attaché, mais NE décide PAS (R44) ──
  await it('R223 : destination INTERDITE → avis attaché ET voyage quand même PENDING_APPROVAL (avis ≠ décision)', async () => {
    const p = fakePrisma({ tenants: [tenant({ tripCrossBorderReferentiel: [{ jurisdiction: 'IR', activite: 'trading', verdict: 'INTERDITE', depuisLe: '2020-01-01' }] })],
      trips: [{ id: 'TR4', tenantId: 't1', travelerId: 'trav', status: 'DRAFT', destinations: ['IR'], clients: [], dateStart: '2026-05-01', dateEnd: '2026-05-03' }] });
    const s = new BusinessTripService(p, fakeAudit());
    const maj: any = await s.soumettre(CTX, 'TR4');
    const avis = (maj.advisories as any[]).find((a) => a.jurisdiction === 'IR');
    ok(!!avis && avis.verdict === 'INTERDITE', 'avis INTERDITE attendu');
    ok(maj.status === 'PENDING_APPROVAL', 'R44 : l\'avis ne bloque pas — l\'approbation reste humaine');
  });

  // ── R228 ⚠ — certification requise en juridiction visitée, non couverte → signal ──
  await it('R228 : certification requise non couverte à la date du voyage → signal CERTIFICATION_EXPIRED_AT_TRIP_DATE', async () => {
    const p = fakePrisma({ tenants: [tenant({ tripCertificationRequise: [{ jurisdiction: 'US', code: 'SEC-7' }] })],
      trips: [{ id: 'TR5', tenantId: 't1', travelerId: 'trav', status: 'DRAFT', destinations: ['US'], clients: [], dateStart: '2026-05-01', dateEnd: '2026-05-03' }] });
    const s = new BusinessTripService(p, fakeAudit());
    const maj: any = await s.soumettre(CTX, 'TR5');
    ok((maj.signals as any[]).some((x) => x.type === 'CERTIFICATION_EXPIRED_AT_TRIP_DATE'), 'signal certification attendu');
  });

  // ── R237 ⚠ — la couverture est résolue À LA DATE DU VOYAGE, pas « maintenant ». Une certif valide
  //     aujourd'hui mais expirée à la date (future) du voyage DOIT quand même déclencher le signal. ──
  await it('R237 : certif valide aujourd\'hui mais expirée à la date du voyage → signal (résolution à date du voyage)', async () => {
    const p = fakePrisma({ tenants: [tenant({ tripCertificationRequise: [{ jurisdiction: 'US', code: 'SEC-7' }] })],
      trips: [{ id: 'TR6', tenantId: 't1', travelerId: 'trav', status: 'DRAFT', destinations: ['US'], clients: [], dateStart: '2026-10-01', dateEnd: '2026-10-03' }],
      certifications: [{ id: 'C1', tenantId: 't1', userId: 'trav', code: 'SEC-7', obtenueLe: '2026-01-01', expireLe: '2026-09-01' }] });
    const s = new BusinessTripService(p, fakeAudit());
    const maj: any = await s.soumettre(CTX, 'TR6');
    ok((maj.signals as any[]).some((x) => x.type === 'CERTIFICATION_EXPIRED_AT_TRIP_DATE'),
      'la certif expire AVANT le voyage (résolue à dateStart) → signal ; résolue à « maintenant » elle serait couverte');
  });
  await it('R237 : certif couvrant la date du voyage → AUCUN signal', async () => {
    const p = fakePrisma({ tenants: [tenant({ tripCertificationRequise: [{ jurisdiction: 'US', code: 'SEC-7' }] })],
      trips: [{ id: 'TR7', tenantId: 't1', travelerId: 'trav', status: 'DRAFT', destinations: ['US'], clients: [], dateStart: '2026-05-01', dateEnd: '2026-05-03' }],
      certifications: [{ id: 'C2', tenantId: 't1', userId: 'trav', code: 'SEC-7', obtenueLe: '2026-01-01', expireLe: '2026-12-01' }] });
    const s = new BusinessTripService(p, fakeAudit());
    const maj: any = await s.soumettre(CTX, 'TR7');
    ok(!(maj.signals as any[]).some((x) => x.type === 'CERTIFICATION_EXPIRED_AT_TRIP_DATE'), 'certif couvrante → aucun signal');
  });

  console.log(`\nCâblage Business Trip — gardes ⚠ (R223 · R224 · R228 · R237) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
