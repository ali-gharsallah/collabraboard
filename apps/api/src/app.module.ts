import { Module, MiddlewareConsumer } from "@nestjs/common";
import { TenantMiddleware } from "./common/tenant.middleware";
import { AuthModule } from "./modules/auth/auth.module";
import { ClientsModule } from "./modules/clients/clients.module";
import { KycModule } from "./modules/kyc/kyc.module";
import { EventsModule } from "./modules/events/events.module";
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

@Module({ imports: [AuthModule, ClientsModule, KycModule, EventsModule, OnboardingModule, PreRevueModule, GedModule, ParametresModule, CrmModule, WorkloadModule, AmlModule, IslamicModule, RiskCaseModule, ScreeningModule, PersonnesModule, TransactionsModule, MrosModule, CorebankingModule, WorkflowModule, PmsModule, PortsModule, WorkflowInstancesModule, FormationsModule, BusinessTripModule, TasksModule, NbaModule, CpsiModule, OliviaModule, OffboardingModule] })
export class AppModule {
  configure(c: MiddlewareConsumer) { c.apply(TenantMiddleware).forRoutes("*"); }
}
