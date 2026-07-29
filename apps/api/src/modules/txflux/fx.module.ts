import { Controller, Get, Module, Req, Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { loadSettings } from "../../common/tenant-settings";
import { Tx } from "../../common/tx";

/**
 * R299 [canon R296] — FX EST UNE LECTURE D'EXPOSITION (dégel V1, TF-07/08).
 * Positions par devise agrégées du flux R297 (+ soldes du port core quand il existe).
 * Le taux vient d'un PORT FX dédié — pas de port = PAS de conversion : les montants
 * restent en devise d'origine AVEC MENTION, jamais un taux inventé (R167). Les seuils
 * d'exposition (`fx_seuils_exposition`, par devise) NOTIFIENT (événement fx.seuil.franchi,
 * R39) — rien n'est jamais bloqué. AUCUNE opération de change, AUCUN ordre : lecture et
 * alerte, structurellement (aucune route d'écriture dans ce module).
 */

type Ctx = { tenantId: string; userId: string; role: string };
export type FxPort = { source: string; taux(devise: string, en: string): Promise<number> };

@Injectable()
export class FxService {
  constructor(private prisma: PrismaService, private ports: { fx?: FxPort } = {}) {}

  async exposition(ctx: Ctx) {
    const txs = await this.prisma.transaction.findMany({ where: { tenantId: ctx.tenantId } });
    const s = await loadSettings(this.prisma, ctx.tenantId);
    const seuils: Record<string, number> = s.fx_seuils_exposition ?? {};
    const parDevise: Record<string, { entrees: number; sorties: number; exposition: number;
      enChf: number | null; seuilFranchi: boolean }> = {};
    for (const t of txs) {
      const d = parDevise[t.devise] = parDevise[t.devise]
        ?? { entrees: 0, sorties: 0, exposition: 0, enChf: null, seuilFranchi: false };
      if (t.sens === "CREDIT") d.entrees += Number(t.montant); else d.sorties += Number(t.montant);
    }
    for (const [devise, d] of Object.entries(parDevise)) {
      d.exposition = Math.max(d.entrees, d.sorties);                        // le flanc le plus large — une mesure, pas un jugement
      if (this.ports.fx && devise !== "CHF")
        d.enChf = Math.round(d.exposition * (await this.ports.fx.taux(devise, "CHF")));
      const seuil = seuils[devise];
      if (typeof seuil === "number" && d.exposition > seuil) {
        d.seuilFranchi = true;                                               // notifié — JAMAIS bloqué (R39)
        await this.prisma.$transaction((tx: Tx) => tx.domainEvent.create({ data: {
          tenantId: ctx.tenantId, type: "fx.seuil.franchi", aggregateId: devise,
          payload: { devise, exposition: d.exposition, seuil, par: ctx.userId },
          at: new Date().toISOString() } }));
      }
    }
    return { parDevise,
      conversion: this.ports.fx ? `taux servis par ${this.ports.fx.source}`
        : "aucun port FX configuré — montants en devise d'origine, jamais un taux inventé (R167)" };
  }
}

@Controller("fx")
export class FxController {
  constructor(private svc: FxService) {}
  @Get("exposition") exposition(@Req() r: any) { return this.svc.exposition(r.ctx); }   // TF-07/08 — lecture seule
}

@Module({
  controllers: [FxController],
  providers: [{ provide: FxService, useFactory: (p: PrismaService) => new FxService(p, {}), inject: [PrismaService] }],
})
export class FxModule {}
