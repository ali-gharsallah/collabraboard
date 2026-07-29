import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { RiskCaseService } from "./risk-case.service";

/**
 * Porte HTTP des dossiers de risque (Vague 1, écran « File d'alertes »). La DÉCISION sur une
 * alerte = ouvrir un dossier de risque rattaché au(x) signal(aux) (R133 : jamais un cas vide).
 * Délégation pure : le service ratifié porte les invariants (R133→R136). Auteur = jeton (r.ctx).
 */
@Controller("riskcases")
export class RiskCaseController {
  constructor(private svc: RiskCaseService) {}
  @Post()                 ouvrir(@Req() r: any, @Body() b: any) { return this.svc.ouvrir(r.ctx, { clientId: b?.clientId, signalIds: b?.signalIds ?? [] }); } // R133
  @Post("consommer-proposition") consommer(@Req() r: any, @Body() b: any) {
    return this.svc.consommerProposition(r.ctx, b?.cle); }                // R280/UC-01 (porte d'entrée CPSI)
  @Get()                  liste(@Req() r: any, @Query("statut") statut?: string) { return this.svc.liste(r.ctx, statut); }
  @Post(":id/transition") transition(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.transitionner(r.ctx, id, b?.vers, b?.motif); } // R133/R136
  @Post(":id/notes")      noter(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.noter(r.ctx, id, b?.texte); }                     // R134 (instruction append-only)
  @Get(":id/notes")       notes(@Req() r: any, @Param("id") id: string) { return this.svc.notes(r.ctx, id); }
  @Post(":id/rattacher")  rattacher(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.rattacher(r.ctx, id, b?.signalId); } // R135/AW-05 (exposition P1)
  @Post(":id/detacher")   detacher(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.detacher(r.ctx, id, b?.signalId, b?.motif); } // R135/R7
}
