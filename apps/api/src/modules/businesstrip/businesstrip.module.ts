import { Body, Controller, Get, Param, Post, Query, Req, Module, Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";

/**
 * MOD-75 Business Trip (R222→R230, lot 51). Écrit spec-first depuis le Gherkin BT-01..10, sur
 * ratification « OK pour R222..R238 ». Cycle de vie ÉVÉNEMENTIEL (R222) ; pré-contrôle cross-border
 * = un AVIS attaché, jamais une décision (R223) ; signaux KYC (R224) / certification (R228/R237,
 * résolue depuis MOD-43 à la DATE DU VOYAGE) ; approbation = visa uniforme R15 (R225), le voyageur
 * ne vise jamais son propre voyage (R13) ; contact reports MESURÉS jamais coercés (R226/R39) ;
 * rejeu avec grandfathering du référentiel (R229) ; révision chaînée après approbation (R230).
 * L'auteur est TOUJOURS le jeton (ctx.userId), jamais le corps.
 */

type Ctx = { tenantId: string; userId: string; role: string };
type RefEntry = { jurisdiction: string; activite: string; verdict: string; depuisLe: string };

@Injectable()
export class BusinessTripService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private emit(tx: any, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload, at: new Date().toISOString() } });
  }
  private async settings(tx: any, ctx: Ctx) {
    const t = await tx.tenant.findFirst({ where: { id: ctx.tenantId } });
    if (!t) throw new NotFoundException("Tenant introuvable");
    return (t.settings as any) ?? {};
  }

  // ── R223/R229 : avis cross-border avec la version du référentiel en vigueur à `atDate` ──
  private avisA(ref: RefEntry[], destinations: string[], atDate: string) {
    const actifs = ref.filter((e) => e.depuisLe <= atDate);
    const version = actifs.length ? actifs.map((e) => e.depuisLe).sort().slice(-1)[0] : "—";
    const out: any[] = [];
    for (const j of destinations) {
      const es = actifs.filter((e) => e.jurisdiction === j);
      if (es.length) es.forEach((e) => out.push({ jurisdiction: j, activite: e.activite, verdict: e.verdict, referentielVersion: version }));
      else out.push({ jurisdiction: j, activite: "—", verdict: "AUTORISEE", referentielVersion: version });
    }
    return out;
  }

  async creer(ctx: Ctx, dto: { destinations?: string[]; clients?: string[]; dateStart: string; dateEnd: string; purpose?: string }) {
    if (!dto?.dateStart || !dto?.dateEnd) throw new BadRequestException("dateStart et dateEnd requis");
    return this.prisma.trip.create({ data: {
      tenantId: ctx.tenantId, travelerId: ctx.userId, status: "DRAFT", purpose: dto.purpose ?? null,
      dateStart: dto.dateStart, dateEnd: dto.dateEnd, destinations: dto.destinations ?? [], clients: dto.clients ?? [] } });
  }

  // Calcule avis + signaux + visas et passe le voyage en PENDING_APPROVAL (R223/R224/R228/R225).
  private async instruire(tx: any, ctx: Ctx, trip: any) {
    const s = await this.settings(tx, ctx);
    const destinations: string[] = trip.destinations ?? [];
    const clients: string[] = trip.clients ?? [];
    const advisories = this.avisA(s.tripCrossBorderReferentiel ?? [], destinations, new Date().toISOString().slice(0, 10));
    const signals: any[] = [];
    // R224 : KYC des clients visités
    for (const clientId of clients) {
      const kyc = await tx.kycFile.findFirst({ where: { tenantId: ctx.tenantId, clientId }, orderBy: { createdAt: "desc" } });
      if (!kyc || kyc.status !== "VALIDATED")
        signals.push({ type: "KYC_NOT_APPROVED", severite: s.tripKycCheckSeverity ?? "INFORMATIF", detail: `client ${clientId} : KYC ${kyc?.status ?? "ABSENT"}` });
    }
    // R228/R237 : certification requise, résolue depuis MOD-43 à la DATE DU VOYAGE
    for (const req of (s.tripCertificationRequise ?? []) as { jurisdiction: string; code: string }[]) {
      if (!destinations.includes(req.jurisdiction)) continue;
      const certs = await tx.certification.findMany({ where: { tenantId: ctx.tenantId, userId: trip.travelerId, code: req.code } });
      const couvre = certs.some((c: any) => c.obtenueLe <= trip.dateStart && c.expireLe > trip.dateStart);
      if (!couvre)
        signals.push({ type: "CERTIFICATION_EXPIRED_AT_TRIP_DATE", severite: s.tripCertificationCheckSeverity ?? "INFORMATIF", detail: `${req.code} requise en ${req.jurisdiction}, non couverte au ${trip.dateStart}` });
    }
    // R225 : visas = matrice + COMPLIANCE si destination à risque
    const roles = [...new Set<string>(s.tripApprovalMatrix ?? ["DIR"])];
    if (destinations.some((j) => (s.tripJuridictionsRisque ?? []).includes(j))) roles.push("COMPLIANCE");
    for (const role of roles) await tx.tripVisa.create({ data: { tenantId: ctx.tenantId, tripId: trip.id, role } });
    const maj = await tx.trip.update({ where: { id: trip.id }, data: { status: "PENDING_APPROVAL", advisories, signals } });
    await this.emit(tx, ctx.tenantId, "trip.submitted", trip.id, { destinations, avis: advisories.length, signaux: signals.length });
    return maj;
  }

  // ── R222 : soumission (DRAFT → PENDING_APPROVAL), acte tracé ──
  async soumettre(ctx: Ctx, tripId: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const trip = await tx.trip.findFirst({ where: { id: tripId, tenantId: ctx.tenantId } });
      if (!trip) throw new NotFoundException("Voyage introuvable");
      if (trip.status !== "DRAFT") throw new BadRequestException("R222 : seul un DRAFT se soumet");
      const maj = await this.instruire(tx, ctx, trip);
      await this.audit.log(ctx.tenantId, ctx.userId, "TRIP_SUBMITTED", tripId);
      return maj;
    });
  }

  // ── R225/R13/R224 : viser (approbation) ──
  async viser(ctx: Ctx, tripId: string, role: string) {
    if (!role) throw new BadRequestException("role requis");
    return this.prisma.$transaction(async (tx: any) => {
      const trip = await tx.trip.findFirst({ where: { id: tripId, tenantId: ctx.tenantId } });
      if (!trip) throw new NotFoundException("Voyage introuvable");
      if (trip.status !== "PENDING_APPROVAL") throw new BadRequestException("Le voyage n'est pas en attente d'approbation");
      if (trip.travelerId === ctx.userId) throw new ForbiddenException("TRIP_SELF_APPROVAL_FORBIDDEN");             // R13
      if (((trip.signals ?? []) as any[]).some((sig) => sig.type === "KYC_NOT_APPROVED" && sig.severite === "BLOQUANT_APPROBATION"))
        throw new BadRequestException("TRIP_KYC_NOT_APPROVED");                                                    // R224 bloquant
      const visa = await tx.tripVisa.findFirst({ where: { tenantId: ctx.tenantId, tripId, role, status: "PENDING" } });
      if (!visa) throw new BadRequestException(`Aucun visa ${role} en attente`);
      await tx.tripVisa.update({ where: { id: visa.id }, data: { status: "SIGNED", signedBy: ctx.userId, signedAt: new Date().toISOString() } });
      await this.emit(tx, ctx.tenantId, "trip.visa.signed", tripId, { role, par: ctx.userId });
      const restants = await tx.tripVisa.count({ where: { tenantId: ctx.tenantId, tripId, status: "PENDING" } });
      let status = trip.status;
      if (restants === 0) { status = "APPROVED"; await tx.trip.update({ where: { id: tripId }, data: { status } });
        await this.emit(tx, ctx.tenantId, "trip.approved", tripId, {}); }
      await this.audit.log(ctx.tenantId, ctx.userId, "TRIP_VISA", `${tripId}:${role}`);
      return { tripId, role, status, visasRestants: restants };
    });
  }

  // ── R230 : révision chaînée après approbation (V2 en PENDING_APPROVAL, V1 intacte) ──
  async reviser(ctx: Ctx, tripId: string, dto: { destinations?: string[]; clients?: string[] }) {
    return this.prisma.$transaction(async (tx: any) => {
      const trip = await tx.trip.findFirst({ where: { id: tripId, tenantId: ctx.tenantId } });
      if (!trip) throw new NotFoundException("Voyage introuvable");
      if (trip.status !== "APPROVED") throw new BadRequestException("R230 : la révision suit une approbation");
      const v2 = await tx.trip.create({ data: {
        tenantId: ctx.tenantId, travelerId: trip.travelerId, status: "DRAFT", purpose: trip.purpose,
        dateStart: trip.dateStart, dateEnd: trip.dateEnd,
        destinations: dto.destinations ?? trip.destinations, clients: dto.clients ?? trip.clients,
        revision: trip.revision + 1, previousTripId: trip.id } });
      const maj = await this.instruire(tx, ctx, v2);                                 // V2 repasse en PENDING_APPROVAL + visas
      await this.emit(tx, ctx.tenantId, "trip.revised", v2.id, { depuis: trip.id, revision: v2.revision });
      await this.audit.log(ctx.tenantId, ctx.userId, "TRIP_REVISED", `${trip.id}->${v2.id}`);
      return maj;
    });
  }

  // ── R226/R39 : mesurer les contact reports manquants (jamais de blocage) ──
  async mesurerContactReports(ctx: Ctx, tripId: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const trip = await tx.trip.findFirst({ where: { id: tripId, tenantId: ctx.tenantId } });
      if (!trip) throw new NotFoundException("Voyage introuvable");
      const manquants: string[] = [];
      for (const clientId of (trip.clients ?? []) as string[]) {
        const n = await tx.crmContact.count({ where: { tenantId: ctx.tenantId, clientId, at: { gte: new Date(trip.dateEnd) } } });
        if (n === 0) manquants.push(clientId);
      }
      if (manquants.length) await this.emit(tx, ctx.tenantId, "trip.contactreports.manquants", tripId, { manquants });
      return { visites: (trip.clients ?? []).length, manquants, bloque: false };        // R39 : signal, pas coercition
    });
  }

  // ── R229 : lecture, avec rejeu (asOf) recalculant les avis à la version d'alors ──
  async get(ctx: Ctx, tripId: string, asOf?: string) {
    const trip = await this.prisma.trip.findFirst({ where: { id: tripId, tenantId: ctx.tenantId } });
    if (!trip) throw new NotFoundException("Voyage introuvable");
    const visas = await this.prisma.tripVisa.findMany({ where: { tenantId: ctx.tenantId, tripId } });
    if (asOf) {
      const t = await this.prisma.tenant.findFirst({ where: { id: ctx.tenantId } });
      const ref = ((t!.settings as any) ?? {}).tripCrossBorderReferentiel ?? [];
      return { ...trip, visas, advisories: this.avisA(ref, (trip.destinations ?? []) as string[], asOf), asOf };
    }
    return { ...trip, visas };
  }

  async lister(ctx: Ctx, filtre: { status?: string }) {
    const where: any = { tenantId: ctx.tenantId };
    if (filtre.status) where.status = filtre.status;
    return this.prisma.trip.findMany({ where, orderBy: { createdAt: "desc" } });
  }
}

@Controller("trips")
export class BusinessTripController {
  constructor(private svc: BusinessTripService) {}
  @Post()                    creer(@Req() r: any, @Body() b: any) { return this.svc.creer(r.ctx, b); }                                  // R222
  @Get()                     lister(@Req() r: any, @Query("status") status?: string) { return this.svc.lister(r.ctx, { status }); }
  @Get(":id")                get(@Req() r: any, @Param("id") id: string, @Query("asOf") asOf?: string) { return this.svc.get(r.ctx, id, asOf); } // R229
  @Post(":id/submit")        soumettre(@Req() r: any, @Param("id") id: string) { return this.svc.soumettre(r.ctx, id); }                 // R222
  @Post(":id/visa")          viser(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.viser(r.ctx, id, b?.role); } // R225/R13
  @Post(":id/revise")        reviser(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.reviser(r.ctx, id, b); }  // R230
  @Post(":id/contact-reports/mesurer") mesurer(@Req() r: any, @Param("id") id: string) { return this.svc.mesurerContactReports(r.ctx, id); } // R226
}

@Module({
  controllers: [BusinessTripController],
  providers: [
    PrismaService, AuditService,
    { provide: BusinessTripService, useFactory: (p: PrismaService, a: AuditService) => new BusinessTripService(p, a), inject: [PrismaService, AuditService] },
  ],
  exports: [BusinessTripService],
})
export class BusinessTripModule {}
