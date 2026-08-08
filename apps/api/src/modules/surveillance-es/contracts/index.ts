import { z } from "zod";
import { SCHEMAS_EVENEMENTS } from "../../../contracts/events-catalog";

/**
 * ES-5 puis ES-8 (docs/SURVEILLANCE-ES.md §4) — gardes anti-corruption ADOSSÉES AU CATALOGUE
 * CENTRAL (apps/api/src/contracts/events-catalog.ts, P-L5-2) pour la TOTALITÉ des types
 * consommés : ES-8 a fait monter au catalogue les 4 derniers types en garde locale
 * (tx.flux.importee, kyc.validated, personne.pep.declare, personne.pep.leve —
 * docs/notes/ES-catalogue-gaps.md soldé, fichiers locaux supprimés). ZÉRO duplication de
 * schéma. NB frontière : les schémas du catalogue sont .strict() (contrat au write) — assumé :
 * un événement qui passe emitEvent passe la garde ES par construction ; un payload historique
 * additif partirait en quarantaine (visible, jamais silencieux — invariant ES-1).
 */
export type GardeEs = { version: number; schema: z.ZodTypeAny };

const DU_CATALOGUE = ["screening.escalade.proposee", "pep.proposition.creee", "pep.proposition.rejetee",
  "screening.hit.detecte", "screening.hit.qualifie",              // ES-6 : timeline des hits
  "tx.flux.importee", "kyc.validated",                            // ES-8 : montés au catalogue
  "personne.pep.declare", "personne.pep.leve"] as const;          // ES-7/ES-8 : décisions PEP

export const SCHEMAS_ES: Readonly<Record<string, GardeEs>> = Object.freeze(
  Object.fromEntries(DU_CATALOGUE.map((t) => {
    const c = SCHEMAS_EVENEMENTS[t];
    return [t, { version: c.version, schema: c.schema }];
  })));

export const TYPES_CONSOMMES: ReadonlySet<string> = new Set(Object.keys(SCHEMAS_ES));
