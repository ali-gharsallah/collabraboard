import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

/**
 * Hachage de mot de passe basé sur scrypt (primitive mémoire-dure, native Node — aucune
 * dépendance). Format auto-descriptif : scrypt$N$r$p$salt$hash. Comparaison à temps constant.
 */
export class PasswordHasher {
  private static N = 16384; private static r = 8; private static p = 1; private static KEYLEN = 64;

  static hash(password: string): string {
    const salt = randomBytes(16);
    const dk = scryptSync(password, salt, PasswordHasher.KEYLEN,
      { N: PasswordHasher.N, r: PasswordHasher.r, p: PasswordHasher.p });
    return `scrypt$${PasswordHasher.N}$${PasswordHasher.r}$${PasswordHasher.p}$${salt.toString("hex")}$${dk.toString("hex")}`;
  }

  static verify(password: string, stored: string): boolean {
    const parts = (stored ?? "").split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const [, nS, rS, pS, saltHex, hashHex] = parts;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    let dk: Buffer;
    try {
      dk = scryptSync(password, salt, expected.length,
        { N: parseInt(nS, 10), r: parseInt(rS, 10), p: parseInt(pS, 10) });
    } catch { return false; }
    return dk.length === expected.length && timingSafeEqual(dk, expected);
  }
}
