-- RÉCONCILIATION DE LA DÉRIVE `db push` (R334) — capture en MIGRATION ce qui vivait dans schema.prisma
-- mais n'avait jamais été versionné : ces objets furent créés par `prisma db push` au fil des blocs
-- (R282 doc_matrix_versions ; AML Gap bloc 50 : aml_scenarios/aml_gap_signals/ground_truth_cases/
-- ubo_groups + screening_hits.channel/match_script). Sans cette migration, un `migrate deploy` sur
-- base FRAÎCHE (CI, prod) bâtit un schéma que l'app ne peut pas utiliser (500 : colonne absente) —
-- c'est la cause racine de l'e2e non reproductible en CI. 100 % additif ; IF NOT EXISTS partout pour
-- rester idempotent contre les bases déjà « db push »-ées (olive_test, staging). Aucun DROP de donnée.

-- kyc_processes.id : le défaut DB est retiré (l'app fournit l'uuid) — aligne la base sur schema.prisma.
ALTER TABLE "kyc_processes" ALTER COLUMN "id" DROP DEFAULT;

-- screening_hits : discriminants AML Gap (bloc 50 / R345) — canal du signal + script normalisé du match.
ALTER TABLE "screening_hits" ADD COLUMN IF NOT EXISTS "channel" TEXT;
ALTER TABLE "screening_hits" ADD COLUMN IF NOT EXISTS "match_script" TEXT;

-- R282 — matrice de droits versionnée (grandfathering des visas par date d'effet).
CREATE TABLE IF NOT EXISTS "doc_matrix_versions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "en_vigueur_le" TIMESTAMP(3) NOT NULL,
    "contenu" JSONB NOT NULL,
    "publie_par" TEXT NOT NULL,
    "publie_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "doc_matrix_versions_pkey" PRIMARY KEY ("id")
);

-- AML Gap — référentiel des scénarios (versionné, effet daté, params/i18n).
CREATE TABLE IF NOT EXISTS "aml_scenarios" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "rule_ref" TEXT NOT NULL,
    "fam" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "i18n" JSONB,
    "niveau" INTEGER,
    "blocking" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "aml_scenarios_pkey" PRIMARY KEY ("id")
);

-- AML Gap — signaux émis (idempotents par idem_key, statut/outcome tracés).
CREATE TABLE IF NOT EXISTS "aml_gap_signals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "scenario_code" TEXT NOT NULL,
    "scenario_ver" INTEGER NOT NULL,
    "rule_ref" TEXT NOT NULL,
    "client_id" UUID,
    "ubo_group_id" UUID,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "niveau" INTEGER,
    "blocking" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "outcome" TEXT,
    "motif" TEXT,
    "idem_key" TEXT NOT NULL,
    "emis_par" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "aml_gap_signals_pkey" PRIMARY KEY ("id")
);

-- AML Gap — vérité terrain (jeu d'évaluation des détecteurs).
CREATE TABLE IF NOT EXISTS "ground_truth_cases" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "case_id" TEXT NOT NULL,
    "scenario_code" TEXT NOT NULL,
    "rule_ref" TEXT NOT NULL,
    "fam" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "client_id" UUID,
    "narrative" TEXT NOT NULL,
    "ecartement" TEXT,
    "payload" JSONB,
    CONSTRAINT "ground_truth_cases_pkey" PRIMARY KEY ("id")
);

-- AML Gap — groupes UBO (agrégation des clients partageant un ayant droit économique).
CREATE TABLE IF NOT EXISTS "ubo_groups" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ubo_person_id" UUID NOT NULL,
    "member_client_ids" UUID[],
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ubo_groups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "doc_matrix_versions_tenant_id_en_vigueur_le_idx" ON "doc_matrix_versions"("tenant_id", "en_vigueur_le");
CREATE UNIQUE INDEX IF NOT EXISTS "doc_matrix_versions_tenant_id_version_key" ON "doc_matrix_versions"("tenant_id", "version");
CREATE INDEX IF NOT EXISTS "aml_scenarios_tenant_id_code_effective_from_idx" ON "aml_scenarios"("tenant_id", "code", "effective_from");
CREATE UNIQUE INDEX IF NOT EXISTS "aml_scenarios_tenant_id_code_version_key" ON "aml_scenarios"("tenant_id", "code", "version");
CREATE INDEX IF NOT EXISTS "aml_gap_signals_tenant_id_status_idx" ON "aml_gap_signals"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "aml_gap_signals_tenant_id_client_id_idx" ON "aml_gap_signals"("tenant_id", "client_id");
CREATE UNIQUE INDEX IF NOT EXISTS "aml_gap_signals_tenant_id_idem_key_key" ON "aml_gap_signals"("tenant_id", "idem_key");
CREATE INDEX IF NOT EXISTS "ground_truth_cases_tenant_id_scenario_code_idx" ON "ground_truth_cases"("tenant_id", "scenario_code");
CREATE UNIQUE INDEX IF NOT EXISTS "ground_truth_cases_tenant_id_case_id_key" ON "ground_truth_cases"("tenant_id", "case_id");
CREATE INDEX IF NOT EXISTS "ubo_groups_tenant_id_ubo_person_id_idx" ON "ubo_groups"("tenant_id", "ubo_person_id");
