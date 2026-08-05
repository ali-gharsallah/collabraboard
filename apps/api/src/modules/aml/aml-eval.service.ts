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
import { OBSERVATIONS_2G } from "./aml-2g-fixtures";

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
   * Détection LIVE : évalue les FAITS RÉELS d'un client contre les scénarios de détection des blocs
   * 50–60 (paramètres tenant en vigueur, R29) et PERSISTE un signal pour chaque déclenchement
   * (chemin commun `enregistrerSignal` : append-only, idempotent, événement, `aml.block.requested`
   * pour un scénario bloquant). R44 : le moteur mesure et explique, l'humain qualifie (TP/FP dans
   * l'inbox). Un scénario dont les faits requis sont absents ne déclenche pas (NaN → false) — aucun
   * faux positif par omission. Le bloc 61 (2G) s'évalue par `evaluer2G` (observation + pont CPSI),
   * pas ici ; les campagnes/gouvernance (GV) ne sont pas per-client.
   */
  async evaluerClient(ctx: Ctx, dto: { clientId: string; facts?: Record<string, unknown>; scenarios?: string[]; date?: string }) {
    if (!dto?.clientId) throw new BadRequestException("clientId requis");
    const codes = dto.scenarios?.length
      ? dto.scenarios
      : AML_GAP_REFERENTIEL.filter((r) => r.bloc >= 50 && r.bloc <= 60 && r.kind === "detection").map((r) => r.id);
    const facts = { clientId: dto.clientId, asOf: new Date().toISOString(), tenantId: ctx.tenantId, ...(dto.facts ?? {}) };
    const results: { code: string; ruleRef: string; raised: boolean; blocking: boolean; explanation: string }[] = [];
    const signals: any[] = [];

    for (const code of codes) {
      const def = AML_GAP_REFERENTIEL.find((r) => r.id === code);
      if (!def) throw new BadRequestException(`[R340] scénario inconnu : ${code}`);
      if (def.bloc === BLOC_ANALYTIQUE_2G)
        throw new BadRequestException(`[décision 4] ${code} (Analytique 2G) s'évalue par POST /v1/aml/signals/evaluate-2g`);
      const detector = DETECTORS[code];
      if (!detector) continue;                                   // gouvernance/campagne sans détecteur per-client
      const v = await this.gap.versionEnVigueur(ctx, code, dto.date ? new Date(dto.date) : new Date());
      const res = await evaluateScenario(code, facts, v.params);
      results.push({ code, ruleRef: res.ruleRef, raised: res.raised, blocking: res.blocking, explanation: res.explanation });
      if (res.raised) {
        // Idempotence stable : les faits scellés dérivent des FAITS D'ENTRÉE + de la mesure, jamais
        // de l'instant d'évaluation. On retire `asOf` (horodatage volatile) du payload de détection
        // — sinon deux évaluations des mêmes faits produiraient deux idemKey distincts (doublon).
        const { asOf: _asOf, ...detection } = res.payload as Record<string, unknown>;
        const signal = await this.gap.enregistrerSignal(ctx, {
          scenarioCode: code, clientId: dto.clientId,
          faits: { facts: dto.facts ?? {}, detection, explanation: res.explanation }, date: dto.date,
        });
        signals.push(signal);
      }
    }
    await this.audit.log(ctx.tenantId, ctx.userId, "AML_EVAL_CLIENT", `${dto.clientId}: ${signals.length}/${results.length}`);
    return { clientId: dto.clientId, evaluated: results.length, raised: signals.length, signals, results };
  }

  /**
   * Backtesting PAR VERSION (GV-02, R375) : mesure l'impact d'un changement de seuils tenant AVANT
   * de l'appliquer. Rejoue le corpus (blocs 50–60) sous les paramètres EN VIGUEUR (baseline) puis
   * sous une VERSION CANDIDATE (baseline + surcharges) et compare le rappel. R44/R39 : le moteur
   * MESURE et PROPOSE un rollback si le rappel se dégrade — il n'applique rien, la décision est
   * humaine. `overrides` = { cléParam: valeur } appliqué à tout scénario portant cette clé. Le bloc
   * 61 (2G) n'entre pas dans la comparaison de version ici (seuils côté CPSI — lot dédié).
   */
  async backtestVersion(ctx: Ctx, dto: { overrides?: Record<string, unknown> }) {
    const overrides = dto?.overrides ?? {};
    if (!Object.keys(overrides).length) throw new BadRequestException("overrides requis (au moins un seuil candidat)");
    const cases: any[] = await this.prisma.groundTruthCase.findMany({ where: { tenantId: ctx.tenantId } });
    if (!cases.length) throw new BadRequestException("corpus GT non semé — POST /v1/aml/ground-truth/seed d'abord");

    const bloc = (code: string) => AML_GAP_REFERENTIEL.find((r) => r.id === code)?.bloc ?? null;
    let evaluated = 0, baseRaised = 0, candRaised = 0;
    const regressions: { caseId: string; scenarioCode: string; label: string }[] = [];   // rappel PERDU
    const improvements: { caseId: string; scenarioCode: string; label: string }[] = [];   // rappel GAGNÉ
    const touched = new Set<string>();

    for (const c of cases) {
      if (bloc(c.scenarioCode) === BLOC_ANALYTIQUE_2G) continue;                  // 2G hors comparaison ici
      const detector = DETECTORS[c.scenarioCode];
      if (!detector) continue;
      const v = await this.gap.versionEnVigueur(ctx, c.scenarioCode);
      const baseParams = v.params as Record<string, unknown>;
      const candParams: Record<string, unknown> = { ...baseParams };
      for (const [k, val] of Object.entries(overrides)) if (k in candParams) { candParams[k] = val; touched.add(c.scenarioCode); }
      const facts = { clientId: c.caseId, asOf: new Date().toISOString(), tenantId: ctx.tenantId, ...detector.trigger() };
      const rb = await evaluateScenario(c.scenarioCode, facts, baseParams);
      const rc = await evaluateScenario(c.scenarioCode, facts, candParams);
      evaluated++;
      if (rb.raised) baseRaised++;
      if (rc.raised) candRaised++;
      if (rb.raised && !rc.raised) regressions.push({ caseId: c.caseId, scenarioCode: c.scenarioCode, label: c.label });
      if (!rb.raised && rc.raised) improvements.push({ caseId: c.caseId, scenarioCode: c.scenarioCode, label: c.label });
    }

    const recallBefore = evaluated ? baseRaised / evaluated : 0;
    const recallAfter = evaluated ? candRaised / evaluated : 0;
    const degradation = recallAfter < recallBefore;                              // R375 : perte de rappel
    const report = {
      overrides, scenariosTouches: [...touched].sort(), evaluated,
      recallBefore, recallAfter, degradation, rollbackPropose: degradation,       // R44 : proposition, pas décision
      regressions, improvements,
    };
    await this.prisma.$transaction(async (tx: Tx) => {
      await emitEvent(tx, ctx.tenantId, "aml.eval.version_compared", "backtest-version", {
        overrides, recallBefore, recallAfter, degradation, regressions: regressions.length, par: ctx.userId,
      });
    });
    await this.audit.log(ctx.tenantId, ctx.userId, "AML_EVAL_VERSION",
      `rappel ${(recallBefore * 100).toFixed(1)}%→${(recallAfter * 100).toFixed(1)}% (${degradation ? "DÉGRADÉ, rollback proposé" : "OK"})`);
    return report;
  }

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

    let via2G = 0;
    for (const c of cases) {
      let res: { raised: boolean };
      if (bloc(c.scenarioCode) === BLOC_ANALYTIQUE_2G) {
        // Bloc 61 : observation de backtest (fixture 2G) → mesure via le pont CPSI (jamais en Nest).
        const fixture = OBSERVATIONS_2G[c.scenarioCode];
        if (!fixture) { deferred++; continue; }                                   // AN sans fixture → différé
        res = await this.gap.mesurer2G(ctx, c.scenarioCode, fixture());
        via2G++;
      } else {
        const detector = DETECTORS[c.scenarioCode];
        if (!detector) { unmapped++; continue; }                                  // garde : scénario sans détecteur
        const v = await this.gap.versionEnVigueur(ctx, c.scenarioCode);
        const clientRef = (c.payload && (c.payload as any).clientRef) || c.caseId;
        const facts = { clientId: String(clientRef), asOf: new Date().toISOString(), tenantId: ctx.tenantId, ...detector.trigger() };
        res = await evaluateScenario(c.scenarioCode, facts, v.params);
      }
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
      via2G, deferred2G: deferred, unmapped, parFamille: parFamilleView, misses,
    };
    await this.prisma.$transaction(async (tx: Tx) => {
      await emitEvent(tx, ctx.tenantId, "aml.eval.completed", "backtest", {
        corpus: report.corpus, evaluated, raised, recall, via2G, deferred2G: deferred, par: ctx.userId,
      });
    });
    await this.audit.log(ctx.tenantId, ctx.userId, "AML_EVAL_BACKTEST",
      `${raised}/${evaluated} rappel ${(recall * 100).toFixed(1)}% (2G différés: ${deferred})`);
    return report;
  }
}
