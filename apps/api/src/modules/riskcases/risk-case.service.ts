import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { emitEvent } from "../../common/domain-event";
import { Tx } from "../../common/tx";

/**
 * Risk cases — l'instruction AML. R133→R136 (RK-01..06). Écrit APRÈS l'amendement, APRÈS les tests.
 * Invariants tenus : un cas naît d'au moins un signal, états fermés, terminaux motivés (R133/R7) ;
 * notes append-only STRUCTUREL — aucune API d'édition n'existe (R134/R48/R49) ; un signal ne vit
 * que dans UN cas actif, détachement motivé, SLA R-Q qui alerte une fois sans clore (R135/R39) ;
 * l'escalade arme la décision MROS et la clôture est refusée tant qu'une communication est
 * active (R136 — la limite du bloc 22 est fermée côté MrosService).
 * Paramètre R-Q (au registre — R125) : riskCaseSlaJours { NOUVELLE: 2, EN_ANALYSE: 15, CLARIFICATION: 10 }.
 */

type Ctx = { tenantId: string; userId: string; role: string };
const TRANSITIONS: Record<string, string[]> = {
  NOUVELLE: ["EN_ANALYSE"],
  EN_ANALYSE: ["CLARIFICATION", "CLOTUREE", "ESCALADEE"],
  CLARIFICATION: ["EN_ANALYSE"],
  CLOTUREE: [], ESCALADEE: ["CLOTUREE"],   // la clôture POST-escalade existe — gardée par R136
};
const TERMINAUX_MOTIVES = ["CLOTUREE", "ESCALADEE"];
const ACTIFS = ["NOUVELLE", "EN_ANALYSE", "CLARIFICATION"];
const SLA_DEFAUT: Record<string, number> = { NOUVELLE: 2, EN_ANALYSE: 15, CLARIFICATION: 10 };

@Injectable()
export class RiskCaseService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return emitEvent(tx, tenantId, type, aggregateId, payload);
  }
  private async cas(tx: Tx, ctx: Ctx, id: string) {
    const c = await tx.riskCase.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!c) throw new NotFoundException("Risk case introuvable");
    return c;
  }
  private async signalLibre(tx: Tx, ctx: Ctx, signalId: string) {
    const actifs = await tx.riskCase.findMany({ where: { tenantId: ctx.tenantId, statut: { in: ACTIFS } } });
    const occupant = actifs.find((c: any) => (c.signalIds ?? []).includes(signalId));
    if (occupant) throw new BadRequestException(
      `R135 : signal ${signalId} déjà instruit dans le cas ${occupant.id} — un signal, un cas actif`);
  }

  // ── R133 : ouverture — jamais un cas vide ──
  async ouvrir(ctx: Ctx, dto: { clientId: string; signalIds: string[] }) {
    if (!dto.signalIds || dto.signalIds.length === 0)
      throw new BadRequestException("R133 : un risk case naît d'au moins un signal");
    return this.prisma.$transaction(async (tx: Tx) => {
      for (const s of dto.signalIds) await this.signalLibre(tx, ctx, s);
      const c = await tx.riskCase.create({ data: { tenantId: ctx.tenantId, clientId: dto.clientId,
        statut: "NOUVELLE", etatDepuis: new Date().toISOString(), slaSignale: false,
        signalIds: dto.signalIds, ouvertPar: ctx.userId } });
      await this.emit(tx, ctx.tenantId, "riskcase.ouvert", c.id,
        { signaux: dto.signalIds, par: ctx.userId });
      await this.audit.log(ctx.tenantId, ctx.userId, "RISKCASE_OPENED", c.id);
      return { caseId: c.id };
    });
  }

  // ── Lecture : la file des dossiers de risque (Vague 1, écran « File d'alertes »), tenant-scopée ──
  async liste(ctx: Ctx, statut?: string) {
    const cases = await this.prisma.riskCase.findMany({
      where: { tenantId: ctx.tenantId, ...(statut ? { statut } : {}) } });
    return cases.slice().sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // ── R133/R136 : transitions — fermées, terminaux motivés, clôture cohérente avec le MROS ──
  async transitionner(ctx: Ctx, caseId: string, vers: string, motif?: string) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const c = await this.cas(tx, ctx, caseId);
      if (!(TRANSITIONS[c.statut] ?? []).includes(vers))
        throw new BadRequestException(`Transition illégale : ${c.statut} → ${vers}`);
      if (TERMINAUX_MOTIVES.includes(vers) && !(motif && motif.trim()))
        throw new BadRequestException(`R7 : la transition vers ${vers} exige un motif`);
      if (vers === "CLOTUREE") {                                  // R136 — cohérence du dossier
        const comm = await tx.mrosCommunication.findFirst({
          where: { tenantId: ctx.tenantId, riskCaseId: c.id } });
        const active = comm && (comm.gelActif || (comm.decision === "COMMUNIQUER" && !comm.notification));
        if (active)
          throw new BadRequestException(
            "R136 : clôture refusée — une communication MROS est active sur ce cas");
      }
      await tx.riskCase.update({ where: { id: c.id }, data: { statut: vers,
        etatDepuis: new Date().toISOString(), slaSignale: false,
        ...(TERMINAUX_MOTIVES.includes(vers) ? { motifTerminal: motif!.trim(), terminePar: ctx.userId } : {}) } });
      await this.emit(tx, ctx.tenantId, "riskcase.transition", c.id,
        { de: c.statut, vers, par: ctx.userId, ...(motif ? { motif: motif.trim() } : {}) });
      await this.audit.log(ctx.tenantId, ctx.userId, "RISKCASE_TRANSITION", `${c.id}:${c.statut}->${vers}`);
      return { statut: vers };
    });
  }

  // ── R134 : l'instruction append-only — AUCUNE API d'édition n'existe, à dessein ──
  async noter(ctx: Ctx, caseId: string, texte: string) {
    if (!texte || !texte.trim()) throw new BadRequestException("Note vide");
    return this.prisma.$transaction(async (tx: Tx) => {
      const c = await this.cas(tx, ctx, caseId);
      const n = await tx.riskCaseNote.create({ data: { tenantId: ctx.tenantId, caseId: c.id,
        texte: texte.trim(), par: ctx.userId, at: new Date().toISOString() } });
      await this.emit(tx, ctx.tenantId, "riskcase.note", c.id, { noteId: n.id, par: ctx.userId });
      return n;
    });
  }
  async notes(ctx: Ctx, caseId: string) {
    await this.cas(this.prisma, ctx, caseId);
    const ns = await this.prisma.riskCaseNote.findMany({ where: { tenantId: ctx.tenantId, caseId } });
    return ns.slice().sort((a: any, b: any) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }

  // ── R135 : rattacher / détacher — un signal, un cas actif. AW-05 (canon vague pilote, ratifié) :
  //    rattacher un signal DÉJÀ dans CE cas est IDEMPOTENT — un seul lien, second appel sans effet
  //    ni erreur (pattern R76) ; dans un AUTRE cas actif, le refus R135 tient. ──
  async rattacher(ctx: Ctx, caseId: string, signalId: string) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const c = await this.cas(tx, ctx, caseId);
      if (!ACTIFS.includes(c.statut)) throw new BadRequestException("Cas non actif");
      if (((c.signalIds as any[]) ?? []).includes(signalId)) return { caseId: c.id, signalId, dejaRattache: true }; // AW-05
      await this.signalLibre(tx, ctx, signalId);
      await tx.riskCase.update({ where: { id: c.id }, data: { signalIds: [...(c.signalIds as any[]), signalId] } });
      await this.emit(tx, ctx.tenantId, "riskcase.signal.rattache", c.id, { signalId, par: ctx.userId });
    });
  }
  async detacher(ctx: Ctx, caseId: string, signalId: string, motif: string) {
    if (!motif || !motif.trim()) throw new BadRequestException("R7 : détacher un signal exige un motif");
    return this.prisma.$transaction(async (tx: Tx) => {
      const c = await this.cas(tx, ctx, caseId);
      if (!((c.signalIds as any[]) ?? []).includes(signalId)) throw new NotFoundException("Signal non rattaché à ce cas");
      await tx.riskCase.update({ where: { id: c.id },
        data: { signalIds: (c.signalIds as any[]).filter((s: string) => s !== signalId) } });
      await this.emit(tx, ctx.tenantId, "riskcase.signal.detache", c.id,
        { signalId, motif: motif.trim(), par: ctx.userId });
    });
  }

  // ── R135 : le SLA alerte une fois — l'instruction reste humaine ──
  async tickSla(ctx: Ctx, now: Date) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const t = await tx.tenant.findFirst({ where: { id: ctx.tenantId } });
      const sla = { ...SLA_DEFAUT, ...((t?.settings as any)?.riskCaseSlaJours ?? {}) };
      const actifs = await tx.riskCase.findMany({ where: { tenantId: ctx.tenantId,
        statut: { in: ACTIFS }, slaSignale: false } });
      for (const c of actifs) {
        const jours = (now.getTime() - new Date(c.etatDepuis).getTime()) / 86400000;
        if (jours < (sla[c.statut] ?? Infinity)) continue;
        await tx.riskCase.update({ where: { id: c.id }, data: { slaSignale: true } });
        await this.emit(tx, ctx.tenantId, "riskcase.sla.alerte", c.id,
          { statut: c.statut, jours: Math.floor(jours), sla: sla[c.statut] });
        await this.emit(tx, ctx.tenantId, "tache.riskcase.relance", c.id, { statut: c.statut });
        // L'état ne bouge pas : jamais d'auto-clôture (R39).
      }
    });
  }
}
