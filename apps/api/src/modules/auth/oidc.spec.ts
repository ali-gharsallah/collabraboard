/** Tests SSO OIDC — validation du jeton, mapping de rôle, provisioning JIT. Harnais autonome. */
import { OidcService, OidcConfig, OidcClaims } from "./oidc.service";
declare const process: any;

const ISS = "https://login.gwb.ch/realms/olive", AUD = "olive-web";
const baseClaims = (over: Partial<OidcClaims> = {}): OidcClaims => ({
  iss: ISS, aud: AUD, exp: Math.floor(Date.now() / 1000) + 300,
  email: "isabelle@gwb.ch", sub: "idp|123", groups: ["gwb-compliance-senior"], ...over });
const cfg = (claims: OidcClaims): OidcConfig => ({
  issuer: ISS, audience: AUD,
  roleMapping: { "gwb-compliance-senior": "CO_SR", "gwb-rm": "RM", "gwb-admin": "ADMIN" },
  verifyIdToken: async () => claims });

function fakePrisma(existing?: any) {
  const st: any = { user: existing ?? null, created: null, updated: null };
  return { _st: st, user: {
    findFirst: async ({ where }: any) => (st.user && st.user.email === where.email) ? st.user : null,
    create: async ({ data }: any) => { st.created = { id: "new1", ...data }; st.user = st.created; return st.created; },
    update: async ({ data }: any) => { st.user = { ...st.user, ...data }; st.updated = st.user; return st.user; },
  } } as any;
}
const svc = (claims: OidcClaims, existing?: any) => { const p = fakePrisma(existing); return { s: new OidcService(p, cfg(claims)), p }; };

let passed = 0, failed = 0; const fails: string[] = [];
function it(n: string, fn: () => Promise<void>): Promise<void> { return fn().then(() => { passed++; }, (e: Error) => { failed++; fails.push(`✗ ${n} — ${e.message}`); }); }
function ok(c: boolean, m = "assertion"): void { if (!c) throw new Error(m); }
async function rejects(p: Promise<unknown>, part: string): Promise<void> {
  try { await p; } catch (e) { const n = (e as any).constructor.name; if ((e as Error).message.includes(part) || n.includes("Unauthorized") || n.includes("Forbidden")) return; throw new Error(`rejet «${part}» attendu, obtenu «${(e as Error).message}»`); }
  throw new Error(`rejet «${part}» attendu`); }

(async () => {
  await it("OI-01 jeton valide → rôle mappé + provisioning JIT", async () => {
    const { s, p } = svc(baseClaims());
    const r = await s.login("t1", "tok");
    ok(r.role === "CO_SR" && r.provisioned === true && p._st.created.email === "isabelle@gwb.ch");
  });
  await it("OI-02 émetteur inattendu → 401", async () => {
    await rejects(svc(baseClaims({ iss: "https://evil.example" })).s.login("t1", "tok"), "Émetteur");
  });
  await it("OI-03 audience invalide → 401", async () => {
    await rejects(svc(baseClaims({ aud: "autre-client" })).s.login("t1", "tok"), "Audience");
  });
  await it("OI-04 jeton expiré → 401", async () => {
    await rejects(svc(baseClaims({ exp: Math.floor(Date.now() / 1000) - 10 })).s.login("t1", "tok"), "expiré");
  });
  await it("OI-05 aucun groupe mappé → 403", async () => {
    await rejects(svc(baseClaims({ groups: ["inconnu"] })).s.login("t1", "tok"), "rôle");
  });
  await it("OI-06 user existant réutilisé (pas de doublon), rôle resynchronisé", async () => {
    const existing = { id: "u1", tenantId: "t1", email: "isabelle@gwb.ch", role: "RM", active: true };
    const { s, p } = svc(baseClaims(), existing);   // IdP dit CO_SR, local dit RM
    const r = await s.login("t1", "tok");
    ok(r.userId === "u1" && r.provisioned === false && r.role === "CO_SR" && p._st.updated.role === "CO_SR");
  });
  console.log(`\nSSO OIDC — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
