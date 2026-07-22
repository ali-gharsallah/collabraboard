import { Module } from "@nestjs/common";
import { ParametresController } from "./parametres.controller";
import { ParametresService } from "./parametres.service";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";

@Module({ controllers: [ParametresController],
  providers: [PrismaService, AuditService,
    { provide: ParametresService, useFactory: (p: PrismaService, a: AuditService) => new ParametresService(p, a), inject: [PrismaService, AuditService] }] })
export class ParametresModule {}
