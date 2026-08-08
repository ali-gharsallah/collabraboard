import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { emitEvent } from "../../common/domain-event";
import { GedIngestionService } from "../ged/ged-ingestion.service";
import { WorkflowDefService } from "../workflow/workflow-def.service";
import { creerWir, validerWir, Wir, AnomalieWir } from "./wir.schema";

/**
 * Bloc WD (R432–R438) — pipeline WorkflowIR côté produit. AUCUNE mutation d'état hors
 * ÉVÉNEMENT : l'état d'un WIR est un REJEU du journal append-only existant (domain_events,
 * R48/R49) — wd.wir.importe → wd.wir.edite* → wd.wir.ratifie. La publication passe par le
 * module de VERSIONING EXISTANT (WorkflowDefService : brouillon → publier, R29/R48) — la
 * ratification crée le brouillon, jamais une publication directe (R436).
 * Paramètres Q-WD-1..5 au registre R-Q (parametres.service.ts).
 * Référence comportementale : la démo fusionnée (demo/wir-core.mjs) — R438 s'applique aussi
 * à l'implémentation : rien de fabriqué qui n'existe pas dans la source.
 */

export type ZoneIllisible = { x: number; y: number; largeur: number; hauteur: number; raison: string };
export type Extraction = { label: string; nodes: any[]; edges: any[];
  zonesIllisibles: ZoneIllisible[]; modele: string };

/** E-WD-2 (non tranché) : l'extraction vision vit derrière une INTERFACE — implémentation
 *  API (licence, flag tenant `wdVisionApi`) OU stub hors-ligne déterministe. */
export interface VisionExtractor {
  extraire(imageBase64: string, mediaType: string, indices?: { forcerRole?: string }): Promise<Extraction>;
}

/** Stub hors-ligne : extraction DÉTERMINISTE (pas d'appel réseau) — assume l'imperfection
 *  R438 : une zone illisible avec coordonnées + un nœud sous le seuil de confiance. */
export class StubVisionExtractor implements VisionExtractor {
  async extraire(_image: string, _mediaType: string, indices?: { forcerRole?: string }): Promise<Extraction> {
    return {
      label: "Workflow importé (extraction hors-ligne)",
      nodes: [
        { id: "n0", type: "start", label: "Entrée en relation", role: null, confidence: 0.95 },
        { id: "n1", type: "step", label: "Collecte documents", role: indices?.forcerRole ?? "ARM", confidence: 0.4 },
        { id: "n2", type: "step", label: "Revue conformité", role: "CO", confidence: 0.9 },
        { id: "n3", type: "end", label: "Décision", role: "CO_SR", confidence: 0.85 }],
      edges: [{ from: "n0", to: "n1" }, { from: "n1", to: "n2" }, { from: "n2", to: "n3" }],
      zonesIllisibles: [{ x: 120, y: 340, largeur: 180, hauteur: 60,
        raison: "trait manuscrit ambigu — étape non reconnue" }],
      modele: "stub-offline@1",
    };
  }
}

type Ctx = { tenantId: string; userId: string; role: string };

@Injectable()
export class WorkflowDesignerService {
  constructor(private prisma: PrismaService, private audit: AuditService,
    private ged: GedIngestionService, private defs: WorkflowDefService,
    private vision: VisionExtractor = new StubVisionExtractor()) {}

  private async params(tenantId: string) {
    const t: any = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const s = (t?.settings as any) ?? {};
    return {
      rolesImport: s.wdRolesImport ?? ["CO", "ADMIN"],                       // Q-WD-1
      roleRatifieur: s.wdRoleRatifieur ?? "CO_SR",                           // Q-WD-2
      seuilConfiance: typeof s.wdSeuilConfiance === "number" ? s.wdSeuilConfiance : 0.6,   // Q-WD-3
      formats: s.wdFormats ?? ["image/png", "image/jpeg", "application/pdf"], // Q-WD-4
      tailleMaxMo: typeof s.wdTailleMaxMo === "number" ? s.wdTailleMaxMo : 10, // Q-WD-4
      rolesTenant: s.wdRolesTenant ?? ["ARM", "RM", "CO", "CO_SR", "CF", "DIR", "ADMIN", "HPB", "CEO", "SECU", "Système", "MLRO", "SYSTEM"],   // Q-WD-5 — + rôles des gabarits livrés (E-WD-5/E-WD-7)
      visionApi: s.wdVisionApi === true,                                     // E-WD-2 (flag licence)
    };
  }

  /** POST import — archivage GED + hash (R436), extraction vision, WIR DRAFT_AI (R433). */
  async importer(ctx: Ctx, dto: { imageBase64: string; mediaType: string; nomFichier: string; forcerRole?: string }) {
    const p = await this.params(ctx.tenantId);
    if (!p.rolesImport.includes(ctx.role))
      throw new ForbiddenException(`Q-WD-1 : import réservé aux rôles ${p.rolesImport.join("/")}`);
    if (!p.formats.includes(dto.mediaType))
      throw new BadRequestException(`Q-WD-4 : format « ${dto.mediaType} » refusé (${p.formats.join(", ")})`);
    if (Buffer.byteLength(dto.imageBase64, "base64") > p.tailleMaxMo * 1024 * 1024)
      throw new BadRequestException(`Q-WD-4 : fichier au-delà de ${p.tailleMaxMo} Mo`);
    const hash = "sha256:" + createHash("sha256").update(dto.imageBase64).digest("hex");
    const { documentId } = await this.ged.ingerer(ctx, { canal: "UPLOAD",
      source: "workflow-designer", nomFichier: dto.nomFichier, contenu: dto.imageBase64 });
    const ex = await this.vision.extraire(dto.imageBase64, dto.mediaType,
      { forcerRole: dto.forcerRole });
    const wir = creerWir(ex, { source: "image", importePar: ctx.userId,
      hashFichier: hash, modele: ex.modele }, p.seuilConfiance);
    await this.prisma.$transaction(async (tx: any) => {
      await emitEvent(tx, ctx.tenantId, "wd.wir.importe", documentId,
        { documentId, hash, modele: ex.modele, wir, zonesIllisibles: ex.zonesIllisibles });
      await this.audit.log(ctx.tenantId, ctx.userId, "WD_WIR_IMPORTED", `${documentId}:${hash.slice(0, 23)}`);
    });
    return { wirId: documentId, documentId, wir, zonesIllisibles: ex.zonesIllisibles };
  }

  /** État = REJEU du journal (WD-10 : ?date= reconstitue source → brut → éditions → visa). */
  async etat(ctx: Ctx, wirId: string, date?: Date) {
    const evs: any[] = await this.prisma.domainEvent.findMany({
      where: { tenantId: ctx.tenantId, aggregateId: wirId,
        type: { in: ["wd.wir.importe", "wd.wir.edite", "wd.wir.ratifie"] } },
      orderBy: { id: "asc" } });
    const jusque = date ? evs.filter((e) => new Date(e.at) <= date) : evs;
    const importe = jusque.find((e) => e.type === "wd.wir.importe");
    if (!importe) throw new NotFoundException("WIR inconnu (aucun import dans le journal à cette date)");
    const p = await this.params(ctx.tenantId);
    const wir: Wir = JSON.parse(JSON.stringify((importe.payload as any).wir));
    for (const e of jusque) {
      const d: any = e.payload;
      if (e.type === "wd.wir.edite") {
        const n = wir.nodes.find((x) => x.id === d.patch.noeud);
        if (n) {
          if (d.patch.label !== undefined) n.label = d.patch.label;
          if (d.patch.ownerRole !== undefined) n.ownerRole = d.patch.ownerRole;
          if (d.patch.slaHours !== undefined) n.slaHours = d.patch.slaHours;
        }
        wir.meta.status = "DRAFT_HUMAN";
        wir.meta.ratifiePar = null;                          // toute édition invalide le visa
      }
      if (e.type === "wd.wir.ratifie") wir.meta.ratifiePar = d.par;
    }
    // PUBLISHED = décision du circuit de versioning existant, jamais d'ici (R436)
    const ratifie = jusque.find((e) => e.type === "wd.wir.ratifie");
    if (ratifie) {
      const def: any = await this.prisma.workflowDef.findUnique({ where: { id: (ratifie.payload as any).defId } })
        .catch(() => null);
      if (def?.statut === "PUBLIEE") wir.meta.status = "PUBLISHED";
    }
    return { wirId, wir, statut: wir.meta.status,
      anomalies: validerWir(wir, p.rolesTenant),
      zonesIllisibles: (importe.payload as any).zonesIllisibles ?? [],
      historique: jusque.map((e) => ({ type: e.type, at: e.at, par: (e.payload as any).par ?? (e.payload as any).wir?.meta?.importePar })) };
  }

  /** PATCH ir — édition HUMAINE : événement append-only, jamais un UPDATE d'état (R49). */
  async editer(ctx: Ctx, wirId: string, patch: { noeud: string; label?: string; ownerRole?: string; slaHours?: number }) {
    const e = await this.etat(ctx, wirId);
    if (e.statut === "PUBLISHED")
      throw new BadRequestException("Version publiée immuable — préparez un nouveau brouillon (R48/R49).");
    if (!e.wir.nodes.some((n) => n.id === patch.noeud))
      throw new BadRequestException(`Nœud « ${patch.noeud} » inconnu du WIR`);
    await this.prisma.$transaction(async (tx: any) => {
      await emitEvent(tx, ctx.tenantId, "wd.wir.edite", wirId, { patch, par: ctx.userId });
      await this.audit.log(ctx.tenantId, ctx.userId, "WD_WIR_EDITED", `${wirId}:${patch.noeud}`);
    });
    return this.etat(ctx, wirId);
  }

  /** POST ratify — visa R15, importeur ≠ ratifieur (R13/R435), anomalies R434 bloquantes ;
   *  la transition vers PUBLISHED passe par le module de versioning EXISTANT (brouillon). */
  async ratifier(ctx: Ctx, wirId: string) {
    const e = await this.etat(ctx, wirId);
    const p = await this.params(ctx.tenantId);
    if (e.statut === "DRAFT_AI")
      throw new BadRequestException("R433 : un brouillon IA doit être pris en main par un humain avant ratification.");
    if (ctx.userId === e.wir.meta.importePar)
      throw new ForbiddenException("R435/R13 : l'importeur ne ratifie pas son propre import (4-yeux).");
    if (ctx.role !== p.roleRatifieur && ctx.role !== "ADMIN")
      throw new ForbiddenException(`Q-WD-2 : ratification réservée au rôle ${p.roleRatifieur}`);
    const bloquantes = e.anomalies.filter((a: AnomalieWir) => a.bloquant);
    if (bloquantes.length)
      throw new BadRequestException(`R434 : ${bloquantes.length} anomalie(s) bloquante(s) — ` +
        bloquantes.map((a) => a.code).join(", "));
    const b: any = await this.defs.creerBrouillon(ctx, {
      code: `WD_${wirId.slice(0, 8).toUpperCase()}`,
      contenu: { etapes: e.wir.nodes.map((n) => n.label), wir: e.wir, hash: e.wir.meta.hashFichier } });
    await this.prisma.$transaction(async (tx: any) => {
      await emitEvent(tx, ctx.tenantId, "wd.wir.ratifie", wirId, { par: ctx.userId, defId: b.defId });
      await this.audit.log(ctx.tenantId, ctx.userId, "WD_WIR_RATIFIED", `${wirId}:${b.defId}`);
    });
    return { wirId, defId: b.defId, ratifiePar: ctx.userId,
      publication: "via Gouvernance → Workflows — Versions & publication (circuit existant, R436)" };
  }
}
