import { z } from "zod";
// ES-1 — garde anti-corruption locale : hit screening qualifié VRAI_POSITIF → escalade PROPOSÉE
// (R39/R44 : jamais exécutée). Le type est aussi au catalogue central (C6) — adossement en ES-5.
export const TYPE = "screening.escalade.proposee";
export const VERSION = 1;
export const schema = z.object({ hitId: z.string(), clientId: z.string(), motif: z.string() });
