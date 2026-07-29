-- Bloc B robustesse (R337/IDM) — table d'idempotence des commandes. Expand-only : nouvelle table
-- (aucune donnée touchée). Le command_id (UUID généré client) est la clé ; result_hash détecte
-- la réutilisation de clé avec un payload différent (→ 422).
CREATE TABLE "processed_commands" (
  "command_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "aggregate_id" TEXT NOT NULL,
  "result_hash" CHAR(64) NOT NULL,
  "response_snapshot" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "processed_commands_pkey" PRIMARY KEY ("command_id")
);
CREATE INDEX "processed_commands_tenant_id_created_at_idx" ON "processed_commands" ("tenant_id", "created_at");
