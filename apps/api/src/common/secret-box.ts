import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * Chiffrement au repos des secrets applicatifs (mfa_secret) — SB-01..06.
 * AES-256-GCM (authentifié : toute altération est détectée), IV frais par scellement,
 * format versionné `enc:v1:<iv>.<tag>.<ct>` (base64url) pour permettre une rotation de
 * schéma future (v2 = nouvelle clé/algo) sans deviner.
 *
 * Migration douce : `open()` restitue telle quelle une valeur SANS préfixe (secret legacy
 * posé avant le chiffrement) — aucun utilisateur verrouillé ; le secret se re-chiffre au
 * prochain enrôlement. Esprit grandfathering (R29).
 *
 * Fail-fast : clé absente ou trop courte → refus au construct (même doctrine que
 * AUDIT_HMAC_SECRET : un chiffrement sans clé n'a aucune valeur).
 */
export class SecretBox {
  private readonly key: Buffer;

  /** `keyMaterial` : MFA_ENC_KEY (>= 32 octets de matière ; dérivée en clé 256 bits). */
  constructor(keyMaterial: string | undefined) {
    if (!keyMaterial || keyMaterial.length < 16)
      throw new Error("MFA_ENC_KEY manquante ou trop courte — chiffrement au repos non sécurisable");
    this.key = createHash("sha256").update(keyMaterial).digest();   // dérivation simple, déterministe
  }

  seal(plain: string): string {
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", this.key, iv);
    const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
    return `enc:v1:${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${ct.toString("base64url")}`;
  }

  open(stored: string): string {
    if (!stored.startsWith("enc:v1:")) return stored;               // SB-05 : legacy passthrough
    try {
      const [iv, tag, ct] = stored.slice("enc:v1:".length).split(".");
      const d = createDecipheriv("aes-256-gcm", this.key, Buffer.from(iv, "base64url"));
      d.setAuthTag(Buffer.from(tag, "base64url"));
      return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
    } catch {
      throw new Error("déchiffrement mfa_secret impossible (clé erronée ou donnée altérée)");
    }
  }
}
