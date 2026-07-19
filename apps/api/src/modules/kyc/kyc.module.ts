import { Module } from "@nestjs/common";
import { KycController } from "./kyc.controller";
import { KycService } from "./kyc.service";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { KycLockService } from "./rules/kyc-lock.service";            // R84
import { QualifiedVisaService } from "./rules/qualified-visa.service"; // R86
@Module({
  controllers: [KycController],
  providers: [KycService, PrismaService, AuditService, KycLockService, QualifiedVisaService],
  exports: [KycLockService, QualifiedVisaService],
})
export class KycModule {}
