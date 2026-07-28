import { Module } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { AmlController } from "./aml.controller";
import { AmlService } from "./aml.service";

// Câblage Nest de la surveillance AML (Bloc 48, R189→R206). AmlService n'a pas de port
// optionnel → useFactory simple ; exporté pour un futur branchement au portail transactionnel
// (le verdict TX pourra consulter les signaux bloquants — hors périmètre de ce lot).
@Module({
  controllers: [AmlController],
  providers: [
    {
      provide: AmlService,
      useFactory: (p: PrismaService, a: AuditService) => new AmlService(p, a),
      inject: [PrismaService, AuditService],
    }],
  exports: [AmlService],
})
export class AmlModule {}
