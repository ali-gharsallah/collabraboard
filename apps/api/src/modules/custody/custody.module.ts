import { BadRequestException, Body, Controller, Get, Module, Post, Req, Injectable } from "@nestjs/common";
import { emitEvent } from "../../common/domain-event";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { TaService, TaModule } from "./ta.module";
import { Tx } from "../../common/tx";

/**
 * R301 [canon R298] — LES POSITIONS CUSTODY VIENNENT DU PORT (dégel V2, CY-01) : lues,
 * rapprochées, JAMAIS recopiées — O-Live ne tient pas les positions custody. Pas de port =
 * refus gracieux (portConfigure:false, zéro donnée) ; fixture déterministe en TEST
 * uniquement (CUSTODY_FAKE_PORT).
 * R303 [canon R300] — LE RAPPROCHEMENT LISTE LES ÉCARTS (CY-04/05) : custody (port) ↔
 * registre (journal R302), TOUS les écarts (pattern R269 — jamais le premier seul), typés
 * (POSITION_SANS_REGISTRE, REGISTRE_SANS_POSITION, QUANTITES_DIVERGENTES), chacun avec sa
 * VOIE (contre-passation, correction dépositaire à demander, attestation). La résolution
 * est un ÉVÉNEMENT motivé — le traité sort de la liste mais reste COMPTÉ, jamais caché.
 * Tokenisation : HORS bloc (option à ratifier séparément).
 */

type Ctx = { tenantId: string; userId: string; role: string };
export type CustodyPort = { depositaire: string; positions(): Promise<{ titre: string; quantite: number }[]> };

// Fixture de TEST déterministe — jamais en prod (R167).
function fakePort(): CustodyPort | undefined {
  if (process.env.CUSTODY_FAKE_PORT !== "1") return undefined;
  return { depositaire: "FAKE-DEPOSITAIRE test",
    positions: async () => [{ titre: "TIT-X", quantite: 100 }, { titre: "TIT-Y", quantite: 50 }, { titre: "TIT-Z", quantite: 10 }] };
}

const VOIES: Record<string, string> = {
  POSITION_SANS_REGISTRE: "inscrire le mouvement d'origine au registre (souscription/transfert) ou demander l'attestation du dépositaire",
  REGISTRE_SANS_POSITION: "contre-passation motivée au registre ou correction à demander au dépositaire",
  QUANTITES_DIVERGENTES: "contre-passation partielle au registre ou correction côté dépositaire — attestation à l'appui",
};

@Injectable()
export class CustodyService {
  constructor(private prisma: PrismaService, private audit: AuditService, private ta: TaService,
    private ports: { custody?: CustodyPort } = {}) {}

  private port(): CustodyPort | undefined { return this.ports.custody ?? fakePort(); }

  // ── CY-01 : les positions — du PORT, ou rien (refus gracieux). ──
  async positions(_ctx: Ctx) {
    const p = this.port();
    if (!p) return { portConfigure: false, positions: [] };
    return { portConfigure: true, depositaire: p.depositaire, positions: await p.positions() };
  }

  // ── CY-04/05 : le rapprochement — TOUS les écarts, typés, avec voie ; les résolus comptés. ──
  async rapprochement(ctx: Ctx) {
    const p = this.port();
    if (!p) throw new BadRequestException(
      "R301 : aucun port custody configuré — le rapprochement exige les positions du dépositaire");
    const custody = await p.positions();
    const registre = await this.ta.registre(ctx);
    const parTitre = new Map<string, number>();
    for (const pos of registre.positions) parTitre.set(pos.titre, (parTitre.get(pos.titre) ?? 0) + pos.quantite);
    const resolus = new Set((await this.prisma.domainEvent.findMany({
      where: { tenantId: ctx.tenantId, type: "ta.ecart.resolu" } })).map((e) => (e.payload as any).cle));
    const ecarts: { cle: string; type: string; titre: string; custody: number | null;
      registre: number | null; voie: string }[] = [];
    for (const c of custody) {
      const r = parTitre.get(c.titre);
      if (r === undefined) ecarts.push({ cle: `SANS_REGISTRE|${c.titre}`, type: "POSITION_SANS_REGISTRE",
        titre: c.titre, custody: c.quantite, registre: null, voie: VOIES.POSITION_SANS_REGISTRE });
      else if (r !== c.quantite) ecarts.push({ cle: `DIVERGENCE|${c.titre}`, type: "QUANTITES_DIVERGENTES",
        titre: c.titre, custody: c.quantite, registre: r, voie: VOIES.QUANTITES_DIVERGENTES });
    }
    for (const [titre, quantite] of parTitre) {
      if (!custody.some((c) => c.titre === titre))
        ecarts.push({ cle: `SANS_POSITION|${titre}`, type: "REGISTRE_SANS_POSITION",
          titre, custody: null, registre: quantite, voie: VOIES.REGISTRE_SANS_POSITION });
    }
    const ouverts = ecarts.filter((e) => !resolus.has(e.cle));               // le traité sort, mais reste COMPTÉ
    await this.prisma.$transaction((tx: Tx) => emitEvent(tx, ctx.tenantId, "ta.rapprochement",
      p.depositaire, { ecarts: ouverts.length, resolus: ecarts.length - ouverts.length, par: ctx.userId }));
    return { depositaire: p.depositaire, ecarts: ouverts, resolus: ecarts.length - ouverts.length };
  }

  // ── CY-05 : résoudre — un acte humain motivé, tracé. ──
  async resoudre(ctx: Ctx, dto: { cle?: string; voie?: string; motif?: string }) {
    if (!dto?.cle || !dto?.voie?.trim() || !dto?.motif?.trim())
      throw new BadRequestException("R269/R7 : la résolution nomme l'écart (cle), sa voie et son motif");
    await this.prisma.$transaction((tx: Tx) => emitEvent(tx, ctx.tenantId, "ta.ecart.resolu",
      dto.cle!, { cle: dto.cle, voie: dto.voie!.trim(), motif: dto.motif!.trim(), par: ctx.userId }));
    await this.audit.log(ctx.tenantId, ctx.userId, "TA_ECART_RESOLU", dto.cle!);
    return { cle: dto.cle, resolu: true };
  }
}

@Controller("custody")
export class CustodyController {
  constructor(private svc: CustodyService) {}
  @Get("positions")       positions(@Req() r: any) { return this.svc.positions(r.ctx); }                       // CY-01
  @Get("rapprochement")   rapprochement(@Req() r: any) { return this.svc.rapprochement(r.ctx); }               // CY-04
  @Post("ecarts/resoudre") resoudre(@Req() r: any, @Body() b: any) { return this.svc.resoudre(r.ctx, b ?? {}); } // CY-05
}

@Module({
  imports: [TaModule],
  controllers: [CustodyController],
  providers: [{
    provide: CustodyService,
    useFactory: (prisma: PrismaService, audit: AuditService, ta: TaService) => new CustodyService(prisma, audit, ta, {}),
    inject: [PrismaService, AuditService, TaService],
  }],
})
export class CustodyModule {}
