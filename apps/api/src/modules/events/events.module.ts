import { Module } from "@nestjs/common";
import { OutboxWorker } from "./outbox.worker";
import { GoldenRecordProjector } from "./golden-record.projector";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
// R104 : OutboxWorker dépend de GoldenRecordProjector (→ AuditService). Le câblage
// correct est celui documenté dans outbox.worker.ts ; il manquait ici, ce qui
// cassait la résolution DI au boot de l'AppModule (donc les e2e).
@Module({ providers: [OutboxWorker, GoldenRecordProjector, PrismaService, AuditService] })
export class EventsModule {}
