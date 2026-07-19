import { createHmac } from "crypto";

/**
 * TOTP (RFC 6238) sur HOTP (RFC 4226), HMAC-SHA1 — natif, sans dépendance.
 * Compatible Google Authenticator / Authy (période 30 s, 6 chiffres par défaut).
 */
export class Totp {
  private static hotp(secret: Buffer, counter: number, digits: number): string {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(counter));
    const h = createHmac("sha1", secret).update(buf).digest();
    const off = h[h.length - 1] & 0x0f;
    const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
    return (bin % 10 ** digits).toString().padStart(digits, "0");
  }

  static generate(secret: Buffer, at = Date.now(), period = 30, digits = 6): string {
    return Totp.hotp(secret, Math.floor(at / 1000 / period), digits);
  }

  /** Vérifie avec tolérance ±window périodes (dérive d'horloge). Comparaison sans court-circuit. */
  static verify(token: string, secret: Buffer, at = Date.now(), window = 1, period = 30, digits = 6): boolean {
    const c = Math.floor(at / 1000 / period);
    let ok = false;
    for (let w = -window; w <= window; w++) if (Totp.hotp(secret, c + w, digits) === token) ok = true;
    return ok;
  }

  /** Encode des octets en base32 (RFC 4648, sans padding). */
  static base32Encode(buf: Buffer): string {
    const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = 0, val = 0, out = "";
    for (const b of buf) { val = (val << 8) | b; bits += 8;
      while (bits >= 5) { out += A[(val >>> (bits - 5)) & 31]; bits -= 5; } }
    if (bits > 0) out += A[(val << (5 - bits)) & 31];
    return out;
  }

  /** Décode un secret base32 (RFC 4648, sans padding) → Buffer. */
  static base32Decode(b32: string): Buffer {
    const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = 0, val = 0; const out: number[] = [];
    for (const ch of b32.replace(/=+$/, "").toUpperCase()) {
      const idx = A.indexOf(ch); if (idx < 0) continue;
      val = (val << 5) | idx; bits += 5;
      if (bits >= 8) { out.push((val >>> (bits - 8)) & 0xff); bits -= 8; }
    }
    return Buffer.from(out);
  }
}
