// Harnais P-L7-3 — CaseFactsReader + RequirementLedger (LG-01..08). Autonome (node:assert),
// fakePrisma en mémoire. Les 4 SCÉNARIOS D'INFÉRENCE (v1.1 §6.3, ADAPTÉS au repo — le document
// v1.1 n'est pas au dépôt : l'adaptation suit RULES_INVENTORY et les capacités réelles) :
//   SC1 dossier incomplet → gap bloquant en tête, explain porte la base légale ;
//   SC2 réception du document → satisfait (preuve = id de la pièce) ; pièce EXPIRÉE ≠ absente ;
//   SC3 activation conditionnelle : EDD actif SEULEMENT si un settlor PEP est lié (DSL any) ;
//       le visa CO SIGNED/OK satisfait l'approval (sémantique qualified-visa : NOK jamais) ;
//   SC4 contrôles screening : hit BRUT → non satisfait ; tous QUALIFIE → satisfait (0 hit = vacuité).
// + LG-08 : gap() < 1 s sur le dossier de fixtures (critère de sortie du prompt).
import * as assert from "node:assert/strict";
import { chargerProfils } from "./profils.loader";
import { CaseFactsReader } from "./case-facts.reader";
import { LedgerService } from "./ledger.service";

let passed = 0; const t = async (nom: string, fn: () => Promise<void> | void) => { await fn(); passed++; console.log("  ✓ " + nom); };

const PROFILS = chargerProfils(`
profils:
  - profil: trust-defaut
    entityType: TRUST
    jurisdiction: "*"
    requirements:
      - id: REQ-DOC-T
        kind: document
        basis: "CDB 20 art. 41 · R26"
        severity: bloquant
        params: { document: FORMULAIRE_T }
      - id: REQ-CHECK-SCREEN
        kind: check
        basis: "LBA art. 6 · R101"
        severity: bloquant
        params: { source: screening }
      - id: REQ-EDD-PEP
        kind: document
        basis: "OBA-FINMA EDD · R32"
        severity: bloquant
        params: { document: RAPPORT_EDD }
        when: "any(relatedPersons, p => p.pep)"
      - id: REQ-VISA-CO
        kind: approval
        basis: "OBA-FINMA · R14/R86"
        severity: bloquant
        params: { role: CO, section: FINAL }
        when: "riskLevel == 'HIGH'"
      - id: REQ-DATA-JUR
        kind: data
        basis: "LBA (identification) · R20"
        severity: non_bloquant
        params: { attribut: jurisdiction }
`);

// ── fakePrisma minimal : equality/in sur les tables du reader. ──
const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) =>
  v && typeof v === "object" && "in" in v ? v.in.includes(row[k]) : row[k] === v);
function fakePrisma(tables: Record<string, any[]>) {
  const table = (nom: string) => ({
    findFirst: async ({ where }: any) => tables[nom].find((r) => match(r, where)) ?? null,
    findMany: async ({ where }: any) => tables[nom].filter((r) => match(r, where)),
  });
  return { kycFile: table("kycFile"), client: table("client"), personneLien: table("personneLien"),
    person: table("person"), document: table("document"), kycVisa: table("kycVisa"),
    screeningHit: table("screeningHit") } as any;
}

const T = "11111111-1111-4111-8111-111111111111";
const ctx = { tenantId: T };
const NOW = new Date("2026-08-07T12:00:00Z");

function dossier(opts: { docs?: any[]; visas?: any[]; hits?: any[]; pep?: boolean; risk?: string }) {
  const tables = {
    kycFile: [{ id: "K1", tenantId: T, clientId: "C1", code: "KYC-1", countryCode: "LI",
      riskLevel: opts.risk ?? "HIGH" }],
    client: [{ id: "C1", tenantId: T, name: "Trust Alpha", structure: "TRUST", country: "LI",
      riskLevel: "HIGH" }],
    personneLien: opts.pep === undefined ? [] : [{ id: "L1", tenantId: T, personneId: "P1",
      typeCode: "SETTLOR", cibleType: "KYC", cibleId: "K1" }],
    person: [{ id: "P1", tenantId: T, nom: "Settlor Un", statutPep: !!opts.pep, flags: [] }],
    document: opts.docs ?? [],
    kycVisa: opts.visas ?? [],
    screeningHit: opts.hits ?? [],
  };
  return new LedgerService(new CaseFactsReader(fakePrisma(tables) as any));
}

(async () => {
console.log("Inférence P-L7-3 — CaseFactsReader + RequirementLedger (LG) :");

await t("LG-01/SC1 dossier incomplet : gap bloquants d'abord, explain porte la base légale", async () => {
  const svc = dossier({ risk: "MEDIUM" });                       // pas de PEP, pas de visa requis
  const { profil, ledger } = await svc.ledger(ctx, "K1", PROFILS, NOW);
  assert.equal(profil, "trust-defaut");                          // repli juridiction (LI → *)
  const gap = ledger.gap();
  assert.equal(gap[0].severity, "bloquant");                     // bloquants EN TÊTE
  assert.ok(gap.some((g) => g.id === "REQ-DOC-T" && /CDB 20/.test(g.basis)));
  const ex = ledger.explain("REQ-DOC-T");
  assert.ok(ex.connu && ex.basis.includes("CDB 20") && /absent/.test(ex.diagnostic ?? ""));
});

await t("LG-02/SC2 réception du document : satisfait, preuve = id de la pièce", async () => {
  const svc = dossier({ risk: "MEDIUM",
    docs: [{ id: "D1", tenantId: T, kycFileId: "K1", clientId: "C1", nom: "FORMULAIRE_T", statut: "ACTIF", expireAt: null }] });
  const { ledger } = await svc.ledger(ctx, "K1", PROFILS, NOW);
  const s = ledger.statuts().find((x) => x.id === "REQ-DOC-T")!;
  assert.deepEqual({ satisfied: s.satisfied, satisfiedBy: s.satisfiedBy }, { satisfied: true, satisfiedBy: "D1" });
});

await t("LG-03/SC2bis pièce EXPIRÉE ≠ absente : non satisfait avec le diagnostic exact", async () => {
  const svc = dossier({ risk: "MEDIUM",
    docs: [{ id: "D1", tenantId: T, kycFileId: "K1", nom: "FORMULAIRE_T", statut: "ACTIF", expireAt: "2026-01-01T00:00:00Z" }] });
  const { ledger } = await svc.ledger(ctx, "K1", PROFILS, NOW);
  const s = ledger.statuts().find((x) => x.id === "REQ-DOC-T")!;
  assert.equal(s.satisfied, false);
  assert.ok(/EXPIRÉ/.test(s.derivedBy ?? ""));
});

await t("LG-04/SC3 activation conditionnelle : EDD inactif sans PEP, actif (et manquant) avec settlor PEP", async () => {
  const sans = await dossier({ risk: "MEDIUM", pep: false }).ledger(ctx, "K1", PROFILS, NOW);
  assert.ok(!sans.ledger.statuts().some((s) => s.id === "REQ-EDD-PEP"));       // ÉCARTÉ (when faux)
  assert.equal(sans.ledger.explain("REQ-EDD-PEP").actif, false);
  const avec = await dossier({ risk: "MEDIUM", pep: true }).ledger(ctx, "K1", PROFILS, NOW);
  const s = avec.ledger.statuts().find((x) => x.id === "REQ-EDD-PEP")!;
  assert.equal(s.satisfied, false);                                            // actif ET manquant
});

await t("LG-05/SC3bis approval : visa CO SIGNED/OK satisfait ; NOK ou mauvais rôle jamais (R86)", async () => {
  const ok = await dossier({ visas: [{ id: "V1", kycFileId: "K1", sectionCode: "FINAL",
    requiredRole: "CO", status: "SIGNED", verdict: "OK", signedBy: "co-1" }] }).ledger(ctx, "K1", PROFILS, NOW);
  const sOk = ok.ledger.statuts().find((x) => x.id === "REQ-VISA-CO")!;
  assert.deepEqual({ satisfied: sOk.satisfied, satisfiedBy: sOk.satisfiedBy }, { satisfied: true, satisfiedBy: "V1" });
  const nok = await dossier({ visas: [{ id: "V2", kycFileId: "K1", sectionCode: "FINAL",
    requiredRole: "CO", status: "SIGNED", verdict: "NOK", signedBy: "co-1" }] }).ledger(ctx, "K1", PROFILS, NOW);
  assert.equal(nok.ledger.statuts().find((x) => x.id === "REQ-VISA-CO")!.satisfied, false);
  const mauvaisRole = await dossier({ visas: [{ id: "V3", kycFileId: "K1", sectionCode: "FINAL",
    requiredRole: "RM", status: "SIGNED", verdict: "OK", signedBy: "rm-1" }] }).ledger(ctx, "K1", PROFILS, NOW);
  assert.equal(mauvaisRole.ledger.statuts().find((x) => x.id === "REQ-VISA-CO")!.satisfied, false);
});

await t("LG-06/SC4 checks screening : hit BRUT → non satisfait ; tous QUALIFIE → satisfait ; 0 hit = vacuité", async () => {
  const brut = await dossier({ hits: [{ id: "H1", tenantId: T, clientId: "C1", statut: "BRUT" }] })
    .ledger(ctx, "K1", PROFILS, NOW);
  const sBrut = brut.ledger.statuts().find((x) => x.id === "REQ-CHECK-SCREEN")!;
  assert.equal(sBrut.satisfied, false);
  assert.ok(/non qualifié/.test(sBrut.derivedBy ?? ""));
  const ok = await dossier({ hits: [{ id: "H1", tenantId: T, clientId: "C1", statut: "QUALIFIE" },
    { id: "H2", tenantId: T, clientId: "C1", statut: "QUALIFIE" }] }).ledger(ctx, "K1", PROFILS, NOW);
  assert.equal(ok.ledger.statuts().find((x) => x.id === "REQ-CHECK-SCREEN")!.satisfied, true);
  const zero = await dossier({}).ledger(ctx, "K1", PROFILS, NOW);
  const sZero = zero.ledger.statuts().find((x) => x.id === "REQ-CHECK-SCREEN")!;
  assert.equal(sZero.satisfied, true);
  assert.ok(/vacuité/.test(sZero.derivedBy ?? ""));
});

await t("LG-07 data + explain d'un requirement inconnu", async () => {
  const { ledger } = await dossier({}).ledger(ctx, "K1", PROFILS, NOW);
  assert.equal(ledger.statuts().find((x) => x.id === "REQ-DATA-JUR")!.satisfied, true);
  assert.deepEqual(ledger.explain("REQ-INEXISTANT"), { id: "REQ-INEXISTANT", connu: false });
});

await t("LG-08 critère de sortie : gap() < 1 s sur le dossier de fixtures", async () => {
  const svc = dossier({ pep: true, hits: [{ id: "H1", tenantId: T, clientId: "C1", statut: "BRUT" }] });
  const debut = Date.now();
  const { ledger } = await svc.ledger(ctx, "K1", PROFILS, NOW);
  const gap = ledger.gap();
  const duree = Date.now() - debut;
  assert.ok(gap.length >= 3, "le dossier chargé a des manques");
  assert.ok(duree < 1000, `gap en ${duree} ms — attendu < 1000 ms`);
  console.log(`    [LG-08] lecture + résolution + gap : ${duree} ms`);
});

console.log(`\n### ${passed}/${passed} specs ledger P-L7-3 verts ###`);
})().catch((e) => { console.error(e); process.exit(1); });
