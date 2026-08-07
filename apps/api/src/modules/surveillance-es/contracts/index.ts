import { z } from "zod";
import * as txFlux from "./tx-flux-importee.v1";
import * as kycValidated from "./kyc-validated.v1";
import * as escalade from "./screening-escalade-proposee.v1";
import * as pepCreee from "./pep-proposition-creee.v1";
import * as pepRejetee from "./pep-proposition-rejetee.v1";
import * as pepDeclare from "./personne-pep-declare.v1";
import * as pepLeve from "./personne-pep-leve.v1";

/**
 * ES-1 (docs/SURVEILLANCE-ES.md §2) — registre des gardes ANTI-CORRUPTION du contexte
 * surveillance-es : un fichier par type consommé, version EXPLICITE. Ces schémas sont la
 * frontière du contexte — un payload non conforme part en quarantaine (jamais de crash,
 * jamais de skip silencieux). ES-5 remplacera les définitions locales par des références au
 * catalogue central (apps/api/src/contracts/events-catalog.ts) pour les types qu'il couvre.
 */
export type GardeEs = { version: number; schema: z.ZodTypeAny };

export const SCHEMAS_ES: Readonly<Record<string, GardeEs>> = Object.freeze(
  Object.fromEntries(
    [txFlux, kycValidated, escalade, pepCreee, pepRejetee, pepDeclare, pepLeve]
      .map((m) => [m.TYPE, { version: m.VERSION, schema: m.schema }]),
  ),
);

export const TYPES_CONSOMMES: ReadonlySet<string> = new Set(Object.keys(SCHEMAS_ES));
