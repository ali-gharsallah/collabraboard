import { Controller, Get, Post, Body, Param, Req } from "@nestjs/common";
import { CrmService } from "./crm.service";

/** Porte HTTP de la relation client (R186→R188). Délégation pure : la timeline projette,
 * le geste se motive, le conseil se trace — les refus et les traces sont dans le service
 * ratifié. Sans port IA injecté, preRemplir refuse explicitement (R138) : c'est voulu. */
@Controller("crm")
export class CrmController {
  constructor(private crm: CrmService) {}

  @Get("clients/:id/timeline")
  timeline(@Req() req: any, @Param("id") id: string) { return this.crm.timeline(req.ctx, id); }

  @Get("clients/:id/gestes")
  gestes(@Req() req: any, @Param("id") id: string) { return this.crm.prochainsGestes(req.ctx, id); }

  @Post("clients/:id/entretiens/pre-remplir")
  preRemplir(@Req() req: any, @Param("id") id: string, @Body() body: { type: string }) {
    return this.crm.preRemplir(req.ctx, id, body?.type);
  }

  @Post("clients/:id/entretiens")
  creer(@Req() req: any, @Param("id") id: string,
    @Body() body: { type: string; contenu: Record<string, any>; origineProposition?: string }) {
    return this.crm.creerCompteRendu(req.ctx, { clientId: id, ...body });
  }
}
