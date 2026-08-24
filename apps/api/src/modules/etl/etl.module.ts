import { Body, Controller, Get, Injectable, Module, Param, Post, Query, Req } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { loadSettings } from "../../common/tenant-settings";
import { EtlService, FamilleImport } from "./etl.service";

// ETL core banking (R480→R489) — exposition HTTP du pipeline vert (ET-01..08). Le PORT est
// celui du canon : « core-banking » (R167, clé tenant `coreSystemeRef`) — pas de secret =
// refus gracieux (R486), le connecteur GENERIQUE (Q1) passe par la même clé.
// Invariant §7 (pas d'état module-global) : EtlService est un service de CALCUL instancié
// PAR REQUÊTE par la façade, avec le port lié aux settings du tenant courant.
type Ctx = { tenantId: string; userId: string; role: string };

const estConfigure = (settings: any, cle: string): boolean => {
  const v = (settings ?? {})[cle];
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return !!v.trim();
  if (typeof v === "object") return Object.keys(v).length > 0;
  return true;
};

@Injectable()
export class EtlFacade {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private async svc(ctx: Ctx): Promise<EtlService> {
    const settings = await loadSettings(this.prisma, ctx.tenantId, true);
    return new EtlService(this.prisma, this.audit,
      { secretPresent: () => estConfigure(settings, "coreSystemeRef") });    // R486 via port R167
  }

  publierContrat = async (ctx: Ctx, b: any) => (await this.svc(ctx)).publierContrat(ctx, b);
  contratEnVigueur = async (ctx: Ctx, connecteur: string, famille: FamilleImport, at?: string) =>
    (await this.svc(ctx)).contratEnVigueur(ctx, connecteur, famille, at);
  recevoirLot = async (ctx: Ctx, b: any) => (await this.svc(ctx)).recevoirLot(ctx, b);
  validerLot = async (ctx: Ctx, lotId: string) => (await this.svc(ctx)).validerLot(ctx, lotId);
  dryRun = async (ctx: Ctx, lotId: string) => (await this.svc(ctx)).dryRun(ctx, lotId);
  appliquerLot = async (ctx: Ctx, lotId: string) => (await this.svc(ctx)).appliquerLot(ctx, lotId);
  reconcilier = async (ctx: Ctx, lotId: string) => (await this.svc(ctx)).reconcilier(ctx, lotId);
  fraicheur = async (ctx: Ctx) => (await this.svc(ctx)).fraicheur(ctx);
}

@Controller("etl")
export class EtlController {
  constructor(private facade: EtlFacade) {}

  @Post("contrats")                 publier(@Req() r: any, @Body() b: any) { return this.facade.publierContrat(r.ctx, b ?? {}); }                    // R480/R487
  @Get("contrats/en-vigueur")       enVigueur(@Req() r: any, @Query("connecteur") c: string, @Query("famille") f: FamilleImport, @Query("at") at?: string) { return this.facade.contratEnVigueur(r.ctx, c, f, at); } // R480/R29
  @Post("lots")                     recevoir(@Req() r: any, @Body() b: any) { return this.facade.recevoirLot(r.ctx, b ?? {}); }                       // R486
  @Post("lots/:id/valider")         valider(@Req() r: any, @Param("id") id: string) { return this.facade.validerLot(r.ctx, id); }                     // R483
  @Post("lots/:id/dry-run")         dryRun(@Req() r: any, @Param("id") id: string) { return this.facade.dryRun(r.ctx, id); }                          // R484
  @Post("lots/:id/appliquer")       appliquer(@Req() r: any, @Param("id") id: string) { return this.facade.appliquerLot(r.ctx, id); }                 // R481/R482/R489
  @Post("lots/:id/reconcilier")     reconcilier(@Req() r: any, @Param("id") id: string) { return this.facade.reconcilier(r.ctx, id); }                // R485
  @Get("fraicheur")                 fraicheur(@Req() r: any) { return this.facade.fraicheur(r.ctx); }                                                 // R488
}

@Module({ controllers: [EtlController], providers: [EtlFacade], exports: [EtlFacade] })
export class EtlModule {}
