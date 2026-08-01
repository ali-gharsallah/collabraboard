-- ════════════════════════════════════════════════════════════════════════════
-- post-deploy v2 — RLS RÉELLE + immuabilité complète (2026-07-19)
-- Comble les deux écarts de conformité constatés au pré-vol :
--   (1) RLS inerte : ENABLE sans FORCE, connexion en propriétaire (bypass),
--       GUC app.tenant_id jamais posé → seule l'isolation applicative agissait.
--   (2) Triggers d'immuabilité jamais créés en CI, et absents des nouvelles
--       tables screening.
-- À exécuter via `prisma:post` (CI et local) APRÈS `prisma db push`.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 0. Fonction d'immuabilité (idempotent) ──────────────────────────────────
CREATE OR REPLACE FUNCTION audit_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'append-only: % interdit sur %', TG_OP, TG_TABLE_NAME;
END; $$ LANGUAGE plpgsql;

-- ── 1. Immuabilité append-only (R48) — TOUTES les tables de journal ─────────
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'kyc_question_history', 'audit_log', 'domain_events',
    'screening_runs', 'screening_qualifications',         -- R103 · R101/R102
    'document_versions',                                  -- R109/R111 (GED)
    'anchor_batches',                                     -- R113 (ancrage — jamais d'UPDATE)
    'ia_prompt_versions',                                 -- R124 (le prompt est une règle : registre append-only)
    'tenant_param_changes',                               -- R126 (un paramètre est une règle)
    'risk_case_notes',                                    -- R134 (l'instruction append-only)
    'aml_signals',                                        -- R189→R206 (le signal AML est un fait)
    'islamic_signals',                                    -- R207→R221 (le signal Shariah est un fait)
    'zakat_calculations', 'waqf_distributions', 'mudaraba_distributions', -- R211/R215/R218 (ledgers Shariah, append-only)
    'certifications', 'training_attestations',            -- R234 (MOD-43 : certifs & attestations append-only)
    'cpsi_events',                                        -- CPSI porte (R63→R83 : journal append-only, source d'état)
    'olivia_messages',                                    -- Olivia R257 : le journal de conversation est append-only
    'olivia_agents',                                      -- Olivia v2 R259 : modifier = nouvelle version, JAMAIS une mutation
    'olivia_run_events',                                  -- Olivia v2 R260/R265 : LE journal du run — append-only
    'coc_config_versions',                                 -- R276/R68 : la config CoC est un registre versionné, append-only
    'transactions',                                        -- R297 (dégel V1) : LE journal transactionnel canonique, append-only
    'builder_versions'                                    -- R304 (dégel V3) : les versions publiées du Builder, gravées
  ] LOOP
    IF to_regclass(t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I_no_update ON %I', t, t);
      EXECUTE format('CREATE TRIGGER %I_no_update BEFORE UPDATE OR DELETE ON %I
                      FOR EACH ROW EXECUTE FUNCTION audit_immutable()', t, t);
    END IF;
  END LOOP;
END $$;
-- Note domain_events : le worker met à jour published_at → exception ciblée :
DROP TRIGGER IF EXISTS domain_events_no_update ON domain_events;
CREATE OR REPLACE FUNCTION outbox_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'append-only: DELETE interdit sur domain_events'; END IF;
  -- Seul published_at peut changer ; le corps de l'événement est immuable.
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.aggregate_id IS DISTINCT FROM OLD.aggregate_id OR NEW.payload IS DISTINCT FROM OLD.payload THEN
    RAISE EXCEPTION 'append-only: seul published_at est mutable sur domain_events';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
-- FIX 2026-07-19 : idempotence — sans ce DROP, un 2e passage de prisma:post échouait
-- (« trigger domain_events_guard already exists »). CI = base neuve à chaque run donc masqué ;
-- en local / bascule 2-temps sur base persistante, prisma:post doit rester re-jouable.
DROP TRIGGER IF EXISTS domain_events_guard ON domain_events;
CREATE TRIGGER domain_events_guard BEFORE UPDATE OR DELETE ON domain_events
  FOR EACH ROW EXECUTE FUNCTION outbox_guard();

-- ── tx_verdicts (R140→R143) : PAS d'append-only strict (la revue R143 écrit la décision) ──
-- Les FAITS ne se réécrivent jamais ; seule la DÉCISION de revue s'écrit UNE fois, depuis SUSPEND.
-- DELETE toujours interdit (le verdict se rejoue, R48/R49). sla_signale reste librement mutable (R39).
CREATE OR REPLACE FUNCTION tx_verdict_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'tx_verdicts : DELETE interdit (R140 : le verdict se rejoue, ne se supprime pas)';
  END IF;
  -- Faits immuables (jamais réécrits)
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.client_id  IS DISTINCT FROM OLD.client_id
     OR NEW.tx_ref     IS DISTINCT FROM OLD.tx_ref
     OR NEW.type       IS DISTINCT FROM OLD.type
     OR NEW.montant_chf IS DISTINCT FROM OLD.montant_chf
     OR NEW.gardes     IS DISTINCT FROM OLD.gardes
     OR NEW.motif      IS DISTINCT FROM OLD.motif
     OR NEW.at         IS DISTINCT FROM OLD.at THEN
    RAISE EXCEPTION 'tx_verdicts : faits immuables (tx_ref/type/montant_chf/gardes/motif/at) — R140';
  END IF;
  -- Décision de revue : uniquement depuis un verdict SUSPEND, une seule fois (R143)
  IF (NEW.verdict IS DISTINCT FROM OLD.verdict
      OR NEW.decide_par  IS DISTINCT FROM OLD.decide_par
      OR NEW.revue_motif IS DISTINCT FROM OLD.revue_motif)
     AND OLD.verdict <> 'SUSPEND' THEN
    RAISE EXCEPTION 'tx_verdicts : la décision de revue ne s''écrit qu''une fois, sur une transaction SUSPEND (R143)';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS tx_verdict_guard ON tx_verdicts;
CREATE TRIGGER tx_verdict_guard BEFORE UPDATE OR DELETE ON tx_verdicts
  FOR EACH ROW EXECUTE FUNCTION tx_verdict_guard();

-- ── 2. RLS RÉELLE : FORCE + policies sur toutes les tables tenantées ────────
-- FIX 2026-07-19 : la policy tenant_isolation est basée sur la colonne tenant_id.
-- 6 tables enfant du dossier n'ont PAS de colonne tenant_id dans le schéma
-- (kyc_sections, kyc_questions, kyc_access_rules, kyc_question_history, kyc_visas,
--  kyc_lock_requests) : leur créer une policy `tenant_id = …` levait
-- « column "tenant_id" does not exist » et faisait échouer TOUT le bloc → RLS inerte.
-- On n'applique donc ENABLE/FORCE/policy qu'aux tables réellement tenantées
-- (présence de la colonne). Les tables enfant restent isolées transitivement via
-- leur parent tenanté (FK) + le filtrage applicatif — même traitement que
-- kyc_lock_requests recevait déjà en v1. Écart schéma signalé, sémantique inchangée.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients', 'users', 'kyc_files', 'kyc_sections', 'kyc_questions',
    'kyc_access_rules', 'kyc_question_history', 'kyc_visas', 'kyc_locks',
    'kyc_lock_requests', 'documents', 'domain_events', 'audit_log',
    'screening_runs', 'screening_hits', 'screening_qualifications',
    'persons', 'person_roles', 'person_relations',
    'mandates', 'positions', 'pms_breaches', 'document_versions', 'anchor_batches',
    'onboardings',                                        -- R117→R120 (bloc 19, tenantée)
    'kyc_processes',                                      -- R23 (processes concurrents du dossier, tenantée)
    'doc_matrix_versions',                                -- R26/R27/R29 (matrice documentaire versionnée, tenantée)
    'ia_prerevues', 'ia_prompt_versions',                 -- R121→R124 (bloc 20, tenantées)
    'tenant_param_changes',                               -- R125→R128 (bloc 21)
    'mros_communications',                                -- R129→R132 (bloc 22)
    'risk_cases', 'risk_case_notes',                      -- R133→R136 (bloc 23)
    'ged_ingest_entries',                                 -- R137→R139 (bloc 24, capture & ingestion)
    'tx_verdicts',                                        -- R140→R143 (bloc 25, portail transactionnel)
    'search_entries',                                     -- R148→R151 (bloc 27, la recherche)
    'personne_liens',                                     -- R152→R155 (bloc 28, personnes liées)
    'annotations', 'caviardage_derives',                  -- R156→R159 (bloc 29, annotations & caviardage)
    'ia_productions',                                     -- R160→R163 (bloc 31, IA au service du dossier)
    'ged_vues',                                           -- R164→R166 (bloc 32, dossiers-vues)
    'core_sync_lots', 'core_quarantaines',                -- R167→R169 (lot 33, core banking en port)
    'workflow_defs',                                      -- R171→R173 (lot 34, workflow gouverné)
    'ocr_extractions', 'ocr_propositions',                -- R174→R176 (lot 36, OCR typé)
    'tasks',                                              -- R183→R185 (lot 39, capacité équipe)
    'crm_contacts',                                       -- R186→R188 (lot 40, CRM relation)
    'aml_signals',                                        -- R189→R206 (lot 48, surveillance AML)
    'islamic_signals',                                    -- R207→R221 (lot 49, couche Shariah)
    'zakat_calculations', 'waqf_distributions', 'mudaraba_distributions', -- R211/R215/R218 (lot 49b, ledgers Shariah)
    'training_assignments', 'certifications', 'training_attestations', -- R231→R238 (lot 50, MOD-43 formations)
    'trips', 'trip_visas',                                -- R222→R230 (lot 51, MOD-75 business trip)
    'nba_suggestions',                                    -- R243→R246 (lot 53, MOD décision NBA)
    'cpsi_events',                                        -- CPSI porte (R63→R83, journal tenant-scopé)
    'olivia_conversations', 'olivia_messages', 'olivia_proposals', -- Olivia v1 (R253→R257)
    'offboarding_files', 'offboarding_sensibles',         -- Offboarding (R267→R271)
    'review_deadlines',                                   -- Échéances de review (R272→R275)
    'coc_files', 'coc_config_versions',                   -- Cycle de vie CoC (R276→R278)
    'olivia_tools', 'olivia_agents',                      -- Olivia v2 R264/R259 (registres)
    'olivia_runs', 'olivia_run_events',                   -- Olivia v2 R260 (runs + journal)
    'transactions',                                       -- R297 (dégel V1, journal transactionnel tenanté)
    'builder_artefacts', 'builder_versions',              -- R304 (dégel V3, Builder tenanté)
    'mobile_identites',                                   -- R316 (dégel V7, population mobile tenantée)
    'event_dead_letters'                                  -- R286 (transport : échec visible, tenanté ;
                                                          --  event_consumers = infra SANS tenant — hors RLS, documenté)
  ] LOOP
    IF to_regclass(t) IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns c
                   WHERE c.table_schema = 'public' AND c.table_name = t
                     AND c.column_name = 'tenant_id') THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);   -- ← le FORCE qui manquait
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
      EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)$p$, t);
    END IF;
  END LOOP;
END $$;

-- ── 2a-bis. Tables filles KYC SANS colonne tenant_id : policy par SOUS-REQUÊTE FK ─────
-- Les 6 tables enfant du dossier (kyc_sections, kyc_questions, kyc_access_rules,
-- kyc_question_history, kyc_visas, kyc_lock_requests) n'ont pas de colonne tenant_id (§2).
-- Sans policy, sous FORCE RLS une lecture DIRECTE (`SELECT * FROM kyc_visas`) fuiterait
-- cross-tenant : l'isolation transitive par FK n'était qu'APPLICATIVE. On la rend RÉELLE
-- en base via une policy dont le prédicat remonte au parent tenanté (kyc_files ou kyc_locks).
-- Aucune colonne nouvelle, aucune migration de données. Idempotent (DROP POLICY IF EXISTS).
-- Le prédicat sert en USING (lecture/maj/suppression) ET en WITH CHECK (insertion/maj) :
-- on ne peut rattacher une ligne fille qu'à un parent de SON tenant.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('kyc_sections',
       $u$EXISTS (SELECT 1 FROM kyc_files f
                  WHERE f.id = kyc_sections.kyc_file_id
                    AND f.tenant_id = current_setting('app.tenant_id', true)::uuid)$u$),
    ('kyc_visas',
       $u$EXISTS (SELECT 1 FROM kyc_files f
                  WHERE f.id = kyc_visas.kyc_file_id
                    AND f.tenant_id = current_setting('app.tenant_id', true)::uuid)$u$),
    ('kyc_questions',
       $u$EXISTS (SELECT 1 FROM kyc_sections s JOIN kyc_files f ON f.id = s.kyc_file_id
                  WHERE s.id = kyc_questions.section_id
                    AND f.tenant_id = current_setting('app.tenant_id', true)::uuid)$u$),
    ('kyc_access_rules',
       $u$EXISTS (SELECT 1 FROM kyc_questions q JOIN kyc_sections s ON s.id = q.section_id
                  JOIN kyc_files f ON f.id = s.kyc_file_id
                  WHERE q.id = kyc_access_rules.question_id
                    AND f.tenant_id = current_setting('app.tenant_id', true)::uuid)$u$),
    ('kyc_question_history',
       $u$EXISTS (SELECT 1 FROM kyc_questions q JOIN kyc_sections s ON s.id = q.section_id
                  JOIN kyc_files f ON f.id = s.kyc_file_id
                  WHERE q.id = kyc_question_history.question_id
                    AND f.tenant_id = current_setting('app.tenant_id', true)::uuid)$u$),
    ('kyc_lock_requests',
       $u$EXISTS (SELECT 1 FROM kyc_locks l
                  WHERE l.id = kyc_lock_requests.lock_id
                    AND l.tenant_id = current_setting('app.tenant_id', true)::uuid)$u$)
  ) AS v(tbl, predicat)
  LOOP
    IF to_regclass(r.tbl) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tbl);
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', r.tbl);
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', r.tbl);
      EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (%s) WITH CHECK (%s)',
                     r.tbl, r.predicat, r.predicat);
    END IF;
  END LOOP;
END $$;

-- ── 2b. R270 (LBA art. 10a) : cloisonnement SQL du motif sensible d'offboarding ─────
-- Politique RESTRICTIVE en LECTURE sur offboarding_sensibles : outre l'isolation tenant,
-- la ligne n'est SERVIE que si le rôle applicatif courant (GUC app.role) figure dans la
-- liste habilitée (GUC app.roles_motif_sensible, posée par le service depuis le paramètre
-- tenant `rolesMotifSensible` — défaut CO_SR,MLRO,SO ; R284 : l'audit exige de voir le cloisonné). Testée au niveau SQL (critère 5.6-2)
-- via SET ROLE olive_app + set_config — pas seulement au contrôleur.
DO $$ BEGIN
  IF to_regclass('offboarding_sensibles') IS NOT NULL THEN
    DROP POLICY IF EXISTS motif_sensible_roles ON offboarding_sensibles;
    CREATE POLICY motif_sensible_roles ON offboarding_sensibles
      AS RESTRICTIVE FOR SELECT
      USING (current_setting('app.role', true) = ANY (string_to_array(
        COALESCE(NULLIF(current_setting('app.roles_motif_sensible', true), ''), 'CO_SR,MLRO,SO'), ',')));
  END IF;
END $$;

-- ── 2c. RV-08 : au plus UNE échéance PLANIFIEE par client (index partiel unique) ────
DO $$ BEGIN
  IF to_regclass('review_deadlines') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS review_deadline_une_planifiee
      ON review_deadlines (tenant_id, client_id) WHERE statut = 'PLANIFIEE';
  END IF;
END $$;

-- ── 2d. CC-07 : NON_RETENU exige un motif (contrainte SQL, pas seulement applicative) ────
DO $$ BEGIN
  IF to_regclass('coc_files') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'motif_si_non_retenu') THEN
    ALTER TABLE coc_files ADD CONSTRAINT motif_si_non_retenu
      CHECK (statut <> 'NON_RETENU' OR motif_cloture IS NOT NULL);
  END IF;
  -- R264 (Olivia v2) : le contrat d'outil n'admet QUE GET|PROPOSE — au niveau SQL aussi.
  IF to_regclass('olivia_tools') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'outil_methode_contrat') THEN
    ALTER TABLE olivia_tools ADD CONSTRAINT outil_methode_contrat
      CHECK (methode IN ('GET','PROPOSE'));
  END IF;
  -- R259 (Olivia v2) : un agent est ACTIF ou RETIRE — rien d'autre (B.2).
  IF to_regclass('olivia_agents') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_statut_contrat') THEN
    ALTER TABLE olivia_agents ADD CONSTRAINT agent_statut_contrat
      CHECK (statut IN ('ACTIF','RETIRE'));
  END IF;
  -- R282 (écarts anciens) : versions de la matrice de droits — la ligne CLOSE est immuable,
  -- et une seule version EN VIGUEUR par (question, rôle).
  IF to_regclass('kyc_access_rules') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS kyc_access_rule_en_vigueur
      ON kyc_access_rules (question_id, role) WHERE effective_to IS NULL;
    CREATE OR REPLACE FUNCTION kar_version_close_immuable() RETURNS trigger AS $kar$
    BEGIN
      IF OLD.effective_to IS NOT NULL THEN
        RAISE EXCEPTION 'R282 : version close de la matrice — immuable (append-only des versions)';
      END IF;
      RETURN NEW;
    END $kar$ LANGUAGE plpgsql;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'kar_version_immuable') THEN
      CREATE TRIGGER kar_version_immuable BEFORE UPDATE ON kyc_access_rules
        FOR EACH ROW EXECUTE FUNCTION kar_version_close_immuable();
    END IF;
  END IF;
  -- R260 (Olivia v2) : la machine à états du run — au niveau SQL aussi (B.2).
  IF to_regclass('olivia_runs') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'run_statut_machine') THEN
    ALTER TABLE olivia_runs ADD CONSTRAINT run_statut_machine
      CHECK (statut IN ('PLANIFIE','EN_COURS','PAUSE_PORTE','TERMINE','ECHOUE','INTERROMPU','EPUISE'));
  END IF;
END $$;

-- ── 3. Rôle applicatif NON-propriétaire (le propriétaire bypasse la RLS) ────
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'olive_app') THEN
    CREATE ROLE olive_app LOGIN PASSWORD 'olive_app';   -- ⚠ secret réel via env en prod
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO olive_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO olive_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO olive_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO olive_app;

-- ════════════════════════════════════════════════════════════════════════════
-- CÔTÉ APPLICATION (delta PrismaService — remplace le no-op forTenant) :
--
--   /** Ouvre une transaction scopée tenant : la RLS s'applique VRAIMENT. */
--   forTenant<T>(tenantId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>) {
--     return this.$transaction(async (tx) => {
--       await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`; // SET LOCAL
--       return fn(tx);
--     });
--   }
--
-- Déploiement en 2 temps (aucune interruption) :
--   T1 : exécuter ce SQL — l'appli, encore connectée en propriétaire, bypasse
--        la RLS → comportement inchangé ; l'isolation applicative continue seule.
--   T2 : basculer DATABASE_URL sur olive_app + router les requêtes via forTenant
--        → la RLS devient effective en défense en profondeur.
-- Preuve attendue (e2e à ajouter) : connecté en olive_app SANS set_config,
-- tout SELECT sur clients rend 0 ligne ; avec set_config t1, seules celles de t1.
-- ════════════════════════════════════════════════════════════════════════════
