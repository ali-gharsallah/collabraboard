import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
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
import { AmlEvalQueue, defaultQueue, makeJob } from "./aml-eval.queue";

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
// Rôles habilités à générer la revue de calibrage (acte de gouvernance, four-eyes — R13).
const ROLES_GOUV = new Set(["CO", "CO_SR", "MLRO", "ADMIN"]);

@Injectable()
export class AmlEvalService {
  // File de dispatch (singleton du provider) : mémoire par défaut, Redis si REDIS_URL (doctrine rate-limit).
  private queue: AmlEvalQueue = defaultQueue();
  constructor(private prisma: PrismaService, private audit: AuditService, private gap: AmlGapService) {}

  /**
   * Dispatch ASYNCHRONE (R39 : mesurer, ne pas bloquer le flux appelant) : met une évaluation client
   * EN FILE (par tenant) sans rien calculer. Le `drain` (tick du worker) la traite plus tard →
   * signaux persistés. In-process (mémoire) ou distribué (Redis) selon `REDIS_URL`, sans changer le
   * contrat. Le job porte l'auteur (jeton) pour l'attribution à la reprise.
   */
  async enqueueClient(ctx: Ctx, dto: { clientId: string; facts?: Record<string, unknown>; scenarios?: string[]; date?: string }) {
    if (!dto?.clientId) throw new BadRequestException("clientId requis");
    const job = makeJob("client", ctx.userId, ctx.role, dto);
    await this.queue.enqueue(ctx.tenantId, job);
    return { jobId: job.id, status: "queued", backend: this.queue.backend, pending: await this.queue.size(ctx.tenantId) };
  }

  /**
   * Tick du worker : draine la file DU TENANT appelant (jamais celle d'un autre — scope R44) et
   * traite chaque job via le cœur d'évaluation. Borné par `max` (pas de boucle infinie). L'auteur
   * du signal reste celui qui a mis en file (job.userId), pas le drainer.
   */
  async drain(ctx: Ctx, max = 100) {
    const results: { jobId: string; clientId: string; raised: number }[] = [];
    for (let i = 0; i < max; i++) {
      const job = await this.queue.dequeue(ctx.tenantId);
      if (!job) break;
      if (job.kind !== "client") continue;
      const jobCtx: Ctx = { tenantId: ctx.tenantId, userId: job.userId, role: job.role };
      const res = await this.evaluerClient(jobCtx, job.payload as any);
      results.push({ jobId: job.id, clientId: res.clientId, raised: res.raised });
    }
    await this.audit.log(ctx.tenantId, ctx.userId, "AML_EVAL_DRAIN", `${results.length} job(s) traité(s)`);
    return { processed: results.length, restant: await this.queue.size(ctx.tenantId), backend: this.queue.backend, results };
  }

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
   * Contrôle Data-Quality (GV-03, R376) : pré-condition des scénarios. Mesure la COMPLÉTUDE des
   * champs critiques d'un lot de flux ; sous `completude_min` (R-Q GV-03), les scénarios DÉPENDANTS
   * sont marqués « dégradés » et un signal DQ_DEGRADED (Niveau 1, ops) est PERSISTÉ dans l'inbox —
   * visible au dashboard Compliance, JAMAIS silencieux (esprit dead-letters, R39 : un scénario
   * aveugle est un faux négatif silencieux). Le rapport est toujours rendu (mesure), qu'il y ait
   * dégradation ou non. `dependances` = { champ: [scénarios] } (config tenant) — sinon la dégradation
   * est signalée au niveau flux sans imputation par scénario.
   */
  async controleDQ(ctx: Ctx, dto: { flux?: Record<string, unknown>[]; champsCritiques?: string[]; dependances?: Record<string, string[]> }) {
    const flux = dto?.flux ?? [];
    const champs = dto?.champsCritiques ?? [];
    if (!champs.length) throw new BadRequestException("champsCritiques requis (au moins un champ)");
    const gv = await this.gap.versionEnVigueur(ctx, "GV-03");
    const completudeMin = Number((gv.params as any).completude_min ?? 98);
    const total = flux.length;
    const present = (r: Record<string, unknown>, champ: string) => {
      const v = r[champ];
      return v !== null && v !== undefined && String(v).trim() !== "";
    };
    const parChamp = champs.map((champ) => {
      const n = flux.filter((r) => present(r, champ)).length;
      const completude = total ? (n / total) * 100 : 100;                        // lot vide → réputé complet
      return { champ, present: n, total, completude, degrade: completude < completudeMin };
    });
    const degrades = parChamp.filter((c) => c.degrade);
    const scenariosDegrades = [...new Set(degrades.flatMap((c) => dto.dependances?.[c.champ] ?? []))].sort();

    let signal: any = null;
    if (degrades.length) {
      // « Jamais silencieux » : le flux dégradé DEVIENT un signal visible (Niveau 1 ops), pas un log.
      signal = await this.gap.enregistrerSignal(ctx, {
        scenarioCode: "GV-03", clientId: null,
        faits: {
          completudeMin, scenariosDegrades,
          champsDegrades: degrades.map((c) => ({ champ: c.champ, completude: Number(c.completude.toFixed(2)) })),
        },
      });
      await this.prisma.$transaction(async (tx: Tx) => {
        await emitEvent(tx, ctx.tenantId, "dq.degraded", "GV-03", {
          champsDegrades: degrades.map((c) => c.champ), scenariosDegrades, completudeMin, par: ctx.userId,
        });
      });
    }
    await this.audit.log(ctx.tenantId, ctx.userId, "AML_DQ_CONTROLE",
      `${degrades.length} champ(s) dégradé(s) < ${completudeMin}% sur ${total} flux`);
    return {
      total, completudeMin, parChamp,
      champsDegrades: degrades.map((c) => c.champ), scenariosDegrades,
      degraded: degrades.length > 0, signal,
    };
  }

  /**
   * Campagne Below-The-Line (GV-01, R374) : échantillonne les transactions JUSTE SOUS le seuil d'un
   * scénario pour revue Compliance — si des TP se cachent sous la ligne, le calibrage est trop haut.
   * Config de campagne = paramètres tenant de GV-01 (bande, taux d'échantillon) ; seuil = paramètre
   * du scénario CIBLE (R29). Échantillon STRATIFIÉ DÉTERMINISTE (couverture régulière de la bande,
   * aucun RNG) → traçable et rejouable. R44/R39 : la campagne PROPOSE un échantillon, elle ne décide
   * rien ; un TP sous seuil alimente une proposition de baisse (backtest-version), décision humaine.
   * Émet `tuning.btl.campagne`. Le bloc 61 (2G) relève d'une campagne CPSI — refusé ici.
   */
  async campagneBTL(ctx: Ctx, dto: { scenarioCode: string; population?: { ref: string; metric: number }[] }) {
    if (!dto?.scenarioCode) throw new BadRequestException("scenarioCode requis");
    const def = AML_GAP_REFERENTIEL.find((r) => r.id === dto.scenarioCode);
    if (!def) throw new NotFoundException(`[R340] scénario inconnu : ${dto.scenarioCode}`);
    if (def.bloc === BLOC_ANALYTIQUE_2G)
      throw new BadRequestException(`[décision 4] ${dto.scenarioCode} (2G) relève d'une campagne BTL côté CPSI`);
    const population = dto.population ?? [];

    // Seuil du scénario cible = premier paramètre NUMÉRIQUE en vigueur (le seuil de déclenchement).
    const target = await this.gap.versionEnVigueur(ctx, dto.scenarioCode);
    const seuilKey = def.params.map((p) => p.key).find((k) => typeof (target.params as any)[k] === "number");
    if (!seuilKey) throw new BadRequestException(`${dto.scenarioCode} n'a pas de seuil numérique — BTL non applicable`);
    const seuil = Number((target.params as any)[seuilKey]);

    // Config de campagne = paramètres GV-01 (bande % du seuil, taux d'échantillonnage).
    const gv = await this.gap.versionEnVigueur(ctx, "GV-01");
    const [lowPct, highPct] = String((gv.params as any).bande_btl ?? "80-100").split("-").map((s) => Number(s));
    const taux = Number((gv.params as any).taux_echantillon_btl ?? 2);
    const low = (lowPct / 100) * seuil, high = (highPct / 100) * seuil;         // [80% du seuil, seuil)

    const inBand = population
      .filter((x) => Number(x.metric) >= low && Number(x.metric) < high)         // sous la ligne, pas déjà en alerte
      .sort((a, b) => a.metric - b.metric);
    const sampleSize = inBand.length ? Math.max(1, Math.ceil((inBand.length * taux) / 100)) : 0;
    const sample = this.stratifie(inBand, sampleSize);                           // couverture régulière de la bande

    await this.prisma.$transaction(async (tx: Tx) => {
      await emitEvent(tx, ctx.tenantId, "tuning.btl.campagne", dto.scenarioCode, {
        scenarioCode: dto.scenarioCode, seuilKey, seuil, bande: [low, high], bandePct: [lowPct, highPct],
        taux, populationInBand: inBand.length, sampleSize, par: ctx.userId,
      });
    });
    await this.audit.log(ctx.tenantId, ctx.userId, "AML_BTL_CAMPAGNE",
      `${dto.scenarioCode}: ${sampleSize}/${inBand.length} sous seuil ${seuil}`);
    return {
      scenarioCode: dto.scenarioCode, seuilKey, seuil, bandePct: [lowPct, highPct], bande: { low, high }, taux,
      populationTotal: population.length, populationInBand: inBand.length, sampleSize, sample,
      next: "revue Compliance — un TP sous seuil ⇒ proposer une baisse via backtest-version (décision humaine)",
    };
  }

  /**
   * Revue annuelle de calibrage (GV-04, R377) : consolide la COUVERTURE (matrice typologies ×
   * scénarios, par famille), la PERFORMANCE par scénario (corpus GT + signaux live TP/FP) et les
   * ÉCARTS (angles morts sans matière ; placeholders documentés laissés vides par la spec — jamais
   * comblés, R « never invent »). R44 : le système CONSOLIDE et propose un rapport ; le visa
   * four-eyes + l'archivage GED restent des actes humains. Émet `tuning.calibrage.annuel`.
   */
  async revueCalibrageAnnuelle(ctx: Ctx) {
    if (!ROLES_GOUV.has(ctx.role))
      throw new BadRequestException(`[R13] rôle « ${ctx.role} » non habilité à générer la revue de calibrage`);
    const gv = await this.gap.versionEnVigueur(ctx, "GV-04");
    const matriceReference = String((gv.params as any).matrice_couverture ?? "GAFI+OBA-FINMA");

    const [gtRows, sigRows, scenRows] = await Promise.all([
      this.prisma.groundTruthCase.findMany({ where: { tenantId: ctx.tenantId } }),
      this.prisma.amlGapSignal.findMany({ where: { tenantId: ctx.tenantId } }),
      this.prisma.amlScenario.findMany({ where: { tenantId: ctx.tenantId, active: true } }),
    ]);
    const versionOf = new Map<string, number>();
    for (const s of scenRows as any[]) versionOf.set(s.code, Math.max(versionOf.get(s.code) ?? 1, s.version));

    const scenarios = AML_GAP_REFERENTIEL.map((r) => {
      const gt = gtRows.filter((g: any) => g.scenarioCode === r.id);
      const placeholders = gt.filter((g: any) => (g.payload as any)?.placeholder === true).length;
      const gtReels = gt.length - placeholders;
      const gtTp = gt.filter((g: any) => g.label === "TP" && (g.payload as any)?.placeholder !== true).length;
      const sig = sigRows.filter((s: any) => s.scenarioCode === r.id);
      const live = {
        total: sig.length,
        tp: sig.filter((s: any) => s.status === "TP").length,
        fp: sig.filter((s: any) => s.status === "FP").length,
        nouveaux: sig.filter((s: any) => s.status === "NEW").length,
        escalades: sig.filter((s: any) => s.status === "ESCALATED").length,
      };
      return {
        code: r.id, ruleRef: r.ruleRef, famille: r.famille, bloc: r.bloc, niveau: r.niveau, blocking: r.blocking,
        version: versionOf.get(r.id) ?? 1,
        gt: { total: gtReels, tp: gtTp, fp: gtReels - gtTp, placeholders },
        live, couvert: gtReels > 0 || sig.length > 0,
      };
    });

    const parFamille: Record<string, { total: number; couverts: number; gtTp: number; gtFp: number; liveTp: number; liveFp: number }> = {};
    for (const s of scenarios) {
      const f = parFamille[s.famille] ?? (parFamille[s.famille] = { total: 0, couverts: 0, gtTp: 0, gtFp: 0, liveTp: 0, liveFp: 0 });
      f.total++; if (s.couvert) f.couverts++;
      f.gtTp += s.gt.tp; f.gtFp += s.gt.fp; f.liveTp += s.live.tp; f.liveFp += s.live.fp;
    }
    const anglesMorts = scenarios.filter((s) => !s.couvert).map((s) => s.code);
    const placeholdersDocumentes = scenarios.filter((s) => s.gt.placeholders > 0)
      .map((s) => ({ code: s.code, ruleRef: s.ruleRef, count: s.gt.placeholders }));
    const couverts = scenarios.filter((s) => s.couvert).length;
    const couverture = { totalScenarios: scenarios.length, couverts, sansMatiere: anglesMorts.length,
      tauxCouverture: scenarios.length ? couverts / scenarios.length : 0, familles: Object.keys(parFamille).length };

    await this.prisma.$transaction(async (tx: Tx) => {
      await emitEvent(tx, ctx.tenantId, "tuning.calibrage.annuel", "GV-04", {
        matriceReference, ...couverture, anglesMorts: anglesMorts.length,
        placeholders: placeholdersDocumentes.length, par: ctx.userId,
      });
    });
    await this.audit.log(ctx.tenantId, ctx.userId, "AML_CALIBRAGE_ANNUEL",
      `${couverts}/${scenarios.length} scénarios couverts, ${anglesMorts.length} angle(s) mort(s)`);
    return {
      matriceReference, generePar: ctx.userId, couverture, parFamille,
      anglesMorts, placeholdersDocumentes, scenarios,
      visa: { requis: true, note: "revue à VISER four-eyes puis ARCHIVER en GED — acte humain (R44)" },
    };
  }

  /** Échantillon stratifié déterministe : k éléments régulièrement espacés sur la bande triée. */
  private stratifie<T>(sorted: T[], k: number): T[] {
    if (k <= 0 || sorted.length === 0) return [];
    if (k >= sorted.length) return [...sorted];
    if (k === 1) return [sorted[Math.floor((sorted.length - 1) / 2)]];          // médiane = plus représentatif
    const picked = new Set<number>();
    for (let i = 0; i < k; i++) picked.add(Math.round((i * (sorted.length - 1)) / (k - 1)));
    return [...picked].sort((a, b) => a - b).map((i) => sorted[i]);
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
