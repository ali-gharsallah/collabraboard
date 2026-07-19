/**
 * Corpus GR-01..GR-04 — R104 (propagation contrôlée au golden record).
 * Miroir strict des scénarios Gherkin de l'amendement R104. Faux Prisma en mémoire,
 * même harnais que kyc-service.spec.ts. Écrit AVANT l'implémentation (ordre normal).
 *
 * Intégration harnais : ajouter au run-rule-tests.sh
 *   - compilation : src/modules/events/golden-record.projector.ts + ce fichier
 *   - exécution   : run golden-record.projector.spec.js  (section « Corpus GR »)
 */
import { GoldenRecordProjector } from './golden-record.projector';
declare const process: { exit(n: number): void };

let passed = 0, failed = 0; const fails: string[] = [];
function it(name: string, fn: () => Promise<void>): Promise<void> {
  return fn().then(() => { passed++; }, (e: Error) => { failed++; fails.push(`✗ ${name} — ${e.message}`); });
}
function ok(c: boolean, m = 'assertion'): void { if (!c) throw new Error(m); }

// ── Faux Prisma : un KYC, un client, journal d'audit espionné ──
type Sc = { kyc: any | null; client: any | null };
function fakePrisma(sc: Sc) {
  const p: any = {
    _writes: [] as any[],
    kycFile: { findFirst: async ({ where }: any) =>
      (sc.kyc && sc.kyc.id === where.id && sc.kyc.tenantId === where.tenantId) ? sc.kyc : null },
    client: {
      findFirst: async ({ where }: any) =>
        (sc.client && sc.client.id === where.id && sc.client.tenantId === where.tenantId) ? sc.client : null,
      update: async ({ where, data }: any) => {
        p._writes.push({ where, data });
        sc.client = { ...sc.client, ...data };
        return sc.client;
      },
    },
  };
  return p;
}
function fakeAudit() {
  const entries: any[] = [];
  return { entries, log: async (t: string, u: string, action: string, target: string) => { entries.push({ action, target }); } } as any;
}

const EV = (over: any = {}) => ({
  tenant_id: 't1', type: 'kyc.validated', aggregate_id: 'k1',
  payload: { code: 'KYC-2026-CH-0001-R1' }, ...over,
});
const KYC = (over: any = {}) => ({
  id: 'k1', tenantId: 't1', clientId: 'c1', code: 'KYC-2026-CH-0001-R1',
  status: 'VALIDATED', riskLevel: 'HIGH', validatedBy: 'CO_SR_1', ...over,
});
const CLIENT = (over: any = {}) => ({
  id: 'c1', tenantId: 't1', name: 'Dupont Holding SA', structure: 'HOLDING',
  country: 'CH', riskLevel: 'MEDIUM', corrLang: 'FR', ...over,
});

(async () => {
  // ── GR-01 : la validation propage, par événement ──
  await it('GR-01 kyc.validated consommé → riskLevel client mis à jour', async () => {
    const sc: Sc = { kyc: KYC(), client: CLIENT() };
    const audit = fakeAudit();
    const r: any = await new GoldenRecordProjector(fakePrisma(sc) as any, audit).handle(EV());
    ok(r.applied === true, 'application attendue');
    ok(sc.client!.riskLevel === 'HIGH', 'client doit passer HIGH');
  });
  await it('GR-01 audit CLIENT_UPDATED_FROM_KYC écrit (code + champs)', async () => {
    const sc: Sc = { kyc: KYC(), client: CLIENT() };
    const audit = fakeAudit();
    await new GoldenRecordProjector(fakePrisma(sc) as any, audit).handle(EV());
    ok(audit.entries.length === 1, 'exactement 1 entrée d\'audit');
    ok(audit.entries[0].action === 'CLIENT_UPDATED_FROM_KYC', 'action attendue');
    ok(String(audit.entries[0].target).includes('KYC-2026-CH-0001-R1'), 'le code KYC doit figurer');
    ok(String(audit.entries[0].target).includes('riskLevel'), 'les champs modifiés doivent figurer');
  });

  // ── GR-02 : un KYC non validé ne touche pas la fiche ──
  await it('GR-02 KYC rejeté → fiche inchangée, zéro audit', async () => {
    const sc: Sc = { kyc: KYC({ status: 'REJECTED' }), client: CLIENT() };
    const audit = fakeAudit(); const p = fakePrisma(sc);
    const r: any = await new GoldenRecordProjector(p as any, audit).handle(EV());
    ok(r.applied === false, 'aucune application');
    ok(sc.client!.riskLevel === 'MEDIUM', 'riskLevel inchangé');
    ok(p._writes.length === 0 && audit.entries.length === 0, 'aucune écriture, aucun audit');
  });
  await it('GR-02 KYC en cours → idem', async () => {
    const sc: Sc = { kyc: KYC({ status: 'IN_PROGRESS' }), client: CLIENT() };
    const audit = fakeAudit(); const p = fakePrisma(sc);
    const r: any = await new GoldenRecordProjector(p as any, audit).handle(EV());
    ok(r.applied === false && p._writes.length === 0 && audit.entries.length === 0, 'strictement neutre');
  });

  // ── GR-03 : le rejeu est neutre (idempotence) ──
  await it('GR-03 second passage du même événement → aucun changement, aucun audit', async () => {
    const sc: Sc = { kyc: KYC(), client: CLIENT() };
    const audit = fakeAudit(); const p = fakePrisma(sc);
    const proj = new GoldenRecordProjector(p as any, audit);
    await proj.handle(EV());                       // 1re application → HIGH
    const r2: any = await proj.handle(EV());       // rejeu
    ok(r2.applied === false, 'rejeu neutre');
    ok(sc.client!.riskLevel === 'HIGH', 'état stable');
    ok(p._writes.length === 1, 'une seule écriture au total');
    ok(audit.entries.length === 1, 'une seule entrée d\'audit au total');
  });

  // ── GR-04 : le mapping est une liste fermée ──
  await it('GR-04 seuls les champs du mapping propagent (pas de synchro silencieuse)', async () => {
    // Le KYC porte un clientName divergent : hors mapping, il ne doit PAS écraser client.name.
    const sc: Sc = { kyc: KYC({ clientName: 'AUTRE NOM SA' }), client: CLIENT() };
    const p = fakePrisma(sc);
    await new GoldenRecordProjector(p as any, fakeAudit()).handle(EV());
    ok(sc.client!.name === 'Dupont Holding SA', 'name hors mapping : intact');
    ok(sc.client!.riskLevel === 'HIGH', 'riskLevel (mapping) : propagé');
    const written = Object.keys(p._writes[0].data);
    ok(written.length === 1 && written[0] === 'riskLevel', `écriture strictement limitée au mapping (obtenu : ${written.join(',')})`);
  });

  // ── Garde-fous transverses (R104 : scope tenant, type, agrégat) ──
  await it('R104 événement d\'un autre tenant → introuvable, neutre', async () => {
    const sc: Sc = { kyc: KYC(), client: CLIENT() };
    const p = fakePrisma(sc);
    const r: any = await new GoldenRecordProjector(p as any, fakeAudit()).handle(EV({ tenant_id: 't2' }));
    ok(r.applied === false && p._writes.length === 0, 'cross-tenant strictement neutre');
  });
  await it('R104 type ≠ kyc.validated → ignoré', async () => {
    const sc: Sc = { kyc: KYC(), client: CLIENT() };
    const r: any = await new GoldenRecordProjector(fakePrisma(sc) as any, fakeAudit()).handle(EV({ type: 'kyc.created' }));
    ok(r.applied === false, 'autres types ignorés');
  });
  await it('R104 KYC introuvable → neutre (pas d\'exception qui bloque le drain)', async () => {
    const sc: Sc = { kyc: null, client: CLIENT() };
    const r: any = await new GoldenRecordProjector(fakePrisma(sc) as any, fakeAudit()).handle(EV());
    ok(r.applied === false, 'neutre');
  });

  console.log(`\nCorpus GR-01..GR-04 (R104 golden record) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
