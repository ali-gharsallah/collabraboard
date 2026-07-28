import { Module, MiddlewareConsumer } from "@nestjs/common";
import { CoreModule } from "./common/core.module";
import { TenantMiddleware } from "./common/tenant.middleware";
import { AuthModule } from "./modules/auth/auth.module";
import { ClientsModule } from "./modules/clients/clients.module";
import { KycModule } from "./modules/kyc/kyc.module";
import { EventsModule } from "./modules/events/events.module";
import { AuditModule } from "./modules/audit/audit.module"; // R284 : surface d'audit SO
import { ApidocModule } from "./modules/apidoc/apidoc.module"; // triage final : doc générée
import { XbModule } from "./modules/crossborder/xb.module"; // R293-R295 : cross-border
import { TxFluxModule } from "./modules/txflux/txflux.module"; // R297 : journal transactionnel (dégel V1)
import { TxRiskModule } from "./modules/txflux/txrisk.module"; // R298 : txrisk, surface du moteur CPSI
import { FxModule } from "./modules/txflux/fx.module"; // R299 : FX, lecture d'exposition
import { SwiftModule } from "./modules/txflux/swift.module"; // R300 : SWIFT, laboratoire d'analyse
import { TaModule } from "./modules/custody/ta.module"; // R302 : registre nominatif (journal)
import { CustodyModule } from "./modules/custody/custody.module"; // R301/R303 : positions port + rapprochement
import { BuilderModule } from "./modules/builder/builder.module"; // R304-R308 : le Builder (dégel V3)
import { RegwatchModule } from "./modules/regwatch/regwatch.module"; // R309-R311 : regwatch (dégel V4)
import { OnboardingModule } from "./modules/onboarding/onboarding.module";
import { PreRevueModule } from "./modules/ia/prerevue.module";
import { GedModule } from "./modules/ged/ged.module";
import { ParametresModule } from "./modules/parametres/parametres.module";
import { CrmModule } from "./modules/crm/crm.module";
import { WorkloadModule } from "./modules/workload/workload.module";
import { AmlModule } from "./modules/aml/aml.module";
import { IslamicModule } from "./modules/islamic/islamic.module";
import { RiskCaseModule } from "./modules/riskcases/risk-case.module";
import { ScreeningModule } from "./modules/screening/screening.module";
import { PersonnesModule } from "./modules/personnes/personnes.module";
import { TransactionsModule } from "./modules/transactions/transactions.module";
import { MrosModule } from "./modules/mros/mros.module";
import { CorebankingModule } from "./modules/corebanking/corebanking.module";
import { PortsModule } from "./modules/ports/ports.module";
import { WorkflowInstancesModule } from "./modules/workflow-instances/workflow-instances.module";
import { FormationsModule } from "./modules/formations/formations.module";
import { BusinessTripModule } from "./modules/businesstrip/businesstrip.module";
import { TasksModule } from "./modules/tasks/tasks.module";
import { NbaModule } from "./modules/nba/nba.module";
import { WorkflowModule } from "./modules/workflow/workflow.module";
import { PmsModule } from "./modules/pms/pms.module";
import { CpsiModule } from "./modules/cpsi/cpsi.module";
import { OliviaModule } from "./modules/olivia/olivia.module";
import { OffboardingModule } from "./modules/offboarding/offboarding.module";
import { LicenseModule } from "./modules/license/license.module";
import { ReviewsModule } from "./modules/reviews/reviews.module";
import { CocModule } from "./modules/coc/coc.module";
import { SandboxModule } from "./modules/sandbox/sandbox.module";
import { SwarmModule } from "./modules/swarm/swarm.module";

@Module({ imports: [CoreModule, AuthModule, AuditModule, ApidocModule, XbModule, TxFluxModule, TxRiskModule, FxModule, SwiftModule, TaModule, CustodyModule, BuilderModule, RegwatchModule, ClientsModule, KycModule, EventsModule, OnboardingModule, PreRevueModule, GedModule, ParametresModule, CrmModule, WorkloadModule, AmlModule, IslamicModule, RiskCaseModule, ScreeningModule, PersonnesModule, TransactionsModule, MrosModule, CorebankingModule, WorkflowModule, PmsModule, PortsModule, WorkflowInstancesModule, FormationsModule, BusinessTripModule, TasksModule, NbaModule, CpsiModule, OliviaModule, OffboardingModule, LicenseModule, ReviewsModule, CocModule, SandboxModule, SwarmModule] })
export class AppModule {
  configure(c: MiddlewareConsumer) { c.apply(TenantMiddleware).forRoutes("*"); }
}
