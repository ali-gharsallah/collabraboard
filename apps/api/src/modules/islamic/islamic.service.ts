import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
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

  private emit(tx: any, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload, at: new Date().toISOString() } });
  }
  private async params(tx: any, ctx: Ctx) {
    const t = await tx.tenant.findFirst({ where: { id: ctx.tenantId } });
    if (!t) throw new NotFoundException("Tenant introuvable");
    return paramsIslamicDepuisSettings(t.settings);
  }

  // ── Évaluation Shariah : moteur → signaux persistés → état de blocage ──
  async evaluer(ctx: Ctx, dto: ContexteIslamic & { clientId: string }) {
    if (!dto || !dto.clientId) throw new NotFoundException("clientId requis");
    return this.prisma.$transaction(async (tx: any) => {
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
    await this.prisma.$transaction(async (tx: any) => {
      await this.emit(tx, ctx.tenantId, type, aggregateId, payload);
    });
    await this.audit.log(ctx.tenantId, ctx.userId, type.toUpperCase().replace(/\./g, "_"), aggregateId);
  }

  async zakat(ctx: Ctx, dto: { clientId: string; patrimoineChf: number }) {
    const t = await this.prisma.tenant.findFirst({ where: { id: ctx.tenantId } });
    const rapport = calculerZakat(dto.patrimoineChf, paramsIslamicDepuisSettings(t?.settings));
    await this.ledger(ctx, "islamic.zakat.calcule", dto.clientId, { ...rapport, par: ctx.userId });
    return rapport;
  }

  async mudaraba(ctx: Ctx, dto: { clientId: string; profitChf: number; bankSharePct: number; clientSharePct: number }) {
    const rapport = distribuerMudaraba(dto.profitChf, dto.bankSharePct, dto.clientSharePct);
    await this.ledger(ctx, "islamic.mudaraba.distribue", dto.clientId, { ...rapport, par: ctx.userId });
    return rapport;
  }

  async waqfRetrait(ctx: Ctx, dto: { waqfId: string; incomeChf: number; retraitChf: number }) {
    const rapport = validerRetraitWaqf(dto.incomeChf, dto.retraitChf);
    if (!rapport.autorise) throw new BadRequestException(rapport.motif);
    await this.ledger(ctx, "islamic.waqf.distribue", dto.waqfId, { ...rapport, par: ctx.userId });
    return rapport;
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
