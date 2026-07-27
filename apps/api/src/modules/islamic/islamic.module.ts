import { Module } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { IslamicController } from "./islamic.controller";
import { IslamicService } from "./islamic.service";

// Câblage Nest de la couche Shariah (Bloc 49, R207→R221). IslamicService n'a pas de port
// optionnel → useFactory simple ; exporté pour un futur branchement (le portail transactionnel
// pourra consulter un blocage maysir R209 — hors périmètre de ce lot).
@Module({
  controllers: [IslamicController],
  providers: [
    {
      provide: IslamicService,
      useFactory: (p: PrismaService, a: AuditService) => new IslamicService(p, a),
      inject: [PrismaService, AuditService],
    }],
  exports: [IslamicService],
})
export class IslamicModule {}
