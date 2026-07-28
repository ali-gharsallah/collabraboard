import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { emitEvent } from "../../common/domain-event";
import { Tx } from "../../common/tx";

/**
 * L'IA au service du dossier — R160→R163 (AI-01..06). Écrit APRÈS l'amendement, APRÈS les
 * tests. Thèse : l'IA est SOUS les contrôles — habilitée comme un employé, tracée comme un
 * acte, désavouable comme une proposition.
 * R160 : l'IA n'a pas de droits propres — le contexte servi passe par le MÊME filtre que la
 * recherche (types R112, inbox R139, existence R149) ; tenant structurel ; la trace
 * référence (empreintes, ids), elle ne recopie pas.
 * R161 : toute production est un DÉRIVÉ signé (modèle, version, shaContexte, shaSortie) —
 * rejouable, vérifiable, jamais une vérité (pattern R148).
 * R162 : l'IA propose, l'humain dispose — la proposition n'applique RIEN ; la décision est
 * un acte jeton ; le rejet se motive (R7) et se MESURE comme écart (R39).
 * R163 : le prestataire est un PORT — pas de port = refus (pattern R114, jamais de réponse
 * simulée) ; sa résidence déclarée doit égaler le paramètre tenant iaResidence (défaut CH).
 */

type Ctx = { tenantId: string; userId: string; role: string };
export type IaPort = { modele: string; version: string; residence: string;
  completer(question: string, contexte: string[]): Promise<{ texte: string; confiance?: number }> };
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

@Injectable()
export class IaGedService {
  constructor(private prisma: PrismaService, private audit: AuditService,
    private ports: { ia?: IaPort } = {}) {}

  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return emitEvent(tx, tenantId, type, aggregateId, payload);
  }
  private async cfg(tx: Tx, tenantId: string) {
    const t = await tx.tenant.findFirst({ where: { id: tenantId } });
    const s = (t?.settings as any) ?? {};
    return { types: s.gedDocTypes ?? [], inboxRoles: s.gedInboxRoles ?? ["CO", "CF"],
      residence: s.iaResidence ?? "CH" };
  }
  private async portOuRefus(tx: Tx, ctx: Ctx): Promise<IaPort> {
    if (!this.ports.ia)
      throw new BadRequestException("R163 : aucun prestataire IA configuré — pas de réponse simulée");
    const { residence } = await this.cfg(tx, ctx.tenantId);
    if (this.ports.ia.residence !== residence) {
      await this.emit(tx, ctx.tenantId, "ia.acces.refuse", "ia",
        { motif: "résidence", exigee: residence, declaree: this.ports.ia.residence, par: ctx.userId });
      throw new ForbiddenException(
        `R163 : résidence du prestataire (${this.ports.ia.residence}) ≠ exigence tenant (${residence}) — rien n'est servi`);
    }
    return this.ports.ia;
  }

  /** R160 — le contexte du dossier, filtré par l'habilitation DU CONVOCATEUR. */
  private async contexte(tx: Tx, ctx: Ctx, clientId: string) {
    const { types, inboxRoles } = await this.cfg(tx, ctx.tenantId);
    const docs = await tx.document.findMany({ where: { tenantId: ctx.tenantId, clientId } });
    const servis: Array<{ id: string; texte: string }> = [];
    for (const d of docs) {
      const visible = d.statut === "A_CLASSER"
        ? inboxRoles.includes(ctx.role)
        : !!types.find((t: any) => t.code === d.typeCode && (t.rolesAutorises ?? []).includes(ctx.role));
      if (!visible || d.statut === "DETRUIT") continue;
      const versions = await tx.documentVersion.findMany({ where: { tenantId: ctx.tenantId, documentId: d.id } });
      const derniere = versions.sort((a: any, b: any) => b.numero - a.numero)
        .find((v: any) => ((v.ocrDerives ?? []) as any[]).length);
      if (!derniere) continue;
      const der = (derniere.ocrDerives as any[])[(derniere.ocrDerives as any[]).length - 1];
      servis.push({ id: d.id, texte: `${d.nom ?? d.id} : ${der.texte}` });
    }
    return servis;
  }

  // ── R160/R161/R163 : interroger ──
  async interroger(ctx: Ctx, clientId: string, question: string) {
    if (!question || !question.trim()) throw new BadRequestException("Question vide");
    return this.prisma.$transaction(async (tx: Tx) => {
      const port = await this.portOuRefus(tx, ctx);
      const servis = await this.contexte(tx, ctx, clientId);
      const textes = servis.map((s) => s.texte);
      const shaContexte = sha256(textes.join("\n---\n"));
      const { texte, confiance } = await port.completer(question.trim(), textes);
      const prod = await tx.iaProduction.create({ data: { tenantId: ctx.tenantId,
        type: "REPONSE", cible: clientId, question: question.trim(),
        modele: port.modele, versionModele: port.version,
        shaContexte, shaSortie: sha256(texte), sortie: texte, confiance: confiance ?? null,
        par: ctx.userId, at: new Date().toISOString(),
        decision: null, decidePar: null, decideAt: null, decisionMotif: null } });
      // La trace RÉFÉRENCE : ids + empreintes — jamais les contenus (R160).
      await this.emit(tx, ctx.tenantId, "ia.production", prod.id,
        { par: ctx.userId, role: ctx.role, docsServis: servis.map((s) => s.id),
          shaContexte, shaSortie: prod.shaSortie, modele: port.modele });
      await this.audit.log(ctx.tenantId, ctx.userId, "AI_QUERY", clientId);
      return { productionId: prod.id, reponse: texte };
    });
  }

  // ── R162 : proposer — n'applique RIEN ──
  async proposerClassement(ctx: Ctx, documentId: string) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const port = await this.portOuRefus(tx, ctx);
      const d = await tx.document.findFirst({ where: { id: documentId, tenantId: ctx.tenantId } });
      if (!d) throw new NotFoundException("Document introuvable");
      const versions = await tx.documentVersion.findMany({ where: { tenantId: ctx.tenantId, documentId } });
      const v = versions.find((x: any) => ((x.ocrDerives ?? []) as any[]).length);
      if (!v) throw new BadRequestException("R148 : rien à proposer — aucun dérivé OCR");
      const der = (v.ocrDerives as any[])[(v.ocrDerives as any[]).length - 1];
      const { texte, confiance } = await port.completer("Propose un type de classement", [der.texte]);
      const prod = await tx.iaProduction.create({ data: { tenantId: ctx.tenantId,
        type: "PROPOSITION", cible: documentId, question: "CLASSEMENT",
        modele: port.modele, versionModele: port.version,
        shaContexte: sha256(der.texte), shaSortie: sha256(texte), sortie: texte,
        confiance: confiance ?? null, par: ctx.userId, at: new Date().toISOString(),
        decision: null, decidePar: null, decideAt: null, decisionMotif: null } });
      await this.emit(tx, ctx.tenantId, "ia.proposition", prod.id,
        { documentId, confiance: confiance ?? null, par: ctx.userId });
      // VOLONTAIREMENT : aucun update du document — l'IA propose, l'humain dispose (AI-04).
      return { propositionId: prod.id, proposition: texte, confiance };
    });
  }

  // ── R162 : décider — l'acte est humain ──
  async decider(ctx: Ctx, propositionId: string, decision: "ACCEPTEE" | "REJETEE", motif?: string) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const prod = await tx.iaProduction.findFirst({ where: { id: propositionId, tenantId: ctx.tenantId, type: "PROPOSITION" } });
      if (!prod) throw new NotFoundException("Proposition introuvable");
      if (prod.decision) throw new BadRequestException("Proposition déjà décidée — la décision ne se rejoue pas");
      if (decision === "REJETEE" && (!motif || !motif.trim()))
        throw new BadRequestException("R7 : le rejet d'une proposition IA se motive");
      const at = new Date().toISOString();
      await tx.iaProduction.update({ where: { id: prod.id },
        data: { decision, decidePar: ctx.userId, decideAt: at, decisionMotif: motif?.trim() ?? null } });
      await this.emit(tx, ctx.tenantId, "ia.decision", prod.id,
        { decision, par: ctx.userId, motif: motif?.trim() ?? null });
      if (decision === "REJETEE")
        await this.emit(tx, ctx.tenantId, "ia.ecart", prod.id,
          { confiance: prod.confiance, motif: motif!.trim() });   // mesuré, jamais coercé (R39)
      await this.audit.log(ctx.tenantId, ctx.userId, "AI_DECIDE", `${prod.id}:${decision}`);
    });
  }
}
