import { createSign, generateKeyPairSync } from "node:crypto";

// Émission de licences SIGNÉES (R320) : la clé privée VENDOR signe ; l'instance tenant
// vérifie avec la clé publique (OLIVE_LICENSE_PUBKEY). Le BODY signé est EXACTEMENT celui
// que le LicenseService tenant recompose — { tenantId, modules, seats, expiresAt, issuedAt }
// en SHA256 — pour que la licence descendante soit vérifiable SANS coupler les deux bases.
export function corpsLicence({ tenantId, modules, seats, expiresAt, issuedAt }) {
  return JSON.stringify({ tenantId, modules, seats, expiresAt, issuedAt });
}

export class EmetteurLicences {
  #privateKeyPem;
  constructor(privateKeyPem) { this.#privateKeyPem = privateKeyPem; }

  // Émet une licence signée pour un tenant. issuedAt/expiresAt sont fournis (jamais Date.now()
  // implicite : la traçabilité de l'émission vit au registre vendor).
  emettre({ tenantId, modules, seats = 25, issuedAt, expiresAt }) {
    if (!tenantId || !Array.isArray(modules)) throw new Error("tenantId et modules[] requis");
    if (!issuedAt || !expiresAt) throw new Error("issuedAt et expiresAt requis (émission tracée)");
    const body = corpsLicence({ tenantId, modules, seats, expiresAt, issuedAt });
    const signature = createSign("SHA256").update(body).sign(this.#privateKeyPem, "base64");
    return { tenantId, modules, seats, expiresAt, issuedAt, signature };
  }
}

// Génère une paire de clés vendor (la publique se dépose côté tenant en OLIVE_LICENSE_PUBKEY).
export function genererPaireVendor() {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return { publicKeyPem: publicKey.export({ type: "spki", format: "pem" }),
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }) };
}
