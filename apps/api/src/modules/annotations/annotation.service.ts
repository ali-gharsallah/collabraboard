import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { Tx } from "../../common/tx";

/**
 * Annotations & caviardage — le regard sans la plume. R156→R159 (AN-01..06). Écrit APRÈS
 * l'amendement, APRÈS les tests. Écart Therefore n° 3 — le dernier : chez eux annoter écrit
 * dans le document ; chez nous L'ORIGINAL EST INTOUCHABLE.
 * R156 : l'annotation est un CALQUE (table séparée, référence doc/version/ancre, signée) —
 * l'empreinte de l'original est identique avant/après ; retrait motivé (R7) + tracé.
 * R157 : annoter est habilité (annotationRoles, default-deny tracé) ; cercle PRIVEE|DOSSIER ;
 * le filtre s'applique AU RÉSULTAT — une annotation ne fuite jamais à qui ne voit pas le
 * document (pattern R149 : l'existence est une information).
 * R158 : caviarder = zones MOTIVÉES (base légale) → NOUVEAU dérivé (empreinte propre +
 * empreinte source chaînée) ; habilitation dédiée (caviardageRoles) ; l'original demeure.
 * R159 : la divulgation ne sert QUE le caviardé — événement (destinataire, id, empreinte :
 * on prouve après coup ce qui est sorti) ; l'original par cette voie = refus. Le défaut protège.
 */

type Ctx = { tenantId: string; userId: string; role: string };
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

@Injectable()
export class AnnotationService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload, at: new Date().toISOString() } });
  }
  private async cfg(tx: Tx, tenantId: string) {
    const t = await tx.tenant.findFirst({ where: { id: tenantId } });
    const s = (t?.settings as any) ?? {};
    return { annotRoles: s.annotationRoles ?? ["CO", "CF", "RM"],
      cavRoles: s.caviardageRoles ?? ["CO", "CF"], types: s.gedDocTypes ?? [] };
  }
  private voitDocument(types: any[], role: string, typeCode: string | null): boolean {
    const t = types.find((x: any) => x.code === typeCode);
    return !!t && (t.rolesAutorises ?? []).includes(role);
  }

  // ── R156/R157 : annoter — le calque, habilité ──
  async annoter(ctx: Ctx, dto: { versionId: string; type: string; ancre: any; contenu: string; cercle: string }) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const { annotRoles } = await this.cfg(tx, ctx.tenantId);
      if (!annotRoles.includes(ctx.role)) {
        await this.emit(tx, ctx.tenantId, "annotation.acces.refuse", dto.versionId,
          { par: ctx.userId, role: ctx.role });
        throw new ForbiddenException(`R157 : rôle ${ctx.role} non habilité à annoter`);
      }
      if (!["PRIVEE", "DOSSIER"].includes(dto.cercle))
        throw new BadRequestException("R157 : cercle inconnu (PRIVEE | DOSSIER)");
      const v = await tx.documentVersion.findFirst({ where: { id: dto.versionId, tenantId: ctx.tenantId } });
      if (!v) throw new NotFoundException("Version introuvable");
      // Le calque : une LIGNE ailleurs — l'original n'est pas touché, pas relu, pas réécrit.
      const a = await tx.annotation.create({ data: { tenantId: ctx.tenantId,
        documentId: v.documentId, versionId: v.id, type: dto.type, ancre: dto.ancre,
        contenu: dto.contenu, cercle: dto.cercle, auteur: ctx.userId, at: new Date().toISOString() } });
      await this.emit(tx, ctx.tenantId, "annotation.posee", v.documentId,
        { annotationId: a.id, par: ctx.userId, type: dto.type, cercle: dto.cercle });
      await this.audit.log(ctx.tenantId, ctx.userId, "ANNOTATE", v.documentId);
      return { annotationId: a.id };
    });
  }

  // ── R156 : retirer — motivé, tracé ──
  async retirerAnnotation(ctx: Ctx, annotationId: string, motif: string) {
    return this.prisma.$transaction(async (tx: Tx) => {
      if (!motif || !motif.trim()) throw new BadRequestException("R7 : le retrait d'une annotation exige un motif");
      const a = await tx.annotation.findFirst({ where: { id: annotationId, tenantId: ctx.tenantId } });
      if (!a) throw new NotFoundException("Annotation introuvable");
      await tx.annotation.deleteMany({ where: { tenantId: ctx.tenantId, id: annotationId } });
      await this.emit(tx, ctx.tenantId, "annotation.retiree", a.documentId,
        { annotationId, par: ctx.userId, motif: motif.trim() });
    });
  }

  // ── R157 : lister — le filtre au RÉSULTAT ──
  async listerAnnotations(ctx: Ctx, documentId: string) {
    const { types } = await this.cfg(this.prisma, ctx.tenantId);
    const d = await this.prisma.document.findFirst({ where: { id: documentId, tenantId: ctx.tenantId } });
    if (!d || !this.voitDocument(types, ctx.role, d.typeCode)) return [];   // l'existence ne fuite pas
    const all = await this.prisma.annotation.findMany({ where: { tenantId: ctx.tenantId, documentId } });
    return all.filter((a: any) => a.cercle === "DOSSIER" || a.auteur === ctx.userId);
  }

  // ── R158 : caviarder — zones motivées, dérivé chaîné, original intact ──
  async caviarder(ctx: Ctx, dto: { versionId: string; zones: Array<{ zone: any; motif: string }> }) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const { cavRoles } = await this.cfg(tx, ctx.tenantId);
      if (!cavRoles.includes(ctx.role)) {
        await this.emit(tx, ctx.tenantId, "caviardage.refuse", dto.versionId,
          { par: ctx.userId, role: ctx.role });
        throw new ForbiddenException(`R158 : rôle ${ctx.role} non habilité à caviarder`);
      }
      if (!dto.zones?.length) throw new BadRequestException("R158 : au moins une zone");
      const muette = dto.zones.find((z) => !z.motif || !z.motif.trim());
      if (muette) throw new BadRequestException("R158 : chaque zone porte son motif (base légale) — zone muette refusée");
      const v = await tx.documentVersion.findFirst({ where: { id: dto.versionId, tenantId: ctx.tenantId } });
      if (!v) throw new NotFoundException("Version introuvable");
      // Le dérivé : empreinte PROPRE, chaînée à la source. L'original n'est ni lu-modifié ni re-signé.
      const shaDerive = sha256(`${v.sha256}|CAVIARDE|${JSON.stringify(dto.zones.map((z) => z.zone))}`);
      const c = await tx.caviardageDerive.create({ data: { tenantId: ctx.tenantId,
        documentId: v.documentId, versionId: v.id, shaSource: v.sha256, shaDerive,
        zones: dto.zones, statut: "CAVIARDE", par: ctx.userId, at: new Date().toISOString() } });
      await this.emit(tx, ctx.tenantId, "caviardage.produit", v.documentId,
        { caviardeId: c.id, par: ctx.userId, zones: dto.zones.length, shaSource: v.sha256, shaDerive });
      await this.audit.log(ctx.tenantId, ctx.userId, "REDACT", v.documentId);
      return { caviardeId: c.id, shaDerive };
    });
  }

  // ── R159 : divulguer — QUE le caviardé, et on prouve ce qui sort ──
  async divulguer(ctx: Ctx, dto: { caviardeId: string; destinataire: string }) {
    return this.prisma.$transaction(async (tx: Tx) => {
      if (!dto.destinataire || !dto.destinataire.trim())
        throw new BadRequestException("R159 : la divulgation nomme son destinataire");
      const c = await tx.caviardageDerive.findFirst({ where: { id: dto.caviardeId, tenantId: ctx.tenantId } });
      if (!c) {
        await this.emit(tx, ctx.tenantId, "divulgation.refusee", dto.caviardeId,
          { par: ctx.userId, motif: "cible non caviardée — l'original ne sort pas par cette voie" });
        throw new BadRequestException("R159 : cette voie ne sert qu'un dérivé caviardé — le défaut protège l'original");
      }
      await this.emit(tx, ctx.tenantId, "divulgation.executee", c.documentId,
        { par: ctx.userId, caviardeId: c.id, shaDerive: c.shaDerive, destinataire: dto.destinataire.trim() });
      await this.audit.log(ctx.tenantId, ctx.userId, "DISCLOSE", c.id);
      return { caviardeId: c.id, shaDerive: c.shaDerive };
    });
  }
}
