import { z } from "zod";
import { SCHEMAS_EVENEMENTS } from "../../../contracts/events-catalog";
import * as txFlux from "./tx-flux-importee.v1";
import * as kycValidated from "./kyc-validated.v1";
import * as pepDeclare from "./personne-pep-declare.v1";
import * as pepLeve from "./personne-pep-leve.v1";

/**
 * ES-5 (docs/SURVEILLANCE-ES.md §4) — gardes anti-corruption ADOSSÉES AU CATALOGUE CENTRAL
 * (apps/api/src/contracts/events-catalog.ts, P-L5-2) pour les types qu'il couvre :
 * screening.escalade.proposee, pep.proposition.creee, pep.proposition.rejetee — ZÉRO
 * duplication de schéma (les définitions locales de ces trois types sont SUPPRIMÉES).
 * Les schémas LOCAUX ne subsistent que pour les types ABSENTS du catalogue, listés dans
 * docs/notes/ES-catalogue-gaps.md (tx.flux.importee, kyc.validated, personne.pep.declare,
 * personne.pep.leve). NB frontière : les schémas du catalogue sont .strict() (contrat au
 * write) — plus stricts que les gardes locales (additif toléré) ; assumé : un événement qui
 * passe emitEvent passe la garde ES par construction.
 */
export type GardeEs = { version: number; schema: z.ZodTypeAny };

const DU_CATALOGUE = ["screening.escalade.proposee", "pep.proposition.creee", "pep.proposition.rejetee",
  "screening.hit.detecte", "screening.hit.qualifie"] as const;   // ES-6 : timeline des hits

export const SCHEMAS_ES: Readonly<Record<string, GardeEs>> = Object.freeze({
  ...Object.fromEntries(DU_CATALOGUE.map((t) => {
    const c = SCHEMAS_EVENEMENTS[t];
    return [t, { version: c.version, schema: c.schema }];
  })),
  ...Object.fromEntries([txFlux, kycValidated, pepDeclare, pepLeve]
    .map((m) => [m.TYPE, { version: m.VERSION, schema: m.schema }])),
});

export const TYPES_CONSOMMES: ReadonlySet<string> = new Set(Object.keys(SCHEMAS_ES));
