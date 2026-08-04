import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { emitEvent } from "../../common/domain-event";
import { Tx } from "../../common/tx";
import { AmlGapService } from "./aml-gap.service";
import { AML_GAP_REFERENTIEL } from "./aml-gap.referentiel.gen";
// Moteur de détection blocs 50–60 (source unique, partagée avec les suites backend-tests). Le
// worker l'exécute CÔTÉ SERVEUR sur le corpus semé — les détecteurs ne sont PAS redéfinis ici.
import { evaluateScenario } from "../../../../../src/aml/engine";
import { DETECTORS } from "../../../../../src/aml/detectors";

/**
 * AmlEvalService — le worker `aml-eval` (backtest / recall). Il ÉVALUE le corpus GT semé en base à
 * travers le moteur de détection (blocs 50–60, R44 : mesure, ne décide rien) et MESURE le rappel :
 * sémantique du corpus (décision 5) — un cas TP ET un cas FP DOIVENT déclencher (le FP est une
 * alerte légitime écartée en investigation). Un rappel < 100 % sur les blocs implémentés = une
 * régression de détecteur ou de paramètre.
 *
 * R39 (mesurer, pas coercer) : le backtest N'INONDE PAS l'inbox — il produit un RAPPORT et émet
 * `aml.eval.completed` (auditable). La détection LIVE (faits réels d'un client → signaux persistés)
 * et le dispatch ASYNCHRONE (file Redis quand REDIS_URL, in-process sinon — même doctrine que le
 * rate-limit) sont des surfaces distinctes au-dessus de ce cœur d'évaluation.
 *
 * Bloc 61 (Analytique 2G) : le corpus ne porte pas d'observation statistique (distribution de
 * pairs, séries…) — le worker le compte comme DÉFÉRÉ (le pont 2G exige une observation, cf.
 * evaluer2G) plutôt que de fabriquer des faits. L'invariant tient : rien n'est réécrit en Nest.
 */

type Ctx = { tenantId: string; userId: string; role: string };
const BLOC_ANALYTIQUE_2G = 61;

@Injectable()
export class AmlEvalService {
  constructor(private prisma: PrismaService, private audit: AuditService, private gap: AmlGapService) {}

  /**
   * Backtest du corpus GT semé (blocs 50–60) : rejoue chaque cas à travers le moteur avec les
   * paramètres tenant en vigueur (R29) et mesure le rappel global + par famille. Les faits
   * déclencheurs proviennent du détecteur du scénario (source unique des suites) — le worker ne
   * fabrique aucune règle. Idempotent : lecture seule + un événement de mesure.
   */
  async backtest(ctx: Ctx) {
    const cases: any[] = await this.prisma.groundTruthCase.findMany({ where: { tenantId: ctx.tenantId } });
    if (!cases.length)
      throw new BadRequestException("corpus GT non semé — POST /v1/aml/ground-truth/seed d'abord");

    const bloc = (code: string) => AML_GAP_REFERENTIEL.find((r) => r.id === code)?.bloc ?? null;
    const parFamille: Record<string, { total: number; raised: number }> = {};
    const misses: { caseId: string; scenarioCode: string; label: string }[] = [];
    let evaluated = 0, raised = 0, deferred = 0, unmapped = 0;

    for (const c of cases) {
      if (bloc(c.scenarioCode) === BLOC_ANALYTIQUE_2G) { deferred++; continue; }  // 2G → pont CPSI, observation requise
      const detector = DETECTORS[c.scenarioCode];
      if (!detector) { unmapped++; continue; }                                    // garde : scénario sans détecteur
      const v = await this.gap.versionEnVigueur(ctx, c.scenarioCode);
      const clientRef = (c.payload && (c.payload as any).clientRef) || c.caseId;
      const facts = { clientId: String(clientRef), asOf: new Date().toISOString(), tenantId: ctx.tenantId, ...detector.trigger() };
      const res = await evaluateScenario(c.scenarioCode, facts, v.params);
      evaluated++;
      const fam = parFamille[c.fam] ?? (parFamille[c.fam] = { total: 0, raised: 0 });
      fam.total++;
      if (res.raised) { raised++; fam.raised++; } else misses.push({ caseId: c.caseId, scenarioCode: c.scenarioCode, label: c.label });
    }

    const recall = evaluated ? raised / evaluated : 0;
    const parFamilleView = Object.fromEntries(
      Object.entries(parFamille).map(([f, s]) => [f, { total: s.total, raised: s.raised, recall: s.total ? s.raised / s.total : 0 }]),
    );
    const report = {
      corpus: cases.length, evaluated, raised, recall,
      deferred2G: deferred, unmapped, parFamille: parFamilleView, misses,
    };
    await this.prisma.$transaction(async (tx: Tx) => {
      await emitEvent(tx, ctx.tenantId, "aml.eval.completed", "backtest", {
        corpus: report.corpus, evaluated, raised, recall, deferred2G: deferred, par: ctx.userId,
      });
    });
    await this.audit.log(ctx.tenantId, ctx.userId, "AML_EVAL_BACKTEST",
      `${raised}/${evaluated} rappel ${(recall * 100).toFixed(1)}% (2G différés: ${deferred})`);
    return report;
  }
}
