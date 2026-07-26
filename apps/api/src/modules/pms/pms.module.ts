import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { PmsService } from "./pms.service";

/**
 * Porte HTTP du PMS — mandats & adéquation (Vague 7, écran « PMS »). Délégation PURE vers le
 * domaine ratifié R105→R108. **Intégrer, pas refaire** : ce n'est PAS un moteur de portefeuille,
 * c'est la couche COMPLIANCE sur les positions (drift CONSTATÉ jamais rééquilibré — R105/R44 ;
 * pre-trade bloquant sur exclusions/concentration — R106 ; adéquation LSFin bornée par le
 * riskLevel CLIENT — R107 ; registre de breaches append-only, l'échéance escalade sans
 * liquider — R108/R39). Auteur = jeton (r.ctx). Les positions sont des données (import core),
 * jamais calculées ici.
 */
@Controller("pms")
export class PmsController {
  constructor(private svc: PmsService) {}
  @Post("mandats")                 attacher(@Req() r: any, @Body() b: any) { return this.svc.attacherMandat(r.ctx, b?.clientId, { nom: b?.nom, profilRequis: b?.profilRequis, strategie: b?.strategie ?? {} }); } // R107
  @Get("mandats")                  mandats(@Req() r: any, @Query("clientId") clientId?: string) { return this.svc.mandats(r.ctx, clientId); }
  @Get("mandats/:id/valoriser")    valoriser(@Req() r: any, @Param("id") id: string) { return this.svc.valoriser(r.ctx, id); }                                          // R105 drift constaté
  @Post("mandats/:id/pre-trade")   preTrade(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.preTrade(r.ctx, id, { instrument: b?.instrument, secteur: b?.secteur, classe: b?.classe, montantChf: b?.montantChf }); } // R106
  @Get("clients/:id/adequation")   adequation(@Req() r: any, @Param("id") id: string) { return this.svc.verifierAdequation(r.ctx, id); }                               // R107 suitability
  @Get("breaches")                 breaches(@Req() r: any, @Query("statut") statut?: string) { return this.svc.breaches(r.ctx, statut); }                               // R108 registre
  @Post("breaches/:id/clore")      clore(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.cloreBreach(r.ctx, id, b?.motif); }                 // R7
}

@Module({ controllers: [PmsController], providers: [PrismaService, AuditService, PmsService], exports: [PmsService] })
export class PmsModule {}
