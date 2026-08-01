/**
 * SEED DÉMO GWB — R329 (vague de clôture, canon ratifié 2026-07-29), DM-01..06.
 * « Gharsallah Wealth Bank » est un tenant ORDINAIRE (RLS, licence, aucune voie de code
 * spéciale — grep : zéro `if demo`). Son contenu est produit par les VRAIES APIs (jamais
 * d'INSERT direct sur les tables des MOTEURS) : le journal de démo est légitime, rejouable,
 * montrable à un auditeur. Le script raconte l'histoire commerciale de bout en bout et il
 * est IDEMPOTENT PAR RÉFÉRENCES (find-or-create par référence stable) — deux exécutions
 * consécutives = même état final (DM-02), remplace l'ancien refus de double semis.
 * GARDE : OLIVE_SEED_DEMO=1 obligatoire (jamais une donnée de démo par accident, R167).
 * Amorçage hors API assumé (consigné, ECARTS §11/R329) : l'INSERT du tenant, le jeton ADMIN,
 * et l'assignation rmUserId (aucune route ne les porte — actes d'ops, PAS des tables moteurs).
 * Usage : OLIVE_SEED_DEMO=1 npm run seed:demo. Déroulé commercial : docs/DEMO-SCRIPT.md.
 */
import * as request from "supertest";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer } from "../e2e/util";
import { OutboxWorker } from "../../src/modules/events/outbox.worker";

const TENANT_GWB = "9b1de001-0000-4000-8000-00000000006b";  // référence FIXE du tenant démo

describe("SEED DÉMO GWB (R329) — l'histoire complète par les vraies APIs, idempotent (DM-01..06)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;

  beforeAll(async () => {
    if (process.env.OLIVE_SEED_DEMO !== "1")
      throw new Error("SEED REFUSÉ : OLIVE_SEED_DEMO=1 requis — le seed démo ne s'exécute jamais par accident (R167)");
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
  });
  afterAll(async () => { await app?.close(); });

  it("DM-01..06 : sème (ou re-sème) le tenant GWB — idempotent par références, histoire complète", async () => {
    // ── Amorçage ops (hors API, consigné) : le tenant EXISTE (upsert par référence) ──
    await prisma.$executeRaw`INSERT INTO tenants (id, name, created_at) VALUES (${TENANT_GWB}::uuid, 'Gharsallah Wealth Bank', NOW())
      ON CONFLICT (id) DO NOTHING`;
    const boss = bearer(TENANT_GWB, "00000000-0000-4000-8000-0000000000a1", "ADMIN");  // jeton d'amorçage stable

    // ── DM : 6 personas par rôle — find-or-create par e-mail (idempotence par référence) ──
    const roles: [string, string][] = [["ADMIN", "alice"], ["RM", "marc"], ["CO", "carla"],
      ["CO_SR", "selim"], ["DIR", "diane"], ["SO", "sofia"]];
    const ids: Record<string, string> = {};
    const users = (await request(http).get("/v1/admin/users").set(boss)).body;
    for (const [role, prenom] of roles) {
      const email = `${prenom}@gwb-demo.ch`;
      const exist = (Array.isArray(users) ? users : []).find((u: any) => u.email === email);
      if (exist) { ids[role] = exist.id; continue; }
      const u = await request(http).post("/v1/admin/users").set(boss)
        .send({ email, name: prenom[0].toUpperCase() + prenom.slice(1), role, password: "Demo-GWB-2026!" });
      expect(u.status).toBe(201);
      ids[role] = u.body.id;
    }
    const rm = () => bearer(TENANT_GWB, ids.RM, "RM");
    const co = () => bearer(TENANT_GWB, ids.CO, "CO");
    const cosr = () => bearer(TENANT_GWB, ids.CO_SR, "CO_SR");

    // ── Registre : domaine de login (R296) — écrasable, idempotent par nature ──
    await request(http).post("/v1/parametres/valeur/loginDomaines").set(boss)
      .send({ valeur: ["gwb-demo.ch"], motif: "R329 : domaine de résolution login" }).expect(201);

    // ── L'HISTOIRE — 1. PROSPECTS → onboarding (pipeline réel, find-or-create par nom) ──
    const pipeline = (await request(http).get("/v1/onboarding").set(rm())).body;
    const parNom = new Map((pipeline.onboardings ?? pipeline.data ?? pipeline ?? []).map?.((o: any) => [o.prospectNom, o]) ?? []);
    const prospect = async (nom: string) => {
      if (parNom.has(nom)) return (parNom.get(nom) as any).id;
      const o = await request(http).post("/v1/onboarding").set(rm()).send({ prospectNom: nom });
      expect(o.status).toBe(201);
      return o.body.id;
    };
    const pA = await prospect("Famille Keller (PP)");
    const pB = await prospect("Nordwind Handel SA");
    const pC = await prospect("Meridian Trust");
    // L'un avance dans le tunnel (les transitions ré-appliquées sur un état déjà atteint sont refusées : on tolère)
    for (const vers of ["COLLECTE", "KYC_EN_COURS"])
      await request(http).post(`/v1/onboarding/${pA}/transition`).set(rm()).send({ vers, motif: "démo" });

    // ── 2. Trois CLIENTS (3 structures) — find-or-create par nom ──
    const existants = (await request(http).get("/v1/clients").set(rm())).body;
    const dejaClient = (nom: string) => (existants.data ?? existants ?? []).find?.((c: any) => c.name === nom);
    const clients: Record<string, string> = {};
    for (const [nom, structure, country] of [["Famille Keller", "PP", "CH"],
      ["Nordwind Handel SA", "SA", "DE"], ["Meridian Trust", "TRUST", "SG"]] as const) {
      const d = dejaClient(nom);
      if (d) { clients[nom] = d.id; continue; }
      const c = await request(http).post("/v1/clients").set(rm()).send({ name: nom, structure, country });
      expect(c.status).toBe(201);
      clients[nom] = c.body.id;
      await prisma.client.update({ where: { id: c.body.id }, data: { rmUserId: ids.RM } });  // amorçage ops (consigné)
    }
    const cKeller = clients["Famille Keller"];

    // ── 3. KYC multi-rôles (find-or-create : un seul dossier par client de démo) ──
    const kycExiste = await prisma.kycFile.findFirst({ where: { tenantId: TENANT_GWB, clientId: cKeller } });
    if (!kycExiste) {
      await request(http).post("/v1/kyc").set(rm())
        .send({ clientId: cKeller, legalStructure: "PP", accountType: "CURRENT", countryCode: "CH", rmId: ids.RM }).expect(201);
    }

    // ── 3-bis. BOUCLE KYC DE BOUT EN BOUT — personnes/PEP → documents → visa 4-yeux → ACTIF → révision.
    // BEST-EFFORT + IDÉMPOTENT : si le dossier est déjà VALIDATED (run 2), ou si le gabarit exige un
    // rôle absent du casting démo (RM/CO/CO_SR), on TOLÈRE (log) — le seed ne casse JAMAIS (même esprit
    // que les transitions déjà-atteintes ci-dessus). Le parcours EXACT est prouvé par la suite e2e
    // (kyc-rules.e2e-spec.ts) ; ici il PEUPLE la démo pour dérouler l'histoire à l'écran.
    try {
      const kf = await prisma.kycFile.findFirst({ where: { tenantId: TENANT_GWB, clientId: cKeller } });
      if (kf) {
        // Personnes + PEP (find-or-create par nom via prisma — pas de route de liste personnes).
        let hans = await prisma.person.findFirst({ where: { tenantId: TENANT_GWB, nom: "Hans Keller" } });
        if (!hans) {
          const p = await request(http).post("/v1/personnes").set(rm()).send({ nom: "Hans Keller", donnees: { role: "UBO" } });
          if (p.status === 201) hans = p.body;
        }
        if (hans) {
          await request(http).post(`/v1/personnes/${hans.id}/roles`).set(rm()).send({ kycFileId: kf.id, role: "UBO" }).catch(() => {}); // R31
          await request(http).post(`/v1/personnes/${hans.id}/coc`).set(co()).send({ champ: "pep", valeur: true, document: "Mandat cantonal (démo)" }).catch(() => {}); // R32 (PEPisation)
        }
        // Documents au dossier (find-or-create par nom).
        const docVu = await prisma.document.findFirst({ where: { tenantId: TENANT_GWB, clientId: cKeller, nom: "Passeport Hans Keller (démo)" } });
        if (!docVu)
          await request(http).post("/v1/ged/documents").set(rm())
            .send({ clientId: cKeller, nom: "Passeport Hans Keller (démo)", typeCode: "ID" }).catch(() => {});

        // Visa 4-yeux → validation finale, seulement si le dossier n'est pas déjà validé.
        if (kf.status !== "VALIDATED") {
          const code = kf.code;
          const roleToken: Record<string, () => any> = { CO: co, CO_SR: cosr };
          // 1) le PRÉPARATEUR (RM) répond aux questions éditables/obligatoires (devient contributeur).
          const dossier = (await request(http).get(`/v1/kyc/${code}`).set(rm())).body;
          for (const s of dossier.sections ?? [])
            for (const q of s.questions ?? [])
              if ((q.right === "EDIT" || q.right === "REQUIRED") && !q.answer)
                await request(http).patch(`/v1/kyc/${code}/questions/${q.code}`).set(rm()).send({ answer: "Renseigné (démo)" }).catch(() => {});
          // 2) chaque visa PENDING est signé par un persona dont le rôle == requiredRole (jamais le RM).
          const frais = (await request(http).get(`/v1/kyc/${code}`).set(rm())).body;
          for (const v of frais.visas ?? [])
            if (v.status === "PENDING" && roleToken[v.requiredRole])
              await request(http).post(`/v1/kyc/${code}/visas/${v.sectionCode}`)
                .set(roleToken[v.requiredRole]()).set("If-Match", String(v.version ?? 0)).send({ verdict: "OK" }).catch(() => {});
          // 3) validation finale par CO_SR (n'a pas préparé le dossier — four-eyes R52 respecté).
          const vfin = (await request(http).get(`/v1/kyc/${code}`).set(rm())).body;
          await request(http).post(`/v1/kyc/${code}/validate`)
            .set(cosr()).set("If-Match", String(vfin.version ?? 0)).send({}).catch(() => {});
        }
        // Révision : l'échéance NAÎT à la validation (RV-01/07) — on la surface.
        const revs = (await request(http).get(`/v1/reviews/deadlines?horizonJours=3650`).set(co())).body;
        const nRev = (revs?.deadlines ?? revs ?? []).length ?? 0;
        const relu = await prisma.kycFile.findFirst({ where: { id: kf.id } });
        console.log(`SEED GWB — boucle KYC : dossier ${kf.code} statut=${relu?.status} · ${nRev} révision(s) planifiée(s)`);
      }
    } catch (e) {
      console.log("SEED GWB — boucle KYC best-effort tolérée :", (e as any)?.message ?? e);
    }

    // ── 4. CPSI : client enregistré + signal + score (idempotent : registered une fois) ──
    const cpsiVu = await prisma.cpsiEvent.findFirst({ where: { tenantId: TENANT_GWB, clientId: cKeller, type: "cpsi.client.registered" } });
    if (!cpsiVu) {
      await request(http).post("/v1/cpsi/clients").set(co())
        .send({ clientId: cKeller, statique: { pep: true, pays_risque: 1 } }).expect(201);
      await request(http).post(`/v1/cpsi/clients/${cKeller}/signals`).set(co())
        .send({ type: "hit_screening", severite: 2 }).expect(201);
    }
    expect((await request(http).get(`/v1/cpsi/clients/${cKeller}/score`).set(co())).status).toBe(200);

    // ── 5. CoC HAUTE (type au registre + dossier — find-or-create par type) ──
    const cfg = (await request(http).get("/v1/coc/config").set(cosr())).body;
    if (!(cfg.types ?? []).some((t: any) => t.typeCode === "PEP_STATUS"))
      await request(http).post("/v1/coc/config").set(cosr())
        .send({ typeCode: "PEP_STATUS", libelle: "Statut PEP acquis", materialite: "HAUTE",
          actionRequise: "REVISION_KYC", roleTraitant: "CO" }).expect(201);
    const cocDeja = await prisma.cocFile.findFirst({ where: { tenantId: TENANT_GWB, clientId: cKeller, typeCode: "PEP_STATUS" } });
    if (!cocDeja)
      await request(http).post("/v1/coc").set(rm())
        .send({ clientId: cKeller, typeCode: "PEP_STATUS", description: "Mandat cantonal — statut PEP (démo)" }).expect(201);

    // ── 6. OpRisk : un incident au dossier (find-or-create par titre) ──
    const incs = (await request(http).get("/v1/oprisk/incidents").set(co())).body;
    if (!(incs.incidents ?? []).some((i: any) => i.titre === "Double exécution d'un virement"))
      await request(http).post("/v1/oprisk/incidents").set(co())
        .send({ titre: "Double exécution d'un virement", categorie: "EXECUTION_PROCESSUS", severite: 3, pertes: 12500 }).expect(201);

    // ── 7. OFFBOARDING EXIT_COMPLIANCE (art. 10a — la scène OF-07 ; find-or-create) ──
    const offDeja = await prisma.offboardingFile.findFirst({ where: { tenantId: TENANT_GWB, clientId: clients["Meridian Trust"] } });
    if (!offDeja)
      await request(http).post("/v1/offboarding").set(rm())
        .send({ clientId: clients["Meridian Trust"], type: "EXIT_COMPLIANCE",
          motif: "Sortie conformité — art. 10a (démo)", motifSensible: "Soupçon documenté (visible CO_SR seulement)" }).expect(201);

    // ── La PREUVE — comptée ; l'idempotence se vérifie en relançant (DM-02, cf. run 2) ──
    const preuve = {
      utilisateurs: await prisma.user.count({ where: { tenantId: TENANT_GWB } }),
      onboardings: await prisma.onboarding.count({ where: { tenantId: TENANT_GWB } }),
      clients: await prisma.client.count({ where: { tenantId: TENANT_GWB } }),
      kyc: await prisma.kycFile.count({ where: { tenantId: TENANT_GWB } }),
      coc: await prisma.cocFile.count({ where: { tenantId: TENANT_GWB } }),
      offboarding: await prisma.offboardingFile.count({ where: { tenantId: TENANT_GWB } }),
    };
    expect(preuve.utilisateurs).toBe(6);
    expect(preuve.clients).toBe(3);
    expect(preuve.onboardings).toBe(3);
    expect(preuve.kyc).toBeGreaterThanOrEqual(1);
    expect(preuve.coc).toBe(1);
    expect(preuve.offboarding).toBe(1);
    console.log("SEED GWB OK —", JSON.stringify(preuve), `tenant=${TENANT_GWB}`);
  }, 180000);
});
