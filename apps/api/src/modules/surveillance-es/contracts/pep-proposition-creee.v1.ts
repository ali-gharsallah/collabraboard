import { z } from "zod";
// ES-1 — garde anti-corruption locale : proposition de PEPisation issue d'un hit de liste PEP
// (ADR-PEP-001 : le screening PROPOSE, l'humain décide). Au catalogue central — adossement ES-5.
export const TYPE = "pep.proposition.creee";
export const VERSION = 1;
export const schema = z.object({
  cle: z.string(), hitId: z.string(), personId: z.string(),
  liste: z.string(), listeVersion: z.string(), score: z.number(),
  decomposition: z.unknown().nullish(),
});
