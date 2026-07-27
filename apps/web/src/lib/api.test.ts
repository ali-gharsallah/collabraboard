import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { apiGetSourced, apiPost, isDemoMode, isHistoricalView, isDevAuthMode, authMode } from "./api";

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

  it("FE-02 Propagation des en-têtes de session (headers-mode)", async () => {
    w.OLIVE_API_URL = "http://api.test"; w.OLIVE_AUTH_MODE = "headers";
    w.OLIVE_SESSION = { tenantId: "t1", userId: "u1", role: "RM" };
    const fn = mockFetch(200, []);
    await apiGetSourced("/v1/tasks", []);
    const headers = (fn.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers).toMatchObject({ "x-tenant-id": "t1", "x-user-id": "u1", "x-user-role": "RM" });
  });

  it("FE-02bis Mode JWT (défaut) : porte Authorization Bearer, pas d'en-têtes x-*", async () => {
    w.OLIVE_API_URL = "http://api.test"; sessionStorage.setItem("olive_jwt", "JWT123");
    const fn = mockFetch(200, []);
    await apiGetSourced("/v1/tasks", []);
    const headers = (fn.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer JWT123");
    expect(headers["x-tenant-id"]).toBeUndefined();
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

  it("FE-02b (A1) Mode headers réservé au dev : isDevAuthMode signale le bandeau", () => {
    expect(authMode()).toBe("jwt");           // défaut ratifié
    expect(isDevAuthMode()).toBe(false);
    w.OLIVE_AUTH_MODE = "headers";
    expect(isDevAuthMode()).toBe(true);        // → l'écran doit afficher « Mode dev — auth simulée »
  });

  it("FE-06 (A1) Préfixe unique : base + chemin /v1, aucune URL construite ailleurs", async () => {
    w.OLIVE_API_URL = "https://demo.olive.local";
    const fn = mockFetch(200, []);
    await apiGetSourced("/v1/tasks", []);
    expect(fn.mock.calls[0][0]).toBe("https://demo.olive.local/v1/tasks");
  });
});
