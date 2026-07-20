/** Tests JWKS / rotation — trousseau multi-clés, période de grâce, JWKS, paire valide. */
import { KeyStore } from "./key-store";
import { sign as cryptoSign, verify as cryptoVerify } from "crypto";
declare const process: any; declare const Buffer: any;

let passed = 0, failed = 0; const fails: string[] = [];
function it(n: string, fn: () => void): void { try { fn(); passed++; } catch (e) { failed++; fails.push(`✗ ${n} — ${(e as Error).message}`); } }
function ok(c: boolean, m = "assertion"): void { if (!c) throw new Error(m); }
function throws(fn: () => void, part: string): void { try { fn(); } catch (e) { if ((e as Error).message.includes(part)) return; throw new Error(`«${part}» attendu`); } throw new Error(`exception «${part}» attendue`); }

// KS-01 — JWKS de départ : 1 clé RSA (kid, kty, n, e)
it("KS-01 JWKS initial (1 clé RSA)", () => {
  const jwks = new KeyStore().jwks();
  ok(jwks.keys.length === 1);
  const k = jwks.keys[0];
  ok(k.kty === "RSA" && !!k.n && !!k.e && !!k.kid && k.alg === "RS256" && !k.d /* pas de privé */);
});
// KS-02 — rotation : nouveau kid actif, ancienne clé conservée
it("KS-02 rotation → nouveau kid actif, ancien conservé", () => {
  const ks = new KeyStore();
  const k1 = ks.activeKidPublic;
  const k2 = ks.rotate();
  ok(k2 !== k1 && ks.activeKidPublic === k2);
  ok(ks.jwks().keys.length === 2);                       // les deux publiées (grâce)
  ok(ks.signingKey().kid === k2);                        // on signe avec la nouvelle
});
// KS-03 — période de grâce : ancien kid vérifiable ; purge au-delà de `grace`
it("KS-03 grâce + purge", () => {
  const ks = new KeyStore(2);                            // conserve 2 clés
  const k1 = ks.activeKidPublic;
  const k2 = ks.rotate();
  ok(!!ks.verificationKey(k1) && !!ks.verificationKey(k2));   // les deux résolvent
  ks.rotate();                                           // 3e clé → k1 purgée
  throws(() => ks.verificationKey(k1), "inconnu");
});
// KS-04 — kid inconnu → erreur
it("KS-04 kid inconnu → erreur", () => {
  throws(() => new KeyStore().verificationKey("nope"), "inconnu");
});
// KS-05 — la paire active signe et vérifie réellement (RSA-SHA256)
it("KS-05 paire active valide (sign/verify réel)", () => {
  const ks = new KeyStore();
  const { privatePem } = ks.signingKey();
  const pub = ks.verificationKey(ks.activeKidPublic);
  const data = Buffer.from("olive-payload");
  const sig = cryptoSign("sha256", data, privatePem);
  ok(cryptoVerify("sha256", data, pub, sig) === true);
  ok(cryptoVerify("sha256", Buffer.from("altéré"), pub, sig) === false);
});

console.log(`\nJWKS / rotation — ${passed}/${passed + failed} tests verts`);
if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
