import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { emitEvent } from "../../common/domain-event";
import { Tx } from "../../common/tx";
import { resoudreParametresGouvernes, modifierParametreGouverne } from "../../common/param-engagement";

/**
 * Bloc 65 — Harmonisation des revues, Volet A (repo R466–R473, HR-01..14).
 * DELTA sur l'existant, jamais un moteur neuf :
 *  - l'AR est une RÉVISION du dossier KYC (acquis R283 : revision/previousKycId/profil figé R29) —
 *    ici s'ajoutent le PRÉ-REMPLISSAGE depuis le dernier KYC approuvé et le DIFF visé (R467) ;
 *  - la GAR est un dossier PARENT projeté d'événements (pattern moteur Bloc 62) — les schémas
 *    Bloc 62 étant spécifiques offboarding, la GAR porte ses types gar.* dédiés au catalogue ;
 *  - le groupe est une PROJECTION du graphe personnes/liens (R30+/R152) — jamais une liste stockée ;
 *  - le §Review passe par le pop-up d'engagement R445 (param-engagement, AGG "review-params").
 * R44 partout : les conséquences d'un verdict sont PROPOSÉES (tâches), jamais exécutées seules.
 */

type Ctx = { tenantId: string; userId: string; role: string };

const AGG_PARAMS = "review-params";
export const DEFAUTS_REVIEW = {
  review: {
    periodiciteMois: { HIGH: 12, MEDIUM: 24, LOW: 36, PEP: 12 },            // R468
    verdictConsequences: {                                                   // R468 — proposées, jamais exécutées seules
      RESERVES: ["TACHES_REMEDIATION"],
      NON_CONFORME: ["PROPOSER_EDD", "PROPOSER_COC", "PROPOSER_OFFBOARDING"],
    },
    visaEnBlocSectionsInchangees: true,                                      // R467
    groupe: {
      criteres: ["UBO_COMMUN"],                                              // R469
      enabled: true, cascadeGroupToMembers: true, cascadeMemberToGroup: true, // R471
      guardMembresNonClotures: "BLOQUANT",                                   // R470
    },
    affichageParType: {                                                      // R472 — gabarit unique, panneaux par paramètre
      KYC: { panneaux: [] },
      ACCOUNT_REVIEW: { panneaux: ["delta"] },
      GROUP_ACCOUNT_REVIEW: { panneaux: ["vue-consolidee"] },
    },
  },
};
const SECTIONS_GAR = ["comptes-lies", "vue-consolidee", "decision-groupe"];  // Section Designer GAR (acquis)
const VERDICTS = ["CONFORME", "RESERVES", "NON_CONFORME"];
const CRITERE_LIEN: Record<string, string> = { UBO_COMMUN: "UBO", GROUPE_CORPORATE_DECLARE: "GROUPE_CORPORATE", FAMILLE: "FAMILLE" };

function plusMois(d: Date, mois: number): Date { const r = new Date(d); r.setMonth(r.getMonth() + mois); return r; }

@Injectable()
export class RevueHarmoniseeService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private kycSvc?: { create(ctx: Ctx, dto: any, opts: any): Promise<any> };
  brancherKyc(svc: any) { this.kycSvc = svc; }

  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return emitEvent(tx, tenantId, type, aggregateId, payload);
  }
  private async params(ctx: Ctx, aDate?: Date) {
    const p = await resoudreParametresGouvernes(this.prisma, ctx.tenantId, AGG_PARAMS, DEFAUTS_REVIEW, aDate ?? new Date());
    return (p as any).review;
  }
  private async evsType(tenantId: string, type: string) {
    return this.prisma.domainEvent.findMany({ where: { tenantId, type }, orderBy: { id: "asc" } });
  }
  private async kycParCode(ctx: Ctx, code: string) {
    const kyc = await this.prisma.kycFile.findFirst({ where: { tenantId: ctx.tenantId, code },
      include: { sections: { include: { questions: true } }, visas: true } });
    if (!kyc) throw new NotFoundException(`Dossier ${code} introuvable`);
    return kyc;
  }
  private async dernierKycValide(ctx: Ctx, clientId: string) {
    return this.prisma.kycFile.findFirst({
      where: { tenantId: ctx.tenantId, clientId, status: "VALIDATED" },
      orderBy: { revision: "desc" },
      include: { sections: { include: { questions: true } }, visas: true } });
  }

  // ── R467 : la révision de revue — COPIE du dernier KYC approuvé (sections, réponses, visas
  //    PENDING), chaque réponse née REPRISE. Le kycSvc branché prime ; sinon copie directe
  //    (même sémantique de révision que kyc.create — R271, chaînée previousKycId). ──
  private async creerRevision(ctx: Ctx, clientId: string, source: any, type: string, deadlineId: string) {
    // La révision suit la DERNIÈRE révision du client (une AR déjà ouverte a pu prendre Rn+1).
    const derniere = await this.prisma.kycFile.findFirst({
      where: { tenantId: ctx.tenantId, clientId }, orderBy: { revision: "desc" } });
    const revision = (derniere?.revision ?? source.revision ?? 1) + 1;
    const code = source.code.replace(/-R\d+$/, `-R${revision}`);
    return this.prisma.$transaction(async (tx: Tx) => {
      const kyc = await tx.kycFile.create({ data: {
        tenantId: ctx.tenantId, clientId, code, year: source.year, countryCode: source.countryCode,
        sequence: source.sequence, revision, previousKycId: source.id, workflow: source.workflow,
        riskScore: source.riskScore, riskLevel: source.riskLevel, status: "IN_PROGRESS",
        createdBy: ctx.userId } });
      let reprises = 0;
      for (const sec of source.sections) {
        const s = await tx.kycSection.create({ data: { kycFileId: kyc.id, code: sec.code,
          label: sec.label, orderIndex: sec.orderIndex } as any });
        for (const q of sec.questions) {
          await tx.kycQuestion.create({ data: { sectionId: s.id, code: q.code, label: q.label,
            answer: q.answer, answeredBy: q.answeredBy, answeredAt: q.answeredAt } as any });
          if (q.answer != null) reprises += 1;
        }
      }
      for (const v of source.visas)
        await tx.kycVisa.create({ data: { kycFileId: kyc.id, sectionCode: v.sectionCode,
          requiredRole: v.requiredRole, status: "PENDING" } as any });
      await this.emit(tx, ctx.tenantId, "review.lancee", kyc.id, {
        deadlineId, clientId, type, niveau: source.workflow, kycCode: code, revision,
        previousKycId: source.id, profil: {}, par: ctx.userId });
      await this.emit(tx, ctx.tenantId, "review.prerempli", kyc.id,
        { kycCode: code, depuisKyc: source.id, reprises });
      return { kycId: kyc.id, kycCode: code, revision };
    });
  }

  async ouvrirRevue(ctx: Ctx, deadlineId: string, dto: { type?: string }) {
    const d = await this.prisma.reviewDeadline.findFirst({ where: { id: deadlineId, tenantId: ctx.tenantId } });
    if (!d) throw new NotFoundException("Échéance introuvable");
    if (d.statut !== "PLANIFIEE") throw new ConflictException(`Échéance ${d.statut} — seule une échéance PLANIFIEE se lance`);
    const source = await this.dernierKycValide(ctx, d.clientId);
    if (!source) throw new BadRequestException("R467 : aucune revue sans dernier KYC APPROUVÉ — la revue part de lui");
    const r = await this.creerRevision(ctx, d.clientId, source, dto?.type ?? "ACCOUNT_REVIEW", d.id);
    await this.audit.log(ctx.tenantId, ctx.userId, "REVIEW_OUVERTE", r.kycCode);
    return r;
  }

  // ── R467 : modifier une réponse de revue — ancien/nouveau TRACÉS, origine MODIFIÉE. ──
  async modifierReponse(ctx: Ctx, kycCode: string, dto: { section?: string; question?: string; valeur?: string }) {
    if (!dto?.section || !dto?.question || dto?.valeur == null)
      throw new BadRequestException("section, question et valeur requis");
    const kyc = await this.kycParCode(ctx, kycCode);
    if (kyc.status === "VALIDATED") throw new ConflictException("Revue close — lecture seule (R16)");
    const sec = (kyc as any).sections.find((s: any) => s.code === dto.section);
    const q = sec?.questions.find((x: any) => x.code === dto.question);
    if (!q) throw new NotFoundException(`Question ${dto.section}/${dto.question} introuvable`);
    const ancien = q.answer ?? null;
    return this.prisma.$transaction(async (tx: Tx) => {
      await tx.kycQuestion.update({ where: { id: q.id },
        data: { answer: dto.valeur, answeredBy: ctx.userId, answeredAt: new Date() } });
      await this.emit(tx, ctx.tenantId, "review.reponse.modifiee", kyc.id,
        { kycCode, section: dto.section, question: dto.question, ancien, nouveau: dto.valeur, par: ctx.userId });
      return { question: dto.question, ancien, nouveau: dto.valeur };
    });
  }

  // ── R467 : le delta — PROJECTION (pré-rempli = socle REPRISE ; chaque modification tracée). ──
  async delta(ctx: Ctx, kycCode: string) {
    const kyc = await this.kycParCode(ctx, kycCode);
    const pre = (await this.prisma.domainEvent.findFirst({
      where: { tenantId: ctx.tenantId, type: "review.prerempli", aggregateId: kyc.id } }))?.payload as any;
    if (!pre) throw new BadRequestException(`R467 : ${kycCode} n'est pas une revue pré-remplie`);
    const mods = (await this.prisma.domainEvent.findMany({
      where: { tenantId: ctx.tenantId, type: "review.reponse.modifiee", aggregateId: kyc.id }, orderBy: { id: "asc" } }))
      .map((e: any) => e.payload);
    const parQuestion = new Map<string, any>();
    for (const m of mods) {
      const cle = m.section + "/" + m.question;
      const prev = parQuestion.get(cle);
      parQuestion.set(cle, { section: m.section, question: m.question,
        ancien: prev ? prev.ancien : m.ancien, nouveau: m.nouveau });          // premier ancien, dernier nouveau
    }
    const modifiees = [...parQuestion.values()];
    const reprises: any[] = [];
    for (const sec of (kyc as any).sections)
      for (const q of sec.questions)
        if (q.answer != null && !parQuestion.has(sec.code + "/" + q.code))
          reprises.push({ section: sec.code, question: q.code, valeur: q.answer, sourceKycId: pre.depuisKyc });
    return { modifiees, reprises };
  }

  // R13 : le préparateur de la revue (auteur d'au moins une modification) ne vise pas.
  private async garderExclusionR13(ctx: Ctx, kycId: string) {
    const mods = await this.prisma.domainEvent.findMany({
      where: { tenantId: ctx.tenantId, type: "review.reponse.modifiee", aggregateId: kycId } });
    if (mods.some((e: any) => (e.payload as any).par === ctx.userId))
      throw new ForbiddenException("R13 : exclusion 4-yeux — vous avez préparé cette revue, un second regard vise");
  }

  // ── R467 : le visa du delta RÉFÉRENCE la liste des changements revus. ──
  async viserDelta(ctx: Ctx, kycCode: string) {
    const kyc = await this.kycParCode(ctx, kycCode);
    await this.garderExclusionR13(ctx, kyc.id);
    const d = await this.delta(ctx, kycCode);
    await this.prisma.$transaction(async (tx: Tx) =>
      this.emit(tx, ctx.tenantId, "review.delta.vise", kyc.id,
        { kycCode, modifiees: d.modifiees.length, changements: d.modifiees, par: ctx.userId, role: ctx.role }));
    await this.audit.log(ctx.tenantId, ctx.userId, "REVIEW_DELTA_VISE", kycCode);
    return { changements: d.modifiees };
  }

  // ── R467 : « revu, inchangé » — visa EN BLOC des sections sans changement (comportement tenant). ──
  async viserEnBloc(ctx: Ctx, kycCode: string) {
    const p = await this.params(ctx);
    if (!p.visaEnBlocSectionsInchangees)
      throw new ConflictException("R467 : le visa en bloc des sections inchangées est désactivé (§Review)");
    const kyc = await this.kycParCode(ctx, kycCode);
    await this.garderExclusionR13(ctx, kyc.id);
    const d = await this.delta(ctx, kycCode);
    const touchees = new Set(d.modifiees.map((m: any) => m.section));
    const sections: string[] = [];
    await this.prisma.$transaction(async (tx: Tx) => {
      for (const sec of (kyc as any).sections) {
        if (touchees.has(sec.code)) continue;
        const visa = (kyc as any).visas.find((v: any) => v.sectionCode === sec.code && v.status === "PENDING");
        if (visa) await tx.kycVisa.update({ where: { id: visa.id },
          data: { status: "SIGNED", signedBy: ctx.userId, signedAt: new Date(),
            verdict: "OK", message: "revu, inchangé (R467)" } });
        await this.emit(tx, ctx.tenantId, "review.section.visee.bloc", kyc.id,
          { kycCode, section: sec.code, par: ctx.userId });
        sections.push(sec.code);
      }
    });
    return { sections };
  }

  // ── R468/R44 : verdict normalisé VISÉ ; conséquences PROPOSÉES par tâches, jamais exécutées. ──
  async poserVerdict(ctx: Ctx, kycCode: string, dto: { verdict?: string; motivation?: string }) {
    if (!VERDICTS.includes(dto?.verdict ?? ""))
      throw new BadRequestException("R468 : verdict ∈ {CONFORME, RESERVES, NON_CONFORME} — aligné registre art. 7 LBA");
    const kyc = await this.kycParCode(ctx, kycCode);
    const p = await this.params(ctx);
    const consequences: string[] = (p.verdictConsequences ?? {})[dto.verdict!] ?? [];
    await this.prisma.$transaction(async (tx: Tx) => {
      await this.emit(tx, ctx.tenantId, "review.verdict.pose", kyc.id,
        { kycCode, verdict: dto.verdict, motivation: dto.motivation ?? null, par: ctx.userId, role: ctx.role });
      if (consequences.includes("TACHES_REMEDIATION"))
        await this.emit(tx, ctx.tenantId, "tache.review.remediation", kyc.id,
          { kycCode, motif: dto.motivation ?? "réserves de revue", par: ctx.userId });
      if (consequences.some((c) => c.startsWith("PROPOSER_")))
        await this.emit(tx, ctx.tenantId, "tache.review.aiguillage", kyc.id,
          { kycCode, options: consequences.filter((c) => c.startsWith("PROPOSER_")).map((c) => c.replace("PROPOSER_", "")),
            verdict: dto.verdict, par: ctx.userId });
      // VOLONTAIREMENT : aucun aiguillage exécuté ici — l'humain accepte, ajuste ou rejette (R44).
    });
    await this.audit.log(ctx.tenantId, ctx.userId, "REVIEW_VERDICT", `${kycCode}:${dto.verdict}`);
    return { verdict: dto.verdict, consequencesProposees: consequences };
  }

  // ── R468/R44 : la DÉCISION d'aiguillage — un second événement, distinct du verdict. ──
  async accepterAiguillage(ctx: Ctx, kycCode: string, dto: { option?: string }) {
    if (!dto?.option) throw new BadRequestException("option requise (EDD | COC | OFFBOARDING)");
    const kyc = await this.kycParCode(ctx, kycCode);
    await this.prisma.$transaction(async (tx: Tx) =>
      this.emit(tx, ctx.tenantId, "review.aiguillage.decide", kyc.id,
        { kycCode, option: dto.option, par: ctx.userId, role: ctx.role }));
    await this.audit.log(ctx.tenantId, ctx.userId, "REVIEW_AIGUILLAGE", `${kycCode}:${dto.option}`);
    return { option: dto.option, decide: true };
  }

  // ── R468 : nextReviewDate = CALCUL (périodicité §Review × risque du client) — aucune saisie. ──
  async cloturerRevue(ctx: Ctx, kycCode: string) {
    const kyc = await this.kycParCode(ctx, kycCode);
    const client = await this.prisma.client.findFirst({ where: { id: kyc.clientId, tenantId: ctx.tenantId } });
    if (!client) throw new NotFoundException("Client introuvable");
    const p = await this.params(ctx);
    const mois = (p.periodiciteMois ?? {})[client.riskLevel] ?? 24;
    const le = new Date();
    const dueDate = plusMois(le, mois);
    return this.prisma.$transaction(async (tx: Tx) => {
      await tx.kycFile.update({ where: { id: kyc.id },
        data: { status: "VALIDATED", validatedBy: ctx.userId, validatedAt: le } });
      const courante = await tx.reviewDeadline.findFirst({
        where: { tenantId: ctx.tenantId, clientId: kyc.clientId, statut: "PLANIFIEE" } });
      if (courante) {
        await tx.reviewDeadline.update({ where: { id: courante.id },
          data: { statut: "REALISEE", realiseeKycId: kyc.id } });
        await this.emit(tx, ctx.tenantId, "REVIEW_DEADLINE_REALISEE", courante.id,
          { clientId: kyc.clientId, kycId: kyc.id, par: ctx.userId });
      }
      const d = await tx.reviewDeadline.create({ data: {
        tenantId: ctx.tenantId, clientId: kyc.clientId, sourceKycId: kyc.id,
        ddlLevel: kyc.workflow, cadenceMois: mois, dueDate } });
      await this.emit(tx, ctx.tenantId, "REVIEW_DEADLINE_SET", d.id,
        { clientId: kyc.clientId, ddlLevel: kyc.workflow, cadenceMois: mois, dueDate,
          sourceKycId: kyc.id, motif: `clôture de revue — périodicité ${client.riskLevel} (${mois} mois, R468)`,
          par: ctx.userId });
      return { nextReviewDate: dueDate.toISOString(), cadenceMois: mois };
    });
  }

  // ── R468 : le risque change → l'échéance se RECALCULE, la cause est tracée. ──
  async surChangementRisque(ctx: Ctx, clientId: string, dto: { risque?: string; motif?: string }) {
    if (!dto?.risque) throw new BadRequestException("risque requis (HIGH | MEDIUM | LOW | PEP)");
    const p = await this.params(ctx);
    const mois = (p.periodiciteMois ?? {})[dto.risque] ?? 24;
    return this.prisma.$transaction(async (tx: Tx) => {
      await tx.client.update({ where: { id: clientId }, data: { riskLevel: dto.risque! } });
      const courante = await tx.reviewDeadline.findFirst({
        where: { tenantId: ctx.tenantId, clientId, statut: "PLANIFIEE" } });
      if (!courante) throw new NotFoundException("Aucune échéance PLANIFIEE pour ce client");
      const dueDate = plusMois(new Date(), mois);
      await tx.reviewDeadline.update({ where: { id: courante.id }, data: { statut: "REMPLACEE" } });
      const n = await tx.reviewDeadline.create({ data: {
        tenantId: ctx.tenantId, clientId, sourceKycId: courante.sourceKycId,
        ddlLevel: courante.ddlLevel, cadenceMois: mois, dueDate } });
      await tx.reviewDeadline.update({ where: { id: courante.id }, data: { remplacePar: n.id } });
      await this.emit(tx, ctx.tenantId, "REVIEW_DEADLINE_SET", n.id,
        { clientId, ddlLevel: courante.ddlLevel, cadenceMois: mois, dueDate, remplace: courante.id,
          motif: `changement de niveau de risque → ${dto.risque}${dto.motif ? " — " + dto.motif : ""} (R468)`,
          par: ctx.userId });
      return { nextReviewDate: dueDate.toISOString(), cadenceMois: mois };
    });
  }

  // ── R469 : la composition d'un groupe est une PROJECTION du graphe (jamais une liste stockée). ──
  async composerGroupes(ctx: Ctx, aDate?: Date) {
    const p = await this.params(ctx, aDate);
    const criteres: string[] = (p.groupe ?? {}).criteres ?? ["UBO_COMMUN"];
    const groupes: any[] = [];
    for (const critere of criteres) {
      const typeCode = CRITERE_LIEN[critere];
      if (!typeCode) continue;
      const liens = await this.prisma.personneLien.findMany({
        where: { tenantId: ctx.tenantId, typeCode, cibleType: "COMPTE" } });
      const parPersonne = new Map<string, any[]>();
      for (const l of liens) {
        if (!parPersonne.has(l.personneId)) parPersonne.set(l.personneId, []);
        parPersonne.get(l.personneId)!.push(l);
      }
      for (const [personneId, ls] of parPersonne) {
        const membres = [...new Set(ls.map((l) => l.cibleId))];
        if (membres.length < 2) continue;
        groupes.push({ cle: `${critere}:${personneId}`, critere, membres,
          evaluations: ls.map((l) => ({ lienId: l.id, clientId: l.cibleId })) });   // chaque appartenance traçable
      }
    }
    return groupes;
  }

  // ── R470 : déclenchement groupe — un dossier PARENT (projection d'événements) + N membres liés. ──
  async declencherRevueGroupe(ctx: Ctx, dto: { cle?: string; origine?: any; exclure?: string[] }) {
    if (!dto?.cle) throw new BadRequestException("cle de groupe requise (projection R469)");
    const groupes = await this.composerGroupes(ctx);
    const g = groupes.find((x) => x.cle === dto.cle);
    if (!g) throw new NotFoundException(`Groupe ${dto.cle} introuvable dans la projection courante`);
    const garId = randomUUID();
    const origineTexte = dto.origine?.cascade
      ? `cascade depuis AR de ${dto.origine.depuis}` : "déclenchement groupe";
    const membres: { kycId: string; kycCode: string; clientId: string }[] = [];
    for (const clientId of g.membres) {
      if ((dto.exclure ?? []).includes(clientId)) continue;
      const source = await this.dernierKycValide(ctx, clientId);
      if (!source) continue;                                   // membre sans KYC approuvé : pas de revue possible
      const r = await this.creerRevision(ctx, clientId, source, "ACCOUNT_REVIEW", `GAR:${garId}`);
      membres.push({ kycId: r.kycId, kycCode: r.kycCode, clientId });
      await this.prisma.$transaction(async (tx: Tx) =>
        this.emit(tx, ctx.tenantId, "review.membre.ouvert", r.kycId,
          { garId, kycId: r.kycId, kycCode: r.kycCode, clientId, origine: origineTexte, par: ctx.userId }));
    }
    await this.prisma.$transaction(async (tx: Tx) =>
      this.emit(tx, ctx.tenantId, "gar.ouverte", garId, {
        garId, critere: g.critere, composition: g.membres, membres: membres.map((m) => m.kycCode),
        sections: SECTIONS_GAR, origine: dto.origine ?? null, par: ctx.userId,
        dateInitiation: new Date().toISOString() }));
    await this.audit.log(ctx.tenantId, ctx.userId, "GAR_OUVERTE", garId);
    return { garId, membres };
  }

  private async garOuverte(ctx: Ctx, garId: string) {
    const ev = await this.prisma.domainEvent.findFirst({
      where: { tenantId: ctx.tenantId, type: "gar.ouverte" },
      orderBy: { id: "asc" } }).then(async () => (await this.evsType(ctx.tenantId, "gar.ouverte"))
        .find((e: any) => (e.payload as any).garId === garId));
    if (!ev) throw new NotFoundException(`GAR ${garId} introuvable`);
    return ev.payload as any;
  }
  private async verdictDe(ctx: Ctx, kycCode: string): Promise<string | null> {
    const evs = (await this.evsType(ctx.tenantId, "review.verdict.pose"))
      .filter((e: any) => (e.payload as any).kycCode === kycCode);
    return evs.length ? (evs[evs.length - 1].payload as any).verdict : null;
  }

  // ── R470 : la vue consolidée est une PROJECTION des dossiers membres — jamais une re-saisie. ──
  async vueConsolidee(ctx: Ctx, garId: string) {
    const gar = await this.garOuverte(ctx, garId);
    const membres: any[] = [];
    for (const kycCode of gar.membres) {
      const kyc = await this.prisma.kycFile.findFirst({ where: { tenantId: ctx.tenantId, code: kycCode } });
      membres.push({ kycCode, clientId: kyc?.clientId ?? null,
        verdict: (await this.verdictDe(ctx, kycCode)) ?? "EN_COURS",
        score: kyc?.riskScore ?? 0,
        alertes: (await this.prisma.domainEvent.count({
          where: { tenantId: ctx.tenantId, type: "tache.review.aiguillage", aggregateId: kyc?.id ?? "-" } })) });
    }
    return { garId, membres };
  }

  // ── R470 : décision de groupe — guard « membres non clôturés » (sévérité tenant), R13 sur le
  //    préparateur du parent ; le visa RÉFÉRENCE les verdicts de tous les membres. ──
  async viserDecisionGroupe(ctx: Ctx, garId: string, dto: { motivation?: string }) {
    if (!dto?.motivation?.trim()) throw new BadRequestException("R7 : la décision de groupe se motive");
    const gar = await this.garOuverte(ctx, garId);
    if (gar.par === ctx.userId)
      throw new ForbiddenException("R13 : exclusion 4-yeux — le préparateur du dossier parent ne pose pas la décision de groupe");
    const p = await this.params(ctx);
    const verdicts: { kycCode: string; verdict: string | null }[] = [];
    for (const kycCode of gar.membres) verdicts.push({ kycCode, verdict: await this.verdictDe(ctx, kycCode) });
    const ouverts = verdicts.filter((v) => !v.verdict);
    if (ouverts.length) {
      const severite = (p.groupe ?? {}).guardMembresNonClotures ?? "BLOQUANT";
      const reason = `${ouverts.length} dossier membre non clôturé (${ouverts.map((o) => o.kycCode).join(", ")})`;
      // GUARD_BLOCKED émis HORS transaction puis refus (pattern Bloc 63) — le refus reste tracé.
      await this.prisma.$transaction(async (tx: Tx) =>
        this.emit(tx, ctx.tenantId, severite === "BLOQUANT" ? "GUARD_BLOCKED" : "GUARD_WARNING", garId,
          { guard: "membresNonClotures", reason, etape: "decision-groupe" }));
      if (severite === "BLOQUANT") throw new ConflictException(`R470 : ${reason}`);
    }
    await this.prisma.$transaction(async (tx: Tx) => {
      await this.emit(tx, ctx.tenantId, "gar.decision.visee", garId,
        { garId, par: ctx.userId, role: ctx.role, motivation: dto.motivation!.trim(),
          verdictsMembres: verdicts.map((v) => ({ kycCode: v.kycCode, verdict: v.verdict ?? "EN_COURS" })) });
      await this.emit(tx, ctx.tenantId, "gar.cloturee", garId, { garId, par: ctx.userId });
    });
    await this.audit.log(ctx.tenantId, ctx.userId, "GAR_DECISION", garId);
    return { vise: true, verdictsMembres: verdicts };
  }

  // ── R471 : cascade = ÉVÉNEMENT paramétré tenant, anti-boucle invariant. ──
  async declencherRevueMembre(ctx: Ctx, dto: { clientId?: string; motif?: string; origine?: any }) {
    if (!dto?.clientId) throw new BadRequestException("clientId requis");
    const source = await this.dernierKycValide(ctx, dto.clientId);
    if (!source) throw new BadRequestException("R467 : aucune revue sans dernier KYC APPROUVÉ");
    const r = await this.creerRevision(ctx, dto.clientId, source, "ACCOUNT_REVIEW", "AD_HOC");
    const p = await this.params(ctx);
    const g = (p.groupe ?? {});
    if (g.enabled && g.cascadeMemberToGroup && !dto.origine?.cascade) {
      const groupes = await this.composerGroupes(ctx);
      const mien = groupes.find((x) => x.membres.includes(dto.clientId));
      if (mien) {
        const autres = mien.membres.filter((m: string) => m !== dto.clientId);
        const garId = randomUUID();      // identifiant annoncé PAR l'événement de cascade, repris par le parent
        await this.prisma.$transaction(async (tx: Tx) =>
          this.emit(tx, ctx.tenantId, "REVIEW_CASCADE_TRIGGERED", r.kycId,
            { source: r.kycCode, parametre: "cascadeMemberToGroup", parent: garId,
              membres: autres, par: ctx.userId }));
        // Les dossiers nés de la cascade portent origine.cascade — ils ne RE-cascadent jamais.
        const gar = await this.declencherRevueGroupe(ctx,
          { cle: mien.cle, origine: { cascade: true, depuis: r.kycCode, garIdAnnonce: garId }, exclure: [dto.clientId] });
        return { ...r, cascade: { garId: gar.garId, membres: gar.membres.length } };
      }
    }
    return r;
  }

  // ── R472/R48/R29 : rejeu à date — composition et critère D'ÉPOQUE (figés dans gar.ouverte). ──
  async rejouerGar(ctx: Ctx, garId: string, asOf?: Date) {
    const borne = asOf ?? new Date();
    const evs = (await this.evsType(ctx.tenantId, "gar.ouverte"))
      .filter((e: any) => (e.payload as any).garId === garId && new Date(e.at) <= borne);
    if (!evs.length) throw new NotFoundException(`GAR ${garId} inconnue à cette date (R48)`);
    const gar: any = evs[0].payload;
    const decision = (await this.evsType(ctx.tenantId, "gar.decision.visee"))
      .filter((e: any) => (e.payload as any).garId === garId && new Date(e.at) <= borne);
    return { garId, critere: gar.critere, composition: gar.composition, membres: gar.membres,
      sections: gar.sections, decision: decision.length ? decision[decision.length - 1].payload : null,
      asOf: borne.toISOString() };
  }

  // ── R472 : UN gabarit de dossier, trois types — les panneaux additionnels viennent du §Review. ──
  async dossier(ctx: Ctx, ref: string) {
    const p = await this.params(ctx);
    const affichage = p.affichageParType ?? {};
    const gars = (await this.evsType(ctx.tenantId, "gar.ouverte")).filter((e: any) => (e.payload as any).garId === ref);
    if (gars.length) {
      const gar: any = gars[0].payload;
      const decision = (await this.evsType(ctx.tenantId, "gar.decision.visee"))
        .filter((e: any) => (e.payload as any).garId === ref);
      return {
        type: "GROUP_ACCOUNT_REVIEW",
        sections: gar.sections.map((code: string) => ({ code,
          visas: code === "decision-groupe"
            ? [{ role: "CO_SR", status: decision.length ? "SIGNED" : "PENDING" }] : [] })),
        timeline: (await this.prisma.domainEvent.findMany({
          where: { tenantId: ctx.tenantId, aggregateId: ref }, orderBy: { id: "asc" } }))
          .map((e: any) => ({ type: e.type, at: e.at })),
        vueConsolidee: await this.vueConsolidee(ctx, ref),
        affichage: affichage.GROUP_ACCOUNT_REVIEW ?? { panneaux: ["vue-consolidee"] },
      };
    }
    const kyc = await this.kycParCode(ctx, ref);
    const estRevue = !!(await this.prisma.domainEvent.findFirst({
      where: { tenantId: ctx.tenantId, type: "review.lancee", aggregateId: kyc.id } }));
    const type = estRevue ? "ACCOUNT_REVIEW" : "KYC";
    return {
      type,
      sections: (kyc as any).sections.map((s: any) => ({ code: s.code,
        visas: (kyc as any).visas.filter((v: any) => v.sectionCode === s.code)
          .map((v: any) => ({ role: v.requiredRole, status: v.status })) })),
      timeline: (await this.prisma.domainEvent.findMany({
        where: { tenantId: ctx.tenantId, aggregateId: kyc.id }, orderBy: { id: "asc" } }))
        .map((e: any) => ({ type: e.type, at: e.at })),
      affichage: affichage[type] ?? { panneaux: [] },
    };
  }

  // ── R473 : §Review unifié — registre gouverné, pop-up R445, PARAM_CHANGED versionné, R29. ──
  async parametresReview(ctx: Ctx) {
    return { aggregate: AGG_PARAMS, parametres: await this.params(ctx), defauts: DEFAUTS_REVIEW.review };
  }
  async modifierParametreReview(ctx: Ctx, dto: { cle?: string; valeur?: any; enVigueurLe?: string;
    confirmation?: { engagementTexte?: string } }) {
    if (!dto?.cle || dto?.valeur === undefined || !dto?.enVigueurLe)
      throw new BadRequestException("cle, valeur et enVigueurLe requis");
    const r = await modifierParametreGouverne(this.prisma, ctx, {
      aggregate: AGG_PARAMS, cle: dto.cle, valeur: dto.valeur, enVigueurLe: dto.enVigueurLe,
      confirmation: dto.confirmation?.engagementTexte
        ? { engagementTexte: dto.confirmation.engagementTexte, auteur: ctx.userId } : undefined,
      base: DEFAUTS_REVIEW,
      portee: "revues futures — grandfathering R29 sur les revues et GAR en cours",
      extraPopup: () => ({ rappelReglementaire:
        "Rappel : assouplir la périodicité ou les cascades de revue n'éteint aucune obligation de surveillance (R473)." }),
      apresEmission: async () => { await this.audit.log(ctx.tenantId, ctx.userId, "REVIEW_PARAM", dto.cle!); },
    });
    return r;
  }
}
