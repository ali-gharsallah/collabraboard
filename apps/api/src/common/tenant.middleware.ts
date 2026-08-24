import { Injectable, NestMiddleware, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { verify, decode } from "jsonwebtoken";
import { KeyStore } from "../modules/auth/key-store";
import { PrismaService } from "./prisma.service";
import { emitEvent } from "./domain-event";
import { garderMobile, SURFACE_MOBILE } from "../modules/mobile/mobile.gate";

// ═══ R284 (canon SO + transport async, ratifié 2026-07-28) — la garde STRUCTURELLE du rôle SO.
// SO audite les JOURNAUX, jamais les dossiers : hors de sa surface d'audit (lecture seule) et
// des DEUX exceptions fermées (STOP d'un run R267, export d'audit), TOUT refuse typé — avant
// même le routage. Pas une convention par contrôleur : UNE porte, ici (SO-01..03).
const SO_GET = [
  /^\/v1\/audit(\/|$)/,                      // journal des accès, export, intégrité (SO-07/08)
  /^\/v1\/apidoc(\/|$)/,                     // doc générée (métadonnées techniques)
  /^\/v1\/builder\/publications$/,           // WB-10 : les actes de publication du Builder + rapports (journal)
  /^\/v1\/olivia\/conversations/,            // conversations + replay + empreintes (mode audit OL)
  /^\/v1\/olivia\/runs/,                     // runs agentiques + replay (R266)
  /^\/v1\/olivia\/health/,                   // santé du port IA
  /^\/v1\/cpsi\//,                           // journal CPSI + santé de la porte (lecture)
  /^\/v1\/events\//,                         // T9 : santé du transport + flux (références)
  /^\/v1\/offboarding\//,                    // motifs sensibles R270 — auditer l'art. 10a
  /^\/v1\/tasks(\/|$)/,                      // T3 : ses tâches (accueil SO = T3 + T9, HO-06)
  /^\/v1\/deploiements$/,                    // RZ-04 : le journal des déploiements (auditit, AU-08 étendu)
];
const SO_TRAIL = [/\/a-date/, /\/replay/, /\/access-matrix/];   // le trail : rejeu à date, tous modules (R48/R49)
const SO_POST = [/^\/v1\/olivia\/runs\/[^/]+\/stop$/, /^\/v1\/audit\/export$/,
  /^\/v1\/oprisk\/incidents$/];   // R321/OP-04 (dégel V9, canon) : un constat SO-07 OUVRE un incident OpRisk référencé — TROISIÈME exception, fermée à cette route
const SO_SENSIBLE = [/^\/v1\/offboarding\//, /^\/v1\/olivia\/conversations/, /\/replay/]; // l'auditeur est audité (SO-04)

/**
 * Extrait tenant/user/rôle du JWT (RS256) et les pose sur req.ctx.
 * La clé publique est résolue par le `kid` de l'en-tête via le trousseau (KeyStore) : la
 * rotation des clés n'invalide pas les jetons encore valides (période de grâce, cf. JWKS).
 * La connexion Prisma exécute ensuite SET app.tenant_id → la RLS s'applique.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  // prisma OPTIONNEL : absent au harnais unitaire (construction à 1 arg) — l'app l'injecte (CoreModule @Global).
  constructor(private readonly keys: KeyStore, private readonly prisma?: PrismaService) {}

  // R284 : refus typé hors surface d'audit ; consultation SENSIBLE ⇒ AUDIT_ACCESS append-only
  // (qui, quoi, quand — jamais bloquant : personne ne lit dans l'ombre, pas même l'auditeur).
  private garderSO(req: any) {
    const methode = String(req.method ?? "GET").toUpperCase();
    // Middleware MONTÉ par route (forRoutes("*")) : req.path vaut « / » ici — le chemin réel
    // complet (préfixe compris, sans query) est dans originalUrl.
    const chemin = String(req.originalUrl ?? "").split("?")[0];
    const autorise = methode === "GET"
      ? SO_GET.some((p) => p.test(chemin)) || SO_TRAIL.some((p) => p.test(chemin))
      : methode === "POST" && SO_POST.some((p) => p.test(chemin));
    if (!autorise) throw new ForbiddenException(
      "SO_SURFACE_AUDIT : le rôle SO audite les JOURNAUX (lecture seule + STOP de run / export) — aucun accès opérationnel, aucune décision, jamais un regard du four-eyes (R284)");
    if (methode === "GET" && SO_SENSIBLE.some((p) => p.test(chemin)))
      try {   // fire-and-forget : un refus catalogue (levé en SYNCHRONE par emitEvent) ne bloque pas la requête
        if (this.prisma)
          void emitEvent(this.prisma, req.ctx.tenantId, "AUDIT_ACCESS", chemin.slice(0, 190),
            { par: req.ctx.userId, role: "SO", chemin, methode })
            .catch((e: any) => console.error("[audit-access]", e?.message ?? e));   // R286 : jamais silencieux
      } catch (e: any) { console.error("[audit-access]", e?.message ?? e); }
  }

  use(req: any, _res: any, next: () => void) {
    // Middleware MONTÉ par route : req.path vaut « / » — le chemin réel est dans originalUrl
    // (même constat que garderSO). L'ancien test sur req.path ne matchait jamais.
    const cheminPublic = String(req.originalUrl ?? req.path ?? "").split("?")[0];   // harnais : req.path direct
    if (["/v1/auth/token", "/v1/auth/oidc/login",
         "/v1/auth/methode", "/v1/auth/login",                        // R296 : login deux temps
         "/v1/.well-known/jwks.json",
         "/v1/healthz", "/v1/readyz"].includes(cheminPublic)) return next();   // routes publiques (R330 : sondes sans jeton)
    // R316 (dégel V7) : la surface mobile est une AUTRE porte — population IAM distincte,
    // jamais le RBAC interne. L'étanchéité vaut dans les deux sens (cf. rejet `pop` plus bas).
    if (SURFACE_MOBILE.test(cheminPublic)) return garderMobile(req, cheminPublic, this.keys, next);
    const raw = (req.headers.authorization ?? "").replace(/^Bearer /, "");
    let claims: any;
    try {
      const kid = (decode(raw, { complete: true }) as any)?.header?.kid;
      if (!kid) throw new Error("kid absent");
      const pub = this.keys.verificationKey(kid);          // lève si kid inconnu/expiré
      claims = verify(raw, pub, { algorithms: ["RS256"] });
    } catch { throw new UnauthorizedException("Jeton invalide ou expiré"); }
    if (claims.pop === "MOBILE") throw new UnauthorizedException(
      "R316 : population MOBILE — jamais la surface interne (deux portes, zéro partage)");
    req.ctx = { tenantId: claims.tid, userId: claims.sub, role: claims.role };
    if (req.ctx.role === "SO") this.garderSO(req);      // R284 — APRÈS l'authentification, AVANT le routage
    next();
  }
}
