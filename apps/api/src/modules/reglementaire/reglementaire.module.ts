import { Module, Controller, Get, Post, Body, Param, Query, Req, Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { ParametresService } from "../parametres/parametres.service";
import { ReglementaireService } from "./reglementaire.service";

/**
 * Calendrier réglementaire — R490→R492 (spec/CALENDRIER-REGLEMENTAIRE-R490-R492.md).
 * Porte HTTP + injection : le calendrier vient du registre R-Q (`ParametresService`), jamais
 * d'une table à part — une seconde liste d'obligations à côté du registre serait une seconde
 * vérité, exactement ce que R125 interdit.
 */
@Injectable()
export class ReglementaireFacade extends ReglementaireService {
  constructor(prisma: PrismaService, parametres: ParametresService, audit: AuditService) {
    super(prisma, parametres, audit);
  }
}

@Controller("reglementaire")
export class ReglementaireController {
  constructor(private svc: ReglementaireFacade) {}

  /** R490/R491 — le calendrier en vigueur à une date, statuts calculés (rejeu R48). */
  @Get("calendrier")
  calendrier(@Req() r: any, @Query("at") at?: string) {
    return this.svc.calendrier(r.ctx, at ? new Date(at) : new Date());
  }

  /** R492/R7 — consigner un dépôt : acte humain, motivé, référencé. */
  @Post("obligations/:code/depot")
  depot(@Req() r: any, @Param("code") code: string, @Body() b: any) {
    return this.svc.consignerDepot(r.ctx, code, b ?? {});
  }

  /** R39/R44 — signaler les retards. Mesure et notifie ; ne dépose ni ne régularise. */
  @Post("signaler")
  signaler(@Req() r: any, @Body() b: any) {
    return this.svc.signaler(r.ctx, b?.at ? new Date(b.at) : new Date());
  }
}

@Module({ controllers: [ReglementaireController], providers: [ReglementaireFacade, ParametresService] })
export class ReglementaireModule {}
