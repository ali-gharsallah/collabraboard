import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { emitEvent } from "../../common/domain-event";
import { Tx } from "../../common/tx";
import {
  ContexteIslamic, evaluerIslamic, paramsIslamicDepuisSettings,
  calculerZakat, suiviQard, distribuerMudaraba, auditShariah, validerRetraitWaqf,
  suiviTakaful, alerteSukukMaturite,
} from "./islamic-screening.engine";

/**
 * IslamicService — câblage de la couche Shariah (R207→R221, IS-01..IS-15). Écrit depuis le
 * Gherkin (Bloc 49, exception ratifiée). Le service ORCHESTRE : il charge les seuils tenant
 * (registre R-Q), passe au moteur pur, PERSISTE les signaux (append-only, tenant-scopé, RLS)
 * et rend l'état de blocage. Les calculateurs (Zakat, Mudaraba, Waqf, Qard, Takaful, Sukuk)
 * ne lèvent pas de signal : ils calculent et émettent un événement ledger (audit trail).
 * L'auteur est TOUJOURS le jeton (ctx.userId), jamais le corps. Un seul blocage automatique :
 * la spéculation maysir (R209). L'entité caritative sous sanction (R216) va en revue humaine,
 * jamais en auto-blocage.
 */

type Ctx = { tenantId: string; userId: string; role: string };

@Injectable()
export class IslamicService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return emitEvent(tx, tenantId, type, aggregateId, payload);
  }
  private async params(tx: Tx, ctx: Ctx) {
    const t = await tx.tenant.findFirst({ where: { id: ctx.tenantId } });
    if (!t) throw new NotFoundException("Tenant introuvable");
    return paramsIslamicDepuisSettings(t.settings);
  }

  // ── Évaluation Shariah : moteur → signaux persistés → état de blocage ──
  async evaluer(ctx: Ctx, dto: ContexteIslamic & { clientId: string }) {
    if (!dto || !dto.clientId) throw new NotFoundException("clientId requis");
    return this.prisma.$transaction(async (tx: Tx) => {
      const params = await this.params(tx, ctx);
      const signaux = evaluerIslamic({ ...dto }, params);
      const persistes: any[] = [];
      for (const s of signaux) {
        const row = await tx.islamicSignal.create({ data: {
          tenantId: ctx.tenantId, clientId: dto.clientId,
          type: s.type, regle: s.regle, niveau: s.niveau, note: s.note, motif: s.motif,
          bloquant: s.bloquant, revueManuelle: !!s.revueManuelle, emisPar: ctx.userId, at: new Date().toISOString() } });
        await this.emit(tx, ctx.tenantId, "islamic.signal.leve", row.id,
          { clientId: dto.clientId, type: s.type, regle: s.regle, niveau: s.niveau, bloquant: s.bloquant });
        persistes.push(row);
      }
      const bloque = signaux.some((s) => s.bloquant);
      if (bloque) await this.emit(tx, ctx.tenantId, "islamic.operation.bloquee", dto.clientId,
        { regles: signaux.filter((s) => s.bloquant).map((s) => s.regle) });
      await this.audit.log(ctx.tenantId, ctx.userId, "ISLAMIC_EVALUATED", `${dto.clientId}:${signaux.length}`);
      return { clientId: dto.clientId, bloque,
        revueManuelle: signaux.some((s) => s.revueManuelle), signaux: persistes };
    });
  }

  async signaux(ctx: Ctx, clientId: string) {
    const rows = await this.prisma.islamicSignal.findMany({ where: { tenantId: ctx.tenantId, clientId } });
    return rows.slice().sort((a: any, b: any) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }

  // ── Calculateurs (non-signaux) : calcul + événement ledger, aucun IslamicSignal ──
  private async ledger(ctx: Ctx, type: string, aggregateId: string, payload: any) {
    await this.prisma.$transaction(async (tx: Tx) => {
      await this.emit(tx, ctx.tenantId, type, aggregateId, payload);
    });
    await this.audit.log(ctx.tenantId, ctx.userId, type.toUpperCase().replace(/\./g, "_"), aggregateId);
  }

  // Bloc 49b (augmentation additive) : les calculateurs Zakat/Mudaraba/Waqf PERSISTENT
  // désormais leur trace (append-only, tenant-scopé, RLS) pour l'audit AAOIFI — l'auteur
  // reste le jeton, jamais le corps.
  async zakat(ctx: Ctx, dto: { clientId: string; patrimoineChf: number; annee?: number }) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const t = await tx.tenant.findFirst({ where: { id: ctx.tenantId } });
      const rapport = calculerZakat(dto.patrimoineChf, paramsIslamicDepuisSettings(t?.settings));
      const annee = dto.annee ?? new Date().getUTCFullYear();
      const row = await tx.zakatCalculation.create({ data: {
        tenantId: ctx.tenantId, clientId: dto.clientId, annee,
        totalWealth: rapport.totalWealth, nisab: rapport.nisab, zakatDue: rapport.zakatDue,
        statut: rapport.status, emisPar: ctx.userId, at: new Date().toISOString() } });
      await this.emit(tx, ctx.tenantId, "islamic.zakat.calcule", row.id, { clientId: dto.clientId, ...rapport, par: ctx.userId });
      return { ...rapport, id: row.id, annee };
    });
  }

  async zakatHistorique(ctx: Ctx, clientId: string) {
    const rows = await this.prisma.zakatCalculation.findMany({ where: { tenantId: ctx.tenantId, clientId } });
    return rows.slice().sort((a: any, b: any) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }

  async mudaraba(ctx: Ctx, dto: { clientId: string; profitChf: number; bankSharePct: number; clientSharePct: number }) {
    const rapport = distribuerMudaraba(dto.profitChf, dto.bankSharePct, dto.clientSharePct);
    return this.prisma.$transaction(async (tx: Tx) => {
      const row = await tx.mudarabaDistribution.create({ data: {
        tenantId: ctx.tenantId, clientId: dto.clientId, profitChf: rapport.profit,
        bankShare: rapport.bankShare, clientShare: rapport.clientShare, statut: rapport.status,
        emisPar: ctx.userId, at: new Date().toISOString() } });
      await this.emit(tx, ctx.tenantId, "islamic.mudaraba.distribue", row.id, { clientId: dto.clientId, ...rapport, par: ctx.userId });
      return { ...rapport, id: row.id };
    });
  }

  async waqfRetrait(ctx: Ctx, dto: { waqfId: string; incomeChf: number; retraitChf: number }) {
    const rapport = validerRetraitWaqf(dto.incomeChf, dto.retraitChf);
    if (!rapport.autorise) throw new BadRequestException(rapport.motif);
    return this.prisma.$transaction(async (tx: Tx) => {
      const row = await tx.waqfDistribution.create({ data: {
        tenantId: ctx.tenantId, waqfId: dto.waqfId, montantChf: rapport.retrait,
        incomeChf: rapport.income, source: rapport.source, emisPar: ctx.userId, at: new Date().toISOString() } });
      await this.emit(tx, ctx.tenantId, "islamic.waqf.distribue", row.id, { waqfId: dto.waqfId, ...rapport, par: ctx.userId });
      return { ...rapport, id: row.id };
    });
  }

  async qard(ctx: Ctx, dto: { clientId: string; principalChf: number }) {
    const rapport = suiviQard(dto.principalChf);
    await this.ledger(ctx, "islamic.qard.suivi", dto.clientId, { ...rapport, par: ctx.userId });
    return rapport;
  }

  async takaful(ctx: Ctx, dto: { clientId: string; premiumChf: number }) {
    const rapport = suiviTakaful(dto.premiumChf);
    await this.ledger(ctx, "islamic.takaful.suivi", dto.clientId, { ...rapport, par: ctx.userId });
    return rapport;
  }

  async sukukMaturite(ctx: Ctx, dto: { clientId: string; joursAvantMaturite: number }) {
    const rapport = alerteSukukMaturite(dto.joursAvantMaturite);
    if (rapport.alerte) await this.ledger(ctx, "islamic.sukuk.maturite", dto.clientId, { ...rapport, par: ctx.userId });
    return rapport;
  }

  async audit_(ctx: Ctx, dto: { clientsIslamic: number; transactions: number; violations: number; zakatDistribueChf: number }) {
    const rapport = auditShariah(dto);
    await this.ledger(ctx, "islamic.audit.shariah", ctx.tenantId, { ...rapport, par: ctx.userId });
    return rapport;
  }
}
