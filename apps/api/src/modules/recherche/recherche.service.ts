import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { Tx } from "../../common/tx";

/**
 * La recherche — trouver sans trahir. R148→R151 (RS-01..06). Écrit APRÈS l'amendement, APRÈS
 * les tests. Écart Therefore n° 2, comblé avec l'invariant qui compte en banque privée :
 * L'EXISTENCE EST UNE INFORMATION.
 * R148 : l'index est un DÉRIVÉ — chaque entrée porte (document, version, empreinte du dérivé
 * OCR source), jamais une vérité propre ; il est REJOUABLE (reindexerTout reproduit à
 * l'identique) ; la désynchronisation se DÉTECTE (une fois — R39) et ne se répare pas seule.
 * R149 : l'habilitation s'applique AU RÉSULTAT — droits sur le TYPE (R112) évalués au moment
 * de la recherche, A_CLASSER réservé aux rôles d'arrivée (R139) ; hors droits = le document
 * n'existe pas (ni titre, ni compteur).
 * R150 : tenant-scopé STRUCTURELLEMENT (l'entrée porte le tenant) ; chaque recherche est
 * tracée (auteur jeton, requête, nb servis) — jamais les contenus.
 * R151 : l'index suit la vie — une entrée par document (l'état courant), la destruction
 * certifiée R115 RETIRE (retrait tracé, l'empreinte survit en base).
 * AUCUN paramètre tenant nouveau : la recherche ne se paramètre pas, elle s'habilite
 * (hérite de gedDocTypes / gedInboxRoles).
 */

type Ctx = { tenantId: string; userId: string; role: string };

@Injectable()
export class RechercheService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload, at: new Date().toISOString() } });
  }
  private async cfg(tx: Tx, tenantId: string) {
    const t = await tx.tenant.findFirst({ where: { id: tenantId } });
    const s = (t?.settings as any) ?? {};
    return { types: s.gedDocTypes ?? [], inboxRoles: s.gedInboxRoles ?? ["CO", "CF"] };
  }

  // ── R148/R151 : indexer — une entrée par document, référence + empreinte du dérivé ──
  async indexer(ctx: Ctx, versionId: string) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const v = await tx.documentVersion.findFirst({ where: { id: versionId, tenantId: ctx.tenantId } });
      if (!v) throw new NotFoundException("Version introuvable");
      const derives = (v.ocrDerives ?? []) as any[];
      if (derives.length === 0)
        throw new BadRequestException("R148 : rien à indexer — aucun dérivé OCR sur cette version (R138 d'abord)");
      const d = await tx.document.findFirst({ where: { id: v.documentId, tenantId: ctx.tenantId } });
      if (!d) throw new NotFoundException("Document introuvable");
      const dernier = derives[derives.length - 1];
      // UNE entrée par document : la recherche sert l'état courant (R151).
      await tx.searchEntry.deleteMany({ where: { tenantId: ctx.tenantId, documentId: d.id } });
      await tx.searchEntry.create({ data: { tenantId: ctx.tenantId, documentId: d.id,
        versionId: v.id, texte: `${d.nom ?? ""} ${dernier.texte}`,
        shaDeriveSource: dernier.sha256Derive, typeCode: d.typeCode ?? null,
        statut: d.statut, indexeAt: new Date().toISOString() } });
      await this.emit(tx, ctx.tenantId, "recherche.index.entree", d.id,
        { versionId: v.id, shaDeriveSource: dernier.sha256Derive });
    });
  }

  // ── R148 : rejouable — l'index peut brûler sans perte ──
  async reindexerTout(ctx: Ctx) {
    return this.prisma.$transaction(async (tx: Tx) => {
      await tx.searchEntry.deleteMany({ where: { tenantId: ctx.tenantId } });
      const versions = await tx.documentVersion.findMany({ where: { tenantId: ctx.tenantId } });
      // par document : la version au numéro le plus haut portant un dérivé
      const parDoc = new Map<string, any>();
      for (const v of versions) {
        if (!((v.ocrDerives ?? []) as any[]).length) continue;
        const cur = parDoc.get(v.documentId);
        if (!cur || v.numero > cur.numero) parDoc.set(v.documentId, v);
      }
      for (const v of parDoc.values()) {
        const d = await tx.document.findFirst({ where: { id: v.documentId, tenantId: ctx.tenantId } });
        if (!d || d.statut === "DETRUIT") continue;   // R151 : le détruit ne se réindexe pas
        const dernier = (v.ocrDerives as any[])[(v.ocrDerives as any[]).length - 1];
        await tx.searchEntry.create({ data: { tenantId: ctx.tenantId, documentId: d.id,
          versionId: v.id, texte: `${d.nom ?? ""} ${dernier.texte}`,
          shaDeriveSource: dernier.sha256Derive, typeCode: d.typeCode ?? null,
          statut: d.statut, indexeAt: new Date().toISOString() } });
      }
    });
  }

  // ── R149/R150 : chercher — l'habilitation au RÉSULTAT, la trace systématique ──
  async chercher(ctx: Ctx, requete: string) {
    if (!requete || requete.trim().length < 2)
      throw new BadRequestException("Requête trop courte");
    const q = requete.trim().toLowerCase();
    return this.prisma.$transaction(async (tx: Tx) => {
      const { types, inboxRoles } = await this.cfg(tx, ctx.tenantId);
      const brut = await tx.searchEntry.findMany({ where: { tenantId: ctx.tenantId, texte: { contains: q } } });
      const servis = brut.filter((e: any) => {
        if (e.statut === "A_CLASSER") return inboxRoles.includes(ctx.role);          // R139
        const typ = types.find((t2: any) => t2.code === e.typeCode);
        return !!typ && (typ.rolesAutorises ?? []).includes(ctx.role);               // R112
      }).map((e: any) => ({ documentId: e.documentId, versionId: e.versionId,
        extrait: e.texte.slice(0, 120) }));
      // La trace dit QUI cherche QUOI et COMBIEN fut servi — jamais les contenus (R150).
      await this.emit(tx, ctx.tenantId, "recherche.executee", "recherche",
        { par: ctx.userId, role: ctx.role, requete: q, nbServis: servis.length });
      await this.audit.log(ctx.tenantId, ctx.userId, "SEARCH", q);
      return servis;
    });
  }

  // ── R151 : la destruction certifiée retire — le retrait est un événement ──
  async retirer(ctx: Ctx, documentId: string) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const d = await tx.document.findFirst({ where: { id: documentId, tenantId: ctx.tenantId } });
      if (!d) throw new NotFoundException("Document introuvable");
      if (d.statut !== "DETRUIT")
        throw new BadRequestException("R151 : le retrait d'index n'existe que pour une destruction certifiée (R115)");
      const { count } = await tx.searchEntry.deleteMany({ where: { tenantId: ctx.tenantId, documentId } });
      if (count > 0)
        await this.emit(tx, ctx.tenantId, "recherche.index.retrait", documentId, { entrees: count });
    });
  }

  // ── R148 : la désynchronisation se détecte — un fait d'audit, pas un ménage ──
  async reconcilierIndex(ctx: Ctx) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const entries = await tx.searchEntry.findMany({ where: { tenantId: ctx.tenantId } });
      for (const e of entries) {
        const d = await tx.document.findFirst({ where: { id: e.documentId, tenantId: ctx.tenantId } });
        if (d && d.statut !== "DETRUIT") continue;
        const deja = await tx.domainEvent.findMany({ where: { tenantId: ctx.tenantId,
          type: "recherche.index.desync", aggregateId: e.documentId } });
        if (deja.length) continue;
        await this.emit(tx, ctx.tenantId, "recherche.index.desync", e.documentId,
          { entreeId: e.id, motif: d ? "document détruit encore indexé" : "document disparu hors flux" });
        // L'index n'est PAS purgé en silence : l'écart est un fait d'audit (R39).
      }
    });
  }
}
