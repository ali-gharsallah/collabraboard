/**
 * Tests du TenantMiddleware — vérification RS256 réelle, résolution de clé par kid,
 * rotation (grâce puis purge), expiration, routes publiques.
 */
import { TenantMiddleware } from "./tenant.middleware";
import { KeyStore } from "../modules/auth/key-store";
import { sign } from "jsonwebtoken";
declare const process: any;

const req = (token?: string, path = "/v1/kyc") =>
  ({ path, headers: token ? { authorization: `Bearer ${token}` } : {} } as any);
const mk = (ks: KeyStore, over: any = {}, expiresIn: any = "15m") => {
  const { kid, privatePem } = ks.signingKey();
  return sign({ tid: "t1", sub: "u1", role: "CO_SR", ...over }, privatePem,
    { algorithm: "RS256", expiresIn, keyid: kid });
};

let passed = 0, failed = 0; const fails: string[] = [];
function it(n: string, fn: () => void): void { try { fn(); passed++; } catch (e) { failed++; fails.push(`✗ ${n} — ${(e as Error).message}`); } }
function ok(c: boolean, m = "assertion"): void { if (!c) throw new Error(m); }
function unauth(fn: () => void): void {
  try { fn(); } catch (e) { if ((e as any).constructor.name.includes("Unauthorized")) return; throw new Error(`Unauthorized attendu, obtenu ${(e as Error).message}`); }
  throw new Error("UnauthorizedException attendue");
}

// TM-01 — jeton valide → ctx posé
it("TM-01 jeton valide → req.ctx (tenant/user/rôle)", () => {
  const ks = new KeyStore(); const r = req(mk(ks)); let called = false;
  new TenantMiddleware(ks).use(r, {}, () => { called = true; });
  ok(called && r.ctx.tenantId === "t1" && r.ctx.userId === "u1" && r.ctx.role === "CO_SR");
});
// TM-02 — jeton signé par une clé étrangère → 401 (signature invalide)
it("TM-02 clé étrangère → 401", () => {
  const ks = new KeyStore(), autre = new KeyStore();
  const token = mk(autre);                       // signé ailleurs, kid inconnu du trousseau
  unauth(() => new TenantMiddleware(ks).use(req(token), {}, () => {}));
});
// TM-03 — jeton altéré → 401
it("TM-03 jeton altéré → 401", () => {
  const ks = new KeyStore(); const t = mk(ks);
  unauth(() => new TenantMiddleware(ks).use(req(t.slice(0, -4) + "AAAA"), {}, () => {}));
});
// TM-04 — kid absent / jeton absent → 401
it("TM-04 sans jeton → 401", () => {
  unauth(() => new TenantMiddleware(new KeyStore()).use(req(undefined), {}, () => {}));
});
// TM-05 — jeton expiré → 401
it("TM-05 jeton expiré → 401", () => {
  const ks = new KeyStore();
  unauth(() => new TenantMiddleware(ks).use(req(mk(ks, {}, -10)), {}, () => {}));   // exp dans le passé
});
// TM-06 — ROTATION : jeton émis avant rotation reste valide (grâce), puis purgé → 401
it("TM-06 rotation : grâce puis purge", () => {
  const ks = new KeyStore(2);                   // conserve 2 clés
  const ancien = mk(ks);                        // signé avec K1
  ks.rotate();                                  // K2 active, K1 en grâce
  let ok1 = false;
  new TenantMiddleware(ks).use(req(ancien), {}, () => { ok1 = true; });
  ok(ok1, "jeton pré-rotation doit rester valide (grâce)");
  const nouveau = mk(ks);                       // signé avec K2
  let ok2 = false;
  new TenantMiddleware(ks).use(req(nouveau), {}, () => { ok2 = true; });
  ok(ok2, "jeton post-rotation valide");
  ks.rotate();                                  // K3 → K1 purgée
  unauth(() => new TenantMiddleware(ks).use(req(ancien), {}, () => {}));
});
// TM-07 — routes publiques non gardées
it("TM-07 routes publiques (token, oidc/login, jwks) passent sans jeton", () => {
  const ks = new KeyStore(); const mw = new TenantMiddleware(ks);
  for (const p of ["/v1/auth/token", "/v1/auth/oidc/login", "/v1/.well-known/jwks.json"]) {
    let called = false; mw.use(req(undefined, p), {}, () => { called = true; });
    ok(called, `route publique ${p}`);
  }
});

console.log(`\nTenantMiddleware (JWKS/rotation) — ${passed}/${passed + failed} tests verts`);
if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
