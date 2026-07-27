import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { Tx } from "../../common/tx";

/**
 * Personnes liées — R30→R36 (P-01..08). PORT FIDÈLE du moteur de référence
 * (services/workflow-engine-py/olive_engine/domain.py, bloc 4, 8/8 verts).
 * « Dossier » = KycFile (porte le RM). Tâches et notifications = ÉVÉNEMENTS TRACÉS
 * (invariant n°1 : rien ne change d'état par effet de bord ; le backend n'exécute pas,
 * il trace et propose). Paramètres tenant (voie R-Q) lus dans Tenant.settings :
 *   cumulRolesAutorise (R31, défaut false) · depepDelaiJours (R33, défaut 365).
 */

type Ctx = { tenantId: string; userId: string; role: string };
const IDENTITE = new Set(["nom", "naissance", "nationalite"]);   // R42 : rescreening immédiat

@Injectable()
export class PersonnesService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private async params(tx: Tx, tenantId: string) {
    const t = await tx.tenant.findFirst({ where: { id: tenantId } });
    const s = (t?.settings as any) ?? {};
    return { cumulRolesAutorise: s.cumulRolesAutorise ?? false,
             depepDelaiJours: s.depepDelaiJours ?? 365 };
  }
  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload } });
  }
  private notify(tx: Tx, tenantId: string, aggregateId: string, destinataire: string, message: string) {
    return this.emit(tx, tenantId, "notification", aggregateId, { destinataire, message });
  }
  private async personne(tx: Tx, ctx: Ctx, id: string) {
    const p = await tx.person.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!p) throw new NotFoundException("Personne introuvable");
    return p;
  }
  private async dossiersDe(tx: Tx, ctx: Ctx, personId: string) {
    const roles = await tx.personRole.findMany({ where: { tenantId: ctx.tenantId, personId } });
    const ids = [...new Set(roles.map((r: any) => r.kycFileId))];
    return ids.length ? tx.kycFile.findMany({ where: { tenantId: ctx.tenantId, id: { in: ids } } }) : [];
  }

  // ── R30 : objet unique du référentiel ──
  async creer(ctx: Ctx, dto: { nom: string; donnees?: Record<string, unknown> }) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const p = await tx.person.create({ data: { tenantId: ctx.tenantId, nom: dto.nom,
        donnees: (dto.donnees ?? {}) as any, etat: "ACTIVE", statutPep: false,
        alerteDepepEmise: false, flags: [] } });
      await this.emit(tx, ctx.tenantId, "personne.creee", p.id, { nom: dto.nom });
      await this.audit.log(ctx.tenantId, ctx.userId, "PERSON_CREATED", p.id);
      return p;
    });
  }

  // ── R31 : cumul selon politique banque ; conflit → flag insider obligatoire · R35 : réactivation ──
  async lier(ctx: Ctx, kycFileId: string, personId: string, role: string) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const p = await this.personne(tx, ctx, personId);
      const kyc = await tx.kycFile.findFirst({ where: { id: kycFileId, tenantId: ctx.tenantId } });
      if (!kyc) throw new NotFoundException("Dossier introuvable");
      const existants = await tx.personRole.findMany({ where: {
        tenantId: ctx.tenantId, personId, kycFileId } });
      if (existants.length) {
        const cfg = await this.params(tx, ctx.tenantId);
        if (!cfg.cumulRolesAutorise)
          throw new ForbiddenException(`Cumul de rôles interdit par la politique banque : ` +
            `${personId} est déjà ${existants[0].role} sur ${kycFileId}`);
        if (!p.flags.includes("insider")) {
          await tx.person.update({ where: { id: p.id }, data: { flags: [...p.flags, "insider"] } });
        }
        await this.emit(tx, ctx.tenantId, "personne.flag.pose", personId,
          { flag: "insider", dossier: kycFileId, cause: `cumul:${existants[0].role}+${role}` });
      }
      await tx.personRole.create({ data: { tenantId: ctx.tenantId, personId, kycFileId, role } });
      if (p.etat === "ARCHIVEE") {                                             // R35 réactivable
        await tx.person.update({ where: { id: p.id }, data: { etat: "ACTIVE" } });
        await this.emit(tx, ctx.tenantId, "personne.reactivee", personId, {});
      }
      await this.emit(tx, ctx.tenantId, "personne.liee", personId, { dossier: kycFileId, role });
    });
  }

  // ── R35 : plus aucun rôle → archivée, jamais supprimée (conservation LBA) ──
  async retirerRole(ctx: Ctx, kycFileId: string, personId: string, role: string) {
    return this.prisma.$transaction(async (tx: Tx) => {
      await this.personne(tx, ctx, personId);
      await tx.personRole.deleteMany({ where: { tenantId: ctx.tenantId, personId, kycFileId, role } });
      await this.emit(tx, ctx.tenantId, "personne.role.retire", personId, { dossier: kycFileId, role });
      const restants = await tx.personRole.findMany({ where: { tenantId: ctx.tenantId, personId } });
      if (restants.length === 0) {
        await tx.person.update({ where: { id: personId }, data: { etat: "ARCHIVEE" } });
        await this.emit(tx, ctx.tenantId, "personne.archivee", personId, { baseLegale: "conservation LBA" });
      }
    });
  }

  // ── R31 : flags exposés aux scénarios AML ──
  async flagsAml(ctx: Ctx, personId: string): Promise<string[]> {
    const p = await this.personne(this.prisma, ctx, personId);
    return [...p.flags];
  }

  // ── R30 : CoC — la donnée vit sur la personne ; les dossiers reçoivent des ÉVÉNEMENTS ──
  async changementCirconstances(ctx: Ctx, personId: string, champ: string, valeur: unknown, document?: string) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const p = await this.personne(tx, ctx, personId);
      await tx.person.update({ where: { id: p.id },
        data: { donnees: { ...(p.donnees as any), [champ]: valeur } } });
      await this.emit(tx, ctx.tenantId, "personne.coc.cree", personId, { champ });
      if (document) await this.emit(tx, ctx.tenantId, "tache.maj_ged", personId, { document });
      for (const d of await this.dossiersDe(tx, ctx, personId)) {
        await this.emit(tx, ctx.tenantId, "personne.coc.propage", personId, { dossier: d.id, champ });
        if (d.rmId) await this.notify(tx, ctx.tenantId, personId,
          d.rmId, `CoC ${personId} (${champ}) impacte votre dossier ${d.code ?? d.id}`);
      }
      if (IDENTITE.has(champ))                                                  // R42
        await this.emit(tx, ctx.tenantId, "personne.rescreening.declenche", personId, { cause: `coc:${champ}` });
      await this.audit.log(ctx.tenantId, ctx.userId, "PERSON_COC", `${personId}:${champ}`);
    });
  }

  // ── R32 : PEPisation contagieuse — tâche par dossier, AUCUNE bascule de risque ──
  async declarerPep(ctx: Ctx, personId: string, source: string) {
    return this.prisma.$transaction(async (tx: Tx) => {
      await this.personne(tx, ctx, personId);
      await tx.person.update({ where: { id: personId }, data: { statutPep: true } });
      await this.emit(tx, ctx.tenantId, "personne.pep.declare", personId, { source });
      for (const d of await this.dossiersDe(tx, ctx, personId)) {
        await this.emit(tx, ctx.tenantId, "tache.reevaluation_pep", personId, { dossier: d.id });
        await this.emit(tx, ctx.tenantId, "personne.pep.propage", personId, { dossier: d.id });
        if (d.rmId) await this.notify(tx, ctx.tenantId, personId,
          d.rmId, `${personId} déclaré PEP : réévaluation ${d.code ?? d.id}`);
      }
    });
  }

  async finMandatPep(ctx: Ctx, personId: string, at: Date) {
    await this.personne(this.prisma, ctx, personId);
    await this.prisma.person.update({ where: { id: personId }, data: { finMandatPep: at } });
  }

  // ── R33 : le délai écoulé ne dé-PEPise JAMAIS — il alerte (une fois) ──
  async tickPersonnes(ctx: Ctx, now: Date) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const cfg = await this.params(tx, ctx.tenantId);
      const peps = await tx.person.findMany({ where: {
        tenantId: ctx.tenantId, statutPep: true, alerteDepepEmise: false } });
      for (const p of peps) {
        if (!p.finMandatPep) continue;
        const jours = (now.getTime() - new Date(p.finMandatPep).getTime()) / 86_400_000;
        if (jours < cfg.depepDelaiJours) continue;
        await tx.person.update({ where: { id: p.id }, data: { alerteDepepEmise: true } });
        await this.emit(tx, ctx.tenantId, "personne.alerte.depep", p.id, {});
        await this.notify(tx, ctx.tenantId, p.id, "central_file",
          `Délai post-mandat écoulé pour ${p.id} : décision de dé-PEPisation attendue`);
        for (const d of await this.dossiersDe(tx, ctx, p.id))
          if (d.rmId) await this.notify(tx, ctx.tenantId, p.id, d.rmId, `Dé-PEPisation de ${p.id} à décider`);
      }
    });
  }

  // ── R33 : levée = décision humaine, tracée (décideur = jeton) ──
  async leverPep(ctx: Ctx, personId: string) {
    return this.prisma.$transaction(async (tx: Tx) => {
      await this.personne(tx, ctx, personId);
      await tx.person.update({ where: { id: personId }, data: { statutPep: false } });
      await this.emit(tx, ctx.tenantId, "personne.pep.leve", personId, { decideur: ctx.userId });
      await this.audit.log(ctx.tenantId, ctx.userId, "PEP_LIFTED", personId);
    });
  }

  // ── R34 : bijectivité — une arête, deux lectures ; suppression des deux d'un coup ──
  async declarerRelation(ctx: Ctx, aId: string, bId: string, typeAb: string, typeBa: string) {
    return this.prisma.$transaction(async (tx: Tx) => {
      await this.personne(tx, ctx, aId); await this.personne(tx, ctx, bId);
      await tx.personRelation.create({ data: { tenantId: ctx.tenantId, aId, bId, typeAb, typeBa } });
      await this.emit(tx, ctx.tenantId, "personne.relation.declaree", aId, { b: bId, typeAb, typeBa });
    });
  }
  async relationsDe(ctx: Ctx, personId: string) {
    const rels = await this.prisma.personRelation.findMany({ where: {
      tenantId: ctx.tenantId, OR: [{ aId: personId }, { bId: personId }] } });
    return rels.map((r: any) => r.aId === personId
      ? { autre: r.bId, type: r.typeAb } : { autre: r.aId, type: r.typeBa });
  }
  async supprimerRelation(ctx: Ctx, aId: string, bId: string) {
    return this.prisma.$transaction(async (tx: Tx) => {
      await tx.personRelation.deleteMany({ where: { tenantId: ctx.tenantId, aId, bId } });
      await tx.personRelation.deleteMany({ where: { tenantId: ctx.tenantId, aId: bId, bId: aId } });
      await this.emit(tx, ctx.tenantId, "personne.relation.supprimee", aId, { b: bId });
    });
  }

  // ── R36 : divergence → Central File + corroboration ; AUCUNE donnée modifiée avant décision ──
  async signalerDivergence(ctx: Ctx, personId: string, champ: string, constats: Record<string, unknown>) {
    return this.prisma.$transaction(async (tx: Tx) => {
      await this.personne(tx, ctx, personId);
      await this.emit(tx, ctx.tenantId, "central_file.dossier.ouvert", personId,
        { champ, constats });
      for (const kycFileId of Object.keys(constats)) {
        const d = await tx.kycFile.findFirst({ where: { id: kycFileId, tenantId: ctx.tenantId } });
        // ÉCART A3 (signalé) : KycFile n'a pas de champ rmId (Client.rmUserId existe) — ce
        // `if` ne s'est jamais déclenché ; cast iso-runtime, correction à ratifier.
        if ((d as any)?.rmId) await this.emit(tx, ctx.tenantId, "tache.corroboration", personId,
          { dossier: kycFileId, rm: (d as any).rmId });
      }
      await this.audit.log(ctx.tenantId, ctx.userId, "IDENTITY_DIVERGENCE", `${personId}:${champ}`);
    });
  }
}
