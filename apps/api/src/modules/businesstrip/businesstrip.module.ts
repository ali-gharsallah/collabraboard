import { Body, Controller, Get, Param, Post, Query, Req, Module, Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { applyKeyset, PageParams } from "../../common/pagination";
import { emitEvent } from "../../common/domain-event";
import { loadSettings } from "../../common/tenant-settings";
import { fusionProfonde, modifierParametreGouverne, resoudreParametresGouvernes } from "../../common/param-engagement";
import { evaluerXb } from "../crossborder/xb.module";
import { Tx } from "../../common/tx";

// ── Bloc 63 (repo R446–R452 + R465) — défauts du registre §BusinessTrip (R452).
//    Le delta ne s'active QUE si le tenant a posé `settings.businessTrip` (ou un
//    PARAM_CHANGED sur l'agrégat) — sans lui, MOD-75 se comporte à l'identique (R29).
const AGG_PARAMS_BT = "businesstrip-params";
export const DEFAUTS_BUSINESSTRIP = {
  chains: { LOW: ["MGR"], MEDIUM: ["MGR", "XB"], HIGH: ["MGR", "XB", "HPB"] } as Record<string, string[]>,
  seuilBudgetHPB: 5000,
  risqueDestinations: {} as Record<string, string>,
  quotas: {} as Record<string, number>,
  quotasOverridesRM: {} as Record<string, Record<string, number>>,
  guards: { certifValide: "BLOQUANT", quotaDepasse: "AVERTISSEMENT", verdictNON: "BLOQUANT",
    paysSanctions: "BLOQUANT", certificatPrecedentManquant: "BLOQUANT", destinationHorsRegistre: "BLOQUANT" } as Record<string, string>,
  paysSanctions: [] as string[],
  certificat: { slaJoursOuvres: 5, validateurDefaut: "MGR", validateurSiEcart: "XB" },
};
const NIVEAUX = ["LOW", "MEDIUM", "HIGH"];
const joursDeVoyage = (dateStart: string, dateEnd: string) =>
  Math.max(1, Math.round((new Date(dateEnd).getTime() - new Date(dateStart).getTime()) / 86_400_000));
const joursOuvresDepuis = (deIso: string, aIso: string) => {
  let n = 0;
  for (let t = new Date(deIso + "T12:00:00Z").getTime() + 86_400_000; t <= new Date(aIso.slice(0, 10) + "T12:00:00Z").getTime(); t += 86_400_000) {
    const j = new Date(t).getUTCDay();
    if (j !== 0 && j !== 6) n++;
  }
  return n;
};

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

  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return emitEvent(tx, tenantId, type, aggregateId, payload);
  }
  private async settings(tx: Tx, ctx: Ctx) {
    return loadSettings(tx, ctx.tenantId, true);
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

  async creer(ctx: Ctx, dto: { destinations?: string[]; clients?: string[]; dateStart: string; dateEnd: string; purpose?: string;
    activites?: string[]; budget?: number }) {                                     // Bloc 63 (R446) : activités prévues + budget
    if (!dto?.dateStart || !dto?.dateEnd) throw new BadRequestException("dateStart et dateEnd requis");
    return this.prisma.trip.create({ data: {
      tenantId: ctx.tenantId, travelerId: ctx.userId, status: "DRAFT", purpose: dto.purpose ?? null,
      dateStart: dto.dateStart, dateEnd: dto.dateEnd, destinations: dto.destinations ?? [], clients: dto.clients ?? [],
      activites: dto.activites ?? [], budget: dto.budget ?? null } as any });
  }

  // ══ Bloc 63 — noyau delta (R446–R452 + R465) ══════════════════════════════════════════

  /** Le registre §BusinessTrip résolu à date : défauts ∪ settings.businessTrip ∪ rejeu PARAM_CHANGED.
   *  Retourne null si le tenant n'a PAS activé le delta (MOD-75 inchangé — R29). */
  private async paramsBT(ctx: Ctx, at?: Date): Promise<any | null> {
    const s = await loadSettings(this.prisma, ctx.tenantId, true);
    // Activation défensive : settings d'abord ; le journal ensuite SI le client le sait lire
    // (le harnais wiring MOD-75 utilise un fakePrisma sans findMany/count sur domain_events).
    const nChanges = (!s.businessTrip && typeof (this.prisma as any).domainEvent?.count === "function")
      ? await this.prisma.domainEvent.count({
          where: { tenantId: ctx.tenantId, aggregateId: AGG_PARAMS_BT, type: "PARAM_CHANGED" } })
      : 0;
    if (!s.businessTrip && nChanges === 0) return null;
    const base = fusionProfonde(DEFAUTS_BUSINESSTRIP, s.businessTrip ?? {});
    return resoudreParametresGouvernes(this.prisma, ctx.tenantId, AGG_PARAMS_BT, base, at);
  }

  /** R446 : chaîne résolue à la soumission — risque max des destinations × budget vs seuil HPB. */
  private resoudreChaine(p: any, destinations: string[], budget: number | null) {
    const risque = destinations.reduce((acc, d) => {
      const r = p.risqueDestinations?.[d] ?? "LOW";
      return NIVEAUX.indexOf(r) > NIVEAUX.indexOf(acc) ? r : acc;
    }, "LOW");
    const chaine: string[] = [...(p.chains?.[risque] ?? p.chains?.LOW ?? ["MGR"])];
    const hpbAjoute = budget != null && budget > (p.seuilBudgetHPB ?? 5000) && !chaine.includes("HPB");
    if (hpbAjoute) chaine.push("HPB");
    return { chaine: ["RM", ...chaine], visas: chaine,
      origineChaine: { risque, budget: budget ?? null, seuilBudgetHPB: p.seuilBudgetHPB ?? 5000, hpbAjoute } };
  }

  /** R448 : le check pré-voyage est CONSIGNÉ (verdict ligne à ligne + version de matrice). */
  private async consignerCheck(tx: Tx, ctx: Ctx, trip: any, ref: any[]) {
    const at = new Date().toISOString();
    const destinations: string[] = (trip.destinations ?? []) as string[];
    const activites: string[] = ((trip.activites ?? []) as string[]);
    const parActivite: any[] = [];
    for (const j of destinations)
      for (const a of evaluerXb(ref ?? [], j, activites.length ? activites : ["MEET"], at).parActivite)
        parActivite.push({ jurisdiction: j, ...a });
    const versions = (ref ?? []).filter((e: any) => destinations.includes(e.jurisdiction) && e.depuisLe <= at.slice(0, 10))
      .map((e: any) => e.depuisLe).sort();
    const referentielVersion = versions[versions.length - 1] ?? "—";
    await this.emit(tx, ctx.tenantId, "trip.check.consigne", trip.id,
      { juridictions: destinations, parActivite, referentielVersion, at });
    return { parActivite, referentielVersion, at };
  }

  /** R447/R451 : certifications requises pour les destinations (MOD-43 + codes XB-<pays>). */
  private async certifsManquantes(ctx: Ctx, trip: any, s: any): Promise<string[]> {
    const destinations: string[] = (trip.destinations ?? []) as string[];
    const requises = new Map<string, string>();                                   // code → juridiction
    for (const req of ((s.tripCertificationRequise ?? []) as { jurisdiction: string; code: string }[]))
      if (destinations.includes(req.jurisdiction)) requises.set(req.code, req.jurisdiction);
    for (const j of ((s.crossBorder?.certifications?.juridictionsExigees ?? []) as string[]))
      if (destinations.includes(j)) requises.set(`XB-${j}`, j);                   // R458-repo : codes XB-<pays>, MOD-43
    const motifs: string[] = [];
    for (const [code, jurisdiction] of requises) {
      const certs = await this.prisma.certification.findMany({
        where: { tenantId: ctx.tenantId, userId: trip.travelerId, code } });
      const couvrante = certs.find((c: any) => c.obtenueLe <= trip.dateStart && c.expireLe > trip.dateStart);
      if (couvrante) continue;
      const future = certs.find((c: any) => c.obtenueLe <= trip.dateStart);
      motifs.push(future
        ? `Certification cross-border échue à la date du voyage (${code} expire ${(future as any).expireLe})`
        : `Certification cross-border ${jurisdiction} absente (${code})`);
    }
    return motifs;
  }

  /** R449 : cumul année glissante = PROJECTION des voyages approuvés/effectués — jamais un compteur. */
  private async cumulQuota(ctx: Ctx, trip: any, dest: string) {
    const unAnAvant = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
    const voyages = await this.prisma.trip.findMany({ where: { tenantId: ctx.tenantId,
      travelerId: trip.travelerId, status: { in: ["APPROVED", "IN_PROGRESS", "COMPLETED"] } } });
    return voyages
      .filter((v: any) => ((v.destinations ?? []) as string[]).includes(dest) && v.dateStart >= unAnAvant && v.id !== trip.id)
      .reduce((n: number, v: any) => n + joursDeVoyage(v.dateStart, v.dateEnd), 0)
      + joursDeVoyage(trip.dateStart, trip.dateEnd);
  }

  /** R450 : voyages du RM restés SANS certificat au-delà du SLA (le guard se lève SEUL au visa). */
  private async voyagesNonCertifies(ctx: Ctx, travelerId: string, p: any, aujourdhuiIso?: string) {
    const auj = (aujourdhuiIso ?? new Date().toISOString()).slice(0, 10);
    const sla = p.certificat?.slaJoursOuvres ?? 5;
    const approuves = await this.prisma.trip.findMany({
      where: { tenantId: ctx.tenantId, travelerId, status: "APPROVED" } });
    const retards: any[] = [];
    for (const v of approuves as any[]) {
      if (v.dateEnd >= auj) continue;
      if (joursOuvresDepuis(v.dateEnd, auj) <= sla) continue;
      const clos = await this.prisma.domainEvent.count({
        where: { tenantId: ctx.tenantId, aggregateId: v.id, type: "trip.cloture" } });
      if (!clos) retards.push(v);
    }
    return retards;
  }

  /** R447 : évaluation des guards à CHAQUE tentative — données LIVE, sévérités du registre.
   *  Émission GUARD_BLOCKED HORS transaction (leçon Bloc 62 : le rollback perdrait la trace). */
  private async evaluerGuardsVisa(ctx: Ctx, trip: any, p: any, s: any, etape: string) {
    const bloquants: { guard: string; reason: string }[] = [];
    const avertissements: { guard: string; reason: string }[] = [];
    const pousse = (guard: string, reason: string) => {
      const sev = p.guards?.[guard] ?? "BLOQUANT";
      if (sev === "BLOQUANT") bloquants.push({ guard, reason });
      else if (sev === "AVERTISSEMENT") avertissements.push({ guard, reason });
    };
    for (const motif of await this.certifsManquantes(ctx, trip, s)) pousse("certifValide", motif);
    for (const dest of (trip.destinations ?? []) as string[]) {
      const plafondBanque = p.quotas?.[dest];
      if (plafondBanque != null) {
        const override = p.quotasOverridesRM?.[trip.travelerId]?.[dest];
        const plafond = override ?? plafondBanque;
        const cumul = await this.cumulQuota(ctx, trip, dest);
        if (cumul > plafond)
          pousse("quotaDepasse", `Quota de jours bancables dépassé : ${cumul}/${plafond} (${dest}${override != null ? ", plafond effectif = override RM" : ""})`);
      }
      if ((p.paysSanctions ?? []).includes(dest))
        pousse("paysSanctions", `Destination sous politique sanctions — clearance Compliance requise (${dest})`);
    }
    const dernierCheck: any = (await this.prisma.domainEvent.findMany({
      where: { tenantId: ctx.tenantId, aggregateId: trip.id, type: "trip.check.consigne" },
      orderBy: { id: "asc" } })).pop();
    for (const l of ((dernierCheck?.payload as any)?.parActivite ?? []) as any[]) {
      if (l.position === "NON" || l.verdict === "NON")
        pousse("verdictNON", `Activité interdite : ${l.activite} (${l.jurisdiction})`);
      if (l.verdict === "NON_DETERMINE")
        pousse("destinationHorsRegistre", `Juridiction/activité hors registre : ${l.activite} (${l.jurisdiction}) — analyse Legal requise`);
    }
    if (bloquants.length) {
      for (const b of bloquants)
        await this.emit(this.prisma as any, ctx.tenantId, "GUARD_BLOCKED", trip.id, { ...b, etape });
      throw new BadRequestException(`[R447] ${bloquants[0].reason}`);
    }
    return avertissements;
  }

  /** La chaîne FIGÉE de l'instance (R29) — lue de l'événement de création, jamais re-résolue. */
  private async chaineFigee(ctx: Ctx, tripId: string): Promise<string[] | null> {
    const e: any = (await this.prisma.domainEvent.findMany({
      where: { tenantId: ctx.tenantId, aggregateId: tripId, type: "trip.submitted" },
      orderBy: { id: "asc" } })).pop();
    return ((e?.payload as any)?.chaine as string[]) ?? null;
  }

  // Calcule avis + signaux + visas et passe le voyage en PENDING_APPROVAL (R223/R224/R228/R225).
  // Bloc 63 : si le registre §BusinessTrip est actif (pBT), la chaîne est RÉSOLUE risque×budget,
  // FIGÉE dans l'événement de création, et le check pré-voyage est CONSIGNÉ (R446/R448).
  private async instruire(tx: Tx, ctx: Ctx, trip: any, pBT?: any) {
    const s = await this.settings(tx, ctx);
    const destinations: string[] = trip.destinations ?? [];
    const clients: string[] = trip.clients ?? [];
    const advisories = this.avisA(s.tripCrossBorderReferentiel ?? [], destinations, new Date().toISOString().slice(0, 10));
    const signals: any[] = [];
    // R224 : KYC des clients visités — un seul findMany batché (au lieu d'un findFirst par client, N+1).
    const kycRows = clients.length
      ? await tx.kycFile.findMany({ where: { tenantId: ctx.tenantId, clientId: { in: clients } }, orderBy: { createdAt: "desc" } })
      : [];
    const kycLatest = new Map<string, any>();
    for (const k of kycRows) if (!kycLatest.has(k.clientId)) kycLatest.set(k.clientId, k);   // desc ⇒ le premier vu = le plus récent
    for (const clientId of clients) {
      const kyc = kycLatest.get(clientId);
      if (!kyc || kyc.status !== "VALIDATED")
        signals.push({ type: "KYC_NOT_APPROVED", severite: s.tripKycCheckSeverity ?? "INFORMATIF", detail: `client ${clientId} : KYC ${kyc?.status ?? "ABSENT"}` });
    }
    // R228/R237 : certification requise, résolue depuis MOD-43 à la DATE DU VOYAGE.
    const reqsApplicables = ((s.tripCertificationRequise ?? []) as { jurisdiction: string; code: string }[])
      .filter((req) => destinations.includes(req.jurisdiction));
    const codes = [...new Set(reqsApplicables.map((r) => r.code))];
    const certRows = codes.length
      ? await tx.certification.findMany({ where: { tenantId: ctx.tenantId, userId: trip.travelerId, code: { in: codes } } })
      : [];
    const certsParCode = new Map<string, any[]>();
    for (const c of certRows) (certsParCode.get(c.code) ?? certsParCode.set(c.code, []).get(c.code))!.push(c);
    for (const req of reqsApplicables) {
      const certs = certsParCode.get(req.code) ?? [];
      const couvre = certs.some((c: any) => c.obtenueLe <= trip.dateStart && c.expireLe > trip.dateStart);
      if (!couvre)
        signals.push({ type: "CERTIFICATION_EXPIRED_AT_TRIP_DATE", severite: s.tripCertificationCheckSeverity ?? "INFORMATIF", detail: `${req.code} requise en ${req.jurisdiction}, non couverte au ${trip.dateStart}` });
    }
    if (pBT) {
      // ── Bloc 63 (R446/R448) : chaîne dynamique + check consigné avant tout visa Compliance ──
      const res = this.resoudreChaine(pBT, destinations, (trip as any).budget ?? null);
      for (const role of res.visas)
        await tx.tripVisa.create({ data: { tenantId: ctx.tenantId, tripId: trip.id, role } });
      await this.consignerCheck(tx, ctx, trip, s.tripCrossBorderReferentiel ?? []);
      const maj = await tx.trip.update({ where: { id: trip.id }, data: { status: "PENDING_APPROVAL", advisories, signals } });
      await this.emit(tx, ctx.tenantId, "trip.submitted", trip.id, { destinations,
        avis: advisories.length, signaux: signals.length,
        chaine: res.chaine, origineChaine: res.origineChaine, budget: (trip as any).budget ?? null });
      return maj;
    }
    // R225 : visas = matrice + COMPLIANCE si destination à risque
    const roles = [...new Set<string>(s.tripApprovalMatrix ?? ["DIR"])];
    if (destinations.some((j) => (s.tripJuridictionsRisque ?? []).includes(j))) roles.push("COMPLIANCE");
    for (const role of roles) await tx.tripVisa.create({ data: { tenantId: ctx.tenantId, tripId: trip.id, role } });
    const maj = await tx.trip.update({ where: { id: trip.id }, data: { status: "PENDING_APPROVAL", advisories, signals } });
    await this.emit(tx, ctx.tenantId, "trip.submitted", trip.id, { destinations, avis: advisories.length, signaux: signals.length });
    return maj;
  }

  // ── R222 : soumission (DRAFT → PENDING_APPROVAL), acte tracé.
  //    Bloc 63 (R447/R450) : guard « certificat précédent manquant » évalué AVANT la
  //    transaction — GUARD_BLOCKED émis hors tx (le rollback ne perd jamais le refus). ──
  async soumettre(ctx: Ctx, tripId: string) {
    const pBT = await this.paramsBT(ctx);
    if (pBT && (pBT.guards?.certificatPrecedentManquant ?? "BLOQUANT") !== "DÉSACTIVÉ") {
      const avant = await this.prisma.trip.findFirst({ where: { id: tripId, tenantId: ctx.tenantId } });
      if (avant?.status === "DRAFT") {
        const retards = await this.voyagesNonCertifies(ctx, (avant as any).travelerId, pBT);
        if (retards.length) {
          const reason = `Certificat de trip précédent manquant : voyage ${retards[0].id} non certifié au-delà du SLA (R450)`;
          const sev = pBT.guards?.certificatPrecedentManquant ?? "BLOQUANT";
          if (sev === "BLOQUANT") {
            await this.emit(this.prisma as any, ctx.tenantId, "GUARD_BLOCKED", tripId,
              { guard: "certificatPrecedentManquant", reason, etape: "soumission" });
            throw new BadRequestException(`[R447] ${reason}`);
          }
          await this.emit(this.prisma as any, ctx.tenantId, "GUARD_WARNING", tripId,
            { guard: "certificatPrecedentManquant", reason, etape: "soumission" });
        }
      }
    }
    return this.prisma.$transaction(async (tx: Tx) => {
      const trip = await tx.trip.findFirst({ where: { id: tripId, tenantId: ctx.tenantId } });
      if (!trip) throw new NotFoundException("Voyage introuvable");
      if (trip.status !== "DRAFT") throw new BadRequestException("R222 : seul un DRAFT se soumet");
      const maj = await this.instruire(tx, ctx, trip, pBT ?? undefined);
      await this.audit.log(ctx.tenantId, ctx.userId, "TRIP_SUBMITTED", tripId);
      return maj;
    });
  }

  // ── R225/R13/R224 : viser (approbation).
  //    Bloc 63 (R446/R447) : ordre de la chaîne FIGÉE imposé, guards recalculés à CHAQUE
  //    tentative (données live, sévérités du registre), dérogation motivée sur avertissement. ──
  async viser(ctx: Ctx, tripId: string, role: string, motivation?: string) {
    if (!role) throw new BadRequestException("role requis");
    const pBT = await this.paramsBT(ctx);
    let avertissements: { guard: string; reason: string }[] = [];
    if (pBT) {
      const trip = await this.prisma.trip.findFirst({ where: { id: tripId, tenantId: ctx.tenantId } });
      if (!trip) throw new NotFoundException("Voyage introuvable");
      const chaine = await this.chaineFigee(ctx, tripId);
      if (chaine) {
        const ordre = chaine.filter((r) => r !== "RM");                            // les maillons à visa
        const idx = ordre.indexOf(role);
        if (idx > 0) {
          const precedents = ordre.slice(0, idx);
          const signes = await this.prisma.tripVisa.findMany({
            where: { tenantId: ctx.tenantId, tripId, role: { in: precedents }, status: "SIGNED" } });
          if (signes.length < precedents.length)
            throw new BadRequestException(`[R446] Ordre de la chaîne — le visa ${role} attend ${precedents.join(" → ")}`);
        }
      }
      const s = await loadSettings(this.prisma, ctx.tenantId, true);
      avertissements = await this.evaluerGuardsVisa(ctx, trip, pBT, s, role);      // throw + GUARD_BLOCKED hors tx
    }
    return this.prisma.$transaction(async (tx: Tx) => {
      const trip = await tx.trip.findFirst({ where: { id: tripId, tenantId: ctx.tenantId } });
      if (!trip) throw new NotFoundException("Voyage introuvable");
      if (trip.status !== "PENDING_APPROVAL") throw new BadRequestException("Le voyage n'est pas en attente d'approbation");
      if (trip.travelerId === ctx.userId) throw new ForbiddenException("TRIP_SELF_APPROVAL_FORBIDDEN");             // R13
      if (((trip.signals ?? []) as any[]).some((sig) => sig.type === "KYC_NOT_APPROVED" && sig.severite === "BLOQUANT_APPROBATION"))
        throw new BadRequestException("TRIP_KYC_NOT_APPROVED");                                                    // R224 bloquant
      const visa = await tx.tripVisa.findFirst({ where: { tenantId: ctx.tenantId, tripId, role, status: "PENDING" } });
      if (!visa) throw new BadRequestException(`Aucun visa ${role} en attente`);
      for (const a of avertissements)
        await this.emit(tx, ctx.tenantId, "GUARD_WARNING", tripId, { ...a, etape: role });          // la trace RESTE (R447)
      await tx.tripVisa.update({ where: { id: visa.id }, data: { status: "SIGNED", signedBy: ctx.userId, signedAt: new Date().toISOString() } });
      await this.emit(tx, ctx.tenantId, "trip.visa.signed", tripId,
        { role, par: ctx.userId, ...(motivation ? { motivation } : {}) });         // dérogation portée par le visa
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
    return this.prisma.$transaction(async (tx: Tx) => {
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
    return this.prisma.$transaction(async (tx: Tx) => {
      const trip = await tx.trip.findFirst({ where: { id: tripId, tenantId: ctx.tenantId } });
      if (!trip) throw new NotFoundException("Voyage introuvable");
      const manquants: string[] = [];
      for (const clientId of (trip.clients ?? []) as string[]) {
        const n = await tx.crmContact.count({ where: { tenantId: ctx.tenantId, clientId, at: { gte: new Date(trip.dateEnd) } } });
        if (n === 0) manquants.push(clientId);
      }
      if (manquants.length) await this.emit(tx, ctx.tenantId, "trip.contactreports.manquants", tripId, { manquants });
      return { visites: ((trip.clients ?? []) as string[]).length, manquants, bloque: false };  // R39 : signal, pas coercition
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

  async lister(ctx: Ctx, filtre: { status?: string } & PageParams) {
    const where: any = { tenantId: ctx.tenantId };
    if (filtre.status) where.status = filtre.status;
    const take = applyKeyset(where, filtre);                                       // A4 : défaut borné + curseur keyset
    return this.prisma.trip.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take });
  }

  // ══ Bloc 63 (repo R446–R452 + R465) — delta sur MOD-75, jamais un moteur parallèle ══

  /** R448 : modification pré-approbation — le check est INVALIDÉ (cause tracée), les visas
   *  Compliance (XB/COMPLIANCE/HPB) tombent, un nouveau check est consigné sous la version
   *  en vigueur. La chaîne, elle, reste FIGÉE (R29). */
  async modifier(ctx: Ctx, tripId: string, dto: { destinations?: string[]; activites?: string[]; dateStart?: string; dateEnd?: string }) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const trip = await tx.trip.findFirst({ where: { id: tripId, tenantId: ctx.tenantId } });
      if (!trip) throw new NotFoundException("Voyage introuvable");
      if (!["DRAFT", "PENDING_APPROVAL"].includes(trip.status))
        throw new BadRequestException("R448 : la modification précède l'approbation — après, c'est la révision chaînée (R230)");
      const champs = Object.keys(dto).filter((k) => (dto as any)[k] !== undefined);
      const maj = await tx.trip.update({ where: { id: tripId }, data: {
        ...(dto.destinations ? { destinations: dto.destinations } : {}),
        ...(dto.activites ? { activites: dto.activites } : {}),
        ...(dto.dateStart ? { dateStart: dto.dateStart } : {}),
        ...(dto.dateEnd ? { dateEnd: dto.dateEnd } : {}) } as any });
      if (trip.status === "PENDING_APPROVAL") {
        await this.emit(tx, ctx.tenantId, "trip.check.invalide", tripId,
          { cause: `Modification de ${champs.join(", ")} — le check pré-voyage doit être refait (R448)` });
        const tombes = await tx.tripVisa.updateMany({
          where: { tenantId: ctx.tenantId, tripId, role: { in: ["XB", "COMPLIANCE", "HPB"] }, status: "SIGNED" },
          data: { status: "PENDING", signedBy: null, signedAt: null } });          // retour à l'étape XB
        void tombes;
        const s = await tx.tenant.findFirst({ where: { id: ctx.tenantId } });
        await this.consignerCheck(tx, ctx, maj, ((s!.settings as any) ?? {}).tripCrossBorderReferentiel ?? []);
      }
      await this.audit.log(ctx.tenantId, ctx.userId, "TRIP_MODIFIED", tripId);
      return maj;
    });
  }

  /** R450 : certificat de trip — le RM voyageur certifie, le validateur est RÉSOLU
   *  (MGR sans écart, XB si écart ou risque HIGH) ; un écart ouvre une tâche de
   *  qualification Compliance (R44 : analyse humaine, jamais de sanction automatique). */
  async soumettreCertificat(ctx: Ctx, tripId: string, dto: {
    activitesParJuridiction?: Record<string, string[]>; rencontres?: { clientId: string; contactReportId: string }[];
    ecarts?: any[]; narratif?: string }) {
    const pBT = (await this.paramsBT(ctx)) ?? DEFAUTS_BUSINESSTRIP;
    return this.prisma.$transaction(async (tx: Tx) => {
      const trip = await tx.trip.findFirst({ where: { id: tripId, tenantId: ctx.tenantId } });
      if (!trip) throw new NotFoundException("Voyage introuvable");
      if (trip.status !== "APPROVED") throw new BadRequestException("R450 : seul un voyage APPROUVÉ se certifie");
      if (trip.travelerId !== ctx.userId) throw new ForbiddenException("R450 : le certificat est déclaré par le RM voyageur");
      const ecarts = dto.ecarts ?? [];
      const risque = ((trip.destinations ?? []) as string[]).reduce((acc, d) => {
        const r = pBT.risqueDestinations?.[d] ?? "LOW";
        return NIVEAUX.indexOf(r) > NIVEAUX.indexOf(acc) ? r : acc;
      }, "LOW");
      const validateurResolu = (ecarts.length || risque === "HIGH")
        ? (pBT.certificat?.validateurSiEcart ?? "XB") : (pBT.certificat?.validateurDefaut ?? "MGR");
      const nes = (await tx.domainEvent.findMany({
        where: { tenantId: ctx.tenantId, aggregateId: tripId, type: "trip.prospect.ne" }, orderBy: { id: "asc" } }))
        .map((e: any) => ({ clientId: e.payload.clientId, nom: e.payload.nom, verdictProsp: e.payload.verdictProsp }));
      await this.emit(tx, ctx.tenantId, "trip.certificat.soumis", tripId, {
        par: ctx.userId, role: ctx.role, validateurResolu,
        activitesParJuridiction: dto.activitesParJuridiction ?? {},
        rencontres: dto.rencontres ?? [], ecarts, narratif: dto.narratif ?? "", prospectsNes: nes });
      if (ecarts.length)
        await this.emit(tx, ctx.tenantId, "trip.certificat.qualification.demandee", tripId, { ecarts, par: ctx.userId });
      await this.audit.log(ctx.tenantId, ctx.userId, "TRIP_CERTIFICAT_SOUMIS", tripId);
      return { tripId, validateurResolu, prospectsNes: nes, statut: "Soumis" };
    });
  }

  /** R450 : visa du certificat (R15) — jamais le certifiant (R13) ; clôt le voyage. */
  async viserCertificat(ctx: Ctx, tripId: string) {
    const cert: any = (await this.prisma.domainEvent.findMany({
      where: { tenantId: ctx.tenantId, aggregateId: tripId, type: "trip.certificat.soumis" },
      orderBy: { id: "asc" } })).pop();
    if (!cert) throw new NotFoundException("Aucun certificat soumis pour ce voyage");
    const p: any = cert.payload;
    if (p.par === ctx.userId)
      throw new ForbiddenException("R13 : le RM qui certifie ne vise jamais son propre certificat");
    if (ctx.role !== p.validateurResolu)
      throw new ForbiddenException(`R450 : le validateur résolu de ce certificat est ${p.validateurResolu}`);
    return this.prisma.$transaction(async (tx: Tx) => {
      await this.emit(tx, ctx.tenantId, "trip.certificat.vise", tripId, { par: ctx.userId, role: ctx.role });
      await this.emit(tx, ctx.tenantId, "trip.cloture", tripId, { par: ctx.userId });
      await tx.trip.update({ where: { id: tripId }, data: { status: "COMPLETED" } });
      await this.audit.log(ctx.tenantId, ctx.userId, "TRIP_CERTIFICAT_VISE", tripId);
      return { tripId, statut: "Clôturé" };
    });
  }

  /** R450 : relances SLA — tâches tracées + notification MGR ; le guard R447 fait le reste. */
  async tickSlaCertificats(ctx: Ctx, atIso?: string) {
    const pBT = (await this.paramsBT(ctx)) ?? DEFAUTS_BUSINESSTRIP;
    const auj = atIso ?? new Date().toISOString();
    const enRetard: any[] = [];
    const voyageurs = await this.prisma.trip.findMany({
      where: { tenantId: ctx.tenantId, status: "APPROVED" }, select: { travelerId: true }, distinct: ["travelerId"] });
    for (const v of voyageurs as any[])
      enRetard.push(...await this.voyagesNonCertifies(ctx, v.travelerId, pBT, auj));
    for (const t of enRetard) {
      const joursRetard = joursOuvresDepuis(t.dateEnd, auj) - (pBT.certificat?.slaJoursOuvres ?? 5);
      await this.prisma.$transaction(async (tx: Tx) =>
        this.emit(tx, ctx.tenantId, "trip.certificat.relance", t.id, { joursRetard, notifie: "MGR" }));
    }
    return { relances: enRetard.length };
  }

  /** R465 : prospect né en voyage — origine tracée (voyage + contact report), verdict PROSP
   *  d'origine porté, entrée dans le circuit d'onboarding STANDARD (aucun raccourci). */
  async declarerProspect(ctx: Ctx, tripId: string, dto: { nom: string; pays: string; contactReportId: string }) {
    if (!dto?.nom || !dto?.contactReportId) throw new BadRequestException("nom et contactReportId requis");
    const trip = await this.prisma.trip.findFirst({ where: { id: tripId, tenantId: ctx.tenantId } });
    if (!trip) throw new NotFoundException("Voyage introuvable");
    const s = await loadSettings(this.prisma, ctx.tenantId, true);
    const verdict = evaluerXb(s.tripCrossBorderReferentiel ?? [], dto.pays ?? "—", ["PROSP"], new Date().toISOString());
    const ligne: any = verdict.parActivite[0] ?? {};
    return this.prisma.$transaction(async (tx: Tx) => {
      const prospect = await tx.client.create({ data: { tenantId: ctx.tenantId, name: dto.nom,
        structure: "PP", country: (dto.pays ?? "CH").slice(0, 2), riskLevel: "MEDIUM", rmUserId: trip.travelerId } as any });
      await tx.onboarding.create({ data: { tenantId: ctx.tenantId, prospectNom: dto.nom,
        rmId: trip.travelerId, etape: "PROSPECT", etapeDepuis: new Date() } as any });     // aiguillage standard (R59/WR0)
      await this.emit(tx, ctx.tenantId, "trip.prospect.ne", tripId, {
        clientId: prospect.id, contactReportId: dto.contactReportId, nom: dto.nom,
        verdictProsp: { verdict: verdict.verdict, ...(ligne.position ? { position: ligne.position } : {}) } });
      await this.audit.log(ctx.tenantId, ctx.userId, "TRIP_PROSPECT_NE", `${tripId}:${prospect.id}`);
      return { prospectId: prospect.id, verdictProsp: verdict.verdict };
    });
  }

  /** R448/R48 : rejeu à date — le verdict d'ÉPOQUE, recalculé sur les entrées ≤ asOf, jamais après. */
  async rejouerCheck(ctx: Ctx, tripId: string, asOf: string) {
    const trip = await this.prisma.trip.findFirst({ where: { id: tripId, tenantId: ctx.tenantId } });
    if (!trip) throw new NotFoundException("Voyage introuvable");
    const s = await loadSettings(this.prisma, ctx.tenantId, true);
    const ref = ((s.tripCrossBorderReferentiel ?? []) as any[]).filter((e) => e.depuisLe <= asOf.slice(0, 10));
    const destinations: string[] = (trip.destinations ?? []) as string[];
    const activites: string[] = ((trip as any).activites ?? []) as string[];
    const parActivite: any[] = [];
    for (const j of destinations)
      for (const a of evaluerXb(ref, j, activites.length ? activites : ["MEET"], asOf).parActivite)
        parActivite.push({ jurisdiction: j, ...a });
    const versions = ref.filter((e) => destinations.includes(e.jurisdiction)).map((e) => e.depuisLe).sort();
    return { asOf, referentielVersion: versions[versions.length - 1] ?? "—", parActivite };
  }

  /** R452 : le registre §BusinessTrip résolu à date (mécanisme commun param-engagement). */
  async parametresBT(ctx: Ctx, at?: Date) {
    return (await this.paramsBT(ctx, at)) ?? JSON.parse(JSON.stringify(DEFAUTS_BUSINESSTRIP));
  }

  /** R452/R445 : pop-up d'engagement — mécanisme COMMUN du Bloc 62, étendu, jamais dupliqué. */
  async modifierParametreBT(ctx: Ctx, dto: { cle: string; valeur: any; enVigueurLe: string;
    confirmation?: { engagementTexte: string; auteur: string } }) {
    const s = await loadSettings(this.prisma, ctx.tenantId, true);
    return modifierParametreGouverne(this.prisma, ctx, {
      aggregate: AGG_PARAMS_BT, cle: dto.cle, valeur: dto.valeur, enVigueurLe: dto.enVigueurLe,
      confirmation: dto.confirmation, base: fusionProfonde(DEFAUTS_BUSINESSTRIP, s.businessTrip ?? {}),
      portee: "demandes futures — grandfathering R29 sur les demandes en cours",
      extraPopup: (cle) => (/paysSanctions|guards\.|matricePays/i.test(cle)
        ? { rappelReglementaire: "Rappel : affaiblir une garde sanctions/cross-border n'éteint aucune " +
            "obligation réglementaire — engagement de responsabilité requis (R452)." } : {}),
      apresEmission: async () => { await this.audit.log(ctx.tenantId, ctx.userId, "BT_PARAM_CHANGED", dto.cle); },
    });
  }
}

@Controller("trips")
export class BusinessTripController {
  constructor(private svc: BusinessTripService) {}
  @Post()                    creer(@Req() r: any, @Body() b: any) { return this.svc.creer(r.ctx, b); }                                  // R222
  @Get()                     lister(@Req() r: any, @Query("status") status?: string, @Query("limit") limit?: string, @Query("cursor") cursor?: string) { return this.svc.lister(r.ctx, { status, limit, cursor }); }
  @Get(":id")                get(@Req() r: any, @Param("id") id: string, @Query("asOf") asOf?: string) { return this.svc.get(r.ctx, id, asOf); } // R229
  @Post(":id/submit")        soumettre(@Req() r: any, @Param("id") id: string) { return this.svc.soumettre(r.ctx, id); }                 // R222
  @Post(":id/visa")          viser(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.viser(r.ctx, id, b?.role); } // R225/R13
  @Post(":id/revise")        reviser(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.reviser(r.ctx, id, b); }  // R230
  @Post(":id/contact-reports/mesurer") mesurer(@Req() r: any, @Param("id") id: string) { return this.svc.mesurerContactReports(r.ctx, id); } // R226
}

@Module({
  controllers: [BusinessTripController],
  providers: [
    { provide: BusinessTripService, useFactory: (p: PrismaService, a: AuditService) => new BusinessTripService(p, a), inject: [PrismaService, AuditService] }],
  exports: [BusinessTripService],
})
export class BusinessTripModule {}
