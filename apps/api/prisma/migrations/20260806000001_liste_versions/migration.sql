-- R409 (L6 · P-L6-1) — versions immuables des listes ingérées. Additif, idempotent (IF NOT EXISTS),
-- non destructif (R334). RLS ENABLE+FORCE+policy posés par post-deploy-v2.sql (liste tenantée).
CREATE TABLE IF NOT EXISTS "liste_versions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "source" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "hash" TEXT NOT NULL,
  "entries" JSONB NOT NULL,
  "n_entrees" INTEGER NOT NULL,
  "delta" JSONB,
  "importe_le" TEXT NOT NULL,
  CONSTRAINT "liste_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "liste_versions_tenant_id_source_version_key" ON "liste_versions"("tenant_id", "source", "version");
CREATE INDEX IF NOT EXISTS "liste_versions_tenant_id_source_importe_le_idx" ON "liste_versions"("tenant_id", "source", "importe_le");
