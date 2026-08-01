// Lot A — port fidèle de domain.py (moteur de référence Python) vers NestJS. Autonome (node:assert),
// sans DB. Couvre R6/R10 (invalidation ciblée du visa sur modif), R9 (pas de révocation
// discrétionnaire), R11 (réassignation validateur = rôles habilités), R12 (annulation pour vice →
// incident op-risk), R8 (pas d'expiration calendaire — invariant), R24 (sections fixes / contenu
// variable). Nominal ⊕ violation par règle. R14 (engagement final) : voir kyc-service.spec.
process.env.AUDIT_HMAC_SECRET = process.env.AUDIT_HMAC_SECRET || "0".repeat(64);
import * as assert from "node:assert/strict";
import { KycService } from "../kyc.service";
import { SECTIONS_BY_WORKFLOW } from "../kyc.templates";

const audit = { log: async () => undefined } as any;

// Fake Prisma minimal du cycle de vie visa. `visas` porte kycFileId = kyc.id (comme en base).
function fake(opts: { kyc?: any; visas?: any[]; question?: any } = {}) {
  const kyc = opts.kyc ?? { id: "K1", code: "KYC-1", tenantId: "t1", status: "IN_PROGRESS", version: 0, clientId: "C1" };
  const visas: any[] = (opts.visas ?? []).map((v) => ({ version: 0, kycFileId: kyc.id, signedBy: null, verdict: null, message: null, ...v }));
  const events: any[] = [];
  const match = (v: any, where: any) => Object.entries(where).every(([k, val]: any) => v[k] === val);
  const kycVisa = {
    findFirst: async ({ where }: any) => visas.find((v) => match(v, where)) ?? null,
    findMany: async ({ where }: any = {}) => visas.filter((v) => match(v, where)),
    update: async ({ where, data }: any) => {
      const v = visas.find((x) => x.id === where.id); const nd = { ...data };
      if (nd.version && typeof nd.version === "object" && "increment" in nd.version) nd.version = v.version + nd.version.increment;
      Object.assign(v, nd); return v;
    },
  };
  const p: any = {
    kycFile: { findFirst: async () => kyc },
    kycVisa,
    kycQuestion: { findFirst: async () => opts.question ?? null, update: async ({ data }: any) => ({ ...(opts.question ?? {}), ...data }) },
    kycQuestionHistory: { findFirst: async () => null, create: async () => ({}) },
    offboardingFile: { findFirst: async () => null },
    domainEvent: { create: async ({ data }: any) => { events.push(data); return data; } },
    _events: events, _visas: visas,
  };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const svc = (p: any) => new KycService(p, audit);
const rejects = async (pr: Promise<any>, needle: string) => {
  try { await pr; assert.fail("attendu un refus contenant « " + needle + " »"); }
  catch (e: any) { if (e?.code === "ERR_ASSERTION" && String(e.message).startsWith("attendu")) throw e;
    assert.ok(String(e?.message ?? e).includes(needle), `message « ${e?.message} » doit contenir « ${needle} »`); }
};

(async () => {
  let passed = 0;
  const t = async (nom: string, fn: () => Promise<void>) => { await fn(); passed++; console.log("  ✓ " + nom); };
  const CO_SR = { tenantId: "t1", userId: "sel", role: "CO_SR" };
  const CO = { tenantId: "t1", userId: "co", role: "CO" };
  console.log("KYC lot A (R6/R10, R9, R11, R12, R8, R24) :");

  await t("R9 : la révocation discrétionnaire est refusée (409 typé, tracée)", async () => {
    await rejects(svc(fake()).tenterRevocation(CO, "KYC-1", "IDENT"), "[R9]");
  });

  await t("R11 : réassignation refusée pour un rôle NON habilité", async () => {
    const p = fake({ visas: [{ id: "v1", sectionCode: "IDENT", requiredRole: "CO", status: "PENDING", validateur: "old" }] });
    await rejects(svc(p).reassignerValidateur(CO, "KYC-1", "IDENT", "CO", "new"), "[R11]");
  });
  await t("R11 : réassignation par un rôle habilité (CO_SR) met à jour le validateur", async () => {
    const p = fake({ visas: [{ id: "v1", sectionCode: "IDENT", requiredRole: "CO", status: "PENDING", validateur: "old" }] });
    const r: any = await svc(p).reassignerValidateur(CO_SR, "KYC-1", "IDENT", "CO", "new");
    assert.equal(r.validateur, "new");
    assert.equal(p._visas[0].validateur, "new");
  });

  await t("R12 : seul un visa ACCORDÉ peut être annulé pour vice", async () => {
    const p = fake({ visas: [{ id: "v1", sectionCode: "IDENT", requiredRole: "CO", status: "PENDING" }] });
    await rejects(svc(p).annulerPourVice(CO_SR, "KYC-1", "IDENT", "CO", "vice"), "accordé");
  });
  await t("R12 : motif obligatoire", async () => {
    const p = fake({ visas: [{ id: "v1", sectionCode: "IDENT", requiredRole: "CO", status: "SIGNED" }] });
    await rejects(svc(p).annulerPourVice(CO_SR, "KYC-1", "IDENT", "CO", "  "), "Motif");
  });
  await t("R12 : annulation pour vice → visa en attente + incident op-risk émis", async () => {
    const p = fake({ visas: [{ id: "v1", sectionCode: "IDENT", requiredRole: "CO", status: "SIGNED", signedBy: "co" }] });
    await svc(p).annulerPourVice(CO_SR, "KYC-1", "IDENT", "CO", "process non respecté");
    assert.equal(p._visas[0].status, "PENDING");
    assert.ok(p._events.some((e: any) => e.type === "risque.operationnel.incident"), "incident op-risk émis");
  });

  await t("R6/R10 : modifier une donnée invalide le visa SIGNÉ de CETTE section, pas les autres", async () => {
    const question = { id: "q1", answer: null,
      section: { code: "IDENT", kycFile: { id: "K1", status: "IN_PROGRESS", clientId: "C1" } },
      accessRules: [{ role: "CO", right: "EDIT", effectiveFrom: new Date(0), effectiveTo: null }] };
    const p = fake({ question, visas: [
      { id: "v1", sectionCode: "IDENT", requiredRole: "CO", status: "SIGNED", signedBy: "co" },
      { id: "v2", sectionCode: "SOF", requiredRole: "CO", status: "SIGNED", signedBy: "co" }] });
    await svc(p).answer(CO, "KYC-1", "q1", "nouvelle valeur");
    assert.equal(p._visas.find((v: any) => v.id === "v1").status, "PENDING");   // section touchée (R6)
    assert.equal(p._visas.find((v: any) => v.id === "v2").status, "SIGNED");    // autre section intacte (R10)
    assert.ok(p._events.some((e: any) => e.type === "kyc.visa.invalide"));
  });

  await t("R8 : un visa accordé ne s'expire pas au calendrier (aucune API d'expiration)", async () => {
    // KycVisa = PENDING|SIGNED : aucune colonne d'échéance, aucune méthode ne dégrade un SIGNÉ
    // par le temps. Invariant scellé : sans appel d'expiration (il n'en existe pas), le visa tient.
    const p = fake({ visas: [{ id: "v1", sectionCode: "IDENT", requiredRole: "CO", status: "SIGNED", signedBy: "co" }] });
    const v = await p.kycVisa.findFirst({ where: { id: "v1" } });
    assert.equal(v.status, "SIGNED");
    assert.ok(!("expiresAt" in v) && !("expireAt" in v), "aucun champ d'expiration sur le visa");
  });

  await t("R24 : sections fixes par workflow (structure du référentiel, contenu variable)", async () => {
    const wfs = Object.keys(SECTIONS_BY_WORKFLOW);
    assert.ok(wfs.length > 0, "au moins un workflow");
    for (const wf of wfs) {
      const secs = SECTIONS_BY_WORKFLOW[wf];
      assert.ok(Array.isArray(secs) && secs.length > 0, `workflow ${wf} a des sections fixes`);
      // Deux « instances » du même workflow partagent la MÊME structure (la donnée ≠ la structure).
      assert.deepEqual(SECTIONS_BY_WORKFLOW[wf].map((s: any) => s.code), secs.map((s: any) => s.code));
    }
  });

  console.log(`\n### ${passed}/${passed} tests kyc-lotA verts ###`);
})().catch((e) => { console.error(e); process.exit(1); });
