import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";

/**
 * Gouvernance des paramètres tenant — R125→R128 (RQ-01..06). Écrit APRÈS l'amendement, APRÈS les tests.
 * Le questionnaire R-Q devient EXÉCUTABLE : le registre est le seul chemin d'écriture (typé,
 * rattaché aux règles — R125) ; tout changement est motivé (R7), daté, append-only, à effet
 * immédiat ou différé — jamais rétroactif (R126/R29/R48) ; la config se rejoue à date (R127/R49) ;
 * l'activation exige le questionnaire complet ET signé (R128, gate structurel type R13).
 * Tenant.settings = VUE COURANTE matérialisée ; la VÉRITÉ = tenant_param_changes.
 */

type Ctx = { tenantId: string; userId: string; role: string };
type Entree = { cle: string; type: "int" | "bool" | "json" | "string"; defaut: any;
  regle: string; requis: boolean; exemple?: any; description: string };

/** LE registre — s'enrichit par amendement, comme le catalogue. Généré → questionnaire R-Q. */
export const REGISTRE_RQ: Entree[] = [
  { cle: "cumulRolesAutorise", type: "bool", defaut: false, regle: "R31", requis: true,
    description: "Une personne peut-elle cumuler plusieurs rôles sur un même client ?" },
  { cle: "depepDelaiJours", type: "int", defaut: 365, regle: "R33", requis: false,
    description: "Délai de revue après perte de statut PEP (grandfathering)" },
  { cle: "goldenRecordMapping", type: "json", defaut: ["riskLevel"], regle: "R104", requis: false,
    description: "Champs propagés du KYC validé vers le client (liste fermée)" },
  { cle: "pmsDriftToleranceBp", type: "int", defaut: 200, regle: "R105", requis: false,
    description: "Tolérance (points de base) avant qu'un écart d'allocation devienne un drift" },
  { cle: "pmsBreachDelaiJours", type: "int", defaut: 30, regle: "R108", requis: false,
    description: "Délai de régularisation d'un breach avant escalade" },
  { cle: "gedDocTypes", type: "json", defaut: null, regle: "R110/R112", requis: true,
    exemple: [{ code: "PASSEPORT", validiteMois: 120, requisPour: ["KYC_VALIDATION"], rolesAutorises: ["RM", "CO", "CF"] }],
    description: "Référentiel des types de documents : validité, exigences par passage, rôles autorisés" },
  { cle: "onboardingSlaJours", type: "json", defaut: { COLLECTE: 30, KYC_EN_COURS: 45, DECISION: 10 },
    regle: "R120", requis: false, description: "SLA par étape du funnel d'onboarding (jours)" },
  { cle: "iaPrerevueTraitementRequis", type: "bool", defaut: false, regle: "R123", requis: false,
    description: "Exiger le traitement de tous les points de pré-revue IA avant visa ?" },
  { cle: "iaPseudonymise", type: "bool", defaut: true, regle: "R124", requis: false,
    description: "Pseudonymiser les identités avant transmission au port IA ?" },
  { cle: "screeningSeuil", type: "int", defaut: 85, regle: "R100", requis: false,
    description: "Seuil de similarité du screening (0-100)" },
  { cle: "iaResidence", type: "string", defaut: "CH", regle: "R163", requis: false,
    description: "Résidence exigée du prestataire IA — un document bancaire suisse ne part pas n'importe où" },
  { cle: "iaProviderRef", type: "string", defaut: null, regle: "R163", requis: false,
    description: "Référence contractuelle du prestataire IA (port)" },
  { cle: "annotationRoles", type: "json", defaut: ["CO", "CF", "RM"], regle: "R157", requis: false,
    description: "Rôles habilités à annoter (le calque — jamais l'original)" },
  { cle: "caviardageRoles", type: "json", defaut: ["CO", "CF"], regle: "R158", requis: false,
    description: "Rôles habilités à produire un dérivé caviardé (zones motivées, base légale)" },
  { cle: "lienRolesOfficiels", type: "json", defaut: ["CO", "CF", "RM"], regle: "R152", requis: false,
    description: "Rôles habilités à poser/retirer un lien OFFICIEL (settlor, PoA, signataire…)" },
  { cle: "lienRolesNonOfficiels", type: "json", defaut: ["RM", "CO", "CF"], regle: "R152", requis: false,
    description: "Rôles habilités à poser/retirer une relation NON officielle (père de, époux de…)" },
  { cle: "lienTypes", type: "json", defaut: null, regle: "R153", requis: false,
    description: "Référentiel des types de liens (null = référentiel semé spec §6.2/6.3, avec inverses R154)" },
  { cle: "storageRegion", type: "string", defaut: "ch-gva-2", regle: "R144/R146", requis: false,
    description: "Région de résidence du coffre (Exoscale SOS — engagement contractuel suisse)" },
  { cle: "storageChiffrement", type: "string", defaut: null, regle: "R146", requis: false,
    description: "Référence d'enveloppe de chiffrement par tenant, transmise au coffre" },
  { cle: "txGardes", type: "json", defaut: {}, regle: "R141", requis: false,
    description: "Sévérité par garde du portail transactionnel (BLOQUANT|SUSPENSIF|INFORMATIF)" },
  { cle: "txRevueRoles", type: "json", defaut: ["CO", "MLRO"], regle: "R143", requis: false,
    description: "Rôles habilités sur la file de revue des transactions suspendues" },
  { cle: "txRevueSlaHeures", type: "int", defaut: 24, regle: "R143", requis: false,
    description: "SLA de revue des suspensions (heures) — alerte, jamais de libération auto" },
  { cle: "txComportement", type: "json", defaut: { fenetreHeures: 48, maxTxFenetre: 3, multiplicateurVolumetrie: 3, typesSensibles: ["CONVERSION_CRYPTO"] },
    regle: "R142", requis: false, description: "Garde comportement : fenêtres et multiplicateurs PAR PROFIL (réponse FINMA 02/2026)" },
  { cle: "gedCanauxIngestion", type: "json", defaut: ["SCAN", "EMAIL", "UPLOAD", "API"], regle: "R137",
    requis: false, description: "Canaux d'entrée autorisés des documents (default-deny)" },
  { cle: "gedInboxRoles", type: "json", defaut: ["CO", "CF"], regle: "R139", requis: false,
    description: "Rôles habilités sur la boîte d'arrivée GED (default-deny tracé)" },
  { cle: "gedInboxSlaJours", type: "int", defaut: 2, regle: "R139", requis: false,
    description: "SLA de classement de la boîte d'arrivée (jours) — alerte, jamais d'auto-classement" },
  { cle: "slaKycJours", type: "int", defaut: 30, regle: "R39", requis: false,
    description: "SLA indicatif de traitement d'un dossier KYC (mesure, jamais coercition)" },
  { cle: "riskCaseSlaJours", type: "json", defaut: { NOUVELLE: 2, EN_ANALYSE: 15, CLARIFICATION: 10 },
    regle: "R135", requis: false, description: "SLA d'instruction des risk cases par état (jours)" },
  { cle: "mrosRolesHabilites", type: "json", defaut: ["MLRO"], regle: "R129/R132", requis: false,
    description: "Rôles habilités à décider et lire une communication MROS (art. 9/10a LBA)" },
  { cle: "mrosGelJoursOuvrables", type: "int", defaut: 5, regle: "R131", requis: false,
    description: "Échéance de surveillance du gel des avoirs (jours ouvrables, art. 10 LBA)" },
  { cle: "rqRepondant", type: "string", defaut: null, regle: "R128", requis: true,
    exemple: "compliance@banque.ch", description: "Répondant bancaire du questionnaire R-Q (contact contractuel)" },
];

const bonType = (t: Entree["type"], v: any) =>
  t === "int" ? Number.isInteger(v)
  : t === "bool" ? typeof v === "boolean"
  : t === "string" ? typeof v === "string"
  : v !== null && typeof v === "object";

@Injectable()
export class ParametresService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private emit(tx: any, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload, at: new Date().toISOString() } });
  }
  private async tenant(tx: any, ctx: Ctx) {
    const t = await tx.tenant.findFirst({ where: { id: ctx.tenantId } });
    if (!t) throw new NotFoundException("Tenant introuvable");
    return t;
  }

  // ── R125 / RQ-02 : le questionnaire se GÉNÈRE du registre ──
  async registre() { return REGISTRE_RQ; }

  // ── R125/R126 / RQ-01,03,04 : LE chemin d'écriture — typé, motivé, daté, jamais rétroactif ──
  async ecrire(ctx: Ctx, cle: string, valeur: any, motif: string, effetAt?: string) {
    const entree = REGISTRE_RQ.find((e) => e.cle === cle);
    if (!entree) throw new BadRequestException(`R125 : clé inconnue du registre — «${cle}»`);
    if (!bonType(entree.type, valeur))
      throw new BadRequestException(`R125 : type ${entree.type} attendu pour «${cle}»`);
    if (!motif || !motif.trim())
      throw new BadRequestException("R7 : changer un paramètre est changer une règle — motif obligatoire");
    const effet = effetAt ?? new Date().toISOString();
    if (new Date(effet).getTime() < Date.now() - 60_000)
      throw new BadRequestException("R126 : effet rétroactif refusé — on ne réécrit pas le passé (R48)");
    return this.prisma.$transaction(async (tx: any) => {
      const t = await this.tenant(tx, ctx);
      const avant = await this.valeurEffectiveTx(tx, ctx, cle, new Date());
      await tx.tenantParamChange.create({ data: { tenantId: ctx.tenantId, cle,
        avant, apres: valeur, motif: motif.trim(), par: ctx.userId,
        at: new Date().toISOString(), effetAt: effet } });                       // VÉRITÉ append-only
      if (new Date(effet).getTime() <= Date.now()) {                             // matérialisation immédiate
        const settings = { ...(t.settings as any), [cle]: valeur };
        await tx.tenant.update({ where: { id: t.id }, data: { settings } });
      }                                                                          // sinon : tickEffets
      await this.emit(tx, ctx.tenantId, "param.change", cle,
        { avant, apres: valeur, par: ctx.userId, motif: motif.trim(), effetAt: effet });
      await this.audit.log(ctx.tenantId, ctx.userId, "PARAM_CHANGED", `${cle}`);
    });
  }

  // ── R127 / RQ-05 : la valeur d'alors — reconstruite des changements, sinon le défaut ──
  private async valeurEffectiveTx(tx: any, ctx: Ctx, cle: string, date: Date) {
    const chgs = (await tx.tenantParamChange.findMany({ where: { tenantId: ctx.tenantId, cle } }))
      .filter((c: any) => new Date(c.effetAt) <= date)
      .sort((a: any, b: any) => new Date(a.effetAt).getTime() - new Date(b.effetAt).getTime());
    if (chgs.length) return chgs[chgs.length - 1].apres;
    return REGISTRE_RQ.find((e) => e.cle === cle)?.defaut ?? null;
  }
  async valeurEffective(ctx: Ctx, cle: string, date: Date) {
    await this.tenant(this.prisma, ctx);
    return this.valeurEffectiveTx(this.prisma, ctx, cle, date);
  }
  async configALaDate(ctx: Ctx, date: Date) {
    await this.tenant(this.prisma, ctx);
    const cfg: Record<string, any> = {};
    for (const e of REGISTRE_RQ) cfg[e.cle] = await this.valeurEffectiveTx(this.prisma, ctx, e.cle, date);
    return cfg;
  }

  // ── R126 : tick — applique les effets différés atteints (matérialise la vue courante) ──
  async tickEffets(ctx: Ctx, now: Date) {
    return this.prisma.$transaction(async (tx: any) => {
      const t = await this.tenant(tx, ctx);
      const settings = { ...(t.settings as any) };
      let touche = false;
      for (const e of REGISTRE_RQ) {
        const v = await this.valeurEffectiveTx(tx, ctx, e.cle, now);
        if (v !== null && JSON.stringify(settings[e.cle]) !== JSON.stringify(v) && v !== e.defaut) {
          settings[e.cle] = v; touche = true;
          await this.emit(tx, ctx.tenantId, "param.effet.applique", e.cle, { valeur: v });
        }
      }
      if (touche) await tx.tenant.update({ where: { id: t.id }, data: { settings } });
    });
  }

  // ── R128 / RQ-06 : pas de go-live sur un questionnaire troué ──
  async activer(ctx: Ctx, signataire: string) {
    if (!signataire || !signataire.trim())
      throw new BadRequestException("R128 : signature du répondant bancaire obligatoire");
    return this.prisma.$transaction(async (tx: any) => {
      const t = await this.tenant(tx, ctx);
      const manquants: string[] = [];
      for (const e of REGISTRE_RQ.filter((x) => x.requis)) {
        const v = await this.valeurEffectiveTx(tx, ctx, e.cle, new Date());
        if (v === null || v === undefined) manquants.push(e.cle);
      }
      if (manquants.length)
        throw new BadRequestException(`R128 : questionnaire R-Q incomplet — requis manquants : ${manquants.join(", ")}`);
      await tx.tenant.update({ where: { id: t.id }, data: { statut: "ACTIF",
        rqSignePar: signataire.trim(), rqSigneAt: new Date().toISOString() } });
      await this.emit(tx, ctx.tenantId, "tenant.active", t.id, { signePar: signataire.trim(), par: ctx.userId });
      await this.audit.log(ctx.tenantId, ctx.userId, "TENANT_ACTIVATED", t.id);
      return { statut: "ACTIF" };
    });
  }
}
