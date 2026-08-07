import { z } from "zod";
// ES-1 — garde anti-corruption LOCALE (docs/SURVEILLANCE-ES.md §2) : transaction ingérée (txflux).
// Champs REQUIS validés ; les champs additifs futurs passent (zod strippe sans échouer) — le fait
// stocke le payload ORIGINAL, la validation n'est qu'une porte. ES-5 adossera au catalogue central.
export const TYPE = "tx.flux.importee";
export const VERSION = 1;
export const schema = z.object({
  refExterne: z.string(), source: z.string(), compte: z.string(),
  clientId: z.string().nullish(),                  // transaction possiblement non rapprochée d'un client
});
