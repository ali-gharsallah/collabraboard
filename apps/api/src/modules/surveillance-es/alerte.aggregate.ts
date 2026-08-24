/**
 * ES-2 (docs/SURVEILLANCE-ES.md §3, invariants 2-4) — AGRÉGAT ALERTE, pur et sans I/O.
 * L'état n'existe NULLE PART en table : il est la fonction `rejouer(stream)` — c'est ici que
 * « event-sourcé » est vrai (invariant 2). Les décisions (`deciderLever/Assigner/Disposer`)
 * sont throw-first : elles refusent AVANT de produire l'événement, et ne produisent QUE des
 * événements — jamais d'effet de bord. Le service (alertes.service) orchestre store + API de
 * proposition ; l'agrégat, lui, est rejouable à l'identique n'importe où (tests, backtest ES-3).
 */

export type RefEvidence = { streamType: string; streamId: string; seq: number };

export type EtatAlerte = {
  alerteId: string;
  statut: "LEVEE" | "ASSIGNEE" | "DISPOSEE";
  scenarioId: string; scenarioVersion: string; configRef: string;
  evidenceRef: RefEvidence; severite: string;
  assigneA: string | null;
  decision: string | null; motif: string | null; disposeePar: string | null;
  propositions: { taskId: string; via: string; acteur: string; decision: string }[];
  version: number;                     // seq du dernier événement appliqué (verrou optimiste)
};

type EvenementLu = { type: string; payload: any; seq: number };
export type EvenementAProduire = { type: string; version?: number; payload: unknown };

export const DECISIONS_ALERTE = ["VRAI_POSITIF", "FAUX_POSITIF"] as const;

/** Rejeu = vérité : plie le stream en état. Types inconnus IGNORÉS (évolution additive du stream). */
export function rejouer(alerteId: string, events: EvenementLu[]): EtatAlerte | null {
  let etat: EtatAlerte | null = null;
  for (const e of events) {
    if (e.type === "AlerteLevee") {
      const p = e.payload;
      etat = { alerteId, statut: "LEVEE", scenarioId: p.scenarioId, scenarioVersion: p.scenarioVersion,
        configRef: p.configRef, evidenceRef: p.evidenceRef, severite: p.severite,
        assigneA: null, decision: null, motif: null, disposeePar: null, propositions: [], version: e.seq };
    } else if (!etat) {
      continue;                                       // stream corrompu : rien avant la levée — toléré au rejeu
    } else if (e.type === "AlerteAssignee") {
      etat = { ...etat, statut: "ASSIGNEE", assigneA: e.payload.a, version: e.seq };
    } else if (e.type === "AlerteDisposee") {
      etat = { ...etat, statut: "DISPOSEE", decision: e.payload.decision, motif: e.payload.motif,
        disposeePar: e.payload.par, version: e.seq };
    } else if (e.type === "PropositionEmise") {
      etat = { ...etat, propositions: [...etat.propositions, e.payload], version: e.seq };
    } else {
      etat = { ...etat, version: e.seq };
    }
  }
  return etat;
}

/** Lever : refuse un stream déjà peuplé (une alerte naît une fois). */
export function deciderLever(etat: EtatAlerte | null, cmd: { scenarioId: string; scenarioVersion: string;
  configRef: string; evidenceRef: RefEvidence; severite: string }): EvenementAProduire[] {
  if (etat) throw new Error(`ES-2 : l'alerte ${etat.alerteId} existe déjà (statut ${etat.statut})`);
  for (const k of ["scenarioId", "scenarioVersion", "configRef", "severite"] as const)
    if (!cmd[k]) throw new Error(`ES-2 : ${k} requis pour lever une alerte (evidence traçable)`);
  if (!cmd.evidenceRef?.streamId || !cmd.evidenceRef?.seq)
    throw new Error("ES-2 : evidenceRef requis — une alerte sans evidence figée n'existe pas (invariant 3)");
  return [{ type: "AlerteLevee", payload: cmd }];
}

export function deciderAssigner(etat: EtatAlerte | null, a: string): EvenementAProduire[] {
  if (!etat) throw new Error("ES-2 : alerte inconnue");
  if (etat.statut === "DISPOSEE") throw new Error("ES-2 : alerte déjà disposée — assignation refusée");
  if (!a?.trim()) throw new Error("ES-2 : assignee requis");
  return [{ type: "AlerteAssignee", payload: { a } }];
}

export function deciderDisposer(etat: EtatAlerte | null, cmd: { decision: string; motif: string; par: string }):
  EvenementAProduire[] {
  if (!etat) throw new Error("ES-2 : alerte inconnue");
  if (etat.statut === "DISPOSEE")
    throw new Error(`ES-2 : alerte déjà disposée (${etat.decision}) — une disposition ne se réécrit pas`);
  if (!(DECISIONS_ALERTE as readonly string[]).includes(cmd.decision))
    throw new Error(`ES-2 : decision inconnue « ${cmd.decision} » (attendu : ${DECISIONS_ALERTE.join(" | ")})`);
  if (!cmd.motif?.trim()) throw new Error("ES-2/R7 : motif requis pour disposer une alerte");
  return [{ type: "AlerteDisposee", payload: cmd }];
}
