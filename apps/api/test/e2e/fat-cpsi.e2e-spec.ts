/**
 * FAT — Porte HTTP mince CPSI (spec `spec/cpsi-scenarios/CPSI-PORTE.feature`).
 * Squelette vertical exécuté contre le VRAI backend + le VRAI moteur Python (shell-out) :
 * chemin SCORE (CP-01), rejeu à date (CP-02), ingestion default-deny (CP-11), isolation tenant (CP-18).
 * La porte ne calcule rien elle-même : tout score/driver provient du moteur ratifié (CP-19).
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

describe("FAT CPSI — porte mince (backend + moteur Python réels)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const A = randomUUID(), B = randomUUID();
  const U = randomUUID();
  const cid = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, A, randomUUID());
    await seedTenantClient(prisma, B, randomUUID());
    // Enregistre un client CPSI + un signal, à des dates distinctes (pour le rejeu).
    await request(http).post("/v1/cpsi/clients").set(bearer(A, U, "CO"))
      .send({ clientId: cid, statique: { pep: true, pays_risque: 1 }, at: "2026-01-01T00:00:00.000Z" }).expect(201);
    await request(http).post(`/v1/cpsi/clients/${cid}/signals`).set(bearer(A, U, "CO"))
      .send({ type: "hit_screening", severite: 1, at: "2026-02-01T00:00:00.000Z" }).expect(201);
  });
  afterAll(async () => { await app.close(); });

  it("CP-01 [R63/R67] score perpétuel + drivers dont la somme reconstitue le score", async () => {
    const g = await request(http).get(`/v1/cpsi/clients/${cid}/score`).set(bearer(A, U, "CO"));
    expect(g.status).toBe(200);
    expect(g.body.contractVersion).toBe("1");                             // PC-01/R248 : enveloppe versionnée
    expect(g.body.score).toBeGreaterThan(0);
    expect(["LOW", "MEDIUM", "HIGH"]).toContain(g.body.bande);
    const somme = g.body.drivers.reduce((s: number, d: any) => s + d.contribution, 0);
    expect(Math.abs(somme - g.body.score)).toBeLessThan(0.05);            // R67 : explicabilité
    expect(g.body.drivers.some((d: any) => d.source.startsWith("statique:pep"))).toBe(true);
    console.log("CP-01 PASS — score", g.body.score, "bande", g.body.bande, "drivers", g.body.drivers.length);
  });

  it("CP-02 [R48/R64] rejeu à date : le signal futur n'existe pas, score statique seul", async () => {
    const avant = await request(http).get(`/v1/cpsi/clients/${cid}/score?asOf=2026-01-15T00:00:00.000Z`).set(bearer(A, U, "CO"));
    const apres = await request(http).get(`/v1/cpsi/clients/${cid}/score?asOf=2026-03-01T00:00:00.000Z`).set(bearer(A, U, "CO"));
    expect(avant.body.drivers.some((d: any) => d.source.includes("hit_screening"))).toBe(false);  // signal ≤ asOf uniquement
    expect(apres.body.drivers.some((d: any) => d.source.includes("hit_screening"))).toBe(true);
    expect(apres.body.score).toBeGreaterThan(avant.body.score);           // le signal ajoute du risque
    console.log("CP-02 PASS — avant", avant.body.score, "après", apres.body.score);
  });

  it("CP-11 [R63] ingestion default-deny : type inconnu refusé, rien persisté", async () => {
    const nAvant = await prisma.cpsiEvent.count({ where: { tenantId: A, clientId: cid } });
    const ko = await request(http).post(`/v1/cpsi/clients/${cid}/signals`).set(bearer(A, U, "CO"))
      .send({ type: "TYPE_INEXISTANT", severite: 1, at: "2026-02-15T00:00:00.000Z" });
    expect(ko.status).toBe(422);                                          // PC-02/R248 : default-deny typé → 422
    expect(JSON.stringify(ko.body)).toContain("default-deny");
    const nApres = await prisma.cpsiEvent.count({ where: { tenantId: A, clientId: cid } });
    expect(nApres).toBe(nAvant);                                          // aucune écriture (validation par rejeu)
    console.log("CP-11 PASS — type inconnu refusé (400), journal inchangé");
  });

  it("CP-18 isolation tenant : le tenant B ne voit pas le client CPSI de A", async () => {
    const g = await request(http).get(`/v1/cpsi/clients/${cid}/score`).set(bearer(B, randomUUID(), "CO"));
    expect(g.status).toBe(404);                                           // client inconnu dans le périmètre de B
    console.log("CP-18 PASS — client de A invisible pour B");
  });

  it("PC-07 [R250] jauge de rejeu : meta dans la réponse + endpoint santé", async () => {
    const s = await request(http).get(`/v1/cpsi/clients/${cid}/score`).set(bearer(A, U, "CO"));
    expect(s.body.meta).toBeDefined();
    expect(typeof s.body.meta.evenements_rejoues).toBe("number");
    expect(typeof s.body.meta.duree_ms).toBe("number");                  // durée d'hydratation mesurée
    const h = await request(http).get(`/v1/cpsi/health`).set(bearer(A, U, "CO"));
    expect(h.status).toBe(200);
    expect(h.body.contractVersion).toBe("1");
    expect(h.body.profondeurJournal).toBeGreaterThanOrEqual(2);          // registration + signal
    expect(h.body).toHaveProperty("configEnVigueur");                    // R68 : version de config en vigueur
    console.log("PC-07 PASS — meta", JSON.stringify(s.body.meta), "santé profondeur", h.body.profondeurJournal);
  });

  it("CP-03 [R65] segmentation déterministe : le client porte un segment stable", async () => {
    const g = await request(http).get(`/v1/cpsi/segmentation`).set(bearer(A, U, "CO"));
    expect(g.status).toBe(200);
    const mien = g.body.segments.find((s: any) => s.client === cid);
    expect(mien).toBeDefined();
    expect(mien.segment).toMatch(/^[BMH]-(CALME|ACTIF|INTENSE)$/);        // grille statique × comportement
    const g2 = await request(http).get(`/v1/cpsi/segmentation`).set(bearer(A, U, "CO"));
    expect(g2.body.segments.find((s: any) => s.client === cid).segment).toBe(mien.segment);  // stable (déterminisme)
    console.log("CP-03 PASS — segment", mien.segment);
  });

  it("CP-07 [R79] catalogue de conformité en lecture seule (bien formé, vide sans scénario)", async () => {
    const g = await request(http).get(`/v1/cpsi/compliance-catalogue`).set(bearer(A, U, "CO"));
    expect(g.status).toBe(200);
    expect(Array.isArray(g.body.catalogue)).toBe(true);                   // ATTR_DEFS/paramètres exposés, aucune écriture
    console.log("CP-07 PASS — catalogue lecture seule, entrées:", g.body.catalogue.length);
  });

  it("CP-08 [R68] règles de calcul en clair (half-life + explicabilité R67)", async () => {
    const g = await request(http).get(`/v1/cpsi/rules`).set(bearer(A, U, "CO"));
    expect(g.status).toBe(200);
    const txt = (g.body.regles as string[]).join("\n");
    expect(txt).toContain("Half-life");
    expect(txt).toMatch(/drivers.*reconstitue le score/);                 // R67 énoncé en clair
    console.log("CP-08 PASS — règles en clair,", g.body.regles.length, "lignes");
  });

  it("CP-04/05 [R71/R72] groupe de population : appartenance, primaire, registre en clair", async () => {
    await request(http).post(`/v1/cpsi/groups`).set(bearer(A, U, "CO"))
      .send({ gid: "PEP", label: "Clients PEP", predicat: { logique: "OU", conditions: [{ champ: "pep", op: "eq", val: true }] } }).expect(201);
    const mine = await request(http).get(`/v1/cpsi/clients/${cid}/groups`).set(bearer(A, U, "CO"));
    expect(mine.body.primary).toBe("PEP");                                // client PEP → groupe primaire PEP
    expect(mine.body.groups.some((g: any) => g.id === "PEP")).toBe(true);
    const reg = await request(http).get(`/v1/cpsi/groups`).set(bearer(A, U, "CO"));
    const pep = reg.body.groupes.find((g: any) => g.id === "PEP");
    expect(pep.effectif).toBeGreaterThanOrEqual(1);                       // R74 : effectif en clair
    console.log("CP-04/05 PASS — primaire PEP, effectif", pep.effectif);
  });

  it("CP-06 [R73] scénario ciblé : seuls les membres du groupe visé sont évalués", async () => {
    await request(http).post(`/v1/cpsi/scenarios`).set(bearer(A, U, "CO"))
      .send({ sid: "SC_SCORE", label: "Score élevé PEP", champ: "score", groupesSeuils: { PEP: 10 }, sens: "gte" }).expect(201);
    const ev = await request(http).get(`/v1/cpsi/scenarios/SC_SCORE/evaluate`).set(bearer(A, U, "CO"));
    expect(ev.body.hits.some((h: any) => h.client === cid && h.groupe === "PEP")).toBe(true);
    expect(ev.body.evalues).toBeGreaterThanOrEqual(1);
    console.log("CP-06 PASS — évalués", ev.body.evalues, "hits", ev.body.hits.length);
  });

  it("CP-06 [R73] default-deny : scénario visant un groupe inconnu est refusé", async () => {
    const ko = await request(http).post(`/v1/cpsi/scenarios`).set(bearer(A, U, "CO"))
      .send({ sid: "SC_KO", label: "x", champ: "score", groupesSeuils: { INCONNU: 10 } });
    expect(ko.status).toBe(400);
    expect(JSON.stringify(ko.body)).toContain("INCONNU");
    console.log("CP-06 default-deny PASS — groupe cible inconnu refusé");
  });

  it("CP-12 [R80/R81] signaux scorés & alertes : dédup par (client,scénario), statut vs seuil X", async () => {
    const g = await request(http).get(`/v1/cpsi/alerts`).set(bearer(A, U, "CO"));
    expect(g.status).toBe(200);
    const mien = g.body.signaux.find((s: any) => s.client === cid && s.scenario === "SC_SCORE");
    expect(mien).toBeDefined();
    expect(["ALERTE", "NEAR_MISS", "ANALYSE"]).toContain(mien.statut);    // vocabulaire R80
    expect(typeof mien.score).toBe("number");
    console.log("CP-12 PASS — signal", mien.statut, "score", mien.score);
  });

  it("CP-09 [R70] bac à sable : simulation dry-run, rapport d'impact, AUCUNE mutation", async () => {
    const nAvant = await prisma.cpsiEvent.count({ where: { tenantId: A } });
    const sim = await request(http).post(`/v1/cpsi/sandbox/simulate`).set(bearer(A, U, "CO"))
      .send({ changements: { half_life_jours: 90 } });
    expect(sim.status).toBe(201);
    expect(sim.body).toHaveProperty("delta_moyen");
    expect(sim.body).toHaveProperty("franchissements");
    const nApres = await prisma.cpsiEvent.count({ where: { tenantId: A } });
    expect(nApres).toBe(nAvant);                                          // dry-run : rien persisté
    const ko = await request(http).post(`/v1/cpsi/sandbox/simulate`).set(bearer(A, U, "CO")).send({ changements: { param_bidon: 1 } });
    expect(ko.status).toBe(400);                                          // default-deny paramètre inconnu
    console.log("CP-09 PASS — dry-run sans mutation, paramètre inconnu refusé");
  });

  let propId = "";
  it("CP-10 [R69] IA propose, humain adopte ; rejet exige une motivation", async () => {
    const prop = await request(http).post(`/v1/cpsi/params/proposals`).set(bearer(A, U, "CO"))
      .send({ chemin: "half_life_jours", valeur: 90, justification: "réduire la mémoire des signaux" });
    expect(prop.status).toBe(201);
    expect(prop.body.statut).toBe("EN_ATTENTE");
    propId = prop.body.id;
    const adop = await request(http).post(`/v1/cpsi/params/proposals/${propId}/adopt`).set(bearer(A, U, "CO"));
    expect(adop.body.statut).toBe("ADOPTEE");
    // Une seconde proposition, rejetée SANS motivation → refus (R69)
    const p2 = await request(http).post(`/v1/cpsi/params/proposals`).set(bearer(A, U, "CO")).send({ chemin: "half_life_jours", valeur: 120 });
    const koRej = await request(http).post(`/v1/cpsi/params/proposals/${p2.body.id}/reject`).set(bearer(A, U, "CO")).send({});
    expect(koRej.status).toBe(400);
    const okRej = await request(http).post(`/v1/cpsi/params/proposals/${p2.body.id}/reject`).set(bearer(A, U, "CO")).send({ motivation: "hors politique" });
    expect(okRej.body.statut).toBe("REJETEE");
    console.log("CP-10 PASS — adopté", propId, "; rejet sans motivation refusé");
  });

  it("CP-10b [R69] la liste des propositions restitue les états (rejeu) — lecture gouvernance", async () => {
    const g = await request(http).get(`/v1/cpsi/params/proposals`).set(bearer(A, U, "CO"));
    expect(g.status).toBe(200);
    const statuts = g.body.map((p: any) => p.statut);
    expect(statuts).toContain("ADOPTEE");
    expect(statuts).toContain("REJETEE");                                 // les décisions CP-10 sont restituées
    expect(g.body.every((p: any) => p.impact && typeof p.impact.clients_evalues === "number")).toBe(true);  // R69 : impact simulé embarqué
    console.log("CP-10b PASS — propositions listées :", statuts.join(", "));
  });

  it("CP-13 [R82] rétroaction faux-positif tracée", async () => {
    const fp = await request(http).post(`/v1/cpsi/false-positives`).set(bearer(A, U, "CO")).send({ client: cid, scenario: "SC_SCORE" });
    expect(fp.status).toBe(201);
    expect(fp.body.declare).toBe(true);
    console.log("CP-13 PASS — faux positif déclaré");
  });

  it("CP-14 [R75] insider MAR : habilitation par rôle du jeton, motif obligatoire", async () => {
    const ko = await request(http).post(`/v1/cpsi/clients/${cid}/insider`).set(bearer(A, U, "RM")).send({ motif: "test" });
    expect(ko.status).toBe(403);                                          // RM hors roles_insider → refus
    const koMotif = await request(http).post(`/v1/cpsi/clients/${cid}/insider`).set(bearer(A, U, "CO")).send({});
    expect(koMotif.status).toBe(400);                                     // motif obligatoire
    const ok = await request(http).post(`/v1/cpsi/clients/${cid}/insider`).set(bearer(A, U, "CO")).send({ motif: "figure sur liste MAR", instrument: "ACME" });
    expect(ok.status).toBe(201);
    expect(ok.body.inities).toContain(cid);
    console.log("CP-14 PASS — RM refusé (403), CO habilité, motif obligatoire");
  });

  // CP-15/16/17 SUPERSEDED par R252 (amendement R248-R252) : le CPSI ÉMET des case_proposal ;
  // l'instruction (ouverture/transitions/reporting) relève de riskcases R133-R136. Couverture → PC-09..12.
  it("PC-09 [R252] la corrélation R81 émet un case_proposal append-only, consommable par riskcases", async () => {
    // Un 2e scénario ciblant PEP ⇒ cid touché par ≥2 scénarios (corrélation R81).
    await request(http).post(`/v1/cpsi/scenarios`).set(bearer(A, U, "CO"))
      .send({ sid: "SC_SCORE2", label: "Score PEP seuil bas", champ: "score", groupesSeuils: { PEP: 5 }, sens: "gte" }).expect(201);
    const em = await request(http).post(`/v1/cpsi/case-proposals`).set(bearer(A, U, "CO"));
    expect(em.status).toBe(201);
    const mienne = em.body.emises.find((p: any) => p.client === cid);
    expect(mienne).toBeDefined();
    expect(mienne.scenarios.sort()).toEqual(["SC_SCORE", "SC_SCORE2"]);
    const evts = await prisma.cpsiEvent.count({ where: { tenantId: A, type: "cpsi.case_proposal.emitted" } });
    expect(evts).toBe(em.body.emises.length);                             // événement append-only journalisé
    const rcEvts = await prisma.cpsiEvent.count({ where: { tenantId: A, type: { startsWith: "cpsi.riskcase." } } });
    expect(rcEvts).toBe(0);                                               // aucun état de riskcase muté par le CPSI (R66)
    const liste = await request(http).get(`/v1/cpsi/case-proposals`).set(bearer(A, U, "CO"));
    expect(liste.body.some((p: any) => p.cle === mienne.cle)).toBe(true); // consommable par riskcases
    console.log("PC-09 PASS — proposition", mienne.cle, "émise et journalisée");
  });

  it("PC-10 [R252] idempotence : le même couple (client, corrélation) rejoué ⇒ UNE seule proposition", async () => {
    const avant = await prisma.cpsiEvent.count({ where: { tenantId: A, type: "cpsi.case_proposal.emitted" } });
    const re = await request(http).post(`/v1/cpsi/case-proposals`).set(bearer(A, U, "CO"));
    expect(re.body.emises.length).toBe(0);                                // rien de nouveau
    expect(re.body.dejaExistantes).toBeGreaterThanOrEqual(1);
    const apres = await prisma.cpsiEvent.count({ where: { tenantId: A, type: "cpsi.case_proposal.emitted" } });
    expect(apres).toBe(avant);                                            // pattern R76 : pas de doublon
    console.log("PC-10 PASS — ré-émission sans doublon");
  });

  it("PC-11 [R252] la porte n'expose AUCUNE surface produit risk-case (CP-15/16 superseded)", async () => {
    await request(http).post(`/v1/cpsi/risk-cases`).set(bearer(A, U, "CO")).send({ alertes: [{ client: cid, scenario: "SC_SCORE" }] }).expect(404);
    await request(http).post(`/v1/cpsi/risk-cases/RC-0001/transition`).set(bearer(A, U, "CO")).send({ action: "clore", motif: "x" }).expect(404);
    await request(http).post(`/v1/cpsi/risk-cases/RC-0001/notes`).set(bearer(A, U, "CO")).send({ note: "x" }).expect(404);
    console.log("PC-11 PASS — routes risk-case directes absentes (404)");
  });

  it("PC-12 [R252/R39] le reporting SLA reste chez riskcases — pas de route porte (CP-17 superseded)", async () => {
    await request(http).get(`/v1/cpsi/risk-cases/reporting?slaJours=30`).set(bearer(A, U, "CO")).expect(404);
    console.log("PC-12 PASS — reporting SLA hors porte CPSI (chez riskcases R133-R136)");
  });

  it("PC-08 [R251] port optionnel : moteur absent ⇒ 503 typé, les autres routes intactes", async () => {
    const sauve = process.env.CPSI_DIR;
    process.env.CPSI_DIR = "/nonexistent-cpsi-dir";                       // simule le moteur indisponible
    try {
      const cpsi = await request(http).get(`/v1/cpsi/clients/${cid}/score`).set(bearer(A, U, "CO"));
      expect(cpsi.status).toBe(503);                                     // refus gracieux typé
      expect(JSON.stringify(cpsi.body)).toContain("CPSI_GATE_UNAVAILABLE");
      const horsCpsi = await request(http).get(`/v1/tasks`).set(bearer(A, U, "CO"));
      expect(horsCpsi.status).toBe(200);                                 // route non-CPSI intacte
    } finally { if (sauve === undefined) delete process.env.CPSI_DIR; else process.env.CPSI_DIR = sauve; }
    console.log("PC-08 PASS — CPSI 503 typé, route non-CPSI 200");
  });
});

describe("FAT CPSI — extension P1 ratifiée : timeline + volumétrie (PC-13/14 — PC-11/12 pris, écart de numérotation signalé)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID();
  const U = randomUUID();
  const c1 = randomUUID(), c2 = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, T, randomUUID());
    for (const [cid, sev] of [[c1, 3], [c2, 1]] as [string, number][]) {
      await request(http).post("/v1/cpsi/clients").set(bearer(T, U, "CO"))
        .send({ clientId: cid, statique: { pep: true }, at: "2026-01-01T00:00:00.000Z" }).expect(201);
      await request(http).post(`/v1/cpsi/clients/${cid}/signals`).set(bearer(T, U, "CO"))
        .send({ type: "hit_screening", severite: sev, at: "2026-02-01T00:00:00.000Z" }).expect(201);
    }
    await request(http).post(`/v1/cpsi/clients/${c1}/signals`).set(bearer(T, U, "CO"))
      .send({ type: "velocite_tx", severite: 2, at: "2026-03-01T00:00:00.000Z" }).expect(201);
  });
  afterAll(async () => { await app.close(); });

  it("PC-14 [AW-04/R48] la timeline d'un client est un REJEU : ses événements seuls, as_of strict, rejouable identique", async () => {
    const g = await request(http).get(`/v1/cpsi/clients/${c1}/timeline`).set(bearer(T, U, "CO"));
    expect(g.status).toBe(200);
    expect(g.body.contractVersion).toBe("1");                               // enveloppe R248
    const types = g.body.evenements.map((e: any) => e.type);
    expect(types).toContain("cpsi.client.registered");
    expect(types).toContain("cpsi.signal.ingested");
    expect(g.body.evenements.every((e: any) => e.client === c1)).toBe(true); // JAMAIS un événement d'un autre client
    // as_of = J-avant le 2e signal → il n'y figure PAS (rejeu strict ≤ as_of, AW-04)
    const avant = await request(http).get(`/v1/cpsi/clients/${c1}/timeline?asOf=2026-02-15T00:00:00.000Z`).set(bearer(T, U, "CO"));
    expect(avant.body.evenements.map((e: any) => e.type)).not.toContain("velocite_tx");
    expect(avant.body.evenements.length).toBe(2);
    // Rejouer la même requête redonne EXACTEMENT le même résultat
    const rejeu = await request(http).get(`/v1/cpsi/clients/${c1}/timeline?asOf=2026-02-15T00:00:00.000Z`).set(bearer(T, U, "CO"));
    expect(JSON.stringify(rejeu.body.evenements)).toBe(JSON.stringify(avant.body.evenements));
    console.log("PC-14 PASS — timeline scopée client, as_of strict, rejouable");
  });

  it("PC-13 [AW-01] la volumétrie COMPTE ce que le moteur produit — cohérente avec /alerts, rejouable", async () => {
    await request(http).post("/v1/cpsi/groups").set(bearer(T, U, "CO"))
      .send({ gid: "PEP", label: "Clients PEP", at: "2026-01-12T00:00:00.000Z",
        predicat: { logique: "OU", conditions: [{ champ: "pep", op: "eq", val: true }] } }).expect(201);
    await request(http).post("/v1/cpsi/scenarios").set(bearer(T, U, "CO"))
      .send({ sid: "SC_VOL", label: "Volumétrie test", champ: "score",
        groupesSeuils: { PEP: 1 }, at: "2026-01-15T00:00:00.000Z" }).expect(201);
    const alerts = (await request(http).get("/v1/cpsi/alerts").set(bearer(T, U, "CO"))).body;
    const vol = await request(http).get("/v1/cpsi/volumetrie").set(bearer(T, U, "CO"));
    expect(vol.status).toBe(200);
    expect(vol.body.total_signaux).toBe(alerts.signaux.length);             // le compte = la source (aucun re-calcul front)
    const sc = vol.body.par_scenario.SC_VOL;
    expect(sc.signaux).toBeGreaterThan(0);
    expect(sc.alertes).toBe(alerts.alertes.filter((a: any) => a.scenario === "SC_VOL").length);
    // Rejouable à date : avant la définition du scénario → volumétrie vide
    const avant = await request(http).get("/v1/cpsi/volumetrie?asOf=2026-01-10T00:00:00.000Z").set(bearer(T, U, "CO"));
    expect(avant.body.total_signaux).toBe(0);
    console.log("PC-13 PASS — volumétrie = comptage moteur, cohérente alerts, rejouable à date");
  });
});
