import { BadRequestException, ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { emitEvent } from "../../common/domain-event";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { ParametresService } from "../parametres/parametres.service";
import { AuthService } from "./auth.service";
import { PasswordHasher } from "./password";
import { LoginRateLimiter, LIMITES } from "./login-rate";

/**
 * R296 — LOGIN DEUX TEMPS (canon triage final, ratifié 2026-07-28, LG-01..05).
 * Temps 1 (`methode`) : l'email RÉSOUT le tenant par domaine (clé R-Q `loginDomaines`) et la
 * méthode suit `sso_mode` EN VIGUEUR (R127 — la bascule four-eyes à date de R290 s'applique
 * au login sans autre câblage). Un domaine INCONNU répond la MÊME forme que LOCAL
 * (indistinguable, pattern OL-34) — jamais une existence révélée.
 * Temps 2 (`login`) : le tenant n'est JAMAIS envoyé par le client — il est résolu. L'échec est
 * GÉNÉRIQUE et identique (domaine inconnu / user inconnu / mauvais mdp) ; le leurre scrypt
 * tourne sur tous les chemins (timing du même ordre — smoke, consigné).
 * AUCUN repli silencieux : tenant SSO → mot de passe refusé TYPÉ (SSO_REQUIS), même correct ;
 * `sso_fallback_local` défaut FAUX, son activation est un choix motivé au registre, TRACÉ.
 * BREAK-GLASS (`breakGlassComptes`) : login local possible en mode SSO, MFA OBLIGATOIRE,
 * chaque usage audité (BREAK_GLASS_LOGIN) + notifié SO/DIR (événement).
 */

const DUMMY = PasswordHasher.hash("__domaine_ou_compte_inconnu__");     // anti-énumération : scrypt tourne toujours

@Injectable()
export class LoginService {
  constructor(private prisma: PrismaService, private auth: AuthService,
    private parametres: ParametresService, private audit: AuditService,
    private limiteur: LoginRateLimiter) {}

  private domaineDe(email?: string): string {
    const m = /^[^@\s]+@([^@\s]+\.[^@\s]+)$/.exec(String(email ?? "").trim().toLowerCase());
    if (!m) throw new BadRequestException("email requis (forme utilisateur@domaine)");
    return m[1];
  }

  private ctxDe(tenantId: string) { return { tenantId, userId: "login", role: "SYSTEM" }; }

  // La résolution : le SEUL tenant dont `loginDomaines` (registre) porte le domaine.
  private async resoudreTenant(domaine: string): Promise<string | null> {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true, settings: true } });
    for (const t of tenants) {
      const doms = ((t.settings as any)?.loginDomaines ?? []) as string[];
      if (Array.isArray(doms) && doms.some((d) => String(d).toLowerCase() === domaine)) return t.id;
    }
    return null;
  }

  private async modeEnVigueur(tenantId: string): Promise<string> {
    return (await this.parametres.valeurEffective(this.ctxDe(tenantId), "sso_mode", new Date())) ?? "jwt";
  }

  // ── TEMPS 1 — LG-01/03 : {email} → {methode} ; l'inconnu est INDISTINGUABLE d'un tenant LOCAL. ──
  async methode(email?: string) {
    const domaine = this.domaineDe(email);
    // R296 (§7) : la résolution se protège AUSSI — l'énumération de domaines se paie (429 typé)
    await this.limiteur.garder(`methode|${String(email).trim().toLowerCase()}`, LIMITES.methode);
    const tenantId = await this.resoudreTenant(domaine);
    if (!tenantId) return { methode: "LOCAL" };                            // même forme — rien de révélé (OL-34)
    if ((await this.modeEnVigueur(tenantId)) !== "sso") return { methode: "LOCAL" };
    const oidc = (await this.parametres.valeurEffective(this.ctxDe(tenantId), "ssoOidc", new Date())) as any;
    if (!oidc?.issuer)                                                     // IdP non joignable/déclaré : erreur TYPÉE, jamais un repli
      throw new ServiceUnavailableException("SSO_IDP_INDISPONIBLE : fournisseur d'identité non joignable — aucun repli local silencieux (sso_fallback_local)");
    const issuer = String(oidc.issuer).replace(/\/$/, "");
    return { methode: "SSO",
      redirect: `${issuer}/protocol/openid-connect/auth?client_id=${encodeURIComponent(oidc.audience ?? "olive")}&response_type=code` };
  }

  // ── TEMPS 2 — LG-02/04/05 : le login RÉSOLVANT. ──
  async login(dto: { email?: string; password?: string; totp?: string }) {
    const domaine = this.domaineDe(dto?.email);
    const email = String(dto!.email).trim().toLowerCase();
    // R296 (§7) : fenêtre glissante PAR identifiant, AVANT toute résolution — le 429 est
    // identique que l'email existe ou non (jamais un oracle), aucune punition collective.
    await this.limiteur.garder(`login|${email}`, LIMITES.login);
    const tenantId = await this.resoudreTenant(domaine);
    if (!tenantId || !dto?.password) {
      PasswordHasher.verify(dto?.password ?? "", DUMMY);                   // leurre : même coût que la voie réelle
      throw new UnauthorizedException("Identifiants invalides");           // LE message — identique partout
    }
    const ctx = this.ctxDe(tenantId);
    if ((await this.modeEnVigueur(tenantId)) === "sso") {
      const secours = ((await this.parametres.valeurEffective(ctx, "breakGlassComptes", new Date())) ?? []) as string[];
      const fallback = (await this.parametres.valeurEffective(ctx, "sso_fallback_local", new Date())) === true;
      if (secours.map((s) => String(s).toLowerCase()).includes(email)) {
        // BREAK-GLASS : jamais une dégradation — la MFA est OBLIGATOIRE (compte non enrôlé = refus).
        const u = await this.prisma.user.findFirst({ where: { tenantId, email } });
        if (!u?.mfaEnabled || !u.mfaSecret) {
          PasswordHasher.verify(dto.password, DUMMY);
          throw new UnauthorizedException("Identifiants invalides");
        }
        const session = await this.auth.issueToken({ tenantId, email, password: dto.password, totp: dto.totp });
        await this.audit.log(tenantId, u.id, "BREAK_GLASS_LOGIN", email);  // l'usage du secours est AUDITÉ…
        await emitEvent(this.prisma, tenantId, "auth.breakglass.utilise",
          u.id, { email, par: u.id, notifie: ["SO", "DIR"] });  // …et NOTIFIÉ SO/DIR
        return session;
      }
      if (!fallback)                                                        // LG-04 : refus TYPÉ, jamais un repli silencieux
        throw new ForbiddenException("SSO_REQUIS : la méthode d'authentification de cette banque est SSO — le mot de passe local est désactivé (sso_fallback_local=faux)");
      const session = await this.auth.issueToken({ tenantId, email, password: dto.password, totp: dto.totp });
      await this.audit.log(tenantId, email, "SSO_FALLBACK_LOCAL_UTILISE", domaine);  // le repli CHOISI se trace
      return session;
    }
    return this.auth.issueToken({ tenantId, email, password: dto.password, totp: dto.totp });
  }
}
