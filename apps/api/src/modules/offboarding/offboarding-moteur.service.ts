import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { emitEvent } from "../../common/domain-event";
import { modifierParametreGouverne, resoudreParametresGouvernes } from "../../common/param-engagement";
import { Tx } from "../../common/tx";
import { CoreBankingPort } from "./offboarding.service";

/**
 * Bloc 62 — Offboarding AU MOTEUR (repo R439–R445 · session R432–R438,
 * spec/BLOC-62-OFFBOARDING-R432-R438.md, RATIFIÉ 08.08.2026).
 *
 * R439 : AUCUNE table d'instance — l'état est un REJEU du journal append-only
 * (WORKFLOW_STARTED → [VISA_APPOSE|TRANSITION_FIRED|GUARD_*]* → WORKFLOW_COMPLETED).
 * États R16 : Création → Collecte → Review → Validation → Clôturé.
 * Mapping chaîne R441 → transitions : maillon 0 = Collecte→Review, maillon 1 =
 * Review→Validation, maillons 2..n-1 = visas MULTIPLES (R1) portés par la clôture —
 * le DERNIER déclenche Validation→Clôturé. Création→Collecte est franchie
 * automatiquement au premier visa (l'initiation ouvre le dossier, la collecte démarre).
 * R440 : guards évalués à CHAQUE tentative (données live), sévérités du SNAPSHOT
 * d'initiation (grandfathering R29) ; évalués sur les transitions de DÉCISION
 * (→Validation, →Clôturé) ; checklist R443 uniquement à la clôture.
 * R445 : modification de paramètre SANS confirmation → 409 portant le payload du
 * pop-up ; AVEC → PARAM_CHANGED versionné par date de mise en vigueur (agrégat
 * `offboarding-params`, append-only R49, résolution par REJEU — R48).
 * Port core banking : optionnel — absent = guard CORE non évaluable, STUB EXPLICITE,
 * écart consigné E-OFF-2 (docs/ECARTS-FRONT.md).
 * Cohabitation avec la machine R267–R271 (OffboardingService) : consignée E-OFF-3,
 * rien n'est modifié ici dans l'existant.
 */

export type Ctx = { tenantId: string; userId: string; role: string };
export const ETATS_OFFBOARDING = ["Création", "Collecte", "Review", "Validation", "Clôturé"] as const;
const AGG_PARAMS = "offboarding-params";
const ROLES_DETAIL_MROS = ["CO_SR", "MLRO", "DIR"];               // art. 10a LBA — tipping-off
const MOTIF_NEUTRE = "Vérifications compliance en cours";

export const DEFAUTS_OFFBOARDING = {
  chains: {
    LOW: ["RM", "CO"], MEDIUM: ["RM", "CO", "CO_SR"],
    HIGH: ["RM", "CO_SR", "MLRO", "DIR"], PEP: ["RM", "CO_SR", "MLRO", "DIR"],
  } as Record<string, string[]>,
  forcageParMotif: { "Sanctions": "HIGH", "Risque AML élevé": "HIGH" } as Record<string, string>,
  motifs: ["Demande du client", "Décision de la banque", "Risque AML élevé", "Sanctions",
    "Inactivité prolongée", "Fusion/acquisition", "Décès / succession", "Transfert d'établissement"],
  rolesParMotif: { "Sanctions": ["CO_SR", "MLRO"], "Risque AML élevé": ["CO_SR", "MLRO"],
    "*": ["RM", "CO"] } as Record<string, string[]>,
  checklistPP: [
    { label: "Clôture des comptes", obligatoire: true },
    { label: "Désactivation des accès e-banking", obligatoire: true },
    { label: "Archivage documentaire complet", obligatoire: true },
    { label: "Obligations fiscales notifiées", obligatoire: false }],
  checklistPM: [
    { label: "Clôture des comptes", obligatoire: true },
    { label: "Radiation des pouvoirs et signatures", obligatoire: true },
    { label: "Archivage documentaire complet", obligatoire: true },
    { label: "Obligations fiscales et TVA notifiées", obligatoire: false }],
  guards: { AR: "BLOQUANT", AML: "BLOQUANT", SCREENING: "BLOQUANT", MROS: "BLOQUANT",
    CORE: "BLOQUANT", CHECKLIST: "BLOQUANT" } as Record<string, string>,
  retentionAnnees: 10,
  slaJoursParEtape: { "Création": 1, "Collecte": 3, "Review": 3, "Validation": 2 } as Record<string, number>,
};

@Injectable()
export class OffboardingMoteurService {
  constructor(private prisma: PrismaService, private audit: AuditService,
    private ports: { core?: CoreBankingPort } = {}) {}

  // ── Paramètres §Offboarding — défauts + REJEU des PARAM_CHANGED en vigueur ≤ aDate (R48/R29).
  //    Mécanisme COMMUN param-engagement.ts (généralisé aux Blocs 63/64 — jamais dupliqué). ──
  async parametres(ctx: Ctx, aDate?: Date) {
    return resoudreParametresGouvernes(this.prisma, ctx.tenantId, AGG_PARAMS, DEFAUTS_OFFBOARDING, aDate);
  }

  // ── R445 — pop-up d'engagement : sans confirmation AUCUNE écriture, 409 avec le payload ──
  async modifierParametre(ctx: Ctx, dto: { cle: string; valeur: any; enVigueurLe: string;
    confirmation?: { engagementTexte: string; auteur: string } }) {
    return modifierParametreGouverne(this.prisma, ctx, {
      aggregate: AGG_PARAMS, cle: dto.cle, valeur: dto.valeur, enVigueurLe: dto.enVigueurLe,
      confirmation: dto.confirmation, base: DEFAUTS_OFFBOARDING,
      extraPopup: (cle) => (/guards\.(MROS|SCREENING)|Sanctions/i.test(cle) || cle === "forcageParMotif" || cle.startsWith("guards.")
        ? { rappelLBA: "Rappel des obligations LBA/OBA-FINMA : affaiblir cette garde " +
            "n'éteint aucune obligation légale (art. 9/10a LBA) — engagement de responsabilité requis." } : {}),
      apresEmission: async () => { await this.audit.log(ctx.tenantId, ctx.userId, "OFFB_PARAM_CHANGED", `${dto.cle}`); },
    });
  }

  // ── R442/R441 — initiation : rôle habilité PAR MOTIF, niveau (calculé|forçage), snapshot figé ──
  async initier(ctx: Ctx, dto: { clientId: string; motif: string; dateInitiation?: string }) {
    const dateInit = dto.dateInitiation ? new Date(dto.dateInitiation) : new Date();
    const p = await this.parametres(ctx, dateInit);
    if (!p.motifs.includes(dto.motif))
      throw new BadRequestException(`R442 : motif inconnu du référentiel — « ${dto.motif} »`);
    const habilites: string[] = p.rolesParMotif[dto.motif] ?? p.rolesParMotif["*"];
    if (ctx.role !== "ADMIN" && !habilites.includes(ctx.role))
      throw new ForbiddenException(`R442 : rôle ${ctx.role} non habilité pour ce motif — « ${dto.motif} » (habilités : ${habilites.join(", ")})`);
    const client = await this.prisma.client.findFirst({ where: { id: dto.clientId, tenantId: ctx.tenantId } });
    if (!client) throw new NotFoundException("Client introuvable");
    // niveau calculé = riskLevel du référentiel client (LOW/MEDIUM/HIGH) — le forçage R441 l'emporte
    const calcule = (client as any).riskLevel ?? "LOW";
    const force = p.forcageParMotif[dto.motif];
    const niveau = force ?? calcule;
    const origineNiveau = force ? `forçage motif ${dto.motif} (R441)` : `calculé (${calcule})`;
    const checklist = (client as any).type === "PM" ? p.checklistPM : p.checklistPP;
    const instanceId = randomUUID();
    await this.prisma.$transaction(async (tx: Tx) => {
      await emitEvent(tx, ctx.tenantId, "WORKFLOW_STARTED", instanceId, {
        clientId: dto.clientId, motif: dto.motif, par: ctx.userId, role: ctx.role,
        niveau, origineNiveau, chaine: p.chains[niveau], checklist, guards: p.guards,
        dateInitiation: dateInit.toISOString() });
      await this.audit.log(ctx.tenantId, ctx.userId, "OFFB_WF_STARTED", `${instanceId}:${dto.motif}`);
    });
    return { instanceId, etat: "Création" as const };
  }

  // ── R439 — projection PURE (aucun champ d'index) ; aDate = rejeu partiel (R48) ──
  async etat(ctx: Ctx, instanceId: string, aDate?: Date) {
    const evs: any[] = await this.prisma.domainEvent.findMany({
      where: { tenantId: ctx.tenantId, aggregateId: instanceId }, orderBy: { id: "asc" } });
    const vus = aDate ? evs.filter((e) => new Date(e.at) <= aDate) : evs;
    const demarre = vus.find((e) => e.type === "WORKFLOW_STARTED");
    if (!demarre) throw new NotFoundException("Instance OFFBOARDING inconnue (aucun WORKFLOW_STARTED à cette date)");
    const d: any = demarre.payload;
    let etape: string = "Création";
    const visas: any[] = []; const coches: string[] = [];
    for (const e of vus) {
      const pl: any = e.payload;
      if (e.type === "TRANSITION_FIRED") { etape = pl.to; if (pl.visa) visas.push(pl.visa); }
      if (e.type === "VISA_APPOSE") visas.push({ validateur: pl.validateur, role: pl.role, at: pl.at });
      if (e.type === "CHECKLIST_ITEM_CHECKED") coches.push(pl.label);
      if (e.type === "WORKFLOW_COMPLETED") etape = "Clôturé";
    }
    return { instanceId, etat: etape, clientId: d.clientId, motif: d.motif,
      initiateur: d.par, niveau: d.niveau, origineNiveau: d.origineNiveau,
      chaine: d.chaine, guards: d.guards, dateInitiation: d.dateInitiation,
      checklist: d.checklist.map((i: any) => ({ ...i, coche: coches.includes(i.label) })),
      visas };
  }

  // ── R440 — guards : données LIVE, sévérités du SNAPSHOT. Retour brut (avec clé technique). ──
  private async evaluerGuards(ctx: Ctx, e: any) {
    const res: { guard: string; severite: string; echec: boolean; detail: string }[] = [];
    const sev = (g: string) => e.guards[g] ?? "BLOQUANT";
    const pousse = (guard: string, echec: boolean, detail: string) => {
      if (sev(guard) !== "DÉSACTIVÉ") res.push({ guard, severite: sev(guard), echec, detail });
    };
    const ar: any = await this.prisma.reviewDeadline.findFirst({ where: { tenantId: ctx.tenantId,
      clientId: e.clientId, statut: "PLANIFIEE", dueDate: { lt: new Date() } } });
    pousse("AR", !!ar, ar ? `Account Review non clôturée (AR-${String(ar.id).slice(0, 4)})` : "aucune AR échue");
    const aml: any = await (this.prisma as any).amlGapSignal.findFirst({ where: { tenantId: ctx.tenantId,
      clientId: e.clientId, status: { in: ["NEW", "UNDER_REVIEW", "ESCALATED"] } } }).catch(() => null);
    pousse("AML", !!aml, aml ? `Alerte AML en investigation (${aml.scenarioCode})` : "aucune alerte ouverte");
    const hit: any = await this.prisma.screeningHit.findFirst({ where: { tenantId: ctx.tenantId,
      clientId: e.clientId, statut: "BRUT" } });
    pousse("SCREENING", !!hit, hit ? "Hit screening non levé" : "aucun hit brut");
    const mros: any = await this.prisma.mrosCommunication.findFirst({ where: { tenantId: ctx.tenantId,
      clientId: e.clientId, decision: "COMMUNIQUER", notification: null } });
    pousse("MROS", !!mros, mros ? "Déclaration MROS en attente de transmission (art. 10a LBA)" : "aucune déclaration en attente");
    if (this.ports.core) {
      const soldes = await this.ports.core.lire("soldes").catch(() => []);
      const ouverts = soldes.filter((s: any) => s.clientId === e.clientId && Number(s.solde) !== 0);
      pousse("CORE", ouverts.length > 0, ouverts.length ? "Soldes non nuls / engagements ouverts" : "soldes à zéro");
    }
    // STUB EXPLICITE : port core banking absent — le guard CORE n'est PAS évaluable (E-OFF-2).
    return res;
  }

  // ── OF-12 — health check filtré PAR RÔLE (le mot « MROS » n'atteint jamais RM/ARM, art. 10a) ──
  async healthCheck(ctx: Ctx, instanceId: string) {
    const e = await this.etat(ctx, instanceId);
    const brut = await this.evaluerGuards(ctx, e);
    const detailVisible = ROLES_DETAIL_MROS.includes(ctx.role);
    const guards = brut.map((g) => (g.guard === "MROS" && !detailVisible)
      ? { guard: "COMPLIANCE", severite: g.severite, echec: g.echec,
          motif: g.echec ? MOTIF_NEUTRE : "aucune vérification en cours" }
      : { guard: g.guard, severite: g.severite, echec: g.echec, motif: g.detail });
    return { instanceId, etat: e.etat, guards };
  }

  // ── R441/R13 — visa du maillon courant + tentative de transition (guards évalués) ──
  async viser(ctx: Ctx, instanceId: string) {
    const e = await this.etat(ctx, instanceId);
    if (e.etat === "Clôturé")
      throw new ConflictException("Dossier Clôturé — lecture seule intégrale (R444/R49)");
    if (ctx.userId === e.initiateur)
      throw new ForbiddenException("Exclusion 4-yeux — initiateur du dossier (R13)");
    const chaine: string[] = e.chaine;
    const maillon = e.visas.length;                              // prochain maillon = projection des visas
    if (maillon >= chaine.length && e.etat !== "Validation")
      throw new ConflictException("Chaîne d'approbation épuisée avant la clôture — état incohérent");
    const roleAttendu = chaine[Math.min(maillon, chaine.length - 1)];
    const roleEffectif = maillon < chaine.length ? roleAttendu : chaine[chaine.length - 1];
    if (maillon < chaine.length && ctx.role !== roleAttendu && ctx.role !== "ADMIN")
      throw new ForbiddenException(`R441 : ce maillon attend le rôle ${roleAttendu} (reçu ${ctx.role})`);
    const visa = { validateur: ctx.userId, role: maillon < chaine.length ? roleAttendu : ctx.role,
      at: new Date().toISOString() };                            // objet R15 : nommé, horodaté

    // cible de transition selon l'état projeté
    const cible = e.etat === "Création" ? "Review"               // Création→Collecte auto + Collecte→Review
      : e.etat === "Collecte" ? "Review"
      : e.etat === "Review" ? "Validation"
      : "Clôturé";

    // R440/R443 : ÉVALUATION AVANT toute écriture — un refus doit laisser sa trace GUARD_BLOCKED
    // même si la transition est refusée (l'événement de refus s'écrit HORS transaction annulée).
    const garder = cible === "Validation" || cible === "Clôturé";
    if (cible === "Clôturé") {
      const manquants = e.checklist.filter((i: any) => i.obligatoire && !i.coche);
      if (manquants.length && (e.guards["CHECKLIST"] ?? "BLOQUANT") === "BLOQUANT") {
        await emitEvent(this.prisma, ctx.tenantId, "GUARD_BLOCKED", instanceId, { guard: "CHECKLIST",
          reason: `Item obligatoire non validé : ${manquants[0].label}`, etape: e.etat });
        throw new ConflictException(`R443 : item obligatoire non validé — ${manquants[0].label}`);
      }
    }
    const avertissements: { guard: string; reason: string }[] = [];
    if (garder) {
      const guards = await this.evaluerGuards(ctx, e);
      for (const g of guards.filter((x) => x.echec)) {
        if (g.severite === "BLOQUANT") {
          await emitEvent(this.prisma, ctx.tenantId, "GUARD_BLOCKED", instanceId,
            { guard: g.guard, reason: g.detail, etape: e.etat });
          throw new ConflictException(`R440 : transition refusée — ${g.detail}`);
        }
        avertissements.push({ guard: g.guard, reason: g.detail });
      }
    }
    return this.prisma.$transaction(async (tx: Tx) => {
      for (const a of avertissements)
        await emitEvent(tx, ctx.tenantId, "GUARD_WARNING", instanceId,
          { guard: a.guard, reason: a.reason, etape: e.etat });
      // maillons intermédiaires au-delà des 3 transitions : visas multiples R1 portés par la clôture
      if (e.etat === "Validation" && maillon < chaine.length - 1) {
        await emitEvent(tx, ctx.tenantId, "VISA_APPOSE", instanceId,
          { validateur: visa.validateur, role: roleEffectif, at: visa.at, maillon });
        await this.audit.log(ctx.tenantId, ctx.userId, "OFFB_VISA", `${instanceId}:${maillon}`);
        return { instanceId, etat: e.etat, visaN: maillon + 1 };
      }
      if (e.etat === "Création")                                 // Création→Collecte auto au premier visa
        await emitEvent(tx, ctx.tenantId, "TRANSITION_FIRED", instanceId,
          { from: "Création", to: "Collecte", visa: null });
      await emitEvent(tx, ctx.tenantId, "TRANSITION_FIRED", instanceId,
        { from: e.etat === "Création" ? "Collecte" : e.etat, to: cible, visa });
      if (cible === "Clôturé")
        await emitEvent(tx, ctx.tenantId, "WORKFLOW_COMPLETED", instanceId, { par: ctx.userId });
      await this.audit.log(ctx.tenantId, ctx.userId, "OFFB_TRANSITION", `${instanceId}:${cible}`);
      return { instanceId, etat: cible };
    });
  }

  // ── R443 — cocher un item : événement append-only, jamais un UPDATE ──
  async cocherItem(ctx: Ctx, instanceId: string, label: string) {
    const e = await this.etat(ctx, instanceId);
    if (e.etat === "Clôturé")
      throw new ConflictException("Dossier Clôturé — lecture seule intégrale (R444/R49)");
    if (!e.checklist.some((i: any) => i.label === label))
      throw new BadRequestException(`Item inconnu de la checklist figée à l'initiation : ${label}`);
    await this.prisma.$transaction(async (tx: Tx) => {
      await emitEvent(tx, ctx.tenantId, "CHECKLIST_ITEM_CHECKED", instanceId, { label, par: ctx.userId });
      await this.audit.log(ctx.tenantId, ctx.userId, "OFFB_CHECKLIST", `${instanceId}:${label.slice(0, 40)}`);
    });
    return this.etat(ctx, instanceId);
  }

  // ── R444/R51 — audit trail : REQUÊTE directe par ID, jamais une reconstruction ──
  async auditTrail(ctx: Ctx, instanceId: string) {
    return this.prisma.domainEvent.findMany({
      where: { tenantId: ctx.tenantId, aggregateId: instanceId }, orderBy: { id: "asc" } });
  }
}
