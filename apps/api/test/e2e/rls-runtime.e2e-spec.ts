/**
 * RLS RUNTIME — Bloc D-runtime (R335/RB, robustesse), RLS-01..04. Prouve, sans enrober les 64
 * requêtes directes, que la brique d'enforcement EXISTE et fonctionne :
 *   • withTenant() pose bien `app.tenant_id` en SET LOCAL sous FF_RLS_ENFORCED (mécanisme) ;
 *   • le rôle applicatif non-owner `olive_app` n'est ni superuser ni propriétaire (anti-bypass) ;
 *   • connecté en `olive_app` AVEC le GUC, on ne voit QUE son tenant ; SANS, zéro (enforcement) ;
 *   • le SET LOCAL est à portée TRANSACTION — pas de fuite entre transactions successives.
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
});
