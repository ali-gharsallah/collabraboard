// Client typé unique. Si OLIVE_API_URL est nul (démo/offline), fallback seed —
// exactement le pont entre la démo single-file et le produit.
export async function apiGet<T>(path: string, seed: T): Promise<T> {
  const base = (window as any).OLIVE_API_URL;
  if (!base) return seed;
  try {
    const r = await fetch(`${base}${path}`, { headers: authHeaders() });
    if (!r.ok) throw new Error(String(r.status));
    return (await r.json()) as T;
  } catch { return seed; }
}
function authHeaders() {
  const t = sessionStorage.getItem("olive_jwt");
  return t ? { Authorization: `Bearer ${t}` } : {};
}
