// Client typé unique — LE seul point de sortie réseau (SPEC-FRONT-CÂBLAGE v2, FE-CORE).
// Si OLIVE_API_URL est nul (démo/offline) OU si l'appel échoue, on retombe sur un seed — mais on
// le SIGNALE (isDemo) pour qu'aucun écran n'affiche du seed sans bandeau. Règle binaire : soit
// c'est l'API réelle (isDemo=false), soit c'est du seed (isDemo=true, l'écran doit afficher
// <DemoModeBanner/>). Ajouts v2 (incrémentaux, rétro-compatibles) : apiPost (écriture, erreurs
// normalisées), asOf (rejeu à date R48/R49), OLIVE_AUTH_MODE (JWT par défaut ; headers-mode câblé
// mais INERTE tant que le backend n'accepte pas les en-têtes — cf. docs/ECARTS-FRONT.md).

const apiBase = (): string | undefined => (window as unknown as { OLIVE_API_URL?: string }).OLIVE_API_URL;

/** Vrai quand l'API n'est pas connectée (mode démo). Lisible par n'importe quel écran. */
export function isDemoMode(): boolean {
  return !apiBase();
}

/** Erreur normalisée — le `message` est celui du serveur, affiché TEL QUEL (FE-04, jamais reformulé). */
export type OliveError = { code: string; status: number; message: string };

type OliveSession = { tenantId?: string; userId?: string; role?: string };
const oliveSession = (): OliveSession => (window as unknown as { OLIVE_SESSION?: OliveSession }).OLIVE_SESSION ?? {};

/** Vue historique active (R48/R49) : `window.OLIVE_AS_OF` (ISO) ⇒ tout devient lecture seule. */
export function currentAsOf(): string | undefined {
  return (window as unknown as { OLIVE_AS_OF?: string }).OLIVE_AS_OF || undefined;
}
export function isHistoricalView(): boolean {
  return !!currentAsOf();
}

// Mode d'auth (A1/D2). Défaut = JWT RS256 (le TenantMiddleware ratifié fait foi ; tenant/user/rôle
// dérivés du jeton côté serveur, jamais envoyés par le client). Mode `headers` = DEV LOCAL / tests MSW
// uniquement (activation explicite) → bandeau « Mode dev — auth simulée ».
export function authMode(): "jwt" | "headers" {
  return (window as unknown as { OLIVE_AUTH_MODE?: "jwt" | "headers" }).OLIVE_AUTH_MODE ?? "jwt";
}
/** Vrai quand l'auth est simulée par en-têtes (dev/tests) — l'écran doit afficher le bandeau dev. */
export function isDevAuthMode(): boolean {
  return authMode() === "headers";
}

function sessionHeaders(): Record<string, string> {
  const mode = authMode();
  if (mode === "headers") {
    const s = oliveSession();
    const h: Record<string, string> = {};
    if (s.tenantId) h["x-tenant-id"] = s.tenantId;
    if (s.userId) h["x-user-id"] = s.userId;
    if (s.role) h["x-user-role"] = s.role;
    return h;
  }
  const t = sessionStorage.getItem("olive_jwt");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

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
  if (!r.ok) {
    const p = payload as { code?: string; error?: string; message?: string };
    throw { code: p.code ?? p.error ?? "ERROR", status: r.status, message: p.message ?? `Erreur ${r.status}` } as OliveError;
  }
  return payload as T;
}
