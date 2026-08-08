import { z } from "zod";

/**
 * Bloc WD (R432) — schéma JSON VERSIONNÉ du WorkflowIR v1 + validateur structurel R434.
 * TRANSCRIPTION FIDÈLE de la référence comportementale demo/wir-core.mjs (fusion démo
 * validée, 14/14 vitest — WD-SYNC no-drift côté démo) : mêmes champs, mêmes codes
 * d'anomalie, mêmes règles. Rien n'est fabriqué qui n'existe pas dans la source (R438).
 */

export const WIR_VERSION = 1;

export const schemaNoeudWir = z.object({
  id: z.string(),
  label: z.string(),
  ownerRole: z.string().nullable(),
  slaHours: z.number().nullable(),
  visaRequired: z.boolean(),
  approvalType: z.string(),
  type: z.string(),
  confidence: z.number(),
  aVerifier: z.boolean(),
}).strict();

export const schemaWir = z.object({
  version: z.literal(WIR_VERSION),
  label: z.string(),
  nodes: z.array(schemaNoeudWir),
  edges: z.array(z.object({ from: z.string(), to: z.string(),
    condition: z.string().nullable() }).strict()),
  meta: z.object({
    source: z.string(), importePar: z.string(),
    hashFichier: z.string().nullable(), modele: z.string().nullable(),
    status: z.enum(["DRAFT_AI", "DRAFT_HUMAN", "PUBLISHED"]),
    ratifiePar: z.string().nullable(),
  }).strict(),
}).strict();

export type Wir = z.infer<typeof schemaWir>;
export type AnomalieWir = { code: string; noeud?: string; role?: string; bloquant: boolean; detail: string };

/** Extraction brute → WIR v1 normalisé. `seuil` (Q-WD-3) marque « à vérifier » — R438 :
 *  rien n'est corrigé, le doute est AFFICHÉ. */
export function creerWir(extraction: { label?: string; nodes: any[]; edges: any[] },
  meta: { source: string; importePar: string; hashFichier?: string; modele?: string },
  seuil = 0.6): Wir {
  const nodes = (extraction.nodes ?? []).map((n) => {
    const confidence = typeof n.confidence === "number" ? n.confidence : 1;
    return { id: n.id, label: n.label ?? n.id, ownerRole: n.role ?? n.ownerRole ?? null,
      slaHours: typeof n.slaHours === "number" ? n.slaHours : null,
      visaRequired: n.type === "end" || n.visaRequired === true,
      approvalType: n.approvalType ?? (n.type === "end" ? "QUATRE_YEUX" : "SIMPLE"),
      type: n.type ?? "step", confidence, aVerifier: confidence < seuil };
  });
  const edges = (extraction.edges ?? []).map((e) => ({ from: e.from, to: e.to,
    condition: e.condition ?? e.label ?? null }));
  return { version: WIR_VERSION, label: extraction.label ?? "Workflow importé", nodes, edges,
    meta: { source: meta.source, importePar: meta.importePar,
      hashFichier: meta.hashFichier ?? null, modele: meta.modele ?? null,
      status: "DRAFT_AI", ratifiePar: null } };
}

/** R434 — validation STRUCTURELLE : connexité, initial unique, ≥1 terminal, arêtes résolues,
 *  rôles mappés tenant (NON_MAPPÉ bloquant). Anomalies LISTÉES, jamais corrigées. */
export function validerWir(wir: Wir, rolesTenant: string[]): AnomalieWir[] {
  const anomalies: AnomalieWir[] = [];
  const ids = wir.nodes.map((n) => n.id);
  const entrantes: Record<string, number> = {}, sortantes: Record<string, number> = {};
  for (const e of wir.edges) {
    sortantes[e.from] = (sortantes[e.from] ?? 0) + 1;
    entrantes[e.to] = (entrantes[e.to] ?? 0) + 1;
  }
  if (wir.nodes.length > 1) for (const n of wir.nodes)
    if (!entrantes[n.id] && !sortantes[n.id])
      anomalies.push({ code: "NON_CONNEXE", noeud: n.id, bloquant: true,
        detail: `Nœud « ${n.label} » isolé : aucune arête entrante ni sortante.` });
  const initiaux = wir.nodes.filter((n) => !entrantes[n.id] && (sortantes[n.id] || wir.nodes.length === 1));
  if (initiaux.length === 0)
    anomalies.push({ code: "INITIAL_ABSENT", bloquant: true,
      detail: "Aucun état initial : tous les nœuds ont une arête entrante." });
  if (initiaux.length > 1)
    anomalies.push({ code: "INITIAL_MULTIPLE", bloquant: true,
      detail: `Plusieurs états initiaux : ${initiaux.map((n) => n.id).join(", ")}.` });
  if (wir.nodes.length > 0 && !wir.nodes.some((n) => !sortantes[n.id]))
    anomalies.push({ code: "TERMINAL_ABSENT", bloquant: true,
      detail: "Aucun état terminal : chaque nœud a une arête sortante." });
  for (const e of wir.edges)
    if (!ids.includes(e.from) || !ids.includes(e.to))
      anomalies.push({ code: "ARETE_ORPHELINE", bloquant: true,
        detail: `Arête ${e.from}→${e.to} référence un nœud inconnu.` });
  for (const n of wir.nodes)
    if (n.ownerRole && !rolesTenant.includes(n.ownerRole))
      anomalies.push({ code: "ROLE_NON_MAPPE", noeud: n.id, role: n.ownerRole, bloquant: true,
        detail: `Rôle « ${n.ownerRole} » du nœud « ${n.label} » absent des rôles tenant.` });
  return anomalies;
}
