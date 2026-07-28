/**
 * FAT — CANON DES ÉCARTS ANCIENS (R280–R283, ratifié le 2026-07-28 — spec/canon-ecarts-anciens.md).
 * Partie 1 : R280 — UNE machine à états canonique pour les risk cases : le produit (R133–R136)
 * fait foi, le moteur R83 est un modèle de RÉFÉRENCE qui s'y mappe via la table RATIFIÉE
 * (5 états 1:1 ; deux deltas de transitions consignés). Familles : UC (unification cases).
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";
import { TRANSITIONS } from "../../src/modules/riskcases/risk-case.service";

describe("FAT CANON ANCIENS — Partie 1 : R280 réconciliation R83↔R133-R136 (UC-01..03)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID();
  const CO = randomUUID();
  let clientId = "";

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, T, (clientId = randomUUID()));
  });
  afterAll(async () => { await app.close(); });

  it("UC-02 [R280] le mapping est TOTAL : produit = modèle de référence R83 ⊕ les 2 deltas ratifiés — un orphelin fait échouer ce test", async () => {
    // Modèle de RÉFÉRENCE R83 (olive_cpsi/engine.py l.656 — copié comme référence RATIFIÉE,
    // le moteur reste intouchable) : transitions état → cibles.
    const REFERENCE_R83: Record<string, string[]> = {
      NOUVELLE: ["EN_ANALYSE"],
      EN_ANALYSE: ["CLARIFICATION", "CLOTUREE", "ESCALADEE"],
      CLARIFICATION: ["EN_ANALYSE", "CLOTUREE"],
      CLOTUREE: [], ESCALADEE: [],
    };
    // Les DEUX deltas RATIFIÉS (2026-07-28) — toute autre divergence est un écart bloquant :
    const DELTAS = {
      retiréesDuProduit: [["CLARIFICATION", "CLOTUREE"]],   // resserrement : clôture après reprise d'analyse tracée
      ajoutéesAuProduit: [["ESCALADEE", "CLOTUREE"]],       // extension : clôture administrative post-MROS (R136)
    };
    // 1. Totalité des ÉTATS — 1:1, aucun orphelin d'aucun côté
    expect(Object.keys(TRANSITIONS).sort()).toEqual(Object.keys(REFERENCE_R83).sort());
    // 2. Transitions : produit == référence ⊕ deltas, exactement
    const attendu: Record<string, string[]> = JSON.parse(JSON.stringify(REFERENCE_R83));
    for (const [de, vers] of DELTAS.retiréesDuProduit) attendu[de] = attendu[de].filter((v) => v !== vers);
    for (const [de, vers] of DELTAS.ajoutéesAuProduit) attendu[de] = [...attendu[de], vers];
    for (const etat of Object.keys(attendu))
      expect([...TRANSITIONS[etat]].sort()).toEqual([...attendu[etat]].sort());
    console.log("UC-02 PASS — mapping total : 5 états 1:1, produit = référence ⊕ 2 deltas ratifiés, rien d'autre");
  });

  it("UC-01 [R280/R252] la proposition entre par la PORTE D'ENTRÉE : case_proposal consommé → NOUVELLE, tracé, référencé, idempotent", async () => {
    // Une case_proposal ÉMISE (journal CPSI, forme exacte de PC-09)
    const cle = `${clientId}|SC_SCORE+SC_STRUCT`;
    await prisma.cpsiEvent.create({ data: { tenantId: T, type: "cpsi.case_proposal.emitted",
      clientId, at: new Date().toISOString(), payload: { client: clientId, scenarios: ["SC_SCORE", "SC_STRUCT"], cle, par: CO } } });

    const r = await request(http).post("/v1/riskcases/consommer-proposition").set(bearer(T, CO, "CO")).send({ cle });
    expect(r.status).toBe(201);
    expect(r.body.statut).toBe("NOUVELLE");                               // l'état d'ENTRÉE canonique, jamais un intermédiaire
    const c = await prisma.riskCase.findFirst({ where: { id: r.body.caseId } });
    expect(c!.statut).toBe("NOUVELLE");
    const ev = await prisma.domainEvent.findMany({ where: { tenantId: T, type: "riskcase.ouvert", aggregateId: r.body.caseId } });
    expect(ev.length).toBe(1);
    expect((ev[0].payload as any).depuisProposition).toBe(cle);           // la référence au case_proposal est PORTÉE
    // Idempotence re-vérifiée CÔTÉ CONSOMMATEUR (PC-10) : re-consommer ne crée RIEN
    const avant = await prisma.riskCase.count({ where: { tenantId: T } });
    const re = await request(http).post("/v1/riskcases/consommer-proposition").set(bearer(T, CO, "CO")).send({ cle });
    expect(re.status).toBe(201);
    expect(re.body.dejaConsommee).toBe(true);
    expect(re.body.caseId).toBe(r.body.caseId);
    expect(await prisma.riskCase.count({ where: { tenantId: T } })).toBe(avant);
    // Une clé inconnue ne s'invente pas
    await request(http).post("/v1/riskcases/consommer-proposition").set(bearer(T, CO, "CO"))
      .send({ cle: "fantome|SC_X" }).expect(404);
    console.log("UC-01 PASS — NOUVELLE, référencé, idempotent consommateur, clé inconnue refusée");
  });

  it("UC-03 [R280] UN SEUL jeu de transitions : le delta ratifié s'applique — CLARIFICATION→CLOTUREE refusée, ESCALADEE→CLOTUREE servie", async () => {
    const cas = (await prisma.riskCase.findMany({ where: { tenantId: T, statut: "NOUVELLE" } }))[0];
    const aller = (vers: string, motif?: string) =>
      request(http).post(`/v1/riskcases/${cas.id}/transition`).set(bearer(T, CO, "CO")).send({ vers, motif });
    await aller("EN_ANALYSE").expect(201);
    await aller("CLARIFICATION").expect(201);
    // Resserrement RATIFIÉ : la clôture directe depuis CLARIFICATION (référence R83) n'existe PAS au produit
    const refus = await aller("CLOTUREE", "tentative de clôture directe");
    expect(refus.status).toBe(400);
    expect(JSON.stringify(refus.body)).toContain("Transition illégale");
    await aller("EN_ANALYSE").expect(201);                                // la reprise d'analyse est LA voie
    await aller("ESCALADEE", "corrélation confirmée — voie MROS").expect(201);
    // Extension RATIFIÉE : clôture administrative post-escalade (aucune MROS active ici)
    const cloture = await aller("CLOTUREE", "classement administratif post-communication");
    expect(cloture.status).toBe(201);
    expect((await prisma.riskCase.findFirst({ where: { id: cas.id } }))!.statut).toBe("CLOTUREE");
    console.log("UC-03 PASS — un seul jeu de transitions : deltas ratifiés appliqués, rien d'autre ne passe");
  });
});

// ── Partie 2 : R281 — timeline & SLA hit→MROS via la porte (contrat 1.1, PC-16..19) ──

import { execFile } from "child_process";
import * as path from "path";

describe("FAT CANON ANCIENS — Partie 2 : R281 contrat 1.1 + chaîne hit→MROS (PC-16..19)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID();
  const CO = randomUUID();
  const clientId = randomUUID();
  const cle = `${clientId}|SC_A+SC_B`;

  const bridge = (env: any): Promise<any> => new Promise((resolve, reject) => {
    const child = execFile("python3", ["bridge.py"], {
      cwd: path.resolve(__dirname, "..", "..", "..", "..", "services", "cpsi-server-py") },
      (err, stdout) => err ? reject(err) : resolve(JSON.parse(stdout)));
    child.stdin!.end(JSON.stringify(env));
  });

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, T, clientId);
    await request(http).post("/v1/cpsi/clients").set(bearer(T, CO, "CO"))
      .send({ clientId, statique: { pep: false }, attributs: {} }).expect(201);
    await request(http).post(`/v1/cpsi/clients/${clientId}/signals`).set(bearer(T, CO, "CO"))
      .send({ type: "velocite_tx", severite: 2 }).expect(201);
  });
  afterAll(async () => { await app.close(); });

  it("PC-17 [R281] le contrat 1.1 COEXISTE avec 1.0 : commande 1.1 en enveloppe 1.0 → erreur typée « version », la 1.0 reste servie", async () => {
    const socle = { as_of: new Date().toISOString(), config: {}, journal: [], payload: {} };
    const v10ancienne = await bridge({ ...socle, contract_version: "1", commande: "rules" });
    expect(v10ancienne.resultat).toBeDefined();                            // la 1.0 sert toujours ses commandes
    const v10nouvelle = await bridge({ ...socle, contract_version: "1", commande: "timeline_client" });
    expect(v10nouvelle.erreur_typee.code).toBe("CPSI_CONTRACT_VERSION");   // typée « version », pas un default-deny opaque
    expect(v10nouvelle.erreur_typee.message).toContain("1.1");
    const v11 = await bridge({ ...socle, contract_version: "1.1", commande: "rules" });
    expect(v11.resultat).toBeDefined();                                    // PC-01..03 re-passent en 1.1 (même sortie)
    const inconnue = await bridge({ ...socle, contract_version: "2" , commande: "rules" });
    expect(inconnue.erreur_typee.type).toBe("UNSUPPORTED_CONTRACT");
    console.log("PC-17 PASS — 1.0 servie, commande 1.1 refusée typée en 1.0, enveloppe 1.1 servie");
  });

  it("PC-16 [R281] la timeline traverse la porte sous son NOM CANON (alias 1.1) : as_of strict, ordre seq, meta R250", async () => {
    const r = await request(http).get(`/v1/cpsi/clients/${clientId}/timeline`).set(bearer(T, CO, "CO"));
    expect(r.status).toBe(200);
    expect(r.body.contractVersion).toBe("1.1");                            // l'alias timeline_client est EXERCÉ
    expect(r.body.meta.evenements_rejoues).toBeGreaterThan(0);             // meta de rejeu (R250)
    expect(r.body.evenements.some((e: any) => e.type === "cpsi.signal.ingested")).toBe(true);
    const passe = await request(http).get(`/v1/cpsi/clients/${clientId}/timeline?asOf=2020-01-01T00:00:00Z`).set(bearer(T, CO, "CO"));
    expect(passe.body.evenements.length).toBe(0);                          // as_of STRICT : rien de postérieur
    console.log("PC-16 PASS — nom canon servi via 1.1, as_of strict, meta présente");
  });

  it("PC-18 [R281] la chaîne t0→t1→t2 SE REMONTE par rejeu : trois jalons datés, maillons append-only", async () => {
    await prisma.cpsiEvent.create({ data: { tenantId: T, type: "cpsi.case_proposal.emitted",
      clientId, at: new Date().toISOString(), payload: { client: clientId, scenarios: ["SC_A", "SC_B"], cle, par: CO } } });
    const cons = await request(http).post("/v1/riskcases/consommer-proposition").set(bearer(T, CO, "CO")).send({ cle });
    expect(cons.status).toBe(201);
    const caseId = cons.body.caseId;
    const aller = (vers: string, motif?: string) =>
      request(http).post(`/v1/riskcases/${caseId}/transition`).set(bearer(T, CO, "CO")).send({ vers, motif });
    await aller("EN_ANALYSE").expect(201);
    await aller("ESCALADEE", "corrélation multi-scénarios — voie MROS").expect(201);
    await prisma.mrosCommunication.create({ data: { tenantId: T, riskCaseId: caseId, clientId,
      decision: "COMMUNIQUER", motif: "soupçon fondé", decidePar: CO, decideAt: new Date(),
      pieces: [], dossierSha256: "a".repeat(64), notification: "notifiée" } });

    const rep = await request(http).get("/v1/cpsi/reporting/sla").set(bearer(T, CO, "CO"));
    expect(rep.status).toBe(200);
    const maillon = rep.body.chaine.find((c: any) => c.cle === cle);
    expect(maillon.t0).toBeTruthy();                                       // signal (journal CPSI, rejoué)
    expect(maillon.t1).toBeTruthy();                                       // ESCALADEE (journal riskcases)
    expect(maillon.t2).toBeTruthy();                                       // communication MROS référencée
    expect(maillon.maillonManquant).toBeNull();
    expect(typeof maillon.joursHitEscalade).toBe("number");
    console.log("PC-18 PASS — t0/t1/t2 datés remontés par rejeu, chaîne de références complète");
  });

  it("PC-19 [R281/R39] le dépassement NOTIFIE (jamais bloquant), l'ABSENCE se voit : « en attente MROS : N jours »", async () => {
    // Un second maillon : escaladé, SANS MROS — seuils à 0 pour matérialiser le dépassement
    const cle2 = `${clientId}|SC_A+SC_C`;
    await prisma.cpsiEvent.create({ data: { tenantId: T, type: "cpsi.case_proposal.emitted",
      clientId, at: new Date().toISOString(), payload: { client: clientId, scenarios: ["SC_A", "SC_C"], cle: cle2, par: CO } } });
    const cons = await request(http).post("/v1/riskcases/consommer-proposition").set(bearer(T, CO, "CO")).send({ cle: cle2 });
    await request(http).post(`/v1/riskcases/${cons.body.caseId}/transition`).set(bearer(T, CO, "CO")).send({ vers: "EN_ANALYSE" }).expect(201);
    await request(http).post(`/v1/riskcases/${cons.body.caseId}/transition`).set(bearer(T, CO, "CO")).send({ vers: "ESCALADEE", motif: "x" }).expect(201);
    const t = await prisma.tenant.findFirst({ where: { id: T } });
    await prisma.tenant.update({ where: { id: T }, data: { settings: { ...((t!.settings as any) ?? {}),
      slaHitEscaladeJours: -1, slaEscaladeMrosJours: -1 } } });   // même jour = 0 j : seuil -1 matérialise le dépassement

    const rep = await request(http).get("/v1/cpsi/reporting/sla").set(bearer(T, CO, "CO"));
    const attente = rep.body.chaine.find((c: any) => c.cle === cle2);
    expect(attente.maillonManquant).toBe("sans MROS");                     // l'absence est une DONNÉE
    expect(attente.enAttenteMrosJours).toBeGreaterThanOrEqual(0);          // « en attente MROS : N jours »
    // Le tick NOTIFIE — idempotent, rien n'est bloqué
    const tick = await request(http).post("/v1/cpsi/reporting/sla/tick").set(bearer(T, CO, "CO"));
    expect(tick.status).toBe(201);
    expect(tick.body.notifies.length).toBeGreaterThanOrEqual(1);
    const evts = await prisma.domainEvent.count({ where: { tenantId: T, type: "cpsi.sla.depassement" } });
    expect(evts).toBe(tick.body.notifies.length);
    const re = await request(http).post("/v1/cpsi/reporting/sla/tick").set(bearer(T, CO, "CO"));
    expect(re.body.notifies.length).toBe(0);                               // idempotence : une notification par fait
    // RIEN n'est bloqué : la clôture post-escalade reste servie
    await request(http).post(`/v1/riskcases/${cons.body.caseId}/transition`).set(bearer(T, CO, "CO"))
      .send({ vers: "CLOTUREE", motif: "classement" }).expect(201);
    console.log("PC-19 PASS — dépassements notifiés (idempotent), absence visible, zéro coercition");
  });
});

// ── Partie 3 : R282 — l'ACCÈS suit la matrice COURANTE, la COMPLÉTUDE celle du dossier (VD-01..04) ──

describe("FAT CANON ANCIENS — Partie 3 : R282 matrice de droits versionnée (VD-01..04, lève SD-04)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID();
  const RM = randomUUID(), COSR = randomUUID(), ADMIN = randomUUID(), COC = randomUUID(); // COC : contributeur CO ≠ validateur (R52)

  const creerKyc = async (clientId: string) =>
    (await request(http).post("/v1/kyc").set(bearer(T, RM, "RM"))
      .send({ clientId, legalStructure: "HOLDING", accountType: "ADVISORY", countryCode: "CH", rmId: RM })).body;  // 20+5 = 25 → CDD (section AML présente)
  // Répond TOUT sauf `sauf`, signe les visas — la validation reste à l'appelant.
  const preparer = async (kyc: any, sauf: string[] = []) => {
    for (const s of kyc.sections)
      for (const q of s.questions) {
        if (sauf.includes(q.code)) continue;
        const role = ["IDE-Q3", "UBO-Q2", "SOF-Q2", "AML-Q1"].includes(q.code) ? "CO" : "RM";
        await request(http).patch(`/v1/kyc/${kyc.code}/questions/${q.code}`).set(bearer(T, role === "CO" ? COC : RM, role))
          .send({ answer: "renseigné" });
      }
    for (const v of kyc.visas)
      await request(http).post(`/v1/kyc/${kyc.code}/visas/${v.sectionCode}`).set(bearer(T, randomUUID(), v.requiredRole)).send({});
  };

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, T, randomUUID());
  });
  afterAll(async () => { await app.close(); });

  it("VD-01 [R282] la SÉCURITÉ est immédiate : AML×RM → HIDDEN à portée MATRICE — le RM perd la section sur TOUS les dossiers, y compris anciens (SD-03 re-vérifié)", async () => {
    const c1 = randomUUID(), c2 = randomUUID();
    await seedTenantClient(prisma, T, c1); await seedTenantClient(prisma, T, c2);
    const ancien = await creerKyc(c1);                                     // créé AVANT le changement
    const recent = await creerKyc(c2);
    const avant = (await request(http).get(`/v1/kyc/${ancien.code}`).set(bearer(T, RM, "RM"))).body;
    expect(avant.sections.find((s: any) => s.code === "AML").questions.length).toBeGreaterThan(0);
    // Changement à portée MATRICE (R282) — un seul acte, TOUS les dossiers
    const chg = await request(http).patch(`/v1/kyc/${recent.code}/questions/AML-Q1/access`).set(bearer(T, ADMIN, "ADMIN"))
      .send({ role: "RM", right: "HIDDEN", portee: "matrice" });
    expect(chg.status).toBe(200);
    for (const k of [ancien, recent]) {                                    // la sécurité ne se grandfathère PAS
      const vue = (await request(http).get(`/v1/kyc/${k.code}`).set(bearer(T, RM, "RM"))).body;
      expect(vue.sections.find((s: any) => s.code === "AML").questions.length).toBe(0);  // plus RIEN de servi (SD-03)
    }
    const coVue = (await request(http).get(`/v1/kyc/${ancien.code}`).set(bearer(T, COSR, "CO_SR"))).body;
    expect(coVue.sections.find((s: any) => s.code === "AML").questions.length).toBeGreaterThan(0); // CO intact
    console.log("VD-01 PASS — HIDDEN immédiat à portée matrice, dossiers anciens compris, projection serveur");
  });

  it("VD-02 [R282/R29] la COMPLÉTUDE est grandfathérée : REQUIRED ajouté à effet J — J-10 se valide sans, J+1 l'exige (refus LISTÉ)", async () => {
    const c1 = randomUUID(), c2 = randomUUID();
    await seedTenantClient(prisma, T, c1); await seedTenantClient(prisma, T, c2);
    const avant = await creerKyc(c1);                                      // dossier créé AVANT l'effet
    await new Promise((r) => setTimeout(r, 25));
    await request(http).patch(`/v1/kyc/${avant.code}/questions/IDE-Q2/access`).set(bearer(T, ADMIN, "ADMIN"))
      .send({ role: "RM", right: "REQUIRED", portee: "matrice" }).expect(200);
    await new Promise((r) => setTimeout(r, 25));
    const apres = await creerKyc(c2);                                      // dossier créé APRÈS l'effet
    // Les deux dossiers laissent IDE-Q2 SANS réponse
    await preparer(avant, ["IDE-Q2"]);
    await preparer(apres, ["IDE-Q2"]);
    // J-10 : la matrice de SA création ne portait pas ce REQUIRED → se valide (R29)
    await request(http).post(`/v1/kyc/${avant.code}/validate`).set(bearer(T, COSR, "CO_SR")).expect(201);
    // J+1 : l'exige — le refus LISTE la contribution manquante
    const refus = await request(http).post(`/v1/kyc/${apres.code}/validate`).set(bearer(T, COSR, "CO_SR"));
    expect(refus.status).toBe(400);
    expect(JSON.stringify(refus.body)).toContain("IDE-Q2");
    console.log("VD-02 PASS — grandfathering R29 : l'ancien se valide, le nouveau exige (listé)");
  });

  it("VD-03 [R282/R48] l'HISTORIQUE se rejoue par dates d'effet ; une version close est IMMUABLE (trigger SQL)", async () => {
    const c = randomUUID();
    await seedTenantClient(prisma, T, c);
    const kyc = await creerKyc(c);
    const t0 = new Date().toISOString();
    await new Promise((r) => setTimeout(r, 25));
    await request(http).patch(`/v1/kyc/${kyc.code}/questions/SOF-Q1/access`).set(bearer(T, ADMIN, "ADMIN"))
      .send({ role: "RM", right: "VIEW" }).expect(200);                    // portée dossier (défaut SD-02 inchangé)
    // « Quelle était la matrice du t0 ? » — résolution par dates, restitution EXACTE
    const historique = (await request(http).get(`/v1/kyc/${kyc.code}/access-matrix?asOf=${encodeURIComponent(t0)}`).set(bearer(T, ADMIN, "ADMIN"))).body;
    const courante = (await request(http).get(`/v1/kyc/${kyc.code}/access-matrix`).set(bearer(T, ADMIN, "ADMIN"))).body;
    const cell = (m: any) => JSON.stringify(m);
    expect(cell(historique)).toContain("EDIT");                            // l'époque : RM éditait SOF-Q1
    expect(cell(historique)).not.toBe(cell(courante));                     // la courante a bougé
    // La version CLOSE ne se réécrit pas — trigger SQL
    const close = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM kyc_access_rules WHERE effective_to IS NOT NULL LIMIT 1`);
    await expect(prisma.$executeRawUnsafe(
      `UPDATE kyc_access_rules SET "right" = 'EDIT' WHERE id = '${close[0].id}'`)).rejects.toThrow();
    console.log("VD-03 PASS — matrice d'époque restituée, versions closes immuables");
  });

  it("VD-04 [R282] le changement est un ÉVÉNEMENT visé : auteur, avant/après, date d'effet — servi au change tracker (SD-01 étendu)", async () => {
    const evts = await prisma.domainEvent.findMany({ where: { tenantId: T, type: "kyc.access.modifie" } });
    expect(evts.length).toBeGreaterThanOrEqual(3);
    const e: any = evts[evts.length - 1].payload;
    expect(e.par).toBeTruthy();                                            // auteur (jeton)
    expect(e.ancienne).toBeTruthy();
    expect(e.nouvelle).toBeTruthy();                                       // avant/après
    expect(e.dateEffet).toBeTruthy();                                      // date d'effet (R282)
    expect(e.portee).toBeTruthy();                                         // dossier | matrice
    console.log("VD-04 PASS — événement complet (auteur, avant/après, date d'effet, portée)");
  });
});
