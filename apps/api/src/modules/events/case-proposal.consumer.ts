import { Inject, Injectable } from "@nestjs/common";
import { PORT_PROPOSITION_RISK_CASE, PortPropositionRiskCase } from "../surveillance/ports";

/**
 * R286 / AS-03 — le worker case_proposal : consomme l'événement outbox MIROIR
 * `cpsi.case_proposal.emitted` (référence : la clé — jamais le payload de corrélation) et
 * ouvre le risk case par LA porte d'entrée canonique (R280/UC-01 : consommerProposition,
 * idempotente par `depuisProposition`). La redélivrance est NORMALE : rejouer ne crée rien.
 * Le consommateur RELIT la source de vérité (journal CPSI) — une clé sans source échoue
 * typé (NotFound) et suit le circuit retry → dead-letter (AS-04), jamais une rustine.
 */
@Injectable()
export class CaseProposalConsumer {
  // P-L3-2 (ADR-TM-001) : dépendance au PORT du contexte Surveillance, jamais au service concret.
  constructor(@Inject(PORT_PROPOSITION_RISK_CASE) private riskCases: PortPropositionRiskCase) {}

  async handle(ev: { tenant_id: string; type: string; payload: unknown }, _db?: unknown) {
    if (ev.type !== "cpsi.case_proposal.emitted") return { applied: false, reason: "type" };
    const p = (ev.payload ?? {}) as { cle?: string; par?: string };
    // ctx système : l'auteur MÉTIER reste celui porté par l'événement source (payload.par)
    return this.riskCases.consommerProposition(
      { tenantId: ev.tenant_id, userId: p.par ?? "system", role: "CO" }, p.cle ?? "");
  }
}
