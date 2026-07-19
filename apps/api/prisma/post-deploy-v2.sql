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
    'ia_prompt_versions'                                  -- R124 (le prompt est une règle : registre append-only)
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
    'ia_prerevues', 'ia_prompt_versions'                  -- R121→R124 (bloc 20, tenantées)
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
