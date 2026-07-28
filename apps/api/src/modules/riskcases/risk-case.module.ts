import { Module } from "@nestjs/common";
import { RiskCaseController } from "./risk-case.controller";
import { RiskCaseService } from "./risk-case.service";

// Câblage Nest des dossiers de risque (Vague 1). RiskCaseService (prisma, audit) est
// auto-résolu — pas de port optionnel. Exposé pour l'écran « File d'alertes » (décision).
@Module({
  controllers: [RiskCaseController],
  providers: [ RiskCaseService],
  exports: [RiskCaseService],
})
export class RiskCaseModule {}
