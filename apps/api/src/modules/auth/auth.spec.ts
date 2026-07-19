/** Tests IAM — hachage scrypt + authentification (identité vérifiée, rôle issu du user). Harnais autonome. */
import { PasswordHasher } from "./password";
import { AuthService } from "./auth.service";
import { Totp } from "./totp";
import { KeyStore } from "./key-store";
declare const process: any; declare const Buffer: any;
process.env.JWT_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY ?? "test-key";

const decode = (t: string) => JSON.parse(Buffer.from(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
let passed = 0, failed = 0; const fails: string[] = [];
function it(name: string, fn: () => Promise<void> | void): Promise<void> {
  return Promise.resolve().then(fn).then(() => { passed++; }, (e: Error) => { failed++; fails.push(`✗ ${name} — ${e.message}`); });
}
function ok(c: boolean, m = "assertion"): void { if (!c) throw new Error(m); }
async function rejects(p: Promise<unknown>, part: string): Promise<void> {
  try { await p; } catch (e) { if ((e as Error).message.includes(part) || (e as any).constructor.name.includes("Unauthorized")) return; throw new Error(`attendu rejet «${part}», obtenu «${(e as Error).message}»`); }
  throw new Error(`rejet «${part}» attendu`);
}
const mkUser = (over: any = {}) => ({ id: "u1", tenantId: "t1", email: "co@gwb.ch", role: "CO_SR",
  name: "Isabelle", active: true, passwordHash: PasswordHasher.hash("secret123"), ...over });
const svc = (user: any) => new AuthService({ user: { findFirst: async ({ where }: any) =>
  (user && where.email === user.email && where.tenantId === user.tenantId) ? user : null } } as any, new KeyStore());

(async () => {
  // AU-01 — round-trip du hachage
  await it("AU-01 scrypt hash/verify round-trip", () => {
    const h = PasswordHasher.hash("hunter2");
    ok(h.startsWith("scrypt$") && PasswordHasher.verify("hunter2", h) === true);
    ok(PasswordHasher.verify("wrong", h) === false);
  });
  // AU-02 — identifiants corrects → token, rôle issu du user
  await it("AU-02 identifiants corrects → token + rôle du user", async () => {
    const u = mkUser();
    const r: any = await svc(u).issueToken({ tenantId: "t1", email: "co@gwb.ch", password: "secret123" });
    ok(r.token_type === "Bearer" && r.role === "CO_SR");
    ok(decode(r.access_token).role === "CO_SR" && decode(r.access_token).sub === "u1" && decode(r.access_token).tid === "t1");
  });
  // AU-03 — mauvais mot de passe → refus
  await it("AU-03 mauvais mot de passe → 401", async () => {
    await rejects(svc(mkUser()).issueToken({ tenantId: "t1", email: "co@gwb.ch", password: "nope" }), "invalides");
  });
  // AU-04 — email inconnu → refus (même message, anti-énumération)
  await it("AU-04 email inconnu → 401", async () => {
    await rejects(svc(mkUser()).issueToken({ tenantId: "t1", email: "ghost@gwb.ch", password: "secret123" }), "invalides");
  });
  // AU-05 — user désactivé → refus
  await it("AU-05 user désactivé → 401", async () => {
    await rejects(svc(mkUser({ active: false })).issueToken({ tenantId: "t1", email: "co@gwb.ch", password: "secret123" }), "invalides");
  });
  // AU-06 — intégrité du rôle : un RM obtient le rôle RM, impossible de réclamer ADMIN
  await it("AU-06 rôle non falsifiable (issu du user)", async () => {
    const rm = mkUser({ id: "u2", email: "rm@gwb.ch", role: "RM", passwordHash: PasswordHasher.hash("pw") });
    const r: any = await svc(rm).issueToken({ tenantId: "t1", email: "rm@gwb.ch", password: "pw" });
    ok(decode(r.access_token).role === "RM");   // aucun paramètre client ne peut l'élever
  });

  // AU-07 — MFA activée : password OK + TOTP valide → token
  await it("AU-07 MFA : TOTP valide → token", async () => {
    const B32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    const u = mkUser({ mfaEnabled: true, mfaSecret: B32 });
    const code = Totp.generate(Totp.base32Decode(B32), Date.now(), 30, 6);
    const r: any = await svc(u).issueToken({ tenantId: "t1", email: "co@gwb.ch", password: "secret123", totp: code });
    ok(r.role === "CO_SR");
  });
  // AU-08 — MFA activée : TOTP absent → refus
  await it("AU-08 MFA : TOTP manquant → 401", async () => {
    const u = mkUser({ mfaEnabled: true, mfaSecret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ" });
    await rejects(svc(u).issueToken({ tenantId: "t1", email: "co@gwb.ch", password: "secret123" }), "MFA");
  });
  // AU-09 — MFA activée : TOTP faux → refus (bon mot de passe pourtant)
  await it("AU-09 MFA : TOTP invalide → 401", async () => {
    const u = mkUser({ mfaEnabled: true, mfaSecret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ" });
    await rejects(svc(u).issueToken({ tenantId: "t1", email: "co@gwb.ch", password: "secret123", totp: "000000" }), "MFA");
  });

  console.log(`\nIAM (auth) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
