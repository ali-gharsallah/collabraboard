import { Injectable } from "@nestjs/common";
import { EsEventStore, EvenementEsLu } from "./es-event-store.service";
import { cleFlux, STREAM_FAITS } from "./es-subscriber.service";

/**
 * ES-7 (extension de la série, docs/notes/ES-7.md) — DÉCISIONS PEP PAR REJEU.
 * Deuxième contexte où LE REJEU EST LE PRODUIT (après la timeline des hits, ES-6) : la vie
 * PEP d'une personne — proposition (le hit propose), rejet motivé, PEPisation, levée (l'humain
 * décide, ADR-PEP-001/R44) — devient une séquence de FAITS immuables consommés de l'outbox.
 * ZÉRO changement monolithe : les 4 types (pep.proposition.creee/rejetee au catalogue C6,
 * personne.pep.declare/leve en gardes locales ES) sont déjà émis ET déjà consommés par ES-1.
 * L'autorité reste `persons.statut_pep` écrit par personnes.service (ADR-PEP-001) ; ES fournit
 * la vue rejouable et auditable — il ne touche JAMAIS la table persons (sens unique §2).
 * Liaison structurelle : `pep.proposition.rejetee` ne porte PAS de personId (payload {cle,
 * motif, par}) — l'attribution passe par la carte cle→personId construite des propositions.
 */

export type EtatPepEs = {
  personId: string;
  statut: "PROPOSE" | "REJETE" | "PEPISE" | "LEVE";
  propositions: { cle: string; hitId?: string; liste?: string; listeVersion?: string; score?: number }[];
  motifRejet?: string; rejetePar?: string;                        // dernier rejet (R7 : motif obligatoire)
  source?: string; sourceHitId?: string;                          // PEPisation (trace liante ADR-PEP-001)
  decideurLevee?: string;                                         // levée (R33 : décision humaine tracée)
  timeline: { type: string; at: string; seq: number }[];
};

/** Rejeu pur : faits (ordre chronologique) → état PEP de la personne. Types inconnus ignorés
 *  (additif). Une PEPisation SANS proposition préalable est légale (l'humain décide seul,
 *  ADR-PEP-001) : le fait `declare` initialise l'état s'il n'existe pas encore. */
export function rejouerPep(personId: string, faits: EvenementEsLu[]): EtatPepEs | null {
  let etat: EtatPepEs | null = null;
  const base = (): EtatPepEs =>
    etat ?? { personId, statut: "PROPOSE", propositions: [], timeline: [] };
  for (const f of faits) {
    const d = (f.payload as any)?.donnees ?? {};
    const at = f.at instanceof Date ? f.at.toISOString() : String(f.at);
    const pas = { type: f.type, at, seq: f.seq };
    if (f.type === "fait.pep.proposition.creee") {
      const e = base();
      etat = { ...e, statut: e.statut === "PEPISE" ? "PEPISE" : "PROPOSE",
        propositions: [...e.propositions, { cle: d.cle, hitId: d.hitId, liste: d.liste,
          listeVersion: d.listeVersion, score: d.score }],
        timeline: [...e.timeline, pas] };
    } else if (etat && f.type === "fait.pep.proposition.rejetee") {
      etat = { ...etat, statut: etat.statut === "PEPISE" ? "PEPISE" : "REJETE",
        motifRejet: d.motif, rejetePar: d.par, timeline: [...etat.timeline, pas] };
    } else if (f.type === "fait.personne.pep.declare") {
      const e = base();
      etat = { ...e, statut: "PEPISE", source: d.source, sourceHitId: d.sourceHitId ?? undefined,
        timeline: [...e.timeline, pas] };
    } else if (etat && f.type === "fait.personne.pep.leve") {
      etat = { ...etat, statut: "LEVE", decideurLevee: d.decideur, timeline: [...etat.timeline, pas] };
    }
  }
  return etat;
}

@Injectable()
export class EsPep {
  constructor(private store: EsEventStore) {}

  private static readonly TYPES = ["pep.proposition.creee", "pep.proposition.rejetee",
    "personne.pep.declare", "personne.pep.leve"] as const;

  /** Les 4 flux de faits PEP du tenant, fusionnés en chronologie. Tie-break par source_event_id
   *  (l'id outbox est GLOBAL — contrairement à seq, locale à chaque stream physique). */
  private async faitsPep(ctx: { tenantId: string }): Promise<EvenementEsLu[]> {
    const flux = await Promise.all(EsPep.TYPES.map((t) =>
      this.store.read(ctx, STREAM_FAITS, cleFlux(ctx.tenantId, t))));
    const ordre = (f: EvenementEsLu) => Number(f.sourceEventId ?? 0);
    return flux.flat().sort((a, b) =>
      new Date(a.at).getTime() - new Date(b.at).getTime() || ordre(a) - ordre(b));
  }

  /** Attribution d'un fait à sa personne : creee porte personId ; declare/leve sont agrégés
   *  par personId (aggregateId source) ; rejetee ne porte QUE la cle → liaison par la carte. */
  private grouperParPersonne(faits: EvenementEsLu[]): Map<string, EvenementEsLu[]> {
    const parCle = new Map<string, string>();
    for (const f of faits) {
      const d = (f.payload as any)?.donnees ?? {};
      if (f.type === "fait.pep.proposition.creee" && d.cle && d.personId) parCle.set(d.cle, d.personId);
    }
    const parPersonne = new Map<string, EvenementEsLu[]>();
    for (const f of faits) {
      const p = f.payload as any; const d = p?.donnees ?? {};
      const id = f.type === "fait.pep.proposition.creee" ? d.personId
        : f.type === "fait.pep.proposition.rejetee" ? parCle.get(d.cle)
        : p?.source?.aggregateId;
      if (!id) continue;
      if (!parPersonne.has(id)) parPersonne.set(id, []);
      parPersonne.get(id)!.push(f);
    }
    return parPersonne;
  }

  /** État PEP d'UNE personne — reconstruit par rejeu de ses faits. */
  async etatPep(ctx: { tenantId: string }, personId: string): Promise<EtatPepEs | null> {
    const faits = this.grouperParPersonne(await this.faitsPep(ctx)).get(personId) ?? [];
    return rejouerPep(personId, faits);
  }

  /** File PEP — projection reconstructible from scratch (aucune table, aucun cache — C8). */
  async filePep(ctx: { tenantId: string }): Promise<EtatPepEs[]> {
    return [...this.grouperParPersonne(await this.faitsPep(ctx)).entries()]
      .map(([id, faits]) => rejouerPep(id, faits))
      .filter((x): x is EtatPepEs => !!x)
      .sort((a, b) => a.personId.localeCompare(b.personId));
  }
}
