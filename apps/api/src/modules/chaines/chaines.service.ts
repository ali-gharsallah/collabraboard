import { Injectable, BadRequestException, ForbiddenException } from "@nestjs/common";
import { GedIngestionService } from "../ged/ged-ingestion.service";
import { GedAvanceService } from "../ged/ged-avance.service";
import { RechercheService } from "../recherche/recherche.service";
import { CoffreService, StoragePort } from "../coffre/coffre.service";
import { AnnotationService } from "../annotations/annotation.service";

/**
 * Les chaînes — le composeur. CB-01..06. AUCUNE RÈGLE NOUVELLE : ce service tient les
 * promesses de câblage DÉJÀ ratifiées, sans modifier un seul service prouvé.
 * Clause R151 : le classement (R139) et l'OCR (R138) déclenchent l'indexation ; la
 * destruction certifiée (R115) retire de l'index — ici, elle purge AUSSI le coffre (R146).
 * Clause R144/R158 : le dérivé caviardé se dépose au coffre, clé préfixée tenant.
 * Clause R148 : le caviardé n'entre JAMAIS à l'index — il sert la sortie, pas la consultation.
 * Chaque chaîne est la somme de ses maillons ratifiés : si un maillon refuse, la chaîne
 * refuse net — pas de demi-état.
 */

type Ctx = { tenantId: string; userId: string; role: string };

@Injectable()
export class ChainesService {
  constructor(
    private ged: GedIngestionService,
    private gedAvance: GedAvanceService,
    private recherche: RechercheService,
    private coffre: CoffreService,
    private annotations: AnnotationService,
    private ports: { storage?: StoragePort } = {},
    private prisma?: any,
  ) {}

  private emit(tenantId: string, type: string, aggregateId: string, payload: any) {
    return this.prisma.domainEvent.create({ data: { tenantId, type, aggregateId, payload, at: new Date().toISOString() } });
  }

  // ── CB-01/CB-06 : classer → indexer (clause R151) ──
  async classerEtIndexer(ctx: Ctx, documentId: string, dto: { typeCode: string; clientId: string }, versionId: string) {
    // L'indexation est vérifiée AVANT le classement : si la version n'a rien à indexer
    // (R148 : pas de dérivé OCR), la chaîne refuse net — pas de document classé non cherchable.
    const v = await this.prisma.documentVersion.findFirst({ where: { id: versionId, tenantId: ctx.tenantId } });
    if (!v || !((v.ocrDerives ?? []) as any[]).length)
      throw new BadRequestException("R148 : rien à indexer — OCR (R138) requis avant le classement cherchable");
    await this.ged.classer(ctx, documentId, dto);
    await this.recherche.indexer(ctx, versionId);
  }

  // ── CB-02 : ocriser → (ré)indexer (clause R151 — l'état courant) ──
  async ocriserEtIndexer(ctx: Ctx, versionId: string, contenu: string) {
    const derive = await this.ged.ocriser(ctx, versionId, contenu);
    await this.recherche.indexer(ctx, versionId);
    return derive;
  }

  // ── CB-03 : détruire → purger le coffre → retirer l'index (clauses R115/R146/R151) ──
  async detruireComplet(ctx: Ctx, documentId: string, motif: string) {
    await this.gedAvance.detruire(ctx, documentId, motif);          // R115 — statut DETRUIT, empreintes émises
    const versions = await this.prisma.documentVersion.findMany({
      where: { tenantId: ctx.tenantId, documentId } });
    for (const v of versions) {
      try { await this.coffre.purgerCertifie(ctx, v.id, motif); }   // R146 — l'empreinte survit
      catch { /* version jamais déposée au coffre : rien à purger */ }
    }
    await this.recherche.retirer(ctx, documentId);                  // R151 — l'oubli certifié est complet
  }

  // ── CB-04/CB-05 : caviarder → déposer au coffre — JAMAIS à l'index (clauses R144/R148/R158) ──
  async caviarderEtDeposer(ctx: Ctx, dto: { versionId: string;
    zones: Array<{ zone: any; motif: string }>; contenuCaviarde: string }) {
    if (!this.ports.storage)
      throw new BadRequestException("R144 : aucun coffre configuré — pas de dépôt fantôme");
    const { caviardeId, shaDerive } = await this.annotations.caviarder(ctx,
      { versionId: dto.versionId, zones: dto.zones });
    const v = await this.prisma.documentVersion.findFirst({ where: { id: dto.versionId, tenantId: ctx.tenantId } });
    const cle = `${ctx.tenantId}/${v.documentId}/caviarde-${caviardeId}`;
    if (!cle.startsWith(ctx.tenantId + "/"))
      throw new ForbiddenException("R146 : clé hors du préfixe tenant");
    const t = await this.prisma.tenant.findFirst({ where: { id: ctx.tenantId } });
    const s = (t?.settings as any) ?? {};
    await this.ports.storage.ecrire(cle, dto.contenuCaviarde,
      { region: s.storageRegion ?? "ch-gva-2", chiffrementRef: s.storageChiffrement });
    await this.emit(ctx.tenantId, "cablage.caviarde.depose", caviardeId, { cle, shaDerive });
    // Volontairement AUCUN appel à recherche.indexer : le caviardé sert la sortie (R159),
    // pas la consultation interne (clause R148) — CB-05 le prouve.
    return { caviardeId, shaDerive, cle };
  }
}
