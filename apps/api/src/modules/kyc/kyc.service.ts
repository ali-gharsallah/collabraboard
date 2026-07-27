import { Injectable, BadRequestException, ForbiddenException, ConflictException, NotFoundException } from "@nestjs/common";
import { createHmac } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { computeRisk } from "./risk-engine";
import { SECTIONS_BY_WORKFLOW, VISAS_BY_WORKFLOW } from "./kyc.templates";
import { SectionFourEyes } from "./rules/section-four-eyes"; // R13/R52
import { NamedValidator } from "./rules/named-validator"; // R2/R4
import { QualifiedVisaService, VisaError, Verdict } from "./rules/qualified-visa.service"; // R86
import { KycLockService, KycLockError } from "./rules/kyc-lock.service"; // R84
import { KycHandoff, HandoffError, HandoffStatus } from "./rules/kyc-handoff"; // R85
import { etatCloture } from "../offboarding/cloture.util"; // R267/OF-10 — lecture seule intégrale

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
              private reviews?: { surApprobation(ctx: Ctx, tx: any, kyc: any): Promise<any> }) {}

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
    opts: { viaOnboarding?: boolean } = {}) {
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, tenantId: ctx.tenantId } });
    if (!client) throw new NotFoundException("Client introuvable dans ce tenant");
    // R271/OF-10 : client clôturé — le retour ne « rouvre » pas : SEUL un nouvel onboarding
    // (MOD-69) crée le KYC Rn+1, chaîné au précédent ; la création directe refuse.
    const cloture = await etatCloture(this.prisma, ctx.tenantId, dto.clientId);
    if (cloture.cloture && !opts.viaOnboarding) throw new ConflictException(
      `OFFBOARDING_LECTURE_SEULE : dossier clôturé le ${cloture.le?.slice(0, 10)} — le retour passe par un nouvel onboarding (R271)`);

    let risk = computeRisk({ structure: dto.legalStructure,
      accountType: dto.accountType, countryCode: dto.countryCode });
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
    const year = new Date().getFullYear();

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
        sections: { create: SECTIONS_BY_WORKFLOW[risk.workflow].map((s, i) => ({
          code: s.code, label: s.label, orderIndex: i,
          questions: { create: s.questions.map(q => ({
            code: q.code, label: q.label,
            accessRules: { create: Object.entries(q.rights ?? {}).map(([role, right]) => ({
              role: role as any, right: right as any })) } })) } })) },
        visas: { create: VISAS_BY_WORKFLOW[risk.workflow].map(v => ({
          sectionCode: v.sectionCode, requiredRole: v.role })) },
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
  async answer(ctx: Ctx, code: string, qCode: string, answer: string) {
    const q = await this.prisma.kycQuestion.findFirst({
      where: { code: qCode, section: { kycFile: { code, tenantId: ctx.tenantId } } },
      include: { accessRules: true,
        section: { include: { kycFile: { select: { id: true, status: true, clientId: true } } } } } });
    if (!q) throw new NotFoundException("Question introuvable");
    await this.verifierNonCloture(ctx, q.section.kycFile.clientId);   // OF-10
    if (q.section.kycFile.status === "VALIDATED")
      throw new ConflictException("Dossier validé — créer une révision (Rn+1)");

    const rule = q.accessRules.find(r => r.role === ctx.role);
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
      return tx.kycQuestion.update({ where: { id: q.id },
        data: { answer, answeredBy: ctx.userId, answeredAt: changedAt } });
    });
  }

  // ── Visa de section (rôle requis strict) ──
  async signVisa(ctx: Ctx, code: string, sectionCode: string, verdict: string = "OK", message: string = "") {
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
    return this.prisma.kycVisa.update({ where: { id: visa.id },
      data: { status: "SIGNED", signedBy: ctx.userId, signedAt: new Date(),
              verdict: qv.verdict, message: qv.message } });
  }

  // ── Validation finale : four-eyes strict + visas complets → outbox ──
  async validate(ctx: Ctx, code: string) {
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

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.kycFile.update({ where: { id: kyc.id },
        data: { status: "VALIDATED", validatedBy: ctx.userId, validatedAt: new Date() } });
      await tx.domainEvent.create({ data: { tenantId: ctx.tenantId,
        type: "kyc.validated", aggregateId: kyc.id,
        payload: { code, validatedBy: ctx.userId } as any } });
      if (this.reviews) await this.reviews.surApprobation(ctx, tx,            // RV-01/07 : l'échéance naît ICI
        { id: kyc.id, clientId: kyc.clientId, workflow: kyc.workflow, validatedAt: updated.validatedAt });
      await this.audit.log(ctx.tenantId, ctx.userId, "KYC_VALIDATED", code);
      return updated;
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

  async get(ctx: Ctx, code: string) {
    const kyc = await this.prisma.kycFile.findFirst({
      where: { code, tenantId: ctx.tenantId },
      include: { sections: { orderBy: { orderIndex: "asc" },
        include: { questions: { include: { accessRules: true } } } }, visas: true } });
    if (!kyc) throw new NotFoundException("Dossier introuvable");
    // Projection par rôle : les questions HIDDEN n'atteignent JAMAIS le client.
    return { ...kyc, sections: kyc.sections.map(s => ({ ...s,
      questions: s.questions
        .filter(q => q.accessRules.some(r => r.role === ctx.role && r.right !== "HIDDEN"))
        .map(({ accessRules, ...q }) => ({ ...q,
          right: accessRules.find(r => r.role === ctx.role)?.right ?? "VIEW" })) })) };
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
  private async emit(tx: any, ctx: Ctx, type: string, aggregateId: string, payload: any) {
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

  async handoffNext(ctx: Ctx, code: string, message: string) {
    const kyc = await this.findKyc(ctx, code);
    const hf = this.handoffOf(kyc);
    let phase: string;
    try { phase = hf.nextStep(ctx.userId, message, new Date()); }
    catch (e) { throw new BadRequestException((e as HandoffError).message); }   // message obligatoire / dernière étape
    return this.prisma.$transaction(async (tx) => {
      await tx.kycFile.update({ where: { id: kyc.id }, data: { handoffPhase: this.idxOf(phase) } });
      await this.emit(tx, ctx, "kyc.handoff.next", kyc.id, { code, to: phase, by: ctx.userId, message });
      return { phase, status: hf.status };
    });
  }

  async handoffBack(ctx: Ctx, code: string, message: string) {
    const kyc = await this.findKyc(ctx, code);
    const hf = this.handoffOf(kyc);
    let phase: string;
    try { phase = hf.revenir(ctx.userId, message, new Date()); }
    catch (e) { throw new BadRequestException((e as HandoffError).message); }   // message obligatoire / première étape
    return this.prisma.$transaction(async (tx) => {
      await tx.kycFile.update({ where: { id: kyc.id }, data: { handoffPhase: this.idxOf(phase) } });
      await this.emit(tx, ctx, "kyc.handoff.back", kyc.id, { code, to: phase, by: ctx.userId, message });
      return { phase, status: hf.status };
    });
  }

  async handoffValidate(ctx: Ctx, code: string, message: string) {
    const kyc = await this.findKyc(ctx, code);
    const hf = this.handoffOf(kyc);
    try { hf.valider(ctx.userId, message, new Date()); }
    catch (e) { throw new BadRequestException((e as HandoffError).message); }   // seulement à la section de validation
    return this.prisma.$transaction(async (tx) => {
      await tx.kycFile.update({ where: { id: kyc.id }, data: { status: "VALIDATED", validatedBy: ctx.userId, validatedAt: new Date() } });
      await this.emit(tx, ctx, "kyc.handoff.validated", kyc.id, { code, by: ctx.userId, message });
      return { status: "valide" };
    });
  }

  async handoffReject(ctx: Ctx, code: string, message: string) {
    const kyc = await this.findKyc(ctx, code);
    const hf = this.handoffOf(kyc);
    try { hf.rejeter(ctx.userId, message, new Date()); }
    catch (e) { throw new BadRequestException((e as HandoffError).message); }   // motif obligatoire (R7)
    return this.prisma.$transaction(async (tx) => {
      await tx.kycFile.update({ where: { id: kyc.id }, data: { status: "REJECTED" } });
      await this.emit(tx, ctx, "kyc.handoff.rejected", kyc.id, { code, by: ctx.userId, message });
      return { status: "rejete" };
    });
  }
}
