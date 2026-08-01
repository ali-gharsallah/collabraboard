import { Injectable, BadRequestException, ForbiddenException, ConflictException, NotFoundException } from "@nestjs/common";
import { createHmac } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { computeRisk, baremeEnVigueur } from "./risk-engine";
import { SECTIONS_BY_WORKFLOW, VISAS_BY_WORKFLOW } from "./kyc.templates";
import { SectionFourEyes } from "./rules/section-four-eyes"; // R13/R52
import { NamedValidator } from "./rules/named-validator"; // R2/R4
import { QualifiedVisaService, VisaError, Verdict } from "./rules/qualified-visa.service"; // R86
import { KycLockService, KycLockError } from "./rules/kyc-lock.service"; // R84
import { KycHandoff, HandoffError, HandoffStatus } from "./rules/kyc-handoff"; // R85
import { etatCloture } from "../offboarding/cloture.util"; // R267/OF-10 — lecture seule intégrale
import { Tx } from "../../common/tx";
import { majVersionnee } from "../../common/optimistic-lock"; // R336/LK : verrou optimiste (lot 1)
import { loadSettings } from "../../common/tenant-settings"; // R288 : barème gouverné

type Ctx = { tenantId: string; userId: string; role: string };

@Injectable()
export class KycService {
  // R123 : hook OPTIONNEL de pré-revue IA (bloc 20). Absent en tests unitaires (construction à
  // 2 args) et si le tenant n'exige rien ; câblé en app via PreRevueModule (useFactory). Le
  // service PreRevue CONSTATE, le moteur KYC BLOQUE (pattern R110).
  constructor(private prisma: PrismaService, private audit: AuditService,
              private prerevue?: { verifierTraitement(ctx: Ctx, kycFileId: string): Promise<{ bloquant: boolean; ouverts: any[] }> },
              // R272/R275 (canon débloquants partie 1) : hook d'échéance de review — appelé DANS la
              // transaction d'approbation (jamais un cron). Optionnel : absent en tests unitaires.
              private reviews?: { surApprobation(ctx: Ctx, tx: Tx, kyc: any): Promise<any> }) {}

  // ── R267/OF-10 : client clôturé = LECTURE SEULE INTÉGRALE — toute écriture refuse typé.
  //    La consultation et le rejeu à date restent ouverts (jamais d'amputation de l'audit). ──
  private async verifierNonCloture(ctx: Ctx, clientId: string) {
    const e = await etatCloture(this.prisma, ctx.tenantId, clientId);
    if (e.cloture) throw new ConflictException(
      `OFFBOARDING_LECTURE_SEULE : dossier clôturé le ${e.le?.slice(0, 10)} — rétention jusqu'au ${e.retentionJusqua} (R267)`);
  }

  // ── Création : code atomique + scoring tracé + gabarit + visas ──
  async create(ctx: Ctx, dto: { clientId: string; legalStructure: string;
    accountType: string; countryCode: string; rmId: string },
    opts: { viaOnboarding?: boolean;
      // R283 : une review est un KYC Rn+1 (R275) FILTRÉ par un profil — jamais un modèle à part.
      review?: { type: string; niveau: string; deadlineId: string;
        profil: { sectionsActives?: string[]; questionsRequises?: string[]; sectionsReconfirmation?: string[] } } } = {}) {
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, tenantId: ctx.tenantId } });
    if (!client) throw new NotFoundException("Client introuvable dans ce tenant");
    // R271/OF-10 : client clôturé — le retour ne « rouvre » pas : SEUL un nouvel onboarding
    // (MOD-69) crée le KYC Rn+1, chaîné au précédent ; la création directe refuse.
    const cloture = await etatCloture(this.prisma, ctx.tenantId, dto.clientId);
    if (cloture.cloture && !opts.viaOnboarding) throw new ConflictException(
      `OFFBOARDING_LECTURE_SEULE : dossier clôturé le ${cloture.le?.slice(0, 10)} — le retour passe par un nouvel onboarding (R271)`);

    // R288 : le dossier est scoré sous le barème EN VIGUEUR à sa création (registre R-Q,
    // versionné par date d'effet — R29 : il le garde à vie, score + trace stockés).
    const reglagesScoring = await loadSettings(this.prisma, ctx.tenantId).catch(() => ({} as any));
    let risk = computeRisk({ structure: dto.legalStructure,
      accountType: dto.accountType, countryCode: dto.countryCode },
      baremeEnVigueur(reglagesScoring.kycScoringBareme, new Date()));
    let previousKycId: string | null = null;
    let revision = 1;
    if (cloture.cloture && opts.viaOnboarding) {          // R271 : réonboarding chaîné
      const dernier = await this.prisma.kycFile.findFirst({
        where: { tenantId: ctx.tenantId, clientId: dto.clientId }, orderBy: { createdAt: "desc" } });
      previousKycId = dernier?.id ?? null;
      revision = (dernier?.revision ?? 0) + 1;
      const t = await this.prisma.tenant.findFirst({ where: { id: ctx.tenantId } });
      const forceEdd = ((t?.settings as any) ?? {}).exExitComplianceForceEdd !== false;
      if (cloture.type === "EXIT_COMPLIANCE" && forceEdd && risk.workflow !== "EDD")
        risk = { ...risk, workflow: "EDD", level: "HIGH",
          trace: [...(risk.trace ?? []), "R271 : ex-EXIT_COMPLIANCE — workflow EDD imposé (exExitComplianceForceEdd)"] } as any;
    }
    if (opts.review) {                                    // R283 : review = Rn+1 chaîné SANS clôture (client actif)
      const dernier = await this.prisma.kycFile.findFirst({
        where: { tenantId: ctx.tenantId, clientId: dto.clientId }, orderBy: { createdAt: "desc" } });
      if (!dernier) throw new ConflictException("R283 : une review révise un dossier existant — aucun KYC à réviser");
      previousKycId = dernier.id;
      revision = (dernier.revision ?? 0) + 1;
      // Le NIVEAU de la review est celui de l'ÉCHÉANCE (figé R272 — le recalcul RV-03 est LA voie
      // de changement de niveau, jamais un re-scoring silencieux au lancement).
      risk = { ...risk, workflow: opts.review.niveau,
        score: dernier.riskScore, level: dernier.riskLevel,
        trace: [...(risk.trace ?? []),
          `R283 : review ${opts.review.type} — niveau ${opts.review.niveau} de l'échéance (figé R272)`] } as any;
    }
    const year = new Date().getFullYear();

    // R283 : le profil SÉLECTIONNE dans le gabarit — sections actives ∪ re-confirmation, rien d'autre.
    const retenues = opts.review
      ? new Set([...(opts.review.profil.sectionsActives ?? []), ...(opts.review.profil.sectionsReconfirmation ?? [])])
      : null;
    // R308 (Builder, dégel V3) : les SECTIONS publiées au Builder enrichissent le gabarit À LA
    // CRÉATION — dernière version EN VIGUEUR (depuisLe ≤ now) par code, pour les workflows
    // déclarés. Le dossier COPIE ses sections : les dossiers antérieurs gardent les leurs (R29).
    const nowIso = new Date().toISOString();
    const versionsBuilder = await this.prisma.builderVersion.findMany({
      where: { tenantId: ctx.tenantId, type: "SECTION", depuisLe: { lte: nowIso } },
      orderBy: { version: "asc" } });
    const derniereParCode = new Map<string, any>();
    for (const v of versionsBuilder) derniereParCode.set(v.code, v);
    const sectionsBuilder = [...derniereParCode.values()]
      .filter((v) => ((v.contenu as any).workflows ?? []).includes(risk.workflow))
      .map((v) => ({ code: v.code, label: (v.contenu as any).label ?? v.code,
        questions: ((v.contenu as any).questions ?? []).map((q: any) => ({
          code: q.code, label: q.label, rights: q.rights ?? {} })) }));
    const gabarit = [...SECTIONS_BY_WORKFLOW[risk.workflow], ...sectionsBuilder]
      .filter((s) => !retenues || retenues.has(s.code));
    const requises = new Set(opts.review?.profil.questionsRequises ?? []);

    // R282 : un dossier NAÎT sous la matrice COURANTE du tenant — le gabarit fournit le socle,
    // les changements en vigueur (portée « matrice ») le surchargent à la création. La cellule la
    // plus RÉCEMMENT effective fait foi (les changements de portée matrice s'appliquent partout ;
    // un override de portée dossier postérieur peut primer — documenté).
    const codesQuestions = gabarit.flatMap((sec) => sec.questions.map((q) => q.code));
    const reglesCourantes = await this.prisma.kycAccessRule.findMany({
      where: { effectiveTo: null, question: { code: { in: codesQuestions },
        section: { kycFile: { tenantId: ctx.tenantId } } } },
      include: { question: { select: { code: true } } }, orderBy: { effectiveFrom: "desc" } });
    const matriceCourante = new Map<string, Map<string, string>>();
    for (const r of reglesCourantes) {
      const parRole = matriceCourante.get(r.question.code) ?? new Map<string, string>();
      if (!parRole.has(r.role)) parRole.set(r.role, r.right);             // desc ⇒ premier vu = le plus récent
      matriceCourante.set(r.question.code, parRole);
    }

    return this.prisma.$transaction(async (tx) => {
      // Verrou consultatif : la séquence par (tenant, année, pays) est atomique
      // même avec N instances d'API — aucun code en double possible.
      const lockKey = `${ctx.tenantId}|${year}|${dto.countryCode}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
      const last = await tx.kycFile.findFirst({
        where: { tenantId: ctx.tenantId, year, countryCode: dto.countryCode },
        orderBy: { sequence: "desc" }, select: { sequence: true } });
      const sequence = (last?.sequence ?? 0) + 1;
      const code = `KYC-${year}-${dto.countryCode}-${String(sequence).padStart(4, "0")}-R${revision}`;

      const kyc = await tx.kycFile.create({ data: {
        tenantId: ctx.tenantId, clientId: dto.clientId, code, year,
        countryCode: dto.countryCode, sequence, workflow: risk.workflow,
        revision, previousKycId,                                  // R271 : Rn+1 chaîné
        riskScore: risk.score, riskLevel: risk.level, createdBy: ctx.userId,
        sections: { create: gabarit.map((s, i) => ({
          code: s.code, label: s.label, orderIndex: i,
          questions: { create: s.questions.map(q => {
            const droits: Record<string, string> = { ...(q.rights ?? {}),
              ...Object.fromEntries(matriceCourante.get(q.code) ?? []) };
            // R283 : une question REQUISE du profil passe par la matrice R282 — les rôles
            // éditeurs deviennent REQUIRED sur CE dossier (aucune matrice parallèle).
            if (requises.has(q.code))
              for (const [role, right] of Object.entries(droits)) if (right === "EDIT") droits[role] = "REQUIRED";
            return { code: q.code, label: q.label,
              accessRules: { create: Object.entries(droits).map(([role, right]) => ({
                role: role as any, right: right as any })) } };
          }) } })) },
        visas: { create: VISAS_BY_WORKFLOW[risk.workflow]
          .filter((v) => !retenues || retenues.has(v.sectionCode))         // R283/R15 : les visas suivent les sections retenues
          .map(v => ({ sectionCode: v.sectionCode, requiredRole: v.role })) },
      }, include: { sections: { include: { questions: true } }, visas: true } });

      await tx.domainEvent.create({ data: { tenantId: ctx.tenantId,
        type: "kyc.created", aggregateId: kyc.id,
        payload: { code, workflow: risk.workflow, riskTrace: risk.trace } as any } });
      await this.audit.log(ctx.tenantId, ctx.userId, "KYC_CREATED", code);
      return { ...kyc, riskTrace: risk.trace };
    });
  }

  // ── Rejeu KYC à date (Vague 1, esprit R127) : reconstruit l'état d'un dossier À une date
  //    passée UNIQUEMENT depuis le journal APPEND-ONLY domain_events (kyc.created, kyc.validated),
  //    jamais depuis les colonnes courantes — auditable. Un événement ne compte que si son
  //    horodatage est <= à la date demandée. ──
  async etatADate(ctx: Ctx, code: string, date: Date) {
    const kyc = await this.prisma.kycFile.findFirst({
      where: { code, tenantId: ctx.tenantId }, select: { id: true } });
    if (!kyc) throw new NotFoundException("Dossier introuvable");
    const evs = (await this.prisma.domainEvent.findMany({
      where: { tenantId: ctx.tenantId, aggregateId: kyc.id } }))
      .filter((e: any) => new Date(e.at).getTime() <= date.getTime())
      .sort((a: any, b: any) => new Date(a.at).getTime() - new Date(b.at).getTime());
    const cree = evs.some((e: any) => e.type === "kyc.created");
    const valide = evs.some((e: any) => e.type === "kyc.validated");
    const statutADate = !cree ? "INEXISTANT" : valide ? "VALIDE" : "EN_COURS";
    return { code, dateDemandee: date.toISOString(), existeADate: cree, statutADate,
      evenementsConsideres: evs.map((e: any) => ({ type: e.type, at: new Date(e.at).toISOString() })) };
  }

  // ── Réponse : default-deny + change tracker HMAC chaîné ──
  // ═══ R282 (canon écarts anciens, ratifié 2026-07-28) — la matrice est VERSIONNÉE à date.
  // DEUX faces, DEUX points d'évaluation distincts :
  //   • SÉCURITÉ (HIDDEN/VIEW/EDIT) : la matrice EN VIGUEUR au moment de l'accès — jamais
  //     grandfathérée (un droit retiré vaut aussi pour les dossiers anciens) ;
  //   • COMPLÉTUDE (REQUIRED) : la matrice en vigueur À LA CRÉATION du dossier (R29) —
  //     résolue par dates, aucun champ version recopié sur le dossier (le rejeu R48 fait le reste).
  private enVigueur<T extends { effectiveTo: Date | null }>(rules: T[]): T[] {
    return rules.filter((r) => !r.effectiveTo);
  }
  private aDate<T extends { effectiveFrom: Date; effectiveTo: Date | null }>(rules: T[], at: Date): T[] {
    return rules.filter((r) => r.effectiveFrom <= at && (!r.effectiveTo || r.effectiveTo > at));
  }

  async answer(ctx: Ctx, code: string, qCode: string, answer: string) {
    const q = await this.prisma.kycQuestion.findFirst({
      where: { code: qCode, section: { kycFile: { code, tenantId: ctx.tenantId } } },
      include: { accessRules: true,
        section: { include: { kycFile: { select: { id: true, status: true, clientId: true } } } } } });
    if (!q) throw new NotFoundException("Question introuvable");
    await this.verifierNonCloture(ctx, q.section.kycFile.clientId);   // OF-10
    if (q.section.kycFile.status === "VALIDATED")
      throw new ConflictException("Dossier validé — créer une révision (Rn+1)");

    const rule = this.enVigueur(q.accessRules).find(r => r.role === ctx.role);   // R282 : sécurité = matrice COURANTE
    if (!rule || (rule.right !== "EDIT" && rule.right !== "REQUIRED"))
      throw new ForbiddenException(`Rôle ${ctx.role} : pas de droit d'édition (default-deny)`);

    return this.prisma.$transaction(async (tx) => {
      const prevHist = await tx.kycQuestionHistory.findFirst({
        where: { questionId: q.id }, orderBy: { changedAt: "desc" }, select: { hash: true } });
      const changedAt = new Date();
      const hash = createHmac("sha256", process.env.AUDIT_HMAC_SECRET!)
        .update([prevHist?.hash ?? "", q.id, q.answer ?? "", answer, ctx.userId,
          changedAt.toISOString()].join("|")).digest("hex");
      await tx.kycQuestionHistory.create({ data: { questionId: q.id,
        previousValue: q.answer, newValue: answer, changedBy: ctx.userId, changedAt, hash } });
      const updated = await tx.kycQuestion.update({ where: { id: q.id },
        data: { answer, answeredBy: ctx.userId, answeredAt: changedAt } });
      // R6/R10 : la modification d'une donnée invalide le visa de CETTE section (ciblé) — il
      // repasse EN ATTENTE (re-signature requise) ; les visas des AUTRES sections restent intacts.
      const aInvalider = await tx.kycVisa.findMany({
        where: { kycFileId: q.section.kycFile.id, sectionCode: q.section.code, status: "SIGNED" } });
      for (const v of aInvalider)
        await tx.kycVisa.update({ where: { id: v.id },
          data: { status: "PENDING", signedBy: null, signedAt: null, verdict: null, message: null, version: { increment: 1 } } });
      if (aInvalider.length)
        await this.emit(tx, ctx, "kyc.visa.invalide", q.section.kycFile.id,
          { section: q.section.code, cause: "donnees_modifiees", nb: aInvalider.length });
      return updated;
    });
  }

  // ── Visa de section (rôle requis strict) ──
  async signVisa(ctx: Ctx, code: string, sectionCode: string, verdict: string = "OK", message: string = "", expectedVersion?: number) {
    const kyc = await this.prisma.kycFile.findFirst({
      where: { code, tenantId: ctx.tenantId }, include: { visas: true } });
    if (!kyc) throw new NotFoundException("Dossier introuvable");
    await this.verifierNonCloture(ctx, kyc.clientId);                 // OF-10
    const visa = kyc.visas.find(v => v.sectionCode === sectionCode
      && v.requiredRole === ctx.role && v.status === "PENDING");
    if (!visa) throw new ForbiddenException(
      `Aucun visa ${sectionCode} en attente pour le rôle ${ctx.role}`);
    // R123 : si le tenant l'exige, aucun visa tant qu'un point de pré-revue IA reste non traité.
    if (this.prerevue) {
      const g = await this.prerevue.verifierTraitement(ctx, kyc.id);
      if (g.bloquant)
        throw new ConflictException(
          `[R123] Pré-revue IA : ${g.ouverts.length} point(s) non traité(s) — visa bloqué (le tenant exige le traitement)`);
    }
    // R13 : four-eyes au niveau section — le signataire ne doit pas avoir contribué à CETTE section.
    const secContribs = await this.prisma.kycQuestionHistory.findMany({
      where: { question: { section: { kycFileId: kyc.id, code: sectionCode } } },
      select: { changedBy: true }, distinct: ["changedBy"] });
    const feSection = new SectionFourEyes();
    for (const c of secContribs) feSection.contribuer(sectionCode, c.changedBy, new Date());
    if (!feSection.peutViser(sectionCode, ctx.userId))
      throw new ConflictException(`[R13] Four-eyes section : ${ctx.userId} a contribué à ${sectionCode} — visa exclu`);
    // R2 : si un validateur nommé est assigné à ce visa, seul lui (ou son relais / une dérogation R4) peut signer.
    if (visa.validateur) {
      const nv = new NamedValidator();
      nv.assigner(sectionCode, visa.validateur);
      if (!nv.peutViser(sectionCode, ctx.userId))
        throw new ForbiddenException(`[R2] ${ctx.userId} n'est pas le validateur nommé (${visa.validateur}) de ${sectionCode}`);
    }
    // R86 : visa qualifié — verdict (OK|CONDITIONAL|NOK) + message ; NOK/CONDITIONAL exigent un message.
    let qv;
    try {
      qv = new QualifiedVisaService().apposer(
        `${code}/${sectionCode}`, ctx.userId, ctx.role, verdict as Verdict, message, new Date());
    } catch (e) {
      if (e instanceof VisaError) throw new BadRequestException(e.message);
      throw e;
    }
    await this.audit.log(ctx.tenantId, ctx.userId, "KYC_VISA_SIGNED",
      `${code}/${sectionCode} — ${qv.verdict}${qv.message ? " : " + qv.message : ""}`);
    // R336/LK (lot 1) : signature de visa GARDÉE par la version — deux porteurs du même rôle
    // signant CETTE section ne s'écrasent jamais. If-Match présent → strict (409 si version
    // périmée) ; absent → repli sur la version courante (rollout expand, legacy non cassé).
    // enforce:true = lot 1 STRICT quel que soit le flag global (shadow ailleurs).
    const attendue = expectedVersion ?? visa.version;
    await majVersionnee(this.prisma.kycVisa, visa.id, attendue,
      { status: "SIGNED", signedBy: ctx.userId, signedAt: new Date(), verdict: qv.verdict, message: qv.message },
      { enforce: true });
    return this.prisma.kycVisa.findUnique({ where: { id: visa.id } });
  }

  // ── R9 : la révocation discrétionnaire d'un visa n'existe pas — toute tentative est refusée ET tracée.
  async tenterRevocation(ctx: Ctx, code: string, sectionCode: string) {
    await this.findKyc(ctx, code);                                     // existence + périmètre
    await this.audit.log(ctx.tenantId, ctx.userId, "KYC_REVOCATION_REFUSEE", `${code}/${sectionCode}`);
    throw new ConflictException(
      "[R9] La révocation discrétionnaire d'un visa n'existe pas — un visa accordé ne se retire pas « parce qu'on a changé d'avis ». " +
      "Seules l'invalidation ciblée sur modification (R6/R10) ou l'annulation pour vice de process (R12) sont possibles.");
  }

  // ── R11 : réassignation d'un validateur nommé — réservée aux rôles habilités (process owner/manager), tracée.
  async reassignerValidateur(ctx: Ctx, code: string, sectionCode: string, requiredRole: string, nouveau: string) {
    if (!KycService.ROLES_REASSIGNATION.includes(ctx.role))
      throw new ForbiddenException(`[R11] Rôle ${ctx.role} non habilité à réassigner un validateur (process owner / manager uniquement).`);
    const kyc = await this.findKyc(ctx, code);
    const visa = await this.prisma.kycVisa.findFirst({ where: { kycFileId: kyc.id, sectionCode, requiredRole: requiredRole as any } });
    if (!visa) throw new NotFoundException(`Visa introuvable pour ${sectionCode}/${requiredRole}`);
    return this.prisma.$transaction(async (tx) => {
      await tx.kycVisa.update({ where: { id: visa.id }, data: { validateur: nouveau, version: { increment: 1 } } });
      await this.emit(tx, ctx, "kyc.visa.validateur.reassigne", kyc.id,
        { section: sectionCode, requiredRole, ancien: (visa as any).validateur ?? null, nouveau });
      return { ok: true, section: sectionCode, requiredRole, validateur: nouveau };
    });
  }

  // ── R12 : annulation pour vice de process — décideur habilité + motif ; incident op-risk enregistré.
  async annulerPourVice(ctx: Ctx, code: string, sectionCode: string, requiredRole: string, motif: string) {
    if (!KycService.ROLES_REASSIGNATION.includes(ctx.role))
      throw new ForbiddenException(`[R12] Rôle ${ctx.role} non habilité à annuler pour vice (process owner / manager).`);
    if (!motif || !motif.trim()) throw new BadRequestException("[R12] Motif obligatoire pour l'annulation pour vice de process.");
    const kyc = await this.findKyc(ctx, code);
    const visa = await this.prisma.kycVisa.findFirst({ where: { kycFileId: kyc.id, sectionCode, requiredRole: requiredRole as any } });
    if (!visa) throw new NotFoundException(`Visa introuvable pour ${sectionCode}/${requiredRole}`);
    if (visa.status !== "SIGNED") throw new ConflictException("[R12] Seul un visa accordé peut être annulé pour vice de process.");
    return this.prisma.$transaction(async (tx) => {
      await tx.kycVisa.update({ where: { id: visa.id },
        data: { status: "PENDING", signedBy: null, signedAt: null, verdict: null, message: null, version: { increment: 1 } } });
      await this.emit(tx, ctx, "kyc.visa.annule.vice", kyc.id, { section: sectionCode, requiredRole, motif });
      await this.emit(tx, ctx, "risque.operationnel.incident", kyc.id,
        { origine: "visa_hors_process", section: sectionCode, requiredRole, motif });   // R12 : incident op-risk
      return { ok: true, section: sectionCode, requiredRole };
    });
  }

  // ── R46 : hit pendant la validation — GÈLE les visas en attente le temps de la décision du comité.
  async gelerPourHit(ctx: Ctx, code: string, hitRef: string, delaiAnalyseJours: number = 5) {
    const kyc = await this.findKyc(ctx, code);
    return this.prisma.$transaction(async (tx) => {
      const gel = await tx.kycVisa.updateMany({ where: { kycFileId: kyc.id, status: "PENDING" }, data: { status: "GELE" } });
      await this.emit(tx, ctx, "kyc.visas.geles", kyc.id, { hit: hitRef, nb: gel.count, delaiAnalyseJours });   // R46
      return { ok: true, geles: gel.count };
    });
  }

  // ── R46 : le comité Risk & Compliance décide — « poursuite » dégèle les visas ; sinon offboarding.
  async deciderComite(ctx: Ctx, code: string, hitRef: string, decision: string, membres: string[] = []) {
    if (!["poursuite", "offboarding"].includes(decision))
      throw new BadRequestException("[R46] Décision comité invalide : « poursuite » ou « offboarding ».");
    const kyc = await this.findKyc(ctx, code);
    return this.prisma.$transaction(async (tx) => {
      await this.emit(tx, ctx, "kyc.comite.decision", kyc.id, { hit: hitRef, decision, membres });   // R46
      if (decision === "poursuite") {
        const degel = await tx.kycVisa.updateMany({ where: { kycFileId: kyc.id, status: "GELE" }, data: { status: "PENDING" } });
        return { ok: true, decision, degeles: degel.count };
      }
      await this.emit(tx, ctx, "kyc.offboarding.propose", kyc.id, { hit: hitRef, origine: "comite_risk_compliance" });
      return { ok: true, decision };
    });
  }

  // ── Validation finale : four-eyes strict + visas complets → outbox ──
  // R11 : réassignation de validateur réservée au process owner / manager (domain.py
  // ROLES_REASSIGNATION = process_owner, application_manager, coo).
  private static ROLES_REASSIGNATION = ["CO_SR", "DIR", "ADMIN"];

  async validate(ctx: Ctx, code: string, expectedVersion?: number, engagement: boolean = false) {
    const kyc = await this.prisma.kycFile.findFirst({
      where: { code, tenantId: ctx.tenantId }, include: { visas: true } });
    if (!kyc) throw new NotFoundException("Dossier introuvable");
    await this.verifierNonCloture(ctx, kyc.clientId);                 // OF-10
    if (kyc.status === "VALIDATED") throw new ConflictException("Déjà validé");
    if (kyc.createdBy === ctx.userId)
      throw new ConflictException("Four-eyes : le validateur doit différer du créateur");
    // R52 : four-eyes renforcé sur la validation finale — le validateur ne doit avoir contribué à AUCUNE section.
    const allContribs = await this.prisma.kycQuestionHistory.findMany({
      where: { question: { section: { kycFileId: kyc.id } } },
      select: { changedBy: true }, distinct: ["changedBy"] });
    if (allContribs.some(c => c.changedBy === ctx.userId))
      throw new ConflictException(`[R52] Four-eyes final : ${ctx.userId} a contribué au dossier — validation exclue`);
    if (!["CO_SR", "MLRO", "DIR", "ADMIN"].includes(ctx.role))
      throw new ForbiddenException(`Rôle ${ctx.role} : validation finale non autorisée`);
    const pending = kyc.visas.filter(v => v.status !== "SIGNED");
    if (pending.length) throw new BadRequestException(
      `Visas manquants : ${pending.map(v => v.sectionCode + "/" + v.requiredRole).join(", ")}`);
    // R282/VD-02 : la COMPLÉTUDE suit la matrice de LA CRÉATION du dossier (R29, grandfathering) —
    // une question REQUIRED (pour au moins un rôle, à cette date) doit porter une réponse.
    const toutes = await this.prisma.kycQuestion.findMany({
      where: { section: { kycFileId: kyc.id } }, include: { accessRules: true } });
    const requisesManquantes = toutes
      .filter((q) => this.aDate(q.accessRules, kyc.createdAt).some((r) => r.right === "REQUIRED") && !q.answer)
      .map((q) => q.code);
    if (requisesManquantes.length) throw new BadRequestException(
      `R282 : contributions REQUISES manquantes (matrice à la création du dossier) : ${requisesManquantes.join(", ")}`);
    // R14 : engagement de responsabilité obligatoire à la validation finale (pop-up serveur).
    // Placé APRÈS tous les gardes (R13/R52/rôle/complétude) : la précédence des refus est conservée.
    if (!engagement) throw new ConflictException(
      "[R14] Engagement de responsabilité requis : le validateur final confirme le respect des process avant de signer.");

    return this.prisma.$transaction(async (tx) => {
      // R336/LK (lot 1) : validation finale GARDÉE par la version du dossier (jamais deux
      // validations concurrentes qui s'écrasent). If-Match présent → strict ; absent → version
      // courante (expand). enforce:true = strict sur le lot 1.
      const validatedAt = new Date();
      await majVersionnee(tx.kycFile, kyc.id, expectedVersion ?? kyc.version,
        { status: "VALIDATED", validatedBy: ctx.userId, validatedAt }, { enforce: true });
      await tx.domainEvent.create({ data: { tenantId: ctx.tenantId,
        type: "kyc.validated", aggregateId: kyc.id,
        payload: { code, validatedBy: ctx.userId } as any } });
      if (this.reviews) await this.reviews.surApprobation(ctx, tx,            // RV-01/07 : l'échéance naît ICI
        { id: kyc.id, clientId: kyc.clientId, workflow: kyc.workflow, validatedAt });
      await this.audit.log(ctx.tenantId, ctx.userId, "KYC_ENGAGEMENT_RESPONSABILITE", code);   // R14
      await this.audit.log(ctx.tenantId, ctx.userId, "KYC_VALIDATED", code);
      return tx.kycFile.findUnique({ where: { id: kyc.id } });
    });
  }

  // ── Portes minces Home (amendement Ali 2026-07-27). Périmètre matrice A.3, appliqué SERVEUR : ──
  // RM/ARM = ses clients (Client.rmUserId) ; ADMIN = refus (aucune donnée client, HO-06) ; sinon tenant.
  private async scopeClientsHome(ctx: Ctx): Promise<string[] | null> {
    if (ctx.role === "ADMIN") throw new ForbiddenException("HOME_SCOPE: ADMIN ne voit aucune donnée client (matrice A.3)");
    if (ctx.role === "RM" || ctx.role === "ARM") {
      const miens = await this.prisma.client.findMany({ where: { tenantId: ctx.tenantId, rmUserId: ctx.userId } });
      return miens.map((c: any) => c.id);
    }
    return null;                                                          // voit-tout : périmètre = tenant
  }

  // T1/HO-01/HO-03 : liste des dossiers du périmètre (résumés seulement — les compteurs se font côté source).
  async lister(ctx: Ctx, statut?: string) {
    const scope = await this.scopeClientsHome(ctx);
    const where: any = { tenantId: ctx.tenantId };
    if (scope) where.clientId = { in: scope };
    if (statut) where.status = statut;
    const rows = await this.prisma.kycFile.findMany({ where, orderBy: { createdAt: "desc" }, take: 500 });
    return rows.map((k: any) => ({ code: k.code, clientId: k.clientId, status: k.status, riskLevel: k.riskLevel, createdAt: k.createdAt }));
  }

  // T2/HO-05 : visas PENDING dont requiredRole = MON rôle, sur les dossiers de MON périmètre.
  async visasPending(ctx: Ctx) {
    const scope = await this.scopeClientsHome(ctx);
    const whereFile: any = { tenantId: ctx.tenantId };
    if (scope) whereFile.clientId = { in: scope };
    const visas = await this.prisma.kycVisa.findMany({
      where: { status: "PENDING", requiredRole: ctx.role as any, kycFile: whereFile },
      include: { kycFile: true }, take: 200 });
    return visas.map((v: any) => ({ kycCode: v.kycFile.code, section: v.sectionCode, requiredRole: v.requiredRole }));
  }

  // R291/DC-06 : l'agrégat de CHARGE — visas PENDING par rôle, TENANT ENTIER. Servi au
  // Command Center (le backend agrège, jamais l'écran) — Direction/CO_SR seulement.
  async visasCharge(ctx: Ctx) {
    if (!["DIR", "CO_SR"].includes(ctx.role))
      throw new ForbiddenException("R291 : la charge compliance agrégée se consulte en DIRECTION/CO_SR");
    const visas = await this.prisma.kycVisa.findMany({
      where: { status: "PENDING", kycFile: { tenantId: ctx.tenantId } },
      include: { kycFile: { select: { createdAt: true } } } });
    const parRole: Record<string, number> = {};
    let plusAncien: Date | null = null;
    for (const v of visas as any[]) {
      parRole[v.requiredRole] = (parRole[v.requiredRole] ?? 0) + 1;
      if (!plusAncien || v.kycFile.createdAt < plusAncien) plusAncien = v.kycFile.createdAt;
    }
    return { total: visas.length, parRole, plusAncien };
  }

  async get(ctx: Ctx, code: string) {
    const kyc = await this.prisma.kycFile.findFirst({
      where: { code, tenantId: ctx.tenantId },
      include: { sections: { orderBy: { orderIndex: "asc" },
        include: { questions: { include: { accessRules: true } } } }, visas: true } });
    if (!kyc) throw new NotFoundException("Dossier introuvable");
    // Projection par rôle : les questions HIDDEN n'atteignent JAMAIS le client.
    return { ...kyc, sections: kyc.sections.map(s => ({ ...s,
      questions: s.questions
        .filter(q => this.enVigueur(q.accessRules).some(r => r.role === ctx.role && r.right !== "HIDDEN"))  // R282 : jamais grandfathérée
        .map(({ accessRules, ...q }) => ({ ...q,
          right: this.enVigueur(accessRules).find(r => r.role === ctx.role)?.right ?? "VIEW" })) })) };
  }

  // ════════ P4 vague pilote (arbitrage : « sdkyc rendu sur le modèle ACTUEL, SD-04 suspendu ») ════
  // La matrice sections × rôles est DÉRIVÉE des KycAccessRule par question — aucune table neuve.
  // SD-04 LEVÉ par R282 (2026-07-28) : versionnage à date effective_from/effective_to, versions
  // closes immuables (trigger SQL), lecture d'époque via ?asOf=. L'édition passe les GARDE-FOUS
  // backend (SD-02) ; chaque modification est un événement daté (change tracker).

  async accessMatrix(ctx: Ctx, code: string, asOf?: string) {
    if (!["CO_SR", "ADMIN"].includes(ctx.role))
      throw new ForbiddenException("La matrice de droits se consulte en CO_SR/ADMIN");
    const kyc = await this.prisma.kycFile.findFirst({ where: { code, tenantId: ctx.tenantId },
      include: { sections: { orderBy: { orderIndex: "asc" },
        include: { questions: { include: { accessRules: true } } } }, visas: true } });
    if (!kyc) throw new NotFoundException("Dossier introuvable");
    const roles = ["RM", "ARM", "CO", "CO_SR", "MLRO", "CF", "BRM", "DIR", "ADMIN"];
    return { code: kyc.code, sections: kyc.sections.map((sec) => ({
      code: sec.code, label: sec.label,
      visas: kyc.visas.filter((v) => v.sectionCode === sec.code).map((v) => v.requiredRole),
      questions: sec.questions.map((q) => ({ code: q.code, label: q.label,
        droits: Object.fromEntries(roles.map((r) => {
          // VD-03 : « quelle était la matrice du 15.03 ? » — résolution par dates d'effet (R48)
          const jeu = asOf ? this.aDate(q.accessRules, new Date(asOf)) : this.enVigueur(q.accessRules);
          const rule = jeu.find((ar) => ar.role === (r as any));
          return [r, rule?.right ?? "HIDDEN"];                              // default-deny : absent = HIDDEN
        })) })) })) };
  }

  // SD-01/02 : éditer UNE cellule — garde-fous BACKEND (refus typé), événement au change tracker.
  async modifierAccess(ctx: Ctx, code: string, qCode: string, dto: { role?: string; right?: string; portee?: string }) {
    if (!["CO_SR", "ADMIN"].includes(ctx.role))
      throw new ForbiddenException("La matrice de droits s'édite en CO_SR/ADMIN");
    if (!dto?.role || !dto?.right || !["HIDDEN", "VIEW", "EDIT", "REQUIRED"].includes(dto.right))
      throw new BadRequestException("role et right (HIDDEN|VIEW|EDIT|REQUIRED) requis");
    const q = await this.prisma.kycQuestion.findFirst({
      where: { code: qCode, section: { kycFile: { code, tenantId: ctx.tenantId } } },
      include: { accessRules: true, section: { include: { kycFile: { include: { visas: true } },
        questions: { include: { accessRules: true } } } } } });
    if (!q) throw new NotFoundException("Question introuvable");
    const reglesVigueur = this.enVigueur(q.accessRules);
    const ancienne = reglesVigueur.find((r) => r.role === (dto.role as any))?.right ?? "HIDDEN";
    // Garde-fou SD-02a : une question doit garder AU MOINS un rôle éditeur (EDIT/REQUIRED)
    const editeursApres = reglesVigueur.filter((r) =>
      (r.role === (dto.role as any) ? dto.right : r.right) === "EDIT"
      || (r.role === (dto.role as any) ? dto.right : r.right) === "REQUIRED").length
      + (reglesVigueur.some((r) => r.role === (dto.role as any)) ? 0
        : (["EDIT", "REQUIRED"].includes(dto.right) ? 1 : 0));
    if (editeursApres === 0)
      throw new BadRequestException("SD-02 : refus — la question n'aurait plus AUCUN rôle éditeur (section sans EDIT)");
    // Garde-fou SD-02b : un rôle porteur d'un VISA de la section ne peut pas finir HIDDEN partout
    const visasSection = q.section.kycFile.visas.filter((v) => v.sectionCode === q.section.code).map((v) => v.requiredRole);
    if (dto.right === "HIDDEN" && visasSection.includes(dto.role as any)) {
      const resteVisible = q.section.questions.some((autre) => autre.id !== q.id
        && this.enVigueur(autre.accessRules).some((r) => r.role === (dto.role as any) && r.right !== "HIDDEN"));
      if (!resteVisible)
        throw new BadRequestException(`SD-02 : refus — le rôle ${dto.role} porte un VISA de la section et n'y verrait plus rien`);
    }
    // R282 : la portée « matrice » applique le changement à TOUS les dossiers du tenant (la
    // sécurité ne se grandfathère pas — VD-01) ; « dossier » (défaut) reste l'acte SD-02.
    const portee = dto.portee === "matrice" ? "matrice" : "dossier";
    const cibles = portee === "matrice"
      ? await this.prisma.kycQuestion.findMany({
          where: { code: qCode, section: { kycFile: { tenantId: ctx.tenantId } } }, select: { id: true } })
      : [{ id: q.id }];
    const dateEffet = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const cible of cibles) {
        // R282 : modifier = CLORE la version courante (elle devient immuable) + INSÉRER la nouvelle.
        await tx.kycAccessRule.updateMany({
          where: { questionId: cible.id, role: dto.role as any, effectiveTo: null },
          data: { effectiveTo: dateEffet } });
        await tx.kycAccessRule.create({ data: { questionId: cible.id, role: dto.role as any,
          right: dto.right as any, effectiveFrom: dateEffet } });
      }
      await tx.domainEvent.create({ data: { tenantId: ctx.tenantId, type: "kyc.access.modifie",
        aggregateId: q.section.kycFile.id,
        payload: { question: qCode, role: dto.role, ancienne, nouvelle: dto.right, par: ctx.userId,
          dateEffet: dateEffet.toISOString(), portee, dossiersTouches: cibles.length } as any } });
      await this.audit.log(ctx.tenantId, ctx.userId, "KYC_ACCESS_MODIFIE", `${code}/${qCode}:${dto.role}=${dto.right}:${portee}`);
    });
    return { question: qCode, role: dto.role, ancienne, nouvelle: dto.right, portee, dateEffet: dateEffet.toISOString() };
  }

  // SD-03 : « Voir comme » — la projection est SERVIE avec le rôle simulé (jamais un masquage front).
  async voirComme(ctx: Ctx, code: string, roleSimule: string) {
    if (!["CO_SR", "ADMIN"].includes(ctx.role))
      throw new ForbiddenException("« Voir comme » est réservé aux rôles de paramétrage (CO_SR/ADMIN)");
    return this.get({ ...ctx, role: roleSimule }, code);                    // MÊME projection HIDDEN, rôle substitué
  }

  // ════════ R84 — Édition exclusive (« la main » / checkout), persistée + tracée ════════
  private async findKyc(ctx: Ctx, code: string) {
    const kyc = await this.prisma.kycFile.findFirst({ where: { code, tenantId: ctx.tenantId } });
    if (!kyc) throw new NotFoundException("Dossier introuvable");
    return kyc;
  }
  // Reconstruit la logique R84 à partir de l'état persisté (détenteur courant).
  private lockDomain(code: string, holder: string | null): KycLockService {
    const svc = new KycLockService();
    if (holder) svc.prendreLaMain(code, holder, new Date());
    return svc;
  }
  // Émet un événement (outbox transactionnel) + audit — invariant : rien ne change sans trace.
  private async emit(tx: Tx, ctx: Ctx, type: string, aggregateId: string, payload: any) {
    await tx.domainEvent.create({ data: { tenantId: ctx.tenantId, type, aggregateId, payload } });
    await this.audit.log(ctx.tenantId, ctx.userId, type.toUpperCase().replace(/\./g, "_"), JSON.stringify(payload));
  }

  async takeLock(ctx: Ctx, code: string) {
    const kyc = await this.findKyc(ctx, code);
    const lock = await this.prisma.kycLock.findUnique({ where: { kycFileId: kyc.id } });
    try { this.lockDomain(code, lock?.holder ?? null).prendreLaMain(code, ctx.userId, new Date()); }
    catch (e) { throw new ConflictException((e as KycLockError).message); }   // détenu par un autre (R84)
    return this.prisma.$transaction(async (tx) => {
      const up = await tx.kycLock.upsert({ where: { kycFileId: kyc.id },
        create: { tenantId: ctx.tenantId, kycFileId: kyc.id, holder: ctx.userId },
        update: { holder: ctx.userId, acquiredAt: new Date() } });
      await tx.kycLockRequest.deleteMany({ where: { lockId: up.id, requester: ctx.userId } });
      await this.emit(tx, ctx, "kyc.lock.acquired", kyc.id, { code, holder: ctx.userId });
      return up;
    });
  }

  async releaseLock(ctx: Ctx, code: string) {
    const kyc = await this.findKyc(ctx, code);
    const lock = await this.prisma.kycLock.findUnique({ where: { kycFileId: kyc.id } });
    try { this.lockDomain(code, lock?.holder ?? null).liberer(code, ctx.userId, new Date()); }
    catch (e) { throw new ForbiddenException((e as KycLockError).message); }   // seul le détenteur (R84)
    return this.prisma.$transaction(async (tx) => {
      const up = await tx.kycLock.update({ where: { kycFileId: kyc.id }, data: { holder: null } });
      await this.emit(tx, ctx, "kyc.lock.released", kyc.id, { code, by: ctx.userId });
      return up;
    });
  }

  async requestHand(ctx: Ctx, code: string) {
    const kyc = await this.findKyc(ctx, code);
    const lock = await this.prisma.kycLock.findUnique({ where: { kycFileId: kyc.id } });
    try { this.lockDomain(code, lock?.holder ?? null).demanderLaMain(code, ctx.userId, new Date()); }
    catch (e) { throw new BadRequestException((e as KycLockError).message); }  // libre / soi-même (R84)
    return this.prisma.$transaction(async (tx) => {
      await tx.kycLockRequest.upsert({
        where: { lockId_requester: { lockId: lock!.id, requester: ctx.userId } },
        create: { lockId: lock!.id, requester: ctx.userId }, update: {} });
      await this.emit(tx, ctx, "kyc.lock.requested", kyc.id, { code, requester: ctx.userId, holder: lock!.holder });
      return { requested: true, holder: lock!.holder };
    });
  }

  async passHand(ctx: Ctx, code: string, to: string) {
    const kyc = await this.findKyc(ctx, code);
    const lock = await this.prisma.kycLock.findUnique({ where: { kycFileId: kyc.id } });
    try { this.lockDomain(code, lock?.holder ?? null).passerLaMain(code, ctx.userId, to, new Date()); }
    catch (e) { throw new ForbiddenException((e as KycLockError).message); }   // seul le détenteur passe (R84)
    return this.prisma.$transaction(async (tx) => {
      const up = await tx.kycLock.update({ where: { kycFileId: kyc.id }, data: { holder: to, acquiredAt: new Date() } });
      await tx.kycLockRequest.deleteMany({ where: { lockId: up.id, requester: to } });
      await this.emit(tx, ctx, "kyc.lock.passed", kyc.id, { code, from: ctx.userId, to });
      return up;
    });
  }

  // ════════ R85 — Passage de main section par section (message obligatoire), persisté + tracé ════════
  // Chaîne de validation (configurable par workflow en P2). L'index courant est kyc_files.handoff_phase.
  private static HANDOFF_PHASES = ["ARM", "RM", "BRM", "Compliance", "Validation"];
  private handoffOf(kyc: any): KycHandoff {
    const st: HandoffStatus = kyc.status === "VALIDATED" ? "valide" : kyc.status === "REJECTED" ? "rejete" : "en_cours";
    return new KycHandoff(KycService.HANDOFF_PHASES, kyc.handoffPhase ?? 0, st);
  }
  private idxOf(phase: string): number { return KycService.HANDOFF_PHASES.indexOf(phase); }

  // R336/LK (lot 1) : chaque transition de handoff est GARDÉE par la version du dossier
  // (deux acteurs qui se repassent la main ne clobbent jamais handoff_phase / status).
  // If-Match présent → strict ; absent → version courante (expand). enforce:true = strict lot 1.
  async handoffNext(ctx: Ctx, code: string, message: string, expectedVersion?: number) {
    const kyc = await this.findKyc(ctx, code);
    const hf = this.handoffOf(kyc);
    let phase: string;
    try { phase = hf.nextStep(ctx.userId, message, new Date()); }
    catch (e) { throw new BadRequestException((e as HandoffError).message); }   // message obligatoire / dernière étape
    return this.prisma.$transaction(async (tx) => {
      await majVersionnee(tx.kycFile, kyc.id, expectedVersion ?? kyc.version, { handoffPhase: this.idxOf(phase) }, { enforce: true });
      await this.emit(tx, ctx, "kyc.handoff.next", kyc.id, { code, to: phase, by: ctx.userId, message });
      return { phase, status: hf.status };
    });
  }

  async handoffBack(ctx: Ctx, code: string, message: string, expectedVersion?: number) {
    const kyc = await this.findKyc(ctx, code);
    const hf = this.handoffOf(kyc);
    let phase: string;
    try { phase = hf.revenir(ctx.userId, message, new Date()); }
    catch (e) { throw new BadRequestException((e as HandoffError).message); }   // message obligatoire / première étape
    return this.prisma.$transaction(async (tx) => {
      await majVersionnee(tx.kycFile, kyc.id, expectedVersion ?? kyc.version, { handoffPhase: this.idxOf(phase) }, { enforce: true });
      await this.emit(tx, ctx, "kyc.handoff.back", kyc.id, { code, to: phase, by: ctx.userId, message });
      return { phase, status: hf.status };
    });
  }

  async handoffValidate(ctx: Ctx, code: string, message: string, expectedVersion?: number) {
    const kyc = await this.findKyc(ctx, code);
    const hf = this.handoffOf(kyc);
    try { hf.valider(ctx.userId, message, new Date()); }
    catch (e) { throw new BadRequestException((e as HandoffError).message); }   // seulement à la section de validation
    return this.prisma.$transaction(async (tx) => {
      await majVersionnee(tx.kycFile, kyc.id, expectedVersion ?? kyc.version, { status: "VALIDATED", validatedBy: ctx.userId, validatedAt: new Date() }, { enforce: true });
      await this.emit(tx, ctx, "kyc.handoff.validated", kyc.id, { code, by: ctx.userId, message });
      return { status: "valide" };
    });
  }

  async handoffReject(ctx: Ctx, code: string, message: string, expectedVersion?: number) {
    const kyc = await this.findKyc(ctx, code);
    const hf = this.handoffOf(kyc);
    try { hf.rejeter(ctx.userId, message, new Date()); }
    catch (e) { throw new BadRequestException((e as HandoffError).message); }   // motif obligatoire (R7)
    return this.prisma.$transaction(async (tx) => {
      await majVersionnee(tx.kycFile, kyc.id, expectedVersion ?? kyc.version, { status: "REJECTED" }, { enforce: true });
      await this.emit(tx, ctx, "kyc.handoff.rejected", kyc.id, { code, by: ctx.userId, message });
      return { status: "rejete" };
    });
  }
}
