import { Body, Controller, Get, Post, Req, Module, Injectable, ForbiddenException, BadRequestException, CanActivate, ExecutionContext, mixin, Type } from "@nestjs/common";
import { emitEvent } from "../../common/domain-event";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { LicenseService, OliveLicense } from "./license.service";
import { Tx } from "../../common/tx";

/**
 * LA LICENCE EST SERVIE ET APPLIQUÉE (canon débloquants Home partie 3 — APPLICATION de
 * R177→R179, requalification ratifiée : AUCUNE règle nouvelle, le numéro R279 n'est pas
 * consommé). Source ratifiée (Ali, 2026-07-27) : **LicenseService** — licence par TENANT,
 * fichier signé vérifiable hors ligne (clé publique en env `OLIVE_LICENSE_PUBKEY`) ;
 * `VendorLicenseService` reste consigné en écart de doublon (non branché).
 *   • `GET /v1/modules/actifs` : LA source du front (menus, tuiles HO-02, routes).
 *   • Charger une licence = acte ADMIN, VÉRIFIÉ (signature + expiration + tenant), PERSISTÉ
 *     (tenant.settings.licence) et JOURNALISÉ (événement versionné à date, R68/R177).
 *   • Garde `ModuleLicencie(code)` : module hors licence → 403 MODULE_INACTIF — l'enforcement
 *     est SERVEUR (masquer au front ne suffit jamais). LS-03 : la désactivation n'ampute pas
 *     l'audit — la LECTURE (GET) reste ouverte au rôle d'audit (ADMIN — écart SO connu).
 *   • ⚠ Écart signalé (ECARTS) : AUCUNE licence chargée ⇒ tous modules actifs (mode socle,
 *     non-cassant pour l'existant). Le défaut-refus strict R177 s'applique dès qu'une licence
 *     existe pour le tenant. À re-durcir si le canon l'exige.
 */

type Ctx = { tenantId: string; userId: string; role: string };

@Injectable()
export class ModulesActifsService {
  constructor(private prisma: PrismaService, private audit: AuditService, private lic: LicenseService) {}

  // R320 (dégel V8) : signature RE-vérifiée à chaque lecture (R178) ; l'EXPIRATION est un
  // ÉTAT typé, pas une exception — les modules s'éteignent, l'audit reste lisible (LC-03).
  private async licenceCourante(tenantId: string): Promise<{ lic: OliveLicense; expiree: boolean } | null> {
    const t = await this.prisma.tenant.findFirst({ where: { id: tenantId } });
    const raw = ((t?.settings as any) ?? {}).licence as OliveLicense | undefined;
    if (!raw) return null;
    if (!process.env.OLIVE_LICENSE_PUBKEY)
      throw new ForbiddenException("R177 : clé publique de licence absente — licence invérifiable, refus");
    return { lic: raw, expiree: this.lic.verifier(raw).expiree };
  }

  // ── Acte vendor/ADMIN : charger la licence signée — vérifiée, persistée, JOURNALISÉE à date ──
  async charger(ctx: Ctx, raw: OliveLicense) {
    if (ctx.role !== "ADMIN") throw new ForbiddenException("Charger une licence est un acte d'administration");
    if (!process.env.OLIVE_LICENSE_PUBKEY)
      throw new BadRequestException("R177 : clé publique de licence absente — pas de licence fantôme");
    if (!raw?.tenantId || raw.tenantId !== ctx.tenantId)
      throw new BadRequestException("R177 : la licence ne vise pas ce tenant");
    this.lic.load(raw);                                   // signature Ed25519/RSA + expiration — refus typé sinon
    const t = await this.prisma.tenant.findFirst({ where: { id: ctx.tenantId } });
    await this.prisma.$transaction(async (tx: Tx) => {
      await tx.tenant.update({ where: { id: ctx.tenantId },
        data: { settings: { ...((t?.settings as any) ?? {}), licence: raw } } });
      await emitEvent(tx, ctx.tenantId, "module.licence.chargee", ctx.tenantId,
        { modules: raw.modules, issuedAt: raw.issuedAt, expiresAt: raw.expiresAt, par: ctx.userId });
    });
    await this.audit.log(ctx.tenantId, ctx.userId, "LICENCE_CHARGEE", raw.modules.join(","));
    return { modules: raw.modules, actifDepuis: raw.issuedAt };
  }

  // ── HO-02 : LA source des menus/tuiles — code, actif_depuis, ou mode socle (aucune licence) ──
  async actifs(ctx: Ctx) {
    const c = await this.licenceCourante(ctx.tenantId);
    if (!c) return { enforcement: false, modules: null,
      note: "aucune licence chargée — socle complet (écart consigné : défaut-refus R177 dès qu'une licence existe)" };
    if (c.expiree) return { enforcement: true, expiree: true, expiresAt: c.lic.expiresAt, modules: [],
      note: "R320 : licence EXPIRÉE — modules inactifs, lecture d'audit préservée (LC-03), aucune donnée coupée" };
    return { enforcement: true, expiresAt: c.lic.expiresAt,
      modules: c.lic.modules.map((code) => ({ code, actifDepuis: c.lic.issuedAt })) };
  }

  // ── L'enforcement SERVEUR (garde) — jamais supposé, jamais seulement front ──
  async actif(tenantId: string, module: string): Promise<boolean> {
    const c = await this.licenceCourante(tenantId);
    return !c || (!c.expiree && c.lic.modules.includes(module));
  }

  // ── R320/VE-03 : le TICK d'échéance — J-60, J-30, expiration : notifié UNE fois par état
  //    (pattern R274), mesuré, jamais bloquant. La console vendor n'entre jamais ici : la
  //    licence DESCEND signée, l'instance constate seule ses échéances. ──
  async tick(ctx: Ctx) {
    const c = await this.licenceCourante(ctx.tenantId);
    if (!c) return { notifies: [] };
    const resteJours = (new Date(c.lic.expiresAt).getTime() - Date.now()) / 86400000;
    const etats: { type: string; quand: boolean }[] = [
      { type: "licence.expiration.j60", quand: resteJours <= 60 && resteJours > 0 },
      { type: "licence.expiration.j30", quand: resteJours <= 30 && resteJours > 0 },
      { type: "licence.expiree", quand: c.expiree },
    ];
    const notifies: string[] = [];
    for (const e of etats) {
      if (!e.quand) continue;
      // Une notification PAR ÉTAT et PAR ÉCHÉANCE (la même expiresAt ne notifie pas deux fois)
      const deja = await this.prisma.domainEvent.findFirst({ where: { tenantId: ctx.tenantId,
        type: e.type, aggregateId: c.lic.expiresAt } });
      if (deja) continue;
      await emitEvent(this.prisma, ctx.tenantId, e.type, c.lic.expiresAt,
        { expiresAt: c.lic.expiresAt, modules: c.lic.modules, notifie: ["ADMIN", "DIR"], par: ctx.userId });
      notifies.push(e.type);
    }
    return { notifies, expiree: c.expiree };
  }
}

// Garde par module (le commentaire historique de license.service.ts l'annonçait) :
// @UseGuards(ModuleLicencie("cpsi")) sur un contrôleur. LS-03 : GET + rôle d'audit passent
// toujours — couper l'accès n'efface jamais la preuve (pattern R271).
export function ModuleLicencie(module: string): Type<CanActivate> {
  @Injectable()
  class Garde implements CanActivate {
    constructor(public svc: ModulesActifsService) {}
    async canActivate(cx: ExecutionContext): Promise<boolean> {
      const req = cx.switchToHttp().getRequest();
      const ctx: Ctx | undefined = req.ctx;
      if (!ctx) return true;                              // routes hors auth (jamais le cas des modules)
      if (await this.svc.actif(ctx.tenantId, module)) return true;
      if (req.method === "GET" && ctx.role === "ADMIN") return true;   // LS-03 : audit en lecture seule
      throw new ForbiddenException(`MODULE_INACTIF: le module ${module} n'est pas actif pour ce tenant (R177)`);
    }
  }
  return mixin(Garde);
}

@Controller("modules")
export class ModulesController {
  constructor(private svc: ModulesActifsService) {}
  @Get("actifs")    actifs(@Req() r: any) { return this.svc.actifs(r.ctx); }                      // HO-02 / LS-01
  @Post("licence")  charger(@Req() r: any, @Body() b: any) { return this.svc.charger(r.ctx, b); } // LS-02 (ADMIN)
  @Post("licence/tick") tick(@Req() r: any) { return this.svc.tick(r.ctx); }                      // R320 / VE-03
}

@Module({
  controllers: [ModulesController],
  providers: [
    { provide: LicenseService, useFactory: () => new LicenseService(process.env.OLIVE_LICENSE_PUBKEY ?? "") },
    ModulesActifsService,
  ],
  exports: [ModulesActifsService],
})
export class LicenseModule {}
