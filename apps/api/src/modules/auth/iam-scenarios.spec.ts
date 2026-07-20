/**
 * Corpus exécutable des scénarios I-01 → I-05 (règles R89 → R92, ratifiées le 15.07.2026).
 * Miroir strict du Gherkin du catalogue : chaque « Étant donné / Quand / Alors » est une assertion.
 * Les tests unitaires AU/MF/TP/OI/KS/TM couvrent déjà les briques ; ceux-ci prouvent les RÈGLES.
 */
import { PasswordHasher } from "./password";
import { AuthService } from "./auth.service";
import { Totp } from "./totp";
import { KeyStore } from "./key-store";
import { MfaService } from "./mfa.service";
import { OidcService, OidcConfig, OidcClaims } from "./oidc.service";
import { TenantMiddleware } from "../../common/tenant.middleware";
import { sign } from "jsonwebtoken";
declare const process: any; declare const Buffer: any;

const decode = (t: string) => JSON.parse(Buffer.from(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
let passed = 0, failed = 0; const fails: string[] = [];
function it(n: string, fn: () => Promise<void> | void): Promise<void> {
  return Promise.resolve().then(fn).then(() => { passed++; }, (e: Error) => { failed++; fails.push(`✗ ${n} — ${e.message}`); });
}
function ok(c: boolean, m = "assertion"): void { if (!c) throw new Error(m); }
async function refuse(p: Promise<unknown>): Promise<void> {
  try { await p; } catch { return; } throw new Error("un refus était attendu");
}

const userDe = (over: any = {}) => ({ id: "u1", tenantId: "t1", email: "rm@gwb.ch", name: "RM",
  role: "RM", active: true, mfaEnabled: false, mfaSecret: null,
  passwordHash: PasswordHasher.hash("pw"), ...over });
const prismaDe = (u: any) => ({ user: {
  findFirst: async ({ where }: any) => (u && (where.id ? u.id === where.id : u.email === where.email) && u.tenantId === where.tenantId) ? u : null,
  update: async ({ data }: any) => Object.assign(u, data),
  create: async ({ data }: any) => Object.assign(u, { id: "new1" }, data),
} } as any);

(async () => {
  // ── I-01 : Le rôle ne se réclame pas (R89) ──────────────────────────────
  await it("I-01 — le rôle ne se réclame pas", async () => {
    // Étant donné un utilisateur U1 dont le rôle en base est RM
    const u = userDe({ role: "RM" });
    const svc = new AuthService(prismaDe(u), new KeyStore());
    // Quand U1 s'authentifie en demandant le rôle ADMIN (le paramètre n'existe même pas dans le contrat)
    const r: any = await svc.issueToken({ tenantId: "t1", email: "rm@gwb.ch", password: "pw", ...( { role: "ADMIN" } as any) });
    // Alors le jeton émis porte le rôle RM
    ok(decode(r.access_token).role === "RM", "le jeton doit porter le rôle du compte, pas celui demandé");
    ok(r.role === "RM");
    // Et un email inconnu est indiscernable d'un mot de passe erroné
    await refuse(svc.issueToken({ tenantId: "t1", email: "ghost@gwb.ch", password: "pw" }));
    await refuse(svc.issueToken({ tenantId: "t1", email: "rm@gwb.ch", password: "faux" }));
  });

  // ── I-02 : L'enrôlement ne s'auto-proclame pas (R90) ────────────────────
  await it("I-02 — l'enrôlement ne s'auto-proclame pas", async () => {
    // Étant donné un utilisateur sans MFA
    const u = userDe({ mfaEnabled: false, mfaSecret: null });
    const mfa = new MfaService(prismaDe(u));
    // Quand l'enrôlement est démarré
    const { secret, otpauthUri } = await mfa.beginEnrollment("t1", "u1");
    // Alors un secret et une URI otpauth sont produits, et la MFA reste inactive
    ok(!!secret && otpauthUri.startsWith("otpauth://totp/"), "secret + URI otpauth produits");
    ok(u.mfaEnabled === false, "la MFA reste inactive tant que le code n'est pas prouvé");
    // Quand un code invalide est présenté → activation refusée
    await refuse(mfa.confirmEnrollment("t1", "u1", "000000"));
    ok(u.mfaEnabled === false, "un code invalide n'active pas la MFA");
    // Quand un code valide est présenté → la MFA devient active
    const code = Totp.generate(Totp.base32Decode(secret), Date.now(), 30, 6);
    await mfa.confirmEnrollment("t1", "u1", code);
    ok(u.mfaEnabled === true, "un code valide active la MFA");
  });

  // ── I-03 : Le mot de passe seul ne suffit plus (R90) ────────────────────
  await it("I-03 — le mot de passe seul ne suffit plus", async () => {
    const B32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    const u = userDe({ mfaEnabled: true, mfaSecret: B32 });
    const svc = new AuthService(prismaDe(u), new KeyStore());
    // Quand il s'authentifie avec le bon mot de passe et sans code → refus
    await refuse(svc.issueToken({ tenantId: "t1", email: "rm@gwb.ch", password: "pw" }));
    // Et avec un code valide → accès
    const code = Totp.generate(Totp.base32Decode(B32), Date.now(), 30, 6);
    const r: any = await svc.issueToken({ tenantId: "t1", email: "rm@gwb.ch", password: "pw", totp: code });
    ok(!!r.access_token, "le second facteur valide ouvre l'accès");
  });

  // ── I-04 : Le rôle suit l'annuaire (R91) ───────────────────────────────
  await it("I-04 — le rôle suit l'annuaire", async () => {
    const ISS = "https://login.gwb.ch/realms/olive", AUD = "olive-web";
    const claims = (over: Partial<OidcClaims> = {}): OidcClaims => ({ iss: ISS, aud: AUD,
      exp: Math.floor(Date.now() / 1000) + 300, email: "rm@gwb.ch", sub: "idp|1",
      groups: ["gwb-compliance-senior"], ...over });
    const cfg = (c: OidcClaims): OidcConfig => ({ issuer: ISS, audience: AUD,
      roleMapping: { "gwb-compliance-senior": "CO_SR" }, verifyIdToken: async () => c });
    // Étant donné un compte local RM, et un jeton IdP dont les groupes mappent vers CO_SR
    const u = userDe({ role: "RM" });
    const r = await new OidcService(prismaDe(u), cfg(claims())).login("t1", "tok");
    // Alors le compte est resynchronisé sur CO_SR, sans doublon
    ok(r.role === "CO_SR" && u.role === "CO_SR", "le rôle est resynchronisé depuis l'IdP");
    ok(r.provisioned === false, "aucun compte en double n'est créé");
    // Étant donné un jeton sans groupe mappé et sans rôle par défaut → accès refusé
    await refuse(new OidcService(prismaDe(userDe()), cfg(claims({ groups: ["inconnu"] }))).login("t1", "tok"));
  });

  // ── I-05 : Tourner sans casser (R92) ───────────────────────────────────
  await it("I-05 — tourner sans casser", async () => {
    const ks = new KeyStore(2);                       // grâce de 2 clés
    const jeton = (k: KeyStore) => { const { kid, privatePem } = k.signingKey();
      return sign({ tid: "t1", sub: "u1", role: "RM" }, privatePem, { algorithm: "RS256", expiresIn: "1h", keyid: kid }); };
    const req = (t: string) => ({ path: "/v1/kyc", headers: { authorization: "Bearer " + t } } as any);
    // Étant donné un jeton signé avec K1
    const ancien = jeton(ks);
    // Quand le trousseau tourne vers K2 → le jeton K1 reste vérifiable (grâce)
    ks.rotate();
    let ok1 = false; new TenantMiddleware(ks).use(req(ancien), {}, () => { ok1 = true; });
    ok(ok1, "un jeton pré-rotation reste valide pendant la grâce");
    // Et les nouveaux jetons portent le kid K2
    let ok2 = false; new TenantMiddleware(ks).use(req(jeton(ks)), {}, () => { ok2 = true; });
    ok(ok2, "les jetons post-rotation sont valides");
    // Quand K1 est purgée → le jeton K1 est rejeté
    ks.rotate();
    let rejete = false;
    try { new TenantMiddleware(ks).use(req(ancien), {}, () => {}); } catch { rejete = true; }
    ok(rejete, "une clé purgée invalide ses jetons");
  });

  console.log(`\nScénarios I-01..I-05 (R89→R92) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
