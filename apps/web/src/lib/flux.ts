import { apiBase, fluxHeaders } from "./api";

/**
 * R287 — consommateur du hub SSE (`GET /v1/events/stream`), côté écran.
 * Le flux ne porte JAMAIS d'état de vérité : des références { seq, type, aggregate_id } —
 * l'écran REFETCHE ses données par l'API normale (qui applique les droits).
 * Idempotence CLIENT par référence d'événement : un seq déjà vu ne redéclenche rien —
 * une reconnexion (rattrapage Last-Event-ID) ne double rien à l'écran (AS-06).
 * Transport : fetch + lecture du corps SSE (les en-têtes d'auth passent, contrairement à
 * EventSource) ; en mode borné (`attente=0`), rappel périodique avec le watermark courant.
 */
export type ReferenceFlux = { seq: number; type: string; aggregate_id: string };

export function ouvrirFlux(onReference: (ref: ReferenceFlux) => void,
  opts: { periodeMs?: number } = {}): () => void {
  const base = apiBase();
  if (!base) return () => {};                                  // mode démo : pas de flux
  let watermark = 0;
  const vus = new Set<number>();                               // idempotence par référence (AS-06)
  let arrete = false;

  const rattraper = async () => {
    if (arrete) return;
    try {
      const r = await fetch(`${base}/v1/events/stream?attente=0`, {
        headers: { ...fluxHeaders(), "Last-Event-ID": String(watermark) } });
      if (!r.ok) return;
      const texte = await r.text();
      for (const m of texte.matchAll(/^data: (.+)$/gm)) {
        const ref = JSON.parse(m[1]) as ReferenceFlux;
        watermark = Math.max(watermark, ref.seq);              // le dernier point connu — resservi à la reconnexion
        if (vus.has(ref.seq)) continue;                        // déjà à l'écran : rien ne se double
        vus.add(ref.seq);
        onReference(ref);
      }
    } catch { /* coupure : la prochaine reconnexion rattrape PAR LE JOURNAL — rien n'est perdu */ }
  };

  void rattraper();
  const timer = setInterval(rattraper, opts.periodeMs ?? 5000);
  return () => { arrete = true; clearInterval(timer); };
}
