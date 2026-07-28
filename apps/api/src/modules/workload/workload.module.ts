import { Module } from "@nestjs/common";
import { WorkloadController } from "./workload.controller";
import { WorkloadService } from "./workload.service";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";

@Module({ controllers: [WorkloadController],
  providers: [
    { provide: WorkloadService, useFactory: (p: PrismaService, a: AuditService) => new WorkloadService(p, a), inject: [PrismaService, AuditService] }],
  exports: [WorkloadService] })            // R240/A2 : réutilisé par le service Tâches (reassign ratifié inchangé)
export class WorkloadModule {}
