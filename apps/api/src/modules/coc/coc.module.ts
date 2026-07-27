import { Body, Controller, Get, Module, Param, Post, Query, Req, Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { CpsiModule, CpsiService } from "../cpsi/cpsi.module";
import { ReviewsModule, ReviewsService } from "../reviews/reviews.module";
import * as CONFIG_LIVREE from "./coc-config.default.json";
import { Tx } from "../../common/tx";

/**
 * Cycle de vie du CoC — R276→R278 (CC-01..08), canon débloquants Home partie 2 (R276 ÉTENDU
 * ratifié : ce bloc CRÉE le store COC_CONFIG — registre VERSIONNÉ à date, append-only, table
 * livrée éditable). Le CoC devient un DOSSIER : OUVERT → EN_TRAITEMENT → { TRAITE | NON_RETENU }.
 * R276 : matérialité/action/rôle/sévérité COPIÉS depuis la config EN VIGUEUR à l'ouverture et
 * FIGÉS (grandfathering R29 — le CoC d'hier se juge aux règles d'hier) ; le signal CPSI
 * `coc_sensible` est émis à l'ouverture, RATTACHÉ au dossier (jamais silencieux s'il échoue).
 * R277 : la transition TRAITE est REFUSÉE tant que l'action figée n'est pas accomplie et
 * référencée — le refus LISTE ce qui manque (pattern R269) ; rôle du type ; four-eyes HAUTE.
 * R278 : la chaîne complète se rejoue à date ; le reporting mesure (SLA R39, jamais bloquant).
 * Paramètres R-Q : cocFourEyes {HAUTE:true} · cocSlaJours {HAUTE:10, MOYENNE:30, BASSE:90} ·
 * cocReviewAnticipationJours (30 — RV-04/CC-04).
 */

type Ctx = { tenantId: string; userId: string; role: string };
const MATERIALITES = ["HAUTE", "MOYENNE", "BASSE"];
const ACTIONS = ["REVISION_KYC", "MAJ_CIBLEE", "PRISE_CONNAISSANCE"];
const TRANSITIONS: Record<string, string[]> = {
  OUVERT: ["EN_TRAITEMENT", "TRAITE", "NON_RETENU"],
  EN_TRAITEMENT: ["TRAITE", "NON_RETENU"],
  TRAITE: [], NON_RETENU: [],
};

@Injectable()
export class CocService {
  constructor(private prisma: PrismaService, private audit: AuditService,
    private cpsi?: { ingererSignal(ctx: Ctx, clientId: string, dto: any): Promise<any> },
    private reviews?: { anticiper(ctx: Ctx, id: string, dto: any): Promise<any> }) {}

  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload, at: new Date().toISOString() } });
  }
  private async settings(tenantId: string) {
    const t = await this.prisma.tenant.findFirst({ where: { id: tenantId } });
    return ((t?.settings as any) ?? {});
  }

  // ── R276 : la config EN VIGUEUR d'un type à une date — registre versionné, repli = table LIVRÉE ──
  private async configEnVigueur(db: any, tenantId: string, typeCode: string, at: Date) {
    const v = await db.cocConfigVersion.findFirst({
      where: { tenantId, typeCode, effetAt: { lte: at } }, orderBy: { effetAt: "desc" } });
    if (v) return { ...v, source: "tenant" };
    const livre = (CONFIG_LIVREE as any).types.find((t: any) => t.typeCode === typeCode);
    if (!livre) return null;
    return { ...livre, effetAt: new Date(0), source: "livree" };            // la table livrée vaut version 0
  }

  // ── Éditeur du registre (annexe C) : versionné à date ; HAUTE FORCE la révision (SD-06, backend) ──
  async definirType(ctx: Ctx, dto: { typeCode?: string; libelle?: string; materialite?: string;
    actionRequise?: string; roleTraitant?: string; severiteCpsi?: number; effetAt?: string }) {
    if (!["CO_SR", "ADMIN"].includes(ctx.role)) throw new ForbiddenException("Le registre CoC s'édite en CO_SR/ADMIN");
    if (!dto?.typeCode || !dto?.libelle) throw new BadRequestException("typeCode et libelle requis");
    if (!MATERIALITES.includes(dto.materialite ?? "")) throw new BadRequestException("materialite : HAUTE | MOYENNE | BASSE");
    if (!ACTIONS.includes(dto.actionRequise ?? "")) throw new BadRequestException("actionRequise : REVISION_KYC | MAJ_CIBLEE | PRISE_CONNAISSANCE");
    if (dto.materialite === "HAUTE" && dto.actionRequise !== "REVISION_KYC")
      throw new BadRequestException("SD-06 : la matérialité HAUTE force « REVISION_KYC » — contrainte backend, pas déclarative");
    const v = await this.prisma.cocConfigVersion.create({ data: {
      tenantId: ctx.tenantId, typeCode: dto.typeCode, libelle: dto.libelle,
      materialite: dto.materialite!, actionRequise: dto.actionRequise!,
      roleTraitant: dto.roleTraitant ?? "CO", severiteCpsi: dto.severiteCpsi ?? 1,
      effetAt: dto.effetAt ? new Date(dto.effetAt) : new Date(), par: ctx.userId } });
    await this.audit.log(ctx.tenantId, ctx.userId, "COC_CONFIG_DEFINIE", `${dto.typeCode}:${dto.materialite}`);
    return { id: v.id, typeCode: v.typeCode, effetAt: v.effetAt };
  }

  async config(ctx: Ctx) {
    const versions = await this.prisma.cocConfigVersion.findMany({
      where: { tenantId: ctx.tenantId, effetAt: { lte: new Date() } }, orderBy: { effetAt: "asc" } });
    const parType = new Map<string, any>();
    for (const t of (CONFIG_LIVREE as any).types) parType.set(t.typeCode, { ...t, source: "livree" });
    for (const v of versions) parType.set(v.typeCode, { typeCode: v.typeCode, libelle: v.libelle,
      materialite: v.materialite, actionRequise: v.actionRequise, roleTraitant: v.roleTraitant,
      severiteCpsi: v.severiteCpsi, effetAt: v.effetAt, source: "tenant" });
    return { types: [...parType.values()] };
  }

  // ── R276/CC-01 : ouvrir un dossier — valeurs FIGÉES + signal CPSI rattaché + anticipation HAUTE ──
  async ouvrir(ctx: Ctx, dto: { clientId?: string; typeCode?: string; description?: string }) {
    if (!dto?.clientId || !dto?.typeCode) throw new BadRequestException("clientId et typeCode requis");
    if (!dto?.description?.trim()) throw new BadRequestException("R7 : la description du changement est obligatoire");
    const client = await this.prisma.client.findFirst({ where: { id: dto.clientId, tenantId: ctx.tenantId } });
    if (!client) throw new NotFoundException("Client introuvable dans ce tenant");
    const now = new Date();
    const cfg = await this.configEnVigueur(this.prisma, ctx.tenantId, dto.typeCode, now);
    if (!cfg) throw new BadRequestException(`Type CoC inconnu du registre : ${dto.typeCode} (default-deny)`);
    const d = await this.prisma.$transaction(async (tx: Tx) => {
      const cree = await tx.cocFile.create({ data: {
        tenantId: ctx.tenantId, clientId: dto.clientId!, typeCode: dto.typeCode!,
        materialite: cfg.materialite, actionRequise: cfg.actionRequise, roleTraitant: cfg.roleTraitant,
        severiteCpsi: cfg.severiteCpsi ?? null, configVersionAt: new Date(cfg.effetAt),
        description: dto.description!.trim(), declarant: ctx.userId } });
      await this.emit(tx, ctx.tenantId, "COC_OUVERT", cree.id,
        { clientId: dto.clientId, typeCode: dto.typeCode, materialite: cfg.materialite,
          actionRequise: cfg.actionRequise, configVersionAt: cfg.effetAt, par: ctx.userId });
      return cree;
    });
    // Signal CPSI coc_sensible RATTACHÉ au dossier — l'échec ne bloque pas mais n'est JAMAIS silencieux.
    try {
      await this.cpsi?.ingererSignal(ctx, dto.clientId, { type: "coc_sensible",
        severite: cfg.severiteCpsi ?? 1, meta: { cocFileId: d.id, typeCode: dto.typeCode } });
    } catch {
      await this.prisma.$transaction(async (tx: Tx) =>
        this.emit(tx, ctx.tenantId, "COC_SIGNAL_NON_EMIS", d.id,
          { clientId: dto.clientId, pourquoi: "porte CPSI indisponible ou client non enregistré" }));
    }
    // CC-04/RV-04 : un CoC HAUTE ANTICIPE la review — via la voie R273 réelle, tracée avec déclencheur.
    if (cfg.materialite === "HAUTE" && this.reviews) {
      const s = await this.settings(ctx.tenantId);
      const cible = new Date(Date.now() + (s.cocReviewAnticipationJours ?? 30) * 86400000);
      const planifiee = await this.prisma.reviewDeadline.findFirst({
        where: { tenantId: ctx.tenantId, clientId: dto.clientId, statut: "PLANIFIEE" } });
      if (planifiee && cible < new Date(planifiee.dueDate)) {
        try {
          await this.reviews.anticiper(ctx, planifiee.id, { nouvelleDate: cible.toISOString(),
            motif: `CoC ${dto.typeCode} matérialité HAUTE (dossier ${d.id})`, declencheur: "coc_haute" });
        } catch { /* l'échéance a pu être décidée entre-temps — l'anticipation reste un événement, jamais un blocage */ }
      }
    }
    await this.audit.log(ctx.tenantId, ctx.userId, "COC_OUVERT", d.id);
    return { id: d.id, statut: d.statut, materialite: d.materialite, actionRequise: d.actionRequise,
      roleTraitant: d.roleTraitant, configVersionAt: d.configVersionAt };
  }

  // ── T8 : la liste — compteur + répartition par matérialité, périmètre SERVEUR ──
  async lister(ctx: Ctx, statut?: string) {
    if (ctx.role === "ADMIN") throw new ForbiddenException("HOME_SCOPE: ADMIN ne voit aucune donnée client (matrice A.3)");
    let clients: string[] | null = null;
    if (ctx.role === "RM" || ctx.role === "ARM") {
      const cs = await this.prisma.client.findMany({ where: { tenantId: ctx.tenantId, rmUserId: ctx.userId }, select: { id: true } });
      clients = cs.map((c) => c.id);
    }
    const statuts = statut ? statut.split(",") : ["OUVERT", "EN_TRAITEMENT"];
    const ds = await this.prisma.cocFile.findMany({ where: { tenantId: ctx.tenantId,
      statut: { in: statuts }, ...(clients ? { clientId: { in: clients } } : {}) },
      orderBy: { createdAt: "asc" }, take: 200 });
    const parMaterialite: Record<string, number> = {};
    for (const d of ds) parMaterialite[d.materialite] = (parMaterialite[d.materialite] ?? 0) + 1;
    return { total: ds.length, parMaterialite, dossiers: ds.map((d: any) => ({ id: d.id, clientId: d.clientId,
      typeCode: d.typeCode, materialite: d.materialite, actionRequise: d.actionRequise, statut: d.statut,
      roleTraitant: d.roleTraitant, createdAt: d.createdAt })) };
  }

  private async dossier(db: any, ctx: Ctx, id: string) {
    const d = await db.cocFile.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!d) throw new NotFoundException("Dossier CoC introuvable");
    return d;
  }

  // ── R277 : traiter — l'action FIGÉE est VÉRIFIÉE, le refus LISTE, rôle du type, four-eyes HAUTE ──
  async traiter(ctx: Ctx, id: string, dto: { revisionKycId?: string; majRefs?: any[]; sansMajMotif?: string }) {
    const s = await this.settings(ctx.tenantId);
    return this.prisma.$transaction(async (tx: Tx) => {
      const d = await this.dossier(tx, ctx, id);
      if (!(TRANSITIONS[d.statut] ?? []).includes("TRAITE"))
        throw new ConflictException(`Transition illégale : ${d.statut} → TRAITE`);
      if (ctx.role !== d.roleTraitant)                                      // CC-06 : le rôle du TYPE traite
        throw new ForbiddenException(`R277 : le traitement de ce type est réservé au rôle ${d.roleTraitant}`);
      // Le VISA (2e passage, four-eyes) reprend les preuves ENREGISTRÉES à la demande — le
      // premier passage, lui, doit fournir et faire vérifier les siennes (refus LISTÉ, CC-03/05).
      if (!d.traitementEnAttente) {
        const manquants: string[] = [];
        if (d.actionRequise === "REVISION_KYC") {                           // HAUTE (CC-03)
          if (!dto?.revisionKycId) manquants.push("révision KYC manquante (revisionKycId)");
          else {
            const kyc = await tx.kycFile.findFirst({ where: { id: dto.revisionKycId, tenantId: ctx.tenantId, clientId: d.clientId } });
            if (!kyc) manquants.push("révision KYC introuvable pour ce client");
          }
        }
        if (d.actionRequise === "MAJ_CIBLEE"                                // MOYENNE (CC-05)
            && !(dto?.majRefs?.length) && !dto?.sansMajMotif?.trim())
          manquants.push("mise à jour ciblée référencée (majRefs) OU décision motivée (sansMajMotif)");
        if (manquants.length)
          throw new BadRequestException(`R277 : traitement refusé — ${manquants.join(" ; ")}`);
      }
      // Four-eyes par matérialité (CC-06) : le premier acte ENREGISTRE, le SECOND vise.
      const fourEyes = ((s.cocFourEyes ?? { HAUTE: true })[d.materialite]) === true;
      if (fourEyes && !d.traitementEnAttente) {
        const demande = { par: ctx.userId, at: new Date().toISOString(),
          revisionKycId: dto?.revisionKycId ?? null, majRefs: dto?.majRefs ?? null, sansMajMotif: dto?.sansMajMotif ?? null };
        await tx.cocFile.update({ where: { id: d.id }, data: { traitementEnAttente: demande } });
        await this.emit(tx, ctx.tenantId, "COC_TRAITEMENT_DEMANDE", d.id, demande);
        return { enAttenteDeVisa: true };
      }
      const preuves = d.traitementEnAttente ? (d.traitementEnAttente as any) : null;
      if (preuves && preuves.par === ctx.userId)
        throw new ForbiddenException("R13 : le visa de traitement exige un SECOND — l'initiateur ne vise pas");
      await tx.cocFile.update({ where: { id: d.id }, data: { statut: "TRAITE",
        revisionKycId: preuves?.revisionKycId ?? dto?.revisionKycId ?? null,
        majRefs: preuves?.majRefs ?? dto?.majRefs ?? null,
        sansMajMotif: preuves?.sansMajMotif ?? dto?.sansMajMotif ?? null,
        traitementEnAttente: null, traitePar: ctx.userId, traiteAt: new Date() } });
      await this.emit(tx, ctx.tenantId, "COC_TRAITE", d.id,
        { par: ctx.userId, ...(preuves ? { demandePar: preuves.par } : {}) });
      await this.audit.log(ctx.tenantId, ctx.userId, "COC_TRAITE", d.id);
      return { statut: "TRAITE" };
    });
  }

  async transitionner(ctx: Ctx, id: string, vers: string, motif?: string) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const d = await this.dossier(tx, ctx, id);
      if (!(TRANSITIONS[d.statut] ?? []).includes(vers))
        throw new ConflictException(`Transition illégale : ${d.statut} → ${vers}`);
      if (vers === "TRAITE") throw new BadRequestException("TRAITE passe par POST /:id/traiter (vérification R277)");
      if (vers === "NON_RETENU" && !motif?.trim())
        throw new BadRequestException("R7/CC-07 : NON_RETENU exige un motif — jamais une disparition silencieuse");
      await tx.cocFile.update({ where: { id: d.id },
        data: { statut: vers, ...(vers === "NON_RETENU" ? { motifCloture: motif!.trim(), traitePar: ctx.userId, traiteAt: new Date() } : {}) } });
      await this.emit(tx, ctx.tenantId, `COC_${vers}`, d.id, { par: ctx.userId, ...(motif ? { motif: motif.trim() } : {}) });
      return { statut: vers };
    });
  }

  // ── R278 : la chaîne PROUVE — rejeu à date + reporting des délais (mesure, jamais un blocage) ──
  async replay(ctx: Ctx, id: string, asOf?: string) {
    const d = await this.dossier(this.prisma, ctx, id);
    let evs = await this.prisma.domainEvent.findMany({ where: { tenantId: ctx.tenantId, aggregateId: id } });
    if (asOf) evs = evs.filter((e: any) => new Date(e.at) <= new Date(asOf));
    evs.sort((a: any, b: any) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return { cocFileId: id, statut: d.statut,
      valeursFigees: { materialite: d.materialite, actionRequise: d.actionRequise,
        roleTraitant: d.roleTraitant, configVersionAt: d.configVersionAt },
      preuves: { revisionKycId: d.revisionKycId, majRefs: d.majRefs, sansMajMotif: d.sansMajMotif },
      chaine: evs.map((e: any) => ({ type: e.type, at: e.at, payload: e.payload })) };
  }

  async reporting(ctx: Ctx) {
    const s = await this.settings(ctx.tenantId);
    const sla = s.cocSlaJours ?? { HAUTE: 10, MOYENNE: 30, BASSE: 90 };
    const traites = await this.prisma.cocFile.findMany({ where: { tenantId: ctx.tenantId, statut: "TRAITE" } });
    const par: Record<string, { n: number; delaiMoyenJours: number }> = {};
    for (const m of MATERIALITES) {
      const xs = traites.filter((d: any) => d.materialite === m && d.traiteAt);
      const moy = xs.length ? xs.reduce((acc: number, d: any) =>
        acc + (new Date(d.traiteAt!).getTime() - new Date(d.createdAt).getTime()) / 86400000, 0) / xs.length : 0;
      par[m] = { n: xs.length, delaiMoyenJours: Math.round(moy * 10) / 10 };
    }
    return { parMaterialite: par, slaJours: sla };                          // R39 : mesuré, notifié — jamais bloquant
  }
}

@Controller("coc")
export class CocController {
  constructor(private svc: CocService) {}
  @Get("config")            config(@Req() r: any) { return this.svc.config(r.ctx); }                        // R276 (store créé)
  @Post("config")           definir(@Req() r: any, @Body() b: any) { return this.svc.definirType(r.ctx, b ?? {}); } // versionné à date + SD-06
  @Get("reporting")         reporting(@Req() r: any) { return this.svc.reporting(r.ctx); }                  // R278
  @Get(":id/replay")        replay(@Req() r: any, @Param("id") id: string, @Query("as_of") asOf?: string) { return this.svc.replay(r.ctx, id, asOf); } // CC-08
  @Get()                    lister(@Req() r: any, @Query("statut") statut?: string) { return this.svc.lister(r.ctx, statut); } // T8
  @Post()                   ouvrir(@Req() r: any, @Body() b: any) { return this.svc.ouvrir(r.ctx, b ?? {}); }        // CC-01
  @Post(":id/traiter")      traiter(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.traiter(r.ctx, id, b ?? {}); } // R277
  @Post(":id/transition")   tr(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.transitionner(r.ctx, id, b?.vers, b?.motif); }
}

@Module({
  imports: [CpsiModule, ReviewsModule],
  controllers: [CocController],
  providers: [
    PrismaService, AuditService,
    { provide: CocService,
      useFactory: (p: PrismaService, a: AuditService, c: CpsiService, rv: ReviewsService) => new CocService(p, a, c, rv),
      inject: [PrismaService, AuditService, CpsiService, ReviewsService] }],
  exports: [CocService],
})
export class CocModule {}
