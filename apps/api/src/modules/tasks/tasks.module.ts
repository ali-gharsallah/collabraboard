import { Body, Controller, Get, Param, Post, Query, Req, Module, Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { WorkloadModule } from "../workload/workload.module";
import { WorkloadService } from "../workload/workload.service";
import { applyKeyset, PageParams } from "../../common/pagination";
import { emitEvent } from "../../common/domain-event";
import { Tx } from "../../common/tx";
import { loadSettings } from "../../common/tenant-settings";
import { teamScope } from "../../common/visibility";

/**
 * MOD Tâches (R239→R242, lot 52). Écrit spec-first depuis le Gherkin TA-01..06, sur ratification
 * « OK pour R239..R246 » (amendement A2). Une tâche naît d'un ÉVÉNEMENT (R239, jamais par effet de
 * bord) ; création manuelle gouvernée (R239) ; listage scopé SERVEUR (R240) ; complétion ÉVÉNEMENTIELLE
 * immuable + habilitée (R241) ; SLA mesuré jamais coercitif (R242/R39). La réassignation réutilise le
 * ratifié `WorkloadService.reassigner` (aucune règle nouvelle). L'auteur est TOUJOURS le jeton.
 *
 * ⚠ Écart signalé (ECARTS-FRONT) : le vocabulaire de statut R239 (OPEN|COMPLETED|CANCELLED) est mappé
 * sur le vocabulaire ratifié du modèle Task (OUVERTE|FAITE|ANNULEE) — workload R183 inchangé ; mapping DTO.
 */

type Ctx = { tenantId: string; userId: string; role: string };
const AU_DTO: Record<string, string> = { OUVERTE: "OPEN", EN_COURS: "OPEN", FAITE: "COMPLETED", ANNULEE: "CANCELLED" };

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService, private audit: AuditService, private workload: WorkloadService) {}

  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return emitEvent(tx, tenantId, type, aggregateId, payload);
  }
  private async settings(ctx: Ctx) {
    return loadSettings(this.prisma, ctx.tenantId, true);
  }
  private dto = (k: any, asOf?: string) => {
    const statutStock = asOf ? (k.doneAt && k.doneAt <= asOf ? "FAITE" : "OUVERTE") : k.statut;
    return { id: k.id, type: k.type, assignee: k.assigneeId, subjectType: k.subjectType, subjectId: k.subjectId ?? k.clientId,
      echeance: k.dueAt, statut: AU_DTO[statutStock] ?? "OPEN", origine: k.origine, completedBy: k.completedBy,
      comment: k.completeComment, createdAt: k.createdAt, completedAt: k.doneAt };
  };

  // ── R239 : naissance par ÉVÉNEMENT (le seul chemin non-manuel). Émet TASK_CREATED. ──
  async creerDepuisEvenement(ctx: Ctx, dto: { origine: string; type: string; subjectType?: string; subjectId?: string; assignee: string; echeance?: string }) {
    if (!dto?.origine) throw new BadRequestException("R239 : origine (événement) requise");
    if (!dto?.assignee || !dto?.type) throw new BadRequestException("assignee et type requis");
    const row = await this.prisma.$transaction(async (tx: Tx) => {
      const k = await tx.task.create({ data: {
        tenantId: ctx.tenantId, assigneeId: dto.assignee, type: dto.type, statut: "OUVERTE",
        createdAt: new Date().toISOString(), dueAt: dto.echeance ?? null,
        subjectType: dto.subjectType ?? null, subjectId: dto.subjectId ?? null, origine: dto.origine } });
      await this.emit(tx, ctx.tenantId, "task.created", k.id, { origine: dto.origine, type: dto.type, subjectId: dto.subjectId ?? null, assignee: dto.assignee });
      return k;
    });
    await this.audit.log(ctx.tenantId, ctx.userId, "TASK_CREATED", `${dto.type}:${dto.origine}`);
    return this.dto(row);
  }

  // ── R239 : création MANUELLE — autorisée seulement si le registre l'ouvre. ──
  async creerManuel(ctx: Ctx, dto: { type: string; subjectType?: string; subjectId?: string; assignee?: string; echeance?: string }) {
    const s = await this.settings(ctx);
    if (!s.taskManualCreation) throw new BadRequestException("TASK_MANUAL_CREATION_DISABLED");
    if (!dto?.type) throw new BadRequestException("type requis");
    const row = await this.prisma.$transaction(async (tx: Tx) => {
      const k = await tx.task.create({ data: {
        tenantId: ctx.tenantId, assigneeId: dto.assignee ?? ctx.userId, type: dto.type, statut: "OUVERTE",
        createdAt: new Date().toISOString(), dueAt: dto.echeance ?? null,
        subjectType: dto.subjectType ?? null, subjectId: dto.subjectId ?? null, origine: "MANUAL" } });
      await this.emit(tx, ctx.tenantId, "task.created.manual", k.id, { type: dto.type, par: ctx.userId });
      return k;
    });
    await this.audit.log(ctx.tenantId, ctx.userId, "TASK_CREATED_MANUAL", dto.type);
    return this.dto(row);
  }

  // ── R240 : listage SCOPÉ serveur (soi / équipe / tout). asOf = rejeu (R48). ──
  async lister(ctx: Ctx, f: { status?: string; assignee?: string; dueBefore?: string; subjectId?: string; asOf?: string } & PageParams) {
    const s = await this.settings(ctx);
    const voitTout: string[] = s.taskVisibiliteRoles ?? ["CO", "CF", "ADMIN"];
    const where: any = { tenantId: ctx.tenantId };
    // Périmètre SERVEUR : null = tout le tenant (voit-tout), sinon l'ensemble autorisé (soi + équipe).
    // Source unique (A2, common/visibility) — même règle que MOD-43 Formations.
    const scope = await teamScope(this.prisma, ctx.tenantId, ctx.role, ctx.userId, s, voitTout);
    // Le filtre `assignee` NARROW dans le périmètre — jamais l'élargir (R240) : hors périmètre ⇒ vide.
    if (f.assignee) {
      if (scope && !scope.has(f.assignee)) return [];
      where.assigneeId = f.assignee;
    } else if (scope) {
      where.assigneeId = { in: [...scope] };
    }
    if (f.subjectId) where.subjectId = f.subjectId;
    if (f.dueBefore) where.dueAt = { lte: f.dueBefore };
    const take = applyKeyset(where, f);                                       // A4 : défaut borné + curseur keyset
    let rows = await this.prisma.task.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take });
    if (f.asOf) rows = rows.filter((k: any) => k.createdAt <= f.asOf!);       // R48 : n'existe pas avant sa création
    let out = rows.map((k: any) => this.dto(k, f.asOf));
    if (f.status) out = out.filter((t: any) => t.statut === f.status);
    return out;
  }

  // ── R241 : complétion ÉVÉNEMENTIELLE immuable + habilitée. ──
  async completer(ctx: Ctx, id: string, dto: { comment?: string }) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const k = await tx.task.findFirst({ where: { id, tenantId: ctx.tenantId } });
      if (!k) throw new NotFoundException("Tâche introuvable");
      if (k.statut === "FAITE") throw new ConflictException("TASK_ALREADY_COMPLETED");
      const s = (await tx.tenant.findFirst({ where: { id: ctx.tenantId } })).settings ?? {};
      const roles: string[] = (s as any).taskCompleteRoles ?? [];
      if (k.assigneeId !== ctx.userId && !roles.includes(ctx.role)) throw new ForbiddenException("TASK_COMPLETE_FORBIDDEN");
      const maj = await tx.task.update({ where: { id: k.id },
        data: { statut: "FAITE", doneAt: new Date().toISOString(), completedBy: ctx.userId, completeComment: dto?.comment ?? null } });
      await this.emit(tx, ctx.tenantId, "task.completed", k.id, { acteur: ctx.userId, commentaire: dto?.comment ?? null });   // append-only
      await this.audit.log(ctx.tenantId, ctx.userId, "TASK_COMPLETED", id);
      return this.dto(maj);
    });
  }

  // ── R240/A2 : réassignation = ratifié WorkloadService.reassigner (inchangé). ──
  async reassigner(ctx: Ctx, id: string, dto: { toUserId: string; motif?: string }) {
    if (!dto?.toUserId) throw new BadRequestException("toUserId requis");
    await this.workload.reassigner(ctx, id, dto.toUserId, dto.motif ?? "Réassignation");
    return this.dto(await this.prisma.task.findFirst({ where: { id, tenantId: ctx.tenantId } }));
  }

  // ── R242/R39 : SLA mesuré, jamais coercitif. ──
  async mesurerSla(ctx: Ctx, now: string) {
    const rows = await this.prisma.task.findMany({ where: { tenantId: ctx.tenantId, statut: { not: "FAITE" } } });
    const enRetard = rows.filter((k: any) => k.dueAt && k.dueAt < now);
    await this.prisma.$transaction(async (tx: Tx) => {
      for (const k of enRetard) await this.emit(tx, ctx.tenantId, "task.sla.retard", k.id, { dueAt: k.dueAt, assignee: k.assigneeId });
    });
    return { enRetard: enRetard.length, bloque: false };                     // R39 : signal, jamais coercition
  }
}

@Controller("tasks")
export class TasksController {
  constructor(private svc: TasksService) {}
  @Get()               lister(@Req() r: any, @Query("status") status?: string, @Query("assignee") assignee?: string, @Query("dueBefore") dueBefore?: string, @Query("subjectId") subjectId?: string, @Query("asOf") asOf?: string, @Query("limit") limit?: string, @Query("cursor") cursor?: string) {
    return this.svc.lister(r.ctx, { status, assignee, dueBefore, subjectId, asOf, limit, cursor }); }   // R240
  @Post()              creer(@Req() r: any, @Body() b: any) { return this.svc.creerManuel(r.ctx, b); }                 // R239 (gated)
  @Post("from-event")  fromEvent(@Req() r: any, @Body() b: any) { return this.svc.creerDepuisEvenement(r.ctx, b); }    // R239 : surface de consommation d'événement
  @Post(":id/complete") completer(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.completer(r.ctx, id, b); } // R241
  @Post(":id/reassign") reassign(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.reassigner(r.ctx, id, b); } // ratifié
  @Post("sla/tick")    sla(@Req() r: any, @Body() b: any) { return this.svc.mesurerSla(r.ctx, b?.now ?? new Date().toISOString()); }    // R242
}

@Module({
  imports: [WorkloadModule],
  controllers: [TasksController],
  providers: [
    { provide: TasksService, useFactory: (p: PrismaService, a: AuditService, w: WorkloadService) => new TasksService(p, a, w), inject: [PrismaService, AuditService, WorkloadService] }],
  exports: [TasksService],                 // R245/NB-05 : le service NBA fera naître des tâches d'un événement décidé
})
export class TasksModule {}
