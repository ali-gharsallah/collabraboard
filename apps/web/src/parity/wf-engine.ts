// Moteur de workflow KYC — PORT VERBATIM (olive-demo.html : WF_DEFS 15316, wfAvailable 15358,
// wfCheckGuards 15365, wfHeadId 15500, KYC_PHASES 16183). Journal append-only : l'état = projection
// des transitions (event sourcing embarqué, miroir du backend workflow-engine).

export const KYC_PHASES = ["Saisie RM", "Revue Compliance", "Clarifications AML", "Validation comité", "Approbation finale"];

type WfTransition = { id: string; from: string; to: string; action: string; label: string; allowedRoles: string[]; guards: string[]; enabled: boolean; confirmText: string };
type WfDef = { id: string; version: number; label: string; subjectType: string; states: any[]; transitions: WfTransition[] };

export const WF_DEFS: WfDef[] = [
  {
    id: "KYC_STD", version: 3, label: "KYC — Standard (SDD/CDD/EDD)", subjectType: "KYC",
    states: [
      { id: "SAISIE", label: "Saisie RM", type: "start", ownerRole: "RM", slaHours: 72, visaRequired: false },
      { id: "COMPLIANCE", label: "Revue Compliance", type: "review", ownerRole: "CO", slaHours: 48, visaRequired: true, allowEarlyVisa: false },
      { id: "AML", label: "Clarifications AML", type: "review", ownerRole: "AML", slaHours: 48, visaRequired: true, allowEarlyVisa: false },
      { id: "COMITE", label: "Validation comité", type: "approval", ownerRole: "BRM", slaHours: 120, visaRequired: true, allowEarlyVisa: false },
      { id: "APPROBATION", label: "Approbation finale", type: "approval", ownerRole: "HPB", slaHours: 48, visaRequired: true, allowEarlyVisa: false },
      { id: "APPROVED", label: "Approuvé", type: "end", ownerRole: "", outcome: "approved", visaRequired: false },
      { id: "REJECTED", label: "Rejeté", type: "end", ownerRole: "", outcome: "rejected", visaRequired: false },
    ],
    transitions: [
      { id: "t1", from: "SAISIE", to: "COMPLIANCE", action: "validate", label: "Soumettre à la Compliance", allowedRoles: ["RM", "ARM"], guards: ["SECTIONS_COMPLETE"], enabled: true, confirmText: "" },
      { id: "t2", from: "COMPLIANCE", to: "AML", action: "validate", label: "Valider — vers AML", allowedRoles: ["CO", "CO_SR"], guards: ["FOUR_EYES"], enabled: true, confirmText: "" },
      { id: "t3", from: "COMPLIANCE", to: "SAISIE", action: "pushback", label: "Renvoyer au RM", allowedRoles: ["CO", "CO_SR"], guards: ["COMMENT_REQUIRED"], enabled: true, confirmText: "" },
      { id: "t10", from: "COMPLIANCE", to: "REJECTED", action: "reject", label: "Rejet — Compliance", allowedRoles: ["CO_SR"], guards: ["COMMENT_REQUIRED"], enabled: true, confirmText: "" },
      { id: "t4", from: "AML", to: "COMITE", action: "validate", label: "Lever — vers comité", allowedRoles: ["AML"], guards: ["FOUR_EYES", "SCREENING_CLEAR"], enabled: true, confirmText: "" },
      { id: "t5", from: "AML", to: "COMPLIANCE", action: "pushback", label: "Renvoyer à la Compliance", allowedRoles: ["AML"], guards: ["COMMENT_REQUIRED"], enabled: true, confirmText: "" },
      { id: "t6", from: "COMITE", to: "APPROBATION", action: "validate", label: "Avis favorable", allowedRoles: ["BRM"], guards: ["FOUR_EYES", "ROLE_SEGREGATION"], enabled: true, confirmText: "" },
      { id: "t7", from: "COMITE", to: "AML", action: "pushback", label: "Demande de clarification", allowedRoles: ["BRM"], guards: ["COMMENT_REQUIRED"], enabled: true, confirmText: "" },
      { id: "t11", from: "COMITE", to: "REJECTED", action: "reject", label: "Rejet — comité", allowedRoles: ["BRM"], guards: ["COMMENT_REQUIRED"], enabled: true, confirmText: "" },
      { id: "t8", from: "APPROBATION", to: "APPROVED", action: "validate", label: "Approbation finale", allowedRoles: ["HPB", "CEO", "DIR"], guards: ["FOUR_EYES"], enabled: true, confirmText: "" },
      { id: "t9", from: "APPROBATION", to: "REJECTED", action: "reject", label: "Rejet définitif", allowedRoles: ["HPB", "CEO", "DIR"], guards: ["COMMENT_REQUIRED"], enabled: true, confirmText: "" },
    ],
  },
];

export function wfAvailable(def: WfDef, inst: any, user: any): WfTransition[] {
  if (inst.status !== "RUNNING") return [];
  return def.transitions.filter(t => t.enabled && t.from === inst.state && (t.allowedRoles.length === 0 || t.allowedRoles.indexOf(user.role) >= 0));
}

export function wfCheckGuards(_def: WfDef, inst: any, t: WfTransition, user: any, comment: string, ctx: any): string[] {
  ctx = ctx || {};
  const fails: string[] = [];
  t.guards.forEach(g => {
    if (g === "COMMENT_REQUIRED" && !(comment && comment.trim())) fails.push("Un motif documenté est obligatoire (piste d'audit).");
    if (g === "FOUR_EYES") {
      const last = (inst.history || []).find((h: any) => h.action === "validate");
      const initiator = last ? last.by : inst.createdBy;
      if (initiator && initiator === user.name) fails.push("Principe des quatre yeux : " + user.name + " ne peut pas enchaîner deux validations.");
    }
    if (g === "ROLE_SEGREGATION") {
      const lf = (inst.history || []).find((h: any) => h.action === "validate");
      if (lf && lf.byRole === user.role) fails.push("Ségrégation : le rôle " + user.role + " vient déjà de valider l'étape précédente.");
    }
    if (g === "SECTIONS_COMPLETE" && ctx.sectionsComplete === false) fails.push("Sections requises incomplètes.");
    if (g === "SCREENING_CLEAR" && ctx.screeningClear === false) fails.push("Hits de screening non levés.");
  });
  return fails;
}

export const wfHeadId = (def: WfDef) => "WFH-" + def.id + "-v" + def.version;
