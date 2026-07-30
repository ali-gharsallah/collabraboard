// Source : docs/reference/olive-demo.html 20984–21063 — porté verbatim.
// Constantes, helpers et seed OFFBOARDING_CASES de l'Intelligent Offboarding.
import CLIENTS from "../fixtures/CLIENTS.json";
import KYCS_DATA from "../fixtures/KYCS_DATA.json";
import ACCOUNT_REVIEWS_DATA from "../fixtures/ACCOUNT_REVIEWS_DATA.json";

// CONSIGNÉ — sources hors périmètre parité (non portées, cf. aml.ts) → tableaux vides :
//  · AML_ALERTS (alertes AML) : identique à aml.ts (non extrait en fixture) ⇒ aucun blocage AML.
//  · REPORTING_DATA (déclarations SAR/MROS) : source SAR non portée ⇒ aucun blocage SAR.
// À compléter au portage AML / MROS. Le Compliance Health Check reste piloté par ACCOUNT_REVIEWS_DATA
// (non clôturées) et par les hits de screening du KYC — donc réellement calculé, pas figé.
const AML_ALERTS: any[] = [];
const REPORTING_DATA: any[] = [];

export const ROLE_LABELS: Record<string, string> = { RM: "Relationship Manager", ARM: "Assistant RM", CO: "Compliance Officer", CO_SR: "Compliance Officer Senior", AML: "Analyste AML", MLRO: "MLRO", BRM: "Business Risk Manager", ESG: "ESG Officer", LEGAL: "Legal", CF: "Central File", HPB: "Head of Private Banking", DIR: "Direction", CEO: "CEO", ADMIN: "Administrateur", AUDIT: "Audit interne", SECU: "Security Officer", EDITOR: "Éditeur du logiciel (Olive)" };

export const OFFBOARDING_REASONS = [
  "Demande du client", "Décision de la banque", "Risque AML élevé", "Sanctions", "Décès",
  "Changement de stratégie", "Inactivité prolongée", "Clôture relation d'affaires", "Fusion / acquisition",
];
export const OFF_PP_CHECKLIST = ["Vérifier les soldes", "Clôturer les comptes", "Désactiver les accès eBanking", "Archiver les documents", "Informer le RM", "Valider la conformité", "Vérifier les obligations fiscales", "Envoyer la confirmation de clôture"];
export const OFF_CORP_CHECKLIST = ["Vérifier les UBO", "Vérifier les pouvoirs de signature", "Clôturer les comptes liés", "Vérifier les structures associées", "Contrôler les obligations CRS/FATCA", "Archiver les documents légaux"];
export function offChecklistFor(client: any) { return (client && client.type === "PP") ? OFF_PP_CHECKLIST : OFF_CORP_CHECKLIST; }

export const OFF_ROLE_SEQ = ["RM", "ARM", "CO", "CO_SR", "MLRO", "DIR", "ADMIN"];
const OFF_APPROVAL_CHAINS: Record<string, string[]> = { LOW: ["RM", "CO"], MEDIUM: ["RM", "CO", "CO_SR"], HIGH: ["RM", "CO", "MLRO", "DIR"] };
const OFF_REASON_FORCE: Record<string, string | null> = {
  "Demande du client": null, "Décision de la banque": null, "Risque AML élevé": "HIGH", "Sanctions": "HIGH",
  "Décès": null, "Changement de stratégie": null, "Inactivité prolongée": null,
  "Clôture relation d'affaires": null, "Fusion / acquisition": "MEDIUM",
};
const OFF_REASON_ROLES: Record<string, string[]> = {
  "Demande du client": ["RM", "ARM"], "Décision de la banque": ["CO", "CO_SR", "DIR"], "Risque AML élevé": ["CO", "CO_SR", "MLRO"],
  "Sanctions": ["MLRO", "DIR"], "Décès": ["RM", "ARM", "CO"], "Changement de stratégie": ["RM", "DIR"],
  "Inactivité prolongée": ["RM", "ARM"], "Clôture relation d'affaires": ["RM", "CO"], "Fusion / acquisition": ["DIR", "ADMIN"],
};
export function offRoleLabel(code: string) { return ROLE_LABELS[code] || code; }
export function offApprovalChain(riskLevel: string, reason?: string): [string, string][] {
  const forced = reason ? OFF_REASON_FORCE[reason] : null;
  const level = forced || riskLevel || "LOW";
  const roles = OFF_APPROVAL_CHAINS[level] || OFF_APPROVAL_CHAINS.LOW;
  return roles.map(function (r) { return [r, r === "RM" ? "Demande RM" : offRoleLabel(r)] as [string, string]; });
}
export function offCanInitiate(role: string, reason: string) {
  const allowed = OFF_REASON_ROLES[reason];
  return !allowed || role === "ADMIN" || allowed.indexOf(role) >= 0;
}
// -- Compliance Health Check : calcule réellement les blocages depuis les données liées (AR, AML, screening) --
export function offHealthCheck(client: any, kyc: any) {
  const blockers: string[] = [];
  const openAr = (ACCOUNT_REVIEWS_DATA as any[]).filter(function (a) { return a.clientId === (client && client.id) && a.status !== "COMPLETED"; });
  if (openAr.length)
    blockers.push(openAr.length + " Account Review(s) non clôturée(s) (" + openAr.map(function (a) { return a.trigger; }).join(", ") + ")");
  const openAlerts = (AML_ALERTS as any[]).filter(function (a) { return a.clientId === (client && client.id) && a.status === "NEW"; });
  if (openAlerts.length)
    blockers.push(openAlerts.length + " alerte(s) AML en cours d'investigation (" + openAlerts.map(function (a) { return a.alertLabel; }).join(", ") + ")");
  const scr = (kyc && kyc.screening) || {};
  const scrHit = ["ofac", "seco", "pep", "adverse"].filter(function (k) { return scr[k] === "HIT"; });
  if (scrHit.length)
    blockers.push("Hit(s) screening non levé(s) : " + scrHit.join(", ").toUpperCase());
  const sarPending = REPORTING_DATA.some(function (r) { return r.type.indexOf("SAR") >= 0 && r.subject.indexOf((client && client.name) || "###") >= 0 && r.status !== "TRANSMIS"; });
  if (sarPending)
    blockers.push("Déclaration SAR/MROS en attente de transmission");
  const canProceed = blockers.length === 0;
  const narrative = canProceed
    ? "Le client a demandé la clôture de la relation. Tous les comptes présentent un solde nul. Aucun prêt, mandat ou litige n'est en cours. Une revue AML récente est conforme. Aucun obstacle réglementaire identifié. L'offboarding peut être validé."
    : "Offboarding bloqué : " + blockers.join(" · ") + ".";
  return { blockers, canProceed, narrative };
}
export function offStepsFor(checklistDone: any[], approvalsDone: any) {
  const pct = function (arr: any[]) { return arr.length ? Math.round(arr.filter(Boolean).length / arr.length * 100) : 100; };
  return [
    { label: "Comptes clôturés", pct: checklistDone[0] ? 100 : 0 },
    { label: "Accès désactivés", pct: checklistDone[1] ? 100 : (checklistDone[2] ? 100 : 0) },
    { label: "KYC archivé", pct: approvalsDone ? 100 : 0 },
    { label: "Documents archivés", pct: checklistDone[3] ? 100 : 0 },
    { label: "Obligations fiscales", pct: (checklistDone[6] !== undefined ? (checklistDone[6] ? 100 : 0) : 100) },
    { label: "Approbations", pct: pct(approvalsDone) },
  ];
}

// -- Cases seed : références des clients réels ; le health check est recalculé en direct. --
// Source : OFFBOARDING_CASES = (function(){ var picks = [...]; return picks.map(...).filter(Boolean); })()
export const OFFBOARDING_CASES: any[] = (function () {
  const picks = [
    ["CLI-00072", "Risque AML élevé"], ["CLI-00034", "Sanctions"], ["CLI-00043", "Décision de la banque"],
    ["CLI-00099", "Inactivité prolongée"], ["CLI-00003", "Demande du client"], ["CLI-00018", "Clôture relation d'affaires"],
    ["CLI-00164", "Changement de stratégie"], ["CLI-00193", "Fusion / acquisition"], ["CLI-00048", "Demande du client"],
    ["CLI-00083", "Décision de la banque"],
  ];
  return picks.map(function (p, i) {
    const c = (CLIENTS as any[]).find(function (x) { return x.id === p[0]; });
    if (!c) return null;
    return { id: "OFF-" + String(1001 + i), clientId: c.id, reason: p[1], initiatedAt: "2026-0" + (3 + (i % 4)) + "-1" + (i % 9), initiatedBy: i % 2 ? "RM" : "Compliance",
      checklistState: OFF_CORP_CHECKLIST.concat(OFF_PP_CHECKLIST).map(function () { return false; }), approvalIdx: 0, status: "EN_COURS" };
  }).filter(Boolean);
})();

// KYCS_DATA réexporté pour l'écran (sélection du dernier KYC par client).
export { KYCS_DATA };
