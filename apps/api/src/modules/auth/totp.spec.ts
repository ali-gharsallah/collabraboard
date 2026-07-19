/** Tests TOTP — vecteurs officiels RFC 6238 (SHA1, 8 chiffres, secret ASCII "12345678901234567890"). */
import { Totp } from "./totp";
declare const process: any; declare const Buffer: any;

const SEC = Buffer.from("12345678901234567890", "ascii");   // 20 octets, cf. RFC 6238 Annexe B
let passed = 0, failed = 0; const fails: string[] = [];
function it(name: string, fn: () => void): void { try { fn(); passed++; } catch (e) { failed++; fails.push(`✗ ${name} — ${(e as Error).message}`); } }
function ok(c: boolean, m = "assertion"): void { if (!c) throw new Error(m); }

// TP-01 — vecteurs RFC 6238 (8 chiffres)
it("TP-01 vecteurs officiels RFC 6238", () => {
  const V: Array<[number, string]> = [
    [59, "94287082"], [1111111109, "07081804"], [1111111111, "14050471"],
    [1234567890, "89005924"], [2000000000, "69279037"], [20000000000, "65353130"],
  ];
  for (const [t, code] of V) ok(Totp.generate(SEC, t * 1000, 30, 8) === code, `T=${t} → attendu ${code}, obtenu ${Totp.generate(SEC, t * 1000, 30, 8)}`);
});
// TP-02 — verify accepte le bon code, rejette un mauvais
it("TP-02 verify OK / KO", () => {
  const now = 1234567890 * 1000;
  const code = Totp.generate(SEC, now, 30, 8);
  ok(Totp.verify(code, SEC, now, 1, 30, 8) === true);
  ok(Totp.verify("00000000", SEC, now, 1, 30, 8) === false);
});
// TP-03 — tolérance de fenêtre (code de la période précédente accepté)
it("TP-03 tolérance ±1 période", () => {
  const now = 1234567890 * 1000;
  const prev = Totp.generate(SEC, now - 30000, 30, 8);
  ok(Totp.verify(prev, SEC, now, 1, 30, 8) === true);          // dans la fenêtre
  ok(Totp.verify(prev, SEC, now, 0, 30, 8) === false);         // hors fenêtre (window 0)
});
// TP-04 — base32 decode (secret authenticator standard)
it("TP-04 base32 decode", () => {
  // "JBSWY3DPEHPK3PXP" = base32 de "Hello!\xDE\xAD\xBE\xEF" ; on vérifie le round-trip via un code stable
  const sec = Totp.base32Decode("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");   // = "12345678901234567890"
  ok(sec.toString("ascii") === "12345678901234567890");
  ok(Totp.generate(sec, 59000, 30, 8) === "94287082");         // cohérent avec TP-01
});

console.log(`\nTOTP/MFA — ${passed}/${passed + failed} tests verts`);
if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
