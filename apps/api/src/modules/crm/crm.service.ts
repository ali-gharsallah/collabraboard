import { Injectable, ForbiddenException, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";

/**
 * CRM Relation — R186→R188 (CR-01..05). Écrit APRÈS l'amendement, APRÈS les tests.
 * R186 : la timeline PROJETTE le journal d'événements (zéro table propre) — filtrée aux
 * droits (RM = ses clients ; rôles à visibilité étendue = tout ; tiers refusé tracé).
 * R187 : le prochain geste dérive de signaux réels (pièce expirante, tâche en retard),
 * nommés — recalcul pur, jamais exécuté seul (R39/R44).
 * R188 : le compte rendu est structuré par type ; les champs obligatoires du type sont la
 * trace du conseil (LSFin) — manquant = refus. Le pré-remplissage IA passe par un PORT
 * déclaré (R138 : pas de brouillon fantôme), la proposition est MARQUÉE, l'humain signe.
 * Le module clients/ existant reste intact.
 */

type Ctx = { tenantId: string; userId: string; role: string };
type IaPort = { moteur: string; preRemplir(contexte: any): Promise<Record<string, string>> };

@Injectable()
export class CrmService {
  constructor(private prisma: PrismaService, private audit: AuditService,
    private ports: { ia?: IaPort } = {}) {}

  private emit(tx: any, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload, at: new Date().toISOString() } });
  }
  private async settings(tenantId: string) {
    const t = await this.prisma.tenant.findFirst({ where: { id: tenantId } });
    return ((t?.settings as any) ?? {});
  }
  private async garde(ctx: Ctx, clientId: string) {
    const c = await this.prisma.client.findFirst({ where: { id: clientId, tenantId: ctx.tenantId } });
    if (!c) throw new NotFoundException("Client introuvable");
    const s = await this.settings(ctx.tenantId);
    const etendue = (s.rolesVisibiliteEtendue ?? ["CO", "CF"]).includes(ctx.role);
    if (!etendue && c.rmUserId !== ctx.userId) {   // ÉCART lot 40 : Client ratifié expose rmUserId (le zip lisait c.rmId)
      await this.prisma.$transaction(async (tx: any) =>
        this.emit(tx, ctx.tenantId, "crm.acces.refuse", clientId, { par: ctx.userId, role: ctx.role }));
      throw new ForbiddenException("R186 : la relation d'un client se lit par son RM ou par un rôle à visibilité étendue");
    }
    return c;
  }

  // ── R186 : la timeline — une projection du journal ──
  async timeline(ctx: Ctx, clientId: string) {
    await this.garde(ctx, clientId);
    const evs = await this.prisma.domainEvent.findMany({ where: { tenantId: ctx.tenantId, aggregateId: clientId } });
    return evs
      .map((e: any) => ({ at: e.at, type: e.type, source: String(e.type).split(".")[0], payload: e.payload }))
      .sort((a: any, b: any) => String(a.at).localeCompare(String(b.at)));
  }

  // ── R187 : le prochain geste — dérivé, nommé, jamais exécuté ──
  async prochainsGestes(ctx: Ctx, clientId: string) {
    await this.garde(ctx, clientId);
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const gestes: any[] = [];
    // ÉCART SIGNALÉ (lot 40) : le geste R187 « pièce expirante » lit d.expireAt / d.nomFichier,
    // ABSENTS du Document ratifié (qui modélise la rétention `retentionUntil`, pas une validité).
    // `any[]` confine l'écart à ce fichier nouveau (Document ratifié intact) ; la branche reste
    // DORMANTE tant qu'une date de validité n'est pas ratifiée au Document. Cf. rapport lot 40.
    const docs: any[] = await this.prisma.document.findMany({ where: { tenantId: ctx.tenantId, clientId, statut: "ACTIF" } });
    for (const d of docs) {
      if (d.expireAt) {
        const jours = Math.round((new Date(d.expireAt).getTime() - Date.now()) / 86_400_000);
        if (jours <= 90) gestes.push({ geste: `Demander le renouvellement de ${d.nomFichier ?? d.nom}`,
          signal: `la pièce expire le ${d.expireAt} (${jours} j)`, source: "document", echeance: d.expireAt });
      }
    }
    const tasks = await this.prisma.task.findMany({ where: { tenantId: ctx.tenantId, clientId } });
    for (const k of tasks) {
      if (k.statut !== "FAITE" && k.dueAt && k.dueAt < aujourdhui)
        gestes.push({ geste: `Traiter la tâche ${k.type} en retard`,
          signal: `échéance dépassée depuis le ${k.dueAt}`, source: "tache", echeance: k.dueAt });
    }
    return gestes.sort((a, b) => String(a.echeance).localeCompare(String(b.echeance)));
  }

  // ── R188 : le pré-remplissage — un port déclaré, une proposition marquée ──
  async preRemplir(ctx: Ctx, clientId: string, type: string) {
    await this.garde(ctx, clientId);
    if (!this.ports.ia)
      throw new BadRequestException("R188 : aucun port de pré-rédaction configuré — pas de brouillon fantôme ; la saisie manuelle reste ouverte");
    const timeline = await this.timeline(ctx, clientId);
    const gestes = await this.prochainsGestes(ctx, clientId);
    const contenu = await this.ports.ia.preRemplir({ clientId, type, timeline, gestes });
    return { origine: "IA", moteur: this.ports.ia.moteur, type, contenu };
  }

  // ── R188 : le compte rendu — la trace du conseil, signée par l'humain ──
  async creerCompteRendu(ctx: Ctx, dto: { clientId: string; type: string; contenu: Record<string, any>; origineProposition?: string }) {
    await this.garde(ctx, dto.clientId);
    const s = await this.settings(ctx.tenantId);
    const def = (s.crmEntretiens ?? []).find((e: any) => e.type === dto.type);
    if (!def) throw new BadRequestException(`R188 : type d'entretien inconnu du paramétrage — ${dto.type}`);
    const manquants = (def.champsObligatoires ?? []).filter((c: string) => {
      const v = (dto.contenu ?? {})[c]; return v === undefined || v === null || String(v).trim() === "";
    });
    if (manquants.length)
      throw new BadRequestException(`R188 : la trace du conseil est incomplète — champs obligatoires manquants : ${manquants.join(", ")}`);
    return this.prisma.$transaction(async (tx: any) => {
      const ct = await tx.crmContact.create({ data: { tenantId: ctx.tenantId, clientId: dto.clientId,
        type: dto.type, contenu: dto.contenu,
        origine: dto.origineProposition === "IA" ? "IA_VALIDEE" : "MANUEL",
        par: ctx.userId, at: new Date().toISOString() } });
      await this.emit(tx, ctx.tenantId, "crm.contact.cree", dto.clientId,
        { contactId: ct.id, type: dto.type, origine: ct.origine, par: ctx.userId });
      await this.audit.log(ctx.tenantId, ctx.userId, "CRM_CONTACT", ct.id);
      return { contactId: ct.id, origine: ct.origine };
    });
  }
}
