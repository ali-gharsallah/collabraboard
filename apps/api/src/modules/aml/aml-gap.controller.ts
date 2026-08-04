import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { AmlGapService } from "./aml-gap.service";
import { AML_GAP_GT } from "./aml-gap.gt.gen";

/**
 * Porte HTTP de la vague AML Gap Wave 1 (R340→R377, blocs 50–56). Délégation pure : l'auteur est
 * le jeton (r.ctx), jamais le corps ; la RBAC (qualification 4-yeux) est portée par le service.
 * Endpoints livrés (worker `aml-eval`, backtest, BTL et statut DQ DIFFÉRÉS — Postgres/Redis) :
 *   GET  /v1/aml/scenarios                 — définitions + niveau/blocking (référentiel généré)
 *   GET  /v1/aml/signals?status=&fam=&clientId=  — inbox des signaux (FilterBar côté front)
 *   POST /v1/aml/signals                   — enregistrer un signal (déclenchement ; append-only, idempotent)
 *   POST /v1/aml/signals/:id/qualify       — qualifier TP/FP (motif obligatoire, R7)
 *   GET  /v1/aml/ground-truth              — corpus GT (lecture)
 */
@Controller("aml")
export class AmlGapController {
  constructor(private svc: AmlGapService) {}

  @Get("scenarios") scenarios() { return this.svc.referentiel(); }

  @Get("signals") signals(@Req() r: any, @Query() q: any) {
    return this.svc.signaux(r.ctx, { status: q.status, fam: q.fam, clientId: q.clientId });
  }

  @Post("signals") enregistrer(@Req() r: any, @Body() b: any) { return this.svc.enregistrerSignal(r.ctx, b); }

  @Post("signals/:id/qualify") qualify(@Req() r: any, @Param("id") id: string, @Body() b: any) {
    return this.svc.qualifier(r.ctx, id, b);
  }

  @Get("ground-truth") groundTruth() { return AML_GAP_GT; }
}
