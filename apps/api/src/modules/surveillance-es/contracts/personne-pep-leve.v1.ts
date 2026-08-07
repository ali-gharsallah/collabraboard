import { z } from "zod";
// ES-1 — garde anti-corruption locale : levée du statut PEP (décision humaine tracée, R33).
export const TYPE = "personne.pep.leve";
export const VERSION = 1;
export const schema = z.object({ decideur: z.string(), sourceHitId: z.string().nullish() });
