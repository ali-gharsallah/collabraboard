// Bloc 1 — Cycle de vie du visa 4-yeux. Spécification exécutable :
// chaque test EST un scénario du catalogue v2 (V-01…V-17), écrit avant le moteur.
import { test } from "node:test";
import assert from "node:assert/strict";
import { WorkflowEngine } from "../src/engine.mjs";

function dossier(over = {}) {
  const e = new WorkflowEngine({ tenantConfig: { reminderMaxBeforeEscalade: 2 }, ...over });
  e.createDossier("DOS-1", {
    sections: [
      { id: "IDENT", label: "Identification", validator: "V1", relay: over.relayIdent },
      { id: "FISC",  label: "Fiscalité",      validator: "V2" },
    ],
    finalValidator: "VF",
  });
  return e;
}

test("V-01 (R1) — visas parallèles sur sections distinctes", () => {
  const e = dossier();
  e.submitForVisa("DOS-1", "IDENT"); e.submitForVisa("DOS-1", "FISC");
  e.grantVisa("V1", "DOS-1", "IDENT");
  assert.equal(e.visa("DOS-1", "IDENT").status, "ACCORDE");
  assert.equal(e.visa("DOS-1", "FISC").status, "EN_ATTENTE");
});

test("V-02 (R13) — exclusion 4-yeux au niveau section + tentative tracée", () => {
  const e = dossier({ });
  e.editField("U1", "DOS-1", "IDENT", "nom");
  e.submitForVisa("DOS-1", "IDENT");
  e.setValidator("DOS-1", "IDENT", "U1");            // U1 devient validateur nommé
  assert.throws(() => e.grantVisa("U1", "DOS-1", "IDENT"),
    /Principe 4-yeux : préparateur exclu de la validation de sa section/);
  assert.ok(e.audit().some(a => a.type === "VISA_TENTATIVE_REFUSEE" && a.actor === "U1"));
});

test("V-03 (R3, R13) — exclusion limitée à la section préparée", () => {
  const e = dossier();
  e.editField("U1", "DOS-1", "IDENT", "nom");
  e.setValidator("DOS-1", "FISC", "U1");
  e.submitForVisa("DOS-1", "FISC");
  e.grantVisa("U1", "DOS-1", "FISC");
  assert.equal(e.visa("DOS-1", "FISC").status, "ACCORDE");
  assert.ok(!e.audit().some(a => a.type === "VISA_TENTATIVE_REFUSEE"));
});

test("V-04 (R4) — relais en cas d'absence du validateur", () => {
  const e = dossier({ relayIdent: "V2R" });
  e.declareAbsent("V1");
  e.submitForVisa("DOS-1", "IDENT");
  assert.equal(e.visa("DOS-1", "IDENT").assignee, "V2R");
  e.grantVisa("V2R", "DOS-1", "IDENT");
  assert.ok(e.audit().some(a => a.type === "VISA_ACCORDE"
    && /relais V2R pour V1/.test(a.detail)));
});

test("V-05 (R4) — dérogation tracée sans relais", () => {
  const e = dossier();
  e.declareAbsent("V1");
  e.submitForVisa("DOS-1", "IDENT");
  e.grantVisaByDerogation("V3", "DOS-1", "IDENT",
    { decideur: "ProcessOwner-PO1", fichePoste: "FP-CO-2026" });
  const v = e.visa("DOS-1", "IDENT");
  assert.equal(v.status, "ACCORDE");
  assert.equal(v.derogation.fichePoste, "FP-CO-2026");
  assert.ok(e.audit().some(a => a.type === "DEROGATION"
    && a.actor === "ProcessOwner-PO1" && /FP-CO-2026/.test(a.detail)));
  assert.ok(v.mention.includes("sous dérogation"));
});

test("V-06 (R5) — deux rappels puis escalade", () => {
  const e = dossier();
  e.submitForVisa("DOS-1", "IDENT");
  e.tickReminder("DOS-1", "IDENT");
  e.tickReminder("DOS-1", "IDENT");
  assert.ok(e.audit().filter(a => a.type === "VISA_RAPPEL").length === 2);
  assert.ok(e.audit().some(a => a.type === "VISA_ESCALADE"));
});

test("V-07 (R5) — document expirant pendant l'attente ne bloque pas", () => {
  const e = dossier();
  e.attachDocument("DOS-1", "IDENT", { id: "PASS-1", validAtReception: true });
  e.submitForVisa("DOS-1", "IDENT");
  e.expireDocument("DOS-1", "PASS-1");
  e.grantVisa("V1", "DOS-1", "IDENT");                 // reste accordable
  assert.equal(e.visa("DOS-1", "IDENT").status, "ACCORDE");
  assert.ok(e.tasks().some(t => t.type === "COLLECTE_DOCUMENT" && t.ref === "PASS-1"));
});

test("V-08 (R6) — modification invalide le visa en attente", () => {
  const e = dossier();
  e.submitForVisa("DOS-1", "FISC");
  e.editField("U9", "DOS-1", "FISC", "tin");
  assert.equal(e.visa("DOS-1", "FISC").status, "INVALIDE");
  assert.ok(e.alerts().some(al => al.to === "V2" && al.type === "VISA_INVALIDE"));
  assert.equal(e.section("DOS-1", "FISC").state, "EN_PREPARATION");
});

test("V-09 (R10) — invalidation ciblée, les autres visas survivent", () => {
  const e = dossier();
  e.submitForVisa("DOS-1", "IDENT"); e.grantVisa("V1", "DOS-1", "IDENT");
  e.submitForVisa("DOS-1", "FISC");  e.grantVisa("V2", "DOS-1", "FISC");
  e.editField("U9", "DOS-1", "FISC", "tin");
  assert.equal(e.visa("DOS-1", "FISC").status, "INVALIDE");
  assert.equal(e.visa("DOS-1", "IDENT").status, "ACCORDE");
});

test("V-10 (R7) — refus sans motivation bloqué", () => {
  const e = dossier();
  e.submitForVisa("DOS-1", "IDENT");
  assert.throws(() => e.refuseVisa("V1", "DOS-1", "IDENT", ""),
    /motivation obligatoire/i);
  assert.equal(e.visa("DOS-1", "IDENT").status, "EN_ATTENTE");
});

test("V-11 (R7) — re-soumission adressée au même validateur", () => {
  const e = dossier();
  e.submitForVisa("DOS-1", "IDENT");
  e.refuseVisa("V1", "DOS-1", "IDENT", "Pièce illisible");
  assert.equal(e.section("DOS-1", "IDENT").state, "EN_PREPARATION");
  e.editField("PREP", "DOS-1", "IDENT", "piece");
  e.submitForVisa("DOS-1", "IDENT");
  assert.equal(e.visa("DOS-1", "IDENT").assignee, "V1");   // owner du client
});

test("V-12 (R7, R11) — départ du validateur : réassignation process owner, trace", () => {
  const e = dossier();
  e.submitForVisa("DOS-1", "IDENT");
  e.refuseVisa("V1", "DOS-1", "IDENT", "Adresse manquante");
  e.validatorLeft("V1");
  e.reassignValidator("ProcessOwner-PO1", "DOS-1", "IDENT", "V1bis");
  e.editField("PREP", "DOS-1", "IDENT", "adresse");
  e.submitForVisa("DOS-1", "IDENT");
  assert.equal(e.visa("DOS-1", "IDENT").assignee, "V1bis");
  assert.ok(e.audit().some(a => a.type === "VALIDATEUR_CHANGE"
    && a.actor === "ProcessOwner-PO1" && /V1 → V1bis/.test(a.detail)));
});

test("V-13 (R8) — pas d'expiration calendaire ; seule la recertification rouvre", () => {
  const e = dossier();
  e.submitForVisa("DOS-1", "IDENT"); e.grantVisa("V1", "DOS-1", "IDENT");
  e.advanceMonths(14);
  assert.equal(e.visa("DOS-1", "IDENT").status, "ACCORDE");
  e.openRecertification("DOS-1");
  assert.equal(e.section("DOS-1", "IDENT").state, "EN_PREPARATION");
});

test("V-14 (R9) — pas de révocation discrétionnaire", () => {
  const e = dossier();
  e.submitForVisa("DOS-1", "FISC"); e.grantVisa("V2", "DOS-1", "FISC");
  assert.throws(() => e.revokeVisa("V2", "DOS-1", "FISC"),
    /révocation discrétionnaire n'existe pas/);
  assert.equal(e.visa("DOS-1", "FISC").status, "ACCORDE");
});

test("V-15 (R12, R14) — annulation pour vice de process : conjoint + opRisk + trace", () => {
  const e = dossier();
  e.submitForVisa("DOS-1", "IDENT"); e.grantVisa("V1", "DOS-1", "IDENT");
  assert.throws(() => e.annulForProcessVice({ by: ["ProcessOwner-PO1"] },
    "DOS-1", "IDENT", "délégation expirée"), /conjointe/);
  e.annulForProcessVice({ by: ["ProcessOwner-PO1", "VF"] },
    "DOS-1", "IDENT", "délégation expirée");
  assert.equal(e.visa("DOS-1", "IDENT").status, "ANNULE");
  assert.ok(e.audit().some(a => a.type === "VISA_ANNULE" && /process non respecté/.test(a.detail)));
  assert.ok(e.incidents().some(i => i.type === "RISQUE_OPERATIONNEL"));
});

test("V-16 (R15) — validation finale = visa d'étape héritant de R1-R14", () => {
  const e = dossier();
  e.submitForVisa("DOS-1", "IDENT"); e.grantVisa("V1", "DOS-1", "IDENT");
  e.submitForVisa("DOS-1", "FISC");  e.grantVisa("V2", "DOS-1", "FISC");
  const fin = e.visa("DOS-1", "__FINAL__");
  assert.equal(fin.status, "EN_ATTENTE");                 // tâche créée automatiquement
  assert.equal(fin.assignee, "VF");
  // hérite de l'exclusion : si VF avait préparé une section, refus
  const e2 = dossier();
  e2.editField("VF", "DOS-1", "IDENT", "nom");
  e2.submitForVisa("DOS-1", "IDENT");
  e2.setValidator("DOS-1", "IDENT", "V1");
  e2.grantVisa("V1", "DOS-1", "IDENT");
  e2.submitForVisa("DOS-1", "FISC"); e2.grantVisa("V2", "DOS-1", "FISC");
  assert.throws(() => e2.grantVisa("VF", "DOS-1", "__FINAL__"), /4-yeux/);
});

test("V-17 (R6, R15) — modification invalide section ET validation finale", () => {
  const e = dossier();
  e.submitForVisa("DOS-1", "IDENT"); e.grantVisa("V1", "DOS-1", "IDENT");
  e.submitForVisa("DOS-1", "FISC");  e.grantVisa("V2", "DOS-1", "FISC");
  assert.equal(e.visa("DOS-1", "__FINAL__").status, "EN_ATTENTE");
  e.editField("U9", "DOS-1", "FISC", "tin");
  assert.equal(e.visa("DOS-1", "FISC").status, "INVALIDE");
  assert.equal(e.visa("DOS-1", "__FINAL__").status, "INVALIDE");
  assert.equal(e.dossierState("DOS-1"), "EN_PREPARATION");   // redescend
});

// --- R2 : la signature est réservée au validateur nommé (porté 12.07.2026)
test("R2 - un tiers non validateur ne peut pas accorder sans dérogation", () => {
  const e = dossier();
  e.editField("U1", "DOS-1", "IDENT", "domicile");
  e.submitForVisa("DOS-1", "IDENT");
  assert.throws(() => e.grantVisa("V9", "DOS-1", "IDENT"), /R2/);
  e.grantVisaByDerogation("V9", "DOS-1", "IDENT", { decideur: "PO1", fichePoste: "FP-CO" });
  assert.equal(e.visa("DOS-1", "IDENT").status, "ACCORDE");
});

// --- R14 : pop-up d'engagement obligatoire à la validation finale (porté 12.07.2026)
test("R14 - la finale exige l'engagement de responsabilité", () => {
  const e = dossier();
  e.editField("U1", "DOS-1", "IDENT", "x"); e.submitForVisa("DOS-1", "IDENT");
  e.grantVisa("V1", "DOS-1", "IDENT");
  e.editField("U2", "DOS-1", "FISC", "y"); e.submitForVisa("DOS-1", "FISC");
  e.grantVisa("V2", "DOS-1", "FISC");
  assert.throws(() => e.grantVisa("VF", "DOS-1", "__FINAL__"), /R14/);
  e.grantVisa("VF", "DOS-1", "__FINAL__", "", { engagement: true });
  assert.equal(e.visa("DOS-1", "__FINAL__").status, "ACCORDE");
  assert.ok(e.audit().some(x => x.type === "ENGAGEMENT_RESPONSABILITE"));
});

// --- R56 : règles tenant additionnelles — durcir oui, assouplir jamais (12.07.2026)
test("R56/RT-01 - une règle ajoutée est tracée et bloque, puis passe quand satisfaite", () => {
  const e = dossier();
  e.addTenantRule({ id: "RT-1", type: "minPreparateurs", params: { n: 2 },
    source: "manuel", justification: "anti dossier mono-main" });
  assert.ok(e.audit().some(x => x.type === "REGLE_TENANT_AJOUTEE"));
  e.editField("U1", "DOS-1", "IDENT", "a"); e.submitForVisa("DOS-1", "IDENT");
  assert.throws(() => e.grantVisa("V1", "DOS-1", "IDENT"), /RT-1/);
  e.editField("U2", "DOS-1", "IDENT", "b"); e.submitForVisa("DOS-1", "IDENT");
  e.grantVisa("V1", "DOS-1", "IDENT");
  assert.equal(e.visa("DOS-1", "IDENT").status, "ACCORDE");
});

test("R56/RT-02 - séquencement : FISC ne peut être visée qu'après IDENT", () => {
  const e = dossier();
  e.addTenantRule({ id: "RT-2", type: "sectionsPrealables",
    params: { section: "FISC", avant: "IDENT" }, source: "IA",
    justification: "refus CRS observé : séquencer" });
  e.editField("U2", "DOS-1", "FISC", "y"); e.submitForVisa("DOS-1", "FISC");
  assert.throws(() => e.grantVisa("V2", "DOS-1", "FISC"), /RT-2/);
  e.editField("U1", "DOS-1", "IDENT", "x"); e.submitForVisa("DOS-1", "IDENT");
  e.grantVisa("V1", "DOS-1", "IDENT");
  e.grantVisa("V2", "DOS-1", "FISC");                     // séquence respectée
});

test("R56/RT-03 - une règle tenant ne peut JAMAIS assouplir un invariant", () => {
  const e = dossier();
  assert.throws(() => e.addTenantRule({ id: "RT-X", type: "desactiverQuatreYeux" }),
    /durcir|inconnu/i);
  // et même avec des règles tenant actives, R13 tire toujours
  e.addTenantRule({ id: "RT-3", type: "motifRefusMin", params: { n: 15 }, source: "manuel" });
  e.editField("V1", "DOS-1", "IDENT", "x"); e.submitForVisa("DOS-1", "IDENT");
  assert.throws(() => e.grantVisa("V1", "DOS-1", "IDENT"), /4-yeux/);
});

test("R56/RT-04 - motifRefusMin durcit R7 ; désactivation tracée", () => {
  const e = dossier();
  e.addTenantRule({ id: "RT-4", type: "motifRefusMin", params: { n: 15 }, source: "manuel" });
  e.editField("U1", "DOS-1", "IDENT", "x"); e.submitForVisa("DOS-1", "IDENT");
  assert.throws(() => e.refuseVisa("V1", "DOS-1", "IDENT", "trop court"), /RT-4/);
  e.refuseVisa("V1", "DOS-1", "IDENT", "auto-certification CRS manquante");
  e.setTenantRuleActive("RT-4", false);
  assert.ok(e.audit().some(x => x.type === "REGLE_TENANT_DESACTIVEE"));
});
