import { Injectable, NestMiddleware, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { verify, decode } from "jsonwebtoken";
import { KeyStore } from "../modules/auth/key-store";
import { PrismaService } from "./prisma.service";

// ═══ R284 (canon SO + transport async, ratifié 2026-07-28) — la garde STRUCTURELLE du rôle SO.
// SO audite les JOURNAUX, jamais les dossiers : hors de sa surface d'audit (lecture seule) et
// des DEUX exceptions fermées (STOP d'un run R267, export d'audit), TOUT refuse typé — avant
// même le routage. Pas une convention par contrôleur : UNE porte, ici (SO-01..03).
const SO_GET = [
  /^\/v1\/audit(\/|$)/,                      // journal des accès, export, intégrité (SO-07/08)
  /^\/v1\/apidoc(\/|$)/,                     // doc générée (métadonnées techniques)
  /^\/v1\/olivia\/conversations/,            // conversations + replay + empreintes (mode audit OL)
  /^\/v1\/olivia\/runs/,                     // runs agentiques + replay (R266)
  /^\/v1\/olivia\/health/,                   // santé du port IA
  /^\/v1\/cpsi\//,                           // journal CPSI + santé de la porte (lecture)
  /^\/v1\/events\//,                         // T9 : santé du transport + flux (références)
  /^\/v1\/offboarding\//,                    // motifs sensibles R270 — auditer l'art. 10a
  /^\/v1\/tasks(\/|$)/,                      // T3 : ses tâches (accueil SO = T3 + T9, HO-06)
];
const SO_TRAIL = [/\/a-date/, /\/replay/, /\/access-matrix/];   // le trail : rejeu à date, tous modules (R48/R49)
const SO_POST = [/^\/v1\/olivia\/runs\/[^/]+\/stop$/, /^\/v1\/audit\/export$/]; // les DEUX exceptions fermées
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
      void this.prisma?.domainEvent.create({ data: { tenantId: req.ctx.tenantId, type: "AUDIT_ACCESS",
        aggregateId: chemin.slice(0, 190), payload: { par: req.ctx.userId, role: "SO", chemin, methode },
        at: new Date().toISOString() } })
        .catch((e: any) => console.error("[audit-access]", e?.message ?? e));   // R286 : jamais silencieux
  }

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
    } catch { throw new UnauthorizedException("Jeton invalide ou expiré"); }
    if (req.ctx.role === "SO") this.garderSO(req);      // R284 — APRÈS l'authentification, AVANT le routage
    next();
  }
}
