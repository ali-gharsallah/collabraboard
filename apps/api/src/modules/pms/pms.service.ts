import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";

/**
 * PMS — mandats & adéquation. R105→R108 (PF-01..06). Écrit APRÈS l'amendement, APRÈS les tests.
 * Invariants tenus : l'écart se constate (jamais de rééquilibrage auto, R105/R44) ;
 * les restrictions du mandat bloquent en pre-trade (R106, blocage réglementaire type R13) ;
 * le profil de risque CLIENT (golden record R104) borne le mandat, l'humain décide (R107) ;
 * les breaches vivent dans un registre append-only, l'échéance alerte sans liquider (R108/R39).
 * Paramètres tenant (R-Q) : pmsDriftToleranceBp (200) · pmsBreachDelaiJours (30).
 */

type Ctx = { tenantId: string; userId: string; role: string };
const NIVEAU: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };

@Injectable()
export class PmsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private emit(tx: any, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload } });
  }
  private async params(tx: any, tenantId: string) {
    const t = await tx.tenant.findFirst({ where: { id: tenantId } });
    const s = (t?.settings as any) ?? {};
    return { driftBp: s.pmsDriftToleranceBp ?? 200, breachJours: s.pmsBreachDelaiJours ?? 30 };
  }
  private async mandat(tx: any, ctx: Ctx, mandateId: string) {
    const m = await tx.mandate.findFirst({ where: { id: mandateId, tenantId: ctx.tenantId } });
    if (!m) throw new NotFoundException("Mandat introuvable");
    return m;
  }

  // ── R105 / PF-01 : valorisation → drift constaté, tracé, jamais corrigé ──
  async valoriser(ctx: Ctx, mandateId: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const m = await this.mandat(tx, ctx, mandateId);
      const cfg = await this.params(tx, ctx.tenantId);
      const pos = await tx.position.findMany({ where: { tenantId: ctx.tenantId, mandateId } });
      const total = pos.reduce((a: number, p: any) => a + p.valeurChf, 0);
      const parClasse: Record<string, number> = {};
      for (const p of pos) parClasse[p.classe] = (parClasse[p.classe] ?? 0) + p.valeurChf;
      const drifts: any[] = [];
      for (const [classe, [min, max]] of Object.entries((m.strategie?.bornes ?? {}) as Record<string, [number, number]>)) {
        const reelPct = total ? Math.round((parClasse[classe] ?? 0) / total * 100) : 0;
        const ecartBp = Math.max((min - reelPct) * 100, (reelPct - max) * 100, 0);
        if (ecartBp > cfg.driftBp) {
          drifts.push({ classe, reelPct, borne: [min, max], ecartBp });
          await this.emit(tx, ctx.tenantId, "pms.drift.detecte", m.id, { classe, reelPct, borne: [min, max], ecartBp });
          await this.emit(tx, ctx.tenantId, "tache.pms.regularisation", m.id, { classe, gerant: ctx.userId });
          await tx.pmsBreach.create({ data: { tenantId: ctx.tenantId, mandateId: m.id, type: "DRIFT",
            detail: `${classe} ${reelPct}% hors [${min}-${max}]`, statut: "OUVERT",
            detecteAt: new Date().toISOString(), escaladeEmise: false } });                 // R108
        }
      }
      await this.audit.log(ctx.tenantId, ctx.userId, "PMS_VALUATION", `${m.id}:${drifts.length} drift(s)`);
      return { totalChf: total, allocation: parClasse, drifts };                            // positions INTACTES
    });
  }

  // ── R106 / PF-02..03 : pre-trade — exclusions + concentration, blocage motivé ──
  async preTrade(ctx: Ctx, mandateId: string, ordre: { instrument: string; secteur: string; classe: string; montantChf: number }) {
    return this.prisma.$transaction(async (tx: any) => {
      const m = await this.mandat(tx, ctx, mandateId);
      const strat = m.strategie ?? {};
      const bloque = async (motif: string) => {
        await this.emit(tx, ctx.tenantId, "pms.pretrade.bloque", m.id,
          { instrument: ordre.instrument, motif, mandat: m.nom });
        await this.audit.log(ctx.tenantId, ctx.userId, "PMS_PRETRADE_BLOCK", `${m.id}:${ordre.instrument}`);
        return { verdict: "BLOQUE" as const, motif };
      };
      if ((strat.exclusions ?? []).includes(ordre.secteur))
        return bloque(`exclusion mandat : ${ordre.secteur}`);                               // PF-02
      const pos = await tx.position.findMany({ where: { tenantId: ctx.tenantId, mandateId } });
      const total = pos.reduce((a: number, p: any) => a + p.valeurChf, 0);
      const existant = pos.filter((p: any) => p.instrument === ordre.instrument)
        .reduce((a: number, p: any) => a + p.valeurChf, 0);
      const resultantePct = Math.round((existant + ordre.montantChf) / (total + ordre.montantChf) * 100);
      const plafond = strat.maxPositionPct ?? 100;
      if (resultantePct > plafond)
        return bloque(`concentration : position résultante ${resultantePct}% > plafond ${plafond}%`); // PF-03
      await this.emit(tx, ctx.tenantId, "pms.pretrade.ok", m.id,
        { instrument: ordre.instrument, resultantePct });                                   // le passage se prouve
      return { verdict: "OK" as const, resultantePct };
    });
  }

  // ── R107 / PF-04 : le riskLevel CLIENT (golden record) borne le mandat — l'humain décide ──
  async verifierAdequation(ctx: Ctx, clientId: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const c = await tx.client.findFirst({ where: { id: clientId, tenantId: ctx.tenantId } });
      if (!c) throw new NotFoundException("Client introuvable");
      const mandats = await tx.mandate.findMany({ where: { tenantId: ctx.tenantId, clientId, statut: "ACTIF" } });
      const alertes: any[] = [];
      for (const m of mandats) {
        if (NIVEAU[c.riskLevel] < NIVEAU[m.profilRequis]) {
          alertes.push(m.id);
          await this.emit(tx, ctx.tenantId, "pms.suitability.alerte", m.id,
            { client: clientId, riskLevel: c.riskLevel, profilRequis: m.profilRequis });
          await this.emit(tx, ctx.tenantId, "tache.pms.revue_mandat", m.id, { client: clientId });
          // Le mandat n'est JAMAIS rétrogradé ici — décision humaine tracée requise.
        }
      }
      return { alertes };
    });
  }

  // ── R107 / PF-05 : adéquation à la souscription ──
  async attacherMandat(ctx: Ctx, clientId: string, dto: { nom: string; profilRequis: string; strategie: any }) {
    return this.prisma.$transaction(async (tx: any) => {
      const c = await tx.client.findFirst({ where: { id: clientId, tenantId: ctx.tenantId } });
      if (!c) throw new NotFoundException("Client introuvable");
      if (NIVEAU[c.riskLevel] < NIVEAU[dto.profilRequis])
        throw new ForbiddenException(
          `inadéquation LSFin : profil client ${c.riskLevel} < profil requis ${dto.profilRequis}`);
      const m = await tx.mandate.create({ data: { tenantId: ctx.tenantId, clientId,
        nom: dto.nom, profilRequis: dto.profilRequis, strategie: dto.strategie, statut: "ACTIF" } });
      await this.emit(tx, ctx.tenantId, "pms.mandat.attache", m.id, { client: clientId, nom: dto.nom });
      return m;
    });
  }

  // ── R108 / PF-06 : registre — escalade UNE fois au délai, clôture motivée ──
  async tickBreaches(ctx: Ctx, now: Date) {
    return this.prisma.$transaction(async (tx: any) => {
      const cfg = await this.params(tx, ctx.tenantId);
      const ouverts = await tx.pmsBreach.findMany({ where: {
        tenantId: ctx.tenantId, statut: "OUVERT", escaladeEmise: false } });
      for (const b of ouverts) {
        const jours = (now.getTime() - new Date(b.detecteAt).getTime()) / 86400000;
        if (jours < cfg.breachJours) continue;
        await tx.pmsBreach.update({ where: { id: b.id }, data: { escaladeEmise: true } });
        await this.emit(tx, ctx.tenantId, "pms.breach.escalade", b.id,
          { mandat: b.mandateId, detail: b.detail, destinataire: "responsable_mandats" });
        // Le breach reste OUVERT : le système alerte, il ne liquide pas (R39).
      }
    });
  }
  async cloreBreach(ctx: Ctx, breachId: string, motif: string) {
    if (!motif || !motif.trim()) throw new BadRequestException("R7 : la clôture d'un breach exige un motif");
    return this.prisma.$transaction(async (tx: any) => {
      const b = await tx.pmsBreach.findFirst({ where: { id: breachId, tenantId: ctx.tenantId } });
      if (!b) throw new NotFoundException("Breach introuvable");
      await tx.pmsBreach.update({ where: { id: b.id },
        data: { statut: "CLOS", clotureMotif: motif.trim(), cloturePar: ctx.userId, clotureAt: new Date().toISOString() } });
      await this.emit(tx, ctx.tenantId, "pms.breach.clos", b.id, { par: ctx.userId, motif: motif.trim() });
      await this.audit.log(ctx.tenantId, ctx.userId, "PMS_BREACH_CLOSED", b.id);
      return { statut: "CLOS" };
    });
  }
}
