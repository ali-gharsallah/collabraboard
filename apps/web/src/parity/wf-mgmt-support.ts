// Source : docs/reference/olive-demo.html 15399–15496 — Workflow Management (templates + steps).
import CLIENTS from "../fixtures/CLIENTS.json";
import PROSPECTS_DATA from "../fixtures/PROSPECTS_DATA.json";
import ACCOUNT_REVIEWS_DATA from "../fixtures/ACCOUNT_REVIEWS_DATA.json";
import { OFFBOARDING_CASES } from "./offboarding-support";
import { clientById } from "./components-data";
import { pushParamAudit } from "./param-audit-support";

const wfEmit = (_t: string, _d: any, _p: any) => {};

export function wfStep(name: string, owner: string, validator: string | null, slaDays: number, visa: boolean, approvalType?: string, desc?: string): any {
  return { name, description: desc || name, owner, validator, backupValidator: null, slaDays, visaRequired: visa, approvalType: approvalType || "Single Approval", requiredDocuments: [], requiredChecks: [], escalationRule: "Après " + slaDays + "j sans action → " + validator, commentsRequired: false };
}
export const WF_MGMT_TEMPLATES: any[] = [
  { code: "SOW", label: "Simple Onboarding Workflow", category: "ONBOARDING", riskTier: "LOW", version: "v1", active: true, steps: [wfStep("Création dossier", "RM", null, 1, false, "Single Approval"), wfStep("Collecte KYC", "RM", null, 5, false, "Single Approval"), wfStep("Revue Compliance", "CO", "CO", 3, true, "Single Approval"), wfStep("Approbation finale", "CO_SR", "CO_SR", 2, true, "Single Approval")] },
  { code: "HOW", label: "High Risk Onboarding Workflow", category: "ONBOARDING", riskTier: "HIGH", version: "v1", active: true, steps: [wfStep("Création dossier", "RM", null, 1, false, "Single Approval"), wfStep("Collecte KYC renforcée (EDD)", "RM", null, 7, false, "Single Approval"), wfStep("Revue Compliance", "CO", "CO", 3, true, "Single Approval"), wfStep("Revue Risk", "BRM", "BRM", 3, true, "Single Approval"), wfStep("Comité de validation", "DIR", "DIR", 3, true, "Committee Approval")] },
  { code: "POW", label: "PEP Onboarding Workflow", category: "ONBOARDING", riskTier: "PEP", version: "v1", active: true, steps: [wfStep("Création dossier", "RM", null, 1, false, "Single Approval"), wfStep("Collecte KYC + déclaration PEP", "RM", null, 7, false, "Single Approval"), wfStep("Revue Compliance renforcée", "CO_SR", "CO_SR", 3, true, "Dual Approval"), wfStep("Validation MLRO", "MLRO", "MLRO", 3, true, "Single Approval"), wfStep("Comité de validation", "DIR", "DIR", 3, true, "Committee Approval")] },
  { code: "SKW", label: "Simple KYC Workflow", category: "PERPETUAL", riskTier: "LOW", version: "v1", active: true, steps: [wfStep("Déclenchement", "SYSTEM", null, 0, false, "Single Approval"), wfStep("Mise à jour RM", "RM", null, 7, false, "Single Approval"), wfStep("Revue Compliance", "CO", "CO", 3, true, "Single Approval")] },
  { code: "HKW", label: "High Risk KYC Workflow", category: "PERPETUAL", riskTier: "HIGH", version: "v1", active: true, steps: [wfStep("Déclenchement", "SYSTEM", null, 0, false, "Single Approval"), wfStep("Mise à jour RM renforcée", "RM", null, 7, false, "Single Approval"), wfStep("Revue Compliance", "CO_SR", "CO_SR", 5, true, "Dual Approval"), wfStep("Validation Risk", "BRM", "BRM", 3, true, "Single Approval")] },
  { code: "PKW", label: "PEP KYC Workflow", category: "PERPETUAL", riskTier: "PEP", version: "v1", active: true, steps: [wfStep("Déclenchement", "SYSTEM", null, 0, false, "Single Approval"), wfStep("Mise à jour RM", "RM", null, 7, false, "Single Approval"), wfStep("Revue Compliance renforcée", "CO_SR", "CO_SR", 5, true, "Dual Approval"), wfStep("Validation MLRO", "MLRO", "MLRO", 3, true, "Single Approval")] },
  { code: "OFW", label: "Offboarding Workflow", category: "OFFBOARDING", riskTier: null, version: "v1", active: true, steps: [wfStep("Initiation fermeture relation", "RM", null, 1, false, "Single Approval"), wfStep("Analyse Compliance", "CO", "CO", 3, true, "Single Approval"), wfStep("Validation métier", "RM", null, 2, false, "Single Approval"), wfStep("Validation Compliance", "CO_SR", "CO_SR", 2, true, "Single Approval"), wfStep("Archivage documentaire", "RM", null, 3, false, "Single Approval"), wfStep("Clôture relation", "DIR", "DIR", 1, true, "Single Approval")] },
  { code: "BTW", label: "Business Trip Validation Workflow", category: "BUSINESS_TRIP", riskTier: null, version: "v1", active: true, steps: [wfStep("Création demande RM", "RM", null, 1, false, "Single Approval"), wfStep("Vérification cross-border", "CO", null, 2, false, "Single Approval"), wfStep("Validation Compliance", "CO", "CO", 2, true, "Single Approval"), wfStep("Validation Manager", "DIR", "DIR", 1, true, "Single Approval"), wfStep("Décision finale", "DIR", "DIR", 1, true, "Single Approval")] },
  { code: "SAW", label: "Simple Account Review Workflow", category: "ACCOUNT_REVIEW", riskTier: "LOW", version: "v1", active: true, steps: [wfStep("Déclencheur", "SYSTEM", null, 0, false, "Single Approval"), wfStep("Mise à jour RM", "RM", null, 5, false, "Single Approval"), wfStep("Revue Compliance", "CO", "CO", 3, true, "Single Approval")] },
  { code: "HAW", label: "High Risk Account Review Workflow", category: "ACCOUNT_REVIEW", riskTier: "HIGH", version: "v1", active: true, steps: [wfStep("Déclencheur", "SYSTEM", null, 0, false, "Single Approval"), wfStep("Mise à jour RM renforcée", "RM", null, 7, false, "Single Approval"), wfStep("Revue Compliance", "CO_SR", "CO_SR", 4, true, "Dual Approval"), wfStep("Validation Risk", "BRM", "BRM", 3, true, "Single Approval")] },
  { code: "PAW", label: "PEP Account Review Workflow", category: "ACCOUNT_REVIEW", riskTier: "PEP", version: "v1", active: true, steps: [wfStep("Déclencheur", "SYSTEM", null, 0, false, "Single Approval"), wfStep("Mise à jour RM", "RM", null, 7, false, "Single Approval"), wfStep("Revue Compliance renforcée", "CO_SR", "CO_SR", 4, true, "Dual Approval"), wfStep("Validation MLRO", "MLRO", "MLRO", 3, true, "Single Approval")] },
  { code: "GAW", label: "Group Account Review Workflow", category: "GROUP_ACCOUNT_REVIEW", riskTier: null, version: "v1", active: true, steps: [wfStep("Identification du groupe (UBO commun)", "SYSTEM", null, 0, false, "Single Approval"), wfStep("Revue individuelle des membres", "RM", null, 7, false, "Single Approval"), wfStep("Consolidation du risque groupe", "CO", "CO", 3, true, "Single Approval"), wfStep("Validation groupe", "CO_SR", "CO_SR", 3, true, "Dual Approval")] },
];
export const WF_MGMT_CATEGORY_LABEL: any = { ONBOARDING: "Onboarding", PERPETUAL: "Perpetual KYC", OFFBOARDING: "Offboarding", BUSINESS_TRIP: "Business Trip", ACCOUNT_REVIEW: "Account Review", GROUP_ACCOUNT_REVIEW: "Group Account Review" };
export const WF_MGMT_APPLICABILITY: any = {};
WF_MGMT_TEMPLATES.forEach(function (t) { WF_MGMT_APPLICABILITY[t.code] = { bookingCenter: ["Zurich"], legalEntity: ["Banque Olive Suisse SA"], clientType: ["PP", "SA"], segment: ["HNWI", "UHNWI"], country: ["*"], riskLevel: [t.riskTier || "*"] }; });
export function wfMgmtTemplate(code: string) { return WF_MGMT_TEMPLATES.find(function (t) { return t.code === code; }); }
export function wfMgmtUpdateStep(code: string, idx: number, field: string, val: any) { const t = wfMgmtTemplate(code); t.steps[idx][field] = val; pushParamAudit("Admin", "Workflow " + code + " — étape \"" + t.steps[idx].name + "\" — " + field + " mis à jour"); wfEmit("PARAM_CHANGED", null, {}); }
export function wfMgmtAddStep(code: string, name: string, owner: string) { const t = wfMgmtTemplate(code); t.steps.push(wfStep(name || "Nouvelle étape", owner || "CO", owner || "CO", 3, false, "Single Approval")); pushParamAudit("Admin", "Workflow " + code + " — étape ajoutée : " + (name || "Nouvelle étape")); }
export function wfMgmtRemoveStep(code: string, idx: number) { const t = wfMgmtTemplate(code); const nm = t.steps[idx].name; t.steps.splice(idx, 1); pushParamAudit("Admin", "Workflow " + code + " — étape supprimée : " + nm); }
function clientGroupMembers(clientId: string) {
  const c = (clientById as any)[clientId];
  const key = c && c.uboName;
  if (!key) return [];
  return (CLIENTS as any[]).filter(function (x) { return x.uboName === key; });
}
export function wfMgmtInstanceCount(code: string) {
  const t = wfMgmtTemplate(code);
  if (!t) return 0;
  if (t.category === "ONBOARDING") return (PROSPECTS_DATA as any[]).filter(function (p) { return !p.entered && (t.riskTier === "PEP" ? false : t.riskTier === "HIGH" ? p.risk === "HIGH" : p.risk !== "HIGH"); }).length;
  if (t.category === "ACCOUNT_REVIEW") return (ACCOUNT_REVIEWS_DATA as any[]).filter(function (a) { return a.status !== "COMPLETED"; }).length / 3 | 0;
  if (t.category === "OFFBOARDING") return OFFBOARDING_CASES.filter(function (o) { return o.status === "EN_COURS"; }).length;
  if (t.category === "BUSINESS_TRIP") return 1;
  if (t.category === "GROUP_ACCOUNT_REVIEW") return (CLIENTS as any[]).filter(function (c) { return clientGroupMembers(c.id).length > 1; }).length;
  return 0;
}
