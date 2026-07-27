import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { Tx } from "../../common/tx";

/**
 * Les dossiers-vues — classer sans copier. R164→R166 (VU-01..05). Écrit APRÈS l'amendement,
 * APRÈS les tests. Le dernier confort GED : un document apparaît dans N classements, il
 * n'existe qu'une fois.
 * R164 : la vue est une REQUÊTE nommée (critère enregistré) — jamais une copie, jamais un
 * conteneur ; créer/retirer est habilité (vueRoles) et tracé ; retirer ne détruit RIEN (R7).
 * R165 : la vue s'évalue AU RÉSULTAT — filtre du REGARDEUR (types R112, arrivée R139,
 * existence R149) ; la trace dit qui a regardé quoi et combien — jamais les contenus (R150).
 * R166 : la vue suit la vie — le DETRUIT (R115) disparaît de toutes les vues à l'évaluation ;
 * l'état fait foi. Les critères temporels (expireAvant) travaillent AVEC la rétention
 * existante (GD-11) sans la dupliquer — doublon évité par vérification.
 */

type Ctx = { tenantId: string; userId: string; role: string };
type Critere = { typeCode?: string; statut?: string; clientId?: string; expireAvant?: string };

@Injectable()
export class VuesService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload, at: new Date().toISOString() } });
  }
  private async cfg(tx: Tx, tenantId: string) {
    const t = await tx.tenant.findFirst({ where: { id: tenantId } });
    const s = (t?.settings as any) ?? {};
    return { types: s.gedDocTypes ?? [], inboxRoles: s.gedInboxRoles ?? ["CO", "CF"],
      vueRoles: s.vueRoles ?? ["CO", "CF", "ADMIN"] };
  }
  private async habilite(tx: Tx, ctx: Ctx, ref: string) {
    const { vueRoles } = await this.cfg(tx, ctx.tenantId);
    if (!vueRoles.includes(ctx.role)) {
      await this.emit(tx, ctx.tenantId, "ged.vue.acces.refuse", ref, { par: ctx.userId, role: ctx.role });
      throw new ForbiddenException(`R164 : rôle ${ctx.role} non habilité sur les vues`);
    }
  }

  // ── R164 : créer — un critère, pas un conteneur ──
  async creerVue(ctx: Ctx, dto: { code: string; label: string; critere: Critere }) {
    return this.prisma.$transaction(async (tx: Tx) => {
      await this.habilite(tx, ctx, dto.code);
      const deja = await tx.gedVue.findFirst({ where: { tenantId: ctx.tenantId, code: dto.code } });
      if (deja) throw new BadRequestException(`R164 : la vue « ${dto.code} » existe déjà`);
      const v = await tx.gedVue.create({ data: { tenantId: ctx.tenantId, code: dto.code,
        label: dto.label, critere: dto.critere ?? {}, creePar: ctx.userId, at: new Date().toISOString() } });
      await this.emit(tx, ctx.tenantId, "ged.vue.creee", v.id, { code: dto.code, par: ctx.userId });
      await this.audit.log(ctx.tenantId, ctx.userId, "VIEW_CREATE", dto.code);
      return { vueId: v.id };
    });
  }

  // ── R164 : retirer — motivé, et RIEN n'est détruit (il n'y a rien dedans) ──
  async retirerVue(ctx: Ctx, code: string, motif: string) {
    return this.prisma.$transaction(async (tx: Tx) => {
      if (!motif || !motif.trim()) throw new BadRequestException("R7 : le retrait d'une vue exige un motif");
      await this.habilite(tx, ctx, code);
      const v = await tx.gedVue.findFirst({ where: { tenantId: ctx.tenantId, code } });
      if (!v) throw new NotFoundException("Vue introuvable");
      await tx.gedVue.deleteMany({ where: { tenantId: ctx.tenantId, code } });
      await this.emit(tx, ctx.tenantId, "ged.vue.retiree", v.id, { code, par: ctx.userId, motif: motif.trim() });
    });
  }

  async listerVues(ctx: Ctx) {
    return this.prisma.gedVue.findMany({ where: { tenantId: ctx.tenantId } });
  }

  // ── R165/R166 : évaluer — la requête, au résultat, sur l'état vivant ──
  async evaluer(ctx: Ctx, code: string) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const vue = await tx.gedVue.findFirst({ where: { tenantId: ctx.tenantId, code } });
      if (!vue) throw new NotFoundException("Vue introuvable");
      const { types, inboxRoles } = await this.cfg(tx, ctx.tenantId);
      const c: Critere = (vue.critere as any) ?? {};
      const docs = await tx.document.findMany({ where: { tenantId: ctx.tenantId } });
      const servis = docs.filter((d: any) => {
        if (d.statut === "DETRUIT") return false;                       // R166 — l'état fait foi
        if (c.clientId && d.clientId !== c.clientId) return false;
        if (c.typeCode && d.typeCode !== c.typeCode) return false;
        if (c.statut && d.statut !== c.statut) return false;
        if (c.expireAvant && (!d.expireAt || String(d.expireAt) >= c.expireAvant)) return false;
        // R165 — le filtre du REGARDEUR (pattern R149)
        if (d.statut === "A_CLASSER") return inboxRoles.includes(ctx.role);
        const typ = types.find((t: any) => t.code === d.typeCode);
        return !!typ && (typ.rolesAutorises ?? []).includes(ctx.role);
      }).map((d: any) => ({ id: d.id, nom: d.nom, typeCode: d.typeCode, statut: d.statut }));
      await this.emit(tx, ctx.tenantId, "ged.vue.evaluee", vue.id,
        { code, par: ctx.userId, role: ctx.role, nbServis: servis.length });
      return servis;
    });
  }
}
