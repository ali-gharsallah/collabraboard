import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";

/**
 * GED — documents & preuve. R109→R112 (GD-01..06). Écrit APRÈS l'amendement, APRÈS les tests.
 * Invariants tenus : versions append-only, jamais de suppression physique (R109, cohérence R35) ;
 * péremption constatée par tick — la complétude se vérifie AUX POINTS DE PASSAGE et c'est le
 * moteur appelant qui bloque (R110, R39) ; intégrité prouvée à la restitution (R111, R48) ;
 * accès default-deny et tracé — « qui a vu quoi » rejouable (R112, R48/R49).
 * Référentiel tenant (voie R-Q) : Tenant.settings.gedDocTypes[] =
 *   { code, validiteMois|null, requisPour[], rolesAutorises[] }.
 */

type Ctx = { tenantId: string; userId: string; role: string };
const MOIS_MS = 30.44 * 86400000;
const TYPES_DEFAUT = [
  { code: "PASSEPORT", validiteMois: 120, requisPour: ["KYC_VALIDATION"], rolesAutorises: ["RM", "CO", "CF"] },
  { code: "REGISTRE", validiteMois: 12, requisPour: ["KYC_VALIDATION"], rolesAutorises: ["RM", "CO", "CF"] },
  { code: "FORM_CDB", validiteMois: null, requisPour: ["KYC_VALIDATION"], rolesAutorises: ["RM", "CO", "CF"] },
  { code: "FISCAL", validiteMois: null, requisPour: [], rolesAutorises: ["CO", "CF"] },
];

@Injectable()
export class GedService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private emit(tx: any, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload } });
  }
  private async types(tx: any, tenantId: string): Promise<any[]> {
    const t = await tx.tenant.findFirst({ where: { id: tenantId } });
    return ((t?.settings as any)?.gedDocTypes) ?? TYPES_DEFAUT;
  }
  private sha(contenu: string) { return createHash("sha256").update(contenu).digest("hex"); }
  private async doc(tx: any, ctx: Ctx, id: string) {
    const d = await tx.document.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!d) throw new NotFoundException("Document introuvable");
    return d;
  }
  private expiree(v: any, typ: any, now: Date) {
    if (!typ?.validiteMois) return false;
    return now.getTime() - new Date(v.deposeAt).getTime() > typ.validiteMois * MOIS_MS;
  }

  // ── R109/R111 : dépôt — nouveau document OU nouvelle version, empreinte au dépôt ──
  async deposer(ctx: Ctx, dto: { documentId?: string; clientId?: string; kycFileId?: string; personId?: string;
    typeCode?: string; nom?: string; contenu: string }) {
    return this.prisma.$transaction(async (tx: any) => {
      let d: any;
      if (dto.documentId) {
        d = await this.doc(tx, ctx, dto.documentId);
      } else {
        d = await tx.document.create({ data: { tenantId: ctx.tenantId, clientId: dto.clientId,
          kycFileId: dto.kycFileId ?? null, personId: dto.personId ?? null,
          typeCode: dto.typeCode, nom: dto.nom, statut: "ACTIF", expirationSignalee: false } });
      }
      const derniere = await tx.documentVersion.findFirst({
        where: { tenantId: ctx.tenantId, documentId: d.id }, orderBy: { numero: "desc" } });
      const numero = (derniere?.numero ?? 0) + 1;
      const empreinte = this.sha(dto.contenu);
      await tx.documentVersion.create({ data: { tenantId: ctx.tenantId, documentId: d.id,
        numero, sha256: empreinte, deposePar: ctx.userId, deposeAt: new Date().toISOString() } });
      if (numero > 1)                                                     // re-dépôt : réarme la péremption
        await tx.document.update({ where: { id: d.id }, data: { expirationSignalee: false } });
      await this.emit(tx, ctx.tenantId, "ged.version.creee", d.id,
        { numero, sha256: empreinte, deposant: ctx.userId, type: d.typeCode });
      await this.audit.log(ctx.tenantId, ctx.userId, "GED_VERSION_CREATED", `${d.id}:v${numero}`);
      return d;
    });
  }

  // ── R109 : archivage logique motivé — jamais de suppression physique ──
  async archiver(ctx: Ctx, documentId: string, motif: string) {
    if (!motif || !motif.trim())
      throw new BadRequestException("R7 : l'archivage d'un document exige un motif");
    return this.prisma.$transaction(async (tx: any) => {
      const d = await this.doc(tx, ctx, documentId);
      await tx.document.update({ where: { id: d.id }, data: {
        statut: "ARCHIVE", archiveMotif: motif.trim(), archivePar: ctx.userId, archiveAt: new Date().toISOString() } });
      await this.emit(tx, ctx.tenantId, "ged.archive", d.id, { motif: motif.trim(), par: ctx.userId });
      await this.audit.log(ctx.tenantId, ctx.userId, "GED_ARCHIVED", d.id);
    });
  }

  // ── R110 : le tick constate l'expiration — une fois — et ne bloque rien ──
  async tickPeremptions(ctx: Ctx, now: Date) {
    return this.prisma.$transaction(async (tx: any) => {
      const types = await this.types(tx, ctx.tenantId);
      const docs = await tx.document.findMany({ where: {
        tenantId: ctx.tenantId, statut: "ACTIF", expirationSignalee: false } });
      for (const d of docs) {
        const typ = types.find((t: any) => t.code === d.typeCode);
        const v = await tx.documentVersion.findFirst({
          where: { tenantId: ctx.tenantId, documentId: d.id }, orderBy: { numero: "desc" } });
        if (!v || !this.expiree(v, typ, now)) continue;
        await tx.document.update({ where: { id: d.id }, data: { expirationSignalee: true } });
        await this.emit(tx, ctx.tenantId, "ged.expiration.detectee", d.id,
          { type: d.typeCode, deposeAt: v.deposeAt, validiteMois: typ.validiteMois });
        await this.emit(tx, ctx.tenantId, "tache.ged.renouvellement", d.id, { type: d.typeCode, client: d.clientId });
        // Le statut reste ACTIF : le tick mesure et notifie (R39), il ne retire rien.
      }
    });
  }

  // ── R110 : complétude au point de passage — la GED constate, l'appelant bloque ──
  async verifierCompletude(ctx: Ctx, clientId: string, passage: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const types = await this.types(tx, ctx.tenantId);
      const requis = types.filter((t: any) => (t.requisPour ?? []).includes(passage));
      const now = new Date();
      const manquants: string[] = []; const expires: string[] = [];
      for (const typ of requis) {
        const d = await tx.document.findFirst({ where: {
          tenantId: ctx.tenantId, clientId, typeCode: typ.code, statut: "ACTIF" } });
        if (!d) { manquants.push(typ.code); continue; }
        const v = await tx.documentVersion.findFirst({
          where: { tenantId: ctx.tenantId, documentId: d.id }, orderBy: { numero: "desc" } });
        if (!v || this.expiree(v, typ, now)) expires.push(typ.code);
      }
      const complet = manquants.length === 0 && expires.length === 0;
      await this.emit(tx, ctx.tenantId, "ged.completude.verifiee", clientId,
        { passage, complet, manquants, expires });
      return { complet, manquants, expires };
    });
  }

  // ── R111/R112 : restitution — accès default-deny tracé, intégrité prouvée ──
  async restituer(ctx: Ctx, documentId: string, contenu: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const d = await this.doc(tx, ctx, documentId);
      const types = await this.types(tx, ctx.tenantId);
      const typ = types.find((t: any) => t.code === d.typeCode);
      if (!typ || !(typ.rolesAutorises ?? []).includes(ctx.role)) {       // DEFAULT-DENY (type inconnu inclus)
        await this.emit(tx, ctx.tenantId, "ged.acces.refuse", d.id,
          { lecteur: ctx.userId, role: ctx.role, type: d.typeCode });
        throw new ForbiddenException(`Accès non autorisé au type ${d.typeCode} pour le rôle ${ctx.role}`);
      }
      const v = await tx.documentVersion.findFirst({
        where: { tenantId: ctx.tenantId, documentId: d.id }, orderBy: { numero: "desc" } });
      if (!v) throw new NotFoundException("Aucune version");
      const empreinte = this.sha(contenu);
      if (empreinte !== v.sha256) {                                       // R111
        await this.emit(tx, ctx.tenantId, "ged.integrite.alerte", d.id,
          { version: v.numero, attendu: v.sha256, obtenu: empreinte });
        throw new BadRequestException("Intégrité : altération détectée — restitution refusée comme authentique");
      }
      await this.emit(tx, ctx.tenantId, "ged.acces", d.id,
        { lecteur: ctx.userId, role: ctx.role, version: v.numero });      // R112 : qui a vu quoi
      await this.audit.log(ctx.tenantId, ctx.userId, "GED_READ", `${d.id}:v${v.numero}`);
      return { integrite: "OK", sha256: v.sha256, version: v.numero, statut: d.statut };
    });
  }
}
