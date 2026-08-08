import { Body, Controller, ForbiddenException, Get, Module, NotFoundException, Param, Post, Req, Injectable, BadRequestException, UnprocessableEntityException } from "@nestjs/common";
import { emitEvent } from "../../common/domain-event";
import { randomUUID } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { loadSettings } from "../../common/tenant-settings";
import { Tx } from "../../common/tx";

/**
 * BLOC CROSS-BORDER — R293-R295 (canon triage final, ratifié 2026-07-28, XB-01..05).
 * R293 : le COUNTRY MANUAL = la clé EXISTANTE `tripCrossBorderReferentiel` (R223/R229)
 * ENRICHIE (source, licence, dateAvis) — JAMAIS un second référentiel. O-Live STRUCTURE la
 * position de la banque (référence du mémo juridique), il ne fournit jamais l'avis. Versionné
 * par date d'effet (depuisLe) : l'évaluation se rejoue. Juridiction ABSENTE = NON DÉTERMINÉ
 * (default-deny, pattern R169 — jamais un « autorisé » par défaut).
 * R294 : UN moteur pur (`evaluerXb`), DEUX surfaces (check pré-voyage / check à la relation) —
 * le résultat est un ÉVÉNEMENT (entrée, version du manual, verdict). Un verdict restrictif ne
 * bloque RIEN (R39) : il rend le voyage « non conforme », VISIBLE — la voie prévue est la
 * dérogation motivée + visa (`visa_derogation_xb`, défaut DIR — le canon dit LEGAL, rôle
 * absent du RBAC : mappé DIR, consigné), initiateur exclu (R13).
 * R295 : la réception d'ordres depuis un pays restreint exige la qualification « à
 * l'initiative du client » tracée (+ preuve GED obligatoire en EDD). Le reporting MESURE le
 * volume par pays (R39). État dérivé des ÉVÉNEMENTS — aucune table nouvelle.
 */

type Ctx = { tenantId: string; userId: string; role: string };
type EntreeManual = { jurisdiction: string; activite: string; verdict: string;
  depuisLe: string; licence?: string; source?: string };

// ── R294 : LE moteur — fonction PURE, versionnée par date (la plus récente depuisLe ≤ at). ──
export function evaluerXb(manual: EntreeManual[], juridiction: string, activites: string[], atIso: string) {
  const parActivite = activites.map((activite) => {
    const versions = (manual ?? [])
      .filter((e) => e.jurisdiction === juridiction && e.activite === activite && e.depuisLe <= atIso.slice(0, 10))
      .sort((a, b) => a.depuisLe.localeCompare(b.depuisLe));
    const e = versions[versions.length - 1];
    if (!e) return { activite, verdict: "NON_DETERMINE", detail: "juridiction/activité hors manual — analyse Legal requise" };
    if (e.verdict === "AUTORISEE") return { activite, verdict: "AUTORISE", source: e.source ?? null };
    return { activite, verdict: "RESTREINT", position: e.verdict, licence: e.licence ?? null, source: e.source ?? null };
  });
  const verdict = parActivite.some((a) => a.verdict === "NON_DETERMINE") ? "NON_DETERMINE"
    : parActivite.some((a) => a.verdict === "RESTREINT") ? "RESTREINT" : "AUTORISE";
  return { verdict, parActivite };
}

@Injectable()
export class XbService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return emitEvent(tx, tenantId, type, aggregateId, payload);
  }

  // ── XB-01/02/05 : le check — même moteur pour les deux surfaces, événement tracé. ──
  async check(ctx: Ctx, dto: { juridiction?: string; activites?: string[]; at?: string;
    contexte?: { voyageId?: string; kycCode?: string } }) {
    if (!dto?.juridiction || !dto?.activites?.length)
      throw new BadRequestException("juridiction et activites[] requis");
    const s = await loadSettings(this.prisma, ctx.tenantId);
    const at = dto.at ?? new Date().toISOString();
    const res = evaluerXb(s.tripCrossBorderReferentiel ?? [], dto.juridiction, dto.activites, at);
    await this.prisma.$transaction(async (tx: Tx) =>
      this.emit(tx, ctx.tenantId, "xb.check", dto.contexte?.voyageId ?? dto.contexte?.kycCode ?? "hors-contexte",
        { juridiction: dto.juridiction, activites: dto.activites, verdict: res.verdict,
          parActivite: res.parActivite, manualAt: at, contexte: dto.contexte ?? null, par: ctx.userId }));
    return { ...res, manualAt: at,
      ...(res.verdict === "NON_DETERMINE" ? { note: "analyse Legal requise — la banque n'a pas de position pour cette entrée" } : {}) };
  }

  // ── XB-03 : dérogation motivée + visa (initiateur exclu) — état DÉRIVÉ des événements. ──
  async demanderDerogation(ctx: Ctx, dto: { voyageId?: string; kycCode?: string; juridiction?: string; motif?: string }) {
    if (!dto?.motif?.trim()) throw new BadRequestException("R7 : une dérogation cross-border exige un motif");
    if (!dto?.voyageId && !dto?.kycCode) throw new BadRequestException("voyageId ou kycCode requis");
    const id = randomUUID();
    await this.prisma.$transaction(async (tx: Tx) =>
      this.emit(tx, ctx.tenantId, "xb.derogation.demandee", id,
        { voyageId: dto.voyageId ?? null, kycCode: dto.kycCode ?? null, juridiction: dto.juridiction ?? null,
          motif: dto.motif!.trim(), par: ctx.userId }));
    await this.audit.log(ctx.tenantId, ctx.userId, "XB_DEROGATION_DEMANDEE", id);
    return { id, enAttenteDeVisa: true };
  }

  async viserDerogation(ctx: Ctx, id: string) {
    const s = await loadSettings(this.prisma, ctx.tenantId);
    const roleVisa = s.visa_derogation_xb ?? "DIR";
    if (ctx.role !== roleVisa)
      throw new ForbiddenException(`R294 : le visa de dérogation cross-border est ${roleVisa} (visa_derogation_xb)`);
    const demande = await this.prisma.domainEvent.findFirst({
      where: { tenantId: ctx.tenantId, type: "xb.derogation.demandee", aggregateId: id } });
    if (!demande) throw new NotFoundException("Dérogation introuvable");
    if ((demande.payload as any).par === ctx.userId)
      throw new ForbiddenException("R13 : le visa de dérogation exige un SECOND regard — l'initiateur ne vise pas");
    await this.prisma.$transaction(async (tx: Tx) =>
      this.emit(tx, ctx.tenantId, "xb.derogation.visee", id,
        { ...(demande.payload as object), visePar: ctx.userId }));
    await this.audit.log(ctx.tenantId, ctx.userId, "XB_DEROGATION_VISEE", id);
    return { id, visee: true };
  }

  // La conformité d'un voyage — DÉRIVÉE du journal : dernier check + dérogation visée éventuelle.
  async conformiteVoyage(ctx: Ctx, voyageId: string) {
    const checks = await this.prisma.domainEvent.findMany({
      where: { tenantId: ctx.tenantId, type: "xb.check", aggregateId: voyageId }, orderBy: { id: "desc" } });
    if (!checks.length) return { conforme: true, verdict: "AUCUN_CHECK", note: "aucune évaluation cross-border tracée" };
    const dernier: any = checks[0].payload;
    const visées = await this.prisma.domainEvent.findMany({ where: { tenantId: ctx.tenantId, type: "xb.derogation.visee" } });
    const derogation: any = visées.map((e) => e.payload as any).find((p) => p.voyageId === voyageId);
    const restrictif = dernier.verdict !== "AUTORISE";
    return { conforme: !restrictif || !!derogation, verdict: dernier.verdict,
      juridiction: dernier.juridiction, ...(derogation ? { derogation } : {}),
      ...(restrictif && !derogation ? { note: "NON CONFORME — dérogation motivée + visa requis (rien n'est bloqué, tout est visible)" } : {}) };
  }

  // ── XB-04 / R295 : la réception d'ordres — documentée ou refusée ; preuve GED en EDD. ──
  async enregistrerOrdre(ctx: Ctx, dto: { clientId?: string; pays?: string;
    qualificationInitiativeClient?: boolean; preuveRef?: string }) {
    if (!dto?.clientId || !dto?.pays) throw new BadRequestException("clientId et pays requis");
    const s = await loadSettings(this.prisma, ctx.tenantId);
    const res = evaluerXb(s.tripCrossBorderReferentiel ?? [], dto.pays, ["reception_ordres"], new Date().toISOString());
    const restreint = res.verdict !== "AUTORISE";                          // NON_DETERMINE compte restreint (default-deny)
    if (restreint && !dto.qualificationInitiativeClient)
      throw new UnprocessableEntityException(
        "XB_QUALIFICATION_REQUISE : pays restreint — l'ordre n'est enregistrable qu'avec la qualification « à l'initiative du client » tracée (R295)");
    if (restreint) {
      const kyc = await this.prisma.kycFile.findFirst({
        where: { tenantId: ctx.tenantId, clientId: dto.clientId }, orderBy: { createdAt: "desc" } });
      const exigePreuve = (s.preuve_reverse_solicitation ?? "declaration") === "preuve" || kyc?.workflow === "EDD";
      if (exigePreuve && !dto.preuveRef?.trim())
        throw new UnprocessableEntityException(
          "XB_PREUVE_REQUISE : la référence de preuve GED est obligatoire (EDD ou preuve_reverse_solicitation=preuve — R295)");
    }
    await this.prisma.$transaction(async (tx: Tx) =>
      this.emit(tx, ctx.tenantId, "xb.ordre.enregistre", dto.clientId!,
        { pays: dto.pays, reverseSolicitation: restreint,
          qualification: !!dto.qualificationInitiativeClient, preuveRef: dto.preuveRef ?? null, par: ctx.userId }));
    await this.audit.log(ctx.tenantId, ctx.userId, "XB_ORDRE_ENREGISTRE", `${dto.clientId}:${dto.pays}`);
    return { enregistre: true, reverseSolicitation: restreint };
  }

  async reporting(ctx: Ctx) {
    const evs = await this.prisma.domainEvent.findMany({ where: { tenantId: ctx.tenantId, type: "xb.ordre.enregistre" } });
    const parPays: Record<string, { total: number; reverseSolicitation: number }> = {};
    for (const e of evs as any[]) {
      const p = e.payload.pays;
      parPays[p] = parPays[p] ?? { total: 0, reverseSolicitation: 0 };
      parPays[p].total++;
      if (e.payload.reverseSolicitation) parPays[p].reverseSolicitation++;
    }
    return { parPays };                                                    // mesuré, notifié — jamais un blocage (R39)
  }
}

@Controller("crossborder")
export class XbController {
  constructor(private svc: XbService) {}
  @Post("check")                     check(@Req() r: any, @Body() b: any) { return this.svc.check(r.ctx, b ?? {}); }                    // XB-01/02/05
  @Post("derogations")               demander(@Req() r: any, @Body() b: any) { return this.svc.demanderDerogation(r.ctx, b ?? {}); }    // XB-03
  @Post("derogations/:id/visa")      viser(@Req() r: any, @Param("id") id: string) { return this.svc.viserDerogation(r.ctx, id); }      // XB-03/R13
  @Get("voyages/:id/conformite")     conf(@Req() r: any, @Param("id") id: string) { return this.svc.conformiteVoyage(r.ctx, id); }      // XB-03
  @Post("ordres")                    ordre(@Req() r: any, @Body() b: any) { return this.svc.enregistrerOrdre(r.ctx, b ?? {}); }         // XB-04
  @Get("reporting")                  reporting(@Req() r: any) { return this.svc.reporting(r.ctx); }                                      // XB-04/R39
}

@Module({ controllers: [XbController], providers: [XbService], exports: [XbService] })
export class XbModule {}
