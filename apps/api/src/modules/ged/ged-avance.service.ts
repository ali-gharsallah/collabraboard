import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { Tx } from "../../common/tx";

/**
 * GED avancée — R113→R116 (GD-07..14). Écrit APRÈS l'amendement, APRÈS les tests.
 * Ports injectés (le moteur définit le contrat, l'intégration est un adaptateur Phase 2) :
 *   tsa : { timestamp(racine) → { token, at } }        — horodatage qualifié RFC 3161 (R113)
 *   qes : { signer(sha256, signataire) → { evidenceId, contenuSigne } } — QES ZertES (R114)
 *   ia  : { classifier(contenu) → { type, expirationDetectee } }        — R44 (R116)
 * Invariants : le lot d'ancrage est append-only ; la signature est une VERSION (R109) ;
 * l'échéance propose (R33/R44), la destruction se décide (R7) et conserve la preuve ;
 * le legal hold gèle ; l'IA propose, l'humain applique (R44).
 */

type Ctx = { tenantId: string; userId: string; role: string };
type Ports = { tsa?: any; qes?: any; ia?: any };
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

@Injectable()
export class GedAvanceService {
  constructor(private prisma: PrismaService, private audit: AuditService, private ports: Ports = {}) {}

  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload } });
  }
  private async doc(tx: Tx, ctx: Ctx, id: string) {
    const d = await tx.document.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!d) throw new NotFoundException("Document introuvable");
    return d;
  }

  // ── Merkle : feuilles triées, appariement sha(g+d), impair → duplication du dernier ──
  private merkle(feuilles: string[]): { racine: string; chemins: Map<string, { hash: string; cote: "G" | "D" }[]> } {
    const tri = feuilles.slice().sort();
    const chemins = new Map<string, { hash: string; cote: "G" | "D" }[]>();
    tri.forEach((f) => chemins.set(f, []));
    let niveau = tri.map((h) => ({ hash: h, feuilles: [h] }));
    while (niveau.length > 1) {
      const next: { hash: string; feuilles: string[] }[] = [];
      for (let i = 0; i < niveau.length; i += 2) {
        const g = niveau[i], d = niveau[i + 1] ?? niveau[i];
        for (const f of g.feuilles) chemins.get(f)!.push({ hash: d.hash, cote: "D" });
        if (d !== g) for (const f of d.feuilles) chemins.get(f)!.push({ hash: g.hash, cote: "G" });
        next.push({ hash: sha(g.hash + d.hash), feuilles: [...g.feuilles, ...(d !== g ? d.feuilles : [])] });
      }
      niveau = next;
    }
    return { racine: niveau[0]?.hash ?? "", chemins };
  }
  /** Vérification pure d'un chemin — utilisable par un tiers sans faire confiance à O-Live. */
  verifierChemin(feuille: string, chemin: { hash: string; cote: "G" | "D" }[], racine: string): boolean {
    let h = feuille;
    for (const e of chemin) h = e.cote === "D" ? sha(h + e.hash) : sha(e.hash + h);
    return h === racine;
  }

  // ── R113 / GD-07 : le lot du jour s'ancre, une fois ──
  async tickAncrage(ctx: Ctx) {
    if (!this.ports.tsa) throw new BadRequestException("R113 : port TSA non configuré");
    return this.prisma.$transaction(async (tx: Tx) => {
      const nonAncrees = await tx.documentVersion.findMany({ where: { tenantId: ctx.tenantId, anchorBatchId: null } });
      if (nonAncrees.length === 0) return { lot: null, versions: 0 };
      const { racine, chemins } = this.merkle(nonAncrees.map((v: any) => v.sha256));
      const horodatage = await this.ports.tsa.timestamp(racine);
      const lot = await tx.anchorBatch.create({ data: { tenantId: ctx.tenantId,
        racineMerkle: racine, tsaToken: horodatage.token, tsaAt: horodatage.at, nbVersions: nonAncrees.length } });
      for (const v of nonAncrees) {
        await tx.documentVersion.update({ where: { id: v.id },
          data: { anchorBatchId: lot.id, merkleProof: chemins.get(v.sha256) ?? [] } });
      }
      await this.emit(tx, ctx.tenantId, "ged.ancrage.cree", lot.id,
        { racine, tsaToken: horodatage.token, versions: nonAncrees.length });
      await this.audit.log(ctx.tenantId, ctx.userId, "GED_ANCHORED", `${lot.id}:${nonAncrees.length}`);
      return { lot: lot.id, versions: nonAncrees.length };
    });
  }

  // ── R113 / GD-08 : la preuve d'appartenance ──
  async verifierPreuve(ctx: Ctx, versionId: string) {
    const v = await this.prisma.documentVersion.findFirst({ where: { id: versionId, tenantId: ctx.tenantId } });
    if (!v) throw new NotFoundException("Version introuvable");
    if (!v.anchorBatchId) return { valide: false, motif: "non ancrée" };
    const lot = await this.prisma.anchorBatch.findFirst({ where: { id: v.anchorBatchId, tenantId: ctx.tenantId } });
    const valide = this.verifierChemin(v.sha256,
      (v.merkleProof ?? []) as { hash: string; cote: "G" | "D" }[], lot.racineMerkle);   // champ Json → type du chemin Merkle
    return { valide, racine: lot.racineMerkle, chemin: v.merkleProof ?? [], tsaToken: lot.tsaToken, tsaAt: lot.tsaAt };
  }

  // ── R114 / GD-09..10 : la signature qualifiée est une version — jamais un simulacre ──
  async demanderSignature(ctx: Ctx, documentId: string, signataire: string) {
    if (!this.ports.qes) throw new BadRequestException("R114 : prestataire QES non configuré — pas de signature simulée");
    return this.prisma.$transaction(async (tx: Tx) => {
      const d = await this.doc(tx, ctx, documentId);
      const derniere = await tx.documentVersion.findFirst({
        where: { tenantId: ctx.tenantId, documentId: d.id }, orderBy: { numero: "desc" } });
      if (!derniere) throw new NotFoundException("Aucune version à signer");
      const preuve = await this.ports.qes.signer(derniere.sha256, signataire);
      const v = await tx.documentVersion.create({ data: { tenantId: ctx.tenantId, documentId: d.id,
        numero: derniere.numero + 1, sha256: sha(preuve.contenuSigne),
        deposePar: ctx.userId, deposeAt: new Date().toISOString(), anchorBatchId: null,
        signature: { signataire, evidenceId: preuve.evidenceId, surVersion: derniere.numero } } });
      await this.emit(tx, ctx.tenantId, "ged.signature.qualifiee", d.id,
        { version: v.numero, signataire, evidenceId: preuve.evidenceId });
      await this.audit.log(ctx.tenantId, ctx.userId, "GED_QES", `${d.id}:v${v.numero}`);
      return v;
    });
  }

  // ── R115 / GD-11 : l'échéance propose — une fois — et ne détruit pas ──
  async tickRetention(ctx: Ctx, now: Date) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const echus = await tx.document.findMany({ where: { tenantId: ctx.tenantId,
        statut: "ACTIF", legalHold: false, destructionProposee: false, retentionUntil: { lte: now.toISOString() } } });
      for (const d of echus) {
        await tx.document.update({ where: { id: d.id }, data: { destructionProposee: true } });
        await this.emit(tx, ctx.tenantId, "ged.destruction.proposee", d.id,
          { retentionUntil: d.retentionUntil, type: d.typeCode });
        await this.emit(tx, ctx.tenantId, "tache.ged.destruction", d.id, { client: d.clientId });
        // Le statut reste ACTIF : la destruction est une DÉCISION, jamais une échéance (R33/R44).
      }
    });
  }

  // ── R115 / GD-12 : destruction certifiée — le contenu part, la preuve reste ──
  async detruire(ctx: Ctx, documentId: string, motif: string) {
    if (!motif || !motif.trim()) throw new BadRequestException("R7 : la destruction exige un motif");
    return this.prisma.$transaction(async (tx: Tx) => {
      const d = await this.doc(tx, ctx, documentId);
      if (d.legalHold) throw new ForbiddenException(`legal hold actif : ${d.holdMotif ?? "destruction gelée"}`);
      const versions = await tx.documentVersion.findMany({ where: { tenantId: ctx.tenantId, documentId: d.id } });
      await tx.document.update({ where: { id: d.id }, data: { statut: "DETRUIT",
        destructionMotif: motif.trim(), destructionPar: ctx.userId, destructionAt: new Date().toISOString() } });
      // Le CONTENU (S3) est purgé par l'adaptateur de stockage ; les métadonnées et les
      // empreintes SUBSISTENT — on prouve ce qui a existé, quand et pourquoi c'est parti.
      await this.emit(tx, ctx.tenantId, "ged.destruction.certifiee", d.id,
        { motif: motif.trim(), par: ctx.userId, empreintes: versions.map((v: any) => v.sha256) });
      await this.audit.log(ctx.tenantId, ctx.userId, "GED_DESTROYED", d.id);
    });
  }

  // ── R115 / GD-13 : le legal hold gèle tout — pose et levée motivées ──
  async poserHold(ctx: Ctx, clientId: string, motif: string) {
    if (!motif || !motif.trim()) throw new BadRequestException("R7 : le legal hold exige un motif");
    return this.prisma.$transaction(async (tx: Tx) => {
      const docs = await tx.document.findMany({ where: { tenantId: ctx.tenantId, clientId } });
      for (const d of docs) await tx.document.update({ where: { id: d.id },
        data: { legalHold: true, holdMotif: motif.trim() } });
      await this.emit(tx, ctx.tenantId, "ged.hold.pose", clientId, { motif: motif.trim(), par: ctx.userId, docs: docs.length });
    });
  }
  async leverHold(ctx: Ctx, clientId: string, motif: string) {
    if (!motif || !motif.trim()) throw new BadRequestException("R7 : la levée du hold exige un motif");
    return this.prisma.$transaction(async (tx: Tx) => {
      const docs = await tx.document.findMany({ where: { tenantId: ctx.tenantId, clientId, legalHold: true } });
      for (const d of docs) await tx.document.update({ where: { id: d.id },
        data: { legalHold: false, holdMotif: null } });
      await this.emit(tx, ctx.tenantId, "ged.hold.leve", clientId, { motif: motif.trim(), par: ctx.userId, docs: docs.length });
      await this.audit.log(ctx.tenantId, ctx.userId, "GED_HOLD_LIFTED", clientId);
    });
  }

  // ── R116 / GD-14 : l'IA propose (événement), l'humain applique (jeton) ──
  async classifier(ctx: Ctx, documentId: string, contenu: string) {
    if (!this.ports.ia) throw new BadRequestException("R116 : port IA non configuré");
    return this.prisma.$transaction(async (tx: Tx) => {
      const d = await this.doc(tx, ctx, documentId);
      const prop = await this.ports.ia.classifier(contenu);
      await this.emit(tx, ctx.tenantId, "ged.classification.proposee", d.id,
        { type: prop.type, expirationDetectee: prop.expirationDetectee ?? null, source: "ia" });
      return prop;                                     // RIEN n'est appliqué ici (R44)
    });
  }
  async confirmerClassification(ctx: Ctx, documentId: string, type: string) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const d = await this.doc(tx, ctx, documentId);
      await tx.document.update({ where: { id: d.id }, data: { typeCode: type } });
      await this.emit(tx, ctx.tenantId, "ged.classification.confirmee", d.id, { type, par: ctx.userId });
      await this.audit.log(ctx.tenantId, ctx.userId, "GED_CLASSIFIED", `${d.id}:${type}`);
    });
  }
}
