import { z } from "zod";
// ES-1 — garde anti-corruption locale : PEPisation DÉCIDÉE par un humain (personnes.service,
// seul écrivain de statutPep — ADR-PEP-001). sourceHitId trace l'origine screening si issue d'un hit.
export const TYPE = "personne.pep.declare";
export const VERSION = 1;
export const schema = z.object({ source: z.string(), sourceHitId: z.string().nullish() });
