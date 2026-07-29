import { BadRequestException, Body, Controller, Get, Module, Post, Req, Injectable, Query } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { emitEvent } from "../../common/domain-event";
import { Tx } from "../../common/tx";

/**
 * R297 [canon R294] — LE FLUX TRANSACTIONNEL EST UN JOURNAL CANONIQUE (dégel V1, TF-01..03).
 * Alimenté EXCLUSIVEMENT par le port core banking (R167-R169) — port absent = refus gracieux
 * TYPÉ, zéro donnée simulée en prod ; la fixture déterministe n'existe qu'en TEST (env
 * TXFLUX_FAKE_PORT, doctrine OLIVIA_FAKE_PORT). Idempotence par (tenant, source, ref_externe)
 * — la même livraison deux fois = une transaction (R286 at-least-once assumé). Le journal est
 * IMMUABLE (trigger append-only post-deploy). Rattachement client par le coreMapping tenant
 * (R169) — l'inconnu reste clientId nul, VISIBLE, jamais deviné. L'enrichissement (pays de
 * contrepartie depuis l'IBAN) est calculé À l'insertion et TRACÉ dans `enrichi` — jamais un
 * écrasement de la donnée du port.
 */

type Ctx = { tenantId: string; userId: string; role: string };
export type TxFluxPort = { systeme: string; version: string;
  lireTransactions(depuis?: string): Promise<any[]> };
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// Port de TEST déterministe — fixtures en TEST uniquement, JAMAIS en prod (R167).
function fakePort(): TxFluxPort | undefined {
  if (process.env.TXFLUX_FAKE_PORT !== "1") return undefined;
  const fixtures = [
    { refExterne: "FIX-001", compte: "CH93-0001", dateValeur: "2026-07-20", dateComptable: "2026-07-20",
      montant: 12000, devise: "CHF", sens: "CREDIT", type: "VIREMENT",
      contrepartieNom: "Alpha SA", contrepartieIban: "DE89370400440532013000" },
    { refExterne: "FIX-002", compte: "CH93-0001", dateValeur: "2026-07-21", dateComptable: "2026-07-21",
      montant: 11800, devise: "CHF", sens: "DEBIT", type: "VIREMENT",
      contrepartieNom: "Beta Ltd", contrepartieIban: "GB29NWBK60161331926819" },
    { refExterne: "FIX-003", compte: "CH93-0002", dateValeur: "2026-07-22", dateComptable: "2026-07-22",
      montant: 9500, devise: "USD", sens: "CREDIT", type: "SWIFT",
      contrepartieNom: "Gamma Corp", contrepartieIban: "AE070331234567890123456" },
  ];
  return { systeme: "FAKE-CORE", version: "test", lireTransactions: async () => fixtures };
}

@Injectable()
export class TxFluxService {
  constructor(private prisma: PrismaService, private audit: AuditService,
    private ports: { flux?: TxFluxPort } = {}) {}

  private port(): TxFluxPort {
    const p = this.ports.flux ?? fakePort();
    if (!p) throw new BadRequestException(
      "R297 : aucun port core banking configuré pour le flux transactionnel — refus gracieux, jamais une donnée simulée");
    return p;
  }

  async etat(ctx: Ctx) {
    const p = this.ports.flux ?? fakePort();
    const n = await this.prisma.transaction.count({ where: { tenantId: ctx.tenantId } });
    return { portConfigure: !!p, ...(p ? { source: `${p.systeme} ${p.version}` } : {}), transactions: n };
  }

  // ── TF-02 : import idempotent par (source, ref_externe) — R286 at-least-once assumé. ──
  async importer(ctx: Ctx) {
    const port = this.port();
    const lignes = await port.lireTransactions();
    const source = `${port.systeme} ${port.version}`;
    const t = await this.prisma.tenant.findFirst({ where: { id: ctx.tenantId } });
    const mapping: any[] = ((t?.settings as any) ?? {}).coreMapping ?? [];
    const now = new Date().toISOString();
    const actifs = mapping.filter((m) => m.depuisLe <= now);                 // R169/R29 — la date fait foi
    let importees = 0, dejaConnues = 0;
    await this.prisma.$transaction(async (tx: Tx) => {
      for (const l of lignes) {
        const existe = await tx.transaction.findFirst({
          where: { tenantId: ctx.tenantId, source, refExterne: l.refExterne } });
        if (existe) { dejaConnues++; continue; }                             // idempotence — jamais un doublon
        const clientId = actifs.find((m) => m.compteCore === l.compte)?.clientId ?? null;
        const pays = l.contrepartiePays ?? (typeof l.contrepartieIban === "string"
          ? l.contrepartieIban.slice(0, 2).toUpperCase() : null);            // enrichissement TRACÉ, pas un écrasement
        const created = await tx.transaction.create({ data: {
          tenantId: ctx.tenantId, clientId, compte: l.compte,
          dateValeur: l.dateValeur, dateComptable: l.dateComptable ?? l.dateValeur,
          montant: l.montant, devise: l.devise, sens: l.sens, type: l.type ?? "AUTRE",
          contrepartieNom: l.contrepartieNom ?? null, contrepartiePays: pays,
          contrepartieIbanHash: l.contrepartieIban ? sha256(l.contrepartieIban) : null,
          refExterne: l.refExterne, source,
          enrichi: pays && !l.contrepartiePays
            ? { contrepartiePays: { valeur: pays, regle: "préfixe IBAN (R297 : calculé tracé)" } } : undefined } });
        importees++;
        await emitEvent(tx, ctx.tenantId, "tx.flux.importee", created.id,
          { refExterne: l.refExterne, source, compte: l.compte, clientId });
      }
    });
    await this.audit.log(ctx.tenantId, ctx.userId, "TXFLUX_IMPORT", `${source}:${importees}/${lignes.length}`);
    return { source, importees, dejaConnues };
  }

  async lister(ctx: Ctx, clientId?: string) {
    return this.prisma.transaction.findMany({
      where: { tenantId: ctx.tenantId, ...(clientId ? { clientId } : {}) },
      orderBy: { dateValeur: "desc" }, take: 200 });
  }
}

@Controller("txflux")
export class TxFluxController {
  constructor(private svc: TxFluxService) {}
  @Get("etat")      etat(@Req() r: any) { return this.svc.etat(r.ctx); }                                     // TF-01 : l'écran REND l'état
  @Post("importer") importer(@Req() r: any, @Body() _b: any) { return this.svc.importer(r.ctx); }            // TF-02
  @Get()            lister(@Req() r: any, @Query("clientId") c?: string) { return this.svc.lister(r.ctx, c); }
}

@Module({
  controllers: [TxFluxController],
  providers: [{
    provide: TxFluxService,
    useFactory: (prisma: PrismaService, audit: AuditService) => new TxFluxService(prisma, audit, {}),
    inject: [PrismaService, AuditService],
  }],
  exports: [TxFluxService],
})
export class TxFluxModule {}
