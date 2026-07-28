import { Module } from "@nestjs/common";
import { OutboxWorker } from "./outbox.worker";
import { GoldenRecordProjector } from "./golden-record.projector";
import { CaseProposalConsumer } from "./case-proposal.consumer";
import { EventsController } from "./events.controller";
import { OnboardingModule } from "../onboarding/onboarding.module";
import { RiskCaseModule } from "../riskcases/risk-case.module";
// R104 : OutboxWorker dépend de GoldenRecordProjector (→ AuditService). Le câblage
// correct est celui documenté dans outbox.worker.ts ; il manquait ici, ce qui
// cassait la résolution DI au boot de l'AppModule (donc les e2e).
// R120 : le worker porte aussi le sweep SLA onboarding → import d'OnboardingModule
// (qui exporte OnboardingService).
// R286 : consommateur worker-riskcases (case_proposal → porte d'entrée UC-01) → import de
// RiskCaseModule ; contrôleur santé/rejeu (T9 étendu : dead-letters visibles, rejeu tracé).
@Module({
  imports: [OnboardingModule, RiskCaseModule],
  controllers: [EventsController],
  providers: [OutboxWorker, GoldenRecordProjector, CaseProposalConsumer],
  exports: [OutboxWorker],
})
export class EventsModule {}
