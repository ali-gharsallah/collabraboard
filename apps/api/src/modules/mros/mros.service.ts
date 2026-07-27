import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { Tx } from "../../common/tx";

/**
 * Communication MROS — R129→R132 (MR-01..06). Écrit APRÈS l'amendement, APRÈS les tests.
 * Art. 9 LBA : la décision (communiquer OU s'abstenir) est humaine, habilitée (R-Q), motivée
 * (R7), tracée — le système prépare, ne déclenche jamais (R129/R44).
 * Le dossier = références + empreintes, figé à la décision, opposable byte par byte (R130/R48/R49).
 * Art. 10 : le gel est posé par l'humain, APPLIQUÉ par le moteur (verifierTransaction — pattern
 * R110 : ce service constate, le moteur transactions bloque), échéance surveillée (R39), levée
 * explicite motivée — jamais automatique (R131).
 * Art. 10a : default-deny sur la lecture, accès ET refus tracés (R132, mécanique R112).
 * Paramètres R-Q (au registre — R125) : mrosRolesHabilites ["MLRO"] · mrosGelJoursOuvrables 5.
 * R136 (bloc 23) : la limite du bloc 22 est FERMÉE — decider exige un cas ESCALADÉ.
 */

type Ctx = { tenantId: string; userId: string; role: string };
type Piece = { type: string; id: string; sha256: string };
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

@Injectable()
export class MrosService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload, at: new Date().toISOString() } });
  }
  private async cfg(tx: Tx, tenantId: string) {
    const t = await tx.tenant.findFirst({ where: { id: tenantId } });
    const s = (t?.settings as any) ?? {};
    return { roles: s.mrosRolesHabilites ?? ["MLRO"], gelJours: s.mrosGelJoursOuvrables ?? 5 };
  }
  private async habilite(tx: Tx, ctx: Ctx) {
    const { roles } = await this.cfg(tx, ctx.tenantId);
    if (!roles.includes(ctx.role))
      throw new ForbiddenException(`R129/R132 : rôle ${ctx.role} non habilité MROS (paramètre R-Q)`);
  }
  private async comm(tx: Tx, ctx: Ctx, id: string) {
    const c = await tx.mrosCommunication.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!c) throw new NotFoundException("Communication introuvable");
    return c;
  }
  private joursOuvrables(depuis: Date, n: number) {
    const d = new Date(depuis); let restants = n;
    while (restants > 0) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) restants--; }
    return d.toISOString();
  }

  // ── R129/R130 : LA décision — habilitée, motivée, dossier figé et empreinté ──
  async decider(ctx: Ctx, dto: { riskCaseId: string; clientId: string;
    decision: "COMMUNIQUER" | "NE_PAS_COMMUNIQUER"; motif: string; pieces: Piece[] }) {
    return this.prisma.$transaction(async (tx: Tx) => {
      await this.habilite(tx, ctx);
      if (!dto.motif || !dto.motif.trim())
        throw new BadRequestException("R7 : la décision MROS — communiquer OU s'abstenir — exige un motif");
      const rc = await tx.riskCase.findFirst({ where: { id: dto.riskCaseId, tenantId: ctx.tenantId } });
      if (!rc || rc.statut !== "ESCALADEE")
        throw new BadRequestException(
          `R136 : décision MROS depuis un cas ESCALADÉ seulement — ${rc ? rc.statut : "cas introuvable"}`);
      const deja = await tx.mrosCommunication.findFirst({
        where: { tenantId: ctx.tenantId, riskCaseId: dto.riskCaseId } });
      if (deja) throw new BadRequestException(
        `R130 : une décision existe déjà pour ce cas (${deja.decision}) — le dossier est figé, jamais re-décidé`);
      const pieces = (dto.pieces ?? []).map((p) => ({ type: p.type, id: p.id, sha256: p.sha256 }));
      const dossierSha256 = sha(pieces.map((p) => `${p.type}|${p.id}|${p.sha256}`).join("\n"));
      const c = await tx.mrosCommunication.create({ data: { tenantId: ctx.tenantId,
        riskCaseId: dto.riskCaseId, clientId: dto.clientId, decision: dto.decision,
        motif: dto.motif.trim(), decidePar: ctx.userId, decideAt: new Date().toISOString(),
        pieces, dossierSha256, notification: null,
        gelActif: false, gelEcheance: null, gelSignale: false } });
      await this.emit(tx, ctx.tenantId, "mros.decision", c.id,
        { decision: dto.decision, motif: dto.motif.trim(), par: ctx.userId,
          riskCaseId: dto.riskCaseId, dossierSha256 });
      await this.audit.log(ctx.tenantId, ctx.userId, "MROS_DECISION", `${c.id}:${dto.decision}`);
      return { communicationId: c.id, dossierSha256 };
    });
  }

  // ── R130 : relecture opposable — jamais de reconstruction ──
  async relire(ctx: Ctx, communicationId: string) {
    await this.habilite(this.prisma, ctx);
    const c = await this.comm(this.prisma, ctx, communicationId);
    return { decision: c.decision, motif: c.motif, pieces: c.pieces,
      dossierSha256: c.dossierSha256, decidePar: c.decidePar, decideAt: c.decideAt };
  }

  // ── Vague 4 : le REGISTRE des communications (reporting/états) — habilité, tenant-scopé ──
  // Lecture seule des métadonnées opposables ; l'art. 10a (R132) est tenu par `habilite`.
  async lister(ctx: Ctx) {
    await this.habilite(this.prisma, ctx);
    const comms = await this.prisma.mrosCommunication.findMany({ where: { tenantId: ctx.tenantId } });
    return comms.map((c: any) => ({ id: c.id, riskCaseId: c.riskCaseId, clientId: c.clientId,
      decision: c.decision, notification: c.notification, gelActif: c.gelActif,
      dossierSha256: c.dossierSha256, decidePar: c.decidePar, decideAt: c.decideAt }));
  }

  // ── R131 : notification, gel posé/appliqué/surveillé/levé ──
  async saisirNotification(ctx: Ctx, communicationId: string,
      notification: "TRANSMISSION_AUTORITE" | "NON_TRANSMISSION") {
    return this.prisma.$transaction(async (tx: Tx) => {
      await this.habilite(tx, ctx);
      const c = await this.comm(tx, ctx, communicationId);
      await tx.mrosCommunication.update({ where: { id: c.id }, data: { notification } });
      await this.emit(tx, ctx.tenantId, "mros.notification", c.id, { notification, par: ctx.userId });
    });
  }
  async poserGel(ctx: Ctx, communicationId: string, motif: string) {
    return this.prisma.$transaction(async (tx: Tx) => {
      await this.habilite(tx, ctx);
      if (!motif || !motif.trim()) throw new BadRequestException("R7 : poser un gel exige un motif");
      const c = await this.comm(tx, ctx, communicationId);
      if (c.notification !== "TRANSMISSION_AUTORITE")
        throw new BadRequestException("R131 : le gel art. 10 suppose la notification de transmission saisie");
      const { gelJours } = await this.cfg(tx, ctx.tenantId);
      const echeance = this.joursOuvrables(new Date(), gelJours);
      await tx.mrosCommunication.update({ where: { id: c.id },
        data: { gelActif: true, gelEcheance: echeance, gelSignale: false,
          gelPosePar: ctx.userId, gelMotif: motif.trim() } });
      await this.emit(tx, ctx.tenantId, "mros.gel.pose", c.id,
        { motif: motif.trim(), echeance, par: ctx.userId });
      await this.audit.log(ctx.tenantId, ctx.userId, "MROS_FREEZE_SET", c.id);
    });
  }
  /** Le moteur TRANSACTIONS appelle : ce service constate, l'appelant bloque (pattern R110). */
  async verifierTransaction(ctx: Ctx, clientId: string) {
    const gel = await this.prisma.mrosCommunication.findFirst({
      where: { tenantId: ctx.tenantId, clientId, gelActif: true } });
    return gel
      ? { bloquant: true, motif: "Gel des avoirs art. 10 LBA actif (communication MROS)", communicationId: gel.id }
      : { bloquant: false };
  }
  async leverGel(ctx: Ctx, communicationId: string, motif: string) {
    return this.prisma.$transaction(async (tx: Tx) => {
      await this.habilite(tx, ctx);
      if (!motif || !motif.trim()) throw new BadRequestException("R7 : lever un gel exige un motif");
      const c = await this.comm(tx, ctx, communicationId);
      await tx.mrosCommunication.update({ where: { id: c.id },
        data: { gelActif: false, gelLevePar: ctx.userId, gelLeveMotif: motif.trim() } });
      await this.emit(tx, ctx.tenantId, "mros.gel.leve", c.id, { motif: motif.trim(), par: ctx.userId });
      await this.audit.log(ctx.tenantId, ctx.userId, "MROS_FREEZE_LIFTED", c.id);
    });
  }
  async tickGel(ctx: Ctx, now: Date) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const gels = await tx.mrosCommunication.findMany({
        where: { tenantId: ctx.tenantId, gelActif: true, gelSignale: false, gelEcheance: { lte: now.toISOString() } } });
      for (const c of gels) {
        await tx.mrosCommunication.update({ where: { id: c.id }, data: { gelSignale: true } });
        await this.emit(tx, ctx.tenantId, "mros.gel.echeance", c.id, { echeance: c.gelEcheance });
        // Le gel RESTE actif : le système mesure et notifie, la levée est humaine (R39/R131).
      }
    });
  }

  // ── R132 : default-deny — l'accès ET le refus se tracent ──
  async lire(ctx: Ctx, communicationId: string) {
    const c = await this.comm(this.prisma, ctx, communicationId);
    const { roles } = await this.cfg(this.prisma, ctx.tenantId);
    if (!roles.includes(ctx.role)) {
      await this.emit(this.prisma, ctx.tenantId, "mros.acces.refuse", c.id,
        { par: ctx.userId, role: ctx.role });
      throw new ForbiddenException(`R132 : rôle ${ctx.role} non habilité MROS (art. 10a — interdiction d'informer)`);
    }
    await this.emit(this.prisma, ctx.tenantId, "mros.acces", c.id, { par: ctx.userId });
    return { decision: c.decision, motif: c.motif, pieces: c.pieces, dossierSha256: c.dossierSha256,
      notification: c.notification, gelActif: c.gelActif };
  }
}
