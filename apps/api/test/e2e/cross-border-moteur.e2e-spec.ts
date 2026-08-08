/**
 * Bloc 64 — Cross-Border étendu (repo R453–R462 · session R446–R455 ; R463/R464 GELÉES).
 * Spec exécutable : spec/BLOC-64-CROSS-BORDER-R453-R464.md §3, XB-01..XB-14 transcrits SANS
 * adoucissement — en DELTA sur R293–R295 (le country manual `tripCrossBorderReferentiel`
 * reste LA clé : le port le VERSIONNE, jamais ne le remplace) et MOD-43 (codes XB-<pays>).
 * A3 : 14 rouges avant tout code moteur (squelette BLOC64_NON_IMPLEMENTE).
 * Adaptateurs INDIGITA_API/APIAX_API : CONTRAT + MOCK uniquement (E-XB-2).
 */
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { AuditService } from "../../src/common/audit.service";
import { XbService, CrossBorderRuleProvider } from "../../src/modules/crossborder/xb.module";
import { BusinessTripService } from "../../src/modules/businesstrip/businesstrip.module";

const URL_OWNER = process.env.DATABASE_URL ?? "postgresql://olive:olive@localhost:5433/olive_test";
const jourISO = (decalage: number) => new Date(Date.now() + decalage * 86_400_000).toISOString().slice(0, 10);

/** Mock du port INDIGITA_API (contrat R453) — l'état est piloté par le test. */
class MockIndigita implements CrossBorderRuleProvider {
  source = "INDIGITA_API";
  etat: any[] = [];
  enEchec = false;
  async lire() { if (this.enEchec) throw new Error("INDIGITA_TIMEOUT"); return this.etat; }
}

describe("Bloc 64 — cross-border étendu (R453–R462, spec/BLOC-64 §3)", () => {
  let owner: PrismaClient; let svc: XbService; let bt: BusinessTripService;
  const T = randomUUID();
  const u = (role: string) => ({ tenantId: T, userId: randomUUID(), role });
  const RM1 = u("RM"), RM2 = u("RM"), CO1 = u("CO"), CO2 = u("CO"), XB1 = u("XB"),
    MGR1 = u("MGR"), ADMIN1 = u("ADMIN");
  const indigita = new MockIndigita();
  let C_FR: string, C_IT: string, C_DE: string, C_CH: string, C_E1: string, C_E2: string;
  const clientsFR: string[] = [];

  const MATRICE_V1 = [
    { jurisdiction: "FR", activites: { MEET: "OK", ADVICE: "COND", MKT: "COND", ORDER: "COND", PROSP: "NON" },
      statut: "RESTREINT", sollicitation: "reverse solicitation documentée", licence: "aucune", produits: ["actions", "obligations"] },
    { jurisdiction: "IT", activites: { MEET: "OK", ADVICE: "NON", MKT: "NON", ORDER: "COND" },
      statut: "RESTREINT", sollicitation: "interdite", licence: "aucune", produits: [] },
    { jurisdiction: "DE", activites: { MEET: "OK", ADVICE: "OK", MKT: "OK", PROSP: "NON" },
      statut: "OUVERT", sollicitation: "libre", licence: "BaFin", produits: ["tous"] },
    { jurisdiction: "US", activites: { MEET: "OK", ADVICE: "NON", MKT: "NON" },
      statut: "BLOQUE", sollicitation: "SEC only", licence: "aucune", produits: [] },
  ];

  beforeAll(async () => {
    owner = new PrismaClient({ datasources: { db: { url: URL_OWNER } } });
    await owner.tenant.create({ data: { id: T, name: "B64-T", settings: {
      tripApprovalMatrix: ["MGR"],
      tripCrossBorderReferentiel: [
        { jurisdiction: "DE", activite: "MEET", verdict: "AUTORISEE", depuisLe: "2026-01-01" },
        { jurisdiction: "US", activite: "MEET", verdict: "AUTORISEE", depuisLe: "2026-01-01" }],
      businessTrip: {
        chains: { LOW: ["MGR"], MEDIUM: ["MGR", "XB"], HIGH: ["MGR", "XB", "HPB"] },
        seuilBudgetHPB: 5000, risqueDestinations: { DE: "LOW", US: "LOW" },
        quotas: {}, quotasOverridesRM: {},
        guards: { certifValide: "BLOQUANT", quotaDepasse: "AVERTISSEMENT", verdictNON: "DÉSACTIVÉ",
          paysSanctions: "DÉSACTIVÉ", certificatPrecedentManquant: "DÉSACTIVÉ", destinationHorsRegistre: "DÉSACTIVÉ" },
        paysSanctions: [], certificat: { slaJoursOuvres: 5, validateurDefaut: "MGR", validateurSiEcart: "XB" },
      },
      crossBorder: {
        fournisseur: "INDIGITA_API", syncFrequenceHeures: 24, syncAlerteEchecJours: 2,
        acteDistant: { severiteNON: "AVERTISSEMENT",
          mappingEntretienActivites: { "Conseil en placement": ["ADVICE"], "Conseil": ["ADVICE"],
            "Envoi documentation": ["MKT"], "Prise d'ordre": ["ORDER"], "Courtoisie": ["MEET"] } },
        preActe: { severites: { MKT: "BLOQUANT", ADVICE: "BLOQUANT", ORDER: "BLOQUANT" } },
        reverseSolicitation: { validiteMois: 12, rolesEnregistrement: ["RM", "CO", "CO_SR"] },
        localisationTemporaire: { dureeMaxJours: 90 },
        certifications: { juridictionsExigees: ["DE", "US"], severiteAbsence: "BLOQUANT" },
        entites: { E1: { exemptions: { DE: { PROSP: { verdict: "COND", exemption: "BaFin §2 Abs. 5 KWG" } } } }, E2: {} },
        entiteParClient: {},                             // complété au fil des tests (XB-12)
      },
    } } as any });
    svc = new XbService(owner as any, new AuditService(owner as any), { matrice: indigita });
    bt = new BusinessTripService(owner as any, new AuditService(owner as any));
    const cli = async (nom: string, pays: string) =>
      (await owner.client.create({ data: { tenantId: T, name: nom, structure: "PP", country: pays, riskLevel: "LOW" } as any })).id;
    C_FR = await cli("B64 Client FR", "FR"); C_IT = await cli("B64 Client IT", "IT");
    C_DE = await cli("B64 Client DE", "DE"); C_CH = await cli("B64 Client CH", "CH");
    C_E1 = await cli("B64 Client E1 (DE)", "DE"); C_E2 = await cli("B64 Client E2 (DE)", "DE");
    for (let i = 0; i < 12; i++) clientsFR.push(await cli(`B64 FR ${i}`, "FR"));   // + C_FR + E? ⇒ 14 clients FR au total avec C_FR et 1 de plus
    clientsFR.push(C_FR); clientsFR.push(await cli("B64 FR 13", "FR"));
  });
  afterAll(async () => { await owner.$disconnect(); });

  const evsType = (type: string) => owner.domainEvent.findMany({
    where: { tenantId: T, type }, orderBy: { id: "asc" } });

  it("XB-01 [R453] — synchronisation du port : version datée immuable, MATRIX_SYNCED avec diff lisible, version précédente consultable", async () => {
    indigita.etat = MATRICE_V1;
    const v1 = await svc.syncMatrice(RM1);
    expect(v1.versionId).toBeTruthy();
    // NB fixture : la dégradation porte sur ORDER (FR ADVICE reste COND — exigé par XB-03/06/07 ;
    // la dégradation FR ADVICE COND→NON est le scénario XB-10, qui vient APRÈS).
    indigita.etat = MATRICE_V1.map((e) =>
      e.jurisdiction === "FR" ? { ...e, activites: { ...e.activites, ORDER: "NON" } } :
      e.jurisdiction === "IT" ? { ...e, activites: { ...e.activites, ORDER: "NON" } } : e);
    const v2 = await svc.syncMatrice(RM1);
    expect(v2.versionId).not.toBe(v1.versionId);
    const synced: any = (await evsType("MATRIX_SYNCED")).pop();
    const diff = synced.payload.diff;
    expect(diff).toEqual(expect.arrayContaining([
      expect.objectContaining({ jurisdiction: "FR", activite: "ORDER", ancien: "COND", nouveau: "NON" }),
      expect.objectContaining({ jurisdiction: "IT", activite: "ORDER", ancien: "COND", nouveau: "NON" })]));
    const avant = await svc.matriceCourante(RM1, v1.at);                   // la précédente reste consultable/rejouable
    expect(avant.versionId).toBe(v1.versionId);
    expect(avant.entrees.find((e: any) => e.jurisdiction === "FR").activites.ORDER).toBe("COND");
  });

  it("XB-02 [R453] — fournisseur indisponible : dernière version servie, ÂGE affiché, tâche Compliance, jamais un blocage", async () => {
    indigita.enEchec = true;
    await expect(svc.syncMatrice(RM1)).rejects.toThrow(/INDIGITA|sync/i);   // l'échec est un événement, pas un silence
    const m = await svc.matriceCourante(RM1);
    expect(m.versionId).toBeTruthy();                                       // la dernière version connue est SERVIE
    expect(m.syncEnEchec).toBe(true);
    const taches: any[] = (await evsType("xb.tache.creee")).map((e: any) => e.payload);
    expect(taches.some((t) => /source|sync/i.test(t.type))).toBe(true);     // « vérifier la source cross-border »
    const check = await svc.checkPreActe(RM1, { type: "MEET", clientId: C_DE });   // DE MEET=OK
    expect(check.refuse ?? false).toBe(false);                              // aucun check bloqué du seul fait de la sync
    expect(check.noteSync).toMatch(/échec|echec/i);                         // l'âge est PORTÉ par le verdict
    indigita.enEchec = false;
  });

  it("XB-03 [R454/R456] — visio conseil avec une personne en France : check ADVICE×FR consigné au contact report ; sans preuve RS, échec motivé", async () => {
    const r = await svc.contactReportDistant(RM1, {
      clientId: C_FR, canal: "Visioconférence", typeEntretien: "Conseil en placement" });
    expect(r.check.activites).toContain("ADVICE");
    expect(r.check.versionMatrice).toBeTruthy();                            // la version est consignée
    expect(r.check.passe).toBe(false);
    expect(r.check.motif).toMatch(/reverse solicitation/i);                 // motif EXPLICITE
    const cr: any = await owner.crmContact.findFirst({ where: { tenantId: T, id: r.contactReportId } });
    expect((cr.contenu as any).verdictXb).toBeTruthy();                     // consigné DANS le contact report
  });

  it("XB-04 [R454/R39] — verdict NON en AVERTISSEMENT : l'acte se crée avec GUARD_WARNING + tâche ; en BLOQUANT : qualification préalable exigée", async () => {
    const r = await svc.contactReportDistant(RM1, { clientId: C_IT, canal: "Appel", typeEntretien: "Conseil" });
    expect(r.contactReportId).toBeTruthy();                                 // l'acte SE CRÉE (AVERTISSEMENT, défaut)
    const gw: any = (await owner.domainEvent.findMany({ where: { tenantId: T, type: "GUARD_WARNING", aggregateId: r.contactReportId } })).pop();
    expect(gw.payload.reason).toMatch(/NON/);                               // verdict NON nommé
    const taches: any[] = (await evsType("xb.tache.creee")).map((e: any) => e.payload);
    expect(taches.some((t) => /qualification/i.test(t.type) && t.contactReportId === r.contactReportId)).toBe(true);
    await svc.modifierParametreXB(ADMIN1, { cle: "acteDistant.severiteNON", valeur: "BLOQUANT", enVigueurLe: jourISO(-1),
      confirmation: { engagementTexte: "Sévérité BLOQUANT — engagement.", auteur: ADMIN1.userId } });
    await expect(svc.contactReportDistant(RM1, { clientId: C_IT, canal: "Appel", typeEntretien: "Conseil" }))
      .rejects.toThrow(/qualification/i);                                   // BLOQUANT : qualification Compliance préalable
    await svc.modifierParametreXB(ADMIN1, { cle: "acteDistant.severiteNON", valeur: "AVERTISSEMENT", enVigueurLe: jourISO(-1),
      confirmation: { engagementTexte: "Retour au défaut.", auteur: ADMIN1.userId } });
  });

  it("XB-05 [R455] — envoi de documentation : refus tracé sur le document (IT, MKT=NON) ; passage tracé (DE, MKT=OK)", async () => {
    const docIT = randomUUID();
    await expect(svc.checkPreActe(RM1, { type: "MKT", clientId: C_IT, objetId: docIT }))
      .rejects.toThrow(/MKT.*interdit|interdit.*MKT/i);                     // BLOQUANT (préActe.severites.MKT)
    const refus: any = (await owner.domainEvent.findMany({ where: { tenantId: T, type: "xb.preacte.verdict", aggregateId: docIT } })).pop();
    expect(refus.payload.passe).toBe(false);
    expect(refus.payload.versionMatrice).toBeTruthy();                      // « matrice v… » — source du verdict
    const docDE = randomUUID();
    const ok = await svc.checkPreActe(RM1, { type: "MKT", clientId: C_DE, objetId: docDE });
    expect(ok.passe).toBe(true);
    const trace: any = (await owner.domainEvent.findMany({ where: { tenantId: T, type: "xb.preacte.verdict", aggregateId: docDE } })).pop();
    expect(trace.payload).toMatchObject({ passe: true });                   // verdict OK ATTACHÉ au document
  });

  it("XB-06 [R456] — preuve de reverse solicitation : objet daté visé à PÉRIMÈTRE — produit X passe, produit Y échoue", async () => {
    const preuve = await svc.enregistrerPreuveRS(CO1, { clientId: C_FR, perimetre: "produit X",
      nature: "email entrant", docId: randomUUID(), date: jourISO(-10) });
    await svc.viserPreuveRS(CO2, preuve.preuveId);                          // visa R15 — jamais l'enregistreur
    const okX = await svc.checkPreActe(RM1, { type: "ADVICE", clientId: C_FR, perimetre: "produit X", objetId: randomUUID() });
    expect(okX.passe).toBe(true);
    expect(okX.preuveId).toBe(preuve.preuveId);                             // le passage RÉFÉRENCE la preuve
    await expect(svc.checkPreActe(RM1, { type: "ADVICE", clientId: C_FR, perimetre: "produit Y", objetId: randomUUID() }))
      .rejects.toThrow(/périmètre|perimetre|couvre/i);                      // la preuve ne couvre pas Y
  });

  it("XB-07 [R456] — preuve expirée (13 mois > 12) : échec motivé + tâche de renouvellement proposée", async () => {
    const preuve = await svc.enregistrerPreuveRS(CO1, { clientId: C_CH, perimetre: "produit Z",
      nature: "courrier", docId: randomUUID(), date: jourISO(-395) });      // ~13 mois
    await svc.viserPreuveRS(CO2, preuve.preuveId);
    await owner.client.update({ where: { id: C_CH }, data: { country: "FR" } as any });   // le check FR s'applique
    await expect(svc.checkPreActe(RM1, { type: "ADVICE", clientId: C_CH, perimetre: "produit Z", objetId: randomUUID() }))
      .rejects.toThrow(/expirée|expiree|13/i);
    const taches: any[] = (await evsType("xb.tache.creee")).map((e: any) => e.payload);
    expect(taches.some((t) => /renouvel/i.test(t.type))).toBe(true);
    await owner.client.update({ where: { id: C_CH }, data: { country: "CH" } as any });
  });

  it("XB-08 [R457] — la localisation temporaire PRIME le domicile pendant la période, restauration automatique après", async () => {
    await svc.declarerLocalisation(RM1, { clientId: C_CH, juridiction: "US", du: "2026-08-01", au: "2026-08-20" });
    const pendant = await svc.contactReportDistant(RM1,
      { clientId: C_CH, canal: "Appel", typeEntretien: "Conseil" }, "2026-08-10T10:00:00.000Z");
    expect(pendant.check.juridiction).toBe("US");                           // évalué sur la LOCALISATION
    const apres = await svc.contactReportDistant(RM1,
      { clientId: C_CH, canal: "Appel", typeEntretien: "Conseil" }, "2026-08-25T10:00:00.000Z");
    expect(apres.check.juridiction).toBe("CH");                             // restauration AUTOMATIQUE
  });

  it("XB-09 [R458] — certification PAR juridiction (codes XB-<pays>, MOD-43) : DE passe, US bloque", async () => {
    await owner.certification.create({ data: { tenantId: T, userId: RM2.userId, code: "XB-DE",
      obtenueLe: "2026-01-01", expireLe: "2027-06-30" } as any });          // certifié Allemagne, PAS États-Unis
    const tDE = await bt.creer(RM2, { destinations: ["DE"], activites: ["MEET"], budget: 100,
      dateStart: jourISO(30), dateEnd: jourISO(32) });
    await bt.soumettre(RM2, tDE.id);
    const r = await bt.viser(MGR1, tDE.id, "MGR");                          // guard certification : PASSE
    expect(r.status).toBe("APPROVED");
    const tUS = await bt.creer(RM2, { destinations: ["US"], activites: ["MEET"], budget: 100,
      dateStart: jourISO(30), dateEnd: jourISO(32) });
    await bt.soumettre(RM2, tUS.id);
    await expect(bt.viser(MGR1, tUS.id, "MGR")).rejects.toThrow(/certification/i);
    const gb: any = (await owner.domainEvent.findMany({ where: { tenantId: T, type: "GUARD_BLOCKED", aggregateId: tUS.id } })).pop();
    expect(gb.payload.guard).toBe("certifValide");
    expect(gb.payload.reason).toMatch(/US|États-Unis|XB-US/);               // la juridiction manquante est NOMMÉE
  });

  it("XB-10 [R459/R29] — nouvelle version dégradant FR : tâches nominatives + notification, AUCUN voyage annulé ni visa révoqué", async () => {
    const v1 = await owner.trip.create({ data: { tenantId: T, travelerId: RM1.userId, status: "APPROVED",
      dateStart: jourISO(20), dateEnd: jourISO(23), destinations: ["FR"], activites: ["ADVICE"] } as any });
    const v2 = await owner.trip.create({ data: { tenantId: T, travelerId: RM2.userId, status: "APPROVED",
      dateStart: jourISO(40), dateEnd: jourISO(42), destinations: ["FR"], activites: ["ADVICE"] } as any });
    indigita.etat = MATRICE_V1.map((e) =>
      e.jurisdiction === "FR" ? { ...e, activites: { ...e.activites, ADVICE: "NON" } } : e);
    const sync = await svc.syncMatrice(RM1);
    expect(sync.impact).toBeTruthy();
    const taches: any[] = (await evsType("xb.tache.creee")).map((e: any) => e.payload);
    for (const v of [v1.id, v2.id])
      expect(taches.some((t) => /revue/i.test(t.type) && t.voyageId === v && t.assigneRole === "XB")).toBe(true);
    const notif: any = (await evsType("xb.impact.notifie")).pop();
    expect(notif.payload.clientsAffectes).toBeGreaterThanOrEqual(14);       // les clients FR sont LISTÉS
    for (const v of [v1.id, v2.id]) {
      const row: any = await owner.trip.findFirst({ where: { id: v } });
      expect(row.status).toBe("APPROVED");                                  // aucun voyage annulé (R39/R44)
    }
    const visasRevoques = await owner.tripVisa.count({ where: { tenantId: T, status: "REVOKED" } });
    expect(visasRevoques).toBe(0);
  });

  it("XB-11 [R460] — exposition consolidée = projection LIVE par juridiction, jamais figée", async () => {
    const expo1 = await svc.expositionCrossBorder(CO1);
    const fr1 = expo1.parJuridiction.find((l: any) => l.juridiction === "FR");
    expect(fr1.clients).toBeGreaterThanOrEqual(14);
    expect(fr1).toEqual(expect.objectContaining({
      voyages: expect.any(Number), actesDistants: expect.any(Number),
      derogations: expect.any(Number), preuvesActives: expect.any(Number) }));
    await svc.contactReportDistant(RM1, { clientId: C_FR, canal: "Email", typeEntretien: "Courtoisie" });   // MEET=OK
    const expo2 = await svc.expositionCrossBorder(CO1);
    const fr2 = expo2.parJuridiction.find((l: any) => l.juridiction === "FR");
    expect(fr2.actesDistants).toBe(fr1.actesDistants + 1);                  // recalculée au rafraîchissement
  });

  it("XB-12 [R461] — multi-entité : le verdict NOMME l'entité et l'exemption ; l'exemption de E1 ne bénéficie jamais à E2", async () => {
    await svc.modifierParametreXB(ADMIN1, { cle: `entiteParClient.${C_E1}`, valeur: "E1", enVigueurLe: jourISO(-1),
      confirmation: { engagementTexte: "Rattachement booking E1.", auteur: ADMIN1.userId } });
    await svc.modifierParametreXB(ADMIN1, { cle: `entiteParClient.${C_E2}`, valeur: "E2", enVigueurLe: jourISO(-1),
      confirmation: { engagementTexte: "Rattachement booking E2.", auteur: ADMIN1.userId } });
    const e1 = await svc.checkPreActe(RM1, { type: "PROSP", clientId: C_E1, objetId: randomUUID() });
    expect(e1.verdict).toMatch(/COND/);
    expect(e1.mention).toMatch(/BaFin.*E1|exemption.*E1/);                  // entité ET exemption nommées
    await expect(svc.checkPreActe(RM1, { type: "PROSP", clientId: C_E2, objetId: randomUUID() }))
      .rejects.toThrow(/NON|interdit/i);                                    // E2 : jamais l'exemption de E1
  });

  it("XB-13 [R462/R445] — modification de sévérité : pop-up (ancien/nouveau, portée, rappel réglementaire) ; sans confirmation aucune écriture", async () => {
    const avant = await owner.domainEvent.count({ where: { tenantId: T, type: "PARAM_CHANGED" } });
    await expect(svc.modifierParametreXB(ADMIN1, { cle: "preActe.severites.MKT", valeur: "AVERTISSEMENT", enVigueurLe: jourISO(0) }))
      .rejects.toMatchObject({ response: { code: "R445_CONFIRMATION_REQUISE",
        popup: expect.objectContaining({ cle: "preActe.severites.MKT", ancien: "BLOQUANT", nouveau: "AVERTISSEMENT" }) } });
    expect(await owner.domainEvent.count({ where: { tenantId: T, type: "PARAM_CHANGED" } })).toBe(avant);
    const r = await svc.modifierParametreXB(ADMIN1, { cle: "preActe.severites.MKT", valeur: "AVERTISSEMENT", enVigueurLe: jourISO(0),
      confirmation: { engagementTexte: "Diffusion transfrontière — j'engage ma responsabilité.", auteur: ADMIN1.userId } });
    expect(r.applique).toBe(true);
    const pc: any = (await owner.domainEvent.findMany({ where: { tenantId: T, type: "PARAM_CHANGED" } })).pop();
    expect(pc.payload).toMatchObject({ cle: "preActe.severites.MKT", ancien: "BLOQUANT", nouveau: "AVERTISSEMENT", auteur: ADMIN1.userId });
  });

  it("XB-14 [R453/R455/R48] — rejeu à date d'un acte distant : verdict et condition d'ÉPOQUE, jamais recalculé", async () => {
    // v-époque : FR MKT=COND (matrice v2 courante d'XB-10 a FR ADVICE=NON mais MKT=COND inchangé) ;
    // on dégrade MKT en NON PUIS on rejoue l'acte consigné AVANT la dégradation.
    const doc = randomUUID();
    const acte = await svc.checkPreActe(RM1, { type: "MKT", clientId: C_FR, perimetre: "produit X", objetId: doc });
    // (MKT est passé en AVERTISSEMENT au XB-13 — l'acte se consigne avec sa version et sa condition COND)
    const versionEpoque = acte.versionMatrice;
    indigita.etat = indigita.etat.map((e: any) =>
      e.jurisdiction === "FR" ? { ...e, activites: { ...e.activites, MKT: "NON" } } : e);
    await svc.syncMatrice(RM1);
    const rejeu = await svc.rejouerActe(RM1, doc, new Date().toISOString());
    expect(rejeu.versionMatrice).toBe(versionEpoque);                       // la version d'ÉPOQUE
    expect(rejeu.verdict).toMatch(/COND/);
    expect(rejeu.verdict).not.toMatch(/^NON$/);                             // jamais recalculé avec la nouvelle
  });
});
