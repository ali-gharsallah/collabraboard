import { Body, Controller, Get, Module, Param, Post, Query, Req, Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from "@nestjs/common";
import { emitEvent } from "../../common/domain-event";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { Tx } from "../../common/tx";
import { SECTIONS_BY_WORKFLOW } from "../kyc/kyc.templates";
import { RevueHarmoniseeService } from "./revue-harmonisee.service";   // R283 : source UNIQUE du gabarit (import de données, pas de cycle DI)

/**
 * Échéances de review — R272→R275 (RV-01..08), canon `spec/canon-debloquants-home.md` partie 1
 * (ratifié 2026-07-27). Le « Perpetual KYC » d'O-Live : calculé, versionné, rejouable.
 * R272 : l'échéance est CALCULÉE à l'approbation du KYC (hook sur l'événement existant — PAS un
 * cron) ; la cadence appliquée est FIGÉE dans la ligne (grandfathering R29 : changer le paramètre
 * ne réécrit rien, RV-02). R273 : l'anticipation est un ÉVÉNEMENT motivé ; le RECUL exige rôle
 * habilité + motif + visa four-eyes d'un second (R13). R274 : préavis et retard NOTIFIENT, ne
 * bloquent JAMAIS (R39) — EN_RETARD est calculé à la lecture, jamais stocké. R275 : la review
 * réalisée = l'approbation d'un KYC Rn+1 — l'échéance passe REALISEE et la suivante repart.
 * Paramètres R-Q : cadenceReviewMois {EDD:12, CDD:36, SDD:60} · preavisReviewJours (30) ·
 * escaladeRetardJours {CO:30, DIR:90} · rolesReportEcheance ([CO_SR]).
 */

type Ctx = { tenantId: string; userId: string; role: string };
const CADENCE_DEFAUT: Record<string, number> = { EDD: 12, CDD: 36, SDD: 60 };

function plusMois(d: Date, mois: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + mois);
  return r;
}

type ProfilReview = { type: string; niveau: string; sectionsActives?: string[];
  questionsRequises?: string[]; sectionsReconfirmation?: string[] };

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  // ── R283 : hooks à BRANCHEMENT TARDIF — KycModule et CocModule importent déjà ReviewsModule ;
  //    un import inverse créerait un cycle. Chaque module branche SON service sur le singleton
  //    ReviewsService dans sa factory (même esprit que les hooks optionnels du constructeur). ──
  private kycSvc?: { create(ctx: Ctx, dto: any, opts: any): Promise<any> };
  private cocSvc?: { ouvrir(ctx: Ctx, dto: { clientId?: string; typeCode?: string; description?: string }): Promise<any> };
  brancherKyc(svc: { create(ctx: Ctx, dto: any, opts: any): Promise<any> }) { this.kycSvc = svc; }
  brancherCoc(svc: { ouvrir(ctx: Ctx, dto: any): Promise<any> }) { this.cocSvc = svc; }

  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return emitEvent(tx, tenantId, type, aggregateId, payload);
  }
  private async settings(db: any, tenantId: string) {
    const t = await db.tenant.findFirst({ where: { id: tenantId } });
    return ((t?.settings as any) ?? {});
  }
  private cadence(s: any, niveau: string): number {
    return (s.cadenceReviewMois ?? {})[niveau] ?? CADENCE_DEFAUT[niveau] ?? CADENCE_DEFAUT.CDD;
  }

  // ── R272/R275 : LE hook — appelé DANS la transaction d'approbation du KYC (jamais un cron).
  //    Clôt l'échéance courante (REALISEE, référence au KYC) et calcule la suivante avec la
  //    cadence EN VIGUEUR (figée dans la ligne). ──
  async surApprobation(ctx: Ctx, tx: Tx, kyc: { id: string; clientId: string; workflow: string; validatedAt?: Date | null }) {
    const s = await this.settings(tx, ctx.tenantId);
    const courante = await tx.reviewDeadline.findFirst({
      where: { tenantId: ctx.tenantId, clientId: kyc.clientId, statut: "PLANIFIEE" } });
    if (courante) {                                                        // RV-07 : la boucle se referme
      await tx.reviewDeadline.update({ where: { id: courante.id },
        data: { statut: "REALISEE", realiseeKycId: kyc.id } });
      await this.emit(tx, ctx.tenantId, "REVIEW_DEADLINE_REALISEE", courante.id,
        { clientId: kyc.clientId, kycId: kyc.id, par: ctx.userId });
    }
    const cadenceMois = this.cadence(s, kyc.workflow);
    const base = kyc.validatedAt ?? new Date();
    const d = await tx.reviewDeadline.create({ data: {
      tenantId: ctx.tenantId, clientId: kyc.clientId, sourceKycId: kyc.id,
      ddlLevel: kyc.workflow, cadenceMois, dueDate: plusMois(base, cadenceMois) } });
    await this.emit(tx, ctx.tenantId, "REVIEW_DEADLINE_SET", d.id,
      { clientId: kyc.clientId, ddlLevel: kyc.workflow, cadenceMois, dueDate: d.dueDate, sourceKycId: kyc.id });
    return d;
  }

  // ── R272/RV-03 : changement de ddl_level (aiguillage adopté) — recalcul TRACÉ, jamais silencieux.
  //    L'ancienne ligne passe REMPLACEE (chaînée) ; la nouvelle repart du même KYC source. ──
  async recalcul(ctx: Ctx, clientId: string, dto: { ddlLevel?: string; motif?: string }) {
    if (!dto?.ddlLevel || !(dto.ddlLevel in CADENCE_DEFAUT))
      throw new BadRequestException("ddlLevel requis : EDD | CDD | SDD");
    return this.prisma.$transaction(async (tx: Tx) => {
      const courante = await tx.reviewDeadline.findFirst({
        where: { tenantId: ctx.tenantId, clientId, statut: "PLANIFIEE" } });
      if (!courante) throw new NotFoundException("Aucune échéance PLANIFIEE pour ce client");
      const s = await this.settings(tx, ctx.tenantId);
      const cadenceMois = this.cadence(s, dto.ddlLevel);
      const kyc = await tx.kycFile.findFirst({ where: { id: courante.sourceKycId } });
      const base = kyc?.validatedAt ?? courante.createdAt;
      await tx.reviewDeadline.update({ where: { id: courante.id }, data: { statut: "REMPLACEE" } }); // libère l'index partiel (RV-08)
      const nouvelle = await tx.reviewDeadline.create({ data: {
        tenantId: ctx.tenantId, clientId, sourceKycId: courante.sourceKycId,
        ddlLevel: dto.ddlLevel, cadenceMois, dueDate: plusMois(new Date(base), cadenceMois) } });
      await tx.reviewDeadline.update({ where: { id: courante.id }, data: { remplacePar: nouvelle.id } });
      await this.emit(tx, ctx.tenantId, "REVIEW_DEADLINE_SET", nouvelle.id,
        { clientId, ddlLevel: dto.ddlLevel, cadenceMois, dueDate: nouvelle.dueDate,
          remplace: courante.id, motif: dto.motif ?? "changement de niveau de diligence", par: ctx.userId });
      await this.audit.log(ctx.tenantId, ctx.userId, "REVIEW_RECALCUL", `${clientId}:${courante.ddlLevel}->${dto.ddlLevel}`);
      return { id: nouvelle.id, dueDate: nouvelle.dueDate, remplace: courante.id };
    });
  }

  // ── R273 : AVANCER — événement motivé (déclencheur, ancienne date, nouvelle date, auteur). ──
  async anticiper(ctx: Ctx, deadlineId: string, dto: { nouvelleDate?: string; motif?: string; declencheur?: string }) {
    if (!dto?.motif?.trim()) throw new BadRequestException("R7 : anticiper exige un motif");
    if (!dto?.nouvelleDate) throw new BadRequestException("nouvelleDate requise");
    return this.prisma.$transaction(async (tx: Tx) => {
      const d = await tx.reviewDeadline.findFirst({ where: { id: deadlineId, tenantId: ctx.tenantId } });
      if (!d) throw new NotFoundException("Échéance introuvable");
      if (d.statut !== "PLANIFIEE") throw new ConflictException(`Échéance ${d.statut} — non modifiable`);
      const nouvelle = new Date(dto.nouvelleDate);
      if (nouvelle >= new Date(d.dueDate))
        throw new BadRequestException("R273 : anticiper = AVANCER — reculer passe par le report (visa four-eyes)");
      await tx.reviewDeadline.update({ where: { id: d.id }, data: { statut: "REMPLACEE" } });        // libère l'index partiel
      const n = await tx.reviewDeadline.create({ data: {
        tenantId: ctx.tenantId, clientId: d.clientId, sourceKycId: d.sourceKycId,
        ddlLevel: d.ddlLevel, cadenceMois: d.cadenceMois, dueDate: nouvelle } });
      await tx.reviewDeadline.update({ where: { id: d.id }, data: { remplacePar: n.id } });
      await this.emit(tx, ctx.tenantId, "REVIEW_DEADLINE_ANTICIPEE", n.id,
        { clientId: d.clientId, declencheur: dto.declencheur ?? "decision_humaine",
          ancienneDate: d.dueDate, nouvelleDate: n.dueDate, motif: dto.motif!.trim(), par: ctx.userId });
      await this.audit.log(ctx.tenantId, ctx.userId, "REVIEW_ANTICIPEE", n.id);
      return { id: n.id, dueDate: n.dueDate };
    });
  }

  // ── R273/R13 : RECULER — rôle habilité + motif, PUIS visa d'un second (l'initiateur ne vise pas). ──
  async demanderReport(ctx: Ctx, deadlineId: string, dto: { nouvelleDate?: string; motif?: string }) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const s = await this.settings(tx, ctx.tenantId);
      const habilites: string[] = s.rolesReportEcheance ?? ["CO_SR"];
      if (!habilites.includes(ctx.role))
        throw new ForbiddenException(`R273 : le rôle ${ctx.role} ne reporte pas une échéance (${habilites.join(", ")})`);
      if (!dto?.motif?.trim()) throw new BadRequestException("R7 : reporter une revue exige un motif");
      if (!dto?.nouvelleDate) throw new BadRequestException("nouvelleDate requise");
      const d = await tx.reviewDeadline.findFirst({ where: { id: deadlineId, tenantId: ctx.tenantId } });
      if (!d) throw new NotFoundException("Échéance introuvable");
      if (d.statut !== "PLANIFIEE") throw new ConflictException(`Échéance ${d.statut} — non modifiable`);
      if (new Date(dto.nouvelleDate) <= new Date(d.dueDate))
        throw new BadRequestException("Reporter = RECULER — avancer passe par l'anticipation");
      const demande = { nouvelleDate: dto.nouvelleDate, motif: dto.motif!.trim(), par: ctx.userId, at: new Date().toISOString() };
      await tx.reviewDeadline.update({ where: { id: d.id }, data: { reportEnAttente: demande } });
      await this.emit(tx, ctx.tenantId, "REVIEW_DEADLINE_REPORT_DEMANDE", d.id, demande);
      return { enAttenteDeVisa: true, ...demande };
    });
  }
  async viserReport(ctx: Ctx, deadlineId: string) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const s = await this.settings(tx, ctx.tenantId);
      const habilites: string[] = s.rolesReportEcheance ?? ["CO_SR"];
      if (!habilites.includes(ctx.role)) throw new ForbiddenException("R273 : rôle non habilité au visa de report");
      const d = await tx.reviewDeadline.findFirst({ where: { id: deadlineId, tenantId: ctx.tenantId } });
      if (!d?.reportEnAttente) throw new NotFoundException("Aucune demande de report en attente");
      const demande = d.reportEnAttente as any;
      if (demande.par === ctx.userId)
        throw new ForbiddenException("R13 : le visa de report exige un SECOND — l'initiateur ne vise pas");
      await tx.reviewDeadline.update({ where: { id: d.id }, data: { statut: "REMPLACEE", reportEnAttente: null } }); // libère l'index partiel
      const n = await tx.reviewDeadline.create({ data: {
        tenantId: ctx.tenantId, clientId: d.clientId, sourceKycId: d.sourceKycId,
        ddlLevel: d.ddlLevel, cadenceMois: d.cadenceMois, dueDate: new Date(demande.nouvelleDate) } });
      await tx.reviewDeadline.update({ where: { id: d.id }, data: { remplacePar: n.id } });
      await this.emit(tx, ctx.tenantId, "REVIEW_DEADLINE_REPORTEE", n.id,
        { clientId: d.clientId, ancienneDate: d.dueDate, nouvelleDate: n.dueDate,
          motif: demande.motif, demandePar: demande.par, visePar: ctx.userId });
      await this.audit.log(ctx.tenantId, ctx.userId, "REVIEW_REPORTEE", n.id);
      return { id: n.id, dueDate: n.dueDate };
    });
  }

  // ═══ R283 (canon écarts anciens, ratifié 2026-07-28) — la review N'A PAS son propre
  // questionnaire : elle SÉLECTIONNE dans le KYC. Lancer une review = créer LE KYC Rn+1 (R275)
  // filtré par le profil {AR|GAR} × {SDD|CDD|EDD} du registre reviewProfiles (versionné R-Q,
  // FIGÉ dans l'événement de lancement — R29). Aucune table parallèle, aucune matrice parallèle.

  // ── RW-01/RW-03 : lancer — le profil EN VIGUEUR sélectionne, le Rn+1 naît chaîné et filtré. ──
  async lancer(ctx: Ctx, deadlineId: string, dto: { type?: string }) {
    if (ctx.role === "ADMIN") throw new ForbiddenException("HOME_SCOPE: ADMIN ne voit aucune donnée client (matrice A.3)");
    if (!this.kycSvc) throw new ConflictException("R283 : module KYC non branché");
    const type = dto?.type;
    if (type !== "AR" && type !== "GAR") throw new BadRequestException("R283 : type de review requis — AR | GAR");
    const d = await this.prisma.reviewDeadline.findFirst({ where: { id: deadlineId, tenantId: ctx.tenantId } });
    if (!d) throw new NotFoundException("Échéance introuvable");
    if (d.statut !== "PLANIFIEE") throw new ConflictException(`Échéance ${d.statut} — seule une échéance PLANIFIEE se lance`);
    const s = await this.settings(this.prisma, ctx.tenantId);
    const profils: ProfilReview[] = s.reviewProfiles ?? [];
    const p = profils.find((x) => x.type === type && x.niveau === d.ddlLevel);
    if (!p) throw new BadRequestException(
      `R283 : aucun profil ${type}×${d.ddlLevel} au registre reviewProfiles (default-deny)`);
    const client = await this.prisma.client.findFirst({ where: { id: d.clientId, tenantId: ctx.tenantId } });
    if (!client) throw new NotFoundException("Client introuvable dans ce tenant");
    // LE modèle unique : kyc.create — le profil filtre, le niveau de l'échéance est FIGÉ (R272).
    // legalStructure/accountType n'alimentent que le scoring, ÉCRASÉ par le niveau figé — tracé.
    const kyc = await this.kycSvc.create(ctx,
      { clientId: d.clientId, legalStructure: client.structure, accountType: "CURRENT",
        countryCode: client.country, rmId: client.rmUserId ?? ctx.userId },
      { review: { type, niveau: d.ddlLevel, deadlineId: d.id, profil: p } });
    await this.prisma.$transaction(async (tx: Tx) => {
      await this.emit(tx, ctx.tenantId, "review.lancee", kyc.id,
        { deadlineId: d.id, clientId: d.clientId, type, niveau: d.ddlLevel,
          kycCode: kyc.code, revision: kyc.revision, previousKycId: kyc.previousKycId,
          profil: p, par: ctx.userId });                                   // le profil appliqué, FIGÉ (R29)
      await this.audit.log(ctx.tenantId, ctx.userId, "REVIEW_LANCEE", kyc.code);
    });
    // L'échéance reste PLANIFIEE : c'est la VALIDATION du Rn+1 qui la clôt (RV-07 via surApprobation).
    return { kycId: kyc.id, kycCode: kyc.code, revision: kyc.revision,
      sections: kyc.sections.map((x: any) => x.code),
      sectionsReconfirmation: p.sectionsReconfirmation ?? [] };
  }

  private async lancement(ctx: Ctx, code: string) {
    const kyc = await this.prisma.kycFile.findFirst({
      where: { code, tenantId: ctx.tenantId }, include: { visas: true } });
    if (!kyc) throw new NotFoundException("Dossier introuvable");
    const ev = await this.prisma.domainEvent.findFirst({
      where: { tenantId: ctx.tenantId, type: "review.lancee", aggregateId: kyc.id } });
    if (!ev) throw new BadRequestException(`R283 : ${code} n'est pas une review — aucun lancement tracé`);
    return { kyc, profil: ((ev.payload as any).profil ?? {}) as ProfilReview };
  }

  // ── RW-02 : « Confirmer » = VISA tracé (R15) — jamais un flag parallèle. ──
  async reconfirmer(ctx: Ctx, code: string, sectionCode: string) {
    const { kyc, profil } = await this.lancement(ctx, code);
    const reconf = profil.sectionsReconfirmation ?? [];
    if (!reconf.includes(sectionCode)) throw new BadRequestException(
      `R283 : la section ${sectionCode} n'est pas en re-confirmation simple — une section active se re-répond`);
    if ((kyc as any).status === "VALIDATED") throw new ConflictException("Dossier validé — la review est close");
    const visa = (kyc as any).visas.find((v: any) => v.sectionCode === sectionCode
      && v.status === "PENDING" && v.requiredRole === ctx.role);
    return this.prisma.$transaction(async (tx: Tx) => {
      if (visa) await tx.kycVisa.update({ where: { id: visa.id },
        data: { status: "SIGNED", signedBy: ctx.userId, signedAt: new Date(),
                verdict: "OK", message: `re-confirmation R283 (review ${code})` } });
      await this.emit(tx, ctx.tenantId, "review.section.confirmee", kyc.id,
        { kycCode: code, section: sectionCode, par: ctx.userId, visaSigne: !!visa, at: new Date().toISOString() });
      await this.audit.log(ctx.tenantId, ctx.userId, "REVIEW_SECTION_CONFIRMEE", `${code}/${sectionCode}`);
      return { section: sectionCode, confirmee: true, visaSigne: !!visa };
    });
  }

  // ── RW-02 : « Signaler un changement » ouvre le CoC R276 — qui SUIT SON CYCLE (CC-01). ──
  async signalerChangement(ctx: Ctx, code: string, dto: { typeCode?: string; description?: string }) {
    if (!this.cocSvc) throw new ConflictException("R283 : module CoC non branché");
    const { kyc } = await this.lancement(ctx, code);
    const coc = await this.cocSvc.ouvrir(ctx, { clientId: (kyc as any).clientId,
      typeCode: dto?.typeCode, description: dto?.description });
    await this.prisma.$transaction(async (tx: Tx) =>
      this.emit(tx, ctx.tenantId, "review.changement.signale", kyc.id,
        { kycCode: code, cocId: coc.id, typeCode: dto?.typeCode, par: ctx.userId }));
    return { cocId: coc.id, statut: coc.statut };
  }

  // ── RW-04 : le gabarit et les profils, SERVIS — sdar/sdgar rendent, ne dupliquent pas. ──
  async profils(ctx: Ctx) {
    const s = await this.settings(this.prisma, ctx.tenantId);
    const gabarits = Object.fromEntries(Object.entries(SECTIONS_BY_WORKFLOW).map(([niveau, sections]) => [niveau,
      sections.map((sec) => ({ code: sec.code, label: sec.label,
        questions: sec.questions.map((q) => ({ code: q.code, label: q.label })) }))]));
    return { gabarits, profils: (s.reviewProfiles ?? []) as ProfilReview[] };
  }

  // ── T7 / R274 : la liste — périmètre SERVEUR (matrice A.3), EN_RETARD CALCULÉ à la lecture. ──
  async deadlines(ctx: Ctx, horizonJours?: number, _scope?: string) {
    if (ctx.role === "ADMIN") throw new ForbiddenException("HOME_SCOPE: ADMIN ne voit aucune donnée client (matrice A.3)");
    let clients: string[] | null = null;
    if (ctx.role === "RM" || ctx.role === "ARM") {
      const cs = await this.prisma.client.findMany({ where: { tenantId: ctx.tenantId, rmUserId: ctx.userId }, select: { id: true } });
      clients = cs.map((c) => c.id);
    }
    const horizon = horizonJours ?? 30;
    const limite = new Date(Date.now() + horizon * 86400000);
    const ds = await this.prisma.reviewDeadline.findMany({ where: {
      tenantId: ctx.tenantId, statut: "PLANIFIEE", dueDate: { lte: limite },
      ...(clients ? { clientId: { in: clients } } : {}) }, orderBy: { dueDate: "asc" }, take: 200 });
    const today = new Date();
    return ds.map((d: any) => ({ id: d.id, clientId: d.clientId, ddlLevel: d.ddlLevel,
      dueDate: d.dueDate, cadenceMois: d.cadenceMois, sourceKycId: d.sourceKycId,
      enRetard: d.dueDate < today,                                          // FAIT calculé — jamais stocké
      joursRetard: d.dueDate < today ? Math.floor((today.getTime() - new Date(d.dueDate).getTime()) / 86400000) : 0,
      reportEnAttente: d.reportEnAttente ? true : false }));
  }

  // ── R274/R39 : préavis + escalade — notifient UNE fois, ne bloquent JAMAIS (pattern tickSla). ──
  async tick(ctx: Ctx, now = new Date()) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const s = await this.settings(tx, ctx.tenantId);
      const preavis = s.preavisReviewJours ?? 30;
      const escaladeCo = (s.escaladeRetardJours ?? {}).CO ?? 30;
      const ds = await tx.reviewDeadline.findMany({ where: { tenantId: ctx.tenantId, statut: "PLANIFIEE" } });
      let notifies = 0;
      for (const d of ds) {
        const due = new Date(d.dueDate).getTime();
        if (!d.preavisSignale && now.getTime() >= due - preavis * 86400000) {
          await tx.reviewDeadline.update({ where: { id: d.id }, data: { preavisSignale: true } });
          await this.emit(tx, ctx.tenantId, "tache.review.preavis", d.id, { clientId: d.clientId, dueDate: d.dueDate });
          notifies++;
        }
        if (!d.escaladeSignalee && now.getTime() >= due + escaladeCo * 86400000) {
          await tx.reviewDeadline.update({ where: { id: d.id }, data: { escaladeSignalee: true } });
          await this.emit(tx, ctx.tenantId, "tache.review.escalade", d.id,
            { clientId: d.clientId, dueDate: d.dueDate, joursRetard: Math.floor((now.getTime() - due) / 86400000), vers: "CO" });
          notifies++;
        }
        // L'état ne bouge JAMAIS ici : le retard mesure, il ne bloque pas (R39).
      }
      return { notifies };
    });
  }
}

@Controller("reviews")
export class ReviewsController {
  constructor(private svc: ReviewsService) {}
  @Get("deadlines")                    liste(@Req() r: any, @Query("horizonJours") h?: string, @Query("scope") scope?: string) { return this.svc.deadlines(r.ctx, h != null ? Number(h) : undefined, scope); } // T7
  @Post("clients/:clientId/recalcul")  recalc(@Req() r: any, @Param("clientId") cid: string, @Body() b: any) { return this.svc.recalcul(r.ctx, cid, b ?? {}); }  // RV-03
  @Post("deadlines/:id/anticiper")     anticiper(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.anticiper(r.ctx, id, b ?? {}); }      // RV-04/R273
  @Post("deadlines/:id/report")        report(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.demanderReport(r.ctx, id, b ?? {}); }    // RV-05
  @Post("deadlines/:id/report/visa")   visa(@Req() r: any, @Param("id") id: string) { return this.svc.viserReport(r.ctx, id); }                                   // RV-05/R13
  @Post("tick")                        tick(@Req() r: any) { return this.svc.tick(r.ctx); }                                                                       // RV-06/R274
  // R283 — la review sélectionne dans le KYC (canon écarts anciens partie 4)
  @Get("profils")                      profils(@Req() r: any) { return this.svc.profils(r.ctx); }                                                                 // RW-04
  @Post("deadlines/:id/lancer")        lancer(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.lancer(r.ctx, id, b ?? {}); }             // RW-01
  @Post("kyc/:code/reconfirmer/:section") reconf(@Req() r: any, @Param("code") c: string, @Param("section") s: string) { return this.svc.reconfirmer(r.ctx, c, s); } // RW-02
  @Post("kyc/:code/signaler-changement") signaler(@Req() r: any, @Param("code") c: string, @Body() b: any) { return this.svc.signalerChangement(r.ctx, c, b ?? {}); } // RW-02/CC-01
}

// ── Bloc 65 Volet A (repo R466–R473) — harmonisation : diff visé, verdicts, GAR, cascades, §Review. ──
@Controller("revues")
export class RevueHarmoniseeController {
  constructor(private svc: RevueHarmoniseeService) {}
  @Post("deadlines/:id/ouvrir")        ouvrir(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.ouvrirRevue(r.ctx, id, b ?? {}); }        // HR-01/02 (R467)
  @Post("kyc/:code/reponse")           reponse(@Req() r: any, @Param("code") c: string, @Body() b: any) { return this.svc.modifierReponse(r.ctx, c, b ?? {}); }   // HR-02 (R467)
  @Get("kyc/:code/delta")              delta(@Req() r: any, @Param("code") c: string) { return this.svc.delta(r.ctx, c); }                                        // HR-03 (R467)
  @Post("kyc/:code/delta/visa")        viserDelta(@Req() r: any, @Param("code") c: string) { return this.svc.viserDelta(r.ctx, c); }                              // HR-03 (R467/R13)
  @Post("kyc/:code/visa-bloc")         viserBloc(@Req() r: any, @Param("code") c: string) { return this.svc.viserEnBloc(r.ctx, c); }                              // HR-03 (R467)
  @Post("kyc/:code/verdict")           verdict(@Req() r: any, @Param("code") c: string, @Body() b: any) { return this.svc.poserVerdict(r.ctx, c, b ?? {}); }      // HR-04 (R468/R44)
  @Post("kyc/:code/aiguillage")        aiguillage(@Req() r: any, @Param("code") c: string, @Body() b: any) { return this.svc.accepterAiguillage(r.ctx, c, b ?? {}); } // HR-04 (R44)
  @Post("kyc/:code/cloturer")          cloturer(@Req() r: any, @Param("code") c: string) { return this.svc.cloturerRevue(r.ctx, c); }                             // HR-05 (R468)
  @Post("clients/:id/risque")          risque(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.surChangementRisque(r.ctx, id, b ?? {}); } // HR-05 (R468)
  @Get("groupes")                      groupes(@Req() r: any) { return this.svc.composerGroupes(r.ctx); }                                                         // HR-06 (R469)
  @Post("groupes/declencher")          declencher(@Req() r: any, @Body() b: any) { return this.svc.declencherRevueGroupe(r.ctx, b ?? {}); }                       // HR-07 (R470)
  @Post("membres/declencher")          membre(@Req() r: any, @Body() b: any) { return this.svc.declencherRevueMembre(r.ctx, b ?? {}); }                           // HR-10 (R471)
  @Get("gar/:id/consolidee")           consolidee(@Req() r: any, @Param("id") id: string) { return this.svc.vueConsolidee(r.ctx, id); }                           // HR-09 (R470)
  @Post("gar/:id/decision")            decision(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.viserDecisionGroupe(r.ctx, id, b ?? {}); } // HR-08/09 (R470/R13)
  @Get("gar/:id/rejeu")                rejeu(@Req() r: any, @Param("id") id: string, @Query("asOf") asOf?: string) { return this.svc.rejouerGar(r.ctx, id, asOf ? new Date(asOf) : undefined); } // HR-14 (R48/R29)
  @Get("dossiers/:ref")                dossier(@Req() r: any, @Param("ref") ref: string) { return this.svc.dossier(r.ctx, ref); }                                 // HR-13 (R472)
  @Get("params/registre")              params(@Req() r: any) { return this.svc.parametresReview(r.ctx); }                                                         // R473
  @Post("params/modifier")             modifier(@Req() r: any, @Body() b: any) { return this.svc.modifierParametreReview(r.ctx, b ?? {}); }                       // R473 (pop-up R445)
}

@Module({
  controllers: [ReviewsController, RevueHarmoniseeController],
  providers: [ReviewsService, RevueHarmoniseeService],
  exports: [ReviewsService, RevueHarmoniseeService],
})
export class ReviewsModule {}
