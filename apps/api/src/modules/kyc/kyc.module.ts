import { Module } from "@nestjs/common";
import { KycController } from "./kyc.controller";
import { KycService } from "./kyc.service";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { KycLockService } from "./rules/kyc-lock.service";            // R84
import { QualifiedVisaService } from "./rules/qualified-visa.service"; // R86
import { PreRevueModule } from "../ia/prerevue.module";               // R123
import { PreRevueService } from "../ia/prerevue.service";
@Module({
  imports: [PreRevueModule],                                          // fournit PreRevueService (gate R123)
  controllers: [KycController],
  providers: [
    PrismaService, AuditService, KycLockService, QualifiedVisaService,
    // KycService reçoit le hook de pré-revue IA (R123) en 3e param optionnel.
    {
      provide: KycService,
      useFactory: (p: PrismaService, a: AuditService, pr: PreRevueService) => new KycService(p, a, pr),
      inject: [PrismaService, AuditService, PreRevueService],
    },
  ],
  exports: [KycService, KycLockService, QualifiedVisaService],   // KycService exporté pour OnboardingModule (R118)
})
export class KycModule {}
