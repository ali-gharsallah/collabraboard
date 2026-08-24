/**
 * P-L7-1 (la spec v2 §7 — design adapté ; contenu : v1.1 §6) — MODÈLE Requirements du module A.
 * Un Requirement est une EXIGENCE déclarative (jamais un effet) : le ledger (P-L7-3) LIRA l'état
 * du dossier et dira si elle est satisfaite ; les gardes R1–R51 restent actives et inchangées
 * (le ledger est une VUE — CLAUDE.md invariant 4). `basis` porte la base légale AFFICHABLE
 * (CDB 20, LBA, OBA-FINMA…) reprise de docs/audit/RULES_INVENTORY.md au miroir (P-L7-4).
 */

export const KINDS_REQUIREMENT = ["data", "document", "check", "approval"] as const;
export type KindRequirement = (typeof KINDS_REQUIREMENT)[number];

export const SEVERITES = ["bloquant", "non_bloquant"] as const;
export type Severite = (typeof SEVERITES)[number];

export type Requirement = {
  id: string;                          // ex. REQ-T-01 (unique dans le profil)
  kind: KindRequirement;
  basis: string;                       // base légale / règle source (ex. « CDB 20 art. 41 · R26 »)
  severity: Severite;
  params: Record<string, unknown>;     // paramètres du kind (ex. { document: "FORMULAIRE_T", validiteJours: 365 })
  /** activation_rules — expression du DSL sûr (P-L7-2). Acceptée ICI comme chaîne opaque ;
   *  compilée et validée AU CHARGEMENT dès que l'évaluateur existe. Absente = toujours actif. */
  when?: string;
};

export type CompletionProfile = {
  profil: string;                      // identifiant lisible (ex. trust-ch)
  entityType: string;                  // TRUST | FOUNDATION | INDIVIDUAL | COMPANY…
  jurisdiction: string;                // ISO-2 ou "*" (profil de repli)
  requirements: Requirement[];
};

export type RequirementStatus = {
  id: string;
  satisfied: boolean;
  satisfiedBy?: string;                // la preuve : id de document, de visa, de hit qualifié…
  derivedBy?: string;                  // le chemin d'inférence (règle/lecture) qui a conclu
};
