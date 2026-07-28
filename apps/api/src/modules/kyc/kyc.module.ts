import { Module } from "@nestjs/common";
import { KycController } from "./kyc.controller";
import { KycService } from "./kyc.service";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { KycLockService } from "./rules/kyc-lock.service";            // R84
import { QualifiedVisaService } from "./rules/qualified-visa.service"; // R86
import { PreRevueModule } from "../ia/prerevue.module";               // R123
import { PreRevueService } from "../ia/prerevue.service";
import { ReviewsModule } from "../reviews/reviews.module";            // R272/R275 (débloquants partie 1)
import { ReviewsService } from "../reviews/reviews.module";
@Module({
  imports: [PreRevueModule, ReviewsModule],                           // PreRevueService (R123) + ReviewsService (R272)
  controllers: [KycController],
  providers: [ KycLockService, QualifiedVisaService,
    // KycService reçoit le hook de pré-revue IA (R123) en 3e param optionnel.
    {
      provide: KycService,
      useFactory: (p: PrismaService, a: AuditService, pr: PreRevueService, rv: ReviewsService) => new KycService(p, a, pr, rv),
      inject: [PrismaService, AuditService, PreRevueService, ReviewsService],
    }],
  exports: [KycService, KycLockService, QualifiedVisaService],   // KycService exporté pour OnboardingModule (R118)
})
export class KycModule {}
