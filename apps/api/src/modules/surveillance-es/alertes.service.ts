import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { EsEventStore } from "./es-event-store.service";
import { TasksService } from "../tasks/tasks.module";
import { rejouer, deciderLever, deciderAssigner, deciderDisposer, EtatAlerte, RefEvidence }
  from "./alerte.aggregate";

/**
 * ES-2 (docs/SURVEILLANCE-ES.md §3) — service de l'agrégat Alerte.
 * AUCUNE table d'état : chaque commande relit le stream, `rejouer` reconstruit l'état, la
 * décision (agrégat pur) produit les événements, le store les append sous verrou optimiste
 * (version = seq du dernier événement appliqué). Ce module N'INVENTE AUCUN DÉTECTEUR : `lever`
 * REÇOIT le verdict d'un évaluateur existant (AML 2G / CPSI, consommés en faits d'entrée) avec
 * les faits déclencheurs — et FIGE l'evidence AVANT la levée (invariant 3 : l'alerte référence
 * un snapshot immuable ; l'investigateur voit ce que le moteur a vu).
 * Sorties (invariant 4, R44) : une disposition VRAI_POSITIF émet une PROPOSITION par l'API
 * existante TasksService.creerDepuisEvenement (R239 — hors du contexte Surveillance gardé par
 * la frontière L3), compte de service `surveillance-es@1` — jamais d'écriture directe dans les
 * tables métier du monolithe, jamais d'exécution (gel/PEPisation/clôture restent humains).
 */

export const ACTEUR_ES = "surveillance-es@1";
/** La chaîne d'audit (audit_logs.actor) exige un UUID : le compte de service EST cet UUID
 *  FIXE et documenté ; l'identité lisible (ACTEUR_ES) voyage dans l'origine des tâches et la
 *  trace PropositionEmise du stream — les deux se recoupent. */
export const ACTEUR_ES_UUID = "00000000-0000-4000-8000-00000000e5e5";
export const STREAM_ALERTE = "alerte";
export const STREAM_EVIDENCE = "evidence";

type Ctx = { tenantId: string };

export type CommandeLever = {
  alerteId?: string;
  scenarioId: string; scenarioVersion: string; configRef: string; severite: string;
  /** Faits d'entrée déclencheurs (copies VERBATIM — lus des streams fait-entree) + paramètres à date. */
  faits: unknown[]; parametres: unknown;
};

@Injectable()
export class EsAlertes {
  constructor(private store: EsEventStore, private tasks: TasksService) {}

  private ctxService(ctx: Ctx) { return { tenantId: ctx.tenantId, userId: ACTEUR_ES_UUID, role: "SYSTEM" }; }

  async etat(ctx: Ctx, alerteId: string): Promise<EtatAlerte | null> {
    return rejouer(alerteId, await this.store.read(ctx, STREAM_ALERTE, alerteId));
  }

  /** Le snapshot pointé par une evidenceRef — relu du store, où il est immuable par trigger. */
  async evidence(ctx: Ctx, ref: RefEvidence) {
    const evs = await this.store.read(ctx, ref.streamType, ref.streamId);
    return evs.find((e) => e.seq === ref.seq) ?? null;
  }

  /** Lève une alerte : FIGE d'abord l'evidence (stream dédié), puis AlerteLevee la référence. */
  async lever(ctx: Ctx, cmd: CommandeLever) {
    const alerteId = cmd.alerteId ?? randomUUID();
    await this.store.append(ctx, STREAM_EVIDENCE, alerteId,
      [{ type: "EvidenceFigee", payload: { alerteId, scenarioId: cmd.scenarioId,
          scenarioVersion: cmd.scenarioVersion, configRef: cmd.configRef,
          faits: cmd.faits, parametres: cmd.parametres, figeePar: ACTEUR_ES } }],
      await this.store.derniereSeq(ctx, STREAM_EVIDENCE, alerteId));
    const evidenceRef: RefEvidence = { streamType: STREAM_EVIDENCE, streamId: alerteId,
      seq: await this.store.derniereSeq(ctx, STREAM_EVIDENCE, alerteId) };
    const etat = await this.etat(ctx, alerteId);
    const evenements = deciderLever(etat, { scenarioId: cmd.scenarioId,
      scenarioVersion: cmd.scenarioVersion, configRef: cmd.configRef, evidenceRef, severite: cmd.severite });
    await this.store.append(ctx, STREAM_ALERTE, alerteId, evenements, etat?.version ?? 0);
    return { alerteId, evidenceRef };
  }

  async assigner(ctx: Ctx, alerteId: string, a: string) {
    const etat = await this.etat(ctx, alerteId);
    await this.store.append(ctx, STREAM_ALERTE, alerteId, deciderAssigner(etat, a), etat?.version ?? 0);
    return this.etat(ctx, alerteId);
  }

  /**
   * Dispose l'alerte. VRAI_POSITIF = une action monolithe est requise → PROPOSITION via l'API
   * tâches (compte de service), tracée dans le stream (PropositionEmise). La tâche est créée
   * AVANT l'append : si l'append échoue, une tâche orpheline attend un humain (revue inoffensive) —
   * l'inverse (disposition sans proposition) serait une action réglementaire perdue.
   */
  async disposer(ctx: Ctx, alerteId: string, cmd: { decision: string; motif: string; par: string }) {
    const etat = await this.etat(ctx, alerteId);
    const evenements = deciderDisposer(etat, cmd);
    if (cmd.decision === "VRAI_POSITIF") {
      const tache = await this.tasks.creerDepuisEvenement(this.ctxService(ctx), {
        origine: `surveillance-es:alerte:${alerteId}`, type: "REVUE_ALERTE_SURVEILLANCE",
        subjectType: "alerte_es", subjectId: alerteId, assignee: "COMPLIANCE" });
      evenements.push({ type: "PropositionEmise", payload: {
        taskId: tache.id, via: "tasks.creerDepuisEvenement", acteur: ACTEUR_ES, decision: cmd.decision } });
    }
    await this.store.append(ctx, STREAM_ALERTE, alerteId, evenements, etat!.version);
    return this.etat(ctx, alerteId);
  }
}
