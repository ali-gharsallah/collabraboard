import { Controller, Get, Module, Post, Query, Req, Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { CpsiService } from "../cpsi/cpsi.module";
import { CpsiModule } from "../cpsi/cpsi.module";

/**
 * R298 [canon R295] — TXRISK EST UNE SURFACE DU MOTEUR CPSI (dégel V1, TF-04..06).
 * Ce module ne DÉCIDE rien : il AGRÈGE le journal R297 en attributs transactionnels du
 * registre R79 (tx_par_mois, volume_tx_mensuel_chf, rapidite_in_out, ratio_cross_border —
 * leurs formules françaises vivent au catalogue) et les pousse AU moteur (événement
 * cpsi.client.registered). L'évaluation vit au CATALOGUE CPSI (scénarios R73/R79/R80,
 * voie normale R69/R70) — un pattern manquant est un scénario à ajouter là-bas, jamais
 * du code ici. Les tendances sont une VOLUMÉTRIE rejouée à date du journal (R48). Le
 * live descend par SSE (R287) — références seules.
 */

type Ctx = { tenantId: string; userId: string; role: string };
const JOUR_MS = 86400000;

// Agrégats PURS du journal — des mesures, jamais des verdicts.
export function agregatsTransactionnels(txs: { dateValeur: string; montant: any; devise: string;
  sens: string; contrepartiePays: string | null }[], nowIso: string) {
  const now = new Date(nowIso).getTime();
  const recentes = txs.filter((t) => now - new Date(t.dateValeur).getTime() < 30 * JOUR_MS);
  const somme = (l: typeof txs) => l.reduce((s, t) => s + Number(t.montant), 0);
  const credits = txs.filter((t) => t.sens === "CREDIT");
  const debits = txs.filter((t) => t.sens === "DEBIT");
  // Vélocité in/out (formule R79 : indice de pass-through) : part des entrées ressortie sous 3 jours
  let ressorti = 0;
  for (const c of credits) {
    const tC = new Date(c.dateValeur).getTime();
    const sortiesProches = debits.filter((d) => {
      const dt = new Date(d.dateValeur).getTime() - tC;
      return dt > -1 && dt < 3 * JOUR_MS;
    });
    ressorti += Math.min(Number(c.montant), somme(sortiesProches));
  }
  const totalIn = somme(credits);
  const horsCH = txs.filter((t) => t.contrepartiePays !== null && t.contrepartiePays !== "CH");
  return {
    tx_par_mois: recentes.length,
    volume_tx_mensuel_chf: somme(recentes.filter((t) => t.devise === "CHF")),
    rapidite_in_out: totalIn === 0 ? 0 : Math.round(Math.min(100, (ressorti / totalIn) * 100)),
    ratio_cross_border: txs.length === 0 ? 0 : horsCH.length / txs.length,
  };
}

@Injectable()
export class TxRiskService {
  constructor(private prisma: PrismaService, private audit: AuditService, private cpsi: CpsiService) {}

  // ── TF-04 : ALIMENTER le moteur — les attributs partent, aucune conclusion ne se prend ici. ──
  async alimenter(ctx: Ctx) {
    const txs = await this.prisma.transaction.findMany({
      where: { tenantId: ctx.tenantId, clientId: { not: null } } });
    const parClient = new Map<string, typeof txs>();
    for (const t of txs) parClient.set(t.clientId!, [...(parClient.get(t.clientId!) ?? []), t]);
    const now = new Date().toISOString();
    let clients = 0, dejaEnregistres = 0;
    for (const [clientId, liste] of parClient) {
      const fiche = await this.prisma.client.findFirst({ where: { id: clientId, tenantId: ctx.tenantId } });
      const attributs = agregatsTransactionnels(liste as any, now);
      try {
        await this.cpsi.enregistrerClient(ctx, { clientId, at: now,
          statique: { countryCode: fiche?.country ?? "CH", type: (fiche?.structure ?? "pp").toLowerCase() },
          attributs });
        clients++;
      } catch { dejaEnregistres++; }        // déjà au moteur : le rafraîchissement d'attributs est une extension consignée
    }
    await this.audit.log(ctx.tenantId, ctx.userId, "TXRISK_ALIMENTE", `${clients}+${dejaEnregistres}`);
    return { clients, dejaEnregistres };    // des comptes de flux — jamais un jugement
  }

  // ── TF-06 : tendances = volumétrie PAR REJEU À DATE du journal (R48). ──
  async tendances(ctx: Ctx, asOf?: string) {
    const borne = (asOf ?? new Date().toISOString()).slice(0, 10);
    const txs = await this.prisma.transaction.findMany({ where: { tenantId: ctx.tenantId } });
    const jouees = txs.filter((t) => t.dateValeur.slice(0, 10) <= borne);   // la date fait foi — rejouable
    const parMois: Record<string, { n: number; volume: number }> = {};
    for (const t of jouees) {
      const mois = t.dateValeur.slice(0, 7);
      parMois[mois] = parMois[mois] ?? { n: 0, volume: 0 };
      parMois[mois].n++;
      parMois[mois].volume += Number(t.montant);
    }
    return { asOf: borne, parMois };
  }
}

@Controller("txrisk")
export class TxRiskController {
  constructor(private svc: TxRiskService) {}
  @Post("alimenter") alimenter(@Req() r: any) { return this.svc.alimenter(r.ctx); }                                  // TF-04
  @Get("tendances")  tendances(@Req() r: any, @Query("asOf") asOf?: string) { return this.svc.tendances(r.ctx, asOf); } // TF-06
}

@Module({ imports: [CpsiModule], controllers: [TxRiskController], providers: [TxRiskService] })
export class TxRiskModule {}
