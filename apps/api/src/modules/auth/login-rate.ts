import { HttpException, Injectable } from "@nestjs/common";

/**
 * R296 (dette §7, 2026-07-28) — RATE LIMITING des portes de login PUBLIQUES.
 * Fenêtre GLISSANTE par identifiant (email / identité mobile) : au-delà du seuil, 429 TYPÉ —
 * la MÊME réponse que l'identifiant existe ou non (pattern OL-34 : le limiteur n'est jamais
 * un oracle d'existence). Le compteur est PAR identifiant : pas de punition collective.
 * v1 : seuils CONSTANTS et mémoire d'instance — le store partagé (multi-instances) et la
 * clé R-Q de seuil viendront avec l'infra (écart consigné, ECARTS §7).
 */

export const LIMITES = {
  login: { max: 8, fenetreMs: 60_000 },      // temps 2 (mot de passe) — serré
  methode: { max: 30, fenetreMs: 60_000 },   // temps 1 (résolution) — l'énumération se paie aussi
} as const;

@Injectable()
export class LoginRateLimiter {
  private tentatives = new Map<string, number[]>();

  // Enregistre la tentative PUIS refuse au-delà du seuil — chaque appel compte, réussi ou non.
  garder(cle: string, limite: { max: number; fenetreMs: number }) {
    const now = Date.now();
    const recentes = (this.tentatives.get(cle) ?? []).filter((t) => now - t < limite.fenetreMs);
    if (recentes.length >= limite.max) {
      this.tentatives.set(cle, recentes);
      throw new HttpException(
        "R296 : trop de tentatives de connexion — réessayez plus tard (fenêtre glissante, même réponse quel que soit l'identifiant)", 429);
    }
    recentes.push(now);
    this.tentatives.set(cle, recentes);
    // Balayage opportuniste : les clés froides ne s'accumulent pas indéfiniment.
    if (this.tentatives.size > 10_000)
      for (const [k, v] of this.tentatives) if (v.every((t) => now - t >= limite.fenetreMs)) this.tentatives.delete(k);
  }
}
