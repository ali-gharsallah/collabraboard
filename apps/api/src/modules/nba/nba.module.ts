import { Body, Controller, Get, Param, Post, Query, Req, Module, Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { TasksModule } from "../tasks/tasks.module";
import { TasksService } from "../tasks/tasks.module";
import { applyKeyset, PageParams } from "../../common/pagination";
import { emitEvent } from "../../common/domain-event";
import { Tx } from "../../common/tx";

/**
 * MOD Décision NBA (R243→R246, lot 53). Écrit spec-first depuis le Gherkin NB-01..06, sur ratification
 * « OK pour R239..R246 » (amendement A2 §A2.2). Une suggestion PROPOSED est IMMUABLE (R243, explicabilité :
 * aucune route de modification). La décision est un ÉVÉNEMENT append-only, UNE SEULE fois (R244). R44 strict :
 * humain seulement, AUCUNE exécution directe (R245) — l'ACCEPT émet `NBA_DECIDED`, et c'est le SERVICE TÂCHES
 * (consommateur) qui en fait naître la tâche (`creerDepuisEvenement`, R239). Rejeu à date (R246). L'auteur est
 * TOUJOURS le jeton (ctx.userId), jamais le corps.
 */

type Ctx = { tenantId: string; userId: string; role: string };
const HUMAINS = ["RM", "ARM", "CO", "CO_SR", "MLRO", "CF", "BRM", "DIR", "ADMIN"];   // R245 : seuls des humains décident

@Injectable()
export class NbaService {
  constructor(private prisma: PrismaService, private audit: AuditService, private tasks: TasksService) {}

  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return emitEvent(tx, tenantId, type, aggregateId, payload);
  }
  private async ttl(ctx: Ctx) {
    const t = await this.prisma.tenant.findFirst({ where: { id: ctx.tenantId } });
    return { s: (t?.settings as any) ?? {}, ttl: ((t?.settings as any) ?? {}).nbaTtlDays ?? 30 };
  }
  private dto = (n: any) => ({ id: n.id, contexte: n.contexte, subjectId: n.subjectId, proposition: n.proposition,
    facteurs: n.facteurs, statut: n.statut, decision: n.decision, adjustment: n.adjustment, rationale: n.rationale,
    decidedBy: n.decidedBy, decidedAt: n.decidedAt, createdAt: n.createdAt });

  // Le moteur propose (surface de génération). PROPOSED, immuable dès ici.
  async proposer(ctx: Ctx, dto: { contexte: string; subjectId: string; proposition: string; facteurs?: any[] }) {
    if (!dto?.contexte || !dto?.subjectId || !dto?.proposition) throw new BadRequestException("contexte, subjectId, proposition requis");
    const { ttl } = await this.ttl(ctx);
    const row = await this.prisma.nbaSuggestion.create({ data: {
      tenantId: ctx.tenantId, contexte: dto.contexte, subjectId: dto.subjectId, proposition: dto.proposition,
      facteurs: dto.facteurs ?? [], statut: "PROPOSED", ttlDays: ttl, createdAt: new Date().toISOString() } });
    return this.dto(row);
  }

  async lister(ctx: Ctx, f: { context?: string; subjectId?: string; status?: string } & PageParams) {
    const where: any = { tenantId: ctx.tenantId };
    if (f.context) where.contexte = f.context;
    if (f.subjectId) where.subjectId = f.subjectId;
    if (f.status) where.statut = f.status;
    const take = applyKeyset(where, f);                                            // A4 : défaut borné + curseur keyset
    return (await this.prisma.nbaSuggestion.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take })).map(this.dto);
  }

  // ── R246 : rejeu à date — « que proposait le système le JJ et qu'a décidé qui » ──
  async get(ctx: Ctx, id: string, asOf?: string) {
    const n = await this.prisma.nbaSuggestion.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!n) throw new NotFoundException("Suggestion introuvable");
    if (!asOf) return this.dto(n);
    if (n.createdAt > asOf) return { id: n.id, asOf, existeADate: false };
    const decidee = n.decidedAt && n.decidedAt <= asOf;
    return { ...this.dto(n), asOf, existeADate: true,
      statut: decidee ? "DECIDED" : "PROPOSED",
      decision: decidee ? n.decision : null, rationale: decidee ? n.rationale : null, decidedBy: decidee ? n.decidedBy : null };
  }

  // ── R244/R245 : décision unique, humaine, append-only ; aucune exécution directe ──
  async decider(ctx: Ctx, id: string, dto: { decision: string; adjustment?: any; rationale?: string }) {
    if (!HUMAINS.includes(ctx.role)) throw new ForbiddenException("NBA_DECISION_HUMAN_ONLY");     // R245/R44
    const decision = dto?.decision;
    if (!["ACCEPT", "ADJUST", "REJECT"].includes(decision)) throw new BadRequestException("decision ∈ {ACCEPT,ADJUST,REJECT}");
    const { s } = await this.ttl(ctx);
    const created = await this.prisma.$transaction(async (tx: Tx) => {
      const n = await tx.nbaSuggestion.findFirst({ where: { id, tenantId: ctx.tenantId } });
      if (!n) throw new NotFoundException("Suggestion introuvable");
      if (n.statut !== "PROPOSED") throw new ConflictException("NBA_ALREADY_DECIDED");             // R244 : une seule fois
      if (decision === "REJECT" && s.nbaRejectRationaleRequired && !(dto.rationale && dto.rationale.trim()))
        throw new BadRequestException("NBA_REJECT_RATIONALE_REQUIRED");                            // R244
      if (decision === "ADJUST" && (dto.adjustment === undefined || dto.adjustment === null ||
        (typeof dto.adjustment === "object" && Object.keys(dto.adjustment).length === 0)))
        throw new BadRequestException("NBA_ADJUSTMENT_REQUIRED");                                  // R244
      await tx.nbaSuggestion.update({ where: { id: n.id }, data: { statut: "DECIDED", decision,
        adjustment: dto.adjustment ?? null, rationale: dto.rationale ?? null, decidedBy: ctx.userId, decidedAt: new Date().toISOString() } });
      await this.emit(tx, ctx.tenantId, "nba.decided", n.id, { decision, acteur: ctx.userId, adjustment: dto.adjustment ?? null });   // R244 append-only
      return n;
    });
    await this.audit.log(ctx.tenantId, ctx.userId, "NBA_DECIDED", `${id}:${decision}`);
    // R245 : AUCUNE exécution directe — sur ACCEPT/ADJUST, le SERVICE TÂCHES consomme l'événement et crée la tâche.
    if (decision === "ACCEPT" || decision === "ADJUST") {
      await this.tasks.creerDepuisEvenement(ctx, { origine: "NBA_DECIDED", type: `NBA_${created.contexte.toUpperCase()}`,
        subjectType: created.contexte, subjectId: created.subjectId, assignee: ctx.userId });
    }
    return { id, decision, statut: "DECIDED" };
  }
}

@Controller("nba")
export class NbaController {
  constructor(private svc: NbaService) {}
  @Get()             lister(@Req() r: any, @Query("context") context?: string, @Query("subjectId") subjectId?: string, @Query("status") status?: string, @Query("limit") limit?: string, @Query("cursor") cursor?: string) {
    return this.svc.lister(r.ctx, { context, subjectId, status, limit, cursor }); }
  @Post("propose")   proposer(@Req() r: any, @Body() b: any) { return this.svc.proposer(r.ctx, b); }                                     // moteur
  @Get(":id")        get(@Req() r: any, @Param("id") id: string, @Query("asOf") asOf?: string) { return this.svc.get(r.ctx, id, asOf); } // R246
  @Post(":id/decision") decider(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.decider(r.ctx, id, b); }      // R244/R245
}

@Module({
  imports: [TasksModule],
  controllers: [NbaController],
  providers: [
    { provide: NbaService, useFactory: (p: PrismaService, a: AuditService, t: TasksService) => new NbaService(p, a, t), inject: [PrismaService, AuditService, TasksService] }],
  exports: [NbaService],
})
export class NbaModule {}
