import { Injectable, NestMiddleware, UnauthorizedException } from "@nestjs/common";
import { verify, decode } from "jsonwebtoken";
import { KeyStore } from "../modules/auth/key-store";

/**
 * Extrait tenant/user/rôle du JWT (RS256) et les pose sur req.ctx.
 * La clé publique est résolue par le `kid` de l'en-tête via le trousseau (KeyStore) : la
 * rotation des clés n'invalide pas les jetons encore valides (période de grâce, cf. JWKS).
 * La connexion Prisma exécute ensuite SET app.tenant_id → la RLS s'applique.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly keys: KeyStore) {}

  use(req: any, _res: any, next: () => void) {
    if (req.path === "/v1/auth/token" || req.path === "/v1/auth/oidc/login"
        || req.path === "/v1/.well-known/jwks.json") return next();   // routes publiques
    const raw = (req.headers.authorization ?? "").replace(/^Bearer /, "");
    try {
      const kid = (decode(raw, { complete: true }) as any)?.header?.kid;
      if (!kid) throw new Error("kid absent");
      const pub = this.keys.verificationKey(kid);          // lève si kid inconnu/expiré
      const claims = verify(raw, pub, { algorithms: ["RS256"] }) as any;
      req.ctx = { tenantId: claims.tid, userId: claims.sub, role: claims.role };
      next();
    } catch { throw new UnauthorizedException("Jeton invalide ou expiré"); }
  }
}
