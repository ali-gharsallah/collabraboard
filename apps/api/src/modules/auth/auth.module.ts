import { Global, Module, Controller, Post, Get, Body, Param, Req, BadRequestException, UseGuards, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuthService } from "./auth.service";
import { UsersService } from "./users.service";
import { AuditService } from "../../common/audit.service";
import { ParametresModule } from "../parametres/parametres.module";   // R290 : sso_mode s'écrit PAR le registre
import { ParametresService } from "../parametres/parametres.service";
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

// ═══ R290 (extension MOD-30, ratifiée 2026-07-28) — la porte d'entrée de la banque se PILOTE,
// tracée. Config OIDC DÉCLARÉE = clé R-Q `ssoOidc` (JAMAIS de secret — IM-01) ; test de
// connexion = DRY-RUN tracé (IM-03) ; rotation JWKS = COMMANDE motivée sur le trousseau
// existant (KeyStore.rotate, grâce structurelle) ; bascule de mode = DEUX REGARDS (R13,
// l'initiateur ne vise pas) à DATE D'EFFET — écrite PAR le registre (sso_mode, R68/R126),
// sessions du jour grandfathérées (IM-04). Écart consigné : le login OIDC effectif lit
// encore l'environnement (résolution per-tenant au login = extension future signalée).
@Controller("admin/sso")
@UseGuards(RolesGuard) @Roles("ADMIN")
class SsoController {
  constructor(private readonly prisma: PrismaService, private readonly keys: KeyStore,
    private readonly parametres: ParametresService, private readonly audit: AuditService) {}

  private async reglages(tenantId: string) {
    const t = await this.prisma.tenant.findFirst({ where: { id: tenantId } });
    return ((t?.settings as any) ?? {});
  }
  private emit(tenantId: string, type: string, payload: any) {
    return this.prisma.domainEvent.create({ data: { tenantId, type, aggregateId: "sso",
      payload, at: new Date().toISOString() } });
  }

  @Get("etat")
  async etat(@Req() r: any) {
    const s = await this.reglages(r.ctx.tenantId);
    const declare = s.ssoOidc ?? { issuer: process.env.OIDC_ISSUER || null, audience: process.env.OIDC_AUDIENCE || null };
    const derniere = await this.prisma.domainEvent.findFirst({
      where: { tenantId: r.ctx.tenantId, type: "sso.jwks.rotation" }, orderBy: { id: "desc" } });
    return {
      oidc: { issuer: declare.issuer ?? null, audience: declare.audience ?? null,
        roleMapping: declare.roleMapping ?? null,
        secretConfigure: !!process.env.OIDC_CLIENT_SECRET },               // IM-01 : le FAIT, jamais la valeur
      jwks: { kidCourant: this.keys.signingKey().kid, derniereRotation: derniere?.at ?? null },
      mode: s.sso_mode ?? "jwt",
      basculeEnAttente: s.ssoBasculeEnAttente ?? null,
    };
  }

  // IM-03 : dry-run TRACÉ — valide la forme de la config déclarée + le trousseau, ne change RIEN.
  @Post("test")
  async test(@Req() r: any) {
    const s = await this.reglages(r.ctx.tenantId);
    const cfg = s.ssoOidc ?? { issuer: process.env.OIDC_ISSUER, audience: process.env.OIDC_AUDIENCE };
    const manques: string[] = [];
    if (!cfg?.issuer || !/^https:\/\//.test(String(cfg.issuer))) manques.push("issuer (https requis)");
    if (!cfg?.audience) manques.push("audience");
    if (!process.env.OIDC_CLIENT_SECRET) manques.push("client_secret (coffre/env)");
    const resultat = manques.length ? `INCOMPLET : ${manques.join(", ")}` : "OK — config déclarée cohérente, trousseau actif";
    await this.emit(r.ctx.tenantId, "sso.test", { par: r.ctx.userId, resultat, at: new Date().toISOString() });
    await this.audit.log(r.ctx.tenantId, r.ctx.userId, "SSO_TEST", resultat);
    return { resultat };
  }

  @Post("jwks/rotation")
  async rotation(@Req() r: any, @Body() b: any) {
    if (!b?.motif?.trim()) throw new BadRequestException("R7 : tourner la clé de la banque exige un motif");
    const kidAvant = this.keys.signingKey().kid;
    const kidApres = this.keys.rotate();                                   // les jetons émis restent vérifiables (grâce)
    await this.emit(r.ctx.tenantId, "sso.jwks.rotation", { par: r.ctx.userId, kidAvant, kidApres, motif: b.motif.trim() });
    await this.audit.log(r.ctx.tenantId, r.ctx.userId, "SSO_JWKS_ROTATION", `${kidAvant}->${kidApres}`);
    return { kidAvant, kidApres };
  }

  // IM-04 : la bascule est DEMANDÉE par un premier regard…
  @Post("mode")
  async demanderBascule(@Req() r: any, @Body() b: any) {
    if (!["jwt", "sso"].includes(b?.vers)) throw new BadRequestException("vers requis : jwt | sso");
    if (!b?.motif?.trim()) throw new BadRequestException("R7 : basculer le mode d'authentification exige un motif");
    const t = await this.prisma.tenant.findFirst({ where: { id: r.ctx.tenantId } });
    const demande = { vers: b.vers, effetAt: b.effetAt ?? new Date().toISOString(),
      motif: b.motif.trim(), par: r.ctx.userId, at: new Date().toISOString() };
    await this.prisma.tenant.update({ where: { id: t!.id },
      data: { settings: { ...((t!.settings as any) ?? {}), ssoBasculeEnAttente: demande } } });
    await this.emit(r.ctx.tenantId, "sso.mode.bascule_demandee", demande);
    return { enAttenteDeVisa: true, ...demande };
  }

  // …et VISÉE par un second (R13) — l'écriture passe PAR le registre : versionnée à date (R68/R126).
  @Post("mode/visa")
  async viserBascule(@Req() r: any) {
    const t = await this.prisma.tenant.findFirst({ where: { id: r.ctx.tenantId } });
    const d = ((t?.settings as any) ?? {}).ssoBasculeEnAttente;
    if (!d) throw new NotFoundException("Aucune bascule de mode en attente");
    if (d.par === r.ctx.userId)
      throw new ForbiddenException("R13 : la bascule de mode exige un SECOND regard — l'initiateur ne vise pas");
    await this.parametres.ecrire(r.ctx, "sso_mode", d.vers,
      `bascule visée (demandée par ${d.par}) : ${d.motif}`, d.effetAt);
    const { ssoBasculeEnAttente: _b, ...reste } = (t!.settings as any) ?? {};
    await this.prisma.tenant.update({ where: { id: t!.id }, data: { settings: reste } });
    await this.emit(r.ctx.tenantId, "sso.mode.bascule_visee",
      { vers: d.vers, effetAt: d.effetAt, demandePar: d.par, visePar: r.ctx.userId });
    await this.audit.log(r.ctx.tenantId, r.ctx.userId, "SSO_MODE_BASCULE", `${d.vers}@${d.effetAt}`);
    return { vers: d.vers, effetAt: d.effetAt };
  }
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
  imports: [ParametresModule],   // R290
  controllers: [AuthController, JwksController, MfaController, UsersController, IamGuideController, SsoController],
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
