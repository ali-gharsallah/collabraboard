import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { sign } from "jsonwebtoken";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/common/prisma.service";
import { KeyStore } from "../../src/modules/auth/key-store";

// Trousseau de l'application sous test : les jetons doivent être signés avec SA clé active
// (le TenantMiddleware résout la clé publique par kid — cf. rotation/JWKS).
let keys: KeyStore;

export function bearer(tid: string, sub: string, role: string): { Authorization: string } {
  const { kid, privatePem } = keys.signingKey();
  const jwt = sign({ tid, sub, role }, privatePem, { algorithm: "RS256", expiresIn: "1h", keyid: kid });
  return { Authorization: `Bearer ${jwt}` };
}

export async function boot(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix("v1");            // aligné sur main.ts
  await app.init();
  keys = app.get(KeyStore);             // ← trousseau partagé (AuthModule @Global)
  return { app, prisma: app.get(PrismaService) };
}

// Seed minimal (le user olive possède les tables → bypass RLS ; l'isolation testée est applicative).
export async function seedTenantClient(prisma: PrismaService, tid: string, clientId: string) {
  await prisma.$executeRaw`INSERT INTO tenants (id, name, created_at) VALUES (${tid}::uuid, 'GWB', NOW())
    ON CONFLICT (id) DO NOTHING`;
  await prisma.$executeRaw`INSERT INTO clients (id, tenant_id, name, structure, country, risk_level, created_at)
    VALUES (${clientId}::uuid, ${tid}::uuid, 'Suzuki Ltd', 'PP', 'CH', 'LOW', NOW())
    ON CONFLICT (id) DO NOTHING`;
}

// ── SW-14 AUTOMATISÉ (B.7 critère 3) : photo BYTE-À-BYTE des tables MÉTIER — générée depuis le
// catalogue pg_tables (jamais une liste manuelle silencieusement incomplète). Sont exclues les
// SEULES écritures licites d'un run (B.0/R264) : olivia_* (journal, registres, messages,
// propositions) + domain_events + audit_log. Toute autre table qui bouge = mutation métier. ──
export async function photoTablesMetier(prisma: PrismaService): Promise<string> {
  const exclues = (t: string) => t.startsWith("olivia_") || t === "domain_events" || t === "audit_log" || t.startsWith("_");
  const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`);
  const photo: Record<string, unknown> = {};
  for (const { tablename } of tables) {
    if (exclues(tablename)) continue;
    photo[tablename] = await prisma.$queryRawUnsafe(
      `SELECT md5(coalesce(string_agg(t.*::text, '|' ORDER BY t.*::text), 'vide')) FROM "${tablename}" t`);
  }
  return JSON.stringify(photo);
}
