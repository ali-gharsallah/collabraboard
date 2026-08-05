import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { AmlGapService } from "./aml-gap.service";
import { AmlEvalService } from "./aml-eval.service";
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
  constructor(private svc: AmlGapService, private worker: AmlEvalService) {}

  @Get("scenarios") scenarios() { return this.svc.referentiel(); }

  @Get("signals") signals(@Req() r: any, @Query() q: any) {
    return this.svc.signaux(r.ctx, { status: q.status, fam: q.fam, clientId: q.clientId });
  }

  @Post("signals") enregistrer(@Req() r: any, @Body() b: any) { return this.svc.enregistrerSignal(r.ctx, b); }

  // Pont Analytique 2G (bloc 61, R399–R403) : délègue la mesure au moteur CPSI Python, persiste le
  // signal si levé. { scenarioCode, clientId?, observation, date? } → { detection, signal }.
  @Post("signals/evaluate-2g") evaluer2G(@Req() r: any, @Body() b: any) { return this.svc.evaluer2G(r.ctx, b); }

  @Post("signals/:id/qualify") qualify(@Req() r: any, @Param("id") id: string, @Body() b: any) {
    return this.svc.qualifier(r.ctx, id, b);
  }

  @Get("ground-truth") groundTruth() { return AML_GAP_GT; }

  // Corpus GT en base (matière du worker aml-eval). Seed idempotent (rôles qualif) + lecture tenant-scopée.
  @Post("ground-truth/seed") seedGt(@Req() r: any) { return this.svc.seedGroundTruth(r.ctx); }

  @Get("ground-truth/db") groundTruthDb(@Req() r: any, @Query() q: any) {
    return this.svc.groundTruthDb(r.ctx, { fam: q.fam, label: q.label, scenarioCode: q.scenarioCode });
  }

  // Worker aml-eval — backtest du corpus semé (blocs 50–60) : mesure le rappel (R39), n'inonde pas
  // l'inbox. Bloc 61 (2G) différé (observation absente du corpus). → rapport { recall, parFamille… }.
  @Post("eval/backtest") backtest(@Req() r: any) { return this.worker.backtest(r.ctx); }

  // Détection LIVE : faits réels d'un client → signaux persistés (blocs 50–60). Le bloc 61 passe par
  // evaluate-2g. { clientId, facts, scenarios?, date? } → { evaluated, raised, signals, results }.
  @Post("eval/client") evalClient(@Req() r: any, @Body() b: any) { return this.worker.evaluerClient(r.ctx, b); }

  // Backtesting par version (GV-02, R375) : mesure l'impact d'une version candidate de seuils sur
  // le rappel AVANT application ; propose un rollback si dégradation (R44, décision humaine).
  @Post("eval/backtest-version") backtestVersion(@Req() r: any, @Body() b: any) { return this.worker.backtestVersion(r.ctx, b); }
}
