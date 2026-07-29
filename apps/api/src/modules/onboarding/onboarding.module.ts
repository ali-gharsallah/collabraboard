import { Body, Controller, Get, Module, Param, Post, Req } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { KycModule } from "../kyc/kyc.module";
import { KycService } from "../kyc/kyc.service";
import { OnboardingService } from "./onboarding.service";

// Câblage minimal du bloc 19 (R117→R120), sur le modèle commenté dans
// onboarding.schema-controller-adapters.ts. OnboardingService délègue au moteur KYC (R118) :
// son 3e paramètre `kycSvc` est un type structurel `{ create }`, sans metadata exploitable par
// l'IoC Nest → on le fournit via useFactory en injectant KycService (même patron que
// OidcService dans AuthModule). Précédent connu : câblages DI documentés (§13).
@Controller("onboarding")
export class OnboardingController {
  constructor(private svc: OnboardingService) {}
  @Post()
  creer(@Req() r: any, @Body() b: any) { return this.svc.creer(r.ctx, b); }
  @Post(":id/transition")
  tr(@Req() r: any, @Param("id") id: string, @Body() b: any) {
    return this.svc.transitionner(r.ctx, id, b?.vers, { motif: b?.motif, form: b?.form });
  }
  @Get()                                  // Vague 3 — stock du pipeline pour le dashboard exécutif
  liste(@Req() r: any) { return this.svc.liste(r.ctx); }
  @Post("sandbox")                        // Bac à sable SLA — dry-run d'un seuil (application R94, 0 écriture)
  sandbox(@Req() r: any, @Body() b: any) { return this.svc.sandbox(r.ctx, b); }
  @Get(":id/funnel")
  funnel(@Req() r: any, @Param("id") id: string) { return this.svc.funnel(r.ctx, id); }
}

@Module({
  imports: [KycModule],                 // fournit KycService (exporté)
  controllers: [OnboardingController],
  providers: [
    {
      provide: OnboardingService,
      useFactory: (prisma: PrismaService, audit: AuditService, kyc: KycService) =>
        // R271 : la création déléguée par l'onboarding est LA voie du retour d'un client
        // clôturé — le moteur KYC chaîne alors Rn+1 (previousKycId) et impose l'EDD si
        // ex-EXIT_COMPLIANCE (paramètre). La création directe, elle, reste refusée.
        new OnboardingService(prisma, audit,
          { create: (ctx: any, dto: any) => kyc.create(ctx, dto, { viaOnboarding: true }) }),
      inject: [PrismaService, AuditService, KycService],
    }],
  exports: [OnboardingService],
})
export class OnboardingModule {}
