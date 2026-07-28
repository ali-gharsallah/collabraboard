import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { Tx } from "../../common/tx";

/**
 * Personnes liées — le lien est un acte. R152→R155 (PL-01..04). Écrit APRÈS l'amendement,
 * APRÈS les tests. Ancrage : spec produit §6 (rôles officiels · relations bijectives).
 * R152 : lier/retirer exige un droit du registre (lienRolesOfficiels / lienRolesNonOfficiels),
 * default-deny, tentative tracée (mécanique R112), retrait motivé (R7).
 * R153 : les types viennent du RÉFÉRENTIEL (lienTypes, semé spec §6.2/6.3, extensible tenant) ;
 * le cumul est la règle ; le doublon exact est refusé ; hors référentiel = refus.
 * R154 : le non-officiel est BIJECTIF — l'inverse se pose dans la même transaction (paireId),
 * UN événement pour la paire, le retrait retire les deux côtés.
 * R155 : chercher-ou-créer — exister = lier ; créer = minimal + tâche de complétion +
 * signal d'homonymie (qui n'empêche pas — R39 : le système signale, l'humain décide).
 * L'UI (bouton → popup → boutons de rôles cumulables) consomme typesDisponibles.
 */

type Ctx = { tenantId: string; userId: string; role: string };
type LienDto = { personneId: string; typeCode: string; cibleType: string; cibleId: string };

const TYPES_DEFAUT = {
  officiels: [
    { code: "SETTLOR", label: "Fondateur / Settlor" }, { code: "TRUSTEE", label: "Trustee" },
    { code: "PROTECTEUR", label: "Protecteur" }, { code: "BENEFICIAIRE", label: "Bénéficiaire" },
    { code: "CONSEIL_FONDATION", label: "Membre du conseil de fondation" },
    { code: "UBO", label: "Ayant droit économique (UBO)" },
    { code: "DETENTEUR_CONTROLE", label: "Détenteur du contrôle" },
    { code: "TITULAIRE", label: "Titulaire" }, { code: "CO_TITULAIRE", label: "Co-titulaire" },
    { code: "POWER_OF_ATTORNEY", label: "Fondé de pouvoir (PoA)" },
    { code: "POWER_OF_INFORMATION", label: "Power of information" },
    { code: "SIGNATAIRE", label: "Signataire autorisé" },
    { code: "ADMINISTRATEUR", label: "Administrateur / Directeur" },
    { code: "APPORTEUR", label: "Apporteur d'affaires" },
    { code: "CONSEILLER_EXTERNE", label: "Conseiller externe (avocat, fiduciaire)" },
  ],
  nonOfficiels: [
    { code: "PERE_DE", label: "Père de", inverse: "FILS_FILLE_DE" },
    { code: "MERE_DE", label: "Mère de", inverse: "FILS_FILLE_DE" },
    { code: "FILS_FILLE_DE", label: "Fils/Fille de", inverse: "PERE_DE" },
    { code: "EPOUX_DE", label: "Époux·se de", inverse: "EPOUX_DE" },
    { code: "FRERE_SOEUR_DE", label: "Frère/Sœur de", inverse: "FRERE_SOEUR_DE" },
    { code: "ONCLE_TANTE_DE", label: "Oncle/Tante de", inverse: "NEVEU_NIECE_DE" },
    { code: "NEVEU_NIECE_DE", label: "Neveu/Nièce de", inverse: "ONCLE_TANTE_DE" },
    { code: "ASSOCIE_DE", label: "Associé de", inverse: "ASSOCIE_DE" },
    { code: "AMI_PROCHE_DE", label: "Ami proche de", inverse: "AMI_PROCHE_DE" },
  ],
};

@Injectable()
export class PersonneLienService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload, at: new Date().toISOString() } });
  }
  private async cfg(tx: Tx, tenantId: string) {
    const t = await tx.tenant.findFirst({ where: { id: tenantId } });
    const s = (t?.settings as any) ?? {};
    return {
      rolesOff: s.lienRolesOfficiels ?? ["CO", "CF", "RM"],
      rolesNon: s.lienRolesNonOfficiels ?? ["RM", "CO", "CF"],
      types: s.lienTypes ?? TYPES_DEFAUT,
    };
  }
  /** Le référentiel servi à l'UI — les BOUTONS du popup (R153). */
  async typesDisponibles(ctx: Ctx) {
    return (await this.cfg(this.prisma, ctx.tenantId)).types;
  }
  private trouve(types: any, code: string) {
    const off = (types.officiels ?? []).find((t: any) => t.code === code);
    if (off) return { ...off, categorie: "OFFICIEL" };
    const non = (types.nonOfficiels ?? []).find((t: any) => t.code === code);
    if (non) return { ...non, categorie: "NON_OFFICIEL" };
    return null;
  }

  // ── R152/R153/R154 : lier ──
  async lier(ctx: Ctx, dto: LienDto) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const { rolesOff, rolesNon, types } = await this.cfg(tx, ctx.tenantId);
      const typ = this.trouve(types, dto.typeCode);
      if (!typ) throw new BadRequestException(`R153 : type « ${dto.typeCode} » hors référentiel (lienTypes)`);
      const roles = typ.categorie === "OFFICIEL" ? rolesOff : rolesNon;
      if (!roles.includes(ctx.role)) {
        await this.emit(tx, ctx.tenantId, "personne.lien.acces.refuse", dto.personneId,
          { par: ctx.userId, role: ctx.role, typeCode: dto.typeCode });
        throw new ForbiddenException(`R152 : rôle ${ctx.role} non habilité à poser un lien ${typ.categorie}`);
      }
      // Anomalie A3 SOLDÉE (ratification 2026-07-28) : le référentiel est le modèle `Person`
      // (R30) — le délégué fantôme `personne` crashait à l'exécution. Le service reste DORMANT
      // (écart de dormance inchangé) mais désormais conforme au schéma réel.
      const pers = await tx.person.findFirst({ where: { id: dto.personneId, tenantId: ctx.tenantId } });
      if (!pers) throw new NotFoundException("Personne introuvable");
      const doublon = await tx.personneLien.findFirst({ where: { tenantId: ctx.tenantId,
        personneId: dto.personneId, typeCode: dto.typeCode, cibleType: dto.cibleType, cibleId: dto.cibleId } });
      if (doublon) throw new BadRequestException("R153 : doublon exact — le lien existe déjà (le cumul porte sur des TYPES différents)");
      const at = new Date().toISOString();
      const lien = await tx.personneLien.create({ data: { tenantId: ctx.tenantId,
        personneId: dto.personneId, typeCode: dto.typeCode, categorie: typ.categorie,
        cibleType: dto.cibleType, cibleId: dto.cibleId, paireId: null, posePar: ctx.userId, poseAt: at } });
      // R154 : l'inverse, atomique — pour le non-officiel personne↔personne.
      if (typ.categorie === "NON_OFFICIEL" && dto.cibleType === "PERSONNE" && typ.inverse) {
        await tx.personneLien.create({ data: { tenantId: ctx.tenantId,
          personneId: dto.cibleId, typeCode: typ.inverse, categorie: "NON_OFFICIEL",
          cibleType: "PERSONNE", cibleId: dto.personneId, paireId: lien.id, posePar: ctx.userId, poseAt: at } });
      }
      await this.emit(tx, ctx.tenantId, "personne.lien.pose", dto.personneId,
        { par: ctx.userId, typeCode: dto.typeCode, categorie: typ.categorie,
          cibleType: dto.cibleType, cibleId: dto.cibleId });
      await this.audit.log(ctx.tenantId, ctx.userId, "PERSON_LINK", `${dto.personneId}:${dto.typeCode}`);
      return { lienId: lien.id };
    });
  }

  // ── R152/R154 : retirer — motivé, les deux côtés ──
  async retirer(ctx: Ctx, lienId: string, motif: string) {
    return this.prisma.$transaction(async (tx: Tx) => {
      if (!motif || !motif.trim()) throw new BadRequestException("R7 : le retrait d'un lien exige un motif");
      const lien = await tx.personneLien.findFirst({ where: { id: lienId, tenantId: ctx.tenantId } });
      if (!lien) throw new NotFoundException("Lien introuvable");
      const { rolesOff, rolesNon } = await this.cfg(tx, ctx.tenantId);
      const roles = lien.categorie === "OFFICIEL" ? rolesOff : rolesNon;
      if (!roles.includes(ctx.role)) {
        await this.emit(tx, ctx.tenantId, "personne.lien.acces.refuse", lien.personneId,
          { par: ctx.userId, role: ctx.role, retrait: lienId });
        throw new ForbiddenException(`R152 : rôle ${ctx.role} non habilité au retrait`);
      }
      await tx.personneLien.deleteMany({ where: { tenantId: ctx.tenantId, id: lienId } });
      await tx.personneLien.deleteMany({ where: { tenantId: ctx.tenantId, paireId: lienId } });   // R154 : le miroir part avec
      await this.emit(tx, ctx.tenantId, "personne.lien.retrait", lien.personneId,
        { par: ctx.userId, typeCode: lien.typeCode, motif: motif.trim() });
    });
  }

  // ── R155 : chercher-ou-créer-et-lier — LE geste du popup ──
  async chercherOuCreerEtLier(ctx: Ctx, dto: { nom: string; type: string; typeCode: string;
    cibleType: string; cibleId: string; creer?: boolean }) {
    return this.prisma.$transaction(async (tx: Tx) => {
      let pers;
      if (!dto.creer) {
        // Le popup a SÉLECTIONNÉ une existante : on lie, on ne crée pas.
        pers = await tx.person.findFirst({ where: { tenantId: ctx.tenantId, nom: dto.nom } });
        if (!pers)
          throw new NotFoundException(`R155 : « ${dto.nom} » introuvable — repasser avec creer:true pour créer une fiche minimale`);
      } else {
        // L'humain a cliqué « Créer » : on crée — l'homonymie SIGNALE, elle n'empêche pas (R39).
        const homonyme = await tx.person.findFirst({ where: { tenantId: ctx.tenantId, nom: dto.nom } });
        // R30 : la donnée vit dans `donnees` ; R35 : etat ACTIVE — la complétion se trace en donnée.
        pers = await tx.person.create({ data: { tenantId: ctx.tenantId, nom: dto.nom,
          donnees: { type: dto.type ?? null, statutCompletion: "A_COMPLETER",
            creePar: ctx.userId, creeAt: new Date().toISOString() } } });
        await this.emit(tx, ctx.tenantId, "personne.creee.minimale", pers.id, { nom: dto.nom, par: ctx.userId });
        await this.emit(tx, ctx.tenantId, "tache.personne.completion", pers.id, { nom: dto.nom });
        if (homonyme)
          await this.emit(tx, ctx.tenantId, "personne.homonymie.signal", pers.id,
            { nom: dto.nom, homonymeId: homonyme.id });
      }
      const { lienId } = await this.lierInterne(tx, ctx, { personneId: pers.id,
        typeCode: dto.typeCode, cibleType: dto.cibleType, cibleId: dto.cibleId });
      return { personneId: pers.id, lienId };
    });
  }
  /** lier() sans ouvrir une 2e transaction (appel interne de chercherOuCreerEtLier). */
  private async lierInterne(tx: Tx, ctx: Ctx, dto: LienDto) {
    const { rolesOff, rolesNon, types } = await this.cfg(tx, ctx.tenantId);
    const typ = this.trouve(types, dto.typeCode);
    if (!typ) throw new BadRequestException(`R153 : type « ${dto.typeCode} » hors référentiel`);
    const roles = typ.categorie === "OFFICIEL" ? rolesOff : rolesNon;
    if (!roles.includes(ctx.role)) {
      await this.emit(tx, ctx.tenantId, "personne.lien.acces.refuse", dto.personneId,
        { par: ctx.userId, role: ctx.role, typeCode: dto.typeCode });
      throw new ForbiddenException(`R152 : rôle ${ctx.role} non habilité`);
    }
    const doublon = await tx.personneLien.findFirst({ where: { tenantId: ctx.tenantId,
      personneId: dto.personneId, typeCode: dto.typeCode, cibleType: dto.cibleType, cibleId: dto.cibleId } });
    if (doublon) throw new BadRequestException("R153 : doublon exact");
    const at = new Date().toISOString();
    const lien = await tx.personneLien.create({ data: { tenantId: ctx.tenantId,
      personneId: dto.personneId, typeCode: dto.typeCode, categorie: typ.categorie,
      cibleType: dto.cibleType, cibleId: dto.cibleId, paireId: null, posePar: ctx.userId, poseAt: at } });
    if (typ.categorie === "NON_OFFICIEL" && dto.cibleType === "PERSONNE" && typ.inverse)
      await tx.personneLien.create({ data: { tenantId: ctx.tenantId, personneId: dto.cibleId,
        typeCode: typ.inverse, categorie: "NON_OFFICIEL", cibleType: "PERSONNE",
        cibleId: dto.personneId, paireId: lien.id, posePar: ctx.userId, poseAt: at } });
    await this.emit(tx, ctx.tenantId, "personne.lien.pose", dto.personneId,
      { par: ctx.userId, typeCode: dto.typeCode, categorie: typ.categorie,
        cibleType: dto.cibleType, cibleId: dto.cibleId });
    return { lienId: lien.id };
  }
}
