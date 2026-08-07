import { BadRequestException, Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { EsEventStore, EvenementEsLu } from "./es-event-store.service";
import { STREAM_FAITS } from "./es-subscriber.service";
import { STREAM_ALERTE, STREAM_EVIDENCE } from "./alertes.service";

/**
 * ES-3 (docs/SURVEILLANCE-ES.md §1) — BACK-TESTING PAR REJEU : « le back-testing est un rejeu,
 * pas une simulation approximative ». Un scénario (version + config DONNÉES) est exécuté sur les
 * FAITS D'ENTRÉE HISTORIQUES d'une période, déterministe de bout en bout :
 *   • l'ÉVALUATEUR est INJECTÉ (fonction pure fait → verdict) — ce module n'invente aucun
 *     détecteur (les évaluateurs restent AML 2G / CPSI, ou leur miroir de test) ;
 *   • les AlertesSimulees vivent dans le stream_type `backtest`, JAMAIS mêlées aux réelles
 *     (la projection file d'alertes ne lit que `alerte` — isolation structurelle) ;
 *   • exécution BORNÉE (periodeMaxJours paramétrable, défaut 365) ;
 *   • la LECTURE des faits passe par une connexion injectable (`lecture`) — prête pour un read
 *     replica ; défaut : la base courante ;
 *   • REPRODUCTIBLE : runId = hash(scenario, version, config, période) ; même entrée = même
 *     rapport — un run déjà exécuté renvoie SON rapport depuis le stream (BacktestExecute).
 * Rapport : volume simulé, volume réel de la période, recouvrement (clé = source_event_id des
 * faits déclencheurs), écarts dans les deux sens.
 */

export type VerdictScenario = { declenche: boolean; severite?: string };
export type EvaluateurScenario = (fait: EvenementEsLu) => VerdictScenario;

export type CommandeBacktest = {
  scenarioId: string; scenarioVersion: string; config: Record<string, unknown>;
  du: string; au: string;              // ISO — bornes de la période historique
  periodeMaxJours?: number;            // borne dure (défaut 365)
};

export type RapportBacktest = {
  runId: string; scenarioId: string; scenarioVersion: string; du: string; au: string;
  faitsEvalues: number; volumeSimule: number; volumeReel: number;
  concordantes: number; seulementSimulees: number; seulementReelles: number;
};

export const STREAM_BACKTEST = "backtest";
const PERIODE_MAX_JOURS_DEFAUT = 365;

type Lecture = { $queryRaw: PrismaService["$queryRaw"] };

@Injectable()
export class EsBacktest {
  constructor(private prisma: PrismaService, private store: EsEventStore) {}

  private runId(cmd: CommandeBacktest): string {
    const h = createHash("sha256")
      .update(JSON.stringify([cmd.scenarioId, cmd.scenarioVersion, cmd.config, cmd.du, cmd.au]))
      .digest("hex").slice(0, 16);
    return `bt-${cmd.scenarioId}@${cmd.scenarioVersion}-${h}`;
  }

  /** Faits d'entrée de la période — via la connexion de LECTURE (read replica prêt). */
  private async faitsPeriode(ctx: { tenantId: string }, du: string, au: string, lecture: Lecture) {
    const rows = await lecture.$queryRaw<any[]>`
      SELECT "id"::text AS id, "tenant_id"::text AS "tenantId", "stream_type" AS "streamType",
             "stream_id" AS "streamId", "seq", "type", "version", "payload",
             "source_event_id" AS "sourceEventId", "at"
      FROM "es"."events"
      WHERE "tenant_id" = ${ctx.tenantId}::uuid AND "stream_type" = ${STREAM_FAITS}
        AND "at" >= ${du}::timestamptz AND "at" <= ${au}::timestamptz
      ORDER BY "at" ASC, "seq" ASC`;
    return rows as EvenementEsLu[];
  }

  /** Clés (source_event_id) des faits déclencheurs des alertes RÉELLES de la période. */
  private async clesReelles(ctx: { tenantId: string }, du: string, au: string): Promise<Set<string>> {
    const alertes = await this.store.readTousParType(ctx, STREAM_ALERTE);
    const evidences = await this.store.readTousParType(ctx, STREAM_EVIDENCE);
    const cles = new Set<string>();
    for (const e of alertes) {
      if (e.type !== "AlerteLevee") continue;
      const at = new Date(e.at).getTime();
      if (at < new Date(du).getTime() || at > new Date(au).getTime()) continue;
      const ref = (e.payload as any).evidenceRef;
      const snap = evidences.find((x) => x.streamId === ref?.streamId && x.seq === ref?.seq);
      for (const f of ((snap?.payload as any)?.faits ?? []))
        if (f?.sourceEventId) cles.add(String(f.sourceEventId));
    }
    return cles;
  }

  async executerBacktest(ctx: { tenantId: string }, cmd: CommandeBacktest,
    evaluateur: EvaluateurScenario, opts?: { lecture?: Lecture }):
    Promise<{ deja: boolean; rapport: RapportBacktest }> {
    const jours = (new Date(cmd.au).getTime() - new Date(cmd.du).getTime()) / 86_400_000;
    if (!(jours >= 0)) throw new BadRequestException("ES-3 : période invalide (du > au ?)");
    const max = cmd.periodeMaxJours ?? PERIODE_MAX_JOURS_DEFAUT;
    if (jours > max)
      throw new BadRequestException(`ES-3 : période de ${Math.ceil(jours)} j > borne ${max} j — l'exécution est BORNÉE`);
    if (typeof evaluateur !== "function")
      throw new BadRequestException("ES-3 : évaluateur requis — ce module n'invente aucun détecteur");

    const runId = this.runId(cmd);
    // Stream PHYSIQUE scopé tenant (doctrine ES-1 : l'unicité du store est globale, sans tenant).
    const streamId = `${ctx.tenantId}:${runId}`;
    // Reproductibilité : un run déjà exécuté renvoie SON rapport (BacktestExecute au stream).
    const existant = await this.store.read(ctx, STREAM_BACKTEST, streamId);
    const fin = existant.find((e) => e.type === "BacktestExecute");
    if (fin) return { deja: true, rapport: (fin.payload as any).rapport as RapportBacktest };

    const lecture = opts?.lecture ?? this.prisma;
    const faits = await this.faitsPeriode(ctx, cmd.du, cmd.au, lecture);
    const simulees: { cle: string; severite: string; type: string }[] = [];
    for (const f of faits) {
      const v = evaluateur(f);
      if (v?.declenche) simulees.push({ cle: String(f.sourceEventId ?? `${f.streamId}#${f.seq}`),
        severite: v.severite ?? "MOYENNE", type: f.type });
    }
    const reelles = await this.clesReelles(ctx, cmd.du, cmd.au);
    const clesSim = new Set(simulees.map((s) => s.cle));
    const concordantes = [...clesSim].filter((c) => reelles.has(c)).length;
    const rapport: RapportBacktest = {
      runId, scenarioId: cmd.scenarioId, scenarioVersion: cmd.scenarioVersion, du: cmd.du, au: cmd.au,
      faitsEvalues: faits.length, volumeSimule: simulees.length, volumeReel: reelles.size,
      concordantes, seulementSimulees: clesSim.size - concordantes,
      seulementReelles: reelles.size - concordantes };

    // AlertesSimulees + rapport, dans le stream backtest ISOLÉ (jamais `alerte`).
    const evenements = [
      ...simulees.map((s) => ({ type: "AlerteSimulee", payload: { ...s,
        scenarioId: cmd.scenarioId, scenarioVersion: cmd.scenarioVersion, config: cmd.config } })),
      { type: "BacktestExecute", payload: { rapport, config: cmd.config } },
    ];
    await this.store.append(ctx, STREAM_BACKTEST, streamId, evenements, 0);
    return { deja: false, rapport };
  }
}
