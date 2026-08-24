import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { MrosService } from "./mros.service";
import { GoamlService } from "./goaml.service";
import { PORT_GEL_MROS } from "../surveillance/ports";

/**
 * Porte HTTP du reporting réglementaire MROS (Vague 4). Délégation PURE vers le domaine
 * ratifié R129→R132. La décision (communiquer / s'abstenir) est habilitée + motivée (R7),
 * le dossier est FIGÉ et empreinté (R130, dossierSha256 opposable — jamais re-décidé), la
 * relecture rend l'empreinte à l'identique, et l'art. 10a (R132, interdiction d'informer) est
 * tenu par l'habilitation à chaque lecture. Auteur = jeton (r.ctx).
 */
@Controller("mros")
export class MrosController {
  constructor(private svc: MrosService, private goamlSvc: GoamlService) {}
  @Post("decider")            decider(@Req() r: any, @Body() b: any) { return this.svc.decider(r.ctx, b); }                              // R129/R130
  @Get()                      lister(@Req() r: any) { return this.svc.lister(r.ctx); }                                                   // registre / états
  @Get(":id")                 relire(@Req() r: any, @Param("id") id: string) { return this.svc.relire(r.ctx, id); }                     // R130 opposable
  @Post(":id/notification")   notif(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.saisirNotification(r.ctx, id, b?.notification); } // R131
  @Post(":id/gel")            gel(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.poserGel(r.ctx, id, b?.motif); }        // R131
  @Post(":id/gel/lever")      lever(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.leverGel(r.ctx, id, b?.motif); }     // R131
  @Get(":id/goaml")           goaml(@Req() r: any, @Param("id") id: string) { return this.goamlSvc.genererBrouillon(r.ctx, id); }                  // P-L8-1 — brouillon pré-rempli
  @Post(":id/goaml/soumettre") soumettre(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.goamlSvc.soumettre(r.ctx, id, b); } // dépôt MANUEL tracé
  @Post("chrono/tick")        chrono(@Req() r: any, @Body() b: any) { return this.goamlSvc.chronometre(r.ctx, b?.now ? new Date(b.now) : undefined); } // J+5 ouvrés
}

// P-L3-2 : le contexte Surveillance fournit le PORT (frontière ADR-TM-001) — l'extérieur n'importe
// jamais MrosService, il injecte PORT_GEL_MROS (même instance, useExisting : comportement identique).
@Module({ controllers: [MrosController],
  providers: [ MrosService, GoamlService, { provide: PORT_GEL_MROS, useExisting: MrosService }],
  exports: [MrosService, PORT_GEL_MROS] })
export class MrosModule {}
