import { BadRequestException, Body, Controller, Get, Module, NotFoundException, Param, Post,
  Query, Req, Injectable } from "@nestjs/common";
import { emitEvent } from "../../common/domain-event";
import { randomUUID } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { ParametresService } from "../parametres/parametres.service";
import { ParametresModule } from "../parametres/parametres.module";

/**
 * OCTOPULSE OPRISK — dégel V9 (canon ratifié 2026-07-28), R321-R323, OP-01..05.
 * R321 : l'incident opérationnel est un DOSSIER tracé — déclaration par TOUT collaborateur,
 * classification OBLIGATOIRE dans la taxonomie Bâle du tenant (clé R-Q `oprisk_taxonomie`,
 * default-deny), sévérité, pertes ; DECLARE → EN_ANALYSE → CLOS (liste fermée, clôture
 * motivée R7). Un constat d'intégrité SO-07 ouvre un incident RÉFÉRENCÉ (OP-04 — la
 * surface SO s'ouvre à CETTE route et à elle seule, cf. tenant.middleware).
 * R322 : la heatmap est CALCULÉE (fréquence × sévérité par catégorie de la taxonomie),
 * JAMAIS peinte — aucune route ni aucun événement de cellule n'existe (OP-03 structurel) ;
 * rejouable à date (borne sur l'at des événements).
 * R323 : plan d'action tracé (owner, échéance, statut) ; le RETARD est un FAIT calculé
 * (pattern R274) — notifié à l'owner UNE fois, escaladé DIR au-delà de
 * `oprisk_escalade_jours`, jamais bloquant (l'action en retard se complète normalement).
 * AMA quantitatif : option à ratifier séparément — NON livrée. État dérivé des
 * événements — aucune table nouvelle ; O-Live STRUCTURE, il ne rend jamais l'avis.
 */

type Ctx = { tenantId: string; userId: string; role: string };

const TRANSITIONS: Record<string, string[]> = { DECLARE: ["EN_ANALYSE"], EN_ANALYSE: ["CLOS"], CLOS: [] };
const STATUTS_ACTION = ["A_FAIRE", "EN_COURS", "FAIT"];

@Injectable()
export class OpRiskService {
  constructor(private prisma: PrismaService, private audit: AuditService,
    private parametres: ParametresService) {}

  private emit(type: string, tenantId: string, aggregateId: string, payload: any) {
    return emitEvent(this.prisma, tenantId, type, aggregateId, payload);
  }

  private async taxonomie(ctx: Ctx): Promise<string[]> {
    return (await this.parametres.valeurEffective(ctx, "oprisk_taxonomie", new Date())) as string[] ?? [];
  }

  // ── OP-01 : déclarer — TOUT collaborateur ; la classification est OBLIGATOIRE. ──
  async declarer(ctx: Ctx, dto: { titre?: string; categorie?: string; severite?: number;
    pertes?: number; description?: string; reference?: { source?: string; journal?: string; detail?: string } }) {
    if (!dto?.titre?.trim()) throw new BadRequestException("titre requis");
    const taxo = await this.taxonomie(ctx);
    if (!dto?.categorie || !taxo.includes(dto.categorie)) throw new BadRequestException(
      `R321 : classification OBLIGATOIRE dans la taxonomie Bâle du tenant — reçu « ${dto?.categorie ?? "rien"} », admis : ${taxo.join(", ")}`);
    if (!Number.isInteger(dto.severite) || dto.severite! < 1 || dto.severite! > 5)
      throw new BadRequestException("R321 : sévérité entière 1..5 requise");
    const id = randomUUID();
    await this.emit("oprisk.incident.declare", ctx.tenantId, id,
      { id, titre: dto.titre.trim(), categorie: dto.categorie, severite: dto.severite,
        pertes: dto.pertes ?? null, description: dto.description ?? null,
        reference: dto.reference ?? null, par: ctx.userId });
    await this.audit.log(ctx.tenantId, ctx.userId, "OPRISK_INCIDENT_DECLARE", id);
    return { id, statut: "DECLARE" };
  }

  // L'état, DÉRIVÉ des événements (rejouable) — borné à date pour la heatmap R322.
  private async incidentsA(tenantId: string, borne?: string) {
    const evs = await this.prisma.domainEvent.findMany({
      where: { tenantId, type: { in: ["oprisk.incident.declare", "oprisk.incident.transition"] } },
      orderBy: { id: "asc" } });
    const parId = new Map<string, any>();
    for (const e of evs) {
      if (borne && new Date(e.at as any).toISOString() > borne) continue;
      const p: any = e.payload;
      if (e.type === "oprisk.incident.declare") parId.set(p.id, { ...p, statut: "DECLARE" });
      if (e.type === "oprisk.incident.transition" && parId.has(p.id)) parId.get(p.id).statut = p.vers;
    }
    return [...parId.values()];
  }

  async lister(ctx: Ctx) { return { incidents: await this.incidentsA(ctx.tenantId) }; }

  // ── OP-02 : le chemin est une liste FERMÉE ; la clôture se motive (R7). ──
  async transitionner(ctx: Ctx, id: string, dto: { vers?: string; motif?: string }) {
    const inc = (await this.incidentsA(ctx.tenantId)).find((i) => i.id === id);
    if (!inc) throw new NotFoundException("Incident introuvable");
    if (!TRANSITIONS[inc.statut]?.includes(dto?.vers ?? ""))
      throw new BadRequestException(`R321 : transition ${inc.statut} → ${dto?.vers} hors chemin (admis : ${TRANSITIONS[inc.statut]?.join(", ") || "aucun"})`);
    if (dto!.vers === "CLOS" && !dto?.motif?.trim())
      throw new BadRequestException("R7 : clore un incident opérationnel se motive");
    await this.emit("oprisk.incident.transition", ctx.tenantId, id,
      { id, de: inc.statut, vers: dto!.vers, motif: dto?.motif?.trim() ?? null, par: ctx.userId });
    await this.audit.log(ctx.tenantId, ctx.userId, "OPRISK_INCIDENT_TRANSITION", `${id}:${dto!.vers}`);
    return { id, statut: dto!.vers };
  }

  // ── R322 : la heatmap — un CALCUL pur sur l'état rejoué à date, jamais une écriture. ──
  async heatmap(ctx: Ctx, at?: string) {
    const borne = at ? new Date(at).toISOString() : undefined;
    const incidents = await this.incidentsA(ctx.tenantId, borne);
    const cellules = (await this.taxonomie(ctx)).map((categorie) => {
      const dans = incidents.filter((i) => i.categorie === categorie);
      const severiteMax = dans.reduce((m, i) => Math.max(m, i.severite), 0);
      return { categorie, frequence: dans.length, severiteMax,
        score: dans.length * severiteMax };                                 // fréquence × sévérité
    });
    return { at: borne ?? "maintenant", cellules };
  }

  // ── R323 : le plan d'action — owner, échéance, statut ; le retard est un FAIT. ──
  async creerAction(ctx: Ctx, dto: { incidentId?: string; titre?: string; owner?: string; echeance?: string }) {
    if (!dto?.incidentId || !dto?.titre?.trim() || !dto?.owner || !dto?.echeance)
      throw new BadRequestException("incidentId, titre, owner et echeance requis");
    const inc = (await this.incidentsA(ctx.tenantId)).find((i) => i.id === dto.incidentId);
    if (!inc) throw new NotFoundException("Incident introuvable");
    const id = randomUUID();
    await this.emit("oprisk.action.creee", ctx.tenantId, id,
      { id, incidentId: dto.incidentId, titre: dto.titre.trim(), owner: dto.owner,
        echeance: dto.echeance, par: ctx.userId });
    return { id, statut: "A_FAIRE" };
  }

  private async actionsDe(tenantId: string) {
    const evs = await this.prisma.domainEvent.findMany({
      where: { tenantId, type: { in: ["oprisk.action.creee", "oprisk.action.statut"] } },
      orderBy: { id: "asc" } });
    const parId = new Map<string, any>();
    for (const e of evs) {
      const p: any = e.payload;
      if (e.type === "oprisk.action.creee") parId.set(p.id, { ...p, statut: "A_FAIRE" });
      if (e.type === "oprisk.action.statut" && parId.has(p.id)) parId.get(p.id).statut = p.vers;
    }
    const now = Date.now();
    return [...parId.values()].map((a) => ({ ...a,
      enRetard: a.statut !== "FAIT" && new Date(a.echeance).getTime() < now }));  // FAIT calculé (R274)
  }

  async listerActions(ctx: Ctx, incidentId?: string) {
    const actions = await this.actionsDe(ctx.tenantId);
    return { actions: incidentId ? actions.filter((a) => a.incidentId === incidentId) : actions };
  }

  async statutAction(ctx: Ctx, id: string, dto: { vers?: string }) {
    if (!STATUTS_ACTION.includes(dto?.vers ?? "")) throw new BadRequestException(`vers requis : ${STATUTS_ACTION.join(" | ")}`);
    const a = (await this.actionsDe(ctx.tenantId)).find((x) => x.id === id);
    if (!a) throw new NotFoundException("Action introuvable");
    await this.emit("oprisk.action.statut", ctx.tenantId, id, { id, de: a.statut, vers: dto!.vers, par: ctx.userId });
    return { id, statut: dto!.vers };                                       // jamais bloqué — même en retard
  }

  // ── OP-05 : le tick — notification owner puis escalade DIR, UNE fois par état (R274). ──
  async tick(ctx: Ctx) {
    const seuilJours = (await this.parametres.valeurEffective(ctx, "oprisk_escalade_jours", new Date())) as number ?? 7;
    const dejaNotifies = new Set((await this.prisma.domainEvent.findMany({
      where: { tenantId: ctx.tenantId, type: { in: ["tache.oprisk.action.retard", "oprisk.action.escalade"] } } }))
      .map((e) => `${e.type}|${(e.payload as any).id}`));
    const now = Date.now();
    let notifications = 0, escalades = 0;
    for (const a of await this.actionsDe(ctx.tenantId)) {
      if (!a.enRetard) continue;
      const retardJours = (now - new Date(a.echeance).getTime()) / 86400000;
      if (!dejaNotifies.has(`tache.oprisk.action.retard|${a.id}`)) {
        notifications++;
        await this.emit("tache.oprisk.action.retard", ctx.tenantId, a.id,
          { id: a.id, incidentId: a.incidentId, titre: a.titre, echeance: a.echeance,
            notifie: [a.owner], par: ctx.userId });
      }
      if (retardJours >= seuilJours && !dejaNotifies.has(`oprisk.action.escalade|${a.id}`)) {
        escalades++;
        await this.emit("oprisk.action.escalade", ctx.tenantId, a.id,
          { id: a.id, incidentId: a.incidentId, titre: a.titre, echeance: a.echeance,
            retardJours: Math.floor(retardJours), notifie: ["DIR"], par: ctx.userId });
      }
    }
    return { notifications, escalades };                                    // compté — rien n'est bloqué (R39)
  }
}

@Controller("oprisk")
export class OpRiskController {
  constructor(private svc: OpRiskService) {}
  @Post("incidents")                declarer(@Req() r: any, @Body() b: any) { return this.svc.declarer(r.ctx, b ?? {}); }        // OP-01/04
  @Get("incidents")                 lister(@Req() r: any) { return this.svc.lister(r.ctx); }
  @Post("incidents/:id/transition") transition(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.transitionner(r.ctx, id, b ?? {}); } // OP-02
  @Get("heatmap")                   heatmap(@Req() r: any, @Query("at") at?: string) { return this.svc.heatmap(r.ctx, at); }     // OP-03 (lecture seule)
  @Post("actions")                  creerAction(@Req() r: any, @Body() b: any) { return this.svc.creerAction(r.ctx, b ?? {}); }  // R323
  @Get("actions")                   actions(@Req() r: any, @Query("incidentId") i?: string) { return this.svc.listerActions(r.ctx, i); }
  @Post("actions/:id/statut")       statut(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.statutAction(r.ctx, id, b ?? {}); }
  @Post("tick")                     tick(@Req() r: any) { return this.svc.tick(r.ctx); }                                         // OP-05
}

@Module({ imports: [ParametresModule], controllers: [OpRiskController], providers: [OpRiskService] })
export class OpRiskModule {}
