import { TiersIndisponibleError } from "../modules/coffre/ged-externe.adapter";

/**
 * Adaptateur Claude — LE port IA d'O-Live (R44/R121/R138/R188). Un seul adaptateur,
 * trois surfaces consommées par les services ratifiés : `prerevue` (pré-revue de dossier,
 * R44), `completer` (réponses sur pièces, ia-ged), `preRemplir` (brouillon d'entretien
 * CRM, R188). Doctrine constante : l'IA PROPOSE, marquée de son moteur — l'humain signe.
 * PAS DE CLÉ = PAS DE PORT : la factory refuse explicitement (jamais de simulation, R138) ;
 * les services sans port refusent proprement — c'est déjà prouvé par leurs corpus.
 * Transport HTTP injectable : fetch en production, simulé aux preuves — aucun réseau
 * au harnais. Le secret ne voyage QUE dans l'en-tête x-api-key, jamais dans l'URL ni
 * dans un message d'erreur.
 */

export type HttpReponse = { status: number; text(): Promise<string> };
export type HttpTransport = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<HttpReponse>;

export type ClaudeConfig = {
  apiKey?: string;                                    // défaut : process.env.ANTHROPIC_API_KEY
  model?: string;                                     // défaut : claude-sonnet-4-6
  baseUrl?: string;                                   // défaut : https://api.anthropic.com
  entretiens?: { type: string; champs: string[] }[];  // champs attendus par type (registre crmEntretiens, ponté à l'injection)
  residence?: string;                                 // information contractuelle affichée (R121)
};

export function claudeIaAdapter(config: ClaudeConfig = {}, http?: HttpTransport) {
  const apiKey = config.apiKey ?? (globalThis as any).process?.env?.ANTHROPIC_API_KEY;
  if (!apiKey)
    throw new Error("R138 : ANTHROPIC_API_KEY absente — pas de port IA, pas de simulation ; les fonctions assistées refusent explicitement");
  const transport: HttpTransport = http ?? (globalThis as any).fetch?.bind(globalThis);
  if (!transport) throw new Error("Port IA : aucun transport HTTP disponible");
  const model = config.model ?? "claude-sonnet-4-6";
  const baseUrl = (config.baseUrl ?? "https://api.anthropic.com").replace(/\/+$/, "");
  const masquer = (m: string) => m.split(apiKey).join("***");

  async function messages(system: string, user: string, maxTokens = 1200): Promise<string> {
    let r: HttpReponse;
    try {
      r = await transport(baseUrl + "/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
      });
    } catch (e) { throw new TiersIndisponibleError("assistant", masquer(String((e as Error).message ?? e))); }
    if (r.status === 429 || r.status >= 500) throw new TiersIndisponibleError("assistant", `HTTP ${r.status} — l'assistant est indisponible, la saisie manuelle reste ouverte`);
    if (r.status !== 200) throw new TiersIndisponibleError("assistant", `HTTP ${r.status}`);
    const data = JSON.parse(await r.text());
    return (data.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
  }
  function jsonStrict(texte: string, ou: string): any {
    const nu = texte.replace(/```json|```/g, "").trim();
    try { return JSON.parse(nu); }
    catch { throw new Error(`Port IA : réponse inexploitable (${ou}) — rien n'est bricolé, l'humain reprend la main`); }
  }

  return {
    moteur: model, modele: model, version: "2026-06", residence: config.residence ?? "US/EU (Anthropic API)",

    // ── R188 · brouillon d'entretien CRM — la trace du conseil ne se devine pas ──
    async preRemplir(contexte: { clientId: string; type: string; timeline: any[]; gestes: any[] }): Promise<Record<string, string>> {
      const def = (config.entretiens ?? []).find((e) => e.type === contexte.type);
      const champs = def?.champs ?? ["participants", "sujets"];
      const system = "Tu prépares un BROUILLON de compte rendu d'entretien pour un conseiller de banque privée suisse (trace du conseil, LSFin). "
        + `Type d'entretien : ${contexte.type}. Réponds UNIQUEMENT par un objet JSON avec exactement ces clés : ${champs.join(", ")}. `
        + "Valeurs en français, factuelles, fondées sur le contexte fourni — aucune invention. Pas de préambule, pas de balises.";
      const texte = await messages(system, JSON.stringify({ timeline: contexte.timeline, gestesSuggeres: contexte.gestes }));
      const obj = jsonStrict(texte, "preRemplir");
      const manquants = champs.filter((c) => !(c in obj) || String(obj[c]).trim() === "");
      if (manquants.length) throw new Error(`Port IA : brouillon incomplet — champs manquants : ${manquants.join(", ")} ; la saisie manuelle reste ouverte`);
      return obj;
    },

    // ── R44 · pré-revue de dossier — des points, jamais une décision ──
    async prerevue(snapshot: any, promptTexte: string): Promise<any> {
      const system = promptTexte + "\nRéponds UNIQUEMENT par un objet JSON { points: [{ sujet, constat, gravite }] }. Aucune décision : des constats.";
      return jsonStrict(await messages(system, JSON.stringify(snapshot), 2000), "prerevue");
    },

    // ── ia-ged · répondre sur pièces — la réponse cite son contexte ──
    async completer(question: string, contexte: string[]): Promise<{ texte: string; confiance: number }> {
      const system = "Tu réponds à une question d'un employé de banque UNIQUEMENT à partir des extraits de documents fournis. "
        + "Réponds par un objet JSON { texte, confiance } — confiance entre 0 et 1 ; si les extraits ne suffisent pas, dis-le et baisse la confiance.";
      const obj = jsonStrict(await messages(system, JSON.stringify({ question, extraits: contexte })), "completer");
      return { texte: String(obj.texte ?? ""), confiance: Number(obj.confiance ?? 0) };
    },
  };
}
