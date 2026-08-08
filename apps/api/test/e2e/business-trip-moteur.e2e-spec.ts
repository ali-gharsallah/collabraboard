/**
 * Bloc 63 — Business Trip AU MOTEUR (repo R446–R452 + R465 · session R439–R445 + R458).
 * Spec exécutable : spec/BLOC-63-BUSINESS-TRIP-R446-R452-R465.md §4, BT-01..BT-16 transcrits
 * SANS adoucissement — en DELTA sur MOD-75 (R222–R230) : quand l'existant couvre (visa R15,
 * exclusion R13, certification à la date du voyage, avis versionné), le test s'asserte dessus ;
 * les rouges viennent des capacités nouvelles (chaîne dynamique risque×budget, guards à
 * sévérité tenant, check consigné/invalidé, certificat de trip, quotas+overrides, R465).
 * A2 : 16 rouges avant tout code moteur (squelette BLOC63_NON_IMPLEMENTE).
 * Nommage des événements (delta, consigné) : « WORKFLOW_STARTED » session = `trip.submitted`
 * ENRICHI (chaine/origineChaine/budget) — le type offboarding WORKFLOW_STARTED garde son
 * schéma strict propre. GUARD_BLOCKED/GUARD_WARNING/PARAM_CHANGED : types Bloc 62 RÉUTILISÉS.
 */
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { AuditService } from "../../src/common/audit.service";
import { BusinessTripService } from "../../src/modules/businesstrip/businesstrip.module";

const URL_OWNER = process.env.DATABASE_URL ?? "postgresql://olive:olive@localhost:5433/olive_test";

describe("Bloc 63 — business trip au moteur (R446–R452 + R465, spec/BLOC-63 §4)", () => {
  let owner: PrismaClient; let svc: BusinessTripService;
  const T = randomUUID();
  const u = (role: string) => ({ tenantId: T, userId: randomUUID(), role });
  const RM_A = u("RM"), RM_B4 = u("RM"), RM_B5 = u("RM"), RM_B6 = u("RM"), RM_B7 = u("RM"),
    RM_B9 = u("RM"), RM_B10 = u("RM"), RM_B11 = u("RM"), RM_B12 = u("RM"),
    SOPHIE = u("RM"), RM_SANS_OVR = u("RM"), RM_B16 = u("RM"),
    MGR1 = u("MGR"), MGR2 = u("MGR"), XB1 = u("XB"), HPB1 = u("HPB"), ADMIN1 = u("ADMIN");
  let C1: string, C2: string;

  // Référentiel versionné (R448/R48) : PT = v7 (COND, 01.06) puis v8 (NON, 01.07) pour BT-14.
  const REF = [
    { jurisdiction: "FR", activite: "PROSP",  verdict: "NON",       depuisLe: "2026-01-01" },
    { jurisdiction: "FR", activite: "MEET",   verdict: "AUTORISEE", depuisLe: "2026-01-01" },
    { jurisdiction: "FR", activite: "ADVICE", verdict: "COND",      depuisLe: "2026-01-01" },
    { jurisdiction: "AE", activite: "MEET",   verdict: "AUTORISEE", depuisLe: "2026-01-01" },
    { jurisdiction: "AE", activite: "PROSP",  verdict: "COND",      depuisLe: "2026-01-01" },
    { jurisdiction: "DE", activite: "MEET",   verdict: "AUTORISEE", depuisLe: "2026-01-01" },
    { jurisdiction: "US", activite: "MEET",   verdict: "AUTORISEE", depuisLe: "2026-01-01" },
    { jurisdiction: "SG", activite: "MEET",   verdict: "AUTORISEE", depuisLe: "2026-01-01" },
    { jurisdiction: "RU", activite: "MEET",   verdict: "AUTORISEE", depuisLe: "2026-01-01" },
    { jurisdiction: "PT", activite: "ADVICE", verdict: "COND",      depuisLe: "2026-06-01" },
    { jurisdiction: "PT", activite: "NON_UTILISEE", verdict: "AUTORISEE", depuisLe: "2026-06-01" },
    { jurisdiction: "PT", activite: "ADVICE", verdict: "NON",       depuisLe: "2026-07-01" },
  ];

  beforeAll(async () => {
    owner = new PrismaClient({ datasources: { db: { url: URL_OWNER } } });
    await owner.tenant.create({ data: { id: T, name: "B63-T", settings: {
      tripApprovalMatrix: ["MGR"],                       // legacy MOD-75 — sans objet quand chains est posé
      tripCrossBorderReferentiel: REF,
      tripCertificationRequise: [
        { jurisdiction: "DE", code: "XB-DE" }, { jurisdiction: "US", code: "XB-US" }],
      businessTrip: {
        chains: { LOW: ["MGR"], MEDIUM: ["MGR", "XB"], HIGH: ["MGR", "XB", "HPB"] },
        seuilBudgetHPB: 5000,
        risqueDestinations: { FR: "MEDIUM", DE: "MEDIUM", PT: "MEDIUM", RU: "MEDIUM", US: "HIGH", AE: "LOW", SG: "LOW" },
        quotas: { SG: 15, AE: 15 },
        quotasOverridesRM: {},
        guards: { certifValide: "BLOQUANT", quotaDepasse: "AVERTISSEMENT", verdictNON: "BLOQUANT",
          paysSanctions: "BLOQUANT", certificatPrecedentManquant: "BLOQUANT", destinationHorsRegistre: "BLOQUANT" },
        paysSanctions: ["RU"],
        certificat: { slaJoursOuvres: 5, validateurDefaut: "MGR", validateurSiEcart: "XB" },
      },
    } } as any });
    svc = new BusinessTripService(owner as any, new AuditService(owner as any));
    C1 = (await owner.client.create({ data: { tenantId: T, name: "B63 Client Un", structure: "PP", country: "AE", riskLevel: "LOW" } as any })).id;
    C2 = (await owner.client.create({ data: { tenantId: T, name: "B63 Client Deux", structure: "PP", country: "AE", riskLevel: "LOW" } as any })).id;
    // Certifications valides pour les parcours qui n'exercent PAS le guard certification :
    for (const rm of [RM_B7, RM_B9])
      for (const code of ["XB-DE", "XB-US"])
        await owner.certification.create({ data: { tenantId: T, userId: rm.userId, code,
          obtenueLe: "2026-01-01", expireLe: "2027-06-30" } as any });
    // BT-04 : certification DE de RM_B4 expire le 10.09 — valide à la soumission, échue au voyage.
    await owner.certification.create({ data: { tenantId: T, userId: RM_B4.userId, code: "XB-DE",
      obtenueLe: "2025-09-10", expireLe: "2026-09-10" } as any });
  });
  afterAll(async () => { await owner.$disconnect(); });

  const evs = (aggregateId: string) => owner.domainEvent.findMany({
    where: { tenantId: T, aggregateId }, orderBy: { id: "asc" } });
  const soumis = async (id: string) => {
    const e = await evs(id);
    return e.filter((x: any) => x.type === "trip.submitted").pop()?.payload as any;
  };
  const tripApprouve = (rm: any, opts: any = {}) => owner.trip.create({ data: {
    tenantId: T, travelerId: rm.userId, status: opts.status ?? "APPROVED",
    dateStart: opts.dateStart ?? "2026-07-01", dateEnd: opts.dateEnd ?? "2026-07-11",
    destinations: opts.destinations ?? ["AE"], clients: opts.clients ?? [],
    ...(opts.activites ? { activites: opts.activites } : {}), purpose: opts.purpose ?? null } as any });

  it("BT-01 [R446] — soumission : chaîne résolue (risque MEDIUM × budget < seuil) et FIGÉE dans l'événement de création", async () => {
    const t = await svc.creer(RM_A, { destinations: ["FR"], activites: ["MEET"], budget: 3000,
      dateStart: "2026-09-01", dateEnd: "2026-09-03" });
    await svc.soumettre(RM_A, t.id);
    const p = await soumis(t.id);
    expect(p.chaine).toEqual(["RM", "MGR", "XB"]);                         // chains.MEDIUM, demandeur en tête
    expect(p.origineChaine).toMatchObject({ risque: "MEDIUM", hpbAjoute: false });
    expect(p.budget).toBe(3000);
  });

  it("BT-02 [R446] — budget CHF 6 800 > seuil HPB 5 000 : HPB ajouté, origine tracée", async () => {
    const t = await svc.creer(RM_A, { destinations: ["FR"], activites: ["MEET"], budget: 6800,
      dateStart: "2026-09-01", dateEnd: "2026-09-03" });
    await svc.soumettre(RM_A, t.id);
    const p = await soumis(t.id);
    expect(p.chaine).toEqual(["RM", "MGR", "XB", "HPB"]);
    expect(p.origineChaine).toMatchObject({ hpbAjoute: true, budget: 6800, seuilBudgetHPB: 5000 });
  });

  it("BT-03 [R13/R446] — le RM demandeur ne vise JAMAIS sa demande ; les visas de la chaîne résolue existent", async () => {
    const t = await svc.creer(RM_A, { destinations: ["FR"], activites: ["MEET"], budget: 1000,
      dateStart: "2026-09-01", dateEnd: "2026-09-03" });
    await svc.soumettre(RM_A, t.id);
    const visas = await owner.tripVisa.findMany({ where: { tenantId: T, tripId: t.id } });
    expect(visas.map((v: any) => v.role).sort()).toEqual(["MGR", "XB"]);   // chaîne résolue, pas la matrice legacy
    await expect(svc.viser(RM_A, t.id, "MGR")).rejects.toThrow(/SELF_APPROVAL|R13/i);
  });

  it("BT-04 [R447/R451] — certification échue À LA DATE DU VOYAGE : GUARD_BLOCKED, la validité à la soumission ne suffit pas", async () => {
    const t = await svc.creer(RM_B4, { destinations: ["DE"], activites: ["MEET"], budget: 1000,
      dateStart: "2026-09-15", dateEnd: "2026-09-18" });                   // cert expire le 10.09 — valide AUJOURD'HUI
    await svc.soumettre(RM_B4, t.id);
    await expect(svc.viser(MGR1, t.id, "MGR")).rejects.toThrow(/certification|certif/i);
    const e = await evs(t.id);
    const gb: any = e.filter((x: any) => x.type === "GUARD_BLOCKED").pop();
    expect(gb.payload.guard).toBe("certifValide");
    expect(gb.payload.reason).toMatch(/2026-09-10|10\.09/);               // la date d'échéance est NOMMÉE
  });

  it("BT-05 [R447/R449] — quota dépassé (18/15) : GUARD_WARNING chiffré, dérogation motivée visée, cumul = PROJECTION", async () => {
    await tripApprouve(RM_B5, { status: "COMPLETED", destinations: ["SG"],
      dateStart: "2026-03-01", dateEnd: "2026-03-15" });                   // 14 jours déjà effectués (année glissante)
    const t = await svc.creer(RM_B5, { destinations: ["SG"], activites: ["MEET"], budget: 1000,
      dateStart: "2026-09-01", dateEnd: "2026-09-05" });                   // +4 ⇒ 18 > 15
    await svc.soumettre(RM_B5, t.id);
    const r = await svc.viser(MGR1, t.id, "MGR", "Client stratégique — revue annuelle sur place");
    expect(r.status).toBe("APPROVED");                                     // chains.LOW = [MGR] : la transition PASSE
    const e = await evs(t.id);
    const gw: any = e.filter((x: any) => x.type === "GUARD_WARNING").pop();
    expect(gw.payload.guard).toBe("quotaDepasse");
    expect(gw.payload.reason).toMatch(/18.*15|18\/15/);                    // dépassement CHIFFRÉ
    const vs: any = e.filter((x: any) => x.type === "trip.visa.signed").pop();
    expect(vs.payload.motivation).toMatch(/Client stratégique/);           // dérogation portée par le visa
    const row: any = await owner.trip.findFirst({ where: { id: t.id } });
    for (const champ of ["quotaCumul", "compteur", "joursConsommes"]) expect(row).not.toHaveProperty(champ);   // aucun compteur stocké
  });

  it("BT-06 [R447/R448] — activité PROSP interdite (FR) : GUARD_BLOCKED nommé ; re-check après modification, la transition passe", async () => {
    const t = await svc.creer(RM_B6, { destinations: ["FR"], activites: ["PROSP"], budget: 1000,
      dateStart: "2026-09-01", dateEnd: "2026-09-03" });
    await svc.soumettre(RM_B6, t.id);
    await expect(svc.viser(MGR1, t.id, "MGR")).rejects.toThrow(/PROSP|interdite/i);
    const e1 = await evs(t.id);
    const gb: any = e1.filter((x: any) => x.type === "GUARD_BLOCKED").pop();
    expect(gb.payload.guard).toBe("verdictNON");
    expect(gb.payload.reason).toMatch(/PROSP/);
    await svc.modifier(RM_B6, t.id, { activites: ["MEET", "ADVICE"] });    // MEET=OK, ADVICE=COND — le check est REFAIT
    const r = await svc.viser(MGR1, t.id, "MGR");
    expect(["PENDING_APPROVAL", "APPROVED"]).toContain(r.status);
    const e2 = await evs(t.id);
    expect(e2.filter((x: any) => x.type === "trip.check.consigne").length).toBeGreaterThanOrEqual(2);   // check refait
  });

  it("BT-07 [R448] — check figé avec sa version ; modification de destination = check invalidé ET visa XB tombé", async () => {
    const t = await svc.creer(RM_B7, { destinations: ["US"], activites: ["MEET"], budget: 1000,
      dateStart: "2026-09-01", dateEnd: "2026-09-03" });                   // US = HIGH ⇒ [MGR, XB, HPB]
    await svc.soumettre(RM_B7, t.id);
    await svc.viser(MGR1, t.id, "MGR");
    await svc.viser(XB1, t.id, "XB");                                      // visa Compliance apposé
    await svc.modifier(RM_B7, t.id, { destinations: ["AE"] });             // changement de destination
    const e = await evs(t.id);
    const inv: any = e.filter((x: any) => x.type === "trip.check.invalide").pop();
    expect(inv.payload.cause).toMatch(/destination/i);                     // cause tracée
    const visaXb: any = await owner.tripVisa.findFirst({ where: { tenantId: T, tripId: t.id, role: "XB" } });
    expect(visaXb.status).toBe("PENDING");                                 // retour à l'étape XB
    const checks = e.filter((x: any) => x.type === "trip.check.consigne");
    expect(checks.length).toBeGreaterThanOrEqual(2);                       // nouveau check sous la version en vigueur
  });

  it("BT-08 [R447] — destination sous sanctions : GUARD_BLOCKED, clearance = paramétrage tenant tracé, jamais un passage silencieux", async () => {
    const t = await svc.creer(RM_B6, { destinations: ["RU"], activites: ["MEET"], budget: 1000,
      dateStart: "2026-09-01", dateEnd: "2026-09-03" });
    await svc.soumettre(RM_B6, t.id);
    await expect(svc.viser(MGR1, t.id, "MGR")).rejects.toThrow(/sanctions/i);
    const e = await evs(t.id);
    const gb: any = e.filter((x: any) => x.type === "GUARD_BLOCKED").pop();
    expect(gb.payload.guard).toBe("paysSanctions");
    await expect(svc.viser(XB1, t.id, "XB")).rejects.toThrow();            // aucune voie de contournement par un autre visa
  });

  it("BT-09 [R446] — approbation complète DANS L'ORDRE de la chaîne ; le voyage approuvé reste OUVERT (certificat dû)", async () => {
    const t = await svc.creer(RM_B9, { destinations: ["DE"], activites: ["MEET"], budget: 1000,
      dateStart: "2026-09-01", dateEnd: "2026-09-03" });                   // DE = MEDIUM ⇒ [MGR, XB]
    await svc.soumettre(RM_B9, t.id);
    await expect(svc.viser(XB1, t.id, "XB")).rejects.toThrow(/ordre|chaîne|chaine/i);   // XB avant MGR = refus
    await svc.viser(MGR1, t.id, "MGR");
    const r = await svc.viser(XB1, t.id, "XB");
    expect(r.status).toBe("APPROVED");
    const e = await evs(t.id);
    expect(e.some((x: any) => x.type === "trip.approved")).toBe(true);
    const row: any = await owner.trip.findFirst({ where: { id: t.id } });
    expect(row.status).toBe("APPROVED");                                   // PAS clôturé — le certificat clôt (R450)
  });

  it("BT-10 [R450] — certificat sans écart : validateur MGR, visa, voyage CLÔTURÉ, extractible par ID (R51)", async () => {
    const trip = await tripApprouve(RM_B10, { destinations: ["AE"], clients: [C1, C2], dateEnd: "2026-07-11" });
    const cr1 = await owner.crmContact.create({ data: { tenantId: T, clientId: C1, type: "Visite",
      contenu: { note: "revue" }, origine: "MANUEL", par: RM_B10.userId, at: new Date("2026-07-08T10:00:00Z") } as any });
    const cr2 = await owner.crmContact.create({ data: { tenantId: T, clientId: C2, type: "Visite",
      contenu: { note: "revue" }, origine: "MANUEL", par: RM_B10.userId, at: new Date("2026-07-09T10:00:00Z") } as any });
    const r = await svc.soumettreCertificat(RM_B10, trip.id, {
      activitesParJuridiction: { AE: ["MEET"] },
      rencontres: [{ clientId: C1, contactReportId: cr1.id }, { clientId: C2, contactReportId: cr2.id }],
      ecarts: [], narratif: "Déroulement conforme à l'autorisation." });
    expect(r.validateurResolu).toBe("MGR");                                // validateurDefaut — aucun écart
    const e1 = await evs(trip.id);
    expect(e1.some((x: any) => x.type === "trip.certificat.soumis")).toBe(true);
    await svc.viserCertificat(MGR2, trip.id);
    const e2 = await evs(trip.id);
    expect(e2.some((x: any) => x.type === "trip.cloture")).toBe(true);
    const row: any = await owner.trip.findFirst({ where: { id: trip.id } });
    expect(row.status).toBe("COMPLETED");                                  // clôturé
    const cert: any = e2.filter((x: any) => x.type === "trip.certificat.soumis").pop();
    expect(cert.payload.rencontres).toHaveLength(2);                       // liens contact reports extractibles (R51)
  });

  it("BT-11 [R450/R44] — certificat AVEC écart : routage XB, tâche de qualification, aucune sanction, R13 sur le certifiant", async () => {
    const trip = await tripApprouve(RM_B11, { destinations: ["AE"], dateEnd: "2026-07-11" });
    const r = await svc.soumettreCertificat(RM_B11, trip.id, {
      activitesParJuridiction: { AE: ["MEET", "SIGN"] },
      rencontres: [], narratif: "Mandat signé sur place.",
      ecarts: [{ type: "SIGN", detail: "Signature d'un mandat sur place" }] });
    expect(r.validateurResolu).toBe("XB");                                 // validateurSiEcart
    const e = await evs(trip.id);
    expect(e.some((x: any) => x.type === "trip.certificat.qualification.demandee")).toBe(true);   // tâche liée
    const row: any = await owner.trip.findFirst({ where: { id: trip.id } });
    expect(row.status).toBe("APPROVED");                                   // aucune sanction automatique (R39/R44)
    await expect(svc.viserCertificat(RM_B11, trip.id)).rejects.toThrow(/R13|propre certificat|SELF/i);
  });

  it("BT-12 [R450/R447] — certificat manquant : relances tracées + guard BLOQUANT sur la prochaine demande, levé SEUL au visa", async () => {
    const vieux = await tripApprouve(RM_B12, { destinations: ["AE"], dateEnd: "2026-07-11" });   // SLA 5 j ouvrés dépassé
    const tick = await svc.tickSlaCertificats(ADMIN1);
    expect(tick.relances).toBeGreaterThanOrEqual(1);
    const e1 = await evs(vieux.id);
    const rel: any = e1.filter((x: any) => x.type === "trip.certificat.relance").pop();
    expect(rel.payload.notifie).toBe("MGR");                               // notification MGR tracée
    const t2 = await svc.creer(RM_B12, { destinations: ["AE"], activites: ["MEET"], budget: 1000,
      dateStart: "2026-10-01", dateEnd: "2026-10-03" });
    await expect(svc.soumettre(RM_B12, t2.id)).rejects.toThrow(/certificat/i);
    const e2 = await evs(t2.id);
    const gb: any = e2.filter((x: any) => x.type === "GUARD_BLOCKED").pop();
    expect(gb.payload.guard).toBe("certificatPrecedentManquant");
    expect(gb.payload.reason).toContain(vieux.id);                         // l'ID du voyage non certifié est NOMMÉ
    await svc.soumettreCertificat(RM_B12, vieux.id, { activitesParJuridiction: { AE: ["MEET"] },
      rencontres: [], ecarts: [], narratif: "ok" });
    await svc.viserCertificat(MGR2, vieux.id);
    const r = await svc.soumettre(RM_B12, t2.id);                          // le guard réévalué passe SEUL
    expect(r.status).toBe("PENDING_APPROVAL");
  });

  it("BT-13 [R452/R445/R29] — modification de chaîne : pop-up d'engagement exigé ; grandfathering — D1 garde sa chaîne, D2 applique la nouvelle", async () => {
    const d1 = await svc.creer(RM_B9, { destinations: ["US"], activites: ["MEET"], budget: 1000,
      dateStart: "2026-11-01", dateEnd: "2026-11-03" });
    await svc.soumettre(RM_B9, d1.id);                                     // sous chains.HIGH = [MGR, XB, HPB]
    await expect(svc.modifierParametreBT(ADMIN1, { cle: "chains.HIGH", valeur: ["XB", "HPB"],
      enVigueurLe: "2026-08-05" })).rejects.toMatchObject({
        response: { code: "R445_CONFIRMATION_REQUISE", popup: expect.objectContaining({ cle: "chains.HIGH" }) } });
    const sans = await owner.domainEvent.count({ where: { tenantId: T, type: "PARAM_CHANGED" } });
    expect(sans).toBe(0);                                                  // sans confirmation : AUCUNE écriture
    await svc.modifierParametreBT(ADMIN1, { cle: "chains.HIGH", valeur: ["XB", "HPB"], enVigueurLe: "2026-08-05",
      confirmation: { engagementTexte: "J'engage ma responsabilité — portée : demandes futures (R29).", auteur: ADMIN1.userId } });
    const pc: any = (await owner.domainEvent.findMany({ where: { tenantId: T, type: "PARAM_CHANGED" } })).pop();
    expect(pc.payload).toMatchObject({ cle: "chains.HIGH", nouveau: ["XB", "HPB"] });
    expect((await soumis(d1.id)).chaine).toEqual(["RM", "MGR", "XB", "HPB"]);   // D1 : chaîne FIGÉE (R29)
    const d2 = await svc.creer(RM_B9, { destinations: ["US"], activites: ["MEET"], budget: 1000,
      dateStart: "2026-11-10", dateEnd: "2026-11-12" });
    await svc.soumettre(RM_B9, d2.id);
    expect((await soumis(d2.id)).chaine).toEqual(["RM", "XB", "HPB"]);     // D2 : nouvelle chaîne
  });

  it("BT-14 [R448/R48] — rejeu à date : verdict d'époque (v7 COND), jamais recalculé avec v8 (NON)", async () => {
    const t = await svc.creer(RM_B9, { destinations: ["PT"], activites: ["ADVICE"], budget: 1000,
      dateStart: "2026-09-01", dateEnd: "2026-09-03" });
    await svc.soumettre(RM_B9, t.id);                                      // check consigné AUJOURD'HUI (v8, NON)
    const rejeu = await svc.rejouerCheck(RM_B9, t.id, "2026-06-10");       // l'auditeur rejoue au 10.06
    expect(rejeu.referentielVersion).toBe("2026-06-01");                   // matrice v7 restituée
    const advice = rejeu.parActivite.find((a: any) => a.activite === "ADVICE");
    expect(advice.position ?? advice.verdict).toMatch(/COND/);             // verdict d'époque
    expect(JSON.stringify(rejeu)).not.toMatch(/"2026-07-01"/);             // jamais v8
  });

  it("BT-15 [R449] — l'override RM prime le plafond banque : Sophie passe (19 ≤ 20), un RM sans override déclenche le guard", async () => {
    await svc.modifierParametreBT(ADMIN1, { cle: `quotasOverridesRM.${SOPHIE.userId}.AE`, valeur: 20,
      enVigueurLe: "2026-08-01",
      confirmation: { engagementTexte: "Override Sophie×AE=20 — motif : couverture régionale.", auteur: ADMIN1.userId } });
    for (const rm of [SOPHIE, RM_SANS_OVR])
      await tripApprouve(rm, { status: "COMPLETED", destinations: ["AE"],
        dateStart: "2026-02-01", dateEnd: "2026-02-18" });                 // 17 jours cumulés chacun
    const ts = await svc.creer(SOPHIE, { destinations: ["AE"], activites: ["MEET"], budget: 1000,
      dateStart: "2026-09-10", dateEnd: "2026-09-12" });                   // +2 ⇒ 19 ≤ 20 (override)
    await svc.soumettre(SOPHIE, ts.id);
    await svc.viser(MGR1, ts.id, "MGR");
    expect((await evs(ts.id)).filter((x: any) => x.type === "GUARD_WARNING"
      && (x.payload as any).guard === "quotaDepasse")).toHaveLength(0);    // le plafond effectif est l'override
    const ta = await svc.creer(RM_SANS_OVR, { destinations: ["AE"], activites: ["MEET"], budget: 1000,
      dateStart: "2026-09-10", dateEnd: "2026-09-12" });                   // 19 > 15 (plafond banque)
    await svc.soumettre(RM_SANS_OVR, ta.id);
    await svc.viser(MGR1, ta.id, "MGR", "Dérogation revue annuelle");
    const gw: any = (await evs(ta.id)).filter((x: any) => x.type === "GUARD_WARNING").pop();
    expect(gw.payload.guard).toBe("quotaDepasse");
    expect(gw.payload.reason).toMatch(/19.*15|19\/15/);
  });

  it("BT-16 [R465] — prospect né en voyage : origine tracée, liens voyage+contact report, onboarding standard, listé au certificat", async () => {
    const trip = await tripApprouve(RM_B16, { destinations: ["AE"], activites: ["PROSP"], dateEnd: "2026-07-11" });
    const cr = await owner.crmContact.create({ data: { tenantId: T, clientId: C1, type: "Rencontre prospect",
      contenu: { note: "rencontre Al-Fayed" }, origine: "MANUEL", par: RM_B16.userId, at: new Date("2026-07-09T10:00:00Z") } as any });
    const r = await svc.declarerProspect(RM_B16, trip.id, { nom: "Al-Fayed Family Office", pays: "AE", contactReportId: cr.id });
    expect(r.prospectId).toBeTruthy();
    const e = await evs(trip.id);
    const ne: any = e.filter((x: any) => x.type === "trip.prospect.ne").pop();
    expect(ne.payload).toMatchObject({ clientId: r.prospectId, contactReportId: cr.id });
    expect(ne.payload.verdictProsp).toMatchObject({ verdict: expect.stringMatching(/RESTREINT|COND/) });   // le contexte COND est PORTÉ
    const onb: any = await owner.onboarding.findFirst({ where: { tenantId: T, prospectNom: "Al-Fayed Family Office" } });
    expect(onb).toBeTruthy();
    expect(onb.etape).toBe("PROSPECT");                                    // circuit standard, AUCUNE étape sautée
    const cert = await svc.soumettreCertificat(RM_B16, trip.id, { activitesParJuridiction: { AE: ["PROSP"] },
      rencontres: [{ clientId: r.prospectId, contactReportId: cr.id }], ecarts: [], narratif: "ok" });
    expect(cert.prospectsNes).toEqual([expect.objectContaining({ clientId: r.prospectId })]);   // listé au certificat
  });
});
