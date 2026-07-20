/**
 * Vérification JWKS de l'IdP — corpus JV-01..JV-07. Ferme le dernier point d'injection IAM
 * (`verifyIdToken` jetait « brancher la vérif JWKS »). Périmètre STRICT : signature + kid +
 * algorithme — iss/aud/exp/email restent dans OidcService.login (OI-01..06), pas de doublon.
 *
 * Aucun réseau : le faux IdP est le KeyStore du repo (il signe RS256 et expose un JWKS).
 * Harnais : compiler jwks-verifier.ts + key-store.ts + oidc.service.ts + ce fichier ;
 *   echo "── Vérif JWKS IdP (JV-01..07) ──"; run jwks-verifier.spec.js
 */
import { createSign } from "crypto";
import { JwksVerifier } from "./jwks-verifier";
import { KeyStore } from "./key-store";
import { OidcService } from "./oidc.service";
declare const process: { exit(n: number): void };

let passed = 0, failed = 0; const fails: string[] = [];
function it(name: string, fn: () => Promise<void>): Promise<void> {
  return fn().then(() => { passed++; }, (e: Error) => { failed++; fails.push(`✗ ${name} — ${e.message}`); });
}
const ok = (c: boolean, m = "assertion") => { if (!c) throw new Error(m); };
async function rejects(p: Promise<unknown>, part: string): Promise<void> {
  try { await p; } catch (e) { if ((e as Error).message.toLowerCase().includes(part.toLowerCase())) return;
    throw new Error(`attendu «${part}», obtenu «${(e as Error).message}»`); }
  throw new Error(`rejet «${part}» attendu`);
}

// ── Faux IdP : KeyStore signe, jwks() sert de point /.well-known ──
const b64u = (s: Buffer | string) => Buffer.from(s).toString("base64url");
function signIdToken(ks: KeyStore, claims: object, over: { alg?: string; kid?: string } = {}): string {
  const { kid, privatePem } = ks.signingKey();
  const header = b64u(JSON.stringify({ alg: over.alg ?? "RS256", kid: over.kid ?? kid, typ: "JWT" }));
  const payload = b64u(JSON.stringify(claims));
  const sig = createSign("RSA-SHA256").update(`${header}.${payload}`).sign(privatePem);
  return `${header}.${payload}.${b64u(sig)}`;
}
const CLAIMS = { iss: "https://login.gwb.ch/realms/olive", aud: "olive-api",
  exp: Math.floor(Date.now() / 1000) + 300, email: "i.vernet@gwb.ch", sub: "idp-42", groups: ["compliance"] };

function mkVerifier(idp: KeyStore) {
  let fetches = 0;
  const fetcher = async () => { fetches++; return idp.jwks(); };
  return { v: new JwksVerifier("https://login.gwb.ch/realms/olive/protocol/openid-connect/certs", fetcher),
    count: () => fetches };
}

(async () => {
  // ── JV-01 : jeton valide → claims restitués intacts (rien de plus, rien de moins) ──
  await it("JV-01 signature IdP valide → claims restitués", async () => {
    const idp = new KeyStore(); const { v } = mkVerifier(idp);
    const c: any = await v.verify(signIdToken(idp, CLAIMS));
    ok(c.email === "i.vernet@gwb.ch" && c.iss === CLAIMS.iss && c.sub === "idp-42", "claims intacts");
    ok(Array.isArray(c.groups) && c.groups[0] === "compliance", "groups transmis");
  });

  // ── JV-02 : signature altérée → rejet ──
  await it("JV-02 payload altéré après signature → rejet", async () => {
    const idp = new KeyStore(); const { v } = mkVerifier(idp);
    const t = signIdToken(idp, CLAIMS).split(".");
    t[1] = b64u(JSON.stringify({ ...CLAIMS, email: "attaquant@evil.ch" }));
    await rejects(v.verify(t.join(".")), "signature");
  });
  await it("JV-02 jeton signé par une AUTRE clé (attaquant) → rejet", async () => {
    const idp = new KeyStore(); const attaquant = new KeyStore();
    const { v } = mkVerifier(idp);
    // kid usurpé (celui de l'IdP), clé de l'attaquant : la signature ne colle pas.
    const forged = signIdToken(attaquant, CLAIMS, { kid: idp.activeKidPublic });
    await rejects(v.verify(forged), "signature");
  });

  // ── JV-03 : confusion d'algorithme → rejet strict ──
  await it("JV-03 alg=none → rejet ; alg=HS256 → rejet (RS256 seul admis)", async () => {
    const idp = new KeyStore(); const { v } = mkVerifier(idp);
    const none = `${b64u(JSON.stringify({ alg: "none", kid: idp.activeKidPublic }))}.${b64u(JSON.stringify(CLAIMS))}.`;
    await rejects(v.verify(none), "algorithme");
    await rejects(v.verify(signIdToken(idp, CLAIMS, { alg: "HS256" })), "algorithme");
  });

  // ── JV-04 : rotation IdP — kid inconnu → re-fetch UNE fois, puis succès ──
  await it("JV-04 rotation de clé IdP → re-fetch du JWKS puis vérif OK", async () => {
    const idp = new KeyStore(); const { v, count } = mkVerifier(idp);
    await v.verify(signIdToken(idp, CLAIMS));            // amorce le cache (fetch 1)
    idp.rotate();                                        // l'IdP tourne sa clé
    const c: any = await v.verify(signIdToken(idp, CLAIMS));   // kid inconnu → re-fetch (fetch 2)
    ok(c.email === CLAIMS.email, "vérifié après rotation");
    ok(count() === 2, `2 fetch attendus (obtenu ${count()})`);
  });

  // ── JV-05 : cache — pas de fetch par appel ──
  await it("JV-05 trois vérifs successives → un seul fetch JWKS", async () => {
    const idp = new KeyStore(); const { v, count } = mkVerifier(idp);
    for (let i = 0; i < 3; i++) await v.verify(signIdToken(idp, CLAIMS));
    ok(count() === 1, `1 fetch attendu (obtenu ${count()})`);
  });

  // ── JV-06 : kid toujours inconnu après re-fetch → rejet (pas de boucle) ──
  await it("JV-06 kid fantôme → un seul re-fetch puis rejet net", async () => {
    const idp = new KeyStore(); const { v, count } = mkVerifier(idp);
    await rejects(v.verify(signIdToken(idp, CLAIMS, { kid: "kid-fantome" })), "kid");
    ok(count() === 2, `amorce + re-fetch = 2 (obtenu ${count()})`);
  });

  // ── JV-07 : intégration — OidcService.login avec le VRAI vérificateur ──
  await it("JV-07 login SSO bout-en-bout : JIT provisionné via vérif réelle", async () => {
    const idp = new KeyStore(); const { v } = mkVerifier(idp);
    const users: any[] = [];
    const prisma: any = { user: {
      findFirst: async () => null,
      create: async ({ data }: any) => { const u = { id: "u1", ...data }; users.push(u); return u; } } };
    const svc = new OidcService(prisma, {
      issuer: CLAIMS.iss, audience: "olive-api",
      roleMapping: { compliance: "CO" }, verifyIdToken: (t) => v.verify(t) });
    const r = await svc.login("t1", signIdToken(idp, CLAIMS));
    ok(r.provisioned === true && r.role === "CO", "JIT + rôle mappé");
  });
  await it("JV-07 login avec jeton forgé → rejeté AVANT tout provisioning", async () => {
    const idp = new KeyStore(); const attaquant = new KeyStore(); const { v } = mkVerifier(idp);
    let created = 0;
    const prisma: any = { user: { findFirst: async () => null, create: async () => { created++; return {}; } } };
    const svc = new OidcService(prisma, {
      issuer: CLAIMS.iss, audience: "olive-api",
      roleMapping: { compliance: "CO" }, verifyIdToken: (t) => v.verify(t) });
    await rejects(svc.login("t1", signIdToken(attaquant, CLAIMS, { kid: idp.activeKidPublic })), "signature");
    ok(created === 0, "aucun user créé sur jeton forgé");
  });

  console.log(`\nVérif JWKS IdP (JV-01..07) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
