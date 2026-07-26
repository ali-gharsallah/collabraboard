/**
 * FAT — Tests d'Acceptation Fonctionnelle Vague 4 (Les écrans « plateforme »).
 * Exécutés contre le VRAI backend. Doctrine : INTÉGRER, pas refaire (core = port, pas de moteur).
 * Écrans : Transferts & ordres · Settlement · Screening avancé · Reporting MROS · GED/coffre · Registre LBA.
 * FAT orientés : traçabilité, complétude documentaire, reporting exact.
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

const jstr = (r: request.Response) => JSON.stringify(r.body);

describe("FAT Vague 4 — Écrans plateforme (backend réel)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const TID = randomUUID(), TID2 = randomUUID();
  const CLIENT = randomUUID();
  const RM = randomUUID(), CO = randomUUID(), MLRO = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, TID, CLIENT);
    await seedTenantClient(prisma, TID2, randomUUID());
    // MROS habilite le rôle MLRO par défaut ; on ouvre la file de revue tx à CO+MLRO.
    await prisma.tenant.update({ where: { id: TID }, data: { settings: {
      txRevueRoles: ["CO", "MLRO"], mrosRolesHabilites: ["MLRO"],
      gedDocTypes: [{ code: "PASSEPORT", validiteMois: 120, requisPour: [], rolesAutorises: ["CO", "RM"] }] } as any } });
    // GED : une pièce classée + une version (empreinte au dépôt)
    const doc = await prisma.document.create({ data: {
      tenantId: TID, clientId: CLIENT, nom: "passeport.pdf", typeCode: "PASSEPORT", statut: "ACTIF" } as any });
    await prisma.documentVersion.create({ data: { tenantId: TID, documentId: (doc as any).id,
      numero: 1, sha256: "a".repeat(64), deposePar: RM, deposeAt: new Date().toISOString() } as any });
  });
  afterAll(async () => { await app.close(); });

  // ══ Écran 1 : Transferts & ordres ═════════════════════════════════════════
  it("FAT-TX-01 [CO] portail : verdict tracé, file habilitée, décision motivée, statut client sans motif AML", async () => {
    // Transaction très supérieure au profil (profil 50k, seuil 3× = 150k) → SUSPEND (R142)
    const ev = await request(http).post("/v1/transactions/evaluer").set(bearer(TID, RM, "RM"))
      .send({ clientId: CLIENT, txRef: "TX-001", type: "VIREMENT", montantChf: 5_000_000 });
    expect(ev.status).toBeLessThan(300);
    expect(ev.body.verdict).toBe("SUSPEND");
    const vid = ev.body.verdictId;
    // R143 : la file de revue n'est lisible que par un rôle habilité (RM non habilité → 403)
    const refuse = await request(http).get("/v1/transactions/revue").set(bearer(TID, RM, "RM"));
    expect(refuse.status).toBe(403);
    const file = await request(http).get("/v1/transactions/revue").set(bearer(TID, CO, "CO"));
    expect(file.body.length).toBeGreaterThanOrEqual(1);
    // R7 : décision sans motif refusée ; puis LIBERER motivé
    const sansMotif = await request(http).post(`/v1/transactions/${vid}/decider`).set(bearer(TID, CO, "CO")).send({ decision: "LIBERER", motif: "" });
    expect(sansMotif.status).toBe(400);
    const lib = await request(http).post(`/v1/transactions/${vid}/decider`).set(bearer(TID, CO, "CO")).send({ decision: "LIBERER", motif: "Justificatif reçu, opération conforme." });
    expect(lib.status).toBeLessThan(300);
    // R132 : la vue CLIENT ne porte JAMAIS de motif AML — seulement un statut
    const vue = await request(http).get(`/v1/transactions/${vid}/statut-client`).set(bearer(TID, RM, "RM"));
    expect(vue.body.statut).toBe("EXECUTEE");
    expect(jstr(vue)).not.toContain("motif");
    expect(jstr(vue)).not.toContain("garde");
    console.log(`FAT-TX-01 PASS — SUSPEND tracé (R142), file habilitée (R143), sans motif refusé (R7), LIBERER → statut client EXECUTEE sans fuite AML (R132)`);
  });

  // ══ Écran 2 : Settlement / exécution (port core, pas de moteur) ════════════
  it("FAT-SETTLE-01 [CO] l'exécution se lit d'un port ; sans port, refus explicite (jamais un simulacre)", async () => {
    const etat = await request(http).get("/v1/corebanking/etat").set(bearer(TID, CO, "CO"));
    expect(etat.status).toBe(200);
    expect(typeof etat.body.lots).toBe("number");           // lecture seule (R168)
    const imp = await request(http).post("/v1/corebanking/importer").set(bearer(TID, CO, "CO")).send({ type: "POSITIONS" });
    expect(imp.status).toBe(400);
    expect(jstr(imp)).toContain("core banking");            // R167 : refus explicite, pas de donnée simulée
    console.log(`FAT-SETTLE-01 PASS — état sync lisible (lots=${etat.body.lots}), import sans port REFUSÉ (R114/R167), aucun simulacre`);
  });

  // ══ Écran 3 : Screening avancé (adverse media / listes complémentaires) ════
  it("FAT-SCREEN-ADV-01 [CO] screening sur une liste complémentaire (adverse media) : trace + qualification", async () => {
    const run = await request(http).post("/v1/screening/run").set(bearer(TID, CO, "CO")).send({
      liste: "ADVERSE_MEDIA", version: "2026-07", seuil: 100, prefiltre: {},
      entries: [{ uid: "AM1", nom_complet: "Suzuki Ltd", alias: [] }], clientIds: [CLIENT] });
    expect(run.status).toBeLessThan(300);
    expect(run.body.hits.length).toBeGreaterThanOrEqual(1);
    const q = await request(http).post(`/v1/screening/hits/${run.body.hits[0].id}/qualify`).set(bearer(TID, CO, "CO"))
      .send({ verdict: "FAUX_POSITIF", motif: "Homonymie — article de presse sans lien." });
    expect(q.status).toBeLessThan(300);
    const runs = await request(http).get("/v1/screening/runs").set(bearer(TID, CO, "CO"));
    expect(runs.body.some((r: any) => r.liste === "ADVERSE_MEDIA")).toBe(true);   // liste complémentaire = paramètre d'entrée
    console.log(`FAT-SCREEN-ADV-01 PASS — screening liste complémentaire ADVERSE_MEDIA tracé (R103) + hit qualifié (R101) ; la liste est un paramètre, pas un moteur séparé`);
  });

  // ══ Écran 4 : Reporting réglementaire (MROS) — exact & opposable ═══════════
  it("FAT-MROS-01 [MLRO] décider depuis un cas ESCALADÉ : empreinte opposable, dossier figé, art. 10a", async () => {
    // Un cas de risque ESCALADÉ (R136)
    const alerte = await request(http).post("/v1/aml/evaluer").set(bearer(TID, MLRO, "MLRO")).send({ clientId: CLIENT, beneficiaireSanctionne: true });
    const o = await request(http).post("/v1/riskcases").set(bearer(TID, CO, "CO")).send({ clientId: CLIENT, signalIds: [alerte.body.signaux[0].id] });
    const rcId = o.body.caseId;
    await request(http).post(`/v1/riskcases/${rcId}/transition`).set(bearer(TID, CO, "CO")).send({ vers: "EN_ANALYSE" }).expect(201);
    await request(http).post(`/v1/riskcases/${rcId}/transition`).set(bearer(TID, CO, "CO")).send({ vers: "ESCALADEE", motif: "Suspicion confirmée, escalade MLRO." }).expect(201);
    // Décision MROS motivée + pièces → empreinte de dossier
    const dec = await request(http).post("/v1/mros/decider").set(bearer(TID, MLRO, "MLRO")).send({
      riskCaseId: rcId, clientId: CLIENT, decision: "COMMUNIQUER", motif: "Éléments suffisants art. 9 LBA.",
      pieces: [{ type: "NOTE", id: "n1", sha256: "b".repeat(64) }] });
    expect(dec.status).toBeLessThan(300);
    const commId = dec.body.communicationId; const sha = dec.body.dossierSha256;
    expect(sha).toHaveLength(64);
    // Relecture opposable : EXACTEMENT la même empreinte (R130)
    const relu = await request(http).get(`/v1/mros/${commId}`).set(bearer(TID, MLRO, "MLRO"));
    expect(relu.body.dossierSha256).toBe(sha);
    // Seconde décision sur le même cas → REFUSÉE (dossier figé, R130)
    const rejou = await request(http).post("/v1/mros/decider").set(bearer(TID, MLRO, "MLRO")).send({
      riskCaseId: rcId, clientId: CLIENT, decision: "NE_PAS_COMMUNIQUER", motif: "tentative", pieces: [] });
    expect(rejou.status).toBe(400);
    // Art. 10a (R132) : un rôle non habilité ne lit rien
    const nonHab = await request(http).get(`/v1/mros/${commId}`).set(bearer(TID, RM, "RM"));
    expect(nonHab.status).toBe(403);
    console.log(`FAT-MROS-01 PASS — décision ESCALADÉ → empreinte ${sha.slice(0, 12)}… opposable (R130), re-décision refusée (dossier figé), non-habilité bloqué (art. 10a R132)`);
  });

  // ══ Écran 5 : GED / documents (coffre, preuve) ════════════════════════════
  it("FAT-GED-COFFRE-01 [CO] la pièce porte ses versions (preuve), jamais son contenu (R110/R145)", async () => {
    const liste = await request(http).get(`/v1/ged/documents?clientId=${CLIENT}`).set(bearer(TID, CO, "CO"));
    expect(liste.status).toBe(200);
    expect(liste.body.length).toBeGreaterThanOrEqual(1);
    const nonAutorise = await request(http).get(`/v1/ged/documents?clientId=${CLIENT}`).set(bearer(TID, MLRO, "MLRO"));
    expect(nonAutorise.body.length).toBe(0);                 // R110 filtrage au rôle
    const fiche = await request(http).get(`/v1/ged/documents/${liste.body[0].id}`).set(bearer(TID, CO, "CO"));
    expect(fiche.status).toBe(200);
    expect(Array.isArray(fiche.body.versions)).toBe(true);
    expect(fiche.body.versions.length).toBeGreaterThanOrEqual(1);   // la pièce porte ses versions
    expect(jstr(fiche)).not.toContain("contenuRef");        // R145 : jamais le contenu, seulement la preuve
    console.log(`FAT-GED-COFFRE-01 PASS — fiche = ${fiche.body.versions.length} version(s), filtrée au rôle (R110), sans contenu (R145)`);
  });

  // ══ Écran 6 : Registre LBA (traçabilité agrégée) ══════════════════════════
  it("FAT-REGISTRE-01 [CO] le registre LBA agrège les journaux append-only, cloisonné (RLS)", async () => {
    // Le registre agrège des journaux existants : communications MROS + verdicts tx + runs screening.
    const comms = await request(http).get("/v1/mros").set(bearer(TID, MLRO, "MLRO"));
    expect(comms.status).toBe(200);
    expect(comms.body.length).toBeGreaterThanOrEqual(1);     // la communication de FAT-MROS-01
    const runs = await request(http).get("/v1/screening/runs").set(bearer(TID, CO, "CO"));
    expect(runs.body.length).toBeGreaterThanOrEqual(1);
    // Isolation : un autre tenant ne voit aucune communication
    const autre = await request(http).get("/v1/mros").set(bearer(TID2, MLRO, "MLRO"));
    expect(autre.body.length).toBe(0);
    console.log(`FAT-REGISTRE-01 PASS — registre agrège comms MROS=${comms.body.length} + runs=${runs.body.length}, autre tenant cloisonné (RLS)`);
  });
});
