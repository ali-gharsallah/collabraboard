// Client typé unique — LE seul point de sortie réseau (SPEC-FRONT-CÂBLAGE v2, FE-CORE).
// Si OLIVE_API_URL est nul (démo/offline) OU si l'appel échoue, on retombe sur un seed — mais on
// le SIGNALE (isDemo) pour qu'aucun écran n'affiche du seed sans bandeau. Règle binaire : soit
// c'est l'API réelle (isDemo=false), soit c'est du seed (isDemo=true, l'écran doit afficher
// <DemoModeBanner/>). R328 (vague de clôture, ratifiée 2026-07-29) : le contexte vient du
// JETON — le mode « headers » est SUPPRIMÉ (pas déprécié : supprimé — un en-tête ignoré est
// encore une surface) ; le dev local s'authentifie par la VRAIE route /v1/auth/token.
// JW-05 : une réponse 401 avec un jeton en session = session EXPIRÉE → événement
// `olive:session-expiree` (le shell affiche la re-connexion, les brouillons en cours — état
// React — ne sont PAS perdus : aucun rechargement).

export const apiBase = (): string | undefined => (window as unknown as { OLIVE_API_URL?: string }).OLIVE_API_URL;

/** Vrai quand l'API n'est pas connectée (mode démo). Lisible par n'importe quel écran. */
export function isDemoMode(): boolean {
  return !apiBase();
}

/** Erreur normalisée — le `message` est celui du serveur, affiché TEL QUEL (FE-04, jamais reformulé).
 *  `refus` (optionnel) : les listes de refus backend (R269/R306) voyagent ENTIÈRES — jamais tronquées. */
export type OliveError = { code: string; status: number; message: string; refus?: string[];
  popup?: Record<string, unknown> };   // R445 : le 409 CONFIRMATION_REQUISE porte le payload exact du pop-up d'engagement

type OliveSession = { tenantId?: string; userId?: string; role?: string };
// OLIVE_SESSION reste une PROJECTION d'affichage (rôle courant pour les écrans) — jamais un
// vecteur d'auth : seul le jeton voyage (R328).
export const oliveSession = (): OliveSession => (window as unknown as { OLIVE_SESSION?: OliveSession }).OLIVE_SESSION ?? {};

/** Vue historique active (R48/R49) : `window.OLIVE_AS_OF` (ISO) ⇒ tout devient lecture seule. */
export function currentAsOf(): string | undefined {
  return (window as unknown as { OLIVE_AS_OF?: string }).OLIVE_AS_OF || undefined;
}
export function isHistoricalView(): boolean {
  return !!currentAsOf();
}

// R328 : UNE seule méthode d'auth — le jeton. authMode()/isDevAuthMode() sont SUPPRIMÉS
// avec le mode headers (JW-03 : plus aucune lecture, plus aucune émission d'en-tête).
function sessionHeaders(): Record<string, string> {
  const t = sessionStorage.getItem("olive_jwt");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** JW-05 : 401 avec un jeton présent = session expirée — signalée au shell, jamais silencieuse. */
function signalerExpiration() {
  if (!sessionStorage.getItem("olive_jwt")) return;
  sessionStorage.removeItem("olive_jwt");
  window.dispatchEvent(new CustomEvent("olive:session-expiree"));
}
/** R287 : en-têtes d'auth du flux SSE (fetch porte les en-têtes, contrairement à EventSource). */
export function fluxHeaders(): Record<string, string> { return sessionHeaders(); }

// Ajoute ?asOf= si une vue historique est active (ou passée explicitement). Le backend ratifié
// n'expose le rejeu que sur des routes dédiées (cf. ECARTS-FRONT) : le paramètre est inoffensif ailleurs.
function withAsOf(path: string, asOf?: string): string {
  const eff = asOf ?? currentAsOf();
  if (!eff) return path;
  return `${path}${path.includes("?") ? "&" : "?"}asOf=${encodeURIComponent(eff)}`;
}

/** Lecture typée qui EXPOSE sa source. isDemo=true ⇒ donnée de démonstration (seed). */
export async function apiGetSourced<T>(path: string, seed: T, opts?: { asOf?: string }): Promise<{ data: T; isDemo: boolean }> {
  const base = apiBase();
  if (!base) return { data: seed, isDemo: true };
  try {
    const r = await fetch(`${base}${withAsOf(path, opts?.asOf)}`, { headers: sessionHeaders() });
    if (r.status === 401) signalerExpiration();                            // JW-05 — le shell reprend la main
    if (!r.ok) throw new Error(String(r.status));
    return { data: (await r.json()) as T, isDemo: false };
  } catch { return { data: seed, isDemo: true }; }
}

/** Compat : ne renvoie que la donnée (source masquée). Préférer `apiGetSourced` pour afficher le bandeau. */
export async function apiGet<T>(path: string, seed: T, opts?: { asOf?: string }): Promise<T> {
  return (await apiGetSourced(path, seed, opts)).data;
}

/** Écriture. En mode démo → OliveError DEMO_MODE (jamais d'écriture simulée). Erreurs backend
 *  normalisées { code, status, message } ; le message serveur est propagé sans reformulation (FE-04). */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const base = apiBase();
  if (!base) throw { code: "DEMO_MODE", status: 0, message: "Mode démonstration — écriture désactivée" } as OliveError;
  if (isHistoricalView()) throw { code: "HISTORICAL_VIEW", status: 0, message: "Vue historique — lecture seule (R48)" } as OliveError;
  const r = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify(body),
  });
  const payload = await r.json().catch(() => ({} as Record<string, unknown>));
  if (r.status === 401) signalerExpiration();                              // JW-05 — le brouillon (état React) survit
  if (!r.ok) {
    const p = payload as { code?: string; error?: string; message?: string; refus?: string[]; popup?: Record<string, unknown> };
    throw { code: p.code ?? p.error ?? "ERROR", status: r.status, message: p.message ?? `Erreur ${r.status}`,
      ...(Array.isArray(p.refus) ? { refus: p.refus } : {}),
      ...(p.popup ? { popup: p.popup } : {}) } as OliveError;
  }
  return payload as T;
}
