import { Body, Controller, Get, Header, Param, Post, Query, Req } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { ScreeningService } from "./screening.service";
import { ListesService } from "./listes.service";

/**
 * Porte HTTP du screening (Vague 3, écran « Screening »). Délégation PURE : la sémantique
 * ratifiée R100→R103 (SC-01..04) vit au service — hits bruts persistés (R100), whitelist
 * par empreinte (R102), trace de passage TOUJOURS écrite (R103), qualification motivée
 * (R101/R7) dont l'auteur = le jeton. La qualification VRAI_POSITIF PROPOSE l'escalade
 * (gel / clarification art. 6 LBA / MROS) — jamais exécutée (R39/R44). Auteur = r.ctx.
 */
@Controller("screening")
export class ScreeningController {
  constructor(private svc: ScreeningService, private listes: ListesService) {}
  @Post("run")               run(@Req() r: any, @Body() b: any) { return this.svc.run(r.ctx, b); }                                   // R100/R103
  @Post("run-swift")         runSwift(@Req() r: any, @Body() b: any) { return this.svc.runSwift(r.ctx, b); }                         // R100 — parties d'un virement SWIFT
  @Post("run-flux")          runFlux(@Req() r: any, @Body() b: any) { return this.svc.runFlux(r.ctx, b); }                           // R100 — contreparties du journal (core banking)
  @Post("hits/:id/qualify")  qualify(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.qualify(r.ctx, id, b?.verdict, b?.motif); } // R101/R7
  @Get("hits")               hits(@Req() r: any, @Query() q: any) { return this.svc.hits(r.ctx, { statut: q.statut, clientId: q.clientId, sujetType: q.sujetType, since: q.since, until: q.until }); } // R411 — historique audité (sujet × temps)
  @Get("hits/export")        exporter(@Req() r: any, @Query() q: any) { return this.svc.exporterHits(r.ctx, { statut: q.statut, clientId: q.clientId, sujetType: q.sujetType, since: q.since, until: q.until }); } // R411 — export d'audit (hit + config + qualification)
  @Get("hits/export.csv")    @Header("Content-Type", "text/csv; charset=utf-8") @Header("Content-Disposition", "attachment; filename=\"screening-audit.csv\"")
  exporterCsv(@Req() r: any, @Query() q: any) { return this.svc.exporterHitsCsv(r.ctx, { statut: q.statut, clientId: q.clientId, sujetType: q.sujetType, since: q.since, until: q.until }); } // R411 — export CSV téléchargeable
  @Get("runs")               runs(@Req() r: any) { return this.svc.runs(r.ctx); }                                                     // R103 — preuve de fraîcheur
  @Get("config")             configs(@Req() r: any) { return this.svc.configs(r.ctx); }                                               // R415 — versions + en vigueur
  @Post("config")            publier(@Req() r: any, @Body() b: any) { return this.svc.publierConfig(r.ctx, b); }                      // R415/R7 — publier une version
  @Post("runs/:id/replay")   replay(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.replay(r.ctx, id, b?.entries); } // R48/R49 — rejeu depuis config persistée
  // ── R409 (L6) — ingestion de listes VERSIONNÉE : bulk + delta (rescreening ciblé, delisting en revue) ──
  @Post("listes/importer")   importer(@Req() r: any, @Body() b: any) { return this.listes.importer(r.ctx, b); }
  @Get("listes")             lister(@Req() r: any) { return this.listes.listes(r.ctx); }                              // âge exposé (bandeau + API)
  @Post("listes/purger")     purger(@Req() r: any, @Body() b: any) { return this.listes.purger(r.ctx, b); }           // conservation ≥ 90 j
}

@Module({ controllers: [ScreeningController], providers: [ ScreeningService, ListesService], exports: [ScreeningService, ListesService] })
export class ScreeningModule {}
