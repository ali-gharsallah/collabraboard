import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { IslamicService } from "./islamic.service";

/**
 * Porte HTTP de la couche Shariah (R207→R221). Délégation pure : la porte ne décide de rien,
 * le service porte l'évaluation, le refus (maysir R209) et les calculs. L'auteur est le jeton
 * (r.ctx), jamais le corps. Les seuils se pilotent par le registre R-Q (clés `islamic*`).
 */
@Controller("islamic")
export class IslamicController {
  constructor(private svc: IslamicService) {}
  @Post("evaluer")            evaluer(@Req() r: any, @Body() b: any) { return this.svc.evaluer(r.ctx, b); }              // R207→R213/R216/R221
  @Get("clients/:id/signaux") signaux(@Req() r: any, @Param("id") id: string) { return this.svc.signaux(r.ctx, id); }
  @Get("clients/:id/zakat")   zakatHisto(@Req() r: any, @Param("id") id: string) { return this.svc.zakatHistorique(r.ctx, id); }
  @Post("zakat")              zakat(@Req() r: any, @Body() b: any) { return this.svc.zakat(r.ctx, b); }                  // R211
  @Post("mudaraba")           mudaraba(@Req() r: any, @Body() b: any) { return this.svc.mudaraba(r.ctx, b); }            // R215
  @Post("waqf/retrait")       waqf(@Req() r: any, @Body() b: any) { return this.svc.waqfRetrait(r.ctx, b); }             // R218
  @Post("qard")               qard(@Req() r: any, @Body() b: any) { return this.svc.qard(r.ctx, b); }                    // R214
  @Post("takaful")            takaful(@Req() r: any, @Body() b: any) { return this.svc.takaful(r.ctx, b); }              // R219
  @Post("sukuk/maturite")     sukuk(@Req() r: any, @Body() b: any) { return this.svc.sukukMaturite(r.ctx, b); }          // R220
  @Post("audit")              audit(@Req() r: any, @Body() b: any) { return this.svc.audit_(r.ctx, b); }                 // R217
}
