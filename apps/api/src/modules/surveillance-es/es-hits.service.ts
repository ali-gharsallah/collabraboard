import { Injectable } from "@nestjs/common";
import { EsEventStore, EvenementEsLu } from "./es-event-store.service";
import { cleFlux, STREAM_FAITS } from "./es-subscriber.service";

/**
 * ES-6 (extension de la série, docs/notes/ES-6.md) — TIMELINE DES HITS SCREENING PAR REJEU.
 * Le périmètre event-sourcé s'étend là où LE REJEU EST LE PRODUIT : la vie d'un hit
 * (détection → qualification, R100–R103) devient une séquence de FAITS immuables consommés
 * de l'outbox (screening.hit.detecte / screening.hit.qualifie, catalogués C6). L'état servi
 * ici est la FONCTION du rejeu de ces faits — la table screening_hits reste l'état du
 * monolithe (CRUD-primaire, rien ne change côté gardes) ; ES fournit la vue rejouable et
 * auditable. Discours autorisé (post-bascule) : « la timeline des hits est event-sourcée » —
 * jamais plus.
 */

export type EtatHitEs = {
  hitId: string; statut: "DETECTE" | "QUALIFIE";
  clientId?: string; entreeUid?: string; score?: number; listeVersion?: string;
  verdict?: string; motif?: string; par?: string;
  timeline: { type: string; at: string; seq: number }[];
};

/** Rejeu pur : faits (ordre du stream) → état du hit. Types inconnus ignorés (additif). */
export function rejouerHit(hitId: string, faits: EvenementEsLu[]): EtatHitEs | null {
  let etat: EtatHitEs | null = null;
  for (const f of faits) {
    const d = (f.payload as any)?.donnees ?? {};
    const at = f.at instanceof Date ? f.at.toISOString() : String(f.at);
    if (f.type === "fait.screening.hit.detecte") {
      etat = { hitId, statut: "DETECTE", clientId: d.clientId, entreeUid: d.entreeUid,
        score: d.score, listeVersion: d.listeVersion, timeline: [{ type: f.type, at, seq: f.seq }] };
    } else if (etat && f.type === "fait.screening.hit.qualifie") {
      etat = { ...etat, statut: "QUALIFIE", verdict: d.verdict, motif: d.motif, par: d.par,
        timeline: [...etat.timeline, { type: f.type, at, seq: f.seq }] };
    }
  }
  return etat;
}

@Injectable()
export class EsHits {
  constructor(private store: EsEventStore) {}

  private async faitsHits(ctx: { tenantId: string }): Promise<EvenementEsLu[]> {
    const detectes = await this.store.read(ctx, STREAM_FAITS, cleFlux(ctx.tenantId, "screening.hit.detecte"));
    const qualifies = await this.store.read(ctx, STREAM_FAITS, cleFlux(ctx.tenantId, "screening.hit.qualifie"));
    return [...detectes, ...qualifies].sort((a, b) =>
      new Date(a.at).getTime() - new Date(b.at).getTime() || a.seq - b.seq);
  }

  /** État d'UN hit — reconstruit par rejeu de ses faits (aggregateId du monolithe = hitId). */
  async etatHit(ctx: { tenantId: string }, hitId: string): Promise<EtatHitEs | null> {
    const faits = (await this.faitsHits(ctx))
      .filter((f) => ((f.payload as any)?.source?.aggregateId ?? (f.payload as any)?.donnees?.hitId) === hitId);
    return rejouerHit(hitId, faits);
  }

  /** File des hits — projection reconstructible from scratch (aucune table, aucun cache — C8). */
  async fileHits(ctx: { tenantId: string }): Promise<EtatHitEs[]> {
    const parHit = new Map<string, EvenementEsLu[]>();
    for (const f of await this.faitsHits(ctx)) {
      const id = (f.payload as any)?.source?.aggregateId ?? (f.payload as any)?.donnees?.hitId;
      if (!id) continue;
      if (!parHit.has(id)) parHit.set(id, []);
      parHit.get(id)!.push(f);
    }
    return [...parHit.entries()].map(([id, faits]) => rejouerHit(id, faits))
      .filter((x): x is EtatHitEs => !!x)
      .sort((a, b) => a.hitId.localeCompare(b.hitId));
  }
}
