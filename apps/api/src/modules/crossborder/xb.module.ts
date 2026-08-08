import { Body, Controller, ForbiddenException, Get, Module, NotFoundException, Param, Post, Req, Injectable, BadRequestException, UnprocessableEntityException } from "@nestjs/common";
import { emitEvent } from "../../common/domain-event";
import { randomUUID } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { loadSettings } from "../../common/tenant-settings";
import { fusionProfonde, modifierParametreGouverne, resoudreParametresGouvernes } from "../../common/param-engagement";
import { Tx } from "../../common/tx";

// ── Bloc 64 (repo R453–R462) — registre §CrossBorder (R462) : défauts du spec §2. ──
const AGG_MATRICE = "xb-matrice";
const AGG_PARAMS_XB = "crossborder-params";
export const DEFAUTS_CROSSBORDER = {
  fournisseur: "INTERNE", syncFrequenceHeures: 24, syncAlerteEchecJours: 2,
  paysDomestique: "CH",
  acteDistant: { severiteNON: "AVERTISSEMENT",
    mappingEntretienActivites: { "Conseil en placement": ["ADVICE"], "Conseil": ["ADVICE"],
      "Envoi documentation": ["MKT"], "Prise d'ordre": ["ORDER"], "Courtoisie": ["MEET"] } as Record<string, string[]> },
  preActe: { severites: { MKT: "BLOQUANT", ADVICE: "BLOQUANT", ORDER: "BLOQUANT" } as Record<string, string> },
  reverseSolicitation: { validiteMois: 12, rolesEnregistrement: ["RM", "CO", "CO_SR"] },
  localisationTemporaire: { dureeMaxJours: 90 },
  certifications: { juridictionsExigees: [] as string[], severiteAbsence: "BLOQUANT" },
  entites: {} as Record<string, any>,
  entiteParClient: {} as Record<string, string>,
};
const CANAUX_DISTANTS = ["Visioconférence", "Appel", "Email"];
const ORDRE_VERDICT: Record<string, number> = { OK: 0, AUTORISEE: 0, COND: 1, NON: 2 };

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

/** Bloc 64 (R453) — PORT fournisseur de matrice : le savoir vient d'une source déclarée
 *  par tenant (INDIGITA_API | APIAX_API | IMPORT_BRP | INTERNE), O-Live l'orchestre.
 *  Contrat + mock UNIQUEMENT pour les adaptateurs réseau (E-XB-2 : intégration réelle hors session). */
export interface CrossBorderRuleProvider {
  source: string;                                        // INDIGITA_API | APIAX_API | IMPORT_BRP | INTERNE
  /** L'état complet du référentiel unifié chez le fournisseur (un objet PAR juridiction :
   *  verdicts d'activités ET champs de synthèse — E-XB-3, jamais deux vérités). */
  lire(): Promise<Array<{ jurisdiction: string; activites: Record<string, string>;
    statut?: string; sollicitation?: string; licence?: string; produits?: string[] }>>;
}

@Injectable()
export class XbService {
  constructor(private prisma: PrismaService, private audit: AuditService,
    private ports: { matrice?: CrossBorderRuleProvider } = {}) {}

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

  // ══ Bloc 64 (repo R453–R462) — delta sur R293–R295 : le country manual reste LA clé,
  //    le port le VERSIONNE (jamais deux vérités — E-XB-3), les checks s'exécutent AU
  //    MOMENT de l'acte et chaque verdict est un événement rejouable à date. ══

  /** R462 : le registre §CrossBorder résolu à date (mécanisme commun param-engagement). */
  private async paramsXB(ctx: Ctx, at?: Date) {
    const s = await loadSettings(this.prisma, ctx.tenantId, true);
    const base = fusionProfonde(DEFAUTS_CROSSBORDER, s.crossBorder ?? {});
    return resoudreParametresGouvernes(this.prisma, ctx.tenantId, AGG_PARAMS_XB, base, at);
  }

  private async evsMatrice(ctx: Ctx) {
    return this.prisma.domainEvent.findMany({
      where: { tenantId: ctx.tenantId, aggregateId: AGG_MATRICE }, orderBy: { id: "asc" } });
  }

  /** Le référentiel unifié du fournisseur INTERNE : projection du country manual R293. */
  private entreesInternes(s: any) {
    const parJ = new Map<string, any>();
    for (const e of ((s.tripCrossBorderReferentiel ?? []) as any[])) {
      const o = parJ.get(e.jurisdiction) ?? { jurisdiction: e.jurisdiction, activites: {} };
      o.activites[e.activite] = e.verdict === "AUTORISEE" ? "OK" : e.verdict;
      if (e.licence) o.licence = e.licence;
      if (e.source) o.source = e.source;
      parJ.set(e.jurisdiction, o);
    }
    return [...parJ.values()];
  }

  /** R453 : synchronisation → version datée IMMUABLE + MATRIX_SYNCED (diff lisible) +
   *  analyse d'impact R459 (tâches nominatives, notification — JAMAIS une annulation). */
  async syncMatrice(ctx: Ctx, atIso?: string) {
    const p = await this.paramsXB(ctx);
    const s = await loadSettings(this.prisma, ctx.tenantId, true);
    const source = this.ports.matrice?.source ?? p.fournisseur ?? "INTERNE";
    let entrees: any[];
    try {
      entrees = this.ports.matrice ? await this.ports.matrice.lire() : this.entreesInternes(s);
    } catch (err: any) {
      await this.prisma.$transaction(async (tx: Tx) => {
        await this.emit(tx, ctx.tenantId, "xb.matrice.sync.echec", AGG_MATRICE,
          { source, erreur: String(err?.message ?? err), at: new Date().toISOString() });
        await this.emit(tx, ctx.tenantId, "xb.tache.creee", AGG_MATRICE,
          { type: "verifier-source-cross-border" });                       // tâche Compliance — jamais un échec silencieux
      });
      throw new BadRequestException(`R453 : échec de synchronisation ${source} — dernière version connue servie, tâche Compliance créée`);
    }
    const evs = await this.evsMatrice(ctx);
    const derniere: any = evs.filter((e: any) => e.type === "MATRIX_SYNCED").pop();
    const avant: any[] = (derniere?.payload as any)?.entrees ?? [];
    const diff: any[] = [];
    for (const n of entrees) {
      const a = avant.find((x) => x.jurisdiction === n.jurisdiction);
      for (const act of Object.keys(n.activites ?? {}))
        if ((a?.activites?.[act] ?? null) !== n.activites[act])
          diff.push({ jurisdiction: n.jurisdiction, activite: act, ancien: a?.activites?.[act] ?? null, nouveau: n.activites[act] });
    }
    const versionId = randomUUID();
    const at = atIso ?? new Date().toISOString();
    await this.prisma.$transaction(async (tx: Tx) =>
      this.emit(tx, ctx.tenantId, "MATRIX_SYNCED", AGG_MATRICE, { versionId, source, entrees, diff, at }));
    // ── R459 : impact des DÉGRADATIONS — tâches + notification, aucun voyage annulé (R29/R44) ──
    const degradations = diff.filter((d) =>
      (ORDRE_VERDICT[d.nouveau] ?? 0) > (ORDRE_VERDICT[d.ancien ?? "OK"] ?? 0) && d.ancien != null);
    let impact: any = null;
    if (degradations.length) {
      const auj = new Date().toISOString().slice(0, 10);
      const juridictions = [...new Set(degradations.map((d) => d.jurisdiction))];
      let voyagesARevoir = 0;
      for (const d of degradations) {
        const voyages = await this.prisma.trip.findMany({
          where: { tenantId: ctx.tenantId, status: "APPROVED" } });
        for (const v of voyages as any[]) {
          if (v.dateEnd < auj) continue;
          if (!((v.destinations ?? []) as string[]).includes(d.jurisdiction)) continue;
          const acts = ((v.activites ?? []) as string[]);
          if (acts.length && !acts.includes(d.activite)) continue;
          voyagesARevoir++;
          await this.prisma.$transaction(async (tx: Tx) => {
            await this.emit(tx, ctx.tenantId, "xb.tache.creee", v.id,
              { type: "revue-voyage", voyageId: v.id, assigneRole: "XB" });
            await this.emit(tx, ctx.tenantId, "xb.tache.creee", v.id,
              { type: "information-rm", voyageId: v.id, rm: v.travelerId });
          });
        }
      }
      const clientsAffectes = await this.prisma.client.count({
        where: { tenantId: ctx.tenantId, country: { in: juridictions } } });
      const preuves = (await this.prisma.domainEvent.findMany({
        where: { tenantId: ctx.tenantId, type: "xb.rs.enregistree" } })) as any[];
      const clientsJ = new Set(((await this.prisma.client.findMany({
        where: { tenantId: ctx.tenantId, country: { in: juridictions } }, select: { id: true } })) as any[]).map((c) => c.id));
      const preuvesInsuffisantes = preuves.filter((e) => clientsJ.has((e.payload as any).clientId)).length;
      await this.prisma.$transaction(async (tx: Tx) =>
        this.emit(tx, ctx.tenantId, "xb.impact.notifie", AGG_MATRICE,
          { versionId, clientsAffectes, voyagesARevoir, preuvesInsuffisantes }));
      impact = { clientsAffectes, voyagesARevoir, preuvesInsuffisantes };
    }
    await this.audit.log(ctx.tenantId, ctx.userId, "XB_MATRIX_SYNCED", versionId);
    return { versionId, at, source, diff, impact };
  }

  /** R453 : version courante (ou ≤ asOf) — l'âge d'une sync en échec est PORTÉ, jamais tu. */
  async matriceCourante(ctx: Ctx, asOf?: string) {
    const evs = await this.evsMatrice(ctx);
    const synced = evs.filter((e: any) => e.type === "MATRIX_SYNCED");
    const visibles = asOf ? synced.filter((e: any) => (e.payload as any).at <= asOf) : synced;
    const derniere: any = visibles.pop();
    if (!derniere) throw new NotFoundException("R453 : aucune version de matrice — synchronisez le port");
    const dernierEchec: any = evs.filter((e: any) => e.type === "xb.matrice.sync.echec").pop();
    const syncEnEchec = !!dernierEchec && dernierEchec.id > (synced[synced.length - 1] ?? derniere).id;
    const p = derniere.payload as any;
    const joursEchec = syncEnEchec
      ? Math.max(1, Math.round((Date.now() - new Date(p.at).getTime()) / 86_400_000)) : 0;
    return { versionId: p.versionId, at: p.at, source: p.source, entrees: p.entrees,
      syncEnEchec, ...(syncEnEchec ? { noteSync: `matrice du ${String(p.at).slice(0, 10)} — synchronisation en échec depuis ${joursEchec} j` } : {}) };
  }

  /** Juridiction RÉSOLUE d'un client : localisation temporaire (R457) sinon domicile. */
  private async juridictionClient(ctx: Ctx, clientId: string, atIso: string) {
    const client: any = await this.prisma.client.findFirst({ where: { id: clientId, tenantId: ctx.tenantId } });
    if (!client) throw new NotFoundException("Client introuvable");
    const locs = (await this.prisma.domainEvent.findMany({
      where: { tenantId: ctx.tenantId, aggregateId: clientId, type: "xb.localisation.declaree" },
      orderBy: { id: "asc" } })) as any[];
    const jour = atIso.slice(0, 10);
    const active = locs.map((e) => e.payload as any).filter((l) => l.du <= jour && jour <= l.au).pop();
    return { juridiction: active?.juridiction ?? client.country, localisation: !!active, client };
  }

  /** Preuve de reverse solicitation VALIDE pour (client, périmètre) — visée, dans le périmètre, non expirée. */
  private async preuveRS(ctx: Ctx, clientId: string, perimetre: string | undefined, validiteMois: number) {
    const enr = (await this.prisma.domainEvent.findMany({
      where: { tenantId: ctx.tenantId, type: "xb.rs.enregistree" }, orderBy: { id: "asc" } })) as any[];
    const visas = new Set(((await this.prisma.domainEvent.findMany({
      where: { tenantId: ctx.tenantId, type: "xb.rs.visee" } })) as any[]).map((e) => e.aggregateId));
    const duClient = enr.filter((e) => (e.payload as any).clientId === clientId && visas.has(e.aggregateId));
    const dansPerimetre = duClient.filter((e) => !perimetre || (e.payload as any).perimetre === perimetre);
    if (!dansPerimetre.length)
      return { statut: duClient.length ? "HORS_PERIMETRE" : "ABSENTE" as string, preuveId: null as string | null, mois: 0 };
    const preuve = dansPerimetre[dansPerimetre.length - 1];
    const jours = (Date.now() - new Date((preuve.payload as any).date).getTime()) / 86_400_000;
    const mois = Math.round(jours / 30.44);
    if (jours > validiteMois * 30.44) return { statut: "EXPIREE", preuveId: preuve.aggregateId, mois };
    return { statut: "VALIDE", preuveId: preuve.aggregateId, mois };
  }

  /** Le verdict unifié (matrice versionnée + exemption d'entité R461) pour UNE activité. */
  private async verdictActe(ctx: Ctx, p: any, clientId: string, type: string, atIso: string, perimetre?: string) {
    const { juridiction, client } = await this.juridictionClient(ctx, clientId, atIso);
    if (juridiction === (p.paysDomestique ?? "CH"))
      return { juridiction, verdict: "DOMESTIQUE", passe: true, versionMatrice: "—", client };
    const m = await this.matriceCourante(ctx);
    const entree = (m.entrees as any[]).find((e) => e.jurisdiction === juridiction);
    let verdict = entree?.activites?.[type] ?? "NON_DETERMINE";
    let mention: string | undefined; let exemptee = false;
    const entite = p.entiteParClient?.[clientId];
    const exemption = entite ? p.entites?.[entite]?.exemptions?.[juridiction]?.[type] : undefined;
    if (exemption) { verdict = exemption.verdict; mention = `via exemption ${exemption.exemption} — entité ${entite}`; exemptee = true; }
    else if (entite) mention = `entité ${entite} — aucune exemption ${juridiction}`;
    const res: any = { juridiction, verdict, versionMatrice: m.versionId, client,
      ...(mention ? { mention } : {}), ...(m.syncEnEchec ? { noteSync: m.noteSync } : {}) };
    if (verdict === "COND" && !exemptee && /reverse/i.test(entree?.sollicitation ?? "reverse solicitation documentée")) {
      const preuve = await this.preuveRS(ctx, clientId, perimetre, p.reverseSolicitation?.validiteMois ?? 12);
      if (preuve.statut === "VALIDE") { res.passe = true; res.preuveId = preuve.preuveId; res.condition = entree?.sollicitation; }
      else {
        res.passe = false;
        res.motif = preuve.statut === "EXPIREE"
          ? `preuve de reverse solicitation expirée (${preuve.mois} mois > ${p.reverseSolicitation?.validiteMois ?? 12})`
          : preuve.statut === "HORS_PERIMETRE"
            ? `la preuve de reverse solicitation ne couvre pas ce périmètre (${perimetre})`
            : `reverse solicitation documentée requise — aucune preuve valide (${perimetre ?? type}×${juridiction})`;
        res.preuveStatut = preuve.statut;
      }
    } else res.passe = verdict !== "NON" && verdict !== "NON_DETERMINE";
    if (verdict === "COND") res.condition = res.condition ?? entree?.sollicitation ?? "condition — voir country manual";
    return res;
  }

  /** R454 : contact report DISTANT — même check que le voyage, verdict CONSIGNÉ dans l'acte. */
  async contactReportDistant(ctx: Ctx, dto: { clientId: string; canal: string; typeEntretien: string }, atIso?: string) {
    if (!dto?.clientId || !dto?.canal || !dto?.typeEntretien)
      throw new BadRequestException("clientId, canal et typeEntretien requis");
    if (!CANAUX_DISTANTS.includes(dto.canal))
      throw new BadRequestException(`R454 : canaux distants = ${CANAUX_DISTANTS.join(", ")}`);
    const at = atIso ?? new Date().toISOString();
    const p = await this.paramsXB(ctx);
    const activites: string[] = p.acteDistant?.mappingEntretienActivites?.[dto.typeEntretien] ?? ["MEET"];
    const verdicts = [];
    for (const a of activites) verdicts.push({ activite: a, ...(await this.verdictActe(ctx, p, dto.clientId, a, at)) });
    const pire = verdicts.reduce((acc, v) => (ORDRE_VERDICT[v.verdict] ?? 0) >= (ORDRE_VERDICT[acc.verdict] ?? 0) ? v : acc, verdicts[0]);
    const check = { juridiction: pire.juridiction, activites, verdict: pire.verdict,
      versionMatrice: pire.versionMatrice, passe: !!pire.passe,
      ...(pire.motif ? { motif: pire.motif } : {}), ...(pire.noteSync ? { noteSync: pire.noteSync } : {}) };
    const sevNON = p.acteDistant?.severiteNON ?? "AVERTISSEMENT";
    if (pire.verdict === "NON" && sevNON === "BLOQUANT")
      throw new UnprocessableEntityException(
        `R454 : verdict NON (${pire.juridiction}) — la création du compte rendu exige une qualification Compliance préalable`);
    return this.prisma.$transaction(async (tx: Tx) => {
      const cr = await tx.crmContact.create({ data: { tenantId: ctx.tenantId, clientId: dto.clientId,
        type: dto.typeEntretien, contenu: { canal: dto.canal, verdictXb: check }, origine: "MANUEL",
        par: ctx.userId, ...(atIso ? { at: new Date(atIso) } : {}) } as any });
      if (pire.verdict === "NON") {
        await this.emit(tx, ctx.tenantId, "GUARD_WARNING", cr.id,
          { guard: "verdictNON", reason: `verdict NON — ${activites.join("/")} (${pire.juridiction})`, etape: "acte-distant" });
        await this.emit(tx, ctx.tenantId, "xb.tache.creee", cr.id,
          { type: "qualification-compliance", contactReportId: cr.id, clientId: dto.clientId });
      }
      await this.audit.log(ctx.tenantId, ctx.userId, "XB_ACTE_DISTANT", cr.id);
      return { contactReportId: cr.id, check };
    });
  }

  /** R455 : check pré-acte embarqué — le verdict (avec version) est ATTACHÉ à l'objet. */
  async checkPreActe(ctx: Ctx, dto: { type: string; clientId: string; objetId?: string; perimetre?: string }, atIso?: string) {
    if (!dto?.type || !dto?.clientId) throw new BadRequestException("type et clientId requis");
    const at = atIso ?? new Date().toISOString();
    const p = await this.paramsXB(ctx);
    const v = await this.verdictActe(ctx, p, dto.clientId, dto.type, at, dto.perimetre);
    const sev = p.preActe?.severites?.[dto.type] ?? "BLOQUANT";
    const consigner = async (passe: boolean, motif?: string) => {
      if (!dto.objetId) return;
      await this.prisma.$transaction(async (tx: Tx) =>
        this.emit(tx, ctx.tenantId, "xb.preacte.verdict", dto.objetId!, {
          type: dto.type, clientId: dto.clientId, juridiction: v.juridiction, verdict: v.verdict,
          passe, versionMatrice: String(v.versionMatrice), at,
          ...(dto.perimetre ? { perimetre: dto.perimetre } : {}), ...(v.condition ? { condition: v.condition } : {}),
          ...(v.preuveId ? { preuveId: v.preuveId } : {}), ...(v.mention ? { mention: v.mention } : {}),
          ...(motif ? { motif } : {}) }));
    };
    if (v.verdict === "NON" || v.verdict === "NON_DETERMINE") {
      const motif = `${dto.type} interdit — ${v.juridiction}, matrice ${String(v.versionMatrice).slice(0, 8)}` +
        (v.mention ? ` (${v.mention})` : "");
      await consigner(false, motif);
      if (sev === "BLOQUANT") throw new UnprocessableEntityException(`R455 : ${motif}`);
      return { passe: false, refuse: false, avertissement: motif, verdict: v.verdict,
        versionMatrice: v.versionMatrice, juridiction: v.juridiction, ...(v.noteSync ? { noteSync: v.noteSync } : {}) };
    }
    if (v.passe === false) {                                   // COND non satisfaite (preuve RS absente/expirée/hors périmètre)
      await consigner(false, v.motif);
      if (v.preuveStatut === "EXPIREE")
        await this.prisma.$transaction(async (tx: Tx) =>
          this.emit(tx, ctx.tenantId, "xb.tache.creee", dto.clientId,
            { type: "renouveler-reverse-solicitation", clientId: dto.clientId, perimetre: dto.perimetre ?? null }));
      throw new UnprocessableEntityException(`R456 : ${v.motif}`);
    }
    await consigner(true);
    return { passe: true, refuse: false, verdict: v.verdict, versionMatrice: v.versionMatrice,
      juridiction: v.juridiction, ...(v.preuveId ? { preuveId: v.preuveId } : {}),
      ...(v.mention ? { mention: v.mention } : {}), ...(v.condition ? { condition: v.condition } : {}),
      ...(v.noteSync ? { noteSync: v.noteSync } : {}) };
  }

  /** R456 : la preuve est un OBJET — nature, document GED, date, périmètre, visée (R15). */
  async enregistrerPreuveRS(ctx: Ctx, dto: { clientId: string; perimetre: string; nature: string; docId: string; date: string }) {
    if (!dto?.clientId || !dto?.perimetre || !dto?.docId) throw new BadRequestException("clientId, perimetre et docId requis");
    const p = await this.paramsXB(ctx);
    if (!(p.reverseSolicitation?.rolesEnregistrement ?? ["RM", "CO", "CO_SR"]).includes(ctx.role))
      throw new ForbiddenException(`R456 : rôles habilités = ${(p.reverseSolicitation?.rolesEnregistrement ?? []).join(", ")}`);
    const preuveId = randomUUID();
    await this.prisma.$transaction(async (tx: Tx) =>
      this.emit(tx, ctx.tenantId, "xb.rs.enregistree", preuveId, {
        clientId: dto.clientId, perimetre: dto.perimetre, nature: dto.nature ?? "—",
        docId: dto.docId, date: dto.date ?? new Date().toISOString().slice(0, 10), par: ctx.userId }));
    await this.audit.log(ctx.tenantId, ctx.userId, "XB_RS_ENREGISTREE", preuveId);
    return { preuveId };
  }

  async viserPreuveRS(ctx: Ctx, preuveId: string) {
    const enr: any = (await this.prisma.domainEvent.findMany({
      where: { tenantId: ctx.tenantId, aggregateId: preuveId, type: "xb.rs.enregistree" } })).pop();
    if (!enr) throw new NotFoundException("Preuve introuvable");
    if ((enr.payload as any).par === ctx.userId)
      throw new ForbiddenException("R13 : la preuve est visée par un SECOND regard");
    await this.prisma.$transaction(async (tx: Tx) =>
      this.emit(tx, ctx.tenantId, "xb.rs.visee", preuveId, { par: ctx.userId }));
    return { preuveId, visee: true };
  }

  /** R457 : localisation temporaire — événement daté, expiration automatique (le rejeu résout). */
  async declarerLocalisation(ctx: Ctx, dto: { clientId: string; juridiction: string; du: string; au: string }) {
    if (!dto?.clientId || !dto?.juridiction || !dto?.du || !dto?.au)
      throw new BadRequestException("clientId, juridiction, du et au requis");
    const p = await this.paramsXB(ctx);
    const jours = (new Date(dto.au).getTime() - new Date(dto.du).getTime()) / 86_400_000;
    if (jours > (p.localisationTemporaire?.dureeMaxJours ?? 90))
      throw new BadRequestException(`R457 : au-delà de ${p.localisationTemporaire?.dureeMaxJours ?? 90} jours, revue de résidence requise`);
    await this.prisma.$transaction(async (tx: Tx) =>
      this.emit(tx, ctx.tenantId, "xb.localisation.declaree", dto.clientId,
        { juridiction: dto.juridiction, du: dto.du, au: dto.au, par: ctx.userId }));
    await this.audit.log(ctx.tenantId, ctx.userId, "XB_LOCALISATION", `${dto.clientId}:${dto.juridiction}`);
    return { clientId: dto.clientId, juridiction: dto.juridiction, du: dto.du, au: dto.au };
  }

  /** R460 : exposition consolidée — PROJECTION calculée des événements à chaque appel. */
  async expositionCrossBorder(ctx: Ctx) {
    const clients = (await this.prisma.client.findMany({ where: { tenantId: ctx.tenantId } })) as any[];
    const voyages = (await this.prisma.trip.findMany({ where: { tenantId: ctx.tenantId } })) as any[];
    const reports = (await this.prisma.crmContact.findMany({ where: { tenantId: ctx.tenantId } })) as any[];
    const derogs = (await this.prisma.domainEvent.findMany({ where: { tenantId: ctx.tenantId, type: "xb.derogation.visee" } })) as any[];
    const preuves = (await this.prisma.domainEvent.findMany({ where: { tenantId: ctx.tenantId, type: "xb.rs.enregistree" } })) as any[];
    const visees = new Set(((await this.prisma.domainEvent.findMany({ where: { tenantId: ctx.tenantId, type: "xb.rs.visee" } })) as any[]).map((e) => e.aggregateId));
    const certifs = (await this.prisma.certification.findMany({ where: { tenantId: ctx.tenantId } })) as any[];
    const clientPays = new Map(clients.map((c) => [c.id, c.country]));
    const juridictions = new Set<string>();
    for (const c of clients) juridictions.add(c.country);
    for (const v of voyages) for (const d of ((v.destinations ?? []) as string[])) juridictions.add(d);
    const parJuridiction = [...juridictions].map((j) => ({
      juridiction: j,
      clients: clients.filter((c) => c.country === j).length,
      aum: null,                                              // AUM absent du modèle — consigné, jamais inventé
      voyages: voyages.filter((v) => ((v.destinations ?? []) as string[]).includes(j)).length,
      actesDistants: reports.filter((r) => (r.contenu as any)?.verdictXb?.juridiction === j).length,
      derogations: derogs.filter((e) => (e.payload as any).juridiction === j).length,
      preuvesActives: preuves.filter((e) => visees.has(e.aggregateId) && clientPays.get((e.payload as any).clientId) === j).length,
      certifications: certifs.filter((c) => c.code === `XB-${j}`).length,
    }));
    return { parJuridiction, calculeLe: new Date().toISOString() };
  }

  /** R453/R455/R48 : rejeu à date — le verdict CONSIGNÉ d'époque, jamais recalculé. */
  async rejouerActe(ctx: Ctx, objetId: string, asOf: string) {
    const actes = (await this.prisma.domainEvent.findMany({
      where: { tenantId: ctx.tenantId, aggregateId: objetId, type: "xb.preacte.verdict" },
      orderBy: { id: "asc" } })) as any[];
    const visibles = actes.filter((e) => ((e.payload as any).at ?? "") <= asOf);
    const acte: any = (visibles.length ? visibles : actes).pop();
    if (!acte) throw new NotFoundException("Aucun verdict consigné pour cet objet");
    return { ...(acte.payload as any), rejoueA: asOf };
  }

  /** R462/R445 : pop-up d'engagement — mécanisme COMMUN du Bloc 62, étendu, jamais dupliqué. */
  async modifierParametreXB(ctx: Ctx, dto: { cle: string; valeur: any; enVigueurLe: string;
    confirmation?: { engagementTexte: string; auteur: string } }) {
    const s = await loadSettings(this.prisma, ctx.tenantId, true);
    return modifierParametreGouverne(this.prisma, ctx, {
      aggregate: AGG_PARAMS_XB, cle: dto.cle, valeur: dto.valeur, enVigueurLe: dto.enVigueurLe,
      confirmation: dto.confirmation, base: fusionProfonde(DEFAUTS_CROSSBORDER, s.crossBorder ?? {}),
      portee: "actes futurs — grandfathering R29 sur les checks déjà consignés",
      extraPopup: (cle) => (/severite|entites|exemption/i.test(cle)
        ? { rappelReglementaire: "Rappel : la diffusion transfrontière et les exemptions engagent la banque " +
            "vis-à-vis des régulateurs étrangers — engagement de responsabilité requis (R462)." } : {}),
      apresEmission: async () => { await this.audit.log(ctx.tenantId, ctx.userId, "XB_PARAM_CHANGED", dto.cle); },
    });
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

@Module({ controllers: [XbController],
  providers: [{ provide: XbService,
    useFactory: (p: PrismaService, a: AuditService) => new XbService(p, a, {}),   // port matrice : INTERNE par défaut (R453) — adaptateurs réseau hors session (E-XB-2)
    inject: [PrismaService, AuditService] }],
  exports: [XbService] })
export class XbModule {}
