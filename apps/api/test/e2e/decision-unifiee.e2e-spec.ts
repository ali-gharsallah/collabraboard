// Bloc 65 — Harmonisation des revues, Volet B (repo R474–R479) · HR-15..HR-22.
// spec/BLOC-65-REVUES-R466-R479.md §1bis/§3 — rouges avant tout code (doctrine Blocs 62/63/64/65-A).
// La décision d'étape est UN objet uniforme (Valider·Refuser·Renvoyer·Déléguer) servi par UN
// service pour KYC, AR, GAR — et réutilisé par Business Trip et Offboarding (aucun fork). Le
// renvoi est un rebroussement ciblé tracé (STEP_SENT_BACK + chutes de visas), le refus une issue
// paramétrée par étape, la corbeille « À décider » une projection multi-types triée par SLA.
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { DecisionUnifieeService } from "../../src/modules/reviews/decision-unifiee.service";
import { RevueHarmoniseeService } from "../../src/modules/reviews/revue-harmonisee.service";
import { KycService } from "../../src/modules/kyc/kyc.service";
import { OffboardingMoteurService } from "../../src/modules/offboarding/offboarding-moteur.service";
import { BusinessTripService } from "../../src/modules/businesstrip/businesstrip.module";

const URL_OWNER = process.env.DATABASE_URL_OWNER ?? "postgresql://olive:olive@localhost:5433/olive_test";
const owner = new PrismaClient({ datasources: { db: { url: URL_OWNER } } });
const audit: any = { log: async () => undefined };

const T = randomUUID();
const RM1 = { tenantId: T, userId: randomUUID(), role: "RM" };   // préparateur (répond aux questions)
const RM2 = { tenantId: T, userId: randomUUID(), role: "RM" };   // second RM (visa moteur offboarding)
const CO1 = { tenantId: T, userId: randomUUID(), role: "CO" };   // validateur
const CO3 = { tenantId: T, userId: randomUUID(), role: "CO" };   // tiers (délégation, consommation)
const ADMIN = { tenantId: T, userId: randomUUID(), role: "ADMIN" };

const ETAPES = ["Collecte", "Review", "Validation"];             // gabarit d'étapes à visa du dossier
let seq = 300;

async function mkClient(name: string, riskLevel = "HIGH") {
  return owner.client.create({ data: { tenantId: T, name, structure: "SA", country: "CH", riskLevel } });
}
// Un dossier EN COURS dont les étapes sont des sections à visa (Collecte→Review→Validation),
// préparées par RM1 (kyc_question_history ⇒ exclusion R13 sur RM1, jamais sur CO1/CO3).
async function mkDossier(etapesSignees: string[] = []) {
  seq += 1;
  const kyc = await owner.kycFile.create({ data: {
    tenantId: T, clientId: (await mkClient(`Dossier-${seq}`)).id,
    code: `KYC-2026-CH-${String(seq).padStart(4, "0")}-R1`,
    year: 2026, countryCode: "CH", sequence: seq, revision: 1, workflow: "EDD",
    riskScore: 61, riskLevel: "HIGH", status: "IN_PROGRESS", createdBy: RM1.userId } });
  for (let i = 0; i < ETAPES.length; i++) {
    const sec = await owner.kycSection.create({ data: { kycFileId: kyc.id, code: ETAPES[i],
      label: ETAPES[i], orderIndex: i } as any });
    const q = await owner.kycQuestion.create({ data: { sectionId: sec.id, code: `q-${ETAPES[i]}`,
      label: `q-${ETAPES[i]}`, answer: "réponse", answeredBy: RM1.userId, answeredAt: new Date() } as any });
    await owner.kycQuestionHistory.create({ data: { questionId: q.id, previousValue: null,
      newValue: "réponse", changedBy: RM1.userId, changedAt: new Date(), hash: "0".repeat(64) } });
    const signee = etapesSignees.includes(ETAPES[i]);
    await owner.kycVisa.create({ data: { kycFileId: kyc.id, sectionCode: ETAPES[i],
      requiredRole: "CO", status: signee ? "SIGNED" : "PENDING",
      signedBy: signee ? CO3.userId : null, signedAt: signee ? new Date() : null } as any });
  }
  return kyc;
}
// Re-signe des étapes en base (fixture) — pour re-renvoyer sans re-jouer tout le circuit.
async function resigner(kycId: string, etapes: string[]) {
  await owner.kycVisa.updateMany({ where: { kycFileId: kycId, sectionCode: { in: etapes } },
    data: { status: "SIGNED", signedBy: CO3.userId, signedAt: new Date() } });
}
// Un KYC APPROUVÉ (socle d'AR/GAR — même forme que le harnais Volet A).
async function mkKycValide(clientId: string) {
  seq += 1;
  const kyc = await owner.kycFile.create({ data: {
    tenantId: T, clientId, code: `KYC-2026-CH-${String(seq).padStart(4, "0")}-R1`,
    year: 2026, countryCode: "CH", sequence: seq, revision: 1, workflow: "EDD",
    riskScore: 61, riskLevel: "HIGH", status: "VALIDATED", createdBy: RM1.userId,
    validatedBy: CO1.userId, validatedAt: new Date() } });
  const sec = await owner.kycSection.create({ data: { kycFileId: kyc.id, code: "sofsow",
    label: "sofsow", orderIndex: 0 } as any });
  await owner.kycQuestion.create({ data: { sectionId: sec.id, code: "q1", label: "q1",
    answer: "héritage", answeredBy: RM1.userId, answeredAt: new Date() } as any });
  await owner.kycVisa.create({ data: { kycFileId: kyc.id, sectionCode: "sofsow",
    requiredRole: "CO", status: "SIGNED", signedBy: CO1.userId, signedAt: new Date() } as any });
  return kyc;
}
async function mkDeadline(clientId: string, kycId: string, dueDate: Date) {
  return owner.reviewDeadline.create({ data: { tenantId: T, clientId, sourceKycId: kycId,
    ddlLevel: "EDD", cadenceMois: 12, dueDate } });
}
async function mkGroupeUbo(nom: string, clientIds: string[]) {
  const p = await owner.person.create({ data: { tenantId: T, nom } as any });
  for (const cid of clientIds)
    await owner.personneLien.create({ data: { tenantId: T, personneId: p.id, typeCode: "UBO",
      categorie: "OFFICIEL", cibleType: "COMPTE", cibleId: cid, posePar: CO1.userId, poseAt: new Date() } });
  return p;
}
const evsType = async (type: string) =>
  owner.domainEvent.findMany({ where: { tenantId: T, type }, orderBy: { id: "asc" } });
const evsAgg = async (aggregateId: string) =>
  owner.domainEvent.findMany({ where: { tenantId: T, aggregateId }, orderBy: { id: "asc" } });

let svc: DecisionUnifieeService;
let revues: RevueHarmoniseeService;
let kycSvc: KycService;

beforeAll(async () => {
  await owner.tenant.create({ data: { id: T, name: "T-HRB", settings: {
    review: { periodiciteMois: { HIGH: 12, MEDIUM: 24, LOW: 36, PEP: 12 } },
    decision: {
      renvoi: { seuilBoucles: 3 },
      issueRefusParEtape: { Review: { issue: "RENVOI", cible: "Collecte" }, Validation: { issue: "TERMINAL" } },
    },
    businessTrip: { chains: { LOW: ["CO"] } },                   // le visa BT atterrit chez CO (corbeille HR-21)
  } as any } });
  revues = new RevueHarmoniseeService(owner as any, audit);
  kycSvc = new KycService(owner as any, audit);
  svc = new DecisionUnifieeService(owner as any, audit);
  svc.brancherKyc(kycSvc);
  svc.brancherRevues(revues);
  svc.brancherMoteur(new OffboardingMoteurService(owner as any, audit));
  svc.brancherBusinessTrip(new BusinessTripService(owner as any, audit));
});
afterAll(async () => { await owner.$disconnect(); });

describe("Bloc 65 Volet B — décision unifiée (R474–R479, spec/BLOC-65 §1bis/§3)", () => {

  it("HR-15 [R474] — une barre, partout la même : mêmes issues, même ordre, visa R15, délégation R4, moteur réutilisé sans fork", async () => {
    const kyc = await mkDossier();
    const cSocle = await mkClient("Socle AR");
    const socle = await mkKycValide(cSocle.id);
    const dl = await mkDeadline(cSocle.id, socle.id, new Date("2026-09-01"));
    const ar = await revues.ouvrirRevue(CO1, dl.id, { type: "ACCOUNT_REVIEW" });
    const cG1 = await mkClient("Groupe-1"); const cG2 = await mkClient("Groupe-2");
    await mkKycValide(cG1.id); await mkKycValide(cG2.id);
    const p = await mkGroupeUbo("UBO-HR15", [cG1.id, cG2.id]);
    const gar = await revues.declencherRevueGroupe(CO1, { cle: `UBO_COMMUN:${p.id}` });

    const barres = [
      await svc.barre(CO1, "KYC", kyc.code),
      await svc.barre(CO1, "ACCOUNT_REVIEW", ar.kycCode),
      await svc.barre(CO1, "GROUP_ACCOUNT_REVIEW", gar.garId),
    ];
    for (const b of barres) {                                    // mêmes issues, même ordre — le composant
      expect(b.issues.map((i: any) => i.action)).toEqual(["VALIDER", "REFUSER", "RENVOYER", "DELEGUER"]);
      expect(b.issues.map((i: any) => i.raccourci)).toEqual(["V", "R", "B", "D"]);
      for (const i of b.issues) expect(typeof i.libelle).toBe("string");
    }
    // Valider = visa R15 (nommé, horodaté)
    const r = await svc.decider(CO1, "KYC", kyc.code, { action: "VALIDER", etape: "Collecte" });
    expect(r.action).toBe("VALIDER");
    const visa = await owner.kycVisa.findFirst({ where: { kycFileId: kyc.id, sectionCode: "Collecte" } });
    expect(visa!.status).toBe("SIGNED");
    expect(visa!.signedBy).toBe(CO1.userId);
    expect(visa!.signedAt).toBeTruthy();
    // Déléguer = passe la main au remplaçant désigné (R4), tracé
    await svc.decider(CO1, "KYC", kyc.code, { action: "DELEGUER", etape: "Review", delegueA: CO3.userId });
    const vReview = await owner.kycVisa.findFirst({ where: { kycFileId: kyc.id, sectionCode: "Review" } });
    expect(vReview!.validateur).toBe(CO3.userId);
    const del = (await evsType("decision.deleguee")).filter((e) => e.aggregateId === kyc.id);
    expect(del.length).toBe(1);
    expect((del[0].payload as any).a).toBe(CO3.userId);
    // Le MÊME service sert le moteur standard (Offboarding) — aucun fork
    const cOff = await mkClient("Sortant SA", "LOW");
    const off = await new OffboardingMoteurService(owner as any, audit)
      .initier(CO1, { clientId: cOff.id, motif: "Demande du client" });
    const rOff = await svc.decider(RM2, "OFFBOARDING", off.instanceId, { action: "VALIDER" });
    expect(rOff.action).toBe("VALIDER");
    const visasOff = await evsAgg(off.instanceId);
    expect(visasOff.some((e) => e.type === "VISA_APPOSE" || e.type === "TRANSITION_FIRED")).toBe(true);
    (svc as any)._hr15 = { kyc, ar, gar };
  });

  it("HR-16 [R475] — renvoi ciblé : STEP_SENT_BACK, visas tombés TRACÉS, tâche de reprise nominative, même dossier, boucle 1", async () => {
    const kyc = await mkDossier(["Collecte", "Review"]);         // à l'étape Validation
    const r = await svc.decider(CO1, "KYC", kyc.code, { action: "RENVOYER", cible: "Collecte",
      motif: { code: "DOCS_INSUFFISANTS", texte: "Justificatif d'origine des fonds illisible" },
      sections: ["Collecte"] });
    expect(r.boucles).toBe(1);
    const sb = (await evsType("STEP_SENT_BACK")).filter((e) => e.aggregateId === kyc.id);
    expect(sb.length).toBe(1);
    const pl = sb[0].payload as any;
    expect(pl.cible).toBe("Collecte");
    expect(pl.motif.texte).toContain("illisible");
    expect(pl.sections).toEqual(["Collecte"]);
    // Les visas re-traversés TOMBENT — par événements de chute, le premier passage reste lisible
    const chutes = (await evsType("decision.visa.tombe")).filter((e) => e.aggregateId === kyc.id);
    expect(chutes.map((e) => (e.payload as any).section).sort()).toEqual(["Collecte", "Review"]);
    for (const c of chutes) expect((c.payload as any).viseurOriginal).toBe(CO3.userId);
    for (const et of ["Collecte", "Review"]) {
      const v = await owner.kycVisa.findFirst({ where: { kycFileId: kyc.id, sectionCode: et } });
      expect(v!.status).toBe("PENDING");
      expect(v!.signedBy).toBeNull();
    }
    // Tâche de reprise NOMINATIVE pour l'owner de la section cochée, motif en tête
    const taches = (await evsType("tache.reprise.creee")).filter((e) => e.aggregateId === kyc.id);
    expect(taches.length).toBe(1);
    expect((taches[0].payload as any).owner).toBe(RM1.userId);
    expect((taches[0].payload as any).motif.texte).toContain("illisible");
    const rows = await owner.task.findMany({ where: { tenantId: T, assigneeId: RM1.userId, type: "REPRISE_REVUE" } });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    // Même dossier : aucune duplication, aucune nouvelle révision
    const rels = await owner.kycFile.findMany({ where: { tenantId: T, clientId: kyc.clientId } });
    expect(rels.length).toBe(1);
    expect(rels[0].id).toBe(kyc.id);
    (svc as any)._hr16 = { kyc };
  });

  it("HR-17 [R475/R476] — pas de motif, pas de décision : refus typé, AUCUN événement d'état émis", async () => {
    const { kyc } = (svc as any)._hr16;
    const avant = (await evsAgg(kyc.id)).length;
    await expect(svc.decider(CO1, "KYC", kyc.code, { action: "REFUSER", etape: "Collecte" }))
      .rejects.toMatchObject({ response: { code: "DECISION_MOTIF_REQUIS" } });
    await expect(svc.decider(CO1, "KYC", kyc.code, { action: "RENVOYER", cible: "Collecte" }))
      .rejects.toMatchObject({ response: { code: "DECISION_MOTIF_REQUIS" } });
    await expect(svc.decider(CO1, "KYC", kyc.code, { action: "REFUSER", etape: "Collecte",
      motif: { code: "AUTRE", texte: "" } }))                    // texte vide = pas de motif
      .rejects.toMatchObject({ response: { code: "DECISION_MOTIF_REQUIS" } });
    expect((await evsAgg(kyc.id)).length).toBe(avant);           // rien n'a été écrit
  });

  it("HR-18 [R475/R39] — boucles comptées, signal AVERTISSEMENT au manager au seuil — jamais de blocage", async () => {
    const kyc = await mkDossier(["Collecte", "Review"]);
    const motif = { code: "AUTRE", texte: "reprise" };
    const r1 = await svc.decider(CO1, "KYC", kyc.code, { action: "RENVOYER", cible: "Collecte", motif });
    expect(r1.boucles).toBe(1);
    await resigner(kyc.id, ["Collecte", "Review"]);
    const r2 = await svc.decider(CO1, "KYC", kyc.code, { action: "RENVOYER", cible: "Collecte", motif });
    expect(r2.boucles).toBe(2);
    expect((await evsType("decision.boucles.signal")).filter((e) => e.aggregateId === kyc.id).length).toBe(0);
    await resigner(kyc.id, ["Collecte", "Review"]);
    const r3 = await svc.decider(CO1, "KYC", kyc.code, { action: "RENVOYER", cible: "Collecte", motif });
    expect(r3.boucles).toBe(3);                                  // compteur affiché = 3
    const signaux = (await evsType("decision.boucles.signal")).filter((e) => e.aggregateId === kyc.id);
    expect(signaux.length).toBe(1);                              // signal au manager, une fois au seuil
    expect((signaux[0].payload as any).severite).toBe("AVERTISSEMENT");
    expect((signaux[0].payload as any).seuil).toBe(3);
    // AUCUN blocage automatique : le dossier continue son chemin
    const r4 = await svc.decider(CO1, "KYC", kyc.code, { action: "VALIDER", etape: "Collecte" });
    expect(r4.action).toBe("VALIDER");
  });

  it("HR-19 [R476] — l'issue du refus dépend de l'étape : RENVOI sur Review (mêmes effets que R475), TERMINAL sur Validation → REJECTED", async () => {
    // Étape intermédiaire « Review » : issueRefus=RENVOI vers Collecte (paramétrage tenant)
    const k1 = await mkDossier(["Collecte"]);                    // étape courante = Review
    const r1 = await svc.decider(CO1, "KYC", k1.code, { action: "REFUSER", etape: "Review",
      motif: { code: "DOCS_INSUFFISANTS", texte: "pièces incomplètes" } });
    expect(r1.issue).toBe("RENVOI");
    const sb = (await evsType("STEP_SENT_BACK")).filter((e) => e.aggregateId === k1.id);
    expect(sb.length).toBe(1);                                   // le refus ÉQUIVAUT à un renvoi (R475)
    expect((sb[0].payload as any).cible).toBe("Collecte");
    const vC = await owner.kycVisa.findFirst({ where: { kycFileId: k1.id, sectionCode: "Collecte" } });
    expect(vC!.status).toBe("PENDING");                          // le visa de Collecte est tombé
    expect((await owner.kycFile.findUnique({ where: { id: k1.id } }))!.status).not.toBe("REJECTED");
    // Étape finale « Validation » : TERMINAL → dossier REJECTED (R16)
    const k2 = await mkDossier(["Collecte", "Review"]);
    const r2 = await svc.decider(CO1, "KYC", k2.code, { action: "REFUSER", etape: "Validation",
      motif: { code: "RISQUE_INACCEPTABLE", texte: "risque hors appétit" } });
    expect(r2.issue).toBe("TERMINAL");
    expect((await owner.kycFile.findUnique({ where: { id: k2.id } }))!.status).toBe("REJECTED");
    const ref = (await evsType("decision.refusee")).filter((e) => e.aggregateId === k2.id);
    expect(ref.length).toBe(1);
    expect((ref[0].payload as any).issue).toBe("TERMINAL");
  });

  it("HR-20 [R477/R13] — optimiste mais honnête : le moteur refuse en clair, AUCUNE écriture de visa au journal", async () => {
    const kyc = await mkDossier();
    const avant = (await evsAgg(kyc.id)).length;
    await expect(svc.decider(RM1, "KYC", kyc.code, { action: "VALIDER", etape: "Collecte" }))
      .rejects.toThrow(/R13/);                                   // la règle revient EN CLAIR
    const v = await owner.kycVisa.findFirst({ where: { kycFileId: kyc.id, sectionCode: "Collecte" } });
    expect(v!.status).toBe("PENDING");                           // l'affichage optimiste n'a jamais été une écriture
    expect(v!.signedBy).toBeNull();
    expect((await evsAgg(kyc.id)).length).toBe(avant);
  });

  it("HR-21 [R478] — la corbeille « À décider » : tous types confondus, triée par SLA, l'échue en tête badge ROUGE, deep-link prêt", async () => {
    // 2 KYC en attente de visa CO — dont 1 SLA échu (deadline dépassée)
    const kEchu = await mkDossier();
    await mkDeadline(kEchu.clientId, kEchu.id, new Date("2026-08-01"));   // échue (aujourd'hui : 09.08.2026)
    const kOk = await mkDossier();
    await mkDeadline(kOk.clientId, kOk.id, new Date("2026-11-01"));
    // 1 GAR ouverte (décision de groupe en attente)
    const cA = await mkClient("Corb-A"); const cB = await mkClient("Corb-B");
    await mkKycValide(cA.id); await mkKycValide(cB.id);
    const p = await mkGroupeUbo("UBO-HR21", [cA.id, cB.id]);
    const gar = await revues.declencherRevueGroupe(ADMIN, { cle: `UBO_COMMUN:${p.id}` });
    // 1 Business Trip en attente du visa CO (chaîne tenant LOW=["CO"])
    const trip = await owner.trip.create({ data: { tenantId: T, travelerId: RM1.userId,
      status: "PENDING_APPROVAL", dateStart: "2026-08-20", dateEnd: "2026-08-22",
      destinations: ["FR"], purpose: "visite client" } });
    await owner.tripVisa.create({ data: { tenantId: T, tripId: trip.id, role: "CO", status: "PENDING" } });

    const c = await svc.corbeille(CO1);
    expect(c.tri).toBe("SLA");
    const refs = c.items.map((i: any) => i.ref);
    expect(refs).toContain(kEchu.code);
    expect(refs).toContain(kOk.code);
    expect(refs).toContain(gar.garId);
    expect(refs).toContain(trip.id);
    expect(c.items[0].ref).toBe(kEchu.code);                     // l'échue EN TÊTE
    expect(c.items[0].badge).toBe("ROUGE");
    for (const i of c.items) {                                   // chaque ligne ouvre à l'étape à décider
      expect(i.ouvrir).toMatchObject({ type: i.type, ref: i.ref });
      expect(typeof i.ouvrir.etape).toBe("string");
    }
    const types = new Set(c.items.map((i: any) => i.type));
    expect(types.has("KYC")).toBe(true);
    expect(types.has("GROUP_ACCOUNT_REVIEW")).toBe(true);
    expect(types.has("BUSINESS_TRIP")).toBe(true);
    // Les tâches de reprise nées d'un renvoi y figurent pour leurs OWNERS (RM1, HR-16)
    const cOwner = await svc.corbeille(RM1);
    expect(cOwner.items.some((i: any) => i.type === "TACHE_REPRISE")).toBe(true);
  });

  it("HR-22 [R479] — enchaîner sans friction : bandeau réversible, annulation tracée tant que la transition n'est pas consommée", async () => {
    const kyc = await mkDossier();
    const r = await svc.decider(CO1, "KYC", kyc.code, { action: "VALIDER", etape: "Collecte" });
    // mode SUIVANT (défaut tenant) : bandeau de confirmation réversible — JAMAIS de modal
    expect(r.apres.mode).toBe("SUIVANT");
    expect(r.apres.bandeau).toContain(kyc.code);
    expect(r.apres.annulable).toBe(true);
    expect(r.apres).toHaveProperty("suivant");                   // le prochain dossier de la corbeille
    // Annulation possible tant qu'aucun tiers n'a consommé — événement d'annulation tracé
    await svc.annuler(CO1, "KYC", kyc.code, { etape: "Collecte" });
    const ann = (await evsType("decision.annulee")).filter((e) => e.aggregateId === kyc.id);
    expect(ann.length).toBe(1);
    expect((ann[0].payload as any).par).toBe(CO1.userId);
    const v = await owner.kycVisa.findFirst({ where: { kycFileId: kyc.id, sectionCode: "Collecte" } });
    expect(v!.status).toBe("PENDING");
    // Re-validation, puis un TIERS consomme la transition (CO3 vise l'étape suivante) → annulation refusée
    await svc.decider(CO1, "KYC", kyc.code, { action: "VALIDER", etape: "Collecte" });
    await svc.decider(CO3, "KYC", kyc.code, { action: "VALIDER", etape: "Review" });
    await expect(svc.annuler(CO1, "KYC", kyc.code, { etape: "Collecte" }))
      .rejects.toMatchObject({ response: { code: "DECISION_TRANSITION_CONSOMMEE" } });
  });
});
