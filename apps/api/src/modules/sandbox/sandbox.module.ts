import { Body, Controller, Module, Post, Req, Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";

/**
 * LES 5 BACS À SABLE — canon vague pilote partie 3 (BS-01..06, famille BS ratifiée), arbitrage :
 * « crée les endpoints dry-run sous le patron SandboxAml, signalés comme APPLICATION de R70 —
 * zéro mutation prouvée (BS-01) ». Chaque bac : leviers → PROJECTION calculée CÔTÉ BACKEND sur
 * les données RÉELLES du tenant — AUCUNE écriture (lectures seules, prouvé par comptage e2e),
 * AUCUN « Appliquer » ici (l'application vit dans l'écran de paramétrage, avec son verrou R70).
 * Écarts consignés (ECARTS, reconnaissance 2026-07-27) et ASSUMÉS par l'arbitrage :
 *  · sbbrm projette sur le riskScore STOCKÉ des dossiers (le moteur BRM capacité-équipe reste
 *    non isolé) ; · sbcf projette sur les documents GED réels (exigences = levier saisi) ;
 *  · sbwf projette les goulots depuis les visas PENDING (l'objet workflow-def reste minimal) ;
 *  · l'inconnu va en QUARANTAINE, jamais deviné (BS-05, pattern R169).
 */

type Ctx = { tenantId: string; userId: string; role: string };

@Injectable()
export class SandboxService {
  constructor(private prisma: PrismaService) {}

  // ── sbkyc (BS-03) : levier = un droit REQUIRED ajouté (rôle × question/section) →
  //    dossiers EN COURS devenant incomplets + charge par rôle. Lecture pure. ──
  async kycDroits(ctx: Ctx, dto: { role?: string; questionCode?: string; sectionCode?: string }) {
    if (!dto?.role || (!dto?.questionCode && !dto?.sectionCode))
      throw new BadRequestException("role et questionCode|sectionCode requis");
    const dossiers = await this.prisma.kycFile.findMany({
      where: { tenantId: ctx.tenantId, status: { in: ["IN_PROGRESS", "UNDER_REVIEW"] } },
      include: { sections: { include: { questions: true } } } });
    const impactes: { code: string; questionsVides: number }[] = [];
    let contributions = 0;
    for (const d of dossiers) {
      let vides = 0;
      for (const s of d.sections) {
        if (dto.sectionCode && s.code !== dto.sectionCode) continue;
        for (const q of s.questions) {
          if (dto.questionCode && q.code !== dto.questionCode) continue;
          contributions++;
          if (!q.answer) vides++;
        }
      }
      if (vides > 0) impactes.push({ code: d.code, questionsVides: vides });
    }
    return { ecriture: false, dossiersEvalues: dossiers.length,
      dossiersImpactes: impactes,                                           // NOMINATIF, pas un compteur
      chargeParRole: { [dto.role]: contributions } };
  }

  // ── sbbrm (BS-04) : levier = seuils de la grille SDD/CDD/EDD → reclassements NOMINATIFS
  //    (qui monte, qui descend, avec son score) + Δ charge EDD. Sur le riskScore stocké. ──
  async brmSeuils(ctx: Ctx, dto: { seuilEdd?: number; seuilCdd?: number }) {
    const seuilEdd = dto?.seuilEdd ?? 50; const seuilCdd = dto?.seuilCdd ?? 25;   // grille actuelle : 50/25
    if (seuilCdd >= seuilEdd) throw new BadRequestException("seuilCdd doit être < seuilEdd");
    const dossiers = await this.prisma.kycFile.findMany({ where: { tenantId: ctx.tenantId },
      select: { code: true, clientId: true, riskScore: true, workflow: true } });
    const classe = (score: number) => (score >= seuilEdd ? "EDD" : score >= seuilCdd ? "CDD" : "SDD");
    const reclassements = dossiers
      .map((d) => ({ code: d.code, clientId: d.clientId, score: d.riskScore, avant: d.workflow, apres: classe(d.riskScore) }))
      .filter((d) => d.avant !== d.apres);                                  // NOMINATIF (BS-04)
    const eddAvant = dossiers.filter((d) => d.workflow === "EDD").length;
    const eddApres = dossiers.filter((d) => classe(d.riskScore) === "EDD").length;
    return { ecriture: false, dossiersEvalues: dossiers.length, reclassements,
      deltaChargeEdd: eddApres - eddAvant };
  }

  // ── sbonb (BS-05) : levier = règles d'aiguillage structure→workflow → répartition des dossiers
  //    entrants + cas NON ROUTABLES (quarantaine, jamais devinés — pattern R169). ──
  async onbAiguillage(ctx: Ctx, dto: { table?: Record<string, string> }) {
    if (!dto?.table || !Object.keys(dto.table).length)
      throw new BadRequestException("table d'aiguillage {structure: workflow} requise");
    for (const wf of Object.values(dto.table))
      if (!["SDD", "CDD", "EDD"].includes(wf)) throw new BadRequestException(`workflow inconnu : ${wf} (default-deny)`);
    const clients = await this.prisma.client.findMany({ where: { tenantId: ctx.tenantId },
      select: { id: true, name: true, structure: true } });
    const repartition: Record<string, number> = {};
    const nonRoutables: { id: string; structure: string }[] = [];
    for (const c of clients) {
      const wf = dto.table[c.structure];
      if (!wf) nonRoutables.push({ id: c.id, structure: c.structure });     // QUARANTAINE — jamais deviné
      else repartition[wf] = (repartition[wf] ?? 0) + 1;
    }
    return { ecriture: false, clientsEvalues: clients.length, repartition, nonRoutables };
  }

  // ── sbcf : levier = exigences documentaires par structure → dossiers non conformes,
  //    documents manquants PAR DOSSIER (sur la GED réelle). ──
  async cfExigences(ctx: Ctx, dto: { exigences?: Record<string, string[]> }) {
    if (!dto?.exigences || !Object.keys(dto.exigences).length)
      throw new BadRequestException("exigences {structure: [types de document]} requises");
    const clients = await this.prisma.client.findMany({ where: { tenantId: ctx.tenantId },
      include: { documents: { select: { nom: true, code: true } } } });
    const nonConformes: { clientId: string; structure: string; manquants: string[] }[] = [];
    for (const c of clients) {
      const requis = dto.exigences[c.structure];
      if (!requis) continue;                                                // structure hors levier : non évaluée
      const presents = new Set(c.documents.flatMap((d) => [d.nom, d.code].filter(Boolean) as string[]));
      const manquants = requis.filter((r) => !presents.has(r));
      if (manquants.length) nonConformes.push({ clientId: c.id, structure: c.structure, manquants });
    }
    return { ecriture: false, clientsEvalues: clients.length, nonConformes };
  }

  // ── sbwf : levier = délais cibles par section/étape → goulots projetés (visas PENDING plus
  //    vieux que la cible), charge par rôle, dossiers impactés. ──
  async wfDelais(ctx: Ctx, dto: { delaisJours?: Record<string, number>; now?: string }) {
    if (!dto?.delaisJours || !Object.keys(dto.delaisJours).length)
      throw new BadRequestException("delaisJours {section: jours} requis");
    const now = dto.now ? new Date(dto.now) : new Date();
    const dossiers = await this.prisma.kycFile.findMany({
      where: { tenantId: ctx.tenantId, status: { in: ["IN_PROGRESS", "UNDER_REVIEW"] } },
      include: { visas: true } });
    const goulots: { code: string; section: string; role: string; joursOuverts: number; cible: number }[] = [];
    const chargeParRole: Record<string, number> = {};
    for (const d of dossiers) {
      for (const v of d.visas) {
        if (v.status !== "PENDING") continue;
        chargeParRole[v.requiredRole] = (chargeParRole[v.requiredRole] ?? 0) + 1;
        const cible = dto.delaisJours[v.sectionCode];
        if (cible == null) continue;
        const jours = Math.floor((now.getTime() - new Date(d.createdAt).getTime()) / 86400000);
        if (jours > cible) goulots.push({ code: d.code, section: v.sectionCode, role: v.requiredRole, joursOuverts: jours, cible });
      }
    }
    return { ecriture: false, dossiersEvalues: dossiers.length, goulots, chargeParRole };
  }
}

// Patron SandboxAml : POST de SIMULATION (dry-run, lectures seules) — l'URL dit « sandbox »,
// la réponse dit `ecriture: false`, et AUCUNE route d'application n'existe ici (BS-06).
@Controller("sandbox")
export class SandboxController {
  constructor(private svc: SandboxService) {}
  @Post("kyc-droits")      kyc(@Req() r: any, @Body() b: any) { return this.svc.kycDroits(r.ctx, b ?? {}); }        // sbkyc / BS-03
  @Post("brm-seuils")      brm(@Req() r: any, @Body() b: any) { return this.svc.brmSeuils(r.ctx, b ?? {}); }        // sbbrm / BS-04
  @Post("onb-aiguillage")  onb(@Req() r: any, @Body() b: any) { return this.svc.onbAiguillage(r.ctx, b ?? {}); }    // sbonb / BS-05
  @Post("cf-exigences")    cf(@Req() r: any, @Body() b: any) { return this.svc.cfExigences(r.ctx, b ?? {}); }       // sbcf
  @Post("wf-delais")       wf(@Req() r: any, @Body() b: any) { return this.svc.wfDelais(r.ctx, b ?? {}); }          // sbwf
}

@Module({ controllers: [SandboxController], providers: [PrismaService, SandboxService], exports: [SandboxService] })
export class SandboxModule {}
