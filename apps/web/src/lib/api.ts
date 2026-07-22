// Client typé unique. Si OLIVE_API_URL est nul (démo/offline) OU si l'appel échoue, on
// retombe sur un seed — mais on le SIGNALE (isDemo) pour qu'aucun écran n'affiche du seed
// sans bandeau. Règle binaire : soit c'est l'API réelle (isDemo=false), soit c'est du seed
// (isDemo=true, l'écran doit afficher <DemoModeBanner/>).

const apiBase = (): string | undefined => (window as unknown as { OLIVE_API_URL?: string }).OLIVE_API_URL;

/** Vrai quand l'API n'est pas connectée (mode démo). Lisible par n'importe quel écran. */
export function isDemoMode(): boolean {
  return !apiBase();
}

/** Lecture typée qui EXPOSE sa source. isDemo=true ⇒ donnée de démonstration (seed). */
export async function apiGetSourced<T>(path: string, seed: T): Promise<{ data: T; isDemo: boolean }> {
  const base = apiBase();
  if (!base) return { data: seed, isDemo: true };
  try {
    const r = await fetch(`${base}${path}`, { headers: authHeaders() });
    if (!r.ok) throw new Error(String(r.status));
    return { data: (await r.json()) as T, isDemo: false };
  } catch { return { data: seed, isDemo: true }; }
}

/** Compat : ne renvoie que la donnée (source masquée). Préférer `apiGetSourced` pour afficher le bandeau. */
export async function apiGet<T>(path: string, seed: T): Promise<T> {
  return (await apiGetSourced(path, seed)).data;
}

function authHeaders() {
  const t = sessionStorage.getItem("olive_jwt");
  return t ? { Authorization: `Bearer ${t}` } : {};
}
