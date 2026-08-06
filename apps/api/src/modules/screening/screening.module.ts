import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { ScreeningService } from "./screening.service";

/**
 * Porte HTTP du screening (Vague 3, écran « Screening »). Délégation PURE : la sémantique
 * ratifiée R100→R103 (SC-01..04) vit au service — hits bruts persistés (R100), whitelist
 * par empreinte (R102), trace de passage TOUJOURS écrite (R103), qualification motivée
 * (R101/R7) dont l'auteur = le jeton. La qualification VRAI_POSITIF PROPOSE l'escalade
 * (gel / clarification art. 6 LBA / MROS) — jamais exécutée (R39/R44). Auteur = r.ctx.
 */
@Controller("screening")
export class ScreeningController {
  constructor(private svc: ScreeningService) {}
  @Post("run")               run(@Req() r: any, @Body() b: any) { return this.svc.run(r.ctx, b); }                                   // R100/R103
  @Post("hits/:id/qualify")  qualify(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.qualify(r.ctx, id, b?.verdict, b?.motif); } // R101/R7
  @Get("hits")               hits(@Req() r: any, @Query("statut") statut?: string) { return this.svc.hits(r.ctx, statut); }
  @Get("runs")               runs(@Req() r: any) { return this.svc.runs(r.ctx); }                                                     // R103 — preuve de fraîcheur
  @Get("config")             configs(@Req() r: any) { return this.svc.configs(r.ctx); }                                               // R415 — versions + en vigueur
  @Post("config")            publier(@Req() r: any, @Body() b: any) { return this.svc.publierConfig(r.ctx, b); }                      // R415/R7 — publier une version
  @Post("runs/:id/replay")   replay(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.replay(r.ctx, id, b?.entries); } // R48/R49 — rejeu depuis config persistée
}

@Module({ controllers: [ScreeningController], providers: [ ScreeningService], exports: [ScreeningService] })
export class ScreeningModule {}
