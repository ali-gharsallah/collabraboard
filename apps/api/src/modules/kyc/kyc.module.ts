import { Module } from "@nestjs/common";
import { KycController } from "./kyc.controller";
import { DocMatrixController } from "./docmatrix.controller";        // R26/R27/R29
import { KycService } from "./kyc.service";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { KycLockService } from "./rules/kyc-lock.service";            // R84
import { QualifiedVisaService } from "./rules/qualified-visa.service"; // R86
import { DocMatrixService } from "./docmatrix.service";               // R26/R27/R29
import { PreRevueModule } from "../ia/prerevue.module";               // R123
import { PreRevueService } from "../ia/prerevue.service";
import { ReviewsModule } from "../reviews/reviews.module";            // R272/R275 (débloquants partie 1)
import { ReviewsService } from "../reviews/reviews.module";
import { DecisionUnifieeService } from "../reviews/decision-unifiee.service"; // Bloc 65 Volet B (R474)
@Module({
  imports: [PreRevueModule, ReviewsModule],                           // PreRevueService (R123) + ReviewsService (R272)
  controllers: [KycController, DocMatrixController],
  providers: [ KycLockService, QualifiedVisaService, DocMatrixService,
    // KycService reçoit le hook de pré-revue IA (R123) en 3e param optionnel.
    {
      provide: KycService,
      useFactory: (p: PrismaService, a: AuditService, pr: PreRevueService, rv: ReviewsService, du: DecisionUnifieeService) => {
        const svc = new KycService(p, a, pr, rv);
        rv.brancherKyc(svc);            // R283 : branchement tardif — lancer une review crée LE KYC Rn+1 (pas de cycle de modules)
        du.brancherKyc(svc);            // R474 : Valider = signVisa AVEC ses gardes (R13/R2/R86) — jamais dupliquées
        return svc;
      },
      inject: [PrismaService, AuditService, PreRevueService, ReviewsService, DecisionUnifieeService],
    }],
  exports: [KycService, KycLockService, QualifiedVisaService, DocMatrixService],   // KycService exporté pour OnboardingModule (R118)
})
export class KycModule {}
