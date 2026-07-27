import { Module } from "@nestjs/common";
import { CrmController } from "./crm.controller";
import { CrmService } from "./crm.service";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";

/** Le port IA reste vide ici : sans clé, pas de port (R138) — preRemplir refuse
 * proprement, la saisie manuelle vit. Au déploiement avec ANTHROPIC_API_KEY :
 *   useFactory: (p, a) => new CrmService(p, a, { ia: claudeIaAdapter({ entretiens: <registre crmEntretiens> }) })  */
@Module({ controllers: [CrmController],
  providers: [
    { provide: CrmService, useFactory: (p: PrismaService, a: AuditService) => new CrmService(p, a, {}), inject: [PrismaService, AuditService] }] })
export class CrmModule {}
