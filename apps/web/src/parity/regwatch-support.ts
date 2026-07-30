// Source : docs/reference/olive-demo.html 20623–20646 — porté verbatim.
// Veille réglementaire (FINMA/FATF/CDB) + analyse d'impact IA locale.
export const REG_WATCH: any[] = [
  { id: "RW-1", src: "FINMA", date: "2026-06-18", title: "Communication FINMA 05/2026 — attentes IA en gestion des risques", impact: "HIGH" },
  { id: "RW-2", src: "FATF", date: "2026-06-10", title: "Mise à jour listes juridictions grises — ajout 2 juridictions", impact: "HIGH" },
  { id: "RW-3", src: "CDB", date: "2026-05-30", title: "Circulaire d'interprétation CDB 20 — précision formulaire K sociétés de domicile", impact: "MEDIUM" },
  { id: "RW-4", src: "LSFin", date: "2026-05-12", title: "Précisions FINMA profilage investisseur — documentation renforcée", impact: "MEDIUM" },
  { id: "RW-5", src: "SECO", date: "2026-06-27", title: "Extension sanctions — 14 nouvelles entités listées", impact: "HIGH" },
];
export function regWatchAi(item: any): string {
  const base = item.impact === "HIGH" ? "Impact élevé — action requise sous 30 jours. " : "Impact modéré — à intégrer au prochain cycle de revue. ";
  const map: any = {
    "RW-1": "Analyse IA : vos 3 couches IA (workflow, SOF/SOW, AML) sont concernées. Points forts déjà en place : explicabilité par règles nommées, repli déterministe, journal d'audit. Action : documenter formellement la gouvernance des modèles (inventaire, seuils, surveillance).",
    "RW-2": "Analyse IA : 4 clients du portefeuille ont une exposition aux juridictions ajoutées. Action : re-screening ciblé + réévaluation du score (règle S4) — déclenchable depuis le module AML.",
    "RW-3": "Analyse IA : 12 dossiers KYC avec formulaire K à revalider selon la nouvelle interprétation. Action : campagne de revue ciblée via Account Review.",
    "RW-4": "Analyse IA : la section Mandat & portefeuilles (MAN-Q3) couvre le profil LSFin. Action : vérifier la présence du questionnaire signé sur les mandats discrétionnaires.",
    "RW-5": "Analyse IA : re-screening Levenshtein lancé sur la base clients+relations — 2 correspondances possibles à investiguer (module Screening).",
  };
  return base + (map[item.id] || "");
}
