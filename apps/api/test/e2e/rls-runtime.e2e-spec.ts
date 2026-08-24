/**
 * RLS RUNTIME — Bloc D-runtime (R335/RB, robustesse), RLS-01..06. Prouve, sans enrober les 64
 * requêtes directes, que la brique d'enforcement EXISTE et fonctionne :
 *   • withTenant() pose bien `app.tenant_id` en SET LOCAL sous FF_RLS_ENFORCED (mécanisme) ;
 *   • le rôle applicatif non-owner `olive_app` n'est ni superuser ni propriétaire (anti-bypass) ;
 *   • connecté en `olive_app` AVEC le GUC, on ne voit QUE son tenant ; SANS, zéro (enforcement) ;
 *   • le SET LOCAL est à portée TRANSACTION — pas de fuite entre transactions successives ;
 *   • RLS-05 : isolation CROISÉE A/B sur clients, kyc_files, persons, domain_events, documents ;
 *   • RLS-06 : isolation TRANSITIVE (policy FK-subquery) des 6 tables filles KYC SANS tenant_id
 *     (kyc_sections, kyc_questions, kyc_access_rules, kyc_question_history, kyc_visas,
 *      kyc_lock_requests) — cf. post-deploy-v2.sql §2a-bis, docs/rls-coverage-audit.md §3.
 * L'activation prod (bascule DATABASE_URL → olive_app) est un acte de déploiement (docs/multi-tenancy.md).
 */
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, seedTenantClient } from "./util";

const URL_OWNER = process.env.DATABASE_URL ?? "postgresql://olive:olive@localhost:5433/olive_test";
const URL_APP = URL_OWNER.replace("olive:olive@", "olive_app:olive_app@");   // rôle non-owner (post-deploy)

describe("RLS RUNTIME — enforcement prouvé (Bloc D-runtime)", () => {
  let app: INestApplication; let prisma: PrismaService; let appClient: PrismaClient;
  const A = randomUUID(), B = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    for (let i = 0; i < 2; i++) await seedTenantClient(prisma, A, randomUUID());   // 2 clients tenant A
    for (let i = 0; i < 3; i++) await seedTenantClient(prisma, B, randomUUID());   // 3 clients tenant B
    appClient = new PrismaClient({ datasources: { db: { url: URL_APP } } });
  });
  afterAll(async () => { await appClient.$disconnect(); await app.close(); delete process.env.FF_RLS_ENFORCED; });

  it("RLS-01 mécanisme : withTenant pose app.tenant_id (SET LOCAL) sous FF_RLS_ENFORCED, sinon non", async () => {
    process.env.FF_RLS_ENFORCED = "on";
    const vuOn = await prisma.withTenant(A, async (tx) => {
      const r = await tx.$queryRaw<{ v: string | null }[]>`SELECT current_setting('app.tenant_id', true) AS v`;
      return r[0].v;
    });
    expect(vuOn).toBe(A);                                             // le GUC est posé dans la tx
    delete process.env.FF_RLS_ENFORCED;
    const vuOff = await prisma.withTenant(A, async (tx) => {
      const r = await tx.$queryRaw<{ v: string | null }[]>`SELECT current_setting('app.tenant_id', true) AS v`;
      return r[0].v;
    });
    expect(vuOff === null || vuOff === "").toBe(true);               // legacy : aucun GUC posé
  });

  it("RLS-02 anti-bypass : le rôle applicatif olive_app n'est ni superuser ni propriétaire des tables", async () => {
    const role = await prisma.$queryRaw<{ super: boolean; byp: boolean }[]>`
      SELECT rolsuper AS super, rolbypassrls AS byp FROM pg_roles WHERE rolname = 'olive_app'`;
    expect(role[0]).toMatchObject({ super: false, byp: false });
    const own = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public' AND tableowner='olive_app'`;
    expect(own[0].n).toBe(0);                                        // olive_app ne possède AUCUNE table
  });

  it("RLS-03 enforcement : en olive_app, AVEC le GUC on ne voit QUE son tenant ; SANS, zéro", async () => {
    const sansGuc = await appClient.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM clients`;
    expect(sansGuc[0].n).toBe(0);                                    // pas de GUC → RLS masque tout (recette 4b)
    const vuA = await appClient.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${A}, true)`;
      return (await tx.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM clients`)[0].n;
    });
    expect(vuA).toBe(2);                                             // tenant A : ses 2 clients
    const vuB = await appClient.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${B}, true)`;
      return (await tx.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM clients`)[0].n;
    });
    expect(vuB).toBe(3);                                             // tenant B : ses 3 clients, jamais ceux de A
  });

  it("RLS-04 pas de fuite : hors de sa transaction scopée, olive_app ne voit JAMAIS le tenant précédent", async () => {
    await appClient.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${A}, true)`;   // scopé A dans la tx
    });
    // Le SET LOCAL est retombé (portée transaction). Une requête BARE (hors withTenant) ne doit
    // JAMAIS voir les lignes de A : soit 0 (GUC NULL), soit un REJET (sur une connexion réutilisée
    // du pool, le GUC retombe à '' et `''::uuid` de la policy rejette). Les deux = aucune fuite.
    // Durcissement recommandé à l'activation (docs/multi-tenancy.md) : policy `NULLIF(current_setting
    // ('app.tenant_id', true), '')::uuid` → 0 ligne au lieu du rejet ; et n'accéder à la DB QUE via
    // withTenant (jamais de requête bare en mode enforced).
    let fuite = 0;
    try { fuite = (await appClient.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM clients`)[0].n; }
    catch { fuite = 0; }                                             // rejet du cast ''::uuid = aucune fuite
    expect(fuite).toBe(0);                                           // JAMAIS les 2 lignes de A
  });

  // ── RLS-05/06 : isolation CROISÉE prouvée en base (olive_app + GUC) ─────────────────────
  // Tenants DÉDIÉS (GA/GB) pour ne pas perturber les comptes 2/3 de RLS-03. Chaque tenant reçoit
  // un graphe marqué `RLS-A` / `RLS-B` : un client, un dossier, une personne, un événement, un
  // document, ET la chaîne fille KYC complète (section→question→règle→historique, visa, verrou→demande).
  describe("RLS-05/06 — isolation croisée & transitive (olive_app)", () => {
    const GA = randomUUID(), GB = randomUUID();
    let gA: Awaited<ReturnType<typeof seedTenantGraph>>;
    let gB: Awaited<ReturnType<typeof seedTenantGraph>>;

    // Le seed passe par `prisma` (rôle owner olive) : bypass RLS → insertion libre des filles.
    async function seedTenantGraph(db: PrismaService, tid: string, suf: string) {
      const clientId = randomUUID(), kycFileId = randomUUID(), sectionId = randomUUID(),
        questionId = randomUUID(), lockId = randomUUID();
      const M = `RLS-${suf}`;
      await db.$executeRaw`INSERT INTO tenants (id, name, created_at) VALUES (${tid}::uuid, 'GWB', NOW()) ON CONFLICT (id) DO NOTHING`;
      await db.$executeRaw`INSERT INTO clients (id, tenant_id, name, structure, country, risk_level, created_at)
        VALUES (${clientId}::uuid, ${tid}::uuid, ${M}, 'PP', 'CH', 'LOW', NOW())`;
      await db.$executeRaw`INSERT INTO kyc_files (id, tenant_id, client_id, code, year, country_code, sequence, workflow, risk_score, risk_level, created_by)
        VALUES (${kycFileId}::uuid, ${tid}::uuid, ${clientId}::uuid, ${M}, 2026, 'CH', 1, 'STD', 10, 'LOW', ${randomUUID()}::uuid)`;
      await db.$executeRaw`INSERT INTO persons (id, tenant_id, nom) VALUES (${randomUUID()}::uuid, ${tid}::uuid, ${M})`;
      await db.$executeRaw`INSERT INTO domain_events (tenant_id, type, aggregate_id, payload, at)
        VALUES (${tid}::uuid, ${M}, ${kycFileId}, '{}'::jsonb, NOW())`;
      await db.$executeRaw`INSERT INTO documents (id, tenant_id, name) VALUES (${randomUUID()}::uuid, ${tid}::uuid, ${M})`;
      // ── Chaîne fille KYC (aucune colonne tenant_id) : isolée par FK-subquery (§2a-bis) ──
      await db.$executeRaw`INSERT INTO kyc_sections (id, kyc_file_id, code, label, order_index)
        VALUES (${sectionId}::uuid, ${kycFileId}::uuid, ${M}, 'Section', 0)`;
      await db.$executeRaw`INSERT INTO kyc_questions (id, section_id, code, label)
        VALUES (${questionId}::uuid, ${sectionId}::uuid, ${M}, 'Q')`;
      await db.$executeRaw`INSERT INTO kyc_access_rules (id, question_id, role, "right", effective_from)
        VALUES (${randomUUID()}::uuid, ${questionId}::uuid, 'CO'::"Role", 'VIEW'::"AccessRight", NOW())`;
      await db.$executeRaw`INSERT INTO kyc_question_history (id, question_id, changed_by, changed_at, hash)
        VALUES (${randomUUID()}::uuid, ${questionId}::uuid, ${randomUUID()}::uuid, NOW(), ${"0".repeat(64)})`;
      await db.$executeRaw`INSERT INTO kyc_visas (id, kyc_file_id, section_code, required_role, status)
        VALUES (${randomUUID()}::uuid, ${kycFileId}::uuid, ${M}, 'RM'::"Role", 'PENDING'::"VisaStatus")`;
      await db.$executeRaw`INSERT INTO kyc_locks (id, tenant_id, kyc_file_id)
        VALUES (${lockId}::uuid, ${tid}::uuid, ${kycFileId}::uuid)`;
      await db.$executeRaw`INSERT INTO kyc_lock_requests (id, lock_id, requester)
        VALUES (${randomUUID()}::uuid, ${lockId}::uuid, ${randomUUID()}::uuid)`;
      return { clientId, kycFileId, sectionId, questionId, lockId };
    }

    // Compte, connecté en olive_app, DANS une transaction scopée au tenant `tid` (SET LOCAL).
    // `sql` n'utilise que des noms de tables/colonnes constants + marqueurs contrôlés (pas d'injection).
    async function countAs(tid: string, sql: string): Promise<number> {
      return appClient.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tid}, true)`;
        const r = await tx.$queryRawUnsafe<{ n: number }[]>(sql);
        return Number(r[0].n);
      });
    }

    beforeAll(async () => {
      gA = await seedTenantGraph(prisma, GA, "A");
      gB = await seedTenantGraph(prisma, GB, "B");
    });

    it("RLS-05 : clients/kyc_files/persons/domain_events/documents — chaque marqueur n'est vu QUE sous son tenant", async () => {
      const tables: Array<[string, string]> = [
        ["clients", "name"], ["kyc_files", "code"], ["persons", "nom"],
        ["domain_events", "type"], ["documents", "name"],
      ];
      for (const [t, col] of tables) {
        expect(await countAs(GA, `SELECT count(*)::int AS n FROM ${t} WHERE ${col}='RLS-A'`)).toBe(1); // A voit A
        expect(await countAs(GB, `SELECT count(*)::int AS n FROM ${t} WHERE ${col}='RLS-A'`)).toBe(0); // B ne voit PAS A
        expect(await countAs(GB, `SELECT count(*)::int AS n FROM ${t} WHERE ${col}='RLS-B'`)).toBe(1); // B voit B
        expect(await countAs(GA, `SELECT count(*)::int AS n FROM ${t} WHERE ${col}='RLS-B'`)).toBe(0); // A ne voit PAS B
      }
    });

    it("RLS-06 : les 6 tables filles KYC (sans tenant_id) sont isolées transitivement par FK-subquery", async () => {
      // Chaque table fille, filtrée sur une ligne appartenant au dossier de A : visible sous GA, jamais sous GB.
      const cas: Array<[string, string]> = [
        ["kyc_sections", `code='RLS-A'`],
        ["kyc_questions", `code='RLS-A'`],
        ["kyc_visas", `section_code='RLS-A'`],
        ["kyc_access_rules", `question_id='${gA.questionId}'`],
        ["kyc_question_history", `question_id='${gA.questionId}'`],
        ["kyc_lock_requests", `lock_id='${gA.lockId}'`],
      ];
      for (const [t, where] of cas) {
        expect(await countAs(GA, `SELECT count(*)::int AS n FROM ${t} WHERE ${where}`)).toBe(1); // A voit sa fille
        expect(await countAs(GB, `SELECT count(*)::int AS n FROM ${t} WHERE ${where}`)).toBe(0); // B, jamais
      }
      // Symétrie : les filles de B sont vues sous GB, pas sous GA.
      const casB: Array<[string, string]> = [
        ["kyc_sections", `code='RLS-B'`],
        ["kyc_access_rules", `question_id='${gB.questionId}'`],
        ["kyc_lock_requests", `lock_id='${gB.lockId}'`],
      ];
      for (const [t, where] of casB) {
        expect(await countAs(GB, `SELECT count(*)::int AS n FROM ${t} WHERE ${where}`)).toBe(1);
        expect(await countAs(GA, `SELECT count(*)::int AS n FROM ${t} WHERE ${where}`)).toBe(0);
      }
    });
  });
});
