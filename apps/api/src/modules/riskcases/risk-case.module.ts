import { Module } from "@nestjs/common";
import { RiskCaseController } from "./risk-case.controller";
import { RiskCaseService } from "./risk-case.service";
import { PORT_PROPOSITION_RISK_CASE } from "../surveillance/ports";

// Câblage Nest des dossiers de risque (Vague 1). RiskCaseService (prisma, audit) est
// auto-résolu. P-L3-2 : le contexte fournit le PORT (frontière ADR-TM-001) — l'extérieur
// (events/case-proposal.consumer) injecte PORT_PROPOSITION_RISK_CASE, jamais le service concret.
@Module({
  controllers: [RiskCaseController],
  providers: [ RiskCaseService, { provide: PORT_PROPOSITION_RISK_CASE, useExisting: RiskCaseService }],
  exports: [RiskCaseService, PORT_PROPOSITION_RISK_CASE],
})
export class RiskCaseModule {}
