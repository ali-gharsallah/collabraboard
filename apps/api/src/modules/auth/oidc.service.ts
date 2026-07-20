import { Injectable, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { Role } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";

export interface OidcClaims { iss: string; aud: string | string[]; exp: number; email: string; sub: string; groups?: string[]; }
export interface OidcConfig {
  issuer: string;                          // ex : https://login.gwb.ch/realms/olive
  audience: string;                        // client_id O-Live
  roleMapping: Record<string, string>;     // groupe IdP → rôle O-Live
  defaultRole?: string;                    // rôle si aucun groupe mappé (optionnel)
  verifyIdToken: (token: string) => Promise<OidcClaims>;   // vérif signature via JWKS de l'IdP (injectée)
}

/**
 * SSO OIDC (fédération d'identité banque). Valide le jeton d'identité de l'IdP (Keycloak, Entra ID,
 * Ping…), mappe les groupes IdP vers un rôle O-Live, et provisionne le user en JIT (Just-In-Time).
 * L'IdP reste la source de vérité : le rôle est recalculé à chaque connexion. SAML : même flux,
 * verifyIdToken remplacé par une vérif d'assertion XML signée (adaptateur séparé).
 */
@Injectable()
export class OidcService {
  constructor(private readonly prisma: PrismaService, private readonly cfg: OidcConfig) {}

  async login(tenantId: string, idToken: string): Promise<{ userId: string; tenantId: string; role: string; provisioned: boolean }> {
    const c = await this.cfg.verifyIdToken(idToken);          // ← signature vérifiée (JWKS IdP)
    if (c.iss !== this.cfg.issuer) throw new UnauthorizedException("Émetteur OIDC inattendu");
    const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
    if (!aud.includes(this.cfg.audience)) throw new UnauthorizedException("Audience OIDC invalide");
    if (!c.exp || c.exp * 1000 < Date.now()) throw new UnauthorizedException("Jeton OIDC expiré");
    if (!c.email) throw new UnauthorizedException("Jeton OIDC sans email");

    const role = (c.groups ?? []).map((g) => this.cfg.roleMapping[g]).find(Boolean) ?? this.cfg.defaultRole;
    if (!role) throw new ForbiddenException("Aucun rôle O-Live mappé pour cet utilisateur fédéré");

    let user = await this.prisma.user.findFirst({ where: { tenantId, email: c.email } });
    let provisioned = false;
    if (!user) {
      // Provisioning JIT : compte fédéré, sans mot de passe local.
      user = await this.prisma.user.create({
        data: { tenantId, email: c.email, name: c.email, role: role as Role, active: true, passwordHash: "" } });
      provisioned = true;
    } else {
      if (user.active === false) throw new UnauthorizedException("Compte désactivé");
      if (user.role !== role) {   // l'IdP est la source de vérité du rôle
        user = await this.prisma.user.update({ where: { id: user.id }, data: { role: role as Role } });
      }
    }
    return { userId: user.id, tenantId, role, provisioned };
  }
}
