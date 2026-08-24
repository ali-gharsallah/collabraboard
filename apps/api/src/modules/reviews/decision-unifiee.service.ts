import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { emitEvent } from "../../common/domain-event";
import { Tx } from "../../common/tx";
import { resoudreParametresGouvernes, modifierParametreGouverne, fusionProfonde } from "../../common/param-engagement";

/**
 * Bloc 65 Volet B (repo R474–R479) — LA décision d'étape : un objet uniforme, trois issues
 * + une action de disponibilité, partout pareil (KYC · AR · GAR — et les workflows du moteur
 * standard : Business Trip, Offboarding — AUCUN fork, R474).
 *
 * - Valider = visa R15 délégué au moteur du type (kyc.signVisa avec SES gardes R13/R2/R86,
 *   viserDecisionGroupe, moteur.viser, bt.viser) — ce service n'apporte AUCUNE règle de visa
 *   nouvelle et n'en duplique aucune : il route, le moteur reste seul juge (R477).
 * - Renvoyer = rebroussement CIBLÉ tracé (R475) : STEP_SENT_BACK + chutes de visas par
 *   ÉVÉNEMENTS (l'historique montre le premier passage ET le renvoi — jamais d'effacement),
 *   tâches de reprise nominatives, compteur de boucles projeté, signal AVERTISSEMENT au seuil
 *   (jamais de blocage, R39).
 * - Refuser = motif structuré OBLIGATOIRE (code + texte), issue paramétrée par étape (R476) :
 *   TERMINAL (REJECTED, R16) | RENVOI (mêmes effets que R475) | CLOTURE_MOTIVEE.
 * - Corbeille « À décider » (R478) : projection multi-types des décisions en attente de
 *   l'utilisateur, triée SLA, deep-link vers l'étape à décider.
 * - Après la décision (R479) : SUIVANT (bandeau réversible + prochain dossier) | RESTER —
 *   l'annulation est possible tant qu'aucun tiers n'a consommé la transition, et TRACÉE.
 */

type Ctx = { tenantId: string; userId: string; role: string };
type Motif = { code?: string; texte?: string };

const AGG_PARAMS = "decision-params";
export const DEFAUTS_DECISION = {
  decision: {
    libelles: { valider: "✓ Valider", refuser: "✕ Refuser",                  // R474 — libellés tenant,
      renvoyer: "↩ Renvoyer", deleguer: "⇄ Déléguer" },                      //   le comportement JAMAIS
    motifsRefus: ["DOCS_INSUFFISANTS", "RISQUE_INACCEPTABLE", "INFOS_CONTRADICTOIRES", "AUTRE"], // R476
    issueRefusParEtape: {} as Record<string, { issue: string; cible?: string }>, // R476 — défaut structurel :
    renvoi: { seuilBoucles: 3 },                                             //   dernière étape=TERMINAL, sinon RENVOI
    apresDecision: "SUIVANT",                                                // R479
    corbeille: { tri: "SLA" },                                               // R478
  },
};
const ORDRE_ISSUES = ["VALIDER", "REFUSER", "RENVOYER", "DELEGUER"] as const;
const RACCOURCIS: Record<string, string> = { VALIDER: "V", REFUSER: "R", RENVOYER: "B", DELEGUER: "D" };
const CLE_LIBELLE: Record<string, string> = { VALIDER: "valider", REFUSER: "refuser", RENVOYER: "renvoyer", DELEGUER: "deleguer" };
const STATUTS_OUVERTS = ["IN_PROGRESS", "UNDER_REVIEW", "EN_MAJ"];

@Injectable()
export class DecisionUnifieeService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  // Branchements tardifs (pas de cycle de modules) — chaque moteur garde SES règles.
  private kycSvc?: { signVisa(ctx: Ctx, code: string, sectionCode: string, verdict?: string, message?: string): Promise<any> };
  private revuesSvc?: { viserDecisionGroupe(ctx: Ctx, garId: string, dto: any): Promise<any>; vueConsolidee(ctx: Ctx, garId: string): Promise<any> };
  private moteurSvc?: { viser(ctx: Ctx, instanceId: string): Promise<any>; etat(ctx: Ctx, instanceId: string): Promise<any> };
  private btSvc?: { viser(ctx: Ctx, tripId: string, role: string, motivation?: string): Promise<any> };
  brancherKyc(svc: any) { this.kycSvc = svc; }
  brancherRevues(svc: any) { this.revuesSvc = svc; }
  brancherMoteur(svc: any) { this.moteurSvc = svc; }
  brancherBusinessTrip(svc: any) { this.btSvc = svc; }

  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return emitEvent(tx, tenantId, type, aggregateId, payload);
  }
  private async params(ctx: Ctx, aDate?: Date) {
    const tenant = await this.prisma.tenant.findFirst({ where: { id: ctx.tenantId } });
    const base = fusionProfonde(DEFAUTS_DECISION, { decision: (tenant?.settings as any)?.decision ?? {} });
    const p = await resoudreParametresGouvernes(this.prisma, ctx.tenantId, AGG_PARAMS, base, aDate ?? new Date());
    return (p as any).decision;
  }
  private async kycParCode(ctx: Ctx, code: string) {
    const kyc = await this.prisma.kycFile.findFirst({ where: { tenantId: ctx.tenantId, code },
      include: { sections: { include: { questions: true } }, visas: true } });
    if (!kyc) throw new NotFoundException(`Dossier ${code} introuvable`);
    return kyc;
  }
  /** Les étapes à visa d'un dossier = ses sections ORDONNÉES ; l'étape courante = premier visa PENDING. */
  private etapes(kyc: any): { code: string; visa: any }[] {
    const secs = [...kyc.sections].sort((a: any, b: any) => a.orderIndex - b.orderIndex);
    return secs.map((s: any) => ({ code: s.code, visa: kyc.visas.find((v: any) => v.sectionCode === s.code) }));
  }
  private etapeCourante(kyc: any): string {
    const e = this.etapes(kyc);
    return (e.find((x) => x.visa?.status === "PENDING") ?? e[e.length - 1])?.code ?? "-";
  }
  private async boucles(ctx: Ctx, aggregateId: string) {
    return this.prisma.domainEvent.count({
      where: { tenantId: ctx.tenantId, type: "STEP_SENT_BACK", aggregateId } });
  }
  private motifValide(p: any, motif?: Motif) {
    if (!motif?.code || !motif?.texte?.trim())
      throw new BadRequestException({ code: "DECISION_MOTIF_REQUIS",
        attendu: { code: `référentiel motifsRefus : ${(p.motifsRefus ?? []).join(", ")}`, texte: "obligatoire (texte libre)" } });
    return { code: motif.code, texte: motif.texte.trim() };
  }
  private issues(p: any, type: string) {
    const lib = (p.libelles?.[type] ?? p.libelles) as any;                    // libellés par type OU communs
    return ORDRE_ISSUES.map((action) => ({ action,
      libelle: lib?.[CLE_LIBELLE[action]] ?? action, raccourci: RACCOURCIS[action] }));
  }

  // ── R474/R477 : LA barre — mêmes issues, même ordre, guards ANNONCÉS (le moteur reste juge). ──
  async barre(ctx: Ctx, type: string, ref: string) {
    const p = await this.params(ctx);
    let etape = "-"; let aggregateId = ref; const guards: { guard: string; detail: string }[] = [];
    if (type === "KYC" || type === "ACCOUNT_REVIEW") {
      const kyc = await this.kycParCode(ctx, ref);
      aggregateId = kyc.id;
      etape = this.etapeCourante(kyc);
      const sec = kyc.sections.find((s: any) => s.code === etape);
      const manquantes = (sec?.questions ?? []).filter((q: any) => q.answer == null).length;
      if (manquantes) guards.push({ guard: "SECTION_INCOMPLETE", detail: `${manquantes} réponse(s) manquante(s) — ${etape}` });
    } else if (type === "GROUP_ACCOUNT_REVIEW") {
      etape = "decision-groupe";
      if (this.revuesSvc) {
        const vc = await this.revuesSvc.vueConsolidee(ctx, ref);
        const ouverts = (vc.membres ?? []).filter((m: any) => m.verdict === "EN_COURS");
        if (ouverts.length) guards.push({ guard: "MEMBRES_NON_CLOTURES",
          detail: `${ouverts.length} dossier(s) membre(s) non clôturé(s) (${ouverts.map((m: any) => m.kycCode).join(", ")})` });
      }
    } else if (type === "OFFBOARDING" && this.moteurSvc) {
      etape = (await this.moteurSvc.etat(ctx, ref)).etat;
    } else if (type === "BUSINESS_TRIP") {
      const visa = await this.prisma.tripVisa.findFirst({
        where: { tenantId: ctx.tenantId, tripId: ref, status: "PENDING" } });
      etape = visa ? `visa ${visa.role}` : "-";
    }
    return { type, ref, etapeCourante: etape, boucles: await this.boucles(ctx, aggregateId),
      issues: this.issues(p, type), guards };
  }

  // ── R474 : décider — UN geste, routé vers le moteur du type. ──
  async decider(ctx: Ctx, type: string, ref: string, dto: { action: string; etape?: string;
    motif?: Motif; cible?: string; sections?: string[]; delegueA?: string; motivation?: string }) {
    const p = await this.params(ctx);
    switch (dto.action) {
      case "VALIDER": return this.valider(ctx, p, type, ref, dto);
      case "REFUSER": return this.refuser(ctx, p, type, ref, dto);
      case "RENVOYER": return this.renvoyer(ctx, p, type, ref, dto);
      case "DELEGUER": return this.deleguer(ctx, type, ref, dto);
      default: throw new BadRequestException({ code: "DECISION_ACTION_INCONNUE",
        attendues: [...ORDRE_ISSUES] });
    }
  }

  /** Valider = visa R15 par le moteur du type — gardes R13/R2/R86/guards intactes, jamais dupliquées. */
  private async valider(ctx: Ctx, p: any, type: string, ref: string,
    dto: { etape?: string; motif?: Motif; motivation?: string }) {
    let etape = dto.etape ?? "-";
    if (type === "KYC" || type === "ACCOUNT_REVIEW") {
      if (!this.kycSvc) throw new ConflictException("Moteur KYC non branché");
      if (!dto.etape) throw new BadRequestException({ code: "DECISION_ETAPE_REQUISE" });
      await this.kycSvc.signVisa(ctx, ref, dto.etape);                        // R13/R2/R86 — le refus remonte EN CLAIR (R477)
    } else if (type === "GROUP_ACCOUNT_REVIEW") {
      if (!this.revuesSvc) throw new ConflictException("Moteur revues non branché");
      etape = "decision-groupe";
      await this.revuesSvc.viserDecisionGroupe(ctx, ref, { motivation: dto.motivation ?? dto.motif?.texte });
    } else if (type === "OFFBOARDING") {
      if (!this.moteurSvc) throw new ConflictException("Moteur standard non branché");
      await this.moteurSvc.viser(ctx, ref);                                   // R441/R13/guards du moteur
    } else if (type === "BUSINESS_TRIP") {
      if (!this.btSvc) throw new ConflictException("Moteur Business Trip non branché");
      await this.btSvc.viser(ctx, ref, ctx.role, dto.motivation);             // R446/R447/R13 du moteur BT
    } else throw new BadRequestException({ code: "DECISION_TYPE_INCONNU", type });
    await this.audit.log(ctx.tenantId, ctx.userId, "DECISION_VALIDEE", `${type}:${ref}:${etape}`);
    return { action: "VALIDER", type, ref, etape,
      apres: await this.apres(ctx, p, ref, `Visa apposé sur ${ref} — Annuler`) };
  }

  /** R476 : refus motivé, issue paramétrée par étape (défaut structurel : finale=TERMINAL, sinon RENVOI). */
  private async refuser(ctx: Ctx, p: any, type: string, ref: string,
    dto: { etape?: string; motif?: Motif; sections?: string[] }) {
    const motif = this.motifValide(p, dto.motif);
    if (type !== "KYC" && type !== "ACCOUNT_REVIEW")
      throw new BadRequestException({ code: "DECISION_TYPE_INCONNU", type,
        note: "le refus d'étape porte sur un dossier à sections (KYC/AR) — GAR : renvoyer vers un membre (R475)" });
    const kyc = await this.kycParCode(ctx, ref);
    const etape = dto.etape ?? this.etapeCourante(kyc);
    const chemin = this.etapes(kyc);
    const idx = chemin.findIndex((e) => e.code === etape);
    if (idx < 0) throw new BadRequestException({ code: "DECISION_ETAPE_INCONNUE", etape });
    const cfg = (p.issueRefusParEtape ?? {})[etape];
    const issue = cfg?.issue ?? (idx === chemin.length - 1 ? "TERMINAL" : "RENVOI");
    const cible = cfg?.cible ?? chemin[Math.max(0, idx - 1)].code;
    await this.prisma.$transaction(async (tx: Tx) => {
      await this.emit(tx, ctx.tenantId, "decision.refusee", kyc.id,
        { etape, motif, issue, par: ctx.userId });
      if (issue === "TERMINAL") {
        await tx.kycFile.update({ where: { id: kyc.id }, data: { status: "REJECTED" } });        // R16
      } else if (issue === "CLOTURE_MOTIVEE") {
        await tx.kycFile.update({ where: { id: kyc.id }, data: { status: "ABANDONED" } });       // fin propre, motif tracé
      }
      await this.audit.log(ctx.tenantId, ctx.userId, "DECISION_REFUSEE", `${ref}:${etape}:${issue}`);
    });
    if (issue === "RENVOI")                                                    // mêmes effets que R475
      await this.executerRenvoi(ctx, p, await this.kycParCode(ctx, ref), cible, motif, dto.sections ?? [], "REFUS_RENVOI");
    return { action: "REFUSER", type, ref, etape, issue, ...(issue === "RENVOI" ? { cible } : {}) };
  }

  /** R475 : renvoi = rebroussement CIBLÉ vers une étape ANTÉRIEURE, motivé. */
  private async renvoyer(ctx: Ctx, p: any, type: string, ref: string,
    dto: { cible?: string; motif?: Motif; sections?: string[] }) {
    const motif = this.motifValide(p, dto.motif);
    if (type === "GROUP_ACCOUNT_REVIEW") {                                     // le renvoi GAR cible un MEMBRE
      if (!dto.cible) throw new BadRequestException({ code: "DECISION_CIBLE_INVALIDE", attendu: "kycCode d'un dossier membre" });
      const boucle = (await this.boucles(ctx, ref)) + 1;
      await this.prisma.$transaction(async (tx: Tx) => {
        await this.emit(tx, ctx.tenantId, "STEP_SENT_BACK", ref, { cible: dto.cible!, motif,
          sections: dto.sections ?? [], par: ctx.userId, boucle, cause: "RENVOI" });              // motif routé vers le membre
        await this.audit.log(ctx.tenantId, ctx.userId, "DECISION_RENVOI", `GAR:${ref}→${dto.cible}`);
      });
      return { action: "RENVOYER", type, ref, cible: dto.cible, boucles: boucle };
    }
    if (type !== "KYC" && type !== "ACCOUNT_REVIEW")
      throw new BadRequestException({ code: "DECISION_TYPE_INCONNU", type });
    const kyc = await this.kycParCode(ctx, ref);
    const chemin = this.etapes(kyc);
    const courante = this.etapeCourante(kyc);
    const idxCible = chemin.findIndex((e) => e.code === dto.cible);
    const idxCourante = chemin.findIndex((e) => e.code === courante);
    if (idxCible < 0 || idxCible >= idxCourante)
      throw new BadRequestException({ code: "DECISION_CIBLE_INVALIDE",
        attendu: `une étape ANTÉRIEURE à ${courante} (${chemin.slice(0, Math.max(0, idxCourante)).map((e) => e.code).join(", ") || "aucune"})` });
    const r = await this.executerRenvoi(ctx, p, kyc, dto.cible!, motif, dto.sections ?? [], "RENVOI");
    return { action: "RENVOYER", type, ref, cible: dto.cible, ...r };
  }

  /** Le rebroussement (R475) : STEP_SENT_BACK + chutes TRACÉES + tâches de reprise + signal au seuil. */
  private async executerRenvoi(ctx: Ctx, p: any, kyc: any, cible: string,
    motif: { code: string; texte: string }, sections: string[], cause: string) {
    const chemin = this.etapes(kyc);
    const idxCible = chemin.findIndex((e) => e.code === cible);
    const idxCourante = chemin.findIndex((e) => e.code === this.etapeCourante(kyc));
    const retraversees = chemin.slice(idxCible, Math.max(idxCible, idxCourante))
      .filter((e) => e.visa?.status === "SIGNED");
    const boucle = (await this.boucles(ctx, kyc.id)) + 1;
    const seuil = p.renvoi?.seuilBoucles ?? 3;
    const tenant = await this.prisma.tenant.findFirst({ where: { id: ctx.tenantId } });
    const manager = ((tenant?.settings as any)?.workloadResponsables ?? [])[0]?.responsableRole ?? "MGR";
    const visasTombes: string[] = [];
    await this.prisma.$transaction(async (tx: Tx) => {
      await this.emit(tx, ctx.tenantId, "STEP_SENT_BACK", kyc.id,
        { cible, motif, sections, par: ctx.userId, boucle, cause });
      for (const e of retraversees) {                                          // chute par ÉVÉNEMENT — jamais d'effacement :
        await this.emit(tx, ctx.tenantId, "decision.visa.tombe", kyc.id,       // le premier passage reste lisible (R49)
          { section: e.code, role: String(e.visa.requiredRole), viseurOriginal: e.visa.signedBy, cause });
        await tx.kycVisa.update({ where: { id: e.visa.id },
          data: { status: "PENDING", signedBy: null, signedAt: null, verdict: null, message: null,
            version: { increment: 1 } } });
        visasTombes.push(e.code);
      }
      for (const section of sections) {                                        // reprise NOMINATIVE, motif en tête
        const sec = kyc.sections.find((s: any) => s.code === section);
        const owner = [...(sec?.questions ?? [])].reverse().find((q: any) => q.answeredBy)?.answeredBy
          ?? kyc.createdBy;
        await tx.task.create({ data: { tenantId: ctx.tenantId, assigneeId: owner, type: "REPRISE_REVUE",
          statut: "OUVERTE", createdAt: new Date().toISOString(), clientId: kyc.clientId } });
        await this.emit(tx, ctx.tenantId, "tache.reprise.creee", kyc.id,
          { kycCode: kyc.code, section, owner, motif });
      }
      if (boucle >= seuil)                                                     // signal — JAMAIS de blocage (R39)
        await this.emit(tx, ctx.tenantId, "decision.boucles.signal", kyc.id,
          { ref: kyc.code, boucles: boucle, seuil, severite: "AVERTISSEMENT", manager });
      await this.audit.log(ctx.tenantId, ctx.userId, "DECISION_RENVOI", `${kyc.code}→${cible} (boucle ${boucle})`);
    });
    return { boucles: boucle, visasTombes };
  }

  /** R4 : déléguer = passer la main au remplaçant désigné, TRACÉ. */
  private async deleguer(ctx: Ctx, type: string, ref: string, dto: { etape?: string; delegueA?: string }) {
    if (!dto.delegueA) throw new BadRequestException({ code: "DECISION_DELEGUE_REQUIS" });
    let aggregateId = ref; let de: string | null = ctx.userId;
    if (type === "KYC" || type === "ACCOUNT_REVIEW") {
      if (!dto.etape) throw new BadRequestException({ code: "DECISION_ETAPE_REQUISE" });
      const kyc = await this.kycParCode(ctx, ref);
      const visa = kyc.visas.find((v: any) => v.sectionCode === dto.etape && v.status === "PENDING");
      if (!visa) throw new NotFoundException(`Aucun visa en attente sur ${dto.etape}`);
      de = visa.validateur ?? ctx.userId;
      aggregateId = kyc.id;
      await this.prisma.$transaction(async (tx: Tx) => {
        await tx.kycVisa.update({ where: { id: visa.id }, data: { validateur: dto.delegueA } });  // validateur nommé R2
        await this.emit(tx, ctx.tenantId, "decision.deleguee", kyc.id,
          { etape: dto.etape!, de, a: dto.delegueA!, par: ctx.userId });
      });
    } else {
      await this.prisma.$transaction(async (tx: Tx) =>                         // la main passée est un FAIT tracé ;
        this.emit(tx, ctx.tenantId, "decision.deleguee", aggregateId,          // le rôle requis reste le juge au visa
          { etape: dto.etape ?? "-", de, a: dto.delegueA!, par: ctx.userId }));
    }
    await this.audit.log(ctx.tenantId, ctx.userId, "DECISION_DELEGUEE", `${type}:${ref}→${dto.delegueA}`);
    return { action: "DELEGUER", type, ref, a: dto.delegueA };
  }

  // ── R479 : annulation — possible tant qu'AUCUN TIERS n'a consommé la transition, tracée. ──
  async annuler(ctx: Ctx, type: string, ref: string, dto: { etape?: string }) {
    if (type !== "KYC" && type !== "ACCOUNT_REVIEW")
      throw new BadRequestException({ code: "DECISION_TYPE_INCONNU", type });
    if (!dto.etape) throw new BadRequestException({ code: "DECISION_ETAPE_REQUISE" });
    const kyc = await this.kycParCode(ctx, ref);
    const visa = kyc.visas.find((v: any) => v.sectionCode === dto.etape);
    if (!visa || visa.status !== "SIGNED" || visa.signedBy !== ctx.userId)
      throw new ConflictException({ code: "DECISION_NON_ANNULABLE",
        detail: "seule SA décision, encore signée, s'annule" });
    const consommePar = kyc.visas.find((v: any) => v.status === "SIGNED" && v.signedBy !== ctx.userId
      && v.signedAt && visa.signedAt && new Date(v.signedAt) > new Date(visa.signedAt));
    if (consommePar || !STATUTS_OUVERTS.includes(kyc.status))
      throw new ConflictException({ code: "DECISION_TRANSITION_CONSOMMEE",
        detail: consommePar ? `visa ${consommePar.sectionCode} apposé après le vôtre` : `dossier ${kyc.status}` });
    await this.prisma.$transaction(async (tx: Tx) => {
      await this.emit(tx, ctx.tenantId, "decision.annulee", kyc.id, { etape: dto.etape!, par: ctx.userId });
      await tx.kycVisa.update({ where: { id: visa.id },
        data: { status: "PENDING", signedBy: null, signedAt: null, verdict: null, message: null,
          version: { increment: 1 } } });
      await this.audit.log(ctx.tenantId, ctx.userId, "DECISION_ANNULEE", `${ref}:${dto.etape}`);
    });
    return { annule: true, type, ref, etape: dto.etape };
  }

  // ── R478 : la corbeille « À décider » — projection multi-types, triée, deep-link prêt. ──
  async corbeille(ctx: Ctx) {
    const p = await this.params(ctx);
    const tri = p.corbeille?.tri ?? "SLA";
    const items: any[] = [];
    // KYC / AR : visas PENDING adressés au rôle de l'utilisateur, dossiers ouverts.
    const visas = await this.prisma.kycVisa.findMany({
      where: { status: "PENDING", requiredRole: ctx.role as any,
        OR: [{ validateur: null }, { validateur: ctx.userId }],                // R2 : un visa nommé n'attend que SON validateur
        kycFile: { tenantId: ctx.tenantId, status: { in: STATUTS_OUVERTS as any } } },
      include: { kycFile: { include: { sections: true } } } });
    const parDossier = new Map<string, any>();
    for (const v of visas) if (!parDossier.has(v.kycFileId)) parDossier.set(v.kycFileId, v.kycFile);
    for (const kyc of parDossier.values()) {
      const secs = [...kyc.sections].sort((a: any, b: any) => a.orderIndex - b.orderIndex);
      const pendantes = new Set(visas.filter((v) => v.kycFileId === kyc.id).map((v) => v.sectionCode));
      const etape = secs.find((s: any) => pendantes.has(s.code))?.code ?? "-";
      const dl = await this.prisma.reviewDeadline.findFirst({
        where: { tenantId: ctx.tenantId, clientId: kyc.clientId }, orderBy: { dueDate: "asc" } });
      items.push(this.item(kyc.revision > 1 ? "ACCOUNT_REVIEW" : "KYC", kyc.code, etape,
        dl?.dueDate ?? null));
    }
    // GAR : gar.ouverte sans décision ni clôture — la décision de groupe attend un second regard.
    if (["CO", "CO_SR", "MLRO", "DIR", "ADMIN"].includes(ctx.role)) {
      const ouvertes = await this.prisma.domainEvent.findMany({
        where: { tenantId: ctx.tenantId, type: "gar.ouverte" }, orderBy: { id: "asc" } });
      const closes = new Set([
        ...(await this.prisma.domainEvent.findMany({ where: { tenantId: ctx.tenantId, type: "gar.decision.visee" } })),
        ...(await this.prisma.domainEvent.findMany({ where: { tenantId: ctx.tenantId, type: "gar.cloturee" } })),
      ].map((e: any) => (e.payload as any).garId));
      for (const e of ouvertes) {
        const garId = (e.payload as any).garId;
        if (!closes.has(garId)) items.push(this.item("GROUP_ACCOUNT_REVIEW", garId, "decision-groupe", null));
      }
    }
    // Business Trip : visas PENDING du rôle, voyages en attente d'approbation.
    const tv = await this.prisma.tripVisa.findMany({
      where: { tenantId: ctx.tenantId, role: ctx.role, status: "PENDING" } });
    for (const v of tv) {
      const trip = await this.prisma.trip.findFirst({
        where: { id: v.tripId, tenantId: ctx.tenantId, status: "PENDING_APPROVAL" } });
      if (trip) items.push(this.item("BUSINESS_TRIP", trip.id, `visa ${v.role}`, trip.dateStart));
    }
    // Offboarding (moteur standard) : le prochain maillon de la chaîne attend ce rôle.
    if (this.moteurSvc) {
      const started = await this.prisma.domainEvent.findMany({
        where: { tenantId: ctx.tenantId, type: "WORKFLOW_STARTED" }, orderBy: { id: "asc" } });
      for (const s of started) {
        try {
          const e = await this.moteurSvc.etat(ctx, s.aggregateId);
          if (e.etat === "Clôturé") continue;
          const prochain = (e.chaine ?? [])[Math.min(e.visas?.length ?? 0, (e.chaine ?? []).length - 1)];
          if (prochain === ctx.role) items.push(this.item("OFFBOARDING", s.aggregateId, e.etat, null));
        } catch { /* instance d'un autre contexte : hors corbeille */ }
      }
    }
    // Tâches de reprise nées d'un renvoi (R475) — pour leurs OWNERS.
    const reprises = await this.prisma.task.findMany({
      where: { tenantId: ctx.tenantId, assigneeId: ctx.userId, type: "REPRISE_REVUE", statut: "OUVERTE" } });
    for (const t of reprises) items.push(this.item("TACHE_REPRISE", t.id, "reprise", t.dueAt ?? null));

    items.sort(tri === "TYPE" ? (a, b) => a.type.localeCompare(b.type)
      : (a, b) => (a.slaAt === null ? 1 : b.slaAt === null ? -1
        : new Date(a.slaAt).getTime() - new Date(b.slaAt).getTime()));         // SLA (défaut) et DATE : échu d'abord
    return { tri, items };
  }
  private item(type: string, ref: string, etape: string, slaAt: any) {
    const iso = slaAt ? new Date(slaAt).toISOString() : null;
    const badge = !iso ? null : new Date(iso) < new Date() ? "ROUGE"
      : new Date(iso).getTime() - Date.now() < 7 * 86_400_000 ? "AMBRE" : "VERT";
    return { type, ref, etape, slaAt: iso, badge, ouvrir: { ecran: "dossier", type, ref, etape } };
  }

  /** R479 : après la décision — bandeau réversible + (mode SUIVANT) le prochain dossier de la corbeille. */
  private async apres(ctx: Ctx, p: any, refCourant: string, bandeau: string) {
    const brut = p.apresDecision ?? "SUIVANT";
    const mode = typeof brut === "object" ? (brut[ctx.userId] ?? "SUIVANT") : brut;   // « par utilisateur »
    if (mode !== "SUIVANT") return { mode: "RESTER", bandeau, annulable: true, suivant: null };
    const c = await this.corbeille(ctx);
    return { mode: "SUIVANT", bandeau, annulable: true,
      suivant: c.items.find((i: any) => i.ref !== refCourant) ?? null };
  }

  // ── Registre §Decision — gouverné par date, pop-up R445 (mécanisme commun). ──
  async parametresDecision(ctx: Ctx) {
    return { aggregate: AGG_PARAMS, parametres: await this.params(ctx), defauts: DEFAUTS_DECISION.decision };
  }
  async modifierParametreDecision(ctx: Ctx, dto: { cle: string; valeur: any; enVigueurLe: string;
    confirmation?: { engagementTexte: string } }) {
    const tenant = await this.prisma.tenant.findFirst({ where: { id: ctx.tenantId } });
    const base = fusionProfonde(DEFAUTS_DECISION, { decision: (tenant?.settings as any)?.decision ?? {} });
    return modifierParametreGouverne(this.prisma, ctx, {
      aggregate: AGG_PARAMS, cle: dto.cle, valeur: dto.valeur, enVigueurLe: dto.enVigueurLe,
      confirmation: dto.confirmation ? { engagementTexte: dto.confirmation.engagementTexte, auteur: ctx.userId } : undefined,
      base,
      extraPopup: () => ({ rappel:
        "Rappel : les libellés se paramètrent, le comportement de la décision JAMAIS (R474)." }),
      apresEmission: async () => { await this.audit.log(ctx.tenantId, ctx.userId, "DECISION_PARAM_CHANGED", dto.cle); },
    });
  }
}
