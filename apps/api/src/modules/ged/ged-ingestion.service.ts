import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { emitEvent } from "../../common/domain-event";
import { Tx } from "../../common/tx";

/**
 * Capture & ingestion GED — R137→R139 (IG-01..06). Écrit APRÈS l'amendement, APRÈS les tests.
 * R137 : tout document entre par un canal du registre R-Q (gedCanauxIngestion) ; l'origine
 * (canal, source, opérateur jeton, horodatage) est une PIÈCE du dossier. Arrivée = A_CLASSER.
 * R138 : l'OCR est un PORT (pas de prestataire → refus, jamais de simulacre — pattern R114) ;
 * le contenu soumis est re-vérifié contre l'empreinte (R111) ; le résultat est un DÉRIVÉ
 * versionné attaché à la version — l'original ne bouge jamais (R109). Re-OCR = dérivé ajouté.
 * R139 : la boîte d'arrivée est default-deny (gedInboxRoles, accès ET refus tracés — R112) ;
 * le classement est un acte humain doublement habilité (rôle d'arrivée + rôle sur le TYPE
 * cible) ; SLA d'arrivée (gedInboxSlaJours) alerte UNE fois (R39) — rien ne se classe seul.
 * Paramètres R-Q (au registre — R125) : gedCanauxIngestion ["SCAN","EMAIL","UPLOAD","API"] ·
 * gedInboxRoles ["CO","CF"] · gedInboxSlaJours 2.
 */

type Ctx = { tenantId: string; userId: string; role: string };
type Ports = { ocr?: { moteur: string; lire(contenu: string): Promise<{ texte: string }> } };
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

@Injectable()
export class GedIngestionService {
  constructor(private prisma: PrismaService, private audit: AuditService, private ports: Ports = {}) {}

  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return emitEvent(tx, tenantId, type, aggregateId, payload);
  }
  private async cfg(tx: Tx, tenantId: string) {
    const t = await tx.tenant.findFirst({ where: { id: tenantId } });
    const s = (t?.settings as any) ?? {};
    return { canaux: s.gedCanauxIngestion ?? ["SCAN", "EMAIL", "UPLOAD", "API"],
      inboxRoles: s.gedInboxRoles ?? ["CO", "CF"], slaJours: s.gedInboxSlaJours ?? 2,
      types: s.gedDocTypes ?? [] };
  }

  // ── R137 : l'entrée — canal déclaré, origine pièce du dossier ──
  async ingerer(ctx: Ctx, dto: { canal: string; source: string; nomFichier: string; contenu: string }) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const { canaux } = await this.cfg(tx, ctx.tenantId);
      if (!canaux.includes(dto.canal))
        throw new BadRequestException(`R137 : canal « ${dto.canal} » hors registre R-Q (gedCanauxIngestion)`);
      const at = new Date().toISOString();
      const d = await tx.document.create({ data: { tenantId: ctx.tenantId, clientId: null,
        typeCode: null, nom: dto.nomFichier, statut: "A_CLASSER", legalHold: false,
        destructionProposee: false, retentionUntil: null, ingereAt: at } });
      await tx.documentVersion.create({ data: { tenantId: ctx.tenantId, documentId: d.id,
        numero: 1, sha256: sha(dto.contenu), deposePar: ctx.userId, deposeAt: at,
        anchorBatchId: null, ocrDerives: [] } });
      const e = await tx.gedIngestEntry.create({ data: { tenantId: ctx.tenantId, documentId: d.id,
        canal: dto.canal, source: dto.source, operateur: ctx.userId, at } });
      await this.emit(tx, ctx.tenantId, "ged.ingest", d.id,
        { canal: dto.canal, source: dto.source, par: ctx.userId, nom: dto.nomFichier });
      await this.audit.log(ctx.tenantId, ctx.userId, "GED_INGEST", `${d.id}:${dto.canal}`);
      return { documentId: d.id, ingestId: e.id };
    });
  }

  // ── R138 : l'OCR — port obligatoire, empreinte vérifiée, dérivé versionné ──
  async ocriser(ctx: Ctx, versionId: string, contenu: string) {
    if (!this.ports.ocr)
      throw new BadRequestException("R138 : prestataire OCR non configuré — pas d'extraction simulée");
    return this.prisma.$transaction(async (tx: Tx) => {
      const v = await tx.documentVersion.findFirst({ where: { id: versionId, tenantId: ctx.tenantId } });
      if (!v) throw new NotFoundException("Version introuvable");
      if (sha(contenu) !== v.sha256)
        throw new BadRequestException("R111 : le contenu soumis ne correspond pas à l'empreinte de la version");
      const { texte } = await this.ports.ocr!.lire(contenu);
      const derive = { texte, sha256Derive: sha(texte), moteur: this.ports.ocr!.moteur,
        at: new Date().toISOString() };
      await tx.documentVersion.update({ where: { id: v.id },
        data: { ocrDerives: [...((v.ocrDerives as any[]) ?? []), derive] } });   // AJOUT — jamais de remplacement
      await this.emit(tx, ctx.tenantId, "ged.ocr.derive", v.documentId,
        { versionId: v.id, moteur: derive.moteur, sha256Derive: derive.sha256Derive });
      return derive;
    });
  }

  // ── R139 : l'arrivée — default-deny tracé, classement doublement habilité ──
  private async habiliteInbox(tx: Tx, ctx: Ctx, refDoc?: string) {
    const { inboxRoles } = await this.cfg(tx, ctx.tenantId);
    if (!inboxRoles.includes(ctx.role)) {
      await this.emit(tx, ctx.tenantId, "ged.inbox.acces.refuse", refDoc ?? "inbox",
        { par: ctx.userId, role: ctx.role });
      throw new ForbiddenException(`R139 : rôle ${ctx.role} non habilité sur la boîte d'arrivée`);
    }
  }
  async listerArrivee(ctx: Ctx) {
    await this.habiliteInbox(this.prisma, ctx);
    return this.prisma.document.findMany({ where: { tenantId: ctx.tenantId, statut: "A_CLASSER" } });
  }
  async classer(ctx: Ctx, documentId: string, dto: { typeCode: string; clientId: string }) {
    return this.prisma.$transaction(async (tx: Tx) => {
      await this.habiliteInbox(tx, ctx, documentId);
      const d = await tx.document.findFirst({ where: { id: documentId, tenantId: ctx.tenantId, statut: "A_CLASSER" } });
      if (!d) throw new NotFoundException("Document à classer introuvable");
      const { types } = await this.cfg(tx, ctx.tenantId);
      const typ = types.find((t: any) => t.code === dto.typeCode);
      if (!typ || !(typ.rolesAutorises ?? []).includes(ctx.role))
        throw new ForbiddenException(
          `R112 : classement vers ${dto.typeCode} refusé — le classeur doit être autorisé sur le type cible`);
      // R170 — la rétention naît au classement : le type porte sa durée (retentionAnnees, R-Q).
      // Sans durée : pas d'échéance — GD-11 ne proposera jamais. L'aval est inchangé.
      const retentionUntil = typ.retentionAnnees
        ? new Date(Date.now() + typ.retentionAnnees * 365.25 * 86400000).toISOString() : null;
      await tx.document.update({ where: { id: d.id },
        data: { typeCode: dto.typeCode, clientId: dto.clientId, statut: "ACTIF", retentionUntil } });
      await this.emit(tx, ctx.tenantId, "ged.classement", d.id,
        { typeCode: dto.typeCode, clientId: dto.clientId, par: ctx.userId, retentionUntil });
      await this.audit.log(ctx.tenantId, ctx.userId, "GED_CLASSIFY", `${d.id}:${dto.typeCode}`);
    });
  }
  async tickArrivee(ctx: Ctx, now: Date) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const { slaJours } = await this.cfg(tx, ctx.tenantId);
      const attente = await tx.document.findMany({ where: { tenantId: ctx.tenantId,
        statut: "A_CLASSER", inboxSignale: null } });
      for (const d of attente) {
        const jours = (now.getTime() - new Date(d.ingereAt).getTime()) / 86400000;
        if (jours < slaJours) continue;
        await tx.document.update({ where: { id: d.id }, data: { inboxSignale: true } });
        await this.emit(tx, ctx.tenantId, "ged.inbox.sla", d.id, { jours: Math.floor(jours), sla: slaJours });
        await this.emit(tx, ctx.tenantId, "tache.ged.classement", d.id, { nom: d.nom });
        // Le document RESTE A_CLASSER : rien ne se classe tout seul (R39).
      }
    });
  }
}
