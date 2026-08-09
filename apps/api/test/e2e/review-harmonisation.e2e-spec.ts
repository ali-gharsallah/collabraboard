// Bloc 65 — Harmonisation des revues, Volet A (repo R466–R473) · HR-01..HR-14.
// spec/BLOC-65-REVUES-R466-R479.md §3 — rouges avant tout code (doctrine Blocs 62/63/64).
// Delta sur l'existant : l'AR est DÉJÀ une révision du dossier KYC (reviews R283) ; la GAR
// devient un dossier PARENT projeté d'événements (pattern moteur Bloc 62) ; le groupe est une
// PROJECTION du graphe personnes/liens (R30+) ; le §Review passe par le pop-up R445.
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { RevueHarmoniseeService } from "../../src/modules/reviews/revue-harmonisee.service";

const URL_OWNER = process.env.DATABASE_URL_OWNER ?? "postgresql://olive:olive@localhost:5433/olive_test";
const owner = new PrismaClient({ datasources: { db: { url: URL_OWNER } } });
const audit: any = { log: async () => undefined };

const T = randomUUID();
const RM1 = { tenantId: T, userId: randomUUID(), role: "RM" };
const CO1 = { tenantId: T, userId: randomUUID(), role: "CO" };
const CO2 = { tenantId: T, userId: randomUUID(), role: "CO_SR" };
const ADMIN = { tenantId: T, userId: randomUUID(), role: "ADMIN" };

let seq = 100;
async function mkClient(name: string, riskLevel = "HIGH") {
  return owner.client.create({ data: { tenantId: T, name, structure: "SA", country: "CH", riskLevel } });
}
// Un KYC APPROUVÉ avec ses sections/questions répondues et visas signés — le socle dont part la revue (R467).
async function mkKycValide(clientId: string, reponses: Record<string, Record<string, string>>) {
  seq += 1;
  const kyc = await owner.kycFile.create({ data: {
    tenantId: T, clientId, code: `KYC-2026-CH-${String(seq).padStart(4, "0")}-R1`,
    year: 2026, countryCode: "CH", sequence: seq, revision: 1, workflow: "EDD",
    riskScore: 61, riskLevel: "HIGH", status: "VALIDATED", createdBy: RM1.userId,
    validatedBy: CO1.userId, validatedAt: new Date() } });
  for (const [secCode, qs] of Object.entries(reponses)) {
    const sec = await owner.kycSection.create({ data: { kycFileId: kyc.id, code: secCode } as any });
    for (const [qCode, answer] of Object.entries(qs))
      await owner.kycQuestion.create({ data: { sectionId: sec.id, code: qCode, answer,
        answeredBy: RM1.userId, answeredAt: new Date() } as any });
    await owner.kycVisa.create({ data: { kycFileId: kyc.id, sectionCode: secCode,
      requiredRole: "CO", status: "SIGNED", signedBy: CO1.userId, signedAt: new Date() } as any });
  }
  return kyc;
}
async function mkDeadline(clientId: string, kycId: string) {
  return owner.reviewDeadline.create({ data: { tenantId: T, clientId, sourceKycId: kycId,
    ddlLevel: "EDD", cadenceMois: 12, dueDate: new Date("2026-09-01") } });
}
// Le groupe se PROJETTE du graphe : une personne UBO liée à N clients (cible COMPTE, R30+/R152).
async function mkGroupeUbo(nom: string, clientIds: string[]) {
  const p = await owner.personne.create({ data: { tenantId: T, nom, type: "PHYSIQUE" } as any });
  for (const cid of clientIds)
    await owner.personneLien.create({ data: { tenantId: T, personneId: p.id, typeCode: "UBO",
      categorie: "OFFICIEL", cibleType: "COMPTE", cibleId: cid, posePar: CO1.userId, poseAt: new Date() } });
  return p;
}
const evsType = async (type: string) =>
  owner.domainEvent.findMany({ where: { tenantId: T, type }, orderBy: { id: "asc" } });
const evs = async (aggregateId: string) =>
  owner.domainEvent.findMany({ where: { tenantId: T, aggregateId }, orderBy: { id: "asc" } });

let svc: RevueHarmoniseeService;

beforeAll(async () => {
  await owner.tenant.create({ data: { id: T, name: "T-HR", settings: {
    review: { periodiciteMois: { HIGH: 12, MEDIUM: 24, LOW: 36, PEP: 12 } } } as any } });
  svc = new RevueHarmoniseeService(owner as any, audit);
});
afterAll(async () => { await owner.$disconnect(); });

describe("Bloc 65 Volet A — harmonisation des revues (R466–R473, spec/BLOC-65 §3)", () => {

  it("HR-01 [R466] — trois types, une structure : KYC, AR et GAR sont le MÊME dossier projeté, aucun outcome libre", async () => {
    const c1 = await mkClient("Alpha SA"); const c2 = await mkClient("Beta SA"); const c3 = await mkClient("Gamma SA");
    const k1 = await mkKycValide(c1.id, { sofsow: { q1: "héritage 2019" } });
    await mkKycValide(c2.id, { sofsow: { q1: "salaires" } });
    await mkKycValide(c3.id, { sofsow: { q1: "dividendes" } });
    await mkGroupeUbo("Famille Al-Fayed", [c1.id, c2.id, c3.id]);
    const d1 = await mkDeadline(c1.id, k1.id);
    const ar = await svc.ouvrirRevue(CO1, d1.id, { type: "ACCOUNT_REVIEW" });
    const groupes = await svc.composerGroupes(ADMIN);
    const gar = await svc.declencherRevueGroupe(CO1, { cle: groupes[0].cle });
    const dKyc = await svc.dossier(CO1, k1.code);
    const dAr = await svc.dossier(CO1, ar.kycCode);
    const dGar = await svc.dossier(CO1, gar.garId);
    expect(dKyc.type).toBe("KYC");
    expect(dAr.type).toBe("ACCOUNT_REVIEW");
    expect(dGar.type).toBe("GROUP_ACCOUNT_REVIEW");
    for (const d of [dKyc, dAr, dGar]) {                       // même structure : sections+visas, timeline
      expect(Array.isArray(d.sections)).toBe(true);
      expect(Array.isArray(d.timeline)).toBe(true);
      expect(d.outcome).toBeUndefined();                       // aucun outcome en texte libre (E-HR-1)
    }
    const arRow = await owner.kycFile.findFirst({ where: { code: ar.kycCode } });
    expect(arRow!.revision).toBe(2);                           // l'AR EST une révision du dossier — pas une table plate
    expect(arRow!.previousKycId).toBe(k1.id);
    (svc as any)._hr01 = { c1, k1, ar, gar, groupes };
  });

  it("HR-02 [R467] — l'AR est pré-remplie du dernier KYC approuvé : REPRISE puis MODIFIÉE ancien/nouveau", async () => {
    const { ar, k1 } = (svc as any)._hr01;
    const d0 = await svc.delta(CO1, ar.kycCode);
    const q = d0.reprises.find((r: any) => r.question === "q1");
    expect(q).toBeTruthy();                                    // pré-remplie, origine REPRISE
    expect(q.valeur).toBe("héritage 2019");
    expect(q.sourceKycId).toBe(k1.id);                         // référence à la réponse source
    await svc.modifierReponse(RM1, ar.kycCode, { section: "sofsow", question: "q1",
      valeur: "héritage 2019 + cession d'entreprise 2026" });
    const d1 = await svc.delta(CO1, ar.kycCode);
    const m = d1.modifiees.find((x: any) => x.question === "q1");
    expect(m.ancien).toBe("héritage 2019");
    expect(m.nouveau).toBe("héritage 2019 + cession d'entreprise 2026");
  });

  it("HR-03 [R467] — la revue est un diff visé : delta en tête, visa référence les changements, bloc « revu, inchangé »", async () => {
    const c = await mkClient("Delta SA");
    const k = await mkKycValide(c.id, {
      sofsow: { q1: "héritage", q2: "immobilier" },
      identity: Object.fromEntries(Array.from({ length: 14 }, (_, i) => ["iq" + i, "val" + i])) });
    const d = await mkDeadline(c.id, k.id);
    const ar = await svc.ouvrirRevue(CO1, d.id, { type: "ACCOUNT_REVIEW" });
    await svc.modifierReponse(RM1, ar.kycCode, { section: "sofsow", question: "q1", valeur: "héritage + PE" });
    await svc.modifierReponse(RM1, ar.kycCode, { section: "sofsow", question: "q2", valeur: "immobilier + art" });
    const delta = await svc.delta(CO1, ar.kycCode);
    expect(delta.modifiees).toHaveLength(2);
    expect(delta.reprises).toHaveLength(14);
    const visa = await svc.viserDelta(CO1, ar.kycCode);
    expect(visa.changements).toHaveLength(2);                  // le visa RÉFÉRENCE la liste des changements
    const bloc = await svc.viserEnBloc(CO1, ar.kycCode);       // sections sans changement : « revu, inchangé »
    expect(bloc.sections).toContain("identity");
    const evb = await evsType("review.section.visee.bloc");
    expect(evb.some((e: any) => (e.payload as any).kycCode === ar.kycCode)).toBe(true);
    (svc as any)._hr03 = { ar, c };
  });

  it("HR-04 [R468/R44] — verdict NON CONFORME : aiguillage PROPOSÉ, jamais exécuté seul — deux événements distincts", async () => {
    const { ar } = (svc as any)._hr03;
    await svc.poserVerdict(CO1, ar.kycCode, { verdict: "NON_CONFORME", motivation: "structure opacifiée" });
    const prop = await evsType("tache.review.aiguillage");
    const mine = prop.filter((e: any) => (e.payload as any).kycCode === ar.kycCode);
    expect(mine).toHaveLength(1);
    expect((mine[0].payload as any).options).toEqual(expect.arrayContaining(["EDD", "COC", "OFFBOARDING"]));
    expect(await owner.cocFile.count({ where: { tenantId: T } })).toBe(0);   // RIEN d'exécuté sans humain
    await svc.accepterAiguillage(CO2, ar.kycCode, { option: "EDD" });
    const dec = await evsType("review.aiguillage.decide");
    expect(dec.filter((e: any) => (e.payload as any).kycCode === ar.kycCode)).toHaveLength(1);
    const verd = await evsType("review.verdict.pose");
    expect(verd.filter((e: any) => (e.payload as any).kycCode === ar.kycCode)).toHaveLength(1);   // 2 événements distincts
  });

  it("HR-05 [R468] — nextReviewDate = CALCUL (périodicité tenant × risque), recalcul tracé au changement de risque", async () => {
    const { ar, c } = (svc as any)._hr03;
    const r = await svc.cloturerRevue(CO1, ar.kycCode);        // AUCUN paramètre de date : la saisie n'existe pas
    const due = new Date(r.nextReviewDate);
    const attendu = new Date(); attendu.setMonth(attendu.getMonth() + 12);   // client HIGH → 12 mois
    expect(Math.abs(due.getTime() - attendu.getTime())).toBeLessThan(86400000 * 3);
    const rc = await svc.surChangementRisque(CO2, c.id, { risque: "MEDIUM", motif: "revue favorable" });
    const due2 = new Date(rc.nextReviewDate);
    const attendu2 = new Date(); attendu2.setMonth(attendu2.getMonth() + 24);
    expect(Math.abs(due2.getTime() - attendu2.getTime())).toBeLessThan(86400000 * 3);
    const sets = await evsType("REVIEW_DEADLINE_SET");
    const trace = sets.find((e: any) => (e.payload as any).motif && /risque/i.test((e.payload as any).motif));
    expect(trace).toBeTruthy();                                // l'événement de recalcul TRACE la cause
  });

  it("HR-06 [R469/R473] — critère paramétrable, composition PROJETÉE, pop-up R445 sur le changement, grandfathering R29", async () => {
    const { groupes, gar } = (svc as any)._hr01;
    expect(groupes[0].membres).toHaveLength(3);                // projection calculée — aucune liste stockée
    expect(groupes[0].critere).toBe("UBO_COMMUN");
    await expect(svc.modifierParametreReview(ADMIN, {
      cle: "review.groupe.criteres", valeur: ["UBO_COMMUN", "GROUPE_CORPORATE_DECLARE"], enVigueurLe: "2026-08-10" }))
      .rejects.toMatchObject({ response: { code: "R445_CONFIRMATION_REQUISE" } });   // sans confirmation : POP-UP, aucune écriture
    await svc.modifierParametreReview(ADMIN, {
      cle: "review.groupe.criteres", valeur: ["UBO_COMMUN", "GROUPE_CORPORATE_DECLARE"], enVigueurLe: "2026-08-10",
      confirmation: { engagementTexte: "J'élargis le critère de groupe — grandfathering R29 sur les GAR en cours." } });
    const pc = await evsType("PARAM_CHANGED");
    expect(pc.some((e: any) => (e.payload as any).cle === "review.groupe.criteres")).toBe(true);
    const rejeu = await svc.rejouerGar(ADMIN, gar.garId);
    expect(rejeu.composition).toHaveLength(3);                 // la GAR en cours garde SA composition d'initiation (R29)
    expect(rejeu.critere).toBe("UBO_COMMUN");
  });

  it("HR-07 [R470] — déclenchement groupe : un dossier PARENT + N membres liés, chaque création tracée avec origine", async () => {
    const { gar } = (svc as any)._hr01;
    const ouvertes = await evsType("gar.ouverte");
    const mine = ouvertes.find((e: any) => (e.payload as any).garId === gar.garId);
    expect(mine).toBeTruthy();
    expect((mine!.payload as any).composition).toHaveLength(3);
    expect((mine!.payload as any).sections).toEqual(expect.arrayContaining(["vue-consolidee", "decision-groupe"]));
    const membres = await evsType("review.membre.ouvert");
    const liens = membres.filter((e: any) => (e.payload as any).garId === gar.garId);
    expect(liens).toHaveLength(3);                             // 3 AR standard, chacune LIÉE au parent
    for (const m of liens) expect((m.payload as any).origine).toMatch(/groupe/i);
  });

  it("HR-08 [R470] — guard de consolidation : membre non clôturé = GUARD_BLOCKED nommé ; tous clos = passe seul", async () => {
    const { gar } = (svc as any)._hr01;
    const membres = (await evsType("review.membre.ouvert"))
      .filter((e: any) => (e.payload as any).garId === gar.garId)
      .map((e: any) => (e.payload as any).kycCode);
    await svc.poserVerdict(CO1, membres[0], { verdict: "CONFORME" });
    await svc.poserVerdict(CO1, membres[1], { verdict: "CONFORME" });
    await expect(svc.viserDecisionGroupe(CO2, gar.garId, { motivation: "groupe sain" })).rejects.toThrow(/non clôturé/);
    const gb = await evsType("GUARD_BLOCKED");
    expect(gb.some((e: any) => /membre non clôturé/.test((e.payload as any).reason))).toBe(true);
    await svc.poserVerdict(CO1, membres[2], { verdict: "RESERVES" });
    const ok = await svc.viserDecisionGroupe(CO2, gar.garId, { motivation: "groupe sain, réserves sur un membre" });
    expect(ok.vise).toBe(true);                                // le guard réévalué PASSE sans intervention sur le parent
    (svc as any)._hr08 = { gar, membres };
  });

  it("HR-09 [R470] — la décision de groupe RÉFÉRENCE les verdicts membres ; la vue consolidée est une projection", async () => {
    const { gar } = (svc as any)._hr08;
    const dec = (await evsType("gar.decision.visee")).find((e: any) => (e.payload as any).garId === gar.garId);
    expect(dec).toBeTruthy();
    const p: any = dec!.payload;
    expect(p.verdictsMembres).toHaveLength(3);
    expect(p.verdictsMembres.map((v: any) => v.verdict).sort())
      .toEqual(["CONFORME", "CONFORME", "RESERVES"]);
    expect(p.motivation).toMatch(/groupe sain/);
    const vue = await svc.vueConsolidee(CO1, gar.garId);       // projection des membres — jamais une re-saisie
    expect(vue.membres).toHaveLength(3);
    expect(vue.membres.every((m: any) => typeof m.verdict === "string" && typeof m.score === "number")).toBe(true);
  });

  it("HR-10 [R471] — cascade = ÉVÉNEMENT avec origine, anti-boucle : un dossier né de cascade ne re-cascade pas", async () => {
    const cA = await mkClient("Casc-A"); const cB = await mkClient("Casc-B"); const cC = await mkClient("Casc-C");
    await mkKycValide(cA.id, { sofsow: { q1: "a" } });
    await mkKycValide(cB.id, { sofsow: { q1: "b" } });
    await mkKycValide(cC.id, { sofsow: { q1: "c" } });
    await mkGroupeUbo("Groupe Cascade", [cA.id, cB.id, cC.id]);
    const avant = (await evsType("REVIEW_CASCADE_TRIGGERED")).length;
    await svc.declencherRevueMembre(CO1, { clientId: cA.id, motif: "alerte AML" });
    const casc = await evsType("REVIEW_CASCADE_TRIGGERED");
    expect(casc.length).toBe(avant + 1);                       // UNE cascade — les dossiers nés d'elle ne re-cascadent pas
    const p: any = casc[casc.length - 1].payload;
    expect(p.parametre).toBe("cascadeMemberToGroup");
    expect(p.membres.length).toBeGreaterThanOrEqual(2);        // M2, M3 créés depuis M1
    const nés = (await evsType("review.membre.ouvert")).filter((e: any) => /cascade/i.test((e.payload as any).origine ?? ""));
    expect(nés.length).toBeGreaterThanOrEqual(2);
  });

  it("HR-11 [R471/R473] — cascades OFF : rien ne part ; le toggle exige le pop-up R445", async () => {
    await svc.modifierParametreReview(ADMIN, { cle: "review.groupe.cascadeMemberToGroup", valeur: false,
      enVigueurLe: "2026-08-09", confirmation: { engagementTexte: "Je coupe la cascade membre→groupe." } });
    const cX = await mkClient("Solo-X"); await mkKycValide(cX.id, { sofsow: { q1: "x" } });
    const cY = await mkClient("Solo-Y"); await mkKycValide(cY.id, { sofsow: { q1: "y" } });
    await mkGroupeUbo("Groupe Solo", [cX.id, cY.id]);
    const avant = (await evsType("REVIEW_CASCADE_TRIGGERED")).length;
    await svc.declencherRevueMembre(CO1, { clientId: cX.id, motif: "revue ad hoc" });
    expect((await evsType("REVIEW_CASCADE_TRIGGERED")).length).toBe(avant);  // AUCUNE cascade
    await expect(svc.modifierParametreReview(ADMIN, { cle: "review.groupe.cascadeMemberToGroup", valeur: true,
      enVigueurLe: "2026-08-10" }))
      .rejects.toMatchObject({ response: { code: "R445_CONFIRMATION_REQUISE" } });   // sans confirmation, aucune écriture
  });

  it("HR-12 [R13] — exclusion 4-yeux : le préparateur ne vise ni ses sections ni la décision de groupe", async () => {
    const c = await mkClient("FourEyes SA");
    const k = await mkKycValide(c.id, { sofsow: { q1: "fonds propres" } });
    const d = await mkDeadline(c.id, k.id);
    const ar = await svc.ouvrirRevue(CO1, d.id, { type: "ACCOUNT_REVIEW" });
    await svc.modifierReponse(RM1, ar.kycCode, { section: "sofsow", question: "q1", valeur: "fonds propres + vente" });
    await expect(svc.viserDelta(RM1, ar.kycCode)).rejects.toThrow(/R13|4-yeux|prépar/i);
    await expect(svc.viserEnBloc(RM1, ar.kycCode)).rejects.toThrow(/R13|4-yeux|prépar/i);
    const { gar } = (svc as any)._hr01;
    const ouverte: any = (await evsType("gar.ouverte")).find((e: any) => (e.payload as any).garId === gar.garId)!.payload;
    const preparateur = { tenantId: T, userId: ouverte.par, role: "CO" };
    await expect(svc.viserDecisionGroupe(preparateur as any, gar.garId, { motivation: "auto-visa" }))
      .rejects.toThrow(/R13|4-yeux|prépar/i);
  });

  it("HR-13 [R472] — un gabarit, trois types : même forme de dossier ; la GAR ajoute la vue consolidée par PARAMÈTRE", async () => {
    const { k1, ar, gar } = (svc as any)._hr01;
    const dKyc = await svc.dossier(CO1, k1.code);
    const dAr = await svc.dossier(CO1, ar.kycCode);
    const dGar = await svc.dossier(CO1, gar.garId);
    const socle = ["type", "sections", "timeline"];
    for (const cle of socle) {
      expect(dKyc).toHaveProperty(cle);
      expect(dAr).toHaveProperty(cle);
      expect(dGar).toHaveProperty(cle);
    }
    expect(dGar.vueConsolidee).toBeTruthy();                   // panneau ADDITIONNEL par paramètre d'affichage
    expect(dKyc.vueConsolidee).toBeUndefined();
    expect(dAr.vueConsolidee).toBeUndefined();
    expect(dGar.affichage).toBeTruthy();                       // la config d'affichage vient du registre, pas d'un fork
  });

  it("HR-14 [R48/R29] — rejeu à date d'une GAR : composition et critère D'ÉPOQUE, jamais recalculés", async () => {
    const { gar } = (svc as any)._hr01;
    const apresInitiation = new Date();
    // le groupe s'élargit APRÈS l'initiation (nouveau membre corporate sous le critère élargi)
    const cNew = await mkClient("Corp-New");
    await mkKycValide(cNew.id, { sofsow: { q1: "n" } });
    const rejeu = await svc.rejouerGar(ADMIN, gar.garId, apresInitiation);
    expect(rejeu.composition).toHaveLength(3);                 // la composition restituée est celle de l'initiation
    expect(rejeu.critere).toBe("UBO_COMMUN");
    expect(rejeu.asOf).toBeTruthy();
  });
});
