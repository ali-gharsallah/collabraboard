// Harnais P-L7-4 — TEST DE COHÉRENCE gardes ↔ ledger (CO-01..05). Sur un corpus de dossiers
// de fixtures, le verdict « validable » des gardes existantes (ÉQUIVALENT dry-run de
// kyc.service.validate() : visas requis du workflow SIGNED et ≠ NOK, aucun GELE —
// VISAS_BY_WORKFLOW importé du VRAI template, jamais recopié) et le verdict « gap vide » du
// ledger COÏNCIDENT — toute divergence doit être documentée dans MIGRATION_DIVERGENCES.md
// (le test échoue sur une divergence NON documentée : jamais de correction silencieuse).
import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VISAS_BY_WORKFLOW } from "../kyc/kyc.templates";
import { chargerProfils } from "./profils.loader";
import { CaseFactsReader } from "./case-facts.reader";
import { LedgerService } from "./ledger.service";

let passed = 0; const t = async (nom: string, fn: () => Promise<void> | void) => { await fn(); passed++; console.log("  ✓ " + nom); };

// Profil de cohérence : le miroir ÉVALUABLE du workflow EDD (approvals = VISAS_BY_WORKFLOW.EDD,
// générés depuis le template réel) + check screening + document à validité (R26).
const PROFILS = chargerProfils(`
profils:
  - profil: coherence-edd
    entityType: TRUST
    jurisdiction: "*"
    requirements:
${VISAS_BY_WORKFLOW.EDD.map((v, i) => `      - id: REQ-VISA-${v.sectionCode}
        kind: approval
        basis: "OBA-FINMA · R14/R15/R86 (miroir REQ-R${14 + i})"
        severity: bloquant
        params: { role: ${v.role}, section: ${v.sectionCode} }`).join("\n")}
      - id: REQ-CHECK-SCREEN
        kind: check
        basis: "LBA art. 6 · R46/R101 (miroir REQ-R46)"
        severity: bloquant
        params: { source: screening }
      - id: REQ-DOC-T
        kind: document
        basis: "CDB 20 art. 41 · R26 (miroir REQ-R26)"
        severity: bloquant
        params: { document: FORMULAIRE_T }
`);

const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) =>
  v && typeof v === "object" && "in" in v ? v.in.includes(row[k]) : row[k] === v);
const fake = (tables: Record<string, any[]>) => {
  const t2 = (n: string) => ({ findFirst: async ({ where }: any) => tables[n].find((r) => match(r, where)) ?? null,
    findMany: async ({ where }: any) => tables[n].filter((r) => match(r, where)) });
  return { kycFile: t2("kycFile"), client: t2("client"), personneLien: t2("personneLien"),
    person: t2("person"), document: t2("document"), kycVisa: t2("kycVisa"), screeningHit: t2("screeningHit") } as any;
};

const T = "22222222-2222-4222-8222-222222222222"; const ctx = { tenantId: T };
const NOW = new Date("2026-08-07T12:00:00Z");
const visaOk = (s: { sectionCode: string; role: string }, i: number) =>
  ({ id: `V${i}`, kycFileId: "K1", sectionCode: s.sectionCode, requiredRole: s.role, status: "SIGNED", verdict: "OK", signedBy: "u" });
const DOC_OK = { id: "D1", tenantId: T, kycFileId: "K1", nom: "FORMULAIRE_T", statut: "ACTIF", expireAt: null };

// ── ÉQUIVALENT dry-run des gardes (documenté dans MIGRATION_DIVERGENCES.md, limites incluses) ──
const validable = (visas: any[]) =>
  VISAS_BY_WORKFLOW.EDD.every((req) => visas.some((v) => v.sectionCode === req.sectionCode &&
    v.requiredRole === req.role && v.status === "SIGNED" && v.verdict !== "NOK")) &&
  visas.every((v) => v.status !== "GELE");

// Corpus : cas → {visas, docs, hits, divergenceAttendue?}
const CORPUS: Record<string, { visas: any[]; docs: any[]; hits: any[]; divergence?: string }> = {
  "A-complet": { visas: VISAS_BY_WORKFLOW.EDD.map(visaOk), docs: [DOC_OK], hits: [] },
  "B-visa-manquant": { visas: VISAS_BY_WORKFLOW.EDD.slice(0, 2).map(visaOk), docs: [DOC_OK], hits: [] },
  "C-visa-nok": { visas: [ { ...visaOk(VISAS_BY_WORKFLOW.EDD[0], 0), verdict: "NOK" },
    ...VISAS_BY_WORKFLOW.EDD.slice(1).map((s, i) => visaOk(s, i + 1))], docs: [DOC_OK], hits: [] },
  "D-doc-expire": { visas: VISAS_BY_WORKFLOW.EDD.map(visaOk),
    docs: [{ ...DOC_OK, expireAt: "2026-01-01T00:00:00Z" }], hits: [], divergence: "DIV-1" },
  "E-hit-brut": { visas: VISAS_BY_WORKFLOW.EDD.map(visaOk), docs: [DOC_OK],
    hits: [{ id: "H1", tenantId: T, clientId: "C1", statut: "BRUT" }], divergence: "DIV-2" },
};

async function verdicts(cas: (typeof CORPUS)[string]) {
  const svc = new LedgerService(new CaseFactsReader(fake({
    kycFile: [{ id: "K1", tenantId: T, clientId: "C1", code: "KYC-1", countryCode: "CH", riskLevel: "HIGH" }],
    client: [{ id: "C1", tenantId: T, name: "Trust", structure: "TRUST", country: "CH" }],
    personneLien: [], person: [], document: cas.docs, kycVisa: cas.visas, screeningHit: cas.hits }) as any));
  const { ledger } = await svc.ledger(ctx, "K1", PROFILS, NOW);
  return { gardes: validable(cas.visas), ledger: ledger.gap().length === 0 };
}

(async () => {
console.log("Inférence P-L7-4 — cohérence gardes ↔ ledger (CO) :");
const DIVERGENCES_MD = readFileSync(join(process.cwd(), "..", "..", "MIGRATION_DIVERGENCES.md"), "utf8");

await t("CO-01 concordance nominale : dossier complet → validable ET gap vide", async () => {
  assert.deepEqual(await verdicts(CORPUS["A-complet"]), { gardes: true, ledger: true });
});

await t("CO-02 concordance sur manque de visa : les deux refusent (manquant ET NOK)", async () => {
  assert.deepEqual(await verdicts(CORPUS["B-visa-manquant"]), { gardes: false, ledger: false });
  assert.deepEqual(await verdicts(CORPUS["C-visa-nok"]), { gardes: false, ledger: false });
});

await t("CO-03 divergences OBSERVÉES = divergences DOCUMENTÉES, ni plus ni moins", async () => {
  const observees: string[] = [];
  for (const [nom, cas] of Object.entries(CORPUS)) {
    const v = await verdicts(cas);
    const diverge = v.gardes !== v.ledger;
    if (diverge) {
      assert.ok(cas.divergence, `divergence NON ATTENDUE sur « ${nom} » — à documenter dans MIGRATION_DIVERGENCES.md, jamais corriger en silence`);
      observees.push(cas.divergence!);
    } else {
      assert.ok(!cas.divergence, `divergence attendue (${cas.divergence}) sur « ${nom} » mais NON observée — MIGRATION_DIVERGENCES.md est périmé`);
    }
  }
  assert.deepEqual(observees.sort(), ["DIV-1", "DIV-2"]);
  for (const div of observees)
    assert.ok(DIVERGENCES_MD.includes(`## ${div} `), `${div} absent de MIGRATION_DIVERGENCES.md`);
});

await t("CO-04 le miroir généré est FIDÈLE : 50 règles reformulables, basis repris de l'inventaire", async () => {
  const miroir = readFileSync(join(process.cwd(), "src", "modules", "inference", "miroir-regles.gen.yaml"), "utf8");
  assert.equal((miroir.match(/^ {2}- id: REQ-R\d+$/gm) ?? []).length, 50);
  assert.ok(miroir.includes('basis: "LBA art. 8 / CDB 20 (contrôle nommé)"'));   // R2, repris verbatim
  assert.ok(miroir.includes("R1–R51 inchangées"));
});

await t("CO-05 R1–R51 INCHANGÉES : le miroir cite l'inventaire, aucun fichier de garde modifié par le module", async () => {
  // Le module inference n'importe AUCUN module de gardes en écriture — kyc.templates est la
  // SEULE lecture (constantes de workflow), et uniquement depuis CE spec de cohérence.
  const src = ["types", "profils.loader", "profils.resolver", "dsl", "case-facts", "case-facts.reader",
    "requirement-ledger", "ledger.service", "inference.module"]
    .map((f) => readFileSync(join(process.cwd(), "src", "modules", "inference", `${f}.ts`), "utf8")).join("\n");
  assert.ok(!/from "\.\.\/kyc\//.test(src), "le module inference ne dépend pas des gardes");
});

console.log(`\n### ${passed}/${passed} specs cohérence P-L7-4 verts ###`);
})().catch((e) => { console.error(e); process.exit(1); });
