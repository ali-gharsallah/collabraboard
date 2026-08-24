import { CompletionProfile } from "./types";

/**
 * P-L7-1 — RÉSOLVEUR de profil : (entityType, jurisdiction) → CompletionProfile.
 * Correspondance EXACTE d'abord, puis REPLI de juridiction sur le profil `jurisdiction: "*"`
 * du même entityType — jamais de repli d'entityType (un trust n'hérite pas du profil d'une
 * personne physique). Aucun profil applicable = ERREUR franche (un dossier sans profil n'a
 * pas d'exigences « par défaut » silencieuses). Fonction pure, aucun état module-global (C8).
 */

export class ProfilIntrouvable extends Error {
  constructor(entityType: string, jurisdiction: string) {
    super(`P-L7-1 : aucun CompletionProfile pour (${entityType}, ${jurisdiction}) — ni profil exact, ni repli « * »`);
  }
}

export function resoudreProfil(profils: CompletionProfile[],
  cible: { entityType: string; jurisdiction: string }): CompletionProfile {
  const exact = profils.find((p) => p.entityType === cible.entityType && p.jurisdiction === cible.jurisdiction);
  if (exact) return exact;
  const repli = profils.find((p) => p.entityType === cible.entityType && p.jurisdiction === "*");
  if (repli) return repli;
  throw new ProfilIntrouvable(cible.entityType, cible.jurisdiction);
}
