import { BadRequestException, Body, Controller, Get, Module, Post, Req, Injectable } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { PrismaService } from "../../common/prisma.service";
import { loadSettings } from "../../common/tenant-settings";
import { emitEvent } from "../../common/domain-event";

/**
 * BI LIBRE — dégel V6 (canon ratifié 2026-07-28), R314-R315, BL-01..04.
 * R314 : le constructeur de requêtes n'interroge QUE des vues de PROJECTION déclarées
 * (vues-bi.json — la même vérité que le vérificateur CI scripts/verifier-vues-bi.js,
 * pattern R264 : une vue hors liste = build rouge). ZÉRO SQL libre : la lecture passe par
 * le client Prisma typé + agrégation en mémoire — aucune écriture, aucun raw (BL-04 le
 * vérifie par revue automatisée).
 * R315 : le SCOPE s'applique AUX PROJECTIONS — un RM n'agrège que ses clients (backend,
 * jamais le front) ; l'export au-delà de `bi_seuil_export` est un ACTE D'AUDIT :
 * AUDIT_ACCESS (qui, quelle requête, combien) notifié SO — mesuré, jamais bloqué (R39).
 */

type Ctx = { tenantId: string; userId: string; role: string };
type Vue = { source: string; dimensions: string[]; mesures: string[]; sensibilite: string };
const VUES: Record<string, Vue> = JSON.parse(
  fs.readFileSync(path.join(__dirname, "vues-bi.json"), "utf8"));

@Injectable()
export class BiService {
  constructor(private prisma: PrismaService) {}

  vues() { return Object.entries(VUES).map(([code, v]) => ({ code, ...v })); }

  // ── R314/R315 : LA requête — vue déclarée, colonnes déclarées, scope backend. ──
  async requete(ctx: Ctx, dto: { vue?: string; dimensions?: string[]; mesures?: string[];
    filtres?: Record<string, string>; export?: boolean }) {
    const vue = VUES[dto?.vue ?? ""];
    if (!vue) throw new BadRequestException(
      `R314 : « ${dto?.vue} » n'est pas une vue de projection déclarée — la liste blanche fait foi (zéro SQL libre)`);
    const dims = dto.dimensions ?? [];
    for (const d of dims) if (!vue.dimensions.includes(d))
      throw new BadRequestException(`R314 : dimension « ${d} » non déclarée par la vue ${dto.vue}`);
    for (const m of dto.mesures ?? []) if (!vue.mesures.includes(m))
      throw new BadRequestException(`R314 : mesure « ${m} » non déclarée par la vue ${dto.vue}`);
    for (const f of Object.keys(dto.filtres ?? {})) if (!vue.dimensions.includes(f))
      throw new BadRequestException(`R314 : filtre « ${f} » hors dimensions déclarées`);

    const lignesBrutes = await this.lireScope(ctx, vue.source);              // le scope, AU BACKEND
    const filtrees = lignesBrutes.filter((l) =>
      Object.entries(dto.filtres ?? {}).every(([k, v]) => String(l[k]) === String(v)));
    const groupes = new Map<string, any>();
    for (const l of filtrees) {
      const cle = dims.map((d) => String(l[d] ?? "—")).join("|");
      const g = groupes.get(cle) ?? Object.fromEntries([...dims.map((d) => [d, l[d] ?? "—"]),
        ...(vue.mesures.includes("n") ? [["n", 0]] : []), ...(vue.mesures.includes("volume") ? [["volume", 0]] : [])]);
      if (vue.mesures.includes("n")) g.n++;
      if (vue.mesures.includes("volume")) g.volume += Number(l.montant ?? 0);
      groupes.set(cle, g);
    }
    const lignes = [...groupes.values()];

    // R315 : l'extraction MASSIVE s'audite — servie quand même (R39).
    const s = await loadSettings(this.prisma, ctx.tenantId);
    const seuil = s.bi_seuil_export ?? 10000;
    if (dto.export && filtrees.length >= seuil) {
      await emitEvent(this.prisma, ctx.tenantId, "AUDIT_ACCESS", `bi:${dto.vue}`,
        { par: ctx.userId, role: ctx.role, vue: dto.vue, dimensions: dims,
          lignes: filtrees.length, seuil, notifie: ["SO"] });
    }
    return { vue: dto.vue, sensibilite: vue.sensibilite, lignes, source: filtrees.length };
  }

  // Le scope par source — RBAC appliqué à LA PROJECTION, jamais au front.
  private async lireScope(ctx: Ctx, source: string): Promise<any[]> {
    const scopeRm = ctx.role === "RM" || ctx.role === "ARM";
    if (source === "clients")
      return this.prisma.client.findMany({ where: { tenantId: ctx.tenantId,
        ...(scopeRm ? { rmUserId: ctx.userId } : {}) } });
    if (source === "kyc_files")
      return this.prisma.kycFile.findMany({ where: { tenantId: ctx.tenantId,
        ...(scopeRm ? { client: { rmUserId: ctx.userId } } : {}) } });
    if (source === "transactions") {
      const miens = scopeRm ? (await this.prisma.client.findMany({
        where: { tenantId: ctx.tenantId, rmUserId: ctx.userId }, select: { id: true } })).map((c) => c.id) : null;
      return this.prisma.transaction.findMany({ where: { tenantId: ctx.tenantId,
        ...(miens ? { clientId: { in: miens } } : {}) } });
    }
    if (source === "risk_cases")
      return this.prisma.riskCase.findMany({ where: { tenantId: ctx.tenantId } });
    if (source === "onboardings")
      return this.prisma.onboarding.findMany({ where: { tenantId: ctx.tenantId } });
    throw new BadRequestException(`R314 : source « ${source} » sans projection câblée`);
  }
}

@Controller("bi")
export class BiController {
  constructor(private svc: BiService) {}
  @Post("requete") requete(@Req() r: any, @Body() b: any) { return this.svc.requete(r.ctx, b ?? {}); }   // BL-01..03
  // V2-M40 — l'annuaire est une LECTURE : il rend la liste des vues déclarées et n'écrit rien.
  // Il n'était exposé qu'en POST, si bien que l'écran Rapports (« Sur mesure ») le demandait en
  // GET, recevait une erreur, et retombait sur son seed SANS QUE PERSONNE NE LE VOIE — le
  // bandeau « données maquette » disait vrai mais taisait la cause. Le GET est ajouté ; le POST
  // reste en place, aucun appelant existant n'est cassé.
  @Get("annuaire") annuaireLecture() { return this.svc.vues(); }                                          // BL-04 (lecture)
  @Post("annuaire") annuaire() { return this.svc.vues(); }                                                 // conservé — compatibilité
}

@Module({ controllers: [BiController], providers: [BiService] })
export class BiModule {}
