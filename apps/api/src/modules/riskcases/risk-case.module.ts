import { Module } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { RiskCaseController } from "./risk-case.controller";
import { RiskCaseService } from "./risk-case.service";

// Câblage Nest des dossiers de risque (Vague 1). RiskCaseService (prisma, audit) est
// auto-résolu — pas de port optionnel. Exposé pour l'écran « File d'alertes » (décision).
@Module({
  controllers: [RiskCaseController],
  providers: [PrismaService, AuditService, RiskCaseService],
  exports: [RiskCaseService],
})
export class RiskCaseModule {}
