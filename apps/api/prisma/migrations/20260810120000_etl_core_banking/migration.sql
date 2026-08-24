-- ETL & intégration core banking (R480→R489, spec arbitrée V2-M7).
-- Staging append-only (R482) : contrats versionnés à date (R480), lots, lignes.
-- RLS + index partiel d'idempotence R481 : prisma/post-deploy-v2.sql (modèle établi).

-- CreateTable
CREATE TABLE "etl_contrats" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "connecteur" TEXT NOT NULL,
    "famille" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "mapping" JSONB NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'TOUT_OU_RIEN',
    "en_vigueur_le" TIMESTAMP(3) NOT NULL,
    "dry_run_fait" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "etl_contrats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etl_lots" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "connecteur" TEXT NOT NULL,
    "famille" TEXT NOT NULL,
    "recu_le" TIMESTAMP(3) NOT NULL,
    "contrat_id" UUID NOT NULL,
    "contrat_version" INTEGER NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'RECU',
    "nb_source" INTEGER NOT NULL DEFAULT 0,
    "nb_valides" INTEGER NOT NULL DEFAULT 0,
    "nb_rejets" INTEGER NOT NULL DEFAULT 0,
    "nb_appliques" INTEGER NOT NULL DEFAULT 0,
    "nb_noop" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "etl_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etl_lignes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "famille" TEXT NOT NULL,
    "external_ref" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "statut" TEXT NOT NULL DEFAULT 'STAGED',
    "motif" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "etl_lignes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "etl_contrats_tenant_id_connecteur_famille_version_key" ON "etl_contrats"("tenant_id", "connecteur", "famille", "version");

-- CreateIndex
CREATE INDEX "etl_lots_tenant_id_connecteur_famille_recu_le_idx" ON "etl_lots"("tenant_id", "connecteur", "famille", "recu_le");

-- CreateIndex
CREATE INDEX "etl_lignes_tenant_id_famille_external_ref_statut_idx" ON "etl_lignes"("tenant_id", "famille", "external_ref", "statut");

-- CreateIndex
CREATE INDEX "etl_lignes_tenant_id_lot_id_idx" ON "etl_lignes"("tenant_id", "lot_id");
