/**
 * Chiffrement de mfa_secret au repos — corpus SB-01..SB-06 + intégration MFA bout-en-bout.
 * Ferme le dernier « à faire avant production » du bloc IAM (matrice §6).
 *
 * Périmètre : AES-256-GCM (authentifié), clé d'env MFA_ENC_KEY, format versionné
 * `enc:v1:<iv>.<tag>.<ct>`. Migration douce : une valeur SANS préfixe (legacy, posée avant
 * le chiffrement) reste lisible — grandfathering, esprit R29 — et se re-chiffre au prochain
 * enrôlement. Fail-fast si la clé manque (même doctrine que AUDIT_HMAC_SECRET).
 *
 * Harnais : compiler secret-box.ts + totp.ts + mfa.service.ts + auth.service.ts (patchés)
 *   echo "── SecretBox mfa_secret (SB-01..06) ──"; run secret-box.spec.js
 */
import { randomBytes } from "crypto";
import { SecretBox } from "../../common/secret-box";
import { Totp } from "./totp";
import { MfaService } from "./mfa.service";
declare const process: { exit(n: number): void; env: Record<string, string | undefined> };

let passed = 0, failed = 0; const fails: string[] = [];
function it(name: string, fn: () => Promise<void> | void): Promise<void> {
  return Promise.resolve().then(fn).then(() => { passed++; },
    (e: Error) => { failed++; fails.push(`✗ ${name} — ${e.message}`); });
}
const ok = (c: boolean, m = "assertion") => { if (!c) throw new Error(m); };
const refuse = async (f: () => unknown, part: string) => {
  try { await f(); } catch (e) { if ((e as Error).message.toLowerCase().includes(part.toLowerCase())) return;
    throw new Error(`attendu «${part}», obtenu «${(e as Error).message}»`); }
  throw new Error(`refus «${part}» attendu`); };

const KEY = randomBytes(32).toString("base64");
const box = () => new SecretBox(KEY);
const B32 = "JBSWY3DPEHPK3PXP";   // secret base32 type authenticator

(async () => {
  // ── SB-01 : aller-retour ──
  await it("SB-01 seal → open restitue le secret exact", () => {
    const b = box(); ok(b.open(b.seal(B32)) === B32, "roundtrip");
  });

  // ── SB-02 : rien du secret ne survit en clair ; IV unique ──
  await it("SB-02 le chiffré ne contient pas le secret ; deux seal ≠ (IV frais)", () => {
    const b = box(); const c1 = b.seal(B32), c2 = b.seal(B32);
    ok(!c1.includes(B32), "secret invisible dans le chiffré");
    ok(c1.startsWith("enc:v1:"), "format versionné");
    ok(c1 !== c2, "IV unique par scellement");
    ok(b.open(c2) === B32, "les deux se déchiffrent");
  });

  // ── SB-03 : altération → rejet (GCM authentifié) ──
  await it("SB-03 chiffré altéré → rejet net", async () => {
    const b = box(); const c = b.seal(B32);
    const t = c.slice(0, -4) + (c.endsWith("AAAA") ? "BBBB" : "AAAA");
    await refuse(() => b.open(t), "déchiffrement");
  });

  // ── SB-04 : mauvaise clé → rejet ──
  await it("SB-04 autre clé → rejet (pas de silence)", async () => {
    const c = box().seal(B32);
    await refuse(() => new SecretBox(randomBytes(32).toString("base64")).open(c), "déchiffrement");
  });

  // ── SB-05 : legacy en clair → passthrough (migration douce, esprit R29) ──
  await it("SB-05 valeur legacy sans préfixe → restituée telle quelle", () => {
    ok(box().open(B32) === B32, "grandfathering des secrets posés avant chiffrement");
  });

  // ── SB-06 : fail-fast sans clé ──
  await it("SB-06 clé absente/trop courte → constructeur refuse", async () => {
    await refuse(() => new SecretBox(""), "MFA_ENC_KEY");
    await refuse(() => new SecretBox("court"), "MFA_ENC_KEY");
  });

  // ── Intégration : enrôlement chiffre en base, TOTP réel vérifie à travers le chiffré ──
  await it("MFA-INT enrôlement → mfaSecret CHIFFRÉ en base, jamais en clair", async () => {
    const db: any = { u1: { id: "u1", tenantId: "t1", email: "i.vernet@gwb.ch", mfaSecret: null, mfaEnabled: false } };
    const prisma: any = { user: {
      findFirst: async ({ where }: any) => db.u1.id === where.id && db.u1.tenantId === where.tenantId ? db.u1 : null,
      update: async ({ data }: any) => Object.assign(db.u1, data) } };
    const svc = new MfaService(prisma, box());
    const { secret } = await svc.beginEnrollment("t1", "u1");
    ok(db.u1.mfaSecret.startsWith("enc:v1:"), "stocké chiffré");
    ok(!db.u1.mfaSecret.includes(secret), "le base32 n'apparaît pas en base");
    // confirmation avec un VRAI code TOTP calculé sur le secret clair montré au user
    const code = Totp.generate(Totp.base32Decode(secret));
    const r = await svc.confirmEnrollment("t1", "u1", code);
    ok(r.enabled === true && db.u1.mfaEnabled === true, "activée via code valide à travers le chiffré");
  });
  await it("MFA-INT login : Totp.verify réussit sur secret chiffré, échoue sur mauvais code", async () => {
    const b = box(); const clair = Totp.base32Encode(randomBytes(20));
    const sealed = b.seal(clair);
    // même chaîne que auth.service patché : open() puis base32Decode puis verify
    ok(Totp.verify(Totp.generate(Totp.base32Decode(b.open(sealed))),
       Totp.base32Decode(b.open(sealed))), "code valide accepté");
    ok(!Totp.verify("000000", Totp.base32Decode(b.open(sealed))), "mauvais code refusé");
  });
  await it("MFA-INT user legacy (secret en clair posé avant chiffrement) → login MFA marche encore", async () => {
    const clair = Totp.base32Encode(randomBytes(20));
    ok(Totp.verify(Totp.generate(Totp.base32Decode(clair)),
       Totp.base32Decode(box().open(clair))), "open() passthrough → aucun user verrouillé");
  });

  console.log(`\nSecretBox mfa_secret (SB-01..06 + intégration MFA) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
