import { BadRequestException, Injectable } from "@nestjs/common";
import { EsEventStore, EvenementEsLu } from "./es-event-store.service";
import { EvaluateurScenario } from "./es-backtest.service";
import { STREAM_FAITS } from "./es-subscriber.service";

/**
 * ES-4 (docs/SURVEILLANCE-ES.md §3 invariant 6) — PARALLEL RUN (mode shadow) + RÉCONCILIATION.
 * ES évalue le corpus EN PARALLÈLE des évaluations existantes SANS émettre une seule proposition
 * réelle : ce service n'a STRUCTURELLEMENT aucun accès au canal de proposition (pas de
 * TasksService injecté — l'impossibilité est architecturale, pas un if) ; tout vit dans le
 * stream_type `shadow` (AlerteShadow, PropositionShadow, ReconciliationExecutee). Le rapport
 * évalue EXPLICITEMENT (oui/non) les critères de bascule : (1) zéro alerte existante manquée
 * par ES sur le corpus ; (2) écarts additionnels TOUS expliqués (un écart sans diagnostic =
 * critère NON). La bascule elle-même (shadow=false) N'EST PAS ici — décision humaine (§3.6).
 */

export const STREAM_SHADOW = "shadow";

export type AlerteExistante = { cle: string; source: string };   // cle = source_event_id déclencheur

export type RapportReconciliation = {
  corpusId: string; faitsEvalues: number;
  concordantes: string[];
  seulementEs: { cle: string; diagnostic: string | null }[];
  seulementExistantes: { cle: string; source: string; diagnostic: string | null }[];
  criteres: {
    zeroAlerteExistanteManqueeParEs: boolean;
    ecartsAdditionnelsTousExpliques: boolean;
    basculePermise: boolean;                       // ET logique — la DÉCISION reste humaine
  };
};

@Injectable()
export class EsShadow {
  constructor(private store: EsEventStore) {}

  async executerShadow(ctx: { tenantId: string }, cmd: {
    corpusId: string; evaluateur: EvaluateurScenario;
    existantes: AlerteExistante[];
    /** Diagnostics des écarts (cle → explication) — un écart NON diagnostiqué casse le critère 2. */
    diagnostics?: Record<string, string>;
  }): Promise<{ deja: boolean; rapport: RapportReconciliation }> {
    if (!cmd?.corpusId?.trim()) throw new BadRequestException("ES-4 : corpusId requis");
    const streamId = `${ctx.tenantId}:${cmd.corpusId}`;          // doctrine ES-1 : stream scopé tenant
    const existant = await this.store.read(ctx, STREAM_SHADOW, streamId);
    const fin = existant.find((e) => e.type === "ReconciliationExecutee");
    if (fin) return { deja: true, rapport: (fin.payload as any).rapport };

    const faits: EvenementEsLu[] = await this.store.readTousParType(ctx, STREAM_FAITS);
    const clesEs = new Set<string>();
    for (const f of faits) {
      const v = cmd.evaluateur(f);
      if (v?.declenche) clesEs.add(String(f.sourceEventId ?? `${f.streamId}#${f.seq}`));
    }
    const clesExistantes = new Map(cmd.existantes.map((a) => [a.cle, a.source]));
    const diag = cmd.diagnostics ?? {};
    const concordantes = [...clesEs].filter((c) => clesExistantes.has(c)).sort();
    const seulementEs = [...clesEs].filter((c) => !clesExistantes.has(c)).sort()
      .map((cle) => ({ cle, diagnostic: diag[cle] ?? null }));
    const seulementExistantes = [...clesExistantes.keys()].filter((c) => !clesEs.has(c)).sort()
      .map((cle) => ({ cle, source: clesExistantes.get(cle)!, diagnostic: diag[cle] ?? null }));
    const c1 = seulementExistantes.length === 0;
    const c2 = seulementEs.every((e) => !!e.diagnostic);
    const rapport: RapportReconciliation = { corpusId: cmd.corpusId, faitsEvalues: faits.length,
      concordantes, seulementEs, seulementExistantes,
      criteres: { zeroAlerteExistanteManqueeParEs: c1, ecartsAdditionnelsTousExpliques: c2,
        basculePermise: c1 && c2 } };

    await this.store.append(ctx, STREAM_SHADOW, streamId, [
      ...[...clesEs].sort().map((cle) => ({ type: "AlerteShadow", payload: { cle } })),
      ...concordantes.length || seulementEs.length
        ? [...clesEs].sort().map((cle) => ({ type: "PropositionShadow",
            payload: { cle, note: "proposition ÉCRITE AU STREAM shadow — jamais émise (invariant 6)" } }))
        : [],
      { type: "ReconciliationExecutee", payload: { rapport } },
    ], 0);
    return { deja: false, rapport };
  }
}
