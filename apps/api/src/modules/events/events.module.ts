import { Module } from "@nestjs/common";
import { OutboxWorker } from "./outbox.worker";
import { GoldenRecordProjector } from "./golden-record.projector";
import { OnboardingModule } from "../onboarding/onboarding.module";
// R104 : OutboxWorker dépend de GoldenRecordProjector (→ AuditService). Le câblage
// correct est celui documenté dans outbox.worker.ts ; il manquait ici, ce qui
// cassait la résolution DI au boot de l'AppModule (donc les e2e).
// R120 : le worker porte aussi le sweep SLA onboarding → import d'OnboardingModule
// (qui exporte OnboardingService).
@Module({
  imports: [OnboardingModule],
  providers: [OutboxWorker, GoldenRecordProjector],
})
export class EventsModule {}
