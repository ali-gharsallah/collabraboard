import { z } from "zod";
// ES-1 — garde anti-corruption locale : rejet motivé d'une proposition PEP (R7 : motif requis).
export const TYPE = "pep.proposition.rejetee";
export const VERSION = 1;
export const schema = z.object({ cle: z.string(), motif: z.string(), par: z.string() });
