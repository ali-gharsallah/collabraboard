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
    'zakat_calculations', 'waqf_distributions', 'mudaraba_distributions' -- R211/R215/R218 (ledgers Shariah, append-only)
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
    'zakat_calculations', 'waqf_distributions', 'mudaraba_distributions' -- R211/R215/R218 (lot 49b, ledgers Shariah)
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
