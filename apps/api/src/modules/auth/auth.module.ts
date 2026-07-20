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
  @Post(":id/role")    role(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.users.setRole(r.ctx.tenantId, id, b?.role); }
  @Post(":id/reset-mfa") resetMfa(@Req() r: any, @Param("id") id: string) { return this.users.resetMfa(r.ctx.tenantId, id); }
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
  controllers: [AuthController, JwksController, MfaController, UsersController],
  providers: [
    AuthService, UsersService, MfaService, PrismaService, RolesGuard,
    // MfaService dépend de SecretBox (metadata décorateur → DI, la valeur par défaut du
    // constructeur ne suffit pas). Câblage documenté dans mfa.service.ts.
    { provide: SecretBox, useFactory: () => new SecretBox(process.env.MFA_ENC_KEY) },
    { provide: KeyStore, useValue: new KeyStore() },
    { provide: OidcService, useFactory: (p: PrismaService) => new OidcService(p, oidcConfigFromEnv()), inject: [PrismaService] },
  ],
  exports: [KeyStore],
})
export class AuthModule {}
declare const process: any;
