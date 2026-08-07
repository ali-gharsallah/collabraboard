import { Module } from "@nestjs/common";
import { CaseFactsReader } from "./case-facts.reader";
import { LedgerService } from "./ledger.service";
import { InferenceController } from "./inference.controller";

/**
 * P-L7-3 — module A (inférence goal-driven). Le ledger est une VUE de lecture : aucun
 * controller ici (l'API réelle arrive en P-L7-5 avec la checklist front) ; aucune écriture ;
 * R1–R51 restent les gardes actives et inchangées.
 */
@Module({ controllers: [InferenceController],
  providers: [CaseFactsReader, LedgerService], exports: [CaseFactsReader, LedgerService] })
export class InferenceModule {}
