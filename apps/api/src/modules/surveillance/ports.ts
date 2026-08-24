/**
 * PORTS du contexte borné Surveillance (P-L3-2, ADR-TM-001 Option C — contexte LOGIQUE in-monolith).
 * La frontière est une discipline d'imports : un module EXTERNE ne dépend jamais d'un service concret
 * du contexte (screening/aml/riskcases/mros) — il dépend d'une INTERFACE déclarée ici, fournie sous un
 * jeton DI par le module propriétaire. Ce fichier est le SEUL point d'import autorisé du contexte
 * depuis l'extérieur (gardé par scripts/verifier-frontiere-surveillance.mjs, CI bloquante).
 * Cartographie des croisements : docs/notes/surveillance-frontiere.md (VIOL-1..3).
 */

export type CtxSurveillance = { tenantId: string; userId: string; role: string };

/**
 * VIOL-1 — Gel des avoirs MROS (art. 10 LBA, R131). Consommé par `transactions` (garde `gel-mros`
 * du portail R140-143), implémenté par `mros` (MrosService.verifierTransaction — le gel est posé par
 * l'HUMAIN, le port ne fait qu'APPLIQUER le verdict de lecture).
 */
export interface PortGelMros {
  verifierTransaction(ctx: CtxSurveillance, clientId: string):
    Promise<{ bloquant: boolean; motif?: string; communicationId?: string }>;
}
export const PORT_GEL_MROS = Symbol("PortGelMros");

/**
 * VIOL-2/3 — Consommation d'une proposition de risk case (R133/R252). Consommé par `events`
 * (case-proposal.consumer sur `cpsi.case_proposal.emitted`), implémenté par `riskcases`
 * (RiskCaseService.consommerProposition). Le CPSI PROPOSE, le contexte ouvre le cas — jamais
 * l'inverse (R39/R44).
 */
export interface PortPropositionRiskCase {
  consommerProposition(ctx: CtxSurveillance, cle: string): Promise<unknown>;
}
export const PORT_PROPOSITION_RISK_CASE = Symbol("PortPropositionRiskCase");
