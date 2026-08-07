import { z } from "zod";
// ES-1 — garde anti-corruption locale : validation finale d'un dossier KYC (kyc.service).
export const TYPE = "kyc.validated";
export const VERSION = 1;
export const schema = z.object({ code: z.string(), validatedBy: z.string() });
