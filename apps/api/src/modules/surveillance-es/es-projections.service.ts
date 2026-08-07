import { Injectable } from "@nestjs/common";
import { EsEventStore, EvenementEsLu } from "./es-event-store.service";
import { rejouer, EtatAlerte } from "./alerte.aggregate";
import { STREAM_ALERTE } from "./alertes.service";

/**
 * ES-3 (docs/SURVEILLANCE-ES.md §1) — PROJECTION « file d'alertes ».
 * Une projection ES est une LECTURE dérivée des streams, reconstructible FROM SCRATCH par
 * définition : aucune table matérialisée, aucun cache module-global (C8) — chaque appel relit
 * les streams `alerte` du tenant et rejoue chaque agrégat (invariant 2 : rejeu = vérité).
 * Le test de rebuild en CI prouve l'identité entre deux reconstructions indépendantes.
 * Les alertes SIMULÉES (stream `backtest`, ES-3) ne passent JAMAIS ici : la file ne lit que
 * le stream_type `alerte` — l'isolation réel/simulé est structurelle, pas un filtre.
 */

export type LigneFileAlertes = {
  alerteId: string; statut: EtatAlerte["statut"]; severite: string;
  scenarioId: string; scenarioVersion: string;
  ageJours: number;                    // depuis la levée (AlerteLevee.at)
  assigneA: string | null; decision: string | null;
};

@Injectable()
export class EsProjections {
  constructor(private store: EsEventStore) {}

  /** File d'alertes du tenant — bloquantes d'abord ? Non : tri sévérité puis âge (revue). `now` injectable (tests). */
  async fileAlertes(ctx: { tenantId: string }, now: Date = new Date()): Promise<LigneFileAlertes[]> {
    const evs = await this.store.readTousParType(ctx, STREAM_ALERTE);
    const parStream = new Map<string, EvenementEsLu[]>();
    for (const e of evs) {
      if (!parStream.has(e.streamId)) parStream.set(e.streamId, []);
      parStream.get(e.streamId)!.push(e);
    }
    const lignes: LigneFileAlertes[] = [];
    for (const [alerteId, stream] of parStream) {
      const etat = rejouer(alerteId, stream);
      if (!etat) continue;
      const levee = stream.find((e) => e.type === "AlerteLevee")!;
      lignes.push({ alerteId, statut: etat.statut, severite: etat.severite,
        scenarioId: etat.scenarioId, scenarioVersion: etat.scenarioVersion,
        ageJours: Math.floor((now.getTime() - new Date(levee.at).getTime()) / 86_400_000),
        assigneA: etat.assigneA, decision: etat.decision });
    }
    const rang: Record<string, number> = { CRITIQUE: 0, HAUTE: 1, MOYENNE: 2, BASSE: 3 };
    return lignes.sort((a, b) =>
      (rang[a.severite] ?? 9) - (rang[b.severite] ?? 9) || b.ageJours - a.ageJours || a.alerteId.localeCompare(b.alerteId));
  }
}
