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

@Module({ imports: [AuthModule, ClientsModule, KycModule, EventsModule, OnboardingModule, PreRevueModule, GedModule, ParametresModule, CrmModule, WorkloadModule] })
export class AppModule {
  configure(c: MiddlewareConsumer) { c.apply(TenantMiddleware).forRoutes("*"); }
}
