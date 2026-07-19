import { Injectable } from "@nestjs/common";
import { generateKeyPairSync, createPublicKey, randomUUID, sign as cryptoSign, verify as cryptoVerify } from "crypto";

interface StoredKey { kid: string; privatePem: string; publicPem: string; createdAt: number; }

/**
 * Trousseau de clés RS256 avec rotation. Signe avec la clé active (kid dans l'en-tête JWT),
 * conserve les anciennes clés (période de grâce) pour vérifier les jetons encore valides, et
 * expose un JWKS (/.well-known/jwks.json). Aucune dépendance (crypto natif).
 */
@Injectable()
export class KeyStore {
  private keys: StoredKey[] = [];
  private activeKid = "";
  constructor(private readonly grace = 3) { this.rotate(); }

  /** Génère une nouvelle clé, la rend active, purge au-delà de `grace` clés. */
  rotate(): string {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const kid = randomUUID();
    this.keys.unshift({ kid,
      privatePem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      publicPem: publicKey.export({ type: "spki", format: "pem" }).toString(), createdAt: Date.now() });
    this.keys = this.keys.slice(0, this.grace);
    this.activeKid = kid;
    return kid;
  }

  signingKey(): { kid: string; privatePem: string } {
    const k = this.keys.find((x) => x.kid === this.activeKid)!;
    return { kid: k.kid, privatePem: k.privatePem };
  }

  /** Résout la clé publique par kid (jetons signés avant rotation restent vérifiables). */
  verificationKey(kid: string): string {
    const k = this.keys.find((x) => x.kid === kid);
    if (!k) throw new Error(`kid inconnu ou expiré : ${kid}`);
    return k.publicPem;
  }

  /** JWKS public pour le point /.well-known/jwks.json (jamais la clé privée). */
  jwks(): { keys: any[] } {
    return { keys: this.keys.map((k) => ({ kid: k.kid, use: "sig", alg: "RS256",
      ...(createPublicKey(k.publicPem).export({ format: "jwk" }) as any) })) };
  }

  get activeKidPublic(): string { return this.activeKid; }
}
