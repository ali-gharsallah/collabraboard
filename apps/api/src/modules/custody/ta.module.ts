import { BadRequestException, Body, Controller, ForbiddenException, Get, Module, NotFoundException, Param, Post, Query, Req, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { loadSettings } from "../../common/tenant-settings";
import { Tx } from "../../common/tx";

/**
 * R302 [canon R299] — LE REGISTRE NOMINATIF (TA) EST UN JOURNAL (dégel V2, CY-02/03/06).
 * Chaque mouvement (SOUSCRIPTION, TRANSFERT, NANTISSEMENT, RADIATION) est un ÉVÉNEMENT —
 * l'état du registre à toute date = REJEU (R48) : le registre EST la démonstration de
 * l'architecture. Correction = CONTRE-PASSATION motivée (R7), jamais une réécriture (le
 * journal domain_events est inviolable par trigger). Les visas par type de mouvement sont
 * un paramètre tenant (`ta_visas_par_type`) — l'initiateur ne vise jamais (R13) ; un
 * mouvement en attente de visa n'est PAS au registre. Aucune table nouvelle.
 */

type Ctx = { tenantId: string; userId: string; role: string };
const TYPES = ["SOUSCRIPTION", "TRANSFERT", "NANTISSEMENT", "RADIATION"];

@Injectable()
export class TaService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload, at: new Date().toISOString() } });
  }

  private async journal(tenantId: string) {
    return this.prisma.domainEvent.findMany({
      where: { tenantId, type: { in: ["ta.mouvement.enregistre", "ta.mouvement.vise", "ta.contrepassation"] } },
      orderBy: { id: "asc" } });
  }

  // ── CY-06 : enregistrer — l'événement naît ; s'il exige un visa, il attend un SECOND. ──
  async enregistrer(ctx: Ctx, dto: { type?: string; titre?: string; titulaire?: string;
    versTitulaire?: string; quantite?: number; reference?: string }) {
    if (!TYPES.includes(dto?.type ?? "")) throw new BadRequestException(`type requis : ${TYPES.join(" | ")}`);
    if (!dto?.titre || !dto?.titulaire || !dto?.reference || !(Number(dto?.quantite) > 0))
      throw new BadRequestException("titre, titulaire, quantite (> 0) et reference requis");
    if (dto.type === "TRANSFERT" && !dto.versTitulaire)
      throw new BadRequestException("TRANSFERT : versTitulaire requis");
    const doublon = (await this.journal(ctx.tenantId))
      .some((e) => (e.payload as any).reference === dto.reference && e.type === "ta.mouvement.enregistre");
    if (doublon) throw new BadRequestException("référence déjà au journal — un mouvement ne se rejoue pas");
    const s = await loadSettings(this.prisma, ctx.tenantId);
    const roleVisa = ((s.ta_visas_par_type ?? {}) as Record<string, string>)[dto.type!] ?? null;
    const id = randomUUID();
    await this.prisma.$transaction(async (tx: Tx) =>
      this.emit(tx, ctx.tenantId, "ta.mouvement.enregistre", id,
        { type: dto.type, titre: dto.titre, titulaire: dto.titulaire,
          versTitulaire: dto.versTitulaire ?? null, quantite: Number(dto.quantite),
          reference: dto.reference, roleVisa, par: ctx.userId }));
    await this.audit.log(ctx.tenantId, ctx.userId, "TA_MOUVEMENT", `${dto.type}:${dto.reference}`);
    return { id, reference: dto.reference, enAttenteDeVisa: !!roleVisa };
  }

  // ── CY-06 : le visa — un SECOND, du rôle déclaré (R13). ──
  async viser(ctx: Ctx, reference: string) {
    const evs = await this.journal(ctx.tenantId);
    const m = evs.find((e) => e.type === "ta.mouvement.enregistre" && (e.payload as any).reference === reference);
    if (!m) throw new NotFoundException("Mouvement introuvable");
    const p: any = m.payload;
    if (!p.roleVisa) throw new BadRequestException("Ce type de mouvement n'exige pas de visa");
    if (evs.some((e) => e.type === "ta.mouvement.vise" && (e.payload as any).reference === reference))
      throw new BadRequestException("Déjà visé — le visa ne se rejoue pas");
    if (p.par === ctx.userId)
      throw new ForbiddenException("R13 : le visa d'un mouvement nominatif exige un SECOND regard — l'initiateur ne vise pas");
    if (ctx.role !== p.roleVisa)
      throw new ForbiddenException(`R302 : le visa de ce type de mouvement est ${p.roleVisa} (ta_visas_par_type)`);
    await this.prisma.$transaction(async (tx: Tx) =>
      this.emit(tx, ctx.tenantId, "ta.mouvement.vise", m.aggregateId, { reference, visePar: ctx.userId }));
    await this.audit.log(ctx.tenantId, ctx.userId, "TA_VISA", reference);
    return { reference, vise: true };
  }

  // ── CY-03 : la contre-passation — motivée, inverse TOUT le mouvement, jamais une réécriture. ──
  async contrepasser(ctx: Ctx, reference: string, dto: { motif?: string }) {
    if (!dto?.motif?.trim())
      throw new BadRequestException("R7 : corriger le registre exige un motif — la contre-passation ne s'improvise pas");
    const evs = await this.journal(ctx.tenantId);
    const m = evs.find((e) => e.type === "ta.mouvement.enregistre" && (e.payload as any).reference === reference);
    if (!m) throw new NotFoundException("Mouvement introuvable");
    await this.prisma.$transaction(async (tx: Tx) =>
      this.emit(tx, ctx.tenantId, "ta.contrepassation", m.aggregateId,
        { reference, mouvement: m.payload, motif: dto.motif!.trim(), par: ctx.userId }));
    await this.audit.log(ctx.tenantId, ctx.userId, "TA_CONTREPASSATION", reference);
    return { reference, contrepasse: true };
  }

  // ── CY-02 : L'ÉTAT = REJEU du journal à date — la démonstration de l'architecture. ──
  async registre(ctx: Ctx, asOf?: string) {
    const borne = asOf ?? new Date().toISOString();
    const evs = (await this.journal(ctx.tenantId)).filter((e) => new Date(e.at as any).toISOString() <= borne);
    const vises = new Set(evs.filter((e) => e.type === "ta.mouvement.vise").map((e) => (e.payload as any).reference));
    const contrepasses = evs.filter((e) => e.type === "ta.contrepassation").map((e) => (e.payload as any).reference);
    const positions = new Map<string, number>();
    const mouvements: any[] = [];
    const poser = (titre: string, titulaire: string, delta: number) => {
      const cle = `${titre}|${titulaire}`;
      positions.set(cle, (positions.get(cle) ?? 0) + delta);
    };
    const appliquer = (p: any, sens: 1 | -1) => {
      if (p.type === "SOUSCRIPTION") poser(p.titre, p.titulaire, sens * p.quantite);
      if (p.type === "RADIATION") poser(p.titre, p.titulaire, -sens * p.quantite);
      if (p.type === "TRANSFERT") { poser(p.titre, p.titulaire, -sens * p.quantite); poser(p.titre, p.versTitulaire, sens * p.quantite); }
      if (p.type === "NANTISSEMENT") poser(p.titre, p.titulaire, 0);        // grève le titre, ne déplace rien
    };
    for (const e of evs) {
      if (e.type !== "ta.mouvement.enregistre") continue;
      const p: any = e.payload;
      if (p.roleVisa && !vises.has(p.reference)) continue;                  // en attente de visa : PAS au registre
      appliquer(p, 1);
      mouvements.push({ reference: p.reference, type: p.type, titre: p.titre, quantite: p.quantite, at: e.at });
    }
    for (const ref of contrepasses) {
      const m = evs.find((e) => e.type === "ta.mouvement.enregistre" && (e.payload as any).reference === ref);
      if (m) appliquer(m.payload, -1);                                      // l'inverse EXACT, tracé
    }
    return { asOf: borne,
      positions: [...positions.entries()].map(([cle, quantite]) => {
        const [titre, titulaire] = cle.split("|");
        return { titre, titulaire, quantite };                              // le zéro et le négatif RESTENT visibles
      }),
      mouvements, contrepassations: contrepasses };
  }
}

@Controller("ta")
export class TaController {
  constructor(private svc: TaService) {}
  @Post("mouvements")                    enregistrer(@Req() r: any, @Body() b: any) { return this.svc.enregistrer(r.ctx, b ?? {}); }  // CY-01/02/06
  @Post("mouvements/:ref/visa")          viser(@Req() r: any, @Param("ref") ref: string) { return this.svc.viser(r.ctx, ref); }        // CY-06/R13
  @Post("mouvements/:ref/contrepasser")  contrepasser(@Req() r: any, @Param("ref") ref: string, @Body() b: any) { return this.svc.contrepasser(r.ctx, ref, b ?? {}); } // CY-03/R7
  @Get("registre")                       registre(@Req() r: any, @Query("asOf") asOf?: string) { return this.svc.registre(r.ctx, asOf); } // CY-02/R48
}

@Module({ controllers: [TaController], providers: [TaService], exports: [TaService] })
export class TaModule {}
