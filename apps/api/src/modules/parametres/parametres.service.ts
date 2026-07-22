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
  { cle: "crmEntretiens", type: "json", defaut: [], regle: "R188", requis: false,
    description: "Types d'entretiens client et champs obligatoires par type — la trace du conseil (LSFin). Un champ obligatoire manquant est un refus explicite : la documentation du conseil n'est pas optionnelle." },
  { cle: "workloadResponsables", type: "json", defaut: [], regle: "R183", requis: false,
    description: "Qui chapeaute qui : liste {responsableRole, equipeRole}. Le responsable déclaré voit la charge de son équipe ; chaque collaborateur voit toujours ses propres mesures (transparence structurelle, art. 26 OLT 3)." },
  { cle: "workloadBareme", type: "json", defaut: [], regle: "R185", requis: false,
    description: "Barème de bonification versionné par date d'effet : [{depuisLe, points{TYPE: pts}}]. Un accomplissement garde à vie les points du barème de son jour — jamais rétroactif. Alimente le module RH, ne calcule aucun bonus." },
  { cle: "workloadCapacite", type: "json", defaut: { standardParSemaine: 10, seuilSurchargePct: 80 }, regle: "R183/R184", requis: false,
    description: "Capacité standard (pondération hebdomadaire) et seuil de surcharge (%). La surcharge est un signal au responsable — le système ne déplace jamais une tâche lui-même." },
  { cle: "docStorage", type: "json", defaut: { adaptateur: "COFFRE_INTERNE" }, regle: "R180", requis: false,
    description: "Hébergeur documentaire de l'établissement : coffre interne O-Live, stockage objet suisse, ou GED existante de la banque (adaptateur déclaré). Le changer est un acte motivé, jamais rétroactif — les invariants de preuve ne bougent pas (R181)." },
  { cle: "gedDocTypes", type: "json", defaut: null, regle: "R110/R112", requis: true,
    exemple: [{ code: "PASSEPORT", validiteMois: 120, requisPour: ["KYC_VALIDATION"], rolesAutorises: ["RM", "CO", "CF"] }],
    description: "Référentiel des types de documents : validité, exigences par passage, rôles autorisés, retentionAnnees (R170 : la rétention naît au classement) · chaque type peut porter son gabarit d'extraction OCR versionné (champs, contrôles, mapping — R174)" },
  { cle: "onboardingSlaJours", type: "json", defaut: { COLLECTE: 30, KYC_EN_COURS: 45, DECISION: 10 },
    regle: "R120", requis: false, description: "SLA par étape du funnel d'onboarding (jours)" },
  { cle: "iaPrerevueTraitementRequis", type: "bool", defaut: false, regle: "R123", requis: false,
    description: "Exiger le traitement de tous les points de pré-revue IA avant visa ?" },
  { cle: "iaPseudonymise", type: "bool", defaut: true, regle: "R124", requis: false,
    description: "Pseudonymiser les identités avant transmission au port IA ?" },
  { cle: "screeningSeuil", type: "int", defaut: 85, regle: "R100", requis: false,
    description: "Seuil de similarité du screening (0-100)" },
  { cle: "workflowRoles", type: "json", defaut: ["CO", "ADMIN"], regle: "R173", requis: false,
    description: "Rôles habilités à éditer et publier les définitions de workflow (l'atelier gouverné)" },
  { cle: "coreMapping", type: "json", defaut: [], regle: "R169", requis: false,
    description: "Correspondances compteCore ↔ clientId, versionnées à date de mise en vigueur (depuisLe) — l'inconnu va en quarantaine" },
  { cle: "coreSystemeRef", type: "string", defaut: null, regle: "R167", requis: false,
    description: "Référence contractuelle du connecteur core banking (port déclaré : système, version, périmètre)" },
  { cle: "vueRoles", type: "json", defaut: ["CO", "CF", "ADMIN"], regle: "R164", requis: false,
    description: "Rôles habilités à créer/retirer des dossiers-vues (la vue est une requête, jamais une copie)" },
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
  // ── Surveillance AML private banking — R189→R206 (Bloc 48). Chaque seuil est une règle :
  //    le régler passe par LE registre (motivé, daté, jamais rétroactif). L'onglet
  //    « Paramétrages AML » est la vue filtrée de ces clés (préfixe `aml`). ──
  { cle: "amlStructuringAlertCount", type: "int", defaut: 5, regle: "R189", requis: false,
    description: "Nombre de virements sous le seuil qui déclenche un signal de structuring" },
  { cle: "amlStructuringSeuilChf", type: "int", defaut: 100000, regle: "R189", requis: false,
    description: "Seuil (CHF) sous lequel un fractionnement devient suspect" },
  { cle: "amlStructuringFenetreH", type: "int", defaut: 48, regle: "R189", requis: false,
    description: "Fenêtre (heures) d'agrégation du pattern de structuring" },
  { cle: "amlCrossBorderFenetreH", type: "int", defaut: 48, regle: "R190", requis: false,
    description: "Fenêtre (heures) des mouvements cross-border circulaires même UBO" },
  { cle: "amlCrossBorderMinPays", type: "int", defaut: 2, regle: "R190", requis: false,
    description: "Nombre minimum de juridictions distinctes pour un signal cross-border" },
  { cle: "amlVelocityDormantMois", type: "int", defaut: 18, regle: "R191", requis: false,
    description: "Ancienneté (mois) au-delà de laquelle un compte est réputé dormant" },
  { cle: "amlVelocityMultiplicateur", type: "int", defaut: 5, regle: "R191", requis: false,
    description: "Multiplicateur de la moyenne au-delà duquel la vélocité devient inhabituelle" },
  { cle: "amlInOutFenetreH", type: "int", defaut: 6, regle: "R194", requis: false,
    description: "Fenêtre (heures) entrée→sortie ≈montant (layering même jour)" },
  { cle: "amlCircularFenetreJours", type: "int", defaut: 10, regle: "R196", requis: false,
    description: "Fenêtre (jours) d'un cycle A→B→C→A entre comptes du même UBO" },
  { cle: "amlHriPays", type: "json", defaut: ["Iran", "Syrie", "Corée du Nord", "Cuba"], regle: "R197", requis: false,
    description: "Juridictions à haut risque (blocage en attente d'approbation CO)" },
  { cle: "amlRoundSeuilPct", type: "int", defaut: 70, regle: "R198", requis: false,
    description: "Part (%) de montants ronds au-delà de laquelle le pattern est signalé" },
  { cle: "amlCashWirePct", type: "int", defaut: 80, regle: "R199", requis: false,
    description: "Part (%) d'un dépôt espèces re-virée qui déclenche le signal cash→wire" },
  { cle: "amlCashWireFenetreH", type: "int", defaut: 24, regle: "R199", requis: false,
    description: "Fenêtre (heures) dépôt espèces → virement sortant" },
  { cle: "amlCounterpartyFacteurPct", type: "int", defaut: 150, regle: "R202", requis: false,
    description: "Facteur (%) sur (moyenne + σ) au-delà duquel un montant contrepartie explose" },
  { cle: "amlCrsResidences", type: "json", defaut: ["France", "Allemagne", "Italie", "Espagne", "USA", "FR", "DE", "US"], regle: "R203", requis: false,
    description: "Résidences fiscales dans le périmètre CRS/FATCA" },
  { cle: "amlCrsSeuilChf", type: "int", defaut: 1000000, regle: "R203", requis: false,
    description: "Seuil de solde (CHF) au-delà duquel l'absence d'auto-certification bloque" },
  { cle: "amlFiduciaireSeuilPct", type: "int", defaut: 10, regle: "R204", requis: false,
    description: "Part (%) des dépôts clients au-delà de laquelle un retrait personnel est un abus" },
  { cle: "amlConcentrationSeuilPct", type: "int", defaut: 80, regle: "R206", requis: false,
    description: "Part (%) du patrimoine sur ≤2 comptes courants qui signale une concentration" },
  { cle: "amlTaxHavens", type: "json", defaut: ["Luxembourg", "Jersey", "Guernesey", "Îles Caïmans", "Cayman"], regle: "R205", requis: false,
    description: "Paradis fiscaux d'un circuit d'optimisation CH→paradis→CH" },
  { cle: "amlListesReglementaires", type: "json", defaut: ["OFAC", "EU", "UN", "SECO"], regle: "R192", requis: false,
    description: "Listes réglementaires de sanctions synchronisées (matching → refus immédiat)" },
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
