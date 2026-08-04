import { Module } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { AmlController } from "./aml.controller";
import { AmlService } from "./aml.service";
import { AmlGapController } from "./aml-gap.controller";
import { AmlGapService } from "./aml-gap.service";
import { AmlEvalService } from "./aml-eval.service";
import { CpsiModule, CpsiService } from "../cpsi/cpsi.module";

// Câblage Nest de la surveillance AML (Bloc 48, R189→R206) + vague AML Gap Wave 1 (blocs 50–56,
// R340→R377). AmlService n'a pas de port optionnel → useFactory simple ; exporté pour un futur
// branchement au portail transactionnel (le verdict TX pourra consulter les signaux bloquants).
@Module({
  imports: [CpsiModule],                                                 // pont Analytique 2G (bloc 61 → CPSI Python)
  controllers: [AmlController, AmlGapController],
  providers: [
    {
      provide: AmlService,
      useFactory: (p: PrismaService, a: AuditService) => new AmlService(p, a),
      inject: [PrismaService, AuditService],
    },
    {
      provide: AmlGapService,
      useFactory: (p: PrismaService, a: AuditService, c: CpsiService) => new AmlGapService(p, a, c),
      inject: [PrismaService, AuditService, CpsiService],
    },
    {
      provide: AmlEvalService,
      useFactory: (p: PrismaService, a: AuditService, g: AmlGapService) => new AmlEvalService(p, a, g),
      inject: [PrismaService, AuditService, AmlGapService],
    }],
  exports: [AmlService, AmlGapService, AmlEvalService],
})
export class AmlModule {}
