import { createPublicKey, verify as cryptoVerify } from "crypto";
import type { OidcClaims } from "./oidc.service";

/**
 * Vérification du jeton d'identité de l'IdP contre son JWKS (JV-01..07).
 * Ferme le point d'injection `verifyIdToken` (jetait « brancher la vérif JWKS »).
 *
 * Périmètre STRICT — signature seulement :
 *  - RS256 seul admis (rejet net de `none` et HS256 : pas de confusion d'algorithme) ;
 *  - kid résolu dans le JWKS mis en cache (TTL) ; kid inconnu → UN re-fetch (rotation IdP),
 *    puis rejet — jamais de boucle ;
 *  - les contrôles métier (iss/aud/exp/email) restent dans OidcService.login (OI-01..06).
 *
 * Zéro dépendance : crypto natif (JWK → clé publique via createPublicKey format 'jwk'),
 * fetcher injecté (testable sans réseau ; en prod : fetch du point /certs de l'IdP).
 */

type Jwk = { kid: string; kty: string; n?: string; e?: string; alg?: string; use?: string };
type JwksFetcher = () => Promise<{ keys: Jwk[] }>;

const b64uJson = (s: string): any => JSON.parse(Buffer.from(s, "base64url").toString("utf8"));

export class JwksVerifier {
  private keys = new Map<string, Jwk>();
  private fetchedAt = 0;
  private readonly fetcher: JwksFetcher;

  constructor(private readonly jwksUri: string, fetcher?: JwksFetcher,
              private readonly ttlMs = 10 * 60_000) {
    this.fetcher = fetcher ?? (async () => {
      const res = await fetch(this.jwksUri);
      if (!res.ok) throw new Error(`JWKS IdP inaccessible (${res.status})`);
      return res.json() as Promise<{ keys: Jwk[] }>;
    });
  }

  async verify(token: string): Promise<OidcClaims> {
    const parts = (token ?? "").split(".");
    if (parts.length !== 3) throw new Error("Jeton OIDC malformé");
    const [h, p, s] = parts;

    let header: any;
    try { header = b64uJson(h); } catch { throw new Error("Jeton OIDC malformé (header)"); }
    if (header.alg !== "RS256")
      throw new Error(`algorithme refusé : « ${header.alg} » (RS256 seul admis)`);
    if (!header.kid) throw new Error("kid absent de l'en-tête OIDC");

    const jwk = await this.resolveKid(header.kid);
    const pub = createPublicKey({ key: jwk as any, format: "jwk" });
    const valid = cryptoVerify("RSA-SHA256", Buffer.from(`${h}.${p}`),
      pub, Buffer.from(s, "base64url"));
    if (!valid) throw new Error("signature OIDC invalide");

    return b64uJson(p) as OidcClaims;
  }

  /** kid → JWK. Cache TTL ; kid inconnu → re-fetch UNE fois (rotation), puis rejet net. */
  private async resolveKid(kid: string): Promise<Jwk> {
    if (this.expired()) await this.refetch();
    let k = this.keys.get(kid);
    if (!k) { await this.refetch(); k = this.keys.get(kid); }   // rotation IdP (JV-04)
    if (!k) throw new Error(`kid inconnu du JWKS de l'IdP : ${kid}`);
    return k;
  }
  private expired(): boolean { return Date.now() - this.fetchedAt > this.ttlMs; }
  private async refetch(): Promise<void> {
    const { keys } = await this.fetcher();
    this.keys = new Map(keys.map((k) => [k.kid, k]));
    this.fetchedAt = Date.now();
  }
}

/* Câblage (auth.module.ts) — remplace le stub qui jetait :
   function oidcConfigFromEnv(): OidcConfig {
     const verifier = new JwksVerifier(process.env.OIDC_JWKS_URI ?? "");
     return { issuer: …, audience: …, roleMapping: …, defaultRole: …,
              verifyIdToken: (t) => verifier.verify(t) };
   } */
