import { Injectable, ForbiddenException, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { emitEvent } from "../../common/domain-event";
import { loadSettings } from "../../common/tenant-settings";

/**
 * Capacité d'équipe — R183→R185 (WK-01..05). Écrit APRÈS l'amendement, APRÈS les tests.
 * Doctrine (R39 + art. 26 OLT 3) : le système MESURE et SIGNALE ; l'humain RÉPARTIT et
 * DÉCIDE. R183 : tout dérive des tâches (aucun pointage) ; transparence structurelle —
 * chacun lit SES mesures, le responsable DÉCLARÉ (paramètre workloadResponsables) lit son
 * équipe, un tiers est refusé et tracé. R184 : la surcharge est un signal ; réassigner est
 * un acte motivé du responsable. R185 : barème versionné par date d'effet (pattern R29) —
 * chaque accomplissement garde à vie les points du barème de SON jour ; le snapshot RH est
 * un événement de matière première, jamais un bonus calculé.
 */

type Ctx = { tenantId: string; userId: string; role: string };

@Injectable()
export class WorkloadService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private emit(tx: any, tenantId: string, type: string, aggregateId: string, payload: any) {
    return emitEvent(tx, tenantId, type, aggregateId, payload);
  }
  private async settings(tenantId: string) {
    return loadSettings(this.prisma, tenantId);
  }
  private baremeAu(s: any, dateIso: string): Record<string, number> {
    const versions = (s.workloadBareme ?? [])
      .filter((b: any) => b.depuisLe <= dateIso.slice(0, 10))
      .sort((a: any, b: any) => a.depuisLe.localeCompare(b.depuisLe));
    return versions.length ? versions[versions.length - 1].points : {};
  }
  private async estResponsableDe(ctx: Ctx, equipeRole: string, s: any): Promise<boolean> {
    return (s.workloadResponsables ?? []).some((r: any) => r.responsableRole === ctx.role && r.equipeRole === equipeRole);
  }
  private async mesure(ctx: Ctx, s: any, user: any) {
    const tasks = await this.prisma.task.findMany({ where: { tenantId: ctx.tenantId, assigneeId: user.id } });
    const cap = s.workloadCapacite?.standardParSemaine ?? 10;
    const baremeActif = this.baremeAu(s, new Date().toISOString());
    const actives = tasks.filter((k: any) => k.statut !== "FAITE");
    const faites = tasks.filter((k: any) => k.statut === "FAITE" && k.doneAt);
    const poids = actives.reduce((a: number, k: any) => a + (baremeActif[k.type] ?? 1), 0);
    const delais = faites.map((k: any) => (new Date(k.doneAt).getTime() - new Date(k.createdAt).getTime()) / 86_400_000);
    let points = 0; const detail: any[] = [];
    for (const k of faites) {
      const pts = this.baremeAu(s, k.doneAt)[k.type] ?? 0;   // R185 : le barème du jour de l'accomplissement
      points += pts; detail.push({ taskId: k.id, type: k.type, doneAt: k.doneAt, points: pts });
    }
    return { userId: user.id, nom: user.name, role: user.role,
      ouvertes: tasks.filter((k: any) => k.statut === "OUVERTE").length,
      enCours: tasks.filter((k: any) => k.statut === "EN_COURS").length,
      faites: faites.length,
      chargePct: Math.round((poids / cap) * 100),
      delaiMoyenJours: delais.length ? Math.round((delais.reduce((a, b) => a + b, 0) / delais.length) * 10) / 10 : null,
      points, detail };
  }

  // ── R183 : la charge de l'équipe — pour le responsable déclaré ──
  async chargeEquipe(ctx: Ctx, equipeRole: string) {
    const s = await this.settings(ctx.tenantId);
    if (!(await this.estResponsableDe(ctx, equipeRole, s))) {
      await this.prisma.$transaction(async (tx: any) =>
        this.emit(tx, ctx.tenantId, "workload.acces.refuse", equipeRole, { par: ctx.userId, role: ctx.role }));
      throw new ForbiddenException(`R183 : voir la charge de l'équipe ${equipeRole} exige d'en être le responsable déclaré (workloadResponsables)`);
    }
    // ÉCART SIGNALÉ (lot 39) : equipeRole est un string (paramètre workloadResponsables) ;
    // User.role est l'enum Role ratifié — cast explicite au filtre Prisma (aucun service
    // ratifié modifié ; seul ce fichier nouveau porte le pont). Cf. rapport lot 39.
    const users = await this.prisma.user.findMany({ where: { tenantId: ctx.tenantId, role: equipeRole as any } });
    const membres = [];
    for (const u of users) membres.push(await this.mesure(ctx, s, u));
    return { equipeRole, membres };
  }

  // ── R183 : mes mesures — rien ne m'est caché ──
  async mesuresDe(ctx: Ctx, userId: string) {
    const s = await this.settings(ctx.tenantId);
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId: ctx.tenantId } });
    if (!user) throw new NotFoundException("Collaborateur introuvable");
    if (ctx.userId !== userId && !(await this.estResponsableDe(ctx, user.role, s))) {
      await this.prisma.$transaction(async (tx: any) =>
        this.emit(tx, ctx.tenantId, "workload.acces.refuse", userId, { par: ctx.userId, role: ctx.role }));
      throw new ForbiddenException("R183 : les mesures d'un collaborateur se lisent par lui-même ou par son responsable déclaré");
    }
    return this.mesure(ctx, s, user);
  }

  // ── R184 : la surcharge signale — rien ne bouge ──
  async signalerSurcharges(ctx: Ctx, equipeRole: string) {
    const eq = await this.chargeEquipe(ctx, equipeRole);
    const s = await this.settings(ctx.tenantId);
    const seuil = s.workloadCapacite?.seuilSurchargePct ?? 80;
    const sur = eq.membres.filter((m: any) => m.chargePct > seuil);
    return this.prisma.$transaction(async (tx: any) => {
      for (const m of sur)
        await this.emit(tx, ctx.tenantId, "workload.surcharge.signalee", m.userId,
          { chargePct: m.chargePct, seuil, suggestion: "rééquilibrer vers un membre disponible — la décision vous appartient" });
      return sur.map((m: any) => ({ userId: m.userId, nom: m.nom, chargePct: m.chargePct }));
    });
  }

  // ── R184 : réassigner — l'acte motivé du responsable ──
  async reassigner(ctx: Ctx, taskId: string, versUserId: string, motif: string) {
    if (!motif || !motif.trim()) throw new BadRequestException("R7 : réassigner se motive — motif obligatoire");
    return this.prisma.$transaction(async (tx: any) => {
      const k = await tx.task.findFirst({ where: { id: taskId, tenantId: ctx.tenantId } });
      if (!k) throw new NotFoundException("Tâche introuvable");
      const s = await this.settings(ctx.tenantId);
      const de = await tx.user.findFirst({ where: { id: k.assigneeId, tenantId: ctx.tenantId } });
      if (!de || !(await this.estResponsableDe(ctx, de.role, s)))
        throw new ForbiddenException("R184 : réassigner est l'acte du responsable déclaré de l'équipe");
      const vers = await tx.user.findFirst({ where: { id: versUserId, tenantId: ctx.tenantId } });
      if (!vers) throw new NotFoundException("Destinataire introuvable");
      await tx.task.update({ where: { id: k.id }, data: { assigneeId: versUserId } });
      await this.emit(tx, ctx.tenantId, "workload.tache.reassignee", k.id,
        { de: k.assigneeId, vers: versUserId, motif: motif.trim(), par: ctx.userId });
      await this.audit.log(ctx.tenantId, ctx.userId, "WORKLOAD_REASSIGN", k.id);
    });
  }

  // ── R185 : les points — la matière du bonus, jamais le bonus ──
  async points(ctx: Ctx, userId: string) {
    const m: any = await this.mesuresDe(ctx, userId);
    return { userId, total: m.points, detail: m.detail };
  }
  async snapshotRh(ctx: Ctx, equipeRole: string) {
    const eq = await this.chargeEquipe(ctx, equipeRole);
    const membres = eq.membres.map((m: any) => ({ userId: m.userId, nom: m.nom, points: m.points,
      faites: m.faites, delaiMoyenJours: m.delaiMoyenJours }));
    await this.prisma.$transaction(async (tx: any) =>
      this.emit(tx, ctx.tenantId, "rh.bonification.snapshot", equipeRole,
        { membres, note: "matière pour la décision humaine de fin d'année — le moteur ne décide rien" }));
    return { equipeRole, membres };
  }
}
