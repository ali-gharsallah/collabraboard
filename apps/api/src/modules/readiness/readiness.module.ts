import { Body, Controller, ForbiddenException, Get, Module, Post, Req, Res, Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { KeyStore } from "../auth/key-store";
import { storeDepuisEnv } from "../auth/login-rate";

/**
 * READINESS & pipeline — vague de clôture (canon ratifié 2026-07-29), R330, RZ-01..04.
 * R330 : `/readyz` AGRÉGÉ (liste DÉCLARÉE) dit si l'instance est PRÊTE à servir — DB migrée,
 * Redis joignable (si REDIS_URL), relais outbox vivant (lag < seuil), JWKS chargé, secrets
 * requis PRÉSENTS (présence, JAMAIS la valeur — RZ-03), moteur Python invocable ; `/healthz`
 * reste la vivacité simple. Les deux sont PUBLICS (les sondes n'ont pas de jeton). Le journal
 * des DÉPLOIEMENTS est un événement append-only, visible dans auditit (AU-08 étendu, RZ-04) ;
 * un smoke ROUGE se trace aussi (le pipeline s'arrête AVANT bascule — RZ-02).
 */

type Ctx = { tenantId: string; userId: string; role: string };
const SEUIL_LAG = Number(process.env.OUTBOX_LAG_SEUIL ?? 1000);   // événements de retard tolérés

@Injectable()
export class ReadinessService {
  constructor(private prisma: PrismaService, private keys: KeyStore) {}

  private async composants(): Promise<{ nom: string; ok: boolean; detail: string }[]> {
    const c: { nom: string; ok: boolean; detail: string }[] = [];
    // 1. DB MIGRÉE — la table de migrations Prisma répond et porte au moins une migration appliquée.
    try {
      const rows = await this.prisma.$queryRawUnsafe<{ n: bigint }[]>(
        `SELECT count(*) n FROM _prisma_migrations WHERE finished_at IS NOT NULL`);
      const n = Number(rows[0]?.n ?? 0);
      c.push({ nom: "db_migree", ok: n > 0, detail: `${n} migration(s) appliquée(s)` });
    } catch (e: any) {
      // db push (sans _prisma_migrations) : la connexion suffit à prouver la base atteignable.
      try { await this.prisma.$queryRawUnsafe(`SELECT 1`); c.push({ nom: "db_migree", ok: true, detail: "base atteignable (mode db push)" }); }
      catch { c.push({ nom: "db_migree", ok: false, detail: `base injoignable : ${e?.message ?? e}` }); }
    }
    // 2. REDIS — seulement si REDIS_URL est déclaré (pas de files au dépôt = non requis).
    if (process.env.REDIS_URL) {
      try { await storeDepuisEnv().compterEtAjouter("readyz:ping", 1000, Date.now()); c.push({ nom: "redis", ok: true, detail: "joignable" }); }
      catch (e: any) { c.push({ nom: "redis", ok: false, detail: `injoignable : ${e?.message ?? e}` }); }
    }
    // 3. OUTBOX vivant — lag = (dernier événement) − (plus petit last_seq des consommateurs) < seuil.
    try {
      const [maxEv] = await this.prisma.$queryRawUnsafe<{ m: bigint }[]>(`SELECT COALESCE(MAX(id),0) m FROM domain_events`);
      const [minSeq] = await this.prisma.$queryRawUnsafe<{ m: bigint }[]>(`SELECT COALESCE(MIN(last_seq),0) m FROM event_consumers`);
      const lag = Number(maxEv?.m ?? 0) - Number(minSeq?.m ?? 0);
      c.push({ nom: "outbox", ok: lag < SEUIL_LAG, detail: `lag ${lag} (< ${SEUIL_LAG})` });
    } catch (e: any) { c.push({ nom: "outbox", ok: false, detail: `${e?.message ?? e}` }); }
    // 4. JWKS chargé — au moins une clé publique servie.
    const nbClefs = this.keys.jwks().keys.length;
    c.push({ nom: "jwks", ok: nbClefs > 0, detail: `${nbClefs} clé(s) publique(s)` });
    // 5. SECRETS requis — PRÉSENCE seulement, jamais la valeur (RZ-03).
    const requis = ["AUDIT_HMAC_SECRET", "MFA_ENC_KEY"];
    const manquants = requis.filter((k) => !process.env[k]);
    c.push({ nom: "secrets", ok: manquants.length === 0,
      detail: manquants.length ? `manquant(s) : ${manquants.join(", ")}` : `présent(s) : ${requis.join(", ")}` });
    // 6. MOTEUR CPSI invocable — la version du contrat suffit (jamais un rejeu lourd sur /readyz).
    try {
      const { CONTRACT_VERSION } = await import("../cpsi/cpsi.module");
      c.push({ nom: "moteur_cpsi", ok: !!CONTRACT_VERSION, detail: `contrat ${CONTRACT_VERSION}` });
    } catch (e: any) { c.push({ nom: "moteur_cpsi", ok: false, detail: `${e?.message ?? e}` }); }
    return c;
  }

  async readyz() {
    const composants = await this.composants();
    return { pret: composants.every((c) => c.ok), composants, verifieAt: new Date().toISOString() };
  }

  // RZ-02/04 : enregistrer l'issue d'un déploiement — événement append-only tracé.
  async enregistrerDeploiement(ctx: Ctx, dto: { version?: string; smokeOk?: boolean; readyz?: string; note?: string }) {
    if (!["DIR", "ADMIN"].includes(ctx.role)) throw new ForbiddenException("Enregistrer un déploiement est un acte DIR/ADMIN");
    await this.prisma.domainEvent.create({ data: { tenantId: ctx.tenantId, type: "deploiement.enregistre",
      aggregateId: String(dto.version ?? "inconnue").slice(0, 190), at: new Date().toISOString(),
      payload: { version: dto.version ?? null, smokeOk: dto.smokeOk === true, readyz: dto.readyz ?? null,
        note: dto.note ?? null, par: ctx.userId } } });
    return { version: dto.version, enregistre: true };
  }

  async deploiements(ctx: Ctx) {
    const evs = await this.prisma.domainEvent.findMany({
      where: { tenantId: ctx.tenantId, type: "deploiement.enregistre" }, orderBy: { id: "desc" }, take: 100 });
    return { deploiements: evs.map((e) => ({ ...(e.payload as any), at: e.at })) };
  }
}

@Controller()
export class ReadinessController {
  constructor(private svc: ReadinessService) {}
  @Get("healthz") healthz() { return { vivant: true, at: new Date().toISOString() }; }   // vivacité simple, publique
  @Get("readyz")  async readyz(@Res() res: any) {
    const r = await this.svc.readyz();
    res.status(r.pret ? 200 : 503).json(r);                                // 503 si un composant requis manque (RZ-01)
  }
}

@Controller("deploiements")
export class DeploiementsController {
  constructor(private svc: ReadinessService) {}
  @Post() enregistrer(@Req() r: any, @Body() b: any) { return this.svc.enregistrerDeploiement(r.ctx, b ?? {}); }   // RZ-02
  @Get()  lister(@Req() r: any) { return this.svc.deploiements(r.ctx); }                                            // RZ-04 (auditit)
}

@Module({ controllers: [ReadinessController, DeploiementsController], providers: [ReadinessService] })
export class ReadinessModule {}
