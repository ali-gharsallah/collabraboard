import { Global, Module, Controller, Post, Get, Body, Param, Req, BadRequestException, UseGuards } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuthService } from "./auth.service";
import { UsersService } from "./users.service";
import { MfaService } from "./mfa.service";
import { OidcService, OidcConfig } from "./oidc.service";
import { KeyStore } from "./key-store";
import { RolesGuard } from "./roles.guard";
import { Roles } from "./roles.decorator";
import { SecretBox } from "../../common/secret-box";

@Controller("auth")
class AuthController {
  constructor(private readonly auth: AuthService, private readonly oidc: OidcService) {}
  @Post("token")
  token(@Body() b: any) {
    if (!b?.tenant_id || !b?.email || !b?.password) throw new BadRequestException("tenant_id, email et password requis");
    return this.auth.issueToken({ tenantId: b.tenant_id, email: b.email, password: b.password, totp: b.totp });
  }
  @Post("oidc/login")   // SSO : échange un id_token IdP contre une session O-Live
  oidc_login(@Body() b: any) {
    if (!b?.tenant_id || !b?.id_token) throw new BadRequestException("tenant_id et id_token requis");
    return this.oidc.login(b.tenant_id, b.id_token);
  }
}

@Controller(".well-known")
class JwksController {
  constructor(private readonly keys: KeyStore) {}
  @Get("jwks.json") jwks() { return this.keys.jwks(); }    // clés publiques (rotation)
}

@Controller("auth/mfa")
class MfaController {
  constructor(private readonly mfa: MfaService) {}
  @Post("enroll")  enroll(@Req() r: any) { return this.mfa.beginEnrollment(r.ctx.tenantId, r.ctx.userId); }
  @Post("confirm") confirm(@Req() r: any, @Body() b: any) { return this.mfa.confirmEnrollment(r.ctx.tenantId, r.ctx.userId, b?.code); }
}

@Controller("admin/users")
@UseGuards(RolesGuard) @Roles("ADMIN")     // toute l'API admin réservée aux ADMIN
class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get()               list(@Req() r: any) { return this.users.list(r.ctx.tenantId); }
  @Post()              create(@Req() r: any, @Body() b: any) { return this.users.create(r.ctx.tenantId, b); }
  @Post(":id/active")  active(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.users.setActive(r.ctx.tenantId, id, !!b?.active); }
  @Post(":id/role")    role(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.users.setRole(r.ctx.tenantId, id, b?.role, r.ctx.userId); }
  @Post(":id/reset-mfa") resetMfa(@Req() r: any, @Param("id") id: string) { return this.users.resetMfa(r.ctx.tenantId, id); }
}

// ── IM-05 (canon triage écrans, ratifié 2026-07-28) : le guide IAM — route LECTURE SEULE
// signalée à l'étape 0.d (pattern GET /v1/cpsi/rules). Rend les règles IAM RATIFIÉES
// (R89-R99 + R13/R284), la matrice rôles×surfaces effective et l'état RÉEL du tenant
// (comptes par rôle, MFA). Daté : l'export PDF de l'écran reflète la matrice en vigueur.
@Controller("admin/iam")
@UseGuards(RolesGuard) @Roles("ADMIN")
class IamGuideController {
  constructor(private readonly users: UsersService) {}
  @Get("guide")
  async guide(@Req() r: any) {
    const us = await this.users.list(r.ctx.tenantId);
    const parRole: Record<string, number> = {};
    for (const u of us) parRole[u.role] = (parRole[u.role] ?? 0) + 1;
    return {
      genereAt: new Date().toISOString(),
      modeAuth: "JWT RS256 (rotation JWKS par kid — période de grâce)",
      regles: [
        { code: "R89", texte: "Le rôle n'est PAS falsifiable : il vient du user en base, jamais du client (AU-02/04/06)." },
        { code: "R90", texte: "MFA TOTP : enrôlement prouvé (RFC 6238), secret chiffré au repos (SecretBox)." },
        { code: "R91-R99", texte: "RBAC : périmètre appliqué SERVEUR sur chaque route ; OIDC/SSO en échange d'id_token ; JWKS servi en .well-known." },
        { code: "R13", texte: "Four-eyes : l'initiateur ne vise jamais son propre acte — partout où un visa existe." },
        { code: "R284", texte: "SO audite les journaux, jamais les dossiers ; cumul SO+ADMIN refusé (cumul_so_admin_interdit) ; l'auditeur est audité (AUDIT_ACCESS)." },
        { code: "IM-02", texte: "Le dernier ADMIN actif ne se retire pas (IAM_DERNIER_ADMIN) — nommer un second d'abord." },
      ],
      matrice: {                                                             // rôles × surfaces (matrice A.3 + R284)
        RM: "ses clients (Client.rmUserId) — opérationnel", ARM: "ses clients — opérationnel",
        CO: "tenant — opérationnel compliance", CO_SR: "tenant — validation finale, motifs sensibles",
        MLRO: "tenant — MROS, motifs sensibles", CF: "tenant — central file", BRM: "tuiles risque",
        DIR: "tenant entier — pilotage (Command Center), aucune écriture métier",
        ADMIN: "paramétrage — AUCUNE donnée client", SO: "surface d'audit (journaux, lecture seule) — aucun accès opérationnel",
      },
      utilisateurs: { total: us.length, parRole, mfaActifs: us.filter((u) => u.mfaEnabled).length },
    };
  }
}

// Config OIDC depuis l'environnement (verifyIdToken → JWKS de l'IdP, via jose/jwks-rsa en prod).
function oidcConfigFromEnv(): OidcConfig {
  return {
    issuer: process.env.OIDC_ISSUER ?? "",
    audience: process.env.OIDC_AUDIENCE ?? "",
    roleMapping: JSON.parse(process.env.OIDC_ROLE_MAPPING ?? "{}"),
    defaultRole: process.env.OIDC_DEFAULT_ROLE,
    verifyIdToken: async (_t: string) => { throw new Error("verifyIdToken: brancher la vérif JWKS de l'IdP"); },
  };
}

@Global()
@Module({
  controllers: [AuthController, JwksController, MfaController, UsersController, IamGuideController],
  providers: [
    AuthService, UsersService, MfaService, RolesGuard,
    // MfaService dépend de SecretBox (metadata décorateur → DI, la valeur par défaut du
    // constructeur ne suffit pas). Câblage documenté dans mfa.service.ts.
    { provide: SecretBox, useFactory: () => new SecretBox(process.env.MFA_ENC_KEY) },
    { provide: KeyStore, useValue: new KeyStore() },
    { provide: OidcService, useFactory: (p: PrismaService) => new OidcService(p, oidcConfigFromEnv()), inject: [PrismaService] }],
  exports: [KeyStore],
})
export class AuthModule {}
declare const process: any;
