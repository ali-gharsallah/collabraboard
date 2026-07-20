import { Module } from "@nestjs/common";
import { ClientsController } from "./clients.controller";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
@Module({ controllers: [ClientsController], providers: [PrismaService, AuditService] })
export class ClientsModule {}
