import { CompletionProfile, Requirement, RequirementStatus } from "./types";
import { compilerExpression, evaluerExpression } from "./dsl";
import { LectureDossier } from "./case-facts.reader";

/**
 * P-L7-3 — RequirementLedger : objet PAR REQUÊTE (leçon C8), construit sur UNE lecture de
 * dossier (CaseFactsReader) et UN profil résolu. Le ledger est une VUE : il ne décide rien,
 * n'écrit rien — R1–R51 restent les gardes actives (CLAUDE.md invariant 4). Sémantique :
 *   • activation : `when` (DSL sûr) sur les CaseFacts — un requirement inactif est ÉCARTÉ ;
 *   • document : pièce du bon code, ACTIF et NON EXPIRÉE (absent ≠ expiré dans l'explication) ;
 *   • check (screening) : hits TOUS qualifiés (0 hit = rien à qualifier — satisfait, vacuité) ;
 *   • approval : visa de la section au BON rôle, SIGNED et verdict ≠ NOK — la sémantique
 *     QUALIFIED-VISA réutilisée (R86 : un NOK ne satisfait jamais), jamais recodée ;
 *   • data : l'attribut CaseFacts demandé est renseigné.
 * gap() : les non-satisfaits, BLOQUANTS D'ABORD. explain(rid) : règle, base légale, faits
 * pertinents, preuve (ligne/événement satisfaisant) — l'explication est la fonction du produit.
 */

export class RequirementLedger {
  private actifs: Requirement[];

  constructor(private profil: CompletionProfile, private lecture: LectureDossier,
    private now: Date = new Date()) {
    this.actifs = profil.requirements.filter((r) =>
      !r.when || evaluerExpression(compilerExpression(r.when), lecture.facts));
  }

  private evaluer(r: Requirement): RequirementStatus {
    const { sources, facts } = this.lecture;
    if (r.kind === "document") {
      const code = String(r.params.document ?? "");
      const piece = sources.documents.find((d) => d.nom === code && d.statut === "ACTIF");
      if (!piece) return { id: r.id, satisfied: false, derivedBy: `document « ${code} » absent` };
      if (piece.expireAt && new Date(piece.expireAt).getTime() <= this.now.getTime())
        return { id: r.id, satisfied: false, derivedBy: `document « ${code} » EXPIRÉ (${piece.expireAt})` };
      return { id: r.id, satisfied: true, satisfiedBy: piece.id, derivedBy: "document ACTIF non expiré" };
    }
    if (r.kind === "check") {
      const nonQualifies = sources.hits.filter((h) => h.statut !== "QUALIFIE");
      if (nonQualifies.length) return { id: r.id, satisfied: false,
        derivedBy: `${nonQualifies.length} hit(s) screening non qualifié(s)` };
      return { id: r.id, satisfied: true,
        satisfiedBy: `hits:${sources.hits.length}/${sources.hits.length} qualifiés`,
        derivedBy: sources.hits.length ? "tous les hits qualifiés" : "aucun hit à qualifier (vacuité)" };
    }
    if (r.kind === "approval") {
      const visa = sources.visas.find((v) => v.sectionCode === r.params.section &&
        v.requiredRole === r.params.role && v.status === "SIGNED" && v.verdict !== "NOK");
      if (!visa) return { id: r.id, satisfied: false,
        derivedBy: `visa ${r.params.role}/${r.params.section} absent, non signé ou NOK (R86)` };
      return { id: r.id, satisfied: true, satisfiedBy: visa.id,
        derivedBy: `visa SIGNED ${visa.verdict ?? "OK"} par ${visa.signedBy}` };
    }
    // data : l'attribut CaseFacts demandé est renseigné.
    const attribut = String(r.params.attribut ?? "");
    const valeur = (facts as any)[attribut];
    return valeur ? { id: r.id, satisfied: true, satisfiedBy: `facts.${attribut}=${valeur}`, derivedBy: "donnée renseignée" }
      : { id: r.id, satisfied: false, derivedBy: `donnée « ${attribut} » absente des CaseFacts` };
  }

  statuts(): RequirementStatus[] { return this.actifs.map((r) => this.evaluer(r)); }

  /** Les manques, BLOQUANTS D'ABORD (puis ordre du profil — stable). */
  gap(): (RequirementStatus & { severity: string; basis: string })[] {
    const parId = new Map(this.actifs.map((r) => [r.id, r]));
    return this.statuts().filter((s) => !s.satisfied)
      .map((s) => ({ ...s, severity: parId.get(s.id)!.severity, basis: parId.get(s.id)!.basis }))
      .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "bloquant" ? -1 : 1));
  }

  /** « Pourquoi ? » — règle, base légale, faits pertinents, preuve. */
  explain(rid: string) {
    const r = this.profil.requirements.find((x) => x.id === rid);
    if (!r) return { id: rid, connu: false as const };
    const actif = this.actifs.includes(r);
    const statut = actif ? this.evaluer(r) : null;
    const { facts } = this.lecture;
    const faits = r.kind === "document" ? { documents: facts.documents }
      : r.kind === "check" ? { hits: this.lecture.sources.hits.map((h) => ({ id: h.id, statut: h.statut })) }
      : r.kind === "approval" ? { visas: this.lecture.sources.visas.map((v) => ({
          section: v.sectionCode, role: v.requiredRole, status: v.status, verdict: v.verdict })) }
      : { attribut: r.params.attribut, valeur: (facts as any)[String(r.params.attribut ?? "")] };
    return { id: r.id, connu: true as const, kind: r.kind, basis: r.basis, severity: r.severity,
      regle: { params: r.params, when: r.when ?? null }, actif,
      satisfied: statut?.satisfied ?? null, preuve: statut?.satisfiedBy ?? null,
      diagnostic: statut?.derivedBy ?? (actif ? null : "requirement INACTIF pour ce dossier (when)"),
      faits };
  }
}
