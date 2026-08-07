/**
 * Chemin CANONIQUE du catalogue d'événements (C6) — l'implémentation vit dans
 * apps/api/src/contracts/events-catalog.ts (zod s'y résout : pnpm sans hoisting, la dépendance
 * appartient à apps/api). Ce ré-export garde l'adresse documentaire stable.
 */
export * from "../../apps/api/src/contracts/events-catalog";
