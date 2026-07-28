import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { emitEvent } from "../../common/domain-event";
import { Tx } from "../../common/tx";

/**
 * Agent de pré-revue IA — R121→R124 (AG-01..06). Écrit APRÈS l'amendement, APRÈS les tests.
 * Invariants tenus : l'agent LIT et PROPOSE, il n'écrit jamais sur le dossier (R121/R44) ;
 * chaque pré-revue est rejouable — empreinte d'entrée, modèle, version du prompt, sortie,
 * latence, append-only (R122/R48/R49) ; l'humain traite ou écarte (motif R7), le blocage avant
 * visa n'existe que si le tenant l'exige — le service constate, le moteur appelant bloque
 * (R123, mécanique R110) ; l'instantané est minimisé et pseudonymisé par défaut, le prompt
 * système est versionné en registre append-only (R124).
 * Paramètres tenant (R-Q) : iaPrerevueTraitementRequis (false) · iaPseudonymise (true).
 * Réflexe R119 : les statuts KYC viennent de l'enum réelle — jamais de mémoire.
 */

type Ctx = { tenantId: string; userId: string; role: string };
type PortIa = { prerevue(snapshot: any, prompt: string): Promise<{ modele: string; points: any[] }> };
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const PROMPT_DEFAUT = "Tu es le pré-lecteur compliance O-Live. Analyse le dossier et liste, en JSON, " +
  "les points MANQUANT / CONTRADICTION / QUESTION rattachés aux sections. Tu proposes, tu ne décides pas.";

@Injectable()
export class PreRevueService {
  constructor(private prisma: PrismaService, private audit: AuditService,
              private ports: { ia?: PortIa } = {}) {}

  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return emitEvent(tx, tenantId, type, aggregateId, payload);
  }
  private async settings(tx: Tx, tenantId: string) {
    const t = await tx.tenant.findFirst({ where: { id: tenantId } });
    const s = (t?.settings as any) ?? {};
    return { traitementRequis: s.iaPrerevueTraitementRequis ?? false, pseudonymise: s.iaPseudonymise ?? true };
  }
  private async promptCourant(tx: Tx, tenantId: string) {
    const v = await tx.iaPromptVersion.findFirst({ where: { tenantId }, orderBy: { numero: "desc" } });
    return v ?? { numero: 0, texte: PROMPT_DEFAUT };
  }

  // ── R121/R122/R124 : la pré-revue — lecture minimisée, trace rejouable, dossier intact ──
  async demander(ctx: Ctx, kycFileId: string) {
    if (!this.ports.ia) throw new BadRequestException("R121 : port IA non configuré — fonction absente");
    return this.prisma.$transaction(async (tx: Tx) => {
      const kyc = await tx.kycFile.findFirst({ where: { id: kycFileId, tenantId: ctx.tenantId } });
      if (!kyc) throw new NotFoundException("Dossier KYC introuvable");
      // Anomalie A3 SOLDÉE (ratification 2026-07-28) : les sections se lisent par kycFileId
      // (le tenant est déjà prouvé par le dossier ci-dessus — kyc_sections n'a pas de colonne
      // tenant) et les « réponses » sont les QUESTIONS réelles du schéma — l'ancien code
      // (tenantId inconnu + champs fantômes) crashait sur Prisma réel, chemin jamais couvert.
      const sections = await tx.kycSection.findMany({ where: { kycFileId }, include: { questions: true } });
      const cfg = await this.settings(tx, ctx.tenantId);
      // Minimisation (R124) : le dossier concerné, rien d'autre ; nom pseudonymisé par défaut
      const alias = "CLIENT-" + sha(ctx.tenantId + ":" + kycFileId).slice(0, 8);   // alias STABLE
      const clientRow = cfg.pseudonymise ? null
        : await tx.client.findFirst({ where: { id: kyc.clientId, tenantId: ctx.tenantId } });
      const snapshot = {
        client: cfg.pseudonymise ? alias : (clientRow?.name ?? alias),
        statut: kyc.status, risque: kyc.riskLevel,
        sections: sections.map((s: any) => ({ code: s.code,
          reponses: (s.questions ?? []).map((q: any) => ({ code: q.code, valeur: q.answer ?? null })) })),
      };
      const prompt = await this.promptCourant(tx, ctx.tenantId);
      const t0 = Date.now();
      const sortie = await this.ports.ia!.prerevue(snapshot, prompt.texte);
      const pr = await tx.iaPrerevue.create({ data: { tenantId: ctx.tenantId, kycFileId,
        snapshotSha256: sha(JSON.stringify(snapshot)), modele: sortie.modele,
        promptVersion: prompt.numero, latenceMs: Date.now() - t0,
        points: sortie.points.map((p: any) => ({ ...p, traitement: null })),   // append-only ; traitements tracés dedans
        at: new Date().toISOString() } });
      await this.emit(tx, ctx.tenantId, "ia.prerevue.produite", kycFileId,
        { prerevueId: pr.id, points: sortie.points.length, modele: sortie.modele });
      await this.audit.log(ctx.tenantId, ctx.userId, "IA_PREREVIEW", `${kycFileId}:${pr.id}`);
      // AUCUNE écriture sur kyc/sections/visas (R121/R44).
      return { prerevueId: pr.id, points: sortie.points };
    });
  }

  // ── R122 : relecture telle quelle — jamais de nouvel appel au port ──
  async relire(ctx: Ctx, prerevueId: string) {
    const pr = await this.prisma.iaPrerevue.findFirst({ where: { id: prerevueId, tenantId: ctx.tenantId } });
    if (!pr) throw new NotFoundException("Pré-revue introuvable");
    return { snapshotSha256: pr.snapshotSha256, modele: pr.modele, promptVersion: pr.promptVersion,
      points: pr.points, latenceMs: pr.latenceMs, at: pr.at };
  }

  // ── R123 : l'humain dispose — traiter ou écarter (motivé) ──
  async traiterPoint(ctx: Ctx, prerevueId: string, index: number, statut: "TRAITE" | "ECARTE", motif?: string) {
    if (statut === "ECARTE" && !(motif && motif.trim()))
      throw new BadRequestException("R7 : écarter un point de pré-revue exige un motif");
    return this.prisma.$transaction(async (tx: Tx) => {
      const pr = await tx.iaPrerevue.findFirst({ where: { id: prerevueId, tenantId: ctx.tenantId } });
      if (!pr || !pr.points[index]) throw new NotFoundException("Point introuvable");
      const points = (pr.points as any[]).slice();
      points[index] = { ...points[index], traitement: { statut, motif: motif?.trim() ?? null,
        par: ctx.userId, at: new Date().toISOString() } };
      await tx.iaPrerevue.update({ where: { id: pr.id }, data: { points } });
      await this.emit(tx, ctx.tenantId, statut === "TRAITE" ? "ia.point.traite" : "ia.point.ecarte",
        pr.kycFileId, { prerevueId, index, type: pr.points[index].type,
          ...(motif ? { motif: motif.trim() } : {}), par: ctx.userId });
    });
  }

  // ── R123 : le service CONSTATE, le moteur KYC appelant bloque (mécanique R110) ──
  async verifierTraitement(ctx: Ctx, kycFileId: string) {
    const cfg = await this.settings(this.prisma, ctx.tenantId);
    const prs = await this.prisma.iaPrerevue.findMany({ where: { tenantId: ctx.tenantId, kycFileId } });
    const ouverts: any[] = [];
    for (const pr of prs) for (const [i, pt] of (pr.points as any[]).entries())
      if (!pt.traitement) ouverts.push({ prerevueId: pr.id, index: i, type: pt.type, section: pt.section });
    return { bloquant: cfg.traitementRequis && ouverts.length > 0, ouverts };
  }

  // ── R124 : le prompt est une règle — versionné, tracé, jamais modifié en silence ──
  async versionnerPrompt(ctx: Ctx, texte: string) {
    if (!texte || !texte.trim()) throw new BadRequestException("Prompt vide");
    return this.prisma.$transaction(async (tx: Tx) => {
      const courant = await this.promptCourant(tx, ctx.tenantId);
      const v = await tx.iaPromptVersion.create({ data: { tenantId: ctx.tenantId,
        numero: courant.numero + 1, texte: texte.trim(), par: ctx.userId, at: new Date().toISOString() } });
      await this.emit(tx, ctx.tenantId, "ia.prompt.versionne", "prompt",
        { numero: v.numero, par: ctx.userId });
      await this.audit.log(ctx.tenantId, ctx.userId, "IA_PROMPT_VERSIONED", `v${v.numero}`);
      return v;
    });
  }
}
