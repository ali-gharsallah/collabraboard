import { Body, Controller, Get, Module, Param, Post, Query, Req, Injectable, ForbiddenException, BadRequestException, ConflictException, UnprocessableEntityException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { Tx } from "../../common/tx";
import * as listeBlanche from "./outils-liste-blanche.json";

/**
 * OLIVIA v2 — ARCHITECTURE AGENTIQUE (Partie B DÉGELÉE le 2026-07-27, décision Ali —
 * R259–R266, SW-01..18 ; mapping du message de dégel consigné dans ECARTS).
 *
 * Étape 1 : R264 — LE CONTRAT D'OUTIL PRÉCÈDE TOUT AGENT.
 * Un outil = {code, endpoint_ref, methode GET|PROPOSE, schema_entree, schema_sortie}.
 * `PROPOSE` ne peut cibler QUE la création d'objets `olivia_proposals` (R254). Il n'existe
 * AUCUN outil d'écriture d'état métier (B.0) — et c'est PROUVÉ deux fois :
 *   • CI : `outils-liste-blanche.json` est la SOURCE UNIQUE ; le build échoue si un outil
 *     livré pointe hors liste (B.7 critère 2, script scripts/verifier-liste-blanche-outils.js).
 *   • Runtime : toute déclaration hors liste ⇒ 422 TOOL_ENDPOINT_HORS_LISTE, registre
 *     inchangé (SW-12) — même vérité, même fichier.
 * Écriture = acte ADMIN, lecture ouverte à tous (B.3). Auteur = jeton, jamais le corps.
 */

type Ctx = { tenantId: string; userId: string; role: string };
const LB = listeBlanche as unknown as { lecture: string[]; proposition: string[] };

@Injectable()
export class SwarmToolsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}
  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload, at: new Date().toISOString() } });
  }

  // ── R264 : déclarer un outil — la liste blanche décide, pas le déclarant ──
  async declarer(ctx: Ctx, dto: { code?: string; endpointRef?: string; methode?: string; schemaEntree?: any; schemaSortie?: any }) {
    if (ctx.role !== "ADMIN") throw new ForbiddenException("R264 : la déclaration d'outil est un acte ADMIN (B.3)");
    if (!dto?.code?.trim() || !dto?.endpointRef?.trim() || !dto?.methode)
      throw new BadRequestException("code, endpointRef et methode requis");
    if (dto.methode !== "GET" && dto.methode !== "PROPOSE")
      throw new UnprocessableEntityException(`R264 : methode « ${dto.methode} » hors contrat — seules GET|PROPOSE existent`);
    const licites = dto.methode === "GET" ? LB.lecture : LB.proposition;   // PROPOSE ⇒ création olivia_proposals, RIEN d'autre
    if (!licites.includes(dto.endpointRef))
      throw new UnprocessableEntityException(
        `TOOL_ENDPOINT_HORS_LISTE: « ${dto.endpointRef} » n'est pas dans la liste blanche ${dto.methode} (R264 — étendre la liste = revue CI, jamais un acte runtime)`);
    const deja = await this.prisma.oliviaTool.findFirst({ where: { tenantId: ctx.tenantId, code: dto.code.trim() } });
    if (deja) throw new ConflictException(`R264 : l'outil « ${dto.code} » existe déjà (unicité tenant+code)`);
    const outil = await this.prisma.$transaction(async (tx: Tx) => {
      const o = await tx.oliviaTool.create({ data: { tenantId: ctx.tenantId, code: dto.code!.trim(),
        endpointRef: dto.endpointRef!.trim(), methode: dto.methode!,
        schemaEntree: dto.schemaEntree ?? {}, schemaSortie: dto.schemaSortie ?? {} } });
      await this.emit(tx, ctx.tenantId, "olivia.outil.declare", o.id,
        { code: o.code, endpointRef: o.endpointRef, methode: o.methode, par: ctx.userId });
      return o;
    });
    await this.audit.log(ctx.tenantId, ctx.userId, "OLIVIA_TOOL_DECLARED", outil.code);
    return { id: outil.id, code: outil.code, endpointRef: outil.endpointRef, methode: outil.methode };
  }

  // ── Lecture ouverte à tous les rôles du tenant (B.3) ──
  async lister(ctx: Ctx) {
    const rows = await this.prisma.oliviaTool.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { code: "asc" } });
    return rows.map((t: any) => ({ id: t.id, code: t.code, endpointRef: t.endpointRef, methode: t.methode,
      schemaEntree: t.schemaEntree, schemaSortie: t.schemaSortie }));
  }
}

/**
 * Étape 2 : R259 — TOUT AGENT EST DÉCLARÉ AU REGISTRE, aucun agent implicite.
 * Registre VERSIONNÉ À DATE (R68) et APPEND-ONLY (SQL) : déclarer = version n+1, retirer =
 * une nouvelle version RETIRE — jamais une mutation. La résolution `resoudre()` est LE point
 * unique que consommeront les runs (SW-01/SW-02) : inconnu ⇒ 422 RUN_AGENT_INCONNU, retiré ⇒
 * 422 RUN_AGENT_RETIRE ; à date, la version d'ÉPOQUE est restituée (le rejeu d'un run ancien
 * utilise la définition d'agent de l'époque). Un agent ne peut déclarer que des outils
 * EXISTANTS au registre R264 (aucun outil implicite non plus).
 */
@Injectable()
export class SwarmAgentsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}
  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload, at: new Date().toISOString() } });
  }

  // ── R259 : déclarer = version n+1 (ADMIN) — les outils doivent EXISTER (R264) ──
  async declarer(ctx: Ctx, dto: { code?: string; capacite?: string; outilsAutorises?: string[]; gabaritRef?: string }) {
    if (ctx.role !== "ADMIN") throw new ForbiddenException("R259 : la déclaration d'agent est un acte ADMIN (B.3)");
    if (!dto?.code?.trim() || !dto?.capacite?.trim() || !dto?.gabaritRef?.trim() || !Array.isArray(dto?.outilsAutorises))
      throw new BadRequestException("code, capacite, outilsAutorises[] et gabaritRef requis");
    const declares = await this.prisma.oliviaTool.findMany({ where: { tenantId: ctx.tenantId } });
    const connus = new Set(declares.map((t: any) => t.code));
    const fantomes = dto.outilsAutorises.filter((o) => !connus.has(o));
    if (fantomes.length)
      throw new UnprocessableEntityException(`R259/R264 : outils non déclarés au registre : ${fantomes.join(", ")} — aucun outil implicite`);
    const agent = await this.prisma.$transaction(async (tx: Tx) => {
      const derniere = await tx.oliviaAgent.findFirst({ where: { tenantId: ctx.tenantId, code: dto.code!.trim() },
        orderBy: { version: "desc" } });
      const a = await tx.oliviaAgent.create({ data: { tenantId: ctx.tenantId, code: dto.code!.trim(),
        version: (derniere?.version ?? 0) + 1, capacite: dto.capacite!.trim(),
        outilsAutorises: dto.outilsAutorises!, gabaritRef: dto.gabaritRef!.trim(),
        statut: "ACTIF", effectifDepuis: new Date() } });
      await this.emit(tx, ctx.tenantId, "olivia.agent.declare", a.id,
        { code: a.code, version: a.version, gabaritRef: a.gabaritRef, par: ctx.userId });
      return a;
    });
    await this.audit.log(ctx.tenantId, ctx.userId, "OLIVIA_AGENT_DECLARED", `${agent.code}:v${agent.version}`);
    return this.vue(agent);
  }

  // ── R259 : retirer = une NOUVELLE version RETIRE (append-only, jamais une mutation) ──
  async retirer(ctx: Ctx, code: string, dto: { motif?: string }) {
    if (ctx.role !== "ADMIN") throw new ForbiddenException("R259 : le retrait d'agent est un acte ADMIN");
    const courant = await this.enVigueurBrut(ctx.tenantId, code);
    if (!courant) throw new UnprocessableEntityException(`RUN_AGENT_INCONNU: agent « ${code} » jamais déclaré`);
    if (courant.statut === "RETIRE") throw new ConflictException(`R259 : « ${code} » est déjà RETIRE`);
    const retrait = await this.prisma.$transaction(async (tx: Tx) => {
      const a = await tx.oliviaAgent.create({ data: { tenantId: ctx.tenantId, code: courant.code,
        version: courant.version + 1, capacite: courant.capacite,
        outilsAutorises: courant.outilsAutorises as any, gabaritRef: courant.gabaritRef,
        statut: "RETIRE", effectifDepuis: new Date() } });
      await this.emit(tx, ctx.tenantId, "olivia.agent.retire", a.id,
        { code: a.code, version: a.version, motif: dto?.motif ?? null, par: ctx.userId });
      return a;
    });
    await this.audit.log(ctx.tenantId, ctx.userId, "OLIVIA_AGENT_RETIRED", `${retrait.code}:v${retrait.version}`);
    return this.vue(retrait);
  }

  // ── Lecture (tous rôles) : la version EN VIGUEUR par code, à date si asOf (R68) ──
  async lister(ctx: Ctx, asOf?: string) {
    const at = asOf ? new Date(asOf) : new Date();
    const rows = await this.prisma.oliviaAgent.findMany({
      where: { tenantId: ctx.tenantId, effectifDepuis: { lte: at } },
      orderBy: [{ code: "asc" }, { version: "desc" }] });
    const parCode = new Map<string, any>();
    for (const r of rows) if (!parCode.has(r.code)) parCode.set(r.code, r);  // desc ⇒ premier = en vigueur
    return [...parCode.values()].map((a) => this.vue(a));
  }

  // ── SW-01/SW-02 : LA résolution que consomment les runs — refus typés ──
  async resoudre(ctx: Ctx, code: string, asOf?: string) {
    const agent = await this.enVigueurBrut(ctx.tenantId, code, asOf);
    if (!agent) throw new UnprocessableEntityException(`RUN_AGENT_INCONNU: agent « ${code} » absent du registre (R259 — aucun agent implicite)`);
    if (agent.statut === "RETIRE" && !asOf)
      throw new UnprocessableEntityException(`RUN_AGENT_RETIRE: agent « ${code} » retiré — un nouveau run ne peut pas l'invoquer (le replay d'un run ancien reste servi à date)`);
    if (agent.statut === "RETIRE" && asOf)
      throw new UnprocessableEntityException(`RUN_AGENT_RETIRE: agent « ${code} » déjà retiré à ${asOf}`);
    return this.vue(agent);
  }

  private async enVigueurBrut(tenantId: string, code: string, asOf?: string) {
    const at = asOf ? new Date(asOf) : new Date();
    return this.prisma.oliviaAgent.findFirst({
      where: { tenantId, code, effectifDepuis: { lte: at } }, orderBy: { version: "desc" } });
  }
  private vue(a: any) {
    return { id: a.id, code: a.code, version: a.version, capacite: a.capacite,
      outilsAutorises: a.outilsAutorises, gabaritRef: a.gabaritRef, statut: a.statut,
      effectifDepuis: a.effectifDepuis };
  }
}

@Controller("olivia")
export class SwarmController {
  constructor(private outils: SwarmToolsService, private agents: SwarmAgentsService) {}
  @Get("tools")  listerOutils(@Req() r: any) { return this.outils.lister(r.ctx); }               // R264 (tous)
  @Post("tools") declarerOutil(@Req() r: any, @Body() b: any) { return this.outils.declarer(r.ctx, b ?? {}); } // R264 (ADMIN)
  @Get("agents") listerAgents(@Req() r: any, @Query("asOf") asOf?: string) { return this.agents.lister(r.ctx, asOf); } // R259 (tous, à date R68)
  @Post("agents") declarerAgent(@Req() r: any, @Body() b: any) { return this.agents.declarer(r.ctx, b ?? {}); }        // R259 (ADMIN)
  @Post("agents/:code/retirer") retirerAgent(@Req() r: any, @Param("code") code: string, @Body() b: any) {
    return this.agents.retirer(r.ctx, code, b ?? {}); }                                          // R259 (ADMIN)
  @Get("agents/:code/en-vigueur") resoudreAgent(@Req() r: any, @Param("code") code: string, @Query("asOf") asOf?: string) {
    return this.agents.resoudre(r.ctx, code, asOf); }                                            // SW-01/02 (résolution des runs)
}

@Module({
  controllers: [SwarmController],
  providers: [PrismaService, AuditService, SwarmToolsService, SwarmAgentsService],
  exports: [SwarmToolsService, SwarmAgentsService],
})
export class SwarmModule {}
