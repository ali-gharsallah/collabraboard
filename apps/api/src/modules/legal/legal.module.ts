import { BadRequestException, Body, Controller, Get, Module, NotFoundException, Post, Query, Req, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { Tx } from "../../common/tx";

/**
 * LEGAL — dégel V5 (canon ratifié 2026-07-28), R312-R313, LE-01..04.
 * R312 : le registre LEGAL vit SUR LA GED — un contrat/mémo n'existe pas sans sa pièce
 * (document GED réel du tenant, intégrité/versions R109-R115). Rattachements : client,
 * juridiction du country manual R293 (la position cross-border cite le mémo par sa
 * référence — la boucle se ferme dans les DEUX sens), fournisseur.
 * R313 : les échéances sont CALCULÉES des dates du contrat (pattern R272/R274) — préavis
 * ouvert = tâche + notification ; dépassé = EN_RETARD calculé + escalade notifiée ; rien
 * n'est jamais bloqué (R39). Modification de dates = ÉVÉNEMENT motivé. État dérivé des
 * événements — aucune table nouvelle ; O-Live STRUCTURE, il ne rend jamais l'avis.
 */

type Ctx = { tenantId: string; userId: string; role: string };

@Injectable()
export class LegalService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload, at: new Date().toISOString() } });
  }

  private async objets(ctx: Ctx) {
    const evs = await this.prisma.domainEvent.findMany({
      where: { tenantId: ctx.tenantId, type: { in: ["legal.objet.cree", "legal.objet.dates"] } },
      orderBy: { id: "asc" } });
    const parId = new Map<string, any>();
    for (const e of evs) {
      const p: any = e.payload;
      if (e.type === "legal.objet.cree") parId.set(p.id, { ...p });
      if (e.type === "legal.objet.dates" && parId.has(p.id))
        Object.assign(parId.get(p.id), { dateEffet: p.dateEffet, dateFin: p.dateFin, preavisJours: p.preavisJours });
    }
    return [...parId.values()];
  }

  // ── LE-01 : créer — la PIÈCE d'abord, l'objet ensuite. ──
  async creer(ctx: Ctx, dto: { type?: string; reference?: string; parties?: string[];
    documentId?: string; dateEffet?: string; dateFin?: string; preavisJours?: number;
    tacite?: boolean; fournisseur?: string; rattachements?: { clientId?: string; juridiction?: string } }) {
    if (!["CONTRAT", "MEMO"].includes(dto?.type ?? "")) throw new BadRequestException("type requis : CONTRAT | MEMO");
    if (!dto?.reference?.trim()) throw new BadRequestException("reference requise");
    if (!dto?.documentId)
      throw new BadRequestException("R312 : le registre sans PREUVE n'existe pas — rattachez le document GED (documentId)");
    const doc = await this.prisma.document.findFirst({ where: { id: dto.documentId, tenantId: ctx.tenantId } });
    if (!doc) throw new BadRequestException("R312 : documentId inconnu de la GED du tenant — un identifiant ne prouve rien");
    const id = randomUUID();
    await this.prisma.$transaction(async (tx: Tx) =>
      this.emit(tx, ctx.tenantId, "legal.objet.cree", id,
        { id, type: dto.type, reference: dto.reference!.trim(), parties: dto.parties ?? [],
          documentId: dto.documentId, dateEffet: dto.dateEffet ?? null, dateFin: dto.dateFin ?? null,
          preavisJours: dto.preavisJours ?? null, tacite: !!dto.tacite, fournisseur: dto.fournisseur ?? null,
          rattachements: dto.rattachements ?? {}, par: ctx.userId }));
    await this.audit.log(ctx.tenantId, ctx.userId, "LEGAL_OBJET_CREE", dto.reference!.trim());
    return { id, reference: dto.reference!.trim() };
  }

  // Modification de dates = ÉVÉNEMENT motivé (R7) — jamais une réécriture.
  async modifierDates(ctx: Ctx, id: string, dto: { dateEffet?: string; dateFin?: string;
    preavisJours?: number; motif?: string }) {
    if (!dto?.motif?.trim()) throw new BadRequestException("R7 : modifier les dates d'un contrat se motive");
    const o = (await this.objets(ctx)).find((x) => x.id === id);
    if (!o) throw new NotFoundException("Objet legal introuvable");
    await this.prisma.$transaction(async (tx: Tx) =>
      this.emit(tx, ctx.tenantId, "legal.objet.dates", id,
        { id, dateEffet: dto.dateEffet ?? o.dateEffet, dateFin: dto.dateFin ?? o.dateFin,
          preavisJours: dto.preavisJours ?? o.preavisJours, motif: dto.motif!.trim(), par: ctx.userId }));
    return { id, modifie: true };
  }

  async lister(ctx: Ctx, juridiction?: string, clientId?: string) {
    const objets = await this.objets(ctx);
    return objets.filter((o) => (!juridiction || o.rattachements?.juridiction === juridiction)
      && (!clientId || o.rattachements?.clientId === clientId));
  }

  // ── LE-03/04 : par référence — l'objet + sa pièce, la VERSION résolue à date (R48). ──
  async parReference(ctx: Ctx, ref: string, at?: string) {
    const o = (await this.objets(ctx)).find((x) => x.reference === ref);
    if (!o) throw new NotFoundException("Référence legal inconnue du registre");
    const borne = at ? new Date(at) : new Date();
    const versions = await this.prisma.documentVersion.findMany({
      where: { tenantId: ctx.tenantId, documentId: o.documentId, deposeAt: { lte: borne } },
      orderBy: { numero: "desc" } });
    return { ...o, versionEnVigueur: versions[0]
      ? { numero: versions[0].numero, sha256: versions[0].sha256, deposeAt: versions[0].deposeAt } : null };
  }

  // ── LE-02 : les échéances — des FAITS calculés des dates, jamais une colonne. ──
  private statutDe(o: any, now: number) {
    if (!o.dateFin) return "SANS_ECHEANCE";
    const fin = new Date(o.dateFin).getTime();
    if (now > fin) return "EN_RETARD";
    if (o.preavisJours != null && now > fin - o.preavisJours * 86400000) return "PREAVIS_OUVERT";
    return "COURANT";
  }

  async echeances(ctx: Ctx) {
    const now = Date.now();
    return (await this.objets(ctx)).map((o) => ({ id: o.id, reference: o.reference, type: o.type,
      dateFin: o.dateFin, preavisJours: o.preavisJours, tacite: o.tacite, statut: this.statutDe(o, now) }));
  }

  // Le tick (R274 réutilisé) : notifie UNE fois par état — mesuré, jamais bloquant.
  async tick(ctx: Ctx) {
    const now = Date.now();
    const dejaNotifies = new Set((await this.prisma.domainEvent.findMany({
      where: { tenantId: ctx.tenantId, type: { in: ["tache.legal.preavis", "legal.echeance.escalade"] } } }))
      .map((e) => `${e.type}|${(e.payload as any).id}`));
    let taches = 0, escalades = 0;
    await this.prisma.$transaction(async (tx: Tx) => {
      for (const o of await this.objets(ctx)) {
        const statut = this.statutDe(o, now);
        if (statut === "PREAVIS_OUVERT" && !dejaNotifies.has(`tache.legal.preavis|${o.id}`)) {
          taches++;
          await this.emit(tx, ctx.tenantId, "tache.legal.preavis", o.id,
            { id: o.id, reference: o.reference, dateFin: o.dateFin, tacite: o.tacite,
              notifie: ["CO", "DIR"], par: ctx.userId });
        }
        if (statut === "EN_RETARD" && !dejaNotifies.has(`legal.echeance.escalade|${o.id}`)) {
          escalades++;
          await this.emit(tx, ctx.tenantId, "legal.echeance.escalade", o.id,
            { id: o.id, reference: o.reference, dateFin: o.dateFin, notifie: ["CO_SR", "DIR"], par: ctx.userId });
        }
      }
    });
    return { taches, escalades };                                            // compté — rien n'est bloqué (R39)
  }
}

@Controller("legal")
export class LegalController {
  constructor(private svc: LegalService) {}
  @Post("objets")            creer(@Req() r: any, @Body() b: any) { return this.svc.creer(r.ctx, b ?? {}); }                       // LE-01
  @Post("objets/:id/dates")  dates(@Req() r: any, @Body() b: any) { return this.svc.modifierDates(r.ctx, r.params?.id ?? b?.id, b ?? {}); }
  @Get("objets")             lister(@Req() r: any, @Query("juridiction") j?: string, @Query("clientId") c?: string) { return this.svc.lister(r.ctx, j, c); } // LE-03
  @Get("par-reference")      parRef(@Req() r: any, @Query("ref") ref: string, @Query("at") at?: string) { return this.svc.parReference(r.ctx, ref, at); }    // LE-03/04
  @Get("echeances")          echeances(@Req() r: any) { return this.svc.echeances(r.ctx); }                                        // LE-02
  @Post("tick")              tick(@Req() r: any) { return this.svc.tick(r.ctx); }                                                  // LE-02/R274
}

@Module({ controllers: [LegalController], providers: [LegalService] })
export class LegalModule {}
