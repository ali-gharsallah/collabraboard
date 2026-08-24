/**
 * Workflow de qualification du screening — R100 → R103 (ratifiées le 15.07.2026).
 *
 * Le rapprochement de noms délègue au moteur fin (@olive/screening-engine, R408) ; ce module traite
 * ce qui n'est pas résolu par un algorithme : ce qu'on FAIT d'un hit, et comment on le prouve trois
 * ans plus tard. Rien ici n'est propre au screening : événement tracé, motif obligatoire (R7), date
 * d'effet (R29), rejeu (R48/R49). C'est le moteur existant, branché sur un déclencheur de plus.
 */
import { createHash } from "crypto";
import { rapprocherDetail } from "@olive/screening-engine";

export type Verdict = "VRAI_POSITIF" | "FAUX_POSITIF";
export interface EntreeListe { uid: string; nom_complet: string; alias?: string[]; date_naissance?: string | null; type?: string; }
export interface HitDetail { via: string; nameScore: number; typePenalty: number; dobContribution: number; natContribution: number; }
export interface Hit { id: string; clientId: string; entreeUid: string; score: number; listeVersion: string; entreeHash: string; at: string; statut: "BRUT" | "QUALIFIE"; detail?: HitDetail; }
export interface Qualification { hitId: string; verdict: Verdict; motif: string; par: string; at: string; entreeHash: string; listeVersion: string; }
export interface Run { id: string; perimetre: number; liste: string; listeVersion: string; at: string; seuil: number; prefiltre: Record<string, number>; nbHits: number; }
export interface Proposition { type: string; hitId: string; motif: string; }

export class ScreeningQualificationService {
  hits: Hit[] = [];
  qualifications: Qualification[] = [];
  runs: Run[] = [];
  propositions: Proposition[] = [];
  alertes: unknown[] = [];      // R100 : reste vide — un hit n'est pas une alerte
  cases: unknown[] = [];        // R101 : reste vide — l'escalade se propose, ne s'exécute pas
  private seq = 0;

  /**
   * R102 — L'empreinte de l'entrée. La whitelist s'y attache, PAS à l'uid seul :
   * si l'entrée change (nouvel alias, nouvelle date), l'empreinte change et le hit réapparaît.
   */
  hashEntree(e: EntreeListe): string {
    const canon = JSON.stringify({ uid: e.uid, nom: e.nom_complet, alias: [...(e.alias || [])].sort(), dob: e.date_naissance ?? null });
    return createHash("sha256").update(canon).digest("hex").slice(0, 16);
  }

  /**
   * R100 — produit des hits BRUTS (ni alertes, ni cases).
   * R103 — enregistre la trace de passage, même sans aucun hit, avec le réglage du pré-filtre.
   * R408 — le score est le COMPOSITE du moteur fin (rapprocherDetail : meilleur candidat de la liste).
   */
  screener(clients: any[], entries: EntreeListe[], cfg: { seuil: number; prefiltre: Record<string, number>; liste: string; version: string }): { run: Run; hits: Hit[] } {
    const at = new Date().toISOString();
    const produits: Hit[] = [];
    for (const c of clients) {
      const requete = { nom: c.name, dob: c.date_naissance ?? undefined, est_entite: c.type ? c.type !== "PP" : false };
      const r = rapprocherDetail(requete, entries as any, cfg.seuil);   // R408 : délègue au moteur fin
      if (!r) continue;
      const e = r.entree as unknown as EntreeListe;
      const hash = this.hashEntree(e);
      if (this.estEcarte(c.id, e, cfg.version)) continue;              // R102 : whitelist encore valable
      const detail: HitDetail = { via: r.detail.via, nameScore: Math.round(r.detail.nameScore), typePenalty: r.detail.typePenalty, dobContribution: r.detail.dobContribution, natContribution: r.detail.natContribution };
      const h: Hit = { id: "HIT-" + ++this.seq, clientId: c.id, entreeUid: e.uid, score: r.score, listeVersion: cfg.version, entreeHash: hash, at, statut: "BRUT", detail };
      produits.push(h); this.hits.push(h);
    }
    const run: Run = { id: "RUN-" + ++this.seq, perimetre: clients.length, liste: cfg.liste, listeVersion: cfg.version, at, seuil: cfg.seuil, prefiltre: { ...cfg.prefiltre }, nbHits: produits.length };
    this.runs.push(run);
    return { run, hits: produits };
  }

  /** R101 — verdict + motif obligatoire + personne nommée. Un vrai positif PROPOSE une escalade. */
  qualifier(hitId: string, verdict: Verdict, motif: string, par: string): Qualification {
    const h = this.hits.find((x) => x.id === hitId);
    if (!h) throw new Error("Hit introuvable");
    if (!motif || !motif.trim()) throw new Error("R7 : la qualification exige un motif");
    if (!par || !par.trim()) throw new Error("R101 : la qualification exige une personne nommée");
    if (h.statut === "QUALIFIE") throw new Error("Hit déjà qualifié — passer par une re-qualification tracée");

    const q: Qualification = { hitId, verdict, motif: motif.trim(), par, at: new Date().toISOString(), entreeHash: h.entreeHash, listeVersion: h.listeVersion };
    this.qualifications.push(q);
    h.statut = "QUALIFIE";
    if (verdict === "VRAI_POSITIF") {
      // R39/R44 : on propose. Le gel, la clarification OBA et la communication MROS restent des décisions humaines.
      this.propositions.push({ type: "ESCALADE_SCREENING", hitId, motif: "Correspondance qualifiée vraie — gel, clarification art. 6 LBA et communication MROS à arbitrer" });
    }
    return q;
  }

  /**
   * R102 — un faux positif n'écarte le hit que pour CETTE entrée dans CET état.
   * L'entrée change → l'empreinte change → la whitelist ne s'applique plus.
   */
  estEcarte(clientId: string, entree: EntreeListe, _version: string): boolean {
    const hash = this.hashEntree(entree);
    return this.qualifications.some((q) => {
      if (q.verdict !== "FAUX_POSITIF") return false;
      const h = this.hits.find((x) => x.id === q.hitId);
      return !!h && h.clientId === clientId && h.entreeUid === entree.uid && q.entreeHash === hash;
    });
  }
}
