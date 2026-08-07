import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { loadSettings } from "../../common/tenant-settings";
import { emitEvent } from "../../common/domain-event";
import { Tx } from "../../common/tx";

/**
 * P-L8-1 (module D, v1.1 §9) — goAML + CHRONOMÈTRE RÉGLEMENTAIRE.
 * · Brouillon goAML XML PRÉ-REMPLI (dossier, transactions en évidence, récit = motif de la
 *   décision) — structure = docs/contracts/goaml-subset.xsd (sous-ensemble ASSUMÉ du schéma
 *   fedpol), validée en spec. La SOUMISSION est MANUELLE : `soumettre` enregistre la référence
 *   de dépôt (événement catalogué), n'envoie RIEN (R44 — l'humain dépose sur le portail goAML).
 * · Chronomètre : la caractérisation du soupçon est HORODATÉE par decideAt (décision DECLARER,
 *   R130 opposable) ; à J+5 OUVRÉS sans soumission → alerte cataloguée + idempotente (une par
 *   communication). Horloge INJECTABLE (`now`) — testé par simulation.
 * · Cloisonnement art. 9a/10a LBA : même habilitation par rôle que MrosService (paramètre R-Q
 *   mrosRolesHabilites), RLS FORCE sur mros_communications, jamais de notification client.
 */

type Ctx = { tenantId: string; userId: string; role: string };
const ECHEANCE_JOURS_OUVRES = 5;
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Jours OUVRÉS écoulés (lun-ven), bornes : jours pleins strictement après `depuis`. */
export function joursOuvres(depuis: Date, maintenant: Date): number {
  let n = 0; const d = new Date(Date.UTC(depuis.getUTCFullYear(), depuis.getUTCMonth(), depuis.getUTCDate()));
  const fin = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate()));
  while (d < fin) {
    d.setUTCDate(d.getUTCDate() + 1);
    const j = d.getUTCDay();
    if (j !== 0 && j !== 6) n++;
  }
  return n;
}

@Injectable()
export class GoamlService {
  constructor(private prisma: PrismaService) {}

  private async exiger(ctx: Ctx) {
    const s: any = await loadSettings(this.prisma, ctx.tenantId, true).catch(() => ({}));
    const roles: string[] = s.mrosRolesHabilites ?? ["MLRO"];
    if (ctx.role !== "SYSTEM" && !roles.includes(ctx.role))
      throw new ForbiddenException(`R129/R132 : rôle ${ctx.role} non habilité MROS (art. 9a/10a — cloisonnement)`);
  }

  /** Brouillon goAML pré-rempli — conforme à docs/contracts/goaml-subset.xsd. */
  async genererBrouillon(ctx: Ctx, communicationId: string, now: Date = new Date()) {
    await this.exiger(ctx);
    const com = await this.prisma.mrosCommunication.findFirst({
      where: { tenantId: ctx.tenantId, id: communicationId } });
    if (!com) throw new NotFoundException("communication MROS introuvable");
    const client = await this.prisma.client.findFirst({ where: { tenantId: ctx.tenantId, id: com.clientId } });
    const txs = (await this.prisma.transaction.findMany({
      where: { tenantId: ctx.tenantId, clientId: com.clientId } })).slice(0, 50);   // en évidence, borné
    const xml = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<report>`,
      `  <rentity_id>${esc(ctx.tenantId)}</rentity_id>`,
      `  <submission_code>M</submission_code>`,                    // Manuel — jamais d'envoi automatique
      `  <report_code>STR</report_code>`,
      `  <submission_date>${esc(now.toISOString())}</submission_date>`,
      `  <currency_code_local>CHF</currency_code_local>`,
      `  <reporting_person>${esc(com.decidePar)}</reporting_person>`,
      ...txs.map((t: any) => [`  <transaction>`,
        `    <transactionnumber>${esc(t.refExterne)}</transactionnumber>`,
        `    <date_transaction>${esc(t.dateValeur)}</date_transaction>`,
        `    <transmode_code>${esc(t.type)}</transmode_code>`,
        `    <amount_local>${esc(t.montant)}</amount_local>`,
        `  </transaction>`].join("\n")),
      `  <narrative>${esc(com.motif)}${client ? esc(` — client ${client.name} (${client.structure})`) : ""}</narrative>`,
      `</report>`,
    ].join("\n");
    return { communicationId, xml, nTransactions: txs.length, dossierSha256: com.dossierSha256 };
  }

  /** Soumission MANUELLE : l'humain a déposé sur le portail goAML — on TRACE la référence. */
  async soumettre(ctx: Ctx, communicationId: string, dto: { reference: string }) {
    await this.exiger(ctx);
    if (!dto?.reference?.trim()) throw new BadRequestException("référence goAML requise (dépôt manuel)");
    const com = await this.prisma.mrosCommunication.findFirst({
      where: { tenantId: ctx.tenantId, id: communicationId } });
    if (!com) throw new NotFoundException("communication MROS introuvable");
    await this.prisma.$transaction((tx: Tx) => emitEvent(tx, ctx.tenantId, "mros.goaml.soumis",
      communicationId, { reference: dto.reference, par: ctx.userId }));
    return { soumis: true, communicationId, reference: dto.reference };
  }

  /** Chronomètre J+5 ouvrés — alerte CATALOGUÉE, idempotente ; horloge injectable (simulation). */
  async chronometre(ctx: Ctx, now: Date = new Date()) {
    await this.exiger(ctx);
    const coms = await this.prisma.mrosCommunication.findMany({
      where: { tenantId: ctx.tenantId, decision: "DECLARER" } });
    const alertes: { communicationId: string; joursOuvres: number }[] = [];
    for (const com of coms) {
      const jo = joursOuvres(new Date(com.decideAt), now);
      if (jo < ECHEANCE_JOURS_OUVRES) continue;
      const soumis = await this.prisma.domainEvent.findFirst({ where: {
        tenantId: ctx.tenantId, type: "mros.goaml.soumis", aggregateId: com.id } });
      if (soumis) continue;
      const deja = await this.prisma.domainEvent.findFirst({ where: {
        tenantId: ctx.tenantId, type: "mros.chrono.alerte", aggregateId: com.id } });
      if (deja) continue;                                          // une alerte par communication
      await this.prisma.$transaction((tx: Tx) => emitEvent(tx, ctx.tenantId, "mros.chrono.alerte",
        com.id, { communicationId: com.id, joursOuvres: jo, echeanceJours: ECHEANCE_JOURS_OUVRES }));
      alertes.push({ communicationId: com.id, joursOuvres: jo });
    }
    return { examinees: coms.length, alertes };
  }
}
