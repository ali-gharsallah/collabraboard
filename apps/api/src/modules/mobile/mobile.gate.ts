import { UnauthorizedException } from "@nestjs/common";
import { verify, decode } from "jsonwebtoken";
import { KeyStore } from "../auth/key-store";

// ═══ R316 (dégel V7, GO Ali 2026-07-28) — la PORTE de la population mobile. ═══
// Les clients finaux sont une population IAM DISTINCTE : leur jeton porte `pop: "MOBILE"`
// et JAMAIS de rôle ; la porte interne (TenantMiddleware) rejette ce marqueur, celle-ci
// rejette tout jeton de la population interne. L'étanchéité vaut dans les DEUX sens —
// structurelle, pas une convention par contrôleur.

export const SURFACE_MOBILE = /^\/v1\/mobile\/(auth|client)(\/|$)/;

export function garderMobile(req: any, chemin: string, keys: KeyStore, next: () => void) {
  // Les routes d'auth mobile portent leur preuve DANS le corps (code hors bande, MFA) —
  // publiques au sens de la porte, jamais au sens du contrôle (tout est vérifié serveur).
  if (chemin.startsWith("/v1/mobile/auth/")) return next();
  const raw = (req.headers?.authorization ?? "").replace(/^Bearer /, "");
  let claims: any;
  try {
    const kid = (decode(raw, { complete: true }) as any)?.header?.kid;
    if (!kid) throw new Error("kid absent");
    claims = verify(raw, keys.verificationKey(kid), { algorithms: ["RS256"] });
  } catch { throw new UnauthorizedException("Jeton invalide ou expiré"); }
  if (claims.pop !== "MOBILE" || claims.role)
    throw new UnauthorizedException(
      "R316 : la surface client mobile n'admet que la population MOBILE — jamais un jeton interne (deux portes, zéro partage)");
  req.mobileCtx = { tenantId: claims.tid, identiteId: claims.mid, clientId: claims.cid };
  next();
}
