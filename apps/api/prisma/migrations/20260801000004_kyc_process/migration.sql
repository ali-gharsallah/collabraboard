-- R23 (processes concurrents du dossier) — nouvelle table additive. Pas de fusion : chaque process
-- (recertification | evenement) garde son identité, son état (EN_COURS/EN_PAUSE/CLOTURE) et son
-- trail. RLS FORCE + policy tenant_isolation appliquées par prisma:post (kyc_processes ajoutée à la boucle).
CREATE TABLE IF NOT EXISTS "kyc_processes" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"           UUID NOT NULL,
  "kyc_file_id"         UUID NOT NULL,
  "type"                TEXT NOT NULL,
  "etat"                TEXT NOT NULL DEFAULT 'EN_COURS',
  "ouvert_le"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sections_revalidees" JSONB NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS "kyc_processes_tenant_id_kyc_file_id_idx" ON "kyc_processes" ("tenant_id", "kyc_file_id");
