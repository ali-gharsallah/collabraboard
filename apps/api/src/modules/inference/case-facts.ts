/**
 * P-L7-2 — PROTOCOL CaseFacts : la surface de faits que le DSL d'activation a le DROIT de voir.
 * C'est une interface de LECTURE (le CaseFactsReader de P-L7-3 la construira depuis les tables
 * d'état sous RLS) — le DSL ne connaît QUE ces attributs, whitelistés dans dsl.ts : tout autre
 * chemin est rejeté AU CHARGEMENT, jamais résolu dynamiquement (invariant 8 : pas d'eval).
 */

export type PersonneLiee = { role: string; pep: boolean; sanctioned: boolean };

export type CaseFacts = {
  entityType: string;                  // TRUST | FOUNDATION | INDIVIDUAL | COMPANY…
  jurisdiction: string;                // ISO-2
  riskLevel: string;                   // LOW | MEDIUM | HIGH | CRITICAL (échelle tenant)
  relatedPersons: PersonneLiee[];
  documents: string[];                 // codes de documents PRÉSENTS au dossier
  checks: string[];                    // codes de contrôles PASSÉS (hits qualifiés…)
};
