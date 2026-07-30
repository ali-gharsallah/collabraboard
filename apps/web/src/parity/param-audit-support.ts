// Source : docs/reference/olive-demo.html 18057–18062 — piste d'audit paramétrage partagée.
export const PARAM_AUDIT: any[] = [
  { at: "02.07.2026 14:12", by: "K. Weber (ADMIN)", what: "Seuil scénario AML-03 modifié : 50'000 → 45'000 CHF" },
  { at: "28.06.2026 09:40", by: "I. Vernet (CO_SR)", what: "Règle R3 (Formulaire K) activée pour structure FO" },
  { at: "21.06.2026 16:05", by: "K. Weber (ADMIN)", what: "Ajout type de mandat « Mandat hybride »" },
];
export function pushParamAudit(by: string, what: string) { PARAM_AUDIT.unshift({ at: "à l'instant", by: by || "Utilisateur", what }); }
