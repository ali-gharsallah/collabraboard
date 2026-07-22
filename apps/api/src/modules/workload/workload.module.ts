import { Module } from "@nestjs/common";
import { WorkloadController } from "./workload.controller";
import { WorkloadService } from "./workload.service";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";

@Module({ controllers: [WorkloadController],
  providers: [PrismaService, AuditService,
    { provide: WorkloadService, useFactory: (p: PrismaService, a: AuditService) => new WorkloadService(p, a), inject: [PrismaService, AuditService] }] })
export class WorkloadModule {}
