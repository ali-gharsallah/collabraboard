import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { apiGetSourced, apiPost, isDemoMode, isHistoricalView } from "./api";

// FE-CORE — couche API et session (SPEC-FRONT-CÂBLAGE v2, scénarios FE-01..04 au niveau lib).
// On exerce les comportements de src/lib/api.ts : mode démo, propagation d'en-têtes (jwt/headers),
// rejeu à date (?asOf=), erreurs métier normalisées et affichées sans reformulation.

type W = typeof globalThis & {
  OLIVE_API_URL?: string; OLIVE_AUTH_MODE?: "jwt" | "headers";
  OLIVE_SESSION?: { tenantId?: string; userId?: string; role?: string }; OLIVE_AS_OF?: string;
};
const w = globalThis as W;

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response));
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  w.OLIVE_API_URL = undefined; w.OLIVE_AUTH_MODE = undefined; w.OLIVE_SESSION = undefined; w.OLIVE_AS_OF = undefined;
  sessionStorage.clear();
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("FE-CORE — couche API et session", () => {
  it("FE-01 Mode seed sans backend : lecture retombe sur le seed, écriture désactivée", async () => {
    expect(isDemoMode()).toBe(true);
    const r = await apiGetSourced("/v1/tasks", ["seed"]);
    expect(r).toEqual({ data: ["seed"], isDemo: true });
    await expect(apiPost("/v1/tasks/x/complete", {})).rejects.toMatchObject({ code: "DEMO_MODE" });
  });

  it("FE-02 [R328/JW-03] les en-têtes de contexte sont MORTS : même OLIVE_SESSION posée, seul le jeton voyage", async () => {
    w.OLIVE_API_URL = "http://api.test";
    (w as Record<string, unknown>).OLIVE_AUTH_MODE = "headers";            // l'ancien réglage est INERTE — supprimé, pas déprécié
    w.OLIVE_SESSION = { tenantId: "t1", userId: "u1", role: "RM" };
    sessionStorage.setItem("olive_jwt", "JWT-R328");
    const fn = mockFetch(200, []);
    await apiGetSourced("/v1/tasks", []);
    const headers = (fn.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    // Aucune clé de CONTEXTE n'est émise : seule Authorization (le jeton) voyage. On teste par
    // l'ensemble des clés — sans citer les noms d'en-têtes morts (grep JW-03 reste vierge ici).
    const clefsContexte = Object.keys(headers).filter((k) => /^x-(tenant|user)/i.test(k));
    expect(clefsContexte).toEqual([]);
    expect(headers.Authorization).toBe("Bearer JWT-R328");                 // le jeton, rien d'autre
  });

  it("FE-02bis Mode JWT (défaut) : porte Authorization Bearer, aucune clé de contexte", async () => {
    w.OLIVE_API_URL = "http://api.test"; sessionStorage.setItem("olive_jwt", "JWT123");
    const fn = mockFetch(200, []);
    await apiGetSourced("/v1/tasks", []);
    const headers = (fn.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer JWT123");
    expect(Object.keys(headers).filter((k) => /^x-(tenant|user)/i.test(k))).toEqual([]);
  });

  it("FE-03 Rejeu à date (R48/R49) : ?asOf= propagé, vue historique signalée", async () => {
    w.OLIVE_API_URL = "http://api.test"; w.OLIVE_AS_OF = "2026-03-31T23:59:59Z";
    expect(isHistoricalView()).toBe(true);
    const fn = mockFetch(200, []);
    await apiGetSourced("/v1/kyc/K1/a-date", null);
    const url = fn.mock.calls[0][0] as string;
    expect(url).toContain("asOf=2026-03-31");
    // En vue historique, toute écriture est refusée côté client (lecture seule)
    await expect(apiPost("/v1/tasks/x/complete", {})).rejects.toMatchObject({ code: "HISTORICAL_VIEW" });
  });

  it("FE-04 Erreur métier affichée sans traduction (422 { code, message })", async () => {
    w.OLIVE_API_URL = "http://api.test";
    mockFetch(422, { code: "KYC_INCOMPLETE", message: "Le dossier KYC est incomplet." });
    await expect(apiPost("/v1/kyc/K1/validate", {})).rejects.toMatchObject({
      code: "KYC_INCOMPLETE", status: 422, message: "Le dossier KYC est incomplet.",
    });
  });

  it("FE-02b [R328/JW-05] 401 avec jeton présent → session expirée SIGNALÉE (événement), jeton purgé — jamais silencieux", async () => {
    w.OLIVE_API_URL = "http://api.test"; sessionStorage.setItem("olive_jwt", "JWT-EXPIRE");
    let signale = false;
    const ecouteur = () => { signale = true; };
    window.addEventListener("olive:session-expiree", ecouteur);
    mockFetch(401, { message: "Jeton invalide ou expiré" });
    await expect(apiPost("/v1/tasks/x/complete", {})).rejects.toMatchObject({ status: 401 });
    expect(signale).toBe(true);                                            // le shell reprend la main (re-login)
    expect(sessionStorage.getItem("olive_jwt")).toBeNull();                // le jeton mort est purgé
    window.removeEventListener("olive:session-expiree", ecouteur);
  });

  it("FE-06 (A1) Préfixe unique : base + chemin /v1, aucune URL construite ailleurs", async () => {
    w.OLIVE_API_URL = "https://demo.olive.local";
    const fn = mockFetch(200, []);
    await apiGetSourced("/v1/tasks", []);
    expect(fn.mock.calls[0][0]).toBe("https://demo.olive.local/v1/tasks");
  });
});
