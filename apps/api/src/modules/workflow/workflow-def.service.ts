import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { emitEvent } from "../../common/domain-event";
import { Tx } from "../../common/tx";

/**
 * Le workflow est un paramètre gouverné — R171→R173 (WF-01..05). Écrit APRÈS l'amendement,
 * APRÈS les tests. Le front Appway : l'atelier, mais gouverné.
 * R171 : la définition est versionnée à date de mise en vigueur (pattern R29) ; PUBLIEE =
 * IMMUABLE — on ne modifie jamais, on publie une version datée ; l'historique reste lisible
 * (R48, rejeu à date).
 * R172 : le dossier emporte sa version — resoudre(code, dateOuverture) = la version publiée
 * la plus récente dont depuisLe ≤ date. Grandfathering STRUCTUREL : sans copie, sans
 * figement manuel. Une version future ne s'applique à personne avant sa date.
 * R173 : le brouillon se modifie à volonté et n'existe JAMAIS pour le moteur (pattern
 * R114) ; publier est un acte jeton, habilité (workflowRoles, R-Q), motivé (R7), tracé —
 * et ne se rejoue pas.
 */

type Ctx = { tenantId: string; userId: string; role: string };

@Injectable()
export class WorkflowDefService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return emitEvent(tx, tenantId, type, aggregateId, payload);
  }
  private async roles(tx: Tx, tenantId: string) {
    const t = await tx.tenant.findFirst({ where: { id: tenantId } });
    return ((t?.settings as any) ?? {}).workflowRoles ?? ["CO", "ADMIN"];
  }

  // ── R173 : le brouillon — modifiable, tracé, invisible au moteur ──
  async creerBrouillon(ctx: Ctx, dto: { code: string; contenu: any }) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const roles = await this.roles(tx, ctx.tenantId);
      if (!roles.includes(ctx.role)) {
        await this.emit(tx, ctx.tenantId, "workflow.def.acces.refuse", dto.code, { par: ctx.userId, role: ctx.role });
        throw new ForbiddenException(`R173 : rôle ${ctx.role} non habilité sur les workflows`);
      }
      const publiees = await tx.workflowDef.findMany({ where: { tenantId: ctx.tenantId, code: dto.code, statut: "PUBLIEE" } });
      const version = publiees.reduce((a: number, d: any) => Math.max(a, d.version), 0) + 1;
      const d = await tx.workflowDef.create({ data: { tenantId: ctx.tenantId, code: dto.code,
        version, statut: "BROUILLON", depuisLe: null, contenu: dto.contenu ?? {},
        creePar: ctx.userId, publiePar: null, publieAt: null, motif: null } });
      await this.emit(tx, ctx.tenantId, "workflow.def.brouillon", d.id, { code: dto.code, version, par: ctx.userId });
      return { defId: d.id, version };
    });
  }

  async modifierBrouillon(ctx: Ctx, defId: string, contenu: any) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const d = await tx.workflowDef.findFirst({ where: { id: defId, tenantId: ctx.tenantId } });
      if (!d) throw new NotFoundException("Définition introuvable");
      if (d.statut === "PUBLIEE")
        throw new BadRequestException("R171 : une définition publiée est IMMUABLE — publiez une nouvelle version datée");
      const roles = await this.roles(tx, ctx.tenantId);
      if (!roles.includes(ctx.role)) throw new ForbiddenException(`R173 : rôle ${ctx.role} non habilité`);
      await tx.workflowDef.update({ where: { id: d.id }, data: { contenu } });
    });
  }

  // ── R171/R173 : publier — l'acte qui grave ──
  async publier(ctx: Ctx, defId: string, dto: { depuisLe: string; motif: string }) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const d = await tx.workflowDef.findFirst({ where: { id: defId, tenantId: ctx.tenantId } });
      if (!d) throw new NotFoundException("Définition introuvable");
      if (d.statut === "PUBLIEE") throw new BadRequestException("La publication ne se rejoue pas");
      const roles = await this.roles(tx, ctx.tenantId);
      if (!roles.includes(ctx.role)) {
        await this.emit(tx, ctx.tenantId, "workflow.def.acces.refuse", d.code, { par: ctx.userId, role: ctx.role });
        throw new ForbiddenException(`R173 : rôle ${ctx.role} non habilité à publier`);
      }
      if (!dto.motif || !dto.motif.trim()) throw new BadRequestException("R7 : la publication se motive");
      if (!dto.depuisLe) throw new BadRequestException("R171 : la publication porte sa date de mise en vigueur");
      const at = new Date().toISOString();
      await tx.workflowDef.update({ where: { id: d.id }, data: { statut: "PUBLIEE",
        depuisLe: dto.depuisLe, publiePar: ctx.userId, publieAt: at, motif: dto.motif.trim() } });
      await this.emit(tx, ctx.tenantId, "workflow.def.publiee", d.id,
        { code: d.code, version: d.version, depuisLe: dto.depuisLe, par: ctx.userId, motif: dto.motif.trim() });
      await this.audit.log(ctx.tenantId, ctx.userId, "WORKFLOW_PUBLISH", `${d.code}:v${d.version}`);
    });
  }

  // ── R172 : la résolution datée — le grandfathering structurel ──
  async resoudre(ctx: Ctx, code: string, dateOuverture: string) {
    const candidates = await this.prisma.workflowDef.findMany({
      where: { tenantId: ctx.tenantId, code, statut: "PUBLIEE", depuisLe: { lte: dateOuverture } } });
    if (!candidates.length)
      throw new NotFoundException(`Aucune définition publiée applicable à ${code} au ${dateOuverture}`);
    return candidates.sort((a: any, b: any) => String(b.depuisLe).localeCompare(String(a.depuisLe)))[0];
  }

  async lister(ctx: Ctx, code?: string) {
    return this.prisma.workflowDef.findMany({ where: code
      ? { tenantId: ctx.tenantId, code } : { tenantId: ctx.tenantId } });
  }
}
