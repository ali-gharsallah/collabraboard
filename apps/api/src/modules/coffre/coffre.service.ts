import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";

/**
 * Le coffre — stockage gouverné. R144→R147 (CV-01..06). Écrit APRÈS l'amendement, APRÈS les tests.
 * R144 : le contenu vit AU COFFRE sous clé déterministe {tenantId}/{documentId}/v{numero} ; la
 * base ne porte que l'empreinte (R109) et la clé. Pas de port → refus explicite (pattern R114 :
 * un dépôt « réussi » sans coffre serait un mensonge). Région = registre R-Q (storageRegion).
 * R145 : TOUTE lecture recalcule l'empreinte AVANT de servir — discordance = refus + alerte,
 * le contenu altéré ne sort jamais (R111 étendu au stockage réel).
 * R146 : la clé porte le tenantId en préfixe VÉRIFIÉ (isolation structurelle) ; chiffrement par
 * tenant transmis au port (storageChiffrement) ; l'effacement n'existe que par la destruction
 * certifiée R115 — l'empreinte et le certificat survivent.
 * R147 : la réconciliation base↔coffre MESURE (orphelin → alerte ; manquant → CRITIQUE + tâche,
 * une fois) et ne supprime ni ne répare jamais seule (R39).
 * Adaptateur de production : s3-storage.adapter.ts (Exoscale SOS) — câblage verbatim, recette
 * d'activation au RUNBOOK.
 */

type Ctx = { tenantId: string; userId: string; role: string };
export type StoragePort = {
  ecrire(cle: string, contenu: string, opts: { region: string; chiffrementRef?: string }): Promise<void>;
  lire(cle: string): Promise<string>;
  supprimer(cle: string): Promise<void>;
  lister(prefixe: string): Promise<string[]>;
};
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

@Injectable()
export class CoffreService {
  constructor(private prisma: PrismaService, private audit: AuditService,
    private ports: { storage?: StoragePort } = {}) {}

  private emit(tx: any, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload, at: new Date().toISOString() } });
  }
  private port(): StoragePort {
    if (!this.ports.storage)
      throw new BadRequestException("R144 : aucun coffre configuré — pas de dépôt fantôme");
    return this.ports.storage;
  }
  private async cfg(tx: any, tenantId: string) {
    const t = await tx.tenant.findFirst({ where: { id: tenantId } });
    const s = (t?.settings as any) ?? {};
    return { region: s.storageRegion ?? "ch-gva-2", chiffrementRef: s.storageChiffrement };
  }
  private async version(tx: any, ctx: Ctx, versionId: string) {
    const v = await tx.documentVersion.findFirst({ where: { id: versionId, tenantId: ctx.tenantId } });
    if (!v) throw new NotFoundException("Version introuvable");
    return v;
  }
  private cle(ctx: Ctx, v: any) { return `${ctx.tenantId}/${v.documentId}/v${v.numero}`; }
  private verifPrefixe(ctx: Ctx, cle: string) {
    if (!cle.startsWith(ctx.tenantId + "/"))
      throw new ForbiddenException("R146 : clé hors du préfixe tenant — isolation structurelle");
  }

  // ── R144 : le contenu au coffre, la preuve en base ──
  async ecrire(ctx: Ctx, versionId: string, contenu: string) {
    const port = this.port();
    return this.prisma.$transaction(async (tx: any) => {
      const v = await this.version(tx, ctx, versionId);
      if (sha(contenu) !== v.sha256)
        throw new BadRequestException("R111 : le contenu ne correspond pas à l'empreinte de la version");
      const cle = this.cle(ctx, v);
      const { region, chiffrementRef } = await this.cfg(tx, ctx.tenantId);
      await port.ecrire(cle, contenu, { region, chiffrementRef });
      await tx.documentVersion.update({ where: { id: v.id }, data: { storageKey: cle } });
      await this.emit(tx, ctx.tenantId, "coffre.ecrit", v.documentId,
        { versionId: v.id, cle, region, par: ctx.userId });
      await this.audit.log(ctx.tenantId, ctx.userId, "VAULT_WRITE", cle);
      return { storageKey: cle };
    });
  }

  // ── R145 : la lecture re-vérifie TOUJOURS ──
  async lire(ctx: Ctx, versionId: string) {
    const port = this.port();
    const v = await this.version(this.prisma, ctx, versionId);
    if (!v.storageKey) throw new NotFoundException("Aucun contenu au coffre pour cette version");
    this.verifPrefixe(ctx, v.storageKey);
    const contenu = await port.lire(v.storageKey);
    if (sha(contenu) !== v.sha256) {
      await this.emit(this.prisma, ctx.tenantId, "coffre.integrite.alerte", v.documentId,
        { versionId: v.id, cle: v.storageKey, attendu: v.sha256, obtenu: sha(contenu) });
      throw new BadRequestException(
        "R145 : intégrité du coffre en défaut — contenu NON servi, alerte émise");
    }
    return contenu;
  }
  /** Accès direct par clé (outillage) — le préfixe tenant est vérifié STRUCTURELLEMENT. */
  async lireParCle(ctx: Ctx, cle: string) {
    this.verifPrefixe(ctx, cle);
    return this.port().lire(cle);
  }

  // ── R146/R115 : on n'efface qu'en certifiant ──
  async purgerCertifie(ctx: Ctx, versionId: string, motif: string) {
    const port = this.port();
    return this.prisma.$transaction(async (tx: any) => {
      if (!motif || !motif.trim()) throw new BadRequestException("R7 : la purge certifiée exige un motif");
      const v = await this.version(tx, ctx, versionId);
      const d = await tx.document.findFirst({ where: { id: v.documentId, tenantId: ctx.tenantId } });
      if (!d || d.statut !== "DETRUIT")
        throw new BadRequestException(
          "R115 : la purge du coffre n'existe que pour un document en destruction certifiée");
      if (v.storageKey) { this.verifPrefixe(ctx, v.storageKey); await port.supprimer(v.storageKey); }
      await tx.documentVersion.update({ where: { id: v.id }, data: { storageKey: null } });
      // L'EMPREINTE reste : le certificat d'existence survit au contenu (R115).
      await this.emit(tx, ctx.tenantId, "coffre.purge.certifiee", v.documentId,
        { versionId: v.id, motif: motif.trim(), empreinteConservee: v.sha256, par: ctx.userId });
      await this.audit.log(ctx.tenantId, ctx.userId, "VAULT_CERTIFIED_PURGE", v.id);
    });
  }

  // ── R147 : la réconciliation mesure — jamais de ménage automatique ──
  async reconcilier(ctx: Ctx) {
    const port = this.port();
    return this.prisma.$transaction(async (tx: any) => {
      const clesCoffre = await port.lister(ctx.tenantId + "/");
      const versions = await tx.documentVersion.findMany({ where: { tenantId: ctx.tenantId } });
      const clesBase = new Set(versions.filter((v: any) => v.storageKey).map((v: any) => v.storageKey));
      for (const cle of clesCoffre) {
        if (clesBase.has(cle)) continue;
        const deja = await tx.domainEvent.findMany({ where: { tenantId: ctx.tenantId,
          type: "coffre.reconciliation.orphelin", aggregateId: cle } });
        if (deja.length) continue;
        await this.emit(tx, ctx.tenantId, "coffre.reconciliation.orphelin", cle, { cle });
      }
      for (const v of versions) {
        if (!v.storageKey || clesCoffre.includes(v.storageKey)) continue;
        const deja = await tx.domainEvent.findMany({ where: { tenantId: ctx.tenantId,
          type: "coffre.reconciliation.manquant", aggregateId: v.id } });
        if (deja.length) continue;
        await this.emit(tx, ctx.tenantId, "coffre.reconciliation.manquant", v.id,
          { cle: v.storageKey, severite: "CRITIQUE" });
        await this.emit(tx, ctx.tenantId, "tache.coffre.reconciliation", v.id, { cle: v.storageKey });
      }
      // Ni suppression, ni recréation : un écart d'inventaire est un FAIT D'AUDIT (R39/R147).
    });
  }
}
