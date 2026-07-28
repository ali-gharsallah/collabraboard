import { Body, Controller, Get, Module, Param, Post, Query, Req, Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { Tx } from "../../common/tx";

/**
 * Échéances de review — R272→R275 (RV-01..08), canon `spec/canon-debloquants-home.md` partie 1
 * (ratifié 2026-07-27). Le « Perpetual KYC » d'O-Live : calculé, versionné, rejouable.
 * R272 : l'échéance est CALCULÉE à l'approbation du KYC (hook sur l'événement existant — PAS un
 * cron) ; la cadence appliquée est FIGÉE dans la ligne (grandfathering R29 : changer le paramètre
 * ne réécrit rien, RV-02). R273 : l'anticipation est un ÉVÉNEMENT motivé ; le RECUL exige rôle
 * habilité + motif + visa four-eyes d'un second (R13). R274 : préavis et retard NOTIFIENT, ne
 * bloquent JAMAIS (R39) — EN_RETARD est calculé à la lecture, jamais stocké. R275 : la review
 * réalisée = l'approbation d'un KYC Rn+1 — l'échéance passe REALISEE et la suivante repart.
 * Paramètres R-Q : cadenceReviewMois {EDD:12, CDD:36, SDD:60} · preavisReviewJours (30) ·
 * escaladeRetardJours {CO:30, DIR:90} · rolesReportEcheance ([CO_SR]).
 */

type Ctx = { tenantId: string; userId: string; role: string };
const CADENCE_DEFAUT: Record<string, number> = { EDD: 12, CDD: 36, SDD: 60 };

function plusMois(d: Date, mois: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + mois);
  return r;
}

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload, at: new Date().toISOString() } });
  }
  private async settings(db: any, tenantId: string) {
    const t = await db.tenant.findFirst({ where: { id: tenantId } });
    return ((t?.settings as any) ?? {});
  }
  private cadence(s: any, niveau: string): number {
    return (s.cadenceReviewMois ?? {})[niveau] ?? CADENCE_DEFAUT[niveau] ?? CADENCE_DEFAUT.CDD;
  }

  // ── R272/R275 : LE hook — appelé DANS la transaction d'approbation du KYC (jamais un cron).
  //    Clôt l'échéance courante (REALISEE, référence au KYC) et calcule la suivante avec la
  //    cadence EN VIGUEUR (figée dans la ligne). ──
  async surApprobation(ctx: Ctx, tx: Tx, kyc: { id: string; clientId: string; workflow: string; validatedAt?: Date | null }) {
    const s = await this.settings(tx, ctx.tenantId);
    const courante = await tx.reviewDeadline.findFirst({
      where: { tenantId: ctx.tenantId, clientId: kyc.clientId, statut: "PLANIFIEE" } });
    if (courante) {                                                        // RV-07 : la boucle se referme
      await tx.reviewDeadline.update({ where: { id: courante.id },
        data: { statut: "REALISEE", realiseeKycId: kyc.id } });
      await this.emit(tx, ctx.tenantId, "REVIEW_DEADLINE_REALISEE", courante.id,
        { clientId: kyc.clientId, kycId: kyc.id, par: ctx.userId });
    }
    const cadenceMois = this.cadence(s, kyc.workflow);
    const base = kyc.validatedAt ?? new Date();
    const d = await tx.reviewDeadline.create({ data: {
      tenantId: ctx.tenantId, clientId: kyc.clientId, sourceKycId: kyc.id,
      ddlLevel: kyc.workflow, cadenceMois, dueDate: plusMois(base, cadenceMois) } });
    await this.emit(tx, ctx.tenantId, "REVIEW_DEADLINE_SET", d.id,
      { clientId: kyc.clientId, ddlLevel: kyc.workflow, cadenceMois, dueDate: d.dueDate, sourceKycId: kyc.id });
    return d;
  }

  // ── R272/RV-03 : changement de ddl_level (aiguillage adopté) — recalcul TRACÉ, jamais silencieux.
  //    L'ancienne ligne passe REMPLACEE (chaînée) ; la nouvelle repart du même KYC source. ──
  async recalcul(ctx: Ctx, clientId: string, dto: { ddlLevel?: string; motif?: string }) {
    if (!dto?.ddlLevel || !(dto.ddlLevel in CADENCE_DEFAUT))
      throw new BadRequestException("ddlLevel requis : EDD | CDD | SDD");
    return this.prisma.$transaction(async (tx: Tx) => {
      const courante = await tx.reviewDeadline.findFirst({
        where: { tenantId: ctx.tenantId, clientId, statut: "PLANIFIEE" } });
      if (!courante) throw new NotFoundException("Aucune échéance PLANIFIEE pour ce client");
      const s = await this.settings(tx, ctx.tenantId);
      const cadenceMois = this.cadence(s, dto.ddlLevel);
      const kyc = await tx.kycFile.findFirst({ where: { id: courante.sourceKycId } });
      const base = kyc?.validatedAt ?? courante.createdAt;
      await tx.reviewDeadline.update({ where: { id: courante.id }, data: { statut: "REMPLACEE" } }); // libère l'index partiel (RV-08)
      const nouvelle = await tx.reviewDeadline.create({ data: {
        tenantId: ctx.tenantId, clientId, sourceKycId: courante.sourceKycId,
        ddlLevel: dto.ddlLevel, cadenceMois, dueDate: plusMois(new Date(base), cadenceMois) } });
      await tx.reviewDeadline.update({ where: { id: courante.id }, data: { remplacePar: nouvelle.id } });
      await this.emit(tx, ctx.tenantId, "REVIEW_DEADLINE_SET", nouvelle.id,
        { clientId, ddlLevel: dto.ddlLevel, cadenceMois, dueDate: nouvelle.dueDate,
          remplace: courante.id, motif: dto.motif ?? "changement de niveau de diligence", par: ctx.userId });
      await this.audit.log(ctx.tenantId, ctx.userId, "REVIEW_RECALCUL", `${clientId}:${courante.ddlLevel}->${dto.ddlLevel}`);
      return { id: nouvelle.id, dueDate: nouvelle.dueDate, remplace: courante.id };
    });
  }

  // ── R273 : AVANCER — événement motivé (déclencheur, ancienne date, nouvelle date, auteur). ──
  async anticiper(ctx: Ctx, deadlineId: string, dto: { nouvelleDate?: string; motif?: string; declencheur?: string }) {
    if (!dto?.motif?.trim()) throw new BadRequestException("R7 : anticiper exige un motif");
    if (!dto?.nouvelleDate) throw new BadRequestException("nouvelleDate requise");
    return this.prisma.$transaction(async (tx: Tx) => {
      const d = await tx.reviewDeadline.findFirst({ where: { id: deadlineId, tenantId: ctx.tenantId } });
      if (!d) throw new NotFoundException("Échéance introuvable");
      if (d.statut !== "PLANIFIEE") throw new ConflictException(`Échéance ${d.statut} — non modifiable`);
      const nouvelle = new Date(dto.nouvelleDate);
      if (nouvelle >= new Date(d.dueDate))
        throw new BadRequestException("R273 : anticiper = AVANCER — reculer passe par le report (visa four-eyes)");
      await tx.reviewDeadline.update({ where: { id: d.id }, data: { statut: "REMPLACEE" } });        // libère l'index partiel
      const n = await tx.reviewDeadline.create({ data: {
        tenantId: ctx.tenantId, clientId: d.clientId, sourceKycId: d.sourceKycId,
        ddlLevel: d.ddlLevel, cadenceMois: d.cadenceMois, dueDate: nouvelle } });
      await tx.reviewDeadline.update({ where: { id: d.id }, data: { remplacePar: n.id } });
      await this.emit(tx, ctx.tenantId, "REVIEW_DEADLINE_ANTICIPEE", n.id,
        { clientId: d.clientId, declencheur: dto.declencheur ?? "decision_humaine",
          ancienneDate: d.dueDate, nouvelleDate: n.dueDate, motif: dto.motif!.trim(), par: ctx.userId });
      await this.audit.log(ctx.tenantId, ctx.userId, "REVIEW_ANTICIPEE", n.id);
      return { id: n.id, dueDate: n.dueDate };
    });
  }

  // ── R273/R13 : RECULER — rôle habilité + motif, PUIS visa d'un second (l'initiateur ne vise pas). ──
  async demanderReport(ctx: Ctx, deadlineId: string, dto: { nouvelleDate?: string; motif?: string }) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const s = await this.settings(tx, ctx.tenantId);
      const habilites: string[] = s.rolesReportEcheance ?? ["CO_SR"];
      if (!habilites.includes(ctx.role))
        throw new ForbiddenException(`R273 : le rôle ${ctx.role} ne reporte pas une échéance (${habilites.join(", ")})`);
      if (!dto?.motif?.trim()) throw new BadRequestException("R7 : reporter une revue exige un motif");
      if (!dto?.nouvelleDate) throw new BadRequestException("nouvelleDate requise");
      const d = await tx.reviewDeadline.findFirst({ where: { id: deadlineId, tenantId: ctx.tenantId } });
      if (!d) throw new NotFoundException("Échéance introuvable");
      if (d.statut !== "PLANIFIEE") throw new ConflictException(`Échéance ${d.statut} — non modifiable`);
      if (new Date(dto.nouvelleDate) <= new Date(d.dueDate))
        throw new BadRequestException("Reporter = RECULER — avancer passe par l'anticipation");
      const demande = { nouvelleDate: dto.nouvelleDate, motif: dto.motif!.trim(), par: ctx.userId, at: new Date().toISOString() };
      await tx.reviewDeadline.update({ where: { id: d.id }, data: { reportEnAttente: demande } });
      await this.emit(tx, ctx.tenantId, "REVIEW_DEADLINE_REPORT_DEMANDE", d.id, demande);
      return { enAttenteDeVisa: true, ...demande };
    });
  }
  async viserReport(ctx: Ctx, deadlineId: string) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const s = await this.settings(tx, ctx.tenantId);
      const habilites: string[] = s.rolesReportEcheance ?? ["CO_SR"];
      if (!habilites.includes(ctx.role)) throw new ForbiddenException("R273 : rôle non habilité au visa de report");
      const d = await tx.reviewDeadline.findFirst({ where: { id: deadlineId, tenantId: ctx.tenantId } });
      if (!d?.reportEnAttente) throw new NotFoundException("Aucune demande de report en attente");
      const demande = d.reportEnAttente as any;
      if (demande.par === ctx.userId)
        throw new ForbiddenException("R13 : le visa de report exige un SECOND — l'initiateur ne vise pas");
      await tx.reviewDeadline.update({ where: { id: d.id }, data: { statut: "REMPLACEE", reportEnAttente: null } }); // libère l'index partiel
      const n = await tx.reviewDeadline.create({ data: {
        tenantId: ctx.tenantId, clientId: d.clientId, sourceKycId: d.sourceKycId,
        ddlLevel: d.ddlLevel, cadenceMois: d.cadenceMois, dueDate: new Date(demande.nouvelleDate) } });
      await tx.reviewDeadline.update({ where: { id: d.id }, data: { remplacePar: n.id } });
      await this.emit(tx, ctx.tenantId, "REVIEW_DEADLINE_REPORTEE", n.id,
        { clientId: d.clientId, ancienneDate: d.dueDate, nouvelleDate: n.dueDate,
          motif: demande.motif, demandePar: demande.par, visePar: ctx.userId });
      await this.audit.log(ctx.tenantId, ctx.userId, "REVIEW_REPORTEE", n.id);
      return { id: n.id, dueDate: n.dueDate };
    });
  }

  // ── T7 / R274 : la liste — périmètre SERVEUR (matrice A.3), EN_RETARD CALCULÉ à la lecture. ──
  async deadlines(ctx: Ctx, horizonJours?: number, _scope?: string) {
    if (ctx.role === "ADMIN") throw new ForbiddenException("HOME_SCOPE: ADMIN ne voit aucune donnée client (matrice A.3)");
    let clients: string[] | null = null;
    if (ctx.role === "RM" || ctx.role === "ARM") {
      const cs = await this.prisma.client.findMany({ where: { tenantId: ctx.tenantId, rmUserId: ctx.userId }, select: { id: true } });
      clients = cs.map((c) => c.id);
    }
    const horizon = horizonJours ?? 30;
    const limite = new Date(Date.now() + horizon * 86400000);
    const ds = await this.prisma.reviewDeadline.findMany({ where: {
      tenantId: ctx.tenantId, statut: "PLANIFIEE", dueDate: { lte: limite },
      ...(clients ? { clientId: { in: clients } } : {}) }, orderBy: { dueDate: "asc" }, take: 200 });
    const today = new Date();
    return ds.map((d: any) => ({ id: d.id, clientId: d.clientId, ddlLevel: d.ddlLevel,
      dueDate: d.dueDate, cadenceMois: d.cadenceMois, sourceKycId: d.sourceKycId,
      enRetard: d.dueDate < today,                                          // FAIT calculé — jamais stocké
      joursRetard: d.dueDate < today ? Math.floor((today.getTime() - new Date(d.dueDate).getTime()) / 86400000) : 0,
      reportEnAttente: d.reportEnAttente ? true : false }));
  }

  // ── R274/R39 : préavis + escalade — notifient UNE fois, ne bloquent JAMAIS (pattern tickSla). ──
  async tick(ctx: Ctx, now = new Date()) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const s = await this.settings(tx, ctx.tenantId);
      const preavis = s.preavisReviewJours ?? 30;
      const escaladeCo = (s.escaladeRetardJours ?? {}).CO ?? 30;
      const ds = await tx.reviewDeadline.findMany({ where: { tenantId: ctx.tenantId, statut: "PLANIFIEE" } });
      let notifies = 0;
      for (const d of ds) {
        const due = new Date(d.dueDate).getTime();
        if (!d.preavisSignale && now.getTime() >= due - preavis * 86400000) {
          await tx.reviewDeadline.update({ where: { id: d.id }, data: { preavisSignale: true } });
          await this.emit(tx, ctx.tenantId, "tache.review.preavis", d.id, { clientId: d.clientId, dueDate: d.dueDate });
          notifies++;
        }
        if (!d.escaladeSignalee && now.getTime() >= due + escaladeCo * 86400000) {
          await tx.reviewDeadline.update({ where: { id: d.id }, data: { escaladeSignalee: true } });
          await this.emit(tx, ctx.tenantId, "tache.review.escalade", d.id,
            { clientId: d.clientId, dueDate: d.dueDate, joursRetard: Math.floor((now.getTime() - due) / 86400000), vers: "CO" });
          notifies++;
        }
        // L'état ne bouge JAMAIS ici : le retard mesure, il ne bloque pas (R39).
      }
      return { notifies };
    });
  }
}

@Controller("reviews")
export class ReviewsController {
  constructor(private svc: ReviewsService) {}
  @Get("deadlines")                    liste(@Req() r: any, @Query("horizonJours") h?: string, @Query("scope") scope?: string) { return this.svc.deadlines(r.ctx, h != null ? Number(h) : undefined, scope); } // T7
  @Post("clients/:clientId/recalcul")  recalc(@Req() r: any, @Param("clientId") cid: string, @Body() b: any) { return this.svc.recalcul(r.ctx, cid, b ?? {}); }  // RV-03
  @Post("deadlines/:id/anticiper")     anticiper(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.anticiper(r.ctx, id, b ?? {}); }      // RV-04/R273
  @Post("deadlines/:id/report")        report(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.demanderReport(r.ctx, id, b ?? {}); }    // RV-05
  @Post("deadlines/:id/report/visa")   visa(@Req() r: any, @Param("id") id: string) { return this.svc.viserReport(r.ctx, id); }                                   // RV-05/R13
  @Post("tick")                        tick(@Req() r: any) { return this.svc.tick(r.ctx); }                                                                       // RV-06/R274
}

@Module({
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
