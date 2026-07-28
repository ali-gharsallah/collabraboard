import { BadRequestException, Body, Controller, ForbiddenException, Get, Module, NotFoundException, Param, Post, Req, Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { Tx } from "../../common/tx";
import { WorkflowModule } from "../workflow/workflow.module";
import { WorkflowDefService } from "../workflow/workflow-def.service";
import { ParametresModule } from "../parametres/parametres.module";
import { ParametresService } from "../parametres/parametres.service";

/**
 * LE BUILDER — dégel V3 (GO Ali 2026-07-28), R304-R308, WB-01..10.
 * R304 : brouillons MUTABLES, versions publiées GRAVÉES (append-only), datées —
 * grandfathering R29 (le dossier en cours reste sur SA version).
 * R306 : la COHÉRENCE est validée ICI, au backend, à la publication — TOUS les refus
 * listés d'un coup (pattern R269) ; le front AFFICHE, il ne précalcule pas.
 * R305 : « publier » n'existe pas sans SIMULATION du même contenu (empreinte SHA) —
 * re-modifier invalide ; le rapport d'impact est JOINT à la version.
 * R307 : publication FOUR-EYES — l'auteur du brouillon ne publie pas (R13) ; rôles
 * habilités = `roles_publication_builder` (défaut ADMIN + CO_SR).
 * R308 : les artefacts s'exécutent sur les MOTEURS EXISTANTS — un WORKFLOW publié
 * devient une définition de l'atelier R171-173 (moteur R1-R51, intouchable) ; une
 * SECTION enrichit le gabarit des dossiers à leur création (matrice R282) ; un
 * QUESTIONNAIRE devient un review_profile (R283, registre). ZÉRO runtime propre —
 * WB-08 le vérifie par revue automatisée.
 */

type Ctx = { tenantId: string; userId: string; role: string };
const TYPES = ["SECTION", "QUESTIONNAIRE", "WORKFLOW"];
const empreinteDe = (contenu: any) => createHash("sha256").update(JSON.stringify(contenu)).digest("hex");

@Injectable()
export class BuilderService {
  constructor(private prisma: PrismaService, private audit: AuditService,
    private wfDefs: WorkflowDefService, private parametres: ParametresService) {}

  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload, at: new Date().toISOString() } });
  }

  // ── R304 : le brouillon — se modifie à volonté, n'existe jamais pour les moteurs. ──
  async ecrireBrouillon(ctx: Ctx, dto: { type?: string; code?: string; contenu?: any }) {
    if (!TYPES.includes(dto?.type ?? "")) throw new BadRequestException(`type requis : ${TYPES.join(" | ")}`);
    if (!dto?.code?.trim() || !dto?.contenu) throw new BadRequestException("code et contenu requis");
    const a = await this.prisma.builderArtefact.upsert({
      where: { tenantId_type_code: { tenantId: ctx.tenantId, type: dto.type!, code: dto.code.trim() } },
      update: { contenu: dto.contenu, auteur: ctx.userId },
      create: { tenantId: ctx.tenantId, type: dto.type!, code: dto.code.trim(),
        contenu: dto.contenu, auteur: ctx.userId } });
    return { id: a.id, type: a.type, code: a.code, empreinte: empreinteDe(a.contenu) };
  }

  async lister(ctx: Ctx) {
    const brouillons = await this.prisma.builderArtefact.findMany({ where: { tenantId: ctx.tenantId } });
    const versions = await this.prisma.builderVersion.findMany({
      where: { tenantId: ctx.tenantId }, orderBy: [{ code: "asc" }, { version: "asc" }] });
    return { brouillons: brouillons.map((b) => ({ id: b.id, type: b.type, code: b.code, auteur: b.auteur })),
      versions: versions.map((v) => ({ type: v.type, code: v.code, version: v.version,
        depuisLe: v.depuisLe, auteur: v.auteur, publiePar: v.publiePar })) };
  }

  // ── R305 : simuler — projection d'impact, empreinte du contenu simulé (le verrou). ──
  async simuler(ctx: Ctx, id: string) {
    const a = await this.prisma.builderArtefact.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!a) throw new NotFoundException("Artefact introuvable");
    const empreinte = empreinteDe(a.contenu);
    const rapport = await this.rapportImpact(ctx, a);
    await this.prisma.$transaction(async (tx: Tx) =>
      this.emit(tx, ctx.tenantId, "builder.simulation", a.id, { empreinte, rapport, par: ctx.userId }));
    return { empreinte, rapport };
  }

  // Rapport d'impact — même principe que SB-03 : projection backend, nominatif, rien d'écrit.
  private async rapportImpact(ctx: Ctx, a: { type: string; code: string; contenu: any }) {
    const c: any = a.contenu;
    if (a.type === "SECTION") {
      const enCours = await this.prisma.kycFile.count({
        where: { tenantId: ctx.tenantId, status: { not: "VALIDATED" },
          workflow: { in: c.workflows ?? [] } } });
      const chargeParRole: Record<string, number> = {};
      for (const q of c.questions ?? [])
        for (const [role, droit] of Object.entries(q.rights ?? {}))
          if (droit === "EDIT") chargeParRole[role] = (chargeParRole[role] ?? 0) + 1;
      return { dossiersEnCoursConcernes: enCours, chargeParRole,
        questionsRequisesAjoutees: (c.questions ?? []).filter((q: any) => q.requise).map((q: any) => q.code),
        note: "les dossiers en cours restent sur LEUR version (R29) — seuls les NOUVEAUX prennent celle-ci" };
    }
    if (a.type === "WORKFLOW") {
      const enCours = await this.prisma.kycFile.count({ where: { tenantId: ctx.tenantId, status: { not: "VALIDATED" } } });
      return { dossiersEnCoursConcernes: enCours, etapes: (c.etapes ?? []).length,
        note: "les instances en cours gardent leur version (R172 : le dossier emporte sa version)" };
    }
    return { profils: 1, note: "le profil s'applique aux reviews LANCÉES après publication (R29/R283)" };
  }

  // ── R306 : LA cohérence — TOUS les refus, d'un coup, typés (pattern R269). ──
  validerCoherence(a: { type: string; contenu: any }): string[] {
    const c: any = a.contenu;
    const refus: string[] = [];
    const ROLES = ["RM", "ARM", "CO", "CO_SR", "MLRO", "CF", "BRM", "DIR", "ADMIN", "SO"];
    if (a.type === "SECTION" || a.type === "QUESTIONNAIRE") {
      const qs: any[] = c.questions ?? [];
      if (!qs.some((q) => Object.values(q.rights ?? {}).includes("EDIT")))
        refus.push("SECTION_SANS_ROLE_EDIT : aucune question n'est éditable par personne — la section est morte-née");
      for (const q of qs) {
        for (const [role, droit] of Object.entries(q.rights ?? {})) {
          if (!ROLES.includes(role))
            refus.push(`ROLE_INEXISTANT : « ${role} » (question ${q.code}) n'existe pas au RBAC tenant`);
          if (q.requise && droit === "HIDDEN")
            refus.push(`REQUISE_MAIS_CACHEE : ${q.code} est REQUISE pour ${role} qui la voit HIDDEN — impossible à remplir`);
        }
        if (q.requise && !Object.values(q.rights ?? {}).includes("EDIT"))
          refus.push(`REQUISE_SANS_EDIT : ${q.code} est requise mais aucun rôle ne peut l'éditer`);
      }
    }
    if (a.type === "WORKFLOW") {
      const etapes: any[] = c.etapes ?? [];
      const codes = new Set(etapes.map((e) => e.code));
      const terminaux: string[] = c.terminaux ?? [];
      if (!terminaux.length || !terminaux.some((t) => codes.has(t)))
        refus.push("WORKFLOW_SANS_TERMINAL : aucun état terminal atteignable n'est déclaré");
      for (const e of etapes) {
        if (!e.owner) refus.push(`ETAPE_SANS_OWNER : ${e.code} n'a pas de rôle responsable`);
        else if (!ROLES.includes(e.owner)) refus.push(`ROLE_INEXISTANT : « ${e.owner} » (étape ${e.code}) n'existe pas au RBAC tenant`);
        for (const t of e.transitions ?? [])
          if (!codes.has(t)) refus.push(`TRANSITION_ORPHELINE : ${e.code} → ${t} (cible inexistante)`);
      }
      // Cycle sans sortie : une étape dont AUCUN chemin n'atteint un terminal
      const atteintTerminal = (depart: string, vus = new Set<string>()): boolean => {
        if (terminaux.includes(depart)) return true;
        if (vus.has(depart)) return false;
        vus.add(depart);
        const e = etapes.find((x) => x.code === depart);
        return (e?.transitions ?? []).some((t: string) => codes.has(t) && atteintTerminal(t, vus));
      };
      for (const e of etapes)
        if (!terminaux.includes(e.code) && !atteintTerminal(e.code))
          refus.push(`CYCLE_SANS_SORTIE : depuis ${e.code}, aucun chemin n'atteint un état terminal`);
    }
    return refus;
  }

  // ── Publier : cohérence (R306) → verrou simulation (R305) → four-eyes (R307) → graver (R304). ──
  async publier(ctx: Ctx, id: string, dto: { motif?: string; depuisLe?: string }) {
    const a = await this.prisma.builderArtefact.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!a) throw new NotFoundException("Artefact introuvable");
    if (!dto?.motif?.trim()) throw new BadRequestException("R7 : publier un artefact se motive");
    const refus = this.validerCoherence(a);
    if (refus.length)
      throw new BadRequestException({ message: "R306 : artefact incohérent — TOUT est listé, rien n'est tronqué",
        refus });
    const empreinte = empreinteDe(a.contenu);
    const sim = await this.prisma.domainEvent.findFirst({
      where: { tenantId: ctx.tenantId, type: "builder.simulation", aggregateId: a.id }, orderBy: { id: "desc" } });
    if (!sim || (sim.payload as any).empreinte !== empreinte)
      throw new BadRequestException(
        "R305 : publier sans simulation n'existe pas — simulez CE contenu (toute modification invalide la simulation)");
    const t = await this.prisma.tenant.findFirst({ where: { id: ctx.tenantId } });
    const rolesPub: string[] = ((t?.settings as any) ?? {}).roles_publication_builder ?? ["ADMIN", "CO_SR"];
    if (!rolesPub.includes(ctx.role))
      throw new ForbiddenException(`R307 : la publication est réservée aux rôles ${rolesPub.join(", ")} (roles_publication_builder)`);
    if (a.auteur === ctx.userId)
      throw new ForbiddenException("R13/R307 : l'AUTEUR ne publie pas son propre artefact — un second regard publie");
    const rapport = (sim.payload as any).rapport ?? null;
    const depuisLe = dto.depuisLe ?? new Date().toISOString();
    const derniere = await this.prisma.builderVersion.findFirst({
      where: { tenantId: ctx.tenantId, type: a.type, code: a.code }, orderBy: { version: "desc" } });
    const version = (derniere?.version ?? 0) + 1;
    const v = await this.prisma.$transaction(async (tx: Tx) => {
      const creee = await tx.builderVersion.create({ data: { tenantId: ctx.tenantId, type: a.type,
        code: a.code, version, contenu: a.contenu as any, depuisLe, auteur: a.auteur,
        publiePar: ctx.userId, motif: dto.motif!.trim(), rapport } });
      await this.emit(tx, ctx.tenantId, "builder.publication", creee.id,
        { type: a.type, code: a.code, version, auteur: a.auteur, publicateur: ctx.userId,
          depuisLe, rapport });                                              // WB-10 : le rapport VOYAGE avec l'acte
      return creee;
    });
    await this.audit.log(ctx.tenantId, ctx.userId, "BUILDER_PUBLISH", `${a.type}:${a.code}:v${version}`);
    await this.materialiser(ctx, { type: v.type, code: v.code, contenu: v.contenu, version,
      depuisLe, motif: dto.motif!.trim() });                                 // R308 — les moteurs existants
    return { id: v.id, type: v.type, code: v.code, version, depuisLe };
  }

  // ── R308 : matérialisation vers les moteurs RATIFIÉS — le Builder n'exécute RIEN. ──
  // WORKFLOW → l'atelier gouverné R171-173 (le moteur R1-R51 reste intouchable) ;
  // SECTION → rien à écrire ICI : le gabarit des dossiers la lit à la CRÉATION
  // (kyc.service, versionsSectionsBuilder — grandfathering R29 par construction) ;
  // QUESTIONNAIRE → un profil du registre reviewProfiles (R283), écrit par la voie R-Q.
  private async materialiser(ctx: Ctx, v: { type: string; code: string; contenu: any; version: number;
    depuisLe: string; motif: string }) {
    const c: any = v.contenu;
    if (v.type === "WORKFLOW") {
      const d: any = await this.wfDefs.creerBrouillon(ctx, { code: v.code, contenu: c });
      await this.wfDefs.publier(ctx, d.id, { depuisLe: v.depuisLe,
        motif: `Builder ${v.code} v${v.version} — ${v.motif}` });
    }
    if (v.type === "QUESTIONNAIRE") {
      const profils: any[] = (await this.parametres.valeurEffective(ctx, "reviewProfiles", new Date())) ?? [];
      const autres = profils.filter((p) => !(p.type === c.type && p.niveau === c.niveau));
      await this.parametres.ecrire(ctx, "reviewProfiles",
        [...autres, { type: c.type, niveau: c.niveau, sectionsActives: c.sectionsActives ?? [],
          questionsRequises: c.questionsRequises ?? [], sectionsReconfirmation: c.sectionsReconfirmation ?? [] }],
        `Builder ${v.code} v${v.version} — ${v.motif}`, v.depuisLe);
    }
  }
}

@Controller("builder")
export class BuilderController {
  constructor(private svc: BuilderService) {}
  @Post("artefacts")             ecrire(@Req() r: any, @Body() b: any) { return this.svc.ecrireBrouillon(r.ctx, b ?? {}); }   // R304
  @Get("artefacts")              lister(@Req() r: any) { return this.svc.lister(r.ctx); }
  @Post("artefacts/:id/simuler") simuler(@Req() r: any, @Param("id") id: string) { return this.svc.simuler(r.ctx, id); }      // R305
  @Post("artefacts/:id/publier") publier(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.publier(r.ctx, id, b ?? {}); } // R304..R307
}

@Module({ imports: [WorkflowModule, ParametresModule], controllers: [BuilderController], providers: [BuilderService], exports: [BuilderService] })
export class BuilderModule {}
