import { Injectable, ForbiddenException, NotFoundException } from "@nestjs/common";
import { emitEvent } from "../../common/domain-event";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { Tx } from "../../common/tx";

/**
 * Surface de consultation GED — GS-01..05. AUCUNE règle nouvelle : expose des règles
 * RATIFIÉES en lecture. R110 : les rôles de lecture par type — RELUS AU REGISTRE À CHAQUE
 * ACTE (R125, aucun cache). Refus tracé. R145 : le contenu ne transite JAMAIS par ici —
 * la seule voie du contenu est la relecture vérifiée du coffre (empreinte contrôlée).
 * Les services ratifiés (ingestion, classement, coffre, vues) restent INTACTS.
 */

type Ctx = { tenantId: string; userId: string; role: string };

@Injectable()
export class GedConsultationService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private async typesLisibles(ctx: Ctx): Promise<Set<string>> {
    const t = await this.prisma.tenant.findFirst({ where: { id: ctx.tenantId } });
    const types = ((t?.settings as any)?.gedDocTypes ?? []) as any[];
    return new Set(types.filter((x) => (x.rolesAutorises ?? []).includes(ctx.role)).map((x) => x.code));
  }
  private meta(d: any) {
    return { id: d.id, clientId: d.clientId, typeCode: d.typeCode, nom: d.nom, statut: d.statut,
      legalHold: d.legalHold ?? false, expireAt: d.expireAt ?? null, retentionUntil: d.retentionUntil ?? null };
  }

  // ── GS-01/GS-02 : lister — scopé tenant, filtré au registre RELU à l'acte ──
  async listerDocuments(ctx: Ctx, filtres: { clientId?: string; typeCode?: string; statut?: string }) {
    const lisibles = await this.typesLisibles(ctx);   // relu à CHAQUE appel — R125
    const where: any = { tenantId: ctx.tenantId };
    if (filtres.clientId) where.clientId = filtres.clientId;
    if (filtres.typeCode) where.typeCode = filtres.typeCode;
    if (filtres.statut) where.statut = filtres.statut;
    const docs = await this.prisma.document.findMany({ where });
    return docs.filter((d: any) => d.typeCode && lisibles.has(d.typeCode)).map((d: any) => this.meta(d));
  }

  // ── GS-03/GS-04/GS-05 : la fiche — métadonnées + versions, jamais le contenu ──
  async fiche(ctx: Ctx, documentId: string) {
    const d = await this.prisma.document.findFirst({ where: { id: documentId, tenantId: ctx.tenantId } });
    if (!d) throw new NotFoundException("Document introuvable");
    const lisibles = await this.typesLisibles(ctx);
    if (!d.typeCode || !lisibles.has(d.typeCode)) {
      await this.prisma.$transaction(async (tx: Tx) =>
        emitEvent(tx, ctx.tenantId, "ged.consultation.refusee",
          documentId, { par: ctx.userId, role: ctx.role, typeCode: d.typeCode }));
      throw new ForbiddenException(`R110 : le rôle ${ctx.role} n'a pas la lecture du type ${d.typeCode}`);
    }
    const versions = (await this.prisma.documentVersion.findMany({ where: { documentId } }))
      .sort((a: any, b: any) => (a.no ?? 0) - (b.no ?? 0))
      .map((v: any) => ({ id: v.id, no: v.no, empreinte: v.empreinte, creeAt: v.creeAt }));  // PAS de contenuRef — R145
    await this.audit.log(ctx.tenantId, ctx.userId, "GED_CONSULT_FICHE", documentId);
    return { document: this.meta(d), versions };
  }
}
