-- CreateEnum
CREATE TYPE "Role" AS ENUM ('RM', 'ARM', 'CO', 'CO_SR', 'MLRO', 'CF', 'BRM', 'DIR', 'ADMIN');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('IN_PROGRESS', 'UNDER_REVIEW', 'VALIDATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AccessRight" AS ENUM ('HIDDEN', 'VIEW', 'EDIT', 'REQUIRED');

-- CreateEnum
CREATE TYPE "VisaStatus" AS ENUM ('PENDING', 'SIGNED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statut" TEXT DEFAULT 'BROUILLON',
    "rq_signe_par" TEXT,
    "rq_signe_at" TIMESTAMP(3),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secret" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "external_ref" TEXT,
    "name" TEXT NOT NULL,
    "structure" TEXT NOT NULL,
    "country" CHAR(2) NOT NULL,
    "risk_level" TEXT NOT NULL DEFAULT 'MEDIUM',
    "rm_user_id" UUID,
    "corr_lang" CHAR(2) NOT NULL DEFAULT 'FR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_files" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "previous_kyc_id" UUID,
    "workflow" TEXT NOT NULL,
    "risk_score" INTEGER NOT NULL,
    "risk_level" TEXT NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "created_by" UUID NOT NULL,
    "validated_by" UUID,
    "validated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handoff_phase" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "kyc_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_sections" (
    "id" UUID NOT NULL,
    "kyc_file_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,

    CONSTRAINT "kyc_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_questions" (
    "id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "answer" TEXT,
    "answered_by" UUID,
    "answered_at" TIMESTAMP(3),

    CONSTRAINT "kyc_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_access_rules" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "right" "AccessRight" NOT NULL,

    CONSTRAINT "kyc_access_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_question_history" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "previous_value" TEXT,
    "new_value" TEXT,
    "changed_by" UUID NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL,
    "hash" CHAR(64) NOT NULL,

    CONSTRAINT "kyc_question_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_visas" (
    "id" UUID NOT NULL,
    "kyc_file_id" UUID NOT NULL,
    "section_code" TEXT NOT NULL,
    "required_role" "Role" NOT NULL,
    "validateur" UUID,
    "status" "VisaStatus" NOT NULL DEFAULT 'PENDING',
    "signed_by" UUID,
    "signed_at" TIMESTAMP(3),
    "verdict" TEXT,
    "message" TEXT,

    CONSTRAINT "kyc_visas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "client_id" UUID,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'A_VALIDER',
    "code" TEXT,
    "lang" CHAR(2),
    "s3_key" TEXT,
    "sha256" CHAR(64),
    "size_bytes" INTEGER,
    "uploaded_by" UUID,
    "retention_until" TIMESTAMP(3),
    "expire_at" TIMESTAMP(3),
    "type_code" TEXT,
    "person_id" UUID,
    "kyc_file_id" UUID,
    "expiration_signalee" BOOLEAN NOT NULL DEFAULT false,
    "destruction_proposee" BOOLEAN NOT NULL DEFAULT false,
    "legal_hold" BOOLEAN NOT NULL DEFAULT false,
    "hold_motif" TEXT,
    "archive_motif" TEXT,
    "archive_par" TEXT,
    "archive_at" TIMESTAMP(3),
    "destruction_motif" TEXT,
    "destruction_par" TEXT,
    "destruction_at" TIMESTAMP(3),
    "ingere_at" TIMESTAMP(3),
    "inbox_signale" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_locks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "kyc_file_id" UUID NOT NULL,
    "holder" UUID,
    "acquired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kyc_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_lock_requests" (
    "id" UUID NOT NULL,
    "lock_id" UUID NOT NULL,
    "requester" UUID NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kyc_lock_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domain_events" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "domain_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "actor" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hash" CHAR(64) NOT NULL,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screening_runs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "liste" TEXT NOT NULL,
    "liste_version" TEXT NOT NULL,
    "seuil" INTEGER NOT NULL,
    "prefiltre" JSONB NOT NULL,
    "perimetre" INTEGER NOT NULL,
    "nb_hits" INTEGER NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screening_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screening_hits" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "run_id" UUID,
    "client_id" UUID NOT NULL,
    "entree_uid" TEXT NOT NULL,
    "entree_hash" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "liste_version" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'BRUT',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screening_hits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screening_qualifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "hit_id" UUID NOT NULL,
    "verdict" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "par" TEXT NOT NULL,
    "entree_hash" TEXT NOT NULL,
    "liste_version" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screening_qualifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persons" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "donnees" JSONB NOT NULL DEFAULT '{}',
    "etat" TEXT NOT NULL DEFAULT 'ACTIVE',
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "statut_pep" BOOLEAN NOT NULL DEFAULT false,
    "fin_mandat_pep" TIMESTAMP(3),
    "alerte_depep_emise" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_roles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "kyc_file_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_relations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "a_id" UUID NOT NULL,
    "b_id" UUID NOT NULL,
    "type_ab" TEXT NOT NULL,
    "type_ba" TEXT NOT NULL,

    CONSTRAINT "person_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mandates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "profil_requis" TEXT NOT NULL,
    "strategie" JSONB NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mandates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "mandate_id" UUID NOT NULL,
    "instrument" TEXT NOT NULL,
    "secteur" TEXT NOT NULL,
    "classe" TEXT NOT NULL,
    "valeur_chf" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pms_breaches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "mandate_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'OUVERT',
    "detecte_at" TIMESTAMP(3) NOT NULL,
    "escalade_emise" BOOLEAN NOT NULL DEFAULT false,
    "cloture_motif" TEXT,
    "cloture_par" TEXT,
    "cloture_at" TIMESTAMP(3),

    CONSTRAINT "pms_breaches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "depose_par" TEXT NOT NULL,
    "depose_at" TIMESTAMP(3) NOT NULL,
    "anchor_batch_id" UUID,
    "merkle_proof" JSONB,
    "signature" JSONB,
    "ocr_derives" JSONB NOT NULL DEFAULT '[]',
    "expiration_signalee" BOOLEAN,
    "storage_key" TEXT,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anchor_batches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "racine_merkle" CHAR(64) NOT NULL,
    "tsa_token" TEXT NOT NULL,
    "tsa_at" TIMESTAMP(3) NOT NULL,
    "nb_versions" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anchor_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboardings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "prospect_nom" TEXT NOT NULL,
    "rm_id" TEXT,
    "etape" TEXT NOT NULL DEFAULT 'PROSPECT',
    "etape_depuis" TIMESTAMP(3) NOT NULL,
    "sla_signale" BOOLEAN NOT NULL DEFAULT false,
    "kyc_file_id" UUID,
    "motif_terminal" TEXT,
    "termine_par" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboardings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_prerevues" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "kyc_file_id" UUID NOT NULL,
    "snapshot_sha256" CHAR(64) NOT NULL,
    "modele" TEXT NOT NULL,
    "prompt_version" INTEGER NOT NULL,
    "points" JSONB NOT NULL,
    "latence_ms" INTEGER NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ia_prerevues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_prompt_versions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "texte" TEXT NOT NULL,
    "par" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ia_prompt_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_param_changes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "cle" TEXT NOT NULL,
    "avant" JSONB,
    "apres" JSONB NOT NULL,
    "motif" TEXT NOT NULL,
    "par" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "effet_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_param_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mros_communications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "risk_case_id" TEXT NOT NULL,
    "client_id" UUID NOT NULL,
    "decision" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "decide_par" TEXT NOT NULL,
    "decide_at" TIMESTAMP(3) NOT NULL,
    "pieces" JSONB NOT NULL,
    "dossier_sha256" CHAR(64) NOT NULL,
    "notification" TEXT,
    "gel_actif" BOOLEAN NOT NULL DEFAULT false,
    "gel_echeance" TIMESTAMP(3),
    "gel_signale" BOOLEAN NOT NULL DEFAULT false,
    "gel_pose_par" TEXT,
    "gel_motif" TEXT,
    "gel_leve_par" TEXT,
    "gel_leve_motif" TEXT,

    CONSTRAINT "mros_communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_cases" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'NOUVELLE',
    "etat_depuis" TIMESTAMP(3) NOT NULL,
    "sla_signale" BOOLEAN NOT NULL DEFAULT false,
    "signal_ids" JSONB NOT NULL,
    "ouvert_par" TEXT NOT NULL,
    "motif_terminal" TEXT,
    "termine_par" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_case_notes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "texte" TEXT NOT NULL,
    "par" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_case_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ged_ingest_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "canal" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "operateur" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ged_ingest_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tx_verdicts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "tx_ref" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "montant_chf" DOUBLE PRECISION NOT NULL,
    "verdict" TEXT NOT NULL,
    "motif" TEXT,
    "gardes" JSONB NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "sla_signale" BOOLEAN NOT NULL DEFAULT false,
    "decide_par" TEXT,
    "revue_motif" TEXT,

    CONSTRAINT "tx_verdicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "texte" TEXT NOT NULL,
    "sha_derive_source" CHAR(64) NOT NULL,
    "type_code" TEXT,
    "statut" TEXT NOT NULL,
    "indexe_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personne_liens" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "personne_id" UUID NOT NULL,
    "type_code" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "cible_type" TEXT NOT NULL,
    "cible_id" UUID NOT NULL,
    "paire_id" UUID,
    "pose_par" TEXT NOT NULL,
    "pose_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personne_liens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annotations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "ancre" JSONB NOT NULL,
    "contenu" TEXT NOT NULL,
    "cercle" TEXT NOT NULL,
    "auteur" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caviardage_derives" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "sha_source" CHAR(64) NOT NULL,
    "sha_derive" CHAR(64) NOT NULL,
    "zones" JSONB NOT NULL,
    "statut" TEXT NOT NULL,
    "par" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "caviardage_derives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_productions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "cible" TEXT,
    "question" TEXT,
    "modele" TEXT NOT NULL,
    "version_modele" TEXT NOT NULL,
    "sha_contexte" CHAR(64) NOT NULL,
    "sha_sortie" CHAR(64) NOT NULL,
    "sortie" TEXT NOT NULL,
    "confiance" DOUBLE PRECISION,
    "par" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "decision" TEXT,
    "decide_par" TEXT,
    "decide_at" TIMESTAMP(3),
    "decision_motif" TEXT,

    CONSTRAINT "ia_productions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ged_vues" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "critere" JSONB NOT NULL,
    "cree_par" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ged_vues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_sync_lots" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "nb_lignes" INTEGER NOT NULL,
    "sha_lot" CHAR(64) NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "par" TEXT NOT NULL,

    CONSTRAINT "core_sync_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_quarantaines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "ligne" JSONB NOT NULL,
    "motif" TEXT NOT NULL,
    "statut" TEXT NOT NULL,
    "resolu_par" TEXT,
    "resolu_at" TIMESTAMP(3),

    CONSTRAINT "core_quarantaines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_defs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "statut" TEXT NOT NULL,
    "depuis_le" TEXT,
    "contenu" JSONB NOT NULL,
    "cree_par" TEXT NOT NULL,
    "publie_par" TEXT,
    "publie_at" TIMESTAMP(3),
    "motif" TEXT,

    CONSTRAINT "workflow_defs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocr_extractions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "gabarit_version" INTEGER,
    "moteur" TEXT NOT NULL,
    "champs" JSONB NOT NULL,
    "controles" JSONB NOT NULL,
    "sha_source" TEXT NOT NULL,
    "sha_derive" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocr_propositions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "extraction_id" UUID NOT NULL,
    "cible" JSONB NOT NULL,
    "champ" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,
    "confiance" DOUBLE PRECISION NOT NULL,
    "statut" TEXT NOT NULL,
    "decide_par" TEXT,
    "decide_at" TIMESTAMP(3),
    "motif_refus" TEXT,

    CONSTRAINT "ocr_propositions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_licenses" (
    "id" UUID NOT NULL,
    "instance_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "modules" JSONB NOT NULL,
    "effet_at" TEXT NOT NULL,
    "expiry" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "emis_par" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "assignee_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'OUVERTE',
    "created_at" TEXT NOT NULL,
    "done_at" TEXT,
    "client_id" UUID,
    "due_at" TEXT,
    "subject_type" TEXT,
    "subject_id" TEXT,
    "origine" TEXT,
    "completed_by" UUID,
    "complete_comment" TEXT,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_contacts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "contenu" JSONB NOT NULL,
    "origine" TEXT NOT NULL,
    "par" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aml_signals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "regle" TEXT NOT NULL,
    "niveau" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "bloquant" BOOLEAN NOT NULL DEFAULT false,
    "emis_par" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aml_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "islamic_signals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "regle" TEXT NOT NULL,
    "niveau" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "bloquant" BOOLEAN NOT NULL DEFAULT false,
    "revue_manuelle" BOOLEAN NOT NULL DEFAULT false,
    "emis_par" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "islamic_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zakat_calculations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "annee" INTEGER NOT NULL,
    "total_wealth" INTEGER NOT NULL,
    "nisab" INTEGER NOT NULL,
    "zakat_due" INTEGER NOT NULL,
    "statut" TEXT NOT NULL,
    "emis_par" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zakat_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waqf_distributions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "waqf_id" TEXT NOT NULL,
    "montant_chf" INTEGER NOT NULL,
    "income_chf" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "emis_par" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waqf_distributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mudaraba_distributions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "profit_chf" INTEGER NOT NULL,
    "bank_share" INTEGER NOT NULL,
    "client_share" INTEGER NOT NULL,
    "statut" TEXT NOT NULL,
    "emis_par" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mudaraba_distributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "formation_code" TEXT NOT NULL,
    "echeance" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "attestation_doc_id" TEXT,
    "visa_statut" TEXT,
    "vise_par" UUID,
    "vise_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "obtenue_le" TEXT NOT NULL,
    "expire_le" TEXT NOT NULL,
    "doc_id" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_attestations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "formation_code" TEXT NOT NULL,
    "doc_id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_attestations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "traveler_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "purpose" TEXT,
    "date_start" TEXT NOT NULL,
    "date_end" TEXT NOT NULL,
    "destinations" JSONB NOT NULL DEFAULT '[]',
    "clients" JSONB NOT NULL DEFAULT '[]',
    "advisories" JSONB NOT NULL DEFAULT '[]',
    "signals" JSONB NOT NULL DEFAULT '[]',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "previous_trip_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_visas" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "signed_by" UUID,
    "signed_at" TIMESTAMP(3),

    CONSTRAINT "trip_visas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nba_suggestions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contexte" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "proposition" TEXT NOT NULL,
    "facteurs" JSONB NOT NULL DEFAULT '[]',
    "statut" TEXT NOT NULL DEFAULT 'PROPOSED',
    "ttl_days" INTEGER,
    "decision" TEXT,
    "adjustment" JSONB,
    "rationale" TEXT,
    "decided_by" UUID,
    "decided_at" TEXT,
    "created_at" TEXT NOT NULL,

    CONSTRAINT "nba_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cpsi_events" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "at" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cpsi_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "clients_tenant_id_created_at_idx" ON "clients"("tenant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "clients_tenant_id_external_ref_key" ON "clients"("tenant_id", "external_ref");

-- CreateIndex
CREATE INDEX "kyc_files_tenant_id_client_id_idx" ON "kyc_files"("tenant_id", "client_id");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_files_tenant_id_code_key" ON "kyc_files"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_sections_kyc_file_id_code_key" ON "kyc_sections"("kyc_file_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_questions_section_id_code_key" ON "kyc_questions"("section_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_access_rules_question_id_role_key" ON "kyc_access_rules"("question_id", "role");

-- CreateIndex
CREATE INDEX "kyc_question_history_question_id_changed_at_idx" ON "kyc_question_history"("question_id", "changed_at");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_visas_kyc_file_id_section_code_required_role_key" ON "kyc_visas"("kyc_file_id", "section_code", "required_role");

-- CreateIndex
CREATE INDEX "documents_tenant_id_client_id_idx" ON "documents"("tenant_id", "client_id");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_locks_kyc_file_id_key" ON "kyc_locks"("kyc_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_lock_requests_lock_id_requester_key" ON "kyc_lock_requests"("lock_id", "requester");

-- CreateIndex
CREATE INDEX "domain_events_published_at_id_idx" ON "domain_events"("published_at", "id");

-- CreateIndex
CREATE INDEX "audit_log_tenant_id_at_idx" ON "audit_log"("tenant_id", "at");

-- CreateIndex
CREATE INDEX "screening_runs_tenant_id_at_idx" ON "screening_runs"("tenant_id", "at");

-- CreateIndex
CREATE INDEX "screening_hits_tenant_id_statut_idx" ON "screening_hits"("tenant_id", "statut");

-- CreateIndex
CREATE INDEX "screening_hits_tenant_id_client_id_entree_uid_idx" ON "screening_hits"("tenant_id", "client_id", "entree_uid");

-- CreateIndex
CREATE UNIQUE INDEX "screening_qualifications_hit_id_key" ON "screening_qualifications"("hit_id");

-- CreateIndex
CREATE INDEX "screening_qualifications_tenant_id_entree_hash_verdict_idx" ON "screening_qualifications"("tenant_id", "entree_hash", "verdict");

-- CreateIndex
CREATE INDEX "persons_tenant_id_etat_idx" ON "persons"("tenant_id", "etat");

-- CreateIndex
CREATE INDEX "persons_tenant_id_statut_pep_idx" ON "persons"("tenant_id", "statut_pep");

-- CreateIndex
CREATE INDEX "person_roles_tenant_id_person_id_idx" ON "person_roles"("tenant_id", "person_id");

-- CreateIndex
CREATE INDEX "person_roles_tenant_id_kyc_file_id_idx" ON "person_roles"("tenant_id", "kyc_file_id");

-- CreateIndex
CREATE INDEX "person_relations_tenant_id_a_id_idx" ON "person_relations"("tenant_id", "a_id");

-- CreateIndex
CREATE INDEX "person_relations_tenant_id_b_id_idx" ON "person_relations"("tenant_id", "b_id");

-- CreateIndex
CREATE INDEX "mandates_tenant_id_client_id_idx" ON "mandates"("tenant_id", "client_id");

-- CreateIndex
CREATE INDEX "positions_tenant_id_mandate_id_idx" ON "positions"("tenant_id", "mandate_id");

-- CreateIndex
CREATE INDEX "pms_breaches_tenant_id_statut_idx" ON "pms_breaches"("tenant_id", "statut");

-- CreateIndex
CREATE INDEX "document_versions_tenant_id_document_id_idx" ON "document_versions"("tenant_id", "document_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_tenant_id_document_id_numero_key" ON "document_versions"("tenant_id", "document_id", "numero");

-- CreateIndex
CREATE INDEX "anchor_batches_tenant_id_idx" ON "anchor_batches"("tenant_id");

-- CreateIndex
CREATE INDEX "onboardings_tenant_id_etape_idx" ON "onboardings"("tenant_id", "etape");

-- CreateIndex
CREATE INDEX "ia_prerevues_tenant_id_kyc_file_id_idx" ON "ia_prerevues"("tenant_id", "kyc_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "ia_prompt_versions_tenant_id_numero_key" ON "ia_prompt_versions"("tenant_id", "numero");

-- CreateIndex
CREATE INDEX "tenant_param_changes_tenant_id_cle_idx" ON "tenant_param_changes"("tenant_id", "cle");

-- CreateIndex
CREATE INDEX "mros_communications_tenant_id_client_id_gel_actif_idx" ON "mros_communications"("tenant_id", "client_id", "gel_actif");

-- CreateIndex
CREATE UNIQUE INDEX "mros_communications_tenant_id_risk_case_id_key" ON "mros_communications"("tenant_id", "risk_case_id");

-- CreateIndex
CREATE INDEX "risk_cases_tenant_id_statut_idx" ON "risk_cases"("tenant_id", "statut");

-- CreateIndex
CREATE INDEX "risk_case_notes_tenant_id_case_id_idx" ON "risk_case_notes"("tenant_id", "case_id");

-- CreateIndex
CREATE INDEX "ged_ingest_entries_tenant_id_document_id_idx" ON "ged_ingest_entries"("tenant_id", "document_id");

-- CreateIndex
CREATE INDEX "tx_verdicts_tenant_id_client_id_type_at_idx" ON "tx_verdicts"("tenant_id", "client_id", "type", "at");

-- CreateIndex
CREATE INDEX "tx_verdicts_tenant_id_verdict_idx" ON "tx_verdicts"("tenant_id", "verdict");

-- CreateIndex
CREATE INDEX "search_entries_tenant_id_idx" ON "search_entries"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "search_entries_tenant_id_document_id_key" ON "search_entries"("tenant_id", "document_id");

-- CreateIndex
CREATE INDEX "personne_liens_tenant_id_cible_type_cible_id_idx" ON "personne_liens"("tenant_id", "cible_type", "cible_id");

-- CreateIndex
CREATE UNIQUE INDEX "personne_liens_tenant_id_personne_id_type_code_cible_type_c_key" ON "personne_liens"("tenant_id", "personne_id", "type_code", "cible_type", "cible_id");

-- CreateIndex
CREATE INDEX "annotations_tenant_id_document_id_idx" ON "annotations"("tenant_id", "document_id");

-- CreateIndex
CREATE INDEX "caviardage_derives_tenant_id_document_id_idx" ON "caviardage_derives"("tenant_id", "document_id");

-- CreateIndex
CREATE INDEX "ia_productions_tenant_id_cible_idx" ON "ia_productions"("tenant_id", "cible");

-- CreateIndex
CREATE UNIQUE INDEX "ged_vues_tenant_id_code_key" ON "ged_vues"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "core_sync_lots_tenant_id_type_idx" ON "core_sync_lots"("tenant_id", "type");

-- CreateIndex
CREATE INDEX "core_quarantaines_tenant_id_statut_idx" ON "core_quarantaines"("tenant_id", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_defs_tenant_id_code_version_key" ON "workflow_defs"("tenant_id", "code", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ocr_extractions_version_id_gabarit_version_key" ON "ocr_extractions"("version_id", "gabarit_version");

-- CreateIndex
CREATE INDEX "tasks_tenant_id_assignee_id_idx" ON "tasks"("tenant_id", "assignee_id");

-- CreateIndex
CREATE INDEX "aml_signals_tenant_id_client_id_idx" ON "aml_signals"("tenant_id", "client_id");

-- CreateIndex
CREATE INDEX "islamic_signals_tenant_id_client_id_idx" ON "islamic_signals"("tenant_id", "client_id");

-- CreateIndex
CREATE INDEX "zakat_calculations_tenant_id_client_id_annee_idx" ON "zakat_calculations"("tenant_id", "client_id", "annee");

-- CreateIndex
CREATE INDEX "waqf_distributions_tenant_id_waqf_id_idx" ON "waqf_distributions"("tenant_id", "waqf_id");

-- CreateIndex
CREATE INDEX "mudaraba_distributions_tenant_id_client_id_idx" ON "mudaraba_distributions"("tenant_id", "client_id");

-- CreateIndex
CREATE INDEX "training_assignments_tenant_id_user_id_idx" ON "training_assignments"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "certifications_tenant_id_user_id_code_idx" ON "certifications"("tenant_id", "user_id", "code");

-- CreateIndex
CREATE INDEX "training_attestations_tenant_id_user_id_idx" ON "training_attestations"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "trips_tenant_id_traveler_id_idx" ON "trips"("tenant_id", "traveler_id");

-- CreateIndex
CREATE INDEX "trip_visas_tenant_id_trip_id_idx" ON "trip_visas"("tenant_id", "trip_id");

-- CreateIndex
CREATE INDEX "nba_suggestions_tenant_id_subject_id_idx" ON "nba_suggestions"("tenant_id", "subject_id");

-- CreateIndex
CREATE INDEX "cpsi_events_tenant_id_id_idx" ON "cpsi_events"("tenant_id", "id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_files" ADD CONSTRAINT "kyc_files_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_files" ADD CONSTRAINT "kyc_files_previous_kyc_id_fkey" FOREIGN KEY ("previous_kyc_id") REFERENCES "kyc_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_sections" ADD CONSTRAINT "kyc_sections_kyc_file_id_fkey" FOREIGN KEY ("kyc_file_id") REFERENCES "kyc_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_questions" ADD CONSTRAINT "kyc_questions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "kyc_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_access_rules" ADD CONSTRAINT "kyc_access_rules_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "kyc_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_question_history" ADD CONSTRAINT "kyc_question_history_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "kyc_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_visas" ADD CONSTRAINT "kyc_visas_kyc_file_id_fkey" FOREIGN KEY ("kyc_file_id") REFERENCES "kyc_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_locks" ADD CONSTRAINT "kyc_locks_kyc_file_id_fkey" FOREIGN KEY ("kyc_file_id") REFERENCES "kyc_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_lock_requests" ADD CONSTRAINT "kyc_lock_requests_lock_id_fkey" FOREIGN KEY ("lock_id") REFERENCES "kyc_locks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screening_hits" ADD CONSTRAINT "screening_hits_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "screening_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screening_qualifications" ADD CONSTRAINT "screening_qualifications_hit_id_fkey" FOREIGN KEY ("hit_id") REFERENCES "screening_hits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_roles" ADD CONSTRAINT "person_roles_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_mandate_id_fkey" FOREIGN KEY ("mandate_id") REFERENCES "mandates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

