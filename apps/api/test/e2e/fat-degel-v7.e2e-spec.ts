/**
 * FAT — DÉGEL VAGUE 7 (canon ratifié 2026-07-28, mapping +3 ; GO Ali sur plan) : MOBILE BANKING.
 * R316 [canon R313] clients finaux = POPULATION IAM DISTINCTE (jamais les rôles internes —
 * contrainte STRUCTURELLE) ; auth dédiée MFA obligatoire ; activation RM + code hors bande,
 * tracée · R317 [canon R314] mobile v1 = LECTURE + MESSAGERIE ; exclusions v1 = liste fermée
 * opposable, routes INEXISTANTES (404, pas 403) · R318 [canon R315] le client ne voit QUE le
 * partagé ; AUCUNE donnée compliance, même l'existence (OL-34/R270) ; tout contrôle serveur.
 * MB-01..05. Clés R-Q : mobile_actif (OFF par défaut → surface 404), mobile_partage_defaut.
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";
import { OutboxWorker } from "../../src/modules/events/outbox.worker";
import { totp } from "../../src/modules/mobile/mobile.module";

describe("FAT DÉGEL V7 — R316-R318 : population distincte, lecture+messagerie, partagé seulement (MB-01..05)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID(); const RM = randomUUID(), ADMIN = randomUUID(), CO_SR = randomUUID();
  const C1 = randomUUID();                      // le client du RM — titulaire de l'identité mobile
  let identiteId = "", codeHorsBande = "", mfaSecret = "", jetonMobile = "";

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
    await seedTenantClient(prisma, T, C1);
    await prisma.client.update({ where: { id: C1 }, data: { rmUserId: RM } });
  });
  afterAll(async () => { await app.close(); });

  it("MB-01 [R316] population IAM DISTINCTE : mobile_actif OFF → 404 ; table SANS colonne rôle ; jeton interne jamais côté client", async () => {
    // mobile_actif est OFF par défaut : la surface n'EXISTE pas (404 — pas 403, existence cachée)
    const off = await request(http).post("/v1/mobile/activer").set(bearer(T, RM, "RM")).send({ clientId: C1 });
    expect(off.status).toBe(404);
    await request(http).post("/v1/parametres/valeur/mobile_actif").set(bearer(T, ADMIN, "ADMIN"))
      .send({ valeur: true, motif: "R316 : activation du canal mobile (test)" }).expect(201);
    // L'activation par le RM du client : identité créée + code hors bande — TRACÉE
    const r = await request(http).post("/v1/mobile/activer").set(bearer(T, RM, "RM")).send({ clientId: C1 });
    expect(r.status).toBe(201);
    identiteId = r.body.identite; codeHorsBande = r.body.code;
    expect(identiteId).toBeTruthy();
    expect(codeHorsBande).toBeTruthy();                                     // remis UNE fois au canal hors bande
    // STRUCTUREL : la table de la population mobile n'a AUCUNE colonne de rôle — le refus
    // MB-01 n'est pas une validation, c'est une impossibilité de schéma.
    const cols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'mobile_identites'`);
    expect(cols.length).toBeGreaterThan(0);
    expect(cols.map((c) => c.column_name)).not.toContain("role");
    // L'événement d'activation ne porte JAMAIS le code en clair
    const ev = await prisma.domainEvent.findFirst({
      where: { tenantId: T, type: "mobile.identite.creee", aggregateId: identiteId } });
    expect(ev).toBeTruthy();
    expect(JSON.stringify(ev!.payload)).not.toContain(codeHorsBande);
    // Un jeton INTERNE (rôle RM) sur la surface client mobile → 401 : deux portes, zéro partage
    const interne = await request(http).get("/v1/mobile/client/documents").set(bearer(T, RM, "RM"));
    expect(interne.status).toBe(401);
    console.log("MB-01 PASS — surface OFF=404, table sans rôle, code jamais en clair, porte interne refusée");
  });

  it("MB-02 [R316] activation SANS code hors bande → refusée ; avec → tracée ; MFA OBLIGATOIRE au login ; jeton mobile jamais côté interne", async () => {
    const mauvais = await request(http).post("/v1/mobile/auth/activer").send({ identite: identiteId, code: "PAS-LE-BON" });
    expect([401, 403]).toContain(mauvais.status);                           // MB-02 : sans le code, rien
    const ok = await request(http).post("/v1/mobile/auth/activer").send({ identite: identiteId, code: codeHorsBande });
    expect(ok.status).toBe(201);
    mfaSecret = ok.body.mfaSecret;                                          // remis UNE fois — MFA obligatoire ensuite
    expect(mfaSecret).toBeTruthy();
    const trace = await prisma.domainEvent.findFirst({
      where: { tenantId: T, type: "mobile.identite.activee", aggregateId: identiteId } });
    expect(trace).toBeTruthy();                                             // l'activation est TRACÉE
    // Login SANS MFA → refus : le mot de passe seul n'existe pas dans cette population
    const sansMfa = await request(http).post("/v1/mobile/auth/login").send({ identite: identiteId });
    expect(sansMfa.status).toBe(401);
    const login = await request(http).post("/v1/mobile/auth/login")
      .send({ identite: identiteId, mfa: totp(mfaSecret) });
    expect(login.status).toBe(201);
    jetonMobile = login.body.token;
    expect(jetonMobile).toBeTruthy();
    // Le jeton MOBILE sur une route interne → 401 : l'étanchéité vaut dans les DEUX sens (R316)
    const interne = await request(http).get("/v1/clients").set({ Authorization: `Bearer ${jetonMobile}` });
    expect(interne.status).toBe(401);
    console.log("MB-02 PASS — code hors bande exigé, activation tracée, MFA obligatoire, jeton mobile refusé côté interne");
  });

  it("MB-03 [R318] le client ne voit QUE le partagé — ABSENT de la RÉPONSE réseau, pas masqué ; AUCUNE donnée compliance", async () => {
    // Deux pièces GED réelles du client — une seule sera marquée « partagé client »
    const docPartage = randomUUID(), docPrive = randomUUID();
    for (const [id, nom] of [[docPartage, "Relevé de compte 2026-06"], [docPrive, "Formulaire A ayant droit"]] as const)
      await prisma.$executeRaw`INSERT INTO documents (id, tenant_id, client_id, name, status, created_at)
        VALUES (${id}::uuid, ${T}::uuid, ${C1}::uuid, ${nom}, 'ACTIF', NOW())`;
    // mobile_partage_defaut = rien : AVANT tout marquage, le client ne voit AUCUN document
    const avant = await request(http).get("/v1/mobile/client/documents").set({ Authorization: `Bearer ${jetonMobile}` });
    expect(avant.status).toBe(200);
    expect(avant.body.documents).toHaveLength(0);
    // Le RM marque UNE pièce + UN compte — acte tracé (jamais un défaut)
    await request(http).post("/v1/mobile/partager").set(bearer(T, RM, "RM"))
      .send({ cible: "document", id: docPartage, partage: true }).expect(201);
    await request(http).post("/v1/mobile/partager").set(bearer(T, RM, "RM"))
      .send({ cible: "compte", id: "ACC-CH-001", clientId: C1, partage: true }).expect(201);
    const docs = await request(http).get("/v1/mobile/client/documents").set({ Authorization: `Bearer ${jetonMobile}` });
    const brut = JSON.stringify(docs.body);
    expect(brut).toContain(docPartage);
    expect(brut).not.toContain(docPrive);                                   // ABSENT du réseau — pas un display:none
    expect(brut).not.toMatch(/kyc|risk|screening|aml|compliance/i);         // R318/OL-34 : pas même l'existence
    const comptes = await request(http).get("/v1/mobile/client/comptes").set({ Authorization: `Bearer ${jetonMobile}` });
    expect(comptes.status).toBe(200);
    expect(JSON.stringify(comptes.body)).toContain("ACC-CH-001");
    console.log("MB-03 PASS — rien par défaut, le non-partagé absent de la réponse, zéro donnée compliance");
  });

  it("MB-04 [R317] exclusions v1 = liste FERMÉE opposable : les routes N'EXISTENT PAS (404, jamais 403) — et le code le prouve", async () => {
    for (const exclu of ["paiements", "ordres", "signature", "donnees-personnelles", "beneficiaires"]) {
      const r = await request(http).post(`/v1/mobile/client/${exclu}`).set({ Authorization: `Bearer ${jetonMobile}` })
        .send({ tentative: true });
      expect(r.status).toBe(404);                                           // la route n'existe pas
      expect(r.status).not.toBe(403);                                       // 403 avouerait une existence
    }
    // Revue automatisée : le module mobile ne DÉCLARE aucune de ces routes (structurel, pas un garde)
    const src = fs.readFileSync(path.join(__dirname, "../../src/modules/mobile/mobile.module.ts"), "utf8");
    expect(src).not.toMatch(/paiement|ordre.*bourse|signature|beneficiaire/i);
    console.log("MB-04 PASS — exclusions v1 : routes inexistantes (404), inventaire du code vierge");
  });

  it("MB-05 [R317/CC-01] « changer mon adresse » par MESSAGE → le RM ouvre un CoC — CC-01 rejoué depuis mobile", async () => {
    // Le type CoC du registre (CC-01 : les valeurs se figent à l'ouverture)
    await request(http).post("/v1/coc/config").set(bearer(T, CO_SR, "CO_SR"))
      .send({ typeCode: "MOD_DONNEES_PERSO", libelle: "Modification de données personnelles",
        materialite: "MOYENNE", actionRequise: "MAJ_CIBLEE", roleTraitant: "RM" }).expect(201);
    // Le client ÉCRIT — la modification n'a pas de route (MB-04), le message est la voie
    const msg = await request(http).post("/v1/mobile/client/messages").set({ Authorization: `Bearer ${jetonMobile}` })
      .send({ texte: "Merci de changer mon adresse : Bahnhofstrasse 1, 8001 Zürich" });
    expect(msg.status).toBe(201);
    const messageId = msg.body.id;
    // Le RM le voit côté banque et TRAITE : l'ouverture passe par la voie CoC RÉELLE (jamais un second circuit)
    const boite = await request(http).get(`/v1/mobile/messages?clientId=${C1}`).set(bearer(T, RM, "RM"));
    expect(boite.status).toBe(200);
    expect(JSON.stringify(boite.body)).toContain(messageId);
    const coc = await request(http).post(`/v1/mobile/messages/${messageId}/ouvrir-coc`).set(bearer(T, RM, "RM"))
      .send({ typeCode: "MOD_DONNEES_PERSO", description: "Changement d'adresse demandé par message mobile" });
    expect(coc.status).toBe(201);
    const dossier = await prisma.cocFile.findFirst({ where: { id: coc.body.id, tenantId: T } });
    expect(dossier).toBeTruthy();
    expect(dossier!.clientId).toBe(C1);
    expect(dossier!.materialite).toBe("MOYENNE");                           // CC-01 : figé à l'ouverture
    const ouvert = await prisma.domainEvent.findFirst({
      where: { tenantId: T, type: "COC_OUVERT", aggregateId: coc.body.id } });
    expect(ouvert).toBeTruthy();
    // La réponse du RM revient au client — la MESSAGERIE est la surface v1 (R317)
    await request(http).post(`/v1/mobile/messages/${C1}/repondre`).set(bearer(T, RM, "RM"))
      .send({ texte: "Bien reçu — votre demande est en traitement (dossier ouvert)." }).expect(201);
    const fil = await request(http).get("/v1/mobile/client/messages").set({ Authorization: `Bearer ${jetonMobile}` });
    expect(JSON.stringify(fil.body)).toContain("en traitement");
    expect(JSON.stringify(fil.body)).not.toMatch(/coc|dossier_id|materialite/i);  // le dossier reste côté banque (R318)
    console.log("MB-05 PASS — message → CoC ouvert côté banque (CC-01 rejoué), le client ne voit que la réponse");
  });
});
