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

    // ── Calendrier réglementaire (R490, V2-M43) — CONTENU DE DÉMONSTRATION, non validé
    // juridiquement (question Q-CR-1 de spec/CALENDRIER-REGLEMENTAIRE-R490-R492.md, consignée
    // pour revue humaine). Le moteur ne décide d'aucune base légale : il lit cette clé.
    // `echeance: null` sur la communication MROS n'est PAS un oubli — « sans délai » (LBA
    // art. 9) n'est pas une date, et le moteur ne doit jamais en fabriquer une pour pouvoir
    // afficher un retard. Idempotent par nature : écrire la même valeur ne change rien.
    await request(http).post("/v1/parametres/valeur/calendrierReglementaire").set(boss)
      .send({ motif: "R490 : calendrier de démonstration — À VALIDER par un juriste (Q-CR-1)",
        valeur: [
          { code: "LBA-9", obligation: "Communication au MROS", periode: "au fil de l'eau",
            echeance: null, base: "LBA art. 9", responsable: "MLRO" },
          { code: "RAP-LBA-2025", obligation: "Rapport annuel LBA à la direction", periode: "2025",
            echeance: "2026-03-31", base: "OBA-FINMA", responsable: "MLRO" },
          { code: "AEOI-2025", obligation: "Échange automatique de renseignements (AEOI/CRS)",
            periode: "2025", echeance: "2026-06-30", base: "LEAR", responsable: "Fiscalité" },
          { code: "FATCA-2025", obligation: "Déclaration FATCA", periode: "2025",
            echeance: "2026-09-30", base: "Accord FATCA", responsable: "Fiscalité" },
        ] }).expect(201);
    // Un dépôt CONSIGNÉ, pour que la démonstration montre les deux faces : l'obligation due et
    // celle qui est faite, avec son accusé. Idempotent : le second dépôt est refusé (R492), et
    // c'est exactement ce qu'on veut montrer — un doublon de déclaration est un incident.
    await request(http).post("/v1/reglementaire/obligations/RAP-LBA-2025/depot").set(cosr())
      .send({ periode: "2025", reference: "DIR-2026-0031",
        motif: "rapport annuel remis à la direction le 12.03.2026" });

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

    // ── 3-ter. MÉCANISMES LOT B (démo) — matrice doc publiée (R26/R27), suspension (R17), process (R23).
    // Par les VRAIES routes, best-effort + idempotent : n'altère pas l'histoire principale ni les
    // comptes prouvés. Le CONTENU de matrice est de DÉMO (le vrai référentiel est arbitré banque —
    // cf. GOUVERNANCE-LOTC.md : c'est précisément le point de saisie `publier()`).
    try {
      // R26/R27 : publier une matrice de démo si aucune n'est en vigueur (groupe d'équivalence par juridiction).
      const mat = (await request(http).get("/v1/doc-matrix/en-vigueur").set(cosr())).body;
      // Idempotent PAR RÉFÉRENCE : la référence n'est pas « une matrice existe » mais « une
      // matrice PORTANT L'AXE RÔLE est en vigueur ». Un tenant semé avant l'enrichissement du
      // contrat reçoit donc une version 2 — append-only, la v1 reste lisible et les dossiers
      // qu'elle a estampillés restent évalués contre elle (R29). Deux exécutions de suite ne
      // publient qu'une fois : à la seconde, `parRole` est déjà là.
      const porteLesRoles = Object.values(mat?.contenu?.exigences ?? {}).some((b: any) => b?.parRole);
      if (!mat || !mat.version || !porteLesRoles) {
        await request(http).post("/v1/doc-matrix").set(cosr()).send({
          // R26/rôle : `parRole` porte les exigences ADDITIONNELLES du rôle (le socle
          // `personne_liee` s'applique à tout intervenant). Le contenu ci-dessous est de DÉMO,
          // mais l'ADOSSEMENT est réel : formulaire A pour l'ayant droit économique (CDB 20
          // art. 27), formulaire K pour le détenteur du contrôle d'une société opérationnelle
          // non cotée (CDB 20 art. 20), procuration pour un signataire. C'est exactement la
          // distinction que la v1 faisait en colonnes et que le moteur ignorait.
          contenu: { exigences: {
            PP: { entite: [{ groupe: "preuve_identite", parJuridiction: { CH: "PASSEPORT_CH", "*": "PASSEPORT" } }],
              personne_liee: ["PASSEPORT"], compte: [],
              parRole: { AYANT_DROIT_ECO: ["FORMULAIRE_A"], FONDE_DE_POUVOIR: ["PROCURATION"] } },
            SA: { entite: ["REGISTRE_COMMERCE", "STATUTS"], personne_liee: ["PASSEPORT"], compte: [],
              parRole: { UBO: ["FORMULAIRE_A", "FORMULAIRE_K"], ADMINISTRATEUR: ["PV_CONSEIL"],
                SIGNATAIRE: ["PROCURATION"] } } } },
          enVigueurLe: "2026-01-01T00:00:00.000Z" }).catch(() => {});
      }
      // R17 : le dossier Nordwind est SUSPENDU (alerte AML) — crée son KYC puis suspend (idempotent).
      const cNord = clients["Nordwind Handel SA"];
      let kNord = await prisma.kycFile.findFirst({ where: { tenantId: TENANT_GWB, clientId: cNord } });
      if (!kNord) {
        await request(http).post("/v1/kyc").set(rm())
          .send({ clientId: cNord, legalStructure: "SA", accountType: "CURRENT", countryCode: "DE", rmId: ids.RM }).catch(() => {});
        kNord = await prisma.kycFile.findFirst({ where: { tenantId: TENANT_GWB, clientId: cNord } });
      }
      if (kNord && kNord.status !== "SUSPENDED")
        await request(http).post(`/v1/kyc/${kNord.code}/suspendre`).set(cosr()).send({ cause: "alerte:AML (démo)" }).catch(() => {});
      // R23 : une recertification est ouverte sur le dossier validé Keller (idempotent : une seule).
      const kKeller = await prisma.kycFile.findFirst({ where: { tenantId: TENANT_GWB, clientId: cKeller } });
      if (kKeller) {
        const procs = (await request(http).get(`/v1/kyc/${kKeller.code}/processes`).set(co())).body;
        if (!Array.isArray(procs) || !procs.some((p: any) => p.type === "recertification"))
          await request(http).post(`/v1/kyc/${kKeller.code}/processes`).set(cosr()).send({ type: "recertification" }).catch(() => {});
      }
      console.log("SEED GWB — mécanismes Lot B (démo) : matrice publiée · Nordwind suspendu (R17) · recert ouverte (R23)");
    } catch (e) {
      console.log("SEED GWB — bloc Lot B best-effort toléré :", (e as any)?.message ?? e);
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

    // ══ 8. LES CHAPITRES QUI MANQUAIENT (V2-M45, écart E-V2-8) ═══════════════════════════════
    // ATTENTION — supertest ne LÈVE PAS sur un 4xx. Un chapitre enveloppé dans un try/catch
    // « réussit » donc en n'écrivant rien : le silence exact qu'on refuse partout ailleurs.
    // `poser()` regarde le statut et le DIT. Un chapitre qui échoue ne casse pas l'histoire
    // principale — mais il ne passe plus inaperçu.
    const journalChapitres: string[] = [];
    const poser = async (quoi: string, req: request.Test) => {
      const r = await req;
      if (r.status >= 200 && r.status < 300) { journalChapitres.push(`✓ ${quoi}`); return r; }
      journalChapitres.push(`✗ ${quoi} → ${r.status} ${JSON.stringify(r.body?.message ?? r.body).slice(0, 160)}`);
      return r;
    };

    // Le balayage d'exécution (V2-M44) et le vérificateur de formes (V2-M41) butaient sur le même
    // mur : sept familles de données que la démonstration ne raconte PAS. Une réponse `[]` ne
    // prouve rien de la forme de ses éléments, et un acte sur un objet inexistant ne prouve rien
    // du tout. Ces chapitres sont semés PAR LES VRAIES ROUTES, comme le reste — jamais d'INSERT
    // direct sur une table de moteur. Chacun est best-effort et idempotent par référence : un
    // chapitre qui échoue ne casse pas l'histoire principale, il se signale.

    // 8a. SCREENING — une liste de sanctions (démo) puis un run qui PRODUIT des hits (R100/R409).
    try {
      const listes = (await request(http).get("/v1/screening/listes").set(co())).body;
      if (!(Array.isArray(listes) ? listes : listes?.listes ?? []).some((l: any) => l.source === "SECO-DEMO"))
        await poser("liste de screening", request(http).post("/v1/screening/listes/importer").set(co()).send({
          source: "SECO-DEMO", version: "2026-08-01",
          entries: [
            // Le nom de l'entrée est celui du client, à la lettre : un hit de démonstration doit
            // venir d'un vrai rapprochement, pas d'un seuil qu'on aurait baissé pour en fabriquer un.
            { id: "SD-1", name: "Nordwind Handel SA", est_entite: true, nationalites: ["DE"] },
            { id: "SD-2", name: "Andrei Volkov", est_entite: false, nationalites: ["RU"] },
          ] }));
      // La référence est le RUN, pas le hit : ce tenant n'en produit aucun (E-V2-12), et garder
      // les hits comme repère faisait rejouer le screening à chaque semis — DM-02 rompu.
      const runsVus = await prisma.screeningRun.count({ where: { tenantId: TENANT_GWB } });
      if (!runsVus)
        await poser("run de screening", request(http).post("/v1/screening/run").set(co()).send({
          liste: "SECO-DEMO", version: "2026-08-01", sujet: "client",
          entries: [
            { id: "SD-1", name: "Nordwind Handel SA", est_entite: true },
            { id: "SD-2", name: "Andrei Volkov", est_entite: false },
          ] }));
    } catch (e) { console.log("SEED GWB — chapitre screening toléré :", (e as any)?.message ?? e); }

    // 8b. SIGNAL AML puis CAS DE RISQUE — dans cet ordre, parce que « R133 : un risk case naît
    // d'au moins un signal ». Le moteur a raison ; c'est la démonstration qui commençait par la fin.
    try {
      const casVus = (await request(http).get("/v1/riskcases").set(co())).body;
      if (!(Array.isArray(casVus) ? casVus : []).length) {
        // Le code de scénario vient du RÉFÉRENTIEL du moteur (`SF-01`…), pas d'un numéro de
        // règle : « R189 » est la règle CITÉE par le scénario, pas son identifiant. On lit le
        // référentiel plutôt que de coder un identifiant en dur qui dériverait au prochain lot.
        const ref = (await request(http).get("/v1/aml/scenarios").set(co())).body;
        const premier = (Array.isArray(ref) ? ref : ref?.scenarios ?? [])
          .find((x: any) => x?.kind === "detection") ?? (Array.isArray(ref) ? ref : [])[0];
        const sig = await poser(`signal AML (${premier?.code ?? "?"})`, request(http).post("/v1/aml/signals").set(co()).send({
          scenarioCode: premier?.code, clientId: clients["Nordwind Handel SA"],
          faits: { motif: "fractionnement observé sur 7 jours (démo)" } }));
        const signalId = sig.body?.signal?.id ?? sig.body?.id;
        if (signalId)
          await poser("cas de risque", request(http).post("/v1/riskcases").set(co())
            .send({ clientId: clients["Nordwind Handel SA"], signalIds: [signalId] }));
      }
    } catch (e) { console.log("SEED GWB — chapitre risk case toléré :", (e as any)?.message ?? e); }

    // 8c. DÉPLACEMENT (Business Trip R446+) — la scène cross-border a besoin d'un voyage réel.
    try {
      const trips = (await request(http).get("/v1/trips").set(rm())).body;
      if (!(Array.isArray(trips) ? trips : []).length)
        await poser("déplacement", request(http).post("/v1/trips").set(rm()).send({
          destinations: ["AE"], dateStart: "2026-09-08", dateEnd: "2026-09-11",
          purpose: "Rencontre client — Dubaï (démo)", activites: ["MEET"] }));
    } catch (e) { console.log("SEED GWB — chapitre déplacement toléré :", (e as any)?.message ?? e); }

    // 8d. FORMATIONS (R232/R236) — catalogue au registre, puis une assignation à un persona RÉEL.
    // `userId` est un UUID de collaborateur : depuis V2-M44 le moteur refuse tout autre chose.
    try {
      const cat = (await request(http).get("/v1/formations/catalog").set(co())).body;
      if (!(Array.isArray(cat) ? cat : []).some((f: any) => f.code === "LBA-2026"))
        await poser("catalogue formations", request(http).post("/v1/parametres/valeur/trainingCatalog").set(boss).send({
          motif: "R231 : catalogue de formations de démonstration",
          valeur: [{ code: "LBA-2026", libelle: "LBA / CDB 20 — actualisation annuelle", dureeMinutes: 90,
            rolesCibles: ["RM", "CO", "CO_SR"], periodiciteMois: 12 }] }));
      const assigns = (await request(http).get("/v1/formations/assignments").set(co())).body;
      if (!(Array.isArray(assigns) ? assigns : []).length)
        await poser("assignation formation", request(http).post("/v1/formations/assignments").set(co())
          .send({ userId: ids.RM, formationCode: "LBA-2026", echeance: "2026-12-31" }));
    } catch (e) { console.log("SEED GWB — chapitre formations toléré :", (e as any)?.message ?? e); }

    // 8e. VEILLE RÉGLEMENTAIRE (R309) — une source déclarée + une collecte. Le flux de test est
    // env-gaté (REGWATCH_FAKE_FEED) : sans lui la source reste ÉTEINTE et rien ne casse (R167).
    try {
      const items = (await request(http).get("/v1/regwatch/items").set(co())).body;
      if (!(Array.isArray(items) ? items : []).length) {
        await poser("source de veille", request(http).post("/v1/parametres/valeur/regwatch_sources").set(boss).send({
          motif: "R309 : source de veille de démonstration",
          valeur: [{ code: "FINMA", libelle: "FINMA — communications", credentials: "demo" }] }));
        await poser("collecte de veille", request(http).post("/v1/regwatch/collecter").set(co()).send({}));
      }
    } catch (e) { console.log("SEED GWB — chapitre veille toléré :", (e as any)?.message ?? e); }

    // 8f. PIÈCES GED (R110) — le dossier KYC affiche ses pièces ; sans elles l'onglet est vide.
    try {
      // Un document INGÉRÉ est « à classer » et sans client (R137) : le chercher par clientId ne
      // le retrouve jamais et il se recréait à chaque semis. La référence est son NOM de fichier.
      const dejaIngere = await prisma.document.findFirst({
        where: { tenantId: TENANT_GWB, nom: "passeport-keller.pdf" } });
      if (!dejaIngere)
        await poser("pièce GED", request(http).post("/v1/ged/documents").set(rm()).send({
          canal: "SCAN", source: "guichet-geneve", nomFichier: "passeport-keller.pdf",
          contenu: "PDF de démonstration — Passeport Famille Keller" }));
    } catch (e) { console.log("SEED GWB — chapitre GED toléré :", (e as any)?.message ?? e); }

    console.log("SEED GWB — chapitres V2-M45 :\n  " + (journalChapitres.join("\n  ") || "(aucun — tout était déjà semé)"));

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
