import { Module } from "@nestjs/common";
import { OutboxWorker } from "./outbox.worker";
import { PrismaService } from "../../common/prisma.service";
@Module({ providers: [OutboxWorker, PrismaService] })
export class EventsModule {}
