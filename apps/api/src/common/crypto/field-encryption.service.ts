import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

// Chiffrement de champ (nom, IBAN, TIN, passeport, adresse, téléphone) :
// enveloppe — une DEK par tenant, chiffrée par la KEK (KMS/Vault en prod).
// Format stocké : v1.<iv b64>.<tag b64>.<ciphertext b64>
export class FieldEncryption {
  constructor(private dek: Buffer) {
    if (dek.length !== 32) throw new Error("DEK : 32 octets requis (AES-256)");
  }
  static dekFromKms(kekWrappedDek: string, unwrap: (w: string) => Buffer) {
    return new FieldEncryption(unwrap(kekWrappedDek));
  }
  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", this.dek, iv);
    const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
    return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), ct.toString("base64")].join(".");
  }
  decrypt(stored: string): string {
    const [v, iv, tag, ct] = stored.split(".");
    if (v !== "v1") throw new Error("version de chiffrement inconnue");
    const d = createDecipheriv("aes-256-gcm", this.dek, Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(ct, "base64")), d.final()]).toString("utf8");
  }
  // Index de recherche aveugle (égalité exacte) sans révéler la valeur :
  blindIndex(plain: string, salt: string): string {
    return createHash("sha256").update(salt + "|" + plain.toLowerCase().trim()).digest("hex").slice(0, 32);
  }
}
