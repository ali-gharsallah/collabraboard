import { Body, Controller, Get, Param, Post, Query, Req, Module, Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";

/**
 * MOD-43 Formations & Certifications (R231→R238, lot 50). Écrit spec-first depuis le Gherkin
 * FO-01..08, sur ratification explicite « OK pour R222..R238 » d'Ali. Doctrine : le référentiel
 * est 100% tenant (registre `trainingCatalog`, R231) ; la complétion est un ÉVÉNEMENT avec
 * attestation GED (R232) ; attestations & certifications sont APPEND-ONLY (R234) ; le mode de
 * validation est un paramètre tenant (R235 : AUTO ou VALIDATED = visa uniforme R15, l'auteur ne
 * valide jamais sa propre complétion — R13). Rappels informatifs (R233/R39). L'auteur est TOUJOURS
 * le jeton (ctx.userId), jamais le corps.
 */

type Ctx = { tenantId: string; userId: string; role: string };
const jours = (aIso: string, bIso: string) => (new Date(aIso).getTime() - new Date(bIso).getTime()) / 86_400_000;

@Injectable()
export class FormationsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private emit(tx: any, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload, at: new Date().toISOString() } });
  }
  private async settings(ctx: Ctx) {
    const t = await this.prisma.tenant.findFirst({ where: { id: ctx.tenantId } });
    if (!t) throw new NotFoundException("Tenant introuvable");
    return (t.settings as any) ?? {};
  }

  // ── R231 : référentiel des formations, 100% tenant (aucun type en dur) ──
  async catalogue(ctx: Ctx) {
    const s = await this.settings(ctx);
    return s.trainingCatalog ?? [];
  }

  // Assignation d'une formation à un collaborateur (support du cycle de vie R232).
  async assigner(ctx: Ctx, dto: { userId: string; formationCode: string; echeance: string }) {
    if (!dto?.userId || !dto?.formationCode) throw new BadRequestException("userId et formationCode requis");
    const row = await this.prisma.trainingAssignment.create({ data: {
      tenantId: ctx.tenantId, userId: dto.userId, formationCode: dto.formationCode,
      echeance: dto.echeance ?? new Date().toISOString().slice(0, 10), statut: "ASSIGNED" } });
    await this.audit.log(ctx.tenantId, ctx.userId, "TRAINING_ASSIGNED", `${dto.formationCode}:${dto.userId}`);
    return row;
  }

  // ── R236 : visibilité par profil — soi / équipe (responsable) / tout (habilité) ──
  async assignations(ctx: Ctx, filtre: { userId?: string }) {
    const s = await this.settings(ctx);
    const voitTout: string[] = s.trainingVisibiliteRoles ?? ["CO", "CF", "ADMIN"];
    const where: any = { tenantId: ctx.tenantId };
    if (!voitTout.includes(ctx.role)) {
      // périmètre restreint : soi + (si responsable) les collaborateurs de son/ses équipe(s)
      const equipes = (s.workloadResponsables ?? [])
        .filter((r: any) => r.responsableRole === ctx.role).map((r: any) => r.equipeRole);
      const ids = new Set<string>([ctx.userId]);
      if (equipes.length) {
        const membres = await this.prisma.user.findMany({ where: { tenantId: ctx.tenantId, role: { in: equipes } } });
        membres.forEach((m: any) => ids.add(m.id));
      }
      where.userId = { in: [...ids] };
    }
    if (filtre.userId) where.userId = filtre.userId;               // vue ciblée (dans le périmètre autorisé)
    return this.prisma.trainingAssignment.findMany({ where, orderBy: { createdAt: "desc" } });
  }

  // ── R232/R235 : compléter = événement + attestation (GED) ; AUTO → COMPLETED, VALIDATED → visa ──
  async completer(ctx: Ctx, id: string, dto: { attestationDocId: string }) {
    if (!dto?.attestationDocId) throw new BadRequestException("R232 : attestation (GED) obligatoire pour compléter");
    return this.prisma.$transaction(async (tx: any) => {
      const a = await tx.trainingAssignment.findFirst({ where: { id, tenantId: ctx.tenantId } });
      if (!a) throw new NotFoundException("Assignation introuvable");
      const s = (await tx.tenant.findFirst({ where: { id: ctx.tenantId } })).settings ?? {};
      const mode = (s as any).trainingCompletionValidation ?? { mode: "AUTO" };
      // attestation APPEND-ONLY (R234)
      await tx.trainingAttestation.create({ data: { tenantId: ctx.tenantId, userId: a.userId, formationCode: a.formationCode, docId: dto.attestationDocId } });
      await this.emit(tx, ctx.tenantId, "training.completed", a.id, { userId: a.userId, formationCode: a.formationCode, docId: dto.attestationDocId });
      const data: any = { attestationDocId: dto.attestationDocId };
      if (mode.mode === "VALIDATED") { data.statut = "IN_PROGRESS"; data.visaStatut = "PENDING"; }
      else { data.statut = "COMPLETED"; data.visaStatut = null; }
      const maj = await tx.trainingAssignment.update({ where: { id: a.id }, data });
      await this.audit.log(ctx.tenantId, ctx.userId, "TRAINING_COMPLETED", `${a.formationCode}:${a.userId}`);
      return maj;
    });
  }

  // ── R235/R13 : valider une complétion (mode VALIDATED) = visa uniforme, jamais soi-même ──
  async validerCompletion(ctx: Ctx, id: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const a = await tx.trainingAssignment.findFirst({ where: { id, tenantId: ctx.tenantId } });
      if (!a) throw new NotFoundException("Assignation introuvable");
      if (a.visaStatut !== "PENDING") throw new BadRequestException("Aucun visa en attente sur cette complétion");
      const s = (await tx.tenant.findFirst({ where: { id: ctx.tenantId } })).settings ?? {};
      const conf = (s as any).trainingCompletionValidation ?? { mode: "AUTO" };
      if (conf.mode !== "VALIDATED") throw new BadRequestException("Mode de validation non VALIDATED");
      if (conf.role && ctx.role !== conf.role) throw new ForbiddenException(`R235 : rôle ${conf.role} requis pour valider`);
      if (a.userId === ctx.userId) throw new ForbiddenException("TRAINING_SELF_VALIDATION_FORBIDDEN");   // R13
      const maj = await tx.trainingAssignment.update({ where: { id: a.id },
        data: { visaStatut: "SIGNED", visePar: ctx.userId, viseAt: new Date().toISOString(), statut: "COMPLETED" } });
      await this.emit(tx, ctx.tenantId, "training.validated", a.id, { userId: a.userId, formationCode: a.formationCode, par: ctx.userId });
      await this.audit.log(ctx.tenantId, ctx.userId, "TRAINING_VALIDATED", `${a.formationCode}:${a.userId}`);
      return maj;
    });
  }

  // ── R234 : émettre/renouveler une certification (APPEND-ONLY — jamais d'écrasement) ──
  async certifier(ctx: Ctx, dto: { userId: string; code: string; obtenueLe: string; expireLe: string; docId?: string }) {
    if (!dto?.userId || !dto?.code || !dto?.obtenueLe || !dto?.expireLe)
      throw new BadRequestException("userId, code, obtenueLe, expireLe requis");
    const row = await this.prisma.certification.create({ data: {
      tenantId: ctx.tenantId, userId: dto.userId, code: dto.code, obtenueLe: dto.obtenueLe, expireLe: dto.expireLe, docId: dto.docId ?? null } });
    await this.audit.log(ctx.tenantId, ctx.userId, "CERTIFICATION_ISSUED", `${dto.code}:${dto.userId}`);
    return row;
  }

  // ── R238 : rejeu certifiant — « qui était certifié X au JJ » depuis l'historique append-only ──
  async certifications(ctx: Ctx, userId: string, asOf?: string) {
    const rows = await this.prisma.certification.findMany({ where: { tenantId: ctx.tenantId, userId }, orderBy: { obtenueLe: "asc" } });
    if (!asOf) return { userId, historique: rows };
    const date = asOf;
    const active = rows.find((c: any) => c.obtenueLe <= date && c.expireLe > date);
    return { userId, asOf, certifie: !!active, certification: active ?? null, historique: rows };
  }

  // ── R233/R39 : rappels J-x informatifs (aucun blocage) ──
  async tickRappels(ctx: Ctx, now: string) {
    const s = await this.settings(ctx);
    const seuils: number[] = s.trainingReminderDays ?? [30, 7];
    const rows = await this.prisma.certification.findMany({ where: { tenantId: ctx.tenantId } });
    let rappels = 0;
    await this.prisma.$transaction(async (tx: any) => {
      for (const c of rows) {
        const d = Math.round(jours(c.expireLe, now));
        if (d >= 0 && seuils.includes(d)) {
          await this.emit(tx, ctx.tenantId, "training.reminder", c.id, { userId: c.userId, code: c.code, joursRestants: d });
          rappels++;
        }
      }
    });
    return { rappels };                                            // signal, jamais coercition (R39)
  }
}

@Controller("formations")
export class FormationsController {
  constructor(private svc: FormationsService) {}
  @Get("catalog")                    catalogue(@Req() r: any) { return this.svc.catalogue(r.ctx); }                                   // R231
  @Get("assignments")                assignations(@Req() r: any, @Query("userId") userId?: string) { return this.svc.assignations(r.ctx, { userId }); } // R236
  @Post("assignments")               assigner(@Req() r: any, @Body() b: any) { return this.svc.assigner(r.ctx, b); }
  @Post("assignments/:id/complete")  completer(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.completer(r.ctx, id, b); }     // R232/R235
  @Post("assignments/:id/visa")      valider(@Req() r: any, @Param("id") id: string) { return this.svc.validerCompletion(r.ctx, id); }                  // R235/R13
  @Post("certifications")            certifier(@Req() r: any, @Body() b: any) { return this.svc.certifier(r.ctx, b); }                // R234
  @Get("certifications")             certifs(@Req() r: any, @Query("userId") userId: string, @Query("asOf") asOf?: string) { return this.svc.certifications(r.ctx, userId, asOf); } // R238
  @Post("rappels/tick")              rappels(@Req() r: any, @Body() b: any) { return this.svc.tickRappels(r.ctx, b?.now ?? new Date().toISOString()); }  // R233
}

@Module({
  controllers: [FormationsController],
  providers: [
    { provide: FormationsService, useFactory: (p: PrismaService, a: AuditService) => new FormationsService(p, a), inject: [PrismaService, AuditService] }],
  exports: [FormationsService],
})
export class FormationsModule {}
