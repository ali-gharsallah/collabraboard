import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { AmlService } from "./aml.service";

/**
 * Porte HTTP de la surveillance AML (R189→R206). Délégation pure : la porte ne décide de
 * rien, le service porte l'évaluation et le refus. L'auteur est le jeton (r.ctx), jamais le
 * corps. Les seuils se pilotent par le registre R-Q existant (clés `aml*`) — l'onglet
 * « Paramétrages AML » n'est qu'une vue filtrée de /v1/parametres/registre.
 */
@Controller("aml")
export class AmlController {
  constructor(private svc: AmlService) {}
  @Post("evaluer")            evaluer(@Req() r: any, @Body() b: any) { return this.svc.evaluer(r.ctx, b); }            // R189→R206
  @Get("clients/:id/signaux") signaux(@Req() r: any, @Param("id") id: string) { return this.svc.signaux(r.ctx, id); } // consultation
}
