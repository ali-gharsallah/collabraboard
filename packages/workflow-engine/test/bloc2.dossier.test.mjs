// Bloc 2 — Cycle de vie du dossier. Scénarios D-01…D-09 (R16–R23), tests AVANT code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { WorkflowEngine } from "../src/engine.mjs";

function actif(cfg = {}) {
  const e = new WorkflowEngine({ tenantConfig: {
    suspensionRestrictions: { inflows: true, outflows: false, notifyClient: false },
    abandonSchedule: [30, 60, 90], ...cfg } });
  e.createDossier("DOS-1", {
    sections: [
      { id: "IDENT", label: "Identification", validator: "V1" },
      { id: "FISC",  label: "Fiscalité",      validator: "V2" } ],
    finalValidator: "VF", personId: "P-100" });
  e.submitForVisa("DOS-1", "IDENT"); e.grantVisa("V1", "DOS-1", "IDENT");
  e.submitForVisa("DOS-1", "FISC");  e.grantVisa("V2", "DOS-1", "FISC");
  e.grantVisa("VF", "DOS-1", "__FINAL__", "", { engagement: true });
  assert.equal(e.dossierState("DOS-1"), "ACTIF");
  return e;
}

test("D-01 (R16, R17) — passage en Suspendu sur alerte non résolue", () => {
  const e = actif();
  e.attachScreeningAlert("DOS-1", { id: "AL-1", resolved: false });
  assert.equal(e.dossierState("DOS-1"), "SUSPENDU");
  assert.deepEqual(e.restrictions("DOS-1"),
    { inflows: true, outflows: false, notifyClient: false });
});

test("D-02 (R17) — suspension discrète type MROS : entrées oui, sorties non, client jamais notifié", () => {
  const e = actif();
  e.suspendForMros("DOS-1");
  assert.equal(e.operationAllowed("DOS-1", "IN"), true);
  assert.equal(e.operationAllowed("DOS-1", "OUT"), false);
  assert.ok(!e.alerts().some(a => a.to === "CLIENT"),
    "aucune notification client (art. 9a LBA)");
});

test("D-03 (R18) — rejet puis détection du retour du même prospect", () => {
  const e = new WorkflowEngine({});
  e.createDossier("DOS-A", { sections: [{ id: "IDENT", label: "Identification", validator: "V1" }],
    finalValidator: "VF", personId: "P-77" });
  e.reject("DOS-A", "Origine des fonds non plausible");
  assert.equal(e.dossierState("DOS-A"), "REJETE");
  e.createDossier("DOS-B", { sections: [{ id: "IDENT", label: "Identification", validator: "V1" }],
    finalValidator: "VF", personId: "P-77" });
  const al = e.alerts().find(a => a.type === "PROSPECT_REFUSE_RETOUR");
  assert.ok(al, "correspondance signalée avec la liste des prospects refusés");
  assert.equal(al.to, "CO");
  assert.match(al.motifInitial, /Origine des fonds non plausible/);
});

test("D-04 (R19) — abandon progressif 30/60/90 puis réactivation", () => {
  const e = new WorkflowEngine({ tenantConfig: { abandonSchedule: [30, 60, 90] } });
  e.createDossier("DOS-1", { sections: [{ id: "IDENT", label: "Identification", validator: "V1" }],
    finalValidator: "VF", personId: "P-1" });
  e.advanceDays(30); e.evalInactivity("DOS-1");
  assert.equal(e.alerts().filter(a => a.type === "RAPPEL_INACTIVITE" && a.to === "RM").length, 1);
  e.advanceDays(30); e.evalInactivity("DOS-1");
  assert.equal(e.alerts().filter(a => a.type === "RAPPEL_INACTIVITE").length, 2);
  e.advanceDays(30); e.evalInactivity("DOS-1");
  assert.equal(e.dossierState("DOS-1"), "ABANDONNE");
  e.reactivate("DOS-1");
  assert.equal(e.dossierState("DOS-1"), "EN_PREPARATION");
});

test("D-05 (R20) — conservation LBA prime sur effacement LPD, lecture seule, tracé", () => {
  const e = new WorkflowEngine({ tenantConfig: { abandonSchedule: [30, 60, 90] } });
  e.createDossier("DOS-1", { sections: [{ id: "IDENT", label: "Identification", validator: "V1" }],
    finalValidator: "VF", personId: "P-1" });
  e.editField("RM1", "DOS-1", "IDENT", "nom");         // diligences commencées
  e.advanceDays(95); e.evalInactivity("DOS-1");
  assert.equal(e.dossierState("DOS-1"), "ABANDONNE");
  const res = e.requestErasureLpd("DOS-1", "demande client");
  assert.equal(res.granted, false);
  assert.match(res.reason, /LBA.*10 ans/);
  assert.equal(e.d("DOS-1").readOnly, true);
  assert.ok(e.audit().some(a => a.type === "EFFACEMENT_LPD_REFUSE"));
});

test("D-06 (R21) — réouverture ciblée : Fiscalité seule, dossier En mise à jour, client opérationnel", () => {
  const e = actif();
  e.changeOfCircumstances("DOS-1", { sections: ["FISC"], risk: "MINEUR",
    detail: "changement de domicile fiscal" });
  assert.equal(e.section("DOS-1", "FISC").state, "EN_PREPARATION");
  assert.equal(e.section("DOS-1", "IDENT").state, "VISEE");
  assert.equal(e.dossierState("DOS-1"), "EN_MISE_A_JOUR");
  assert.equal(e.operationAllowed("DOS-1", "OUT"), true, "le client transige normalement");
});

test("D-07 (R21, R22) — changement à risque majeur : Suspendu + sections rouvertes + MLRO notifié", () => {
  const e = actif();
  e.changeOfCircumstances("DOS-1", { sections: ["IDENT"], risk: "MAJEUR",
    detail: "nouvel ADE domicilié pays sous sanctions" });
  assert.equal(e.dossierState("DOS-1"), "SUSPENDU");
  assert.equal(e.section("DOS-1", "IDENT").state, "EN_PREPARATION");
  assert.equal(e.operationAllowed("DOS-1", "OUT"), false);
  assert.ok(e.alerts().some(a => a.to === "MLRO" && a.type === "COC_RISQUE_MAJEUR"));
});

test("D-08 (R23) — collision : recertification en pause, événement prioritaire, trails distincts", () => {
  const e = actif();
  const recertId = e.startRecertification("DOS-1");
  assert.equal(e.process("DOS-1", recertId).status, "EN_COURS");
  const evtId = e.changeOfCircumstances("DOS-1", { sections: ["FISC"], risk: "MINEUR",
    detail: "CoC pendant recert" });
  assert.equal(e.process("DOS-1", recertId).status, "EN_PAUSE");
  assert.equal(e.dossierState("DOS-1"), "EN_MISE_A_JOUR");
  const trailRecert = e.processTrail("DOS-1", recertId);
  const trailEvt = e.processTrail("DOS-1", evtId);
  assert.ok(trailRecert.length > 0 && trailEvt.length > 0);
  assert.ok(!trailRecert.some(x => trailEvt.includes(x)), "audit trails propres à chaque process");
});

test("D-09 (R23) — absorption : la section revalidée par l'événement n'est pas re-soumise", () => {
  const e = actif();
  const recertId = e.startRecertification("DOS-1");
  const evtId = e.changeOfCircumstances("DOS-1", { sections: ["IDENT"], risk: "MINEUR",
    detail: "CoC identification" });
  // l'événement revalide la section IDENT
  e.editField("RM1", "DOS-1", "IDENT", "adresse", { processId: evtId });
  e.submitForVisa("DOS-1", "IDENT", { processId: evtId });
  e.grantVisa("V1", "DOS-1", "IDENT", "", { processId: evtId });
  e.closeEventProcess("DOS-1", evtId);
  // la recertification reprend
  assert.equal(e.process("DOS-1", recertId).status, "EN_COURS");
  assert.equal(e.visa("DOS-1", "IDENT").status, "ACCORDE", "pas re-soumise");
  const abs = e.process("DOS-1", recertId).absorbed;
  assert.ok(abs.some(x => x.sectionId === "IDENT" && x.visaProcess === evtId),
    "la recertification référence le visa issu du process événement");
});
