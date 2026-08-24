-- ES-0 (docs/SURVEILLANCE-ES.md §2-§3) — socle du contexte surveillance-es.
-- Schéma Postgres DÉDIÉ `es` (niveau 1 d'isolation) : le store est HORS du datamodel Prisma
-- (aucun modèle schema.prisma — la gate no-drift 0b ne voit que le schéma public) et s'accède
-- par SQL brut via EsEventStore. Append-only PAR TRIGGER (invariant 1 : un UPDATE/DELETE échoue
-- EN BASE, pas seulement en revue), RLS ENABLE + FORCE + policy tenant_isolation sur le modèle
-- de prisma/post-deploy-v2.sql (tenant_id uuid, GUC app.tenant_id).

CREATE SCHEMA IF NOT EXISTS "es";

CREATE TABLE IF NOT EXISTS "es"."events" (
    "id"              UUID        NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"       UUID        NOT NULL,
    "stream_type"     TEXT        NOT NULL,
    "stream_id"       TEXT        NOT NULL,
    "seq"             INTEGER     NOT NULL,
    "type"            TEXT        NOT NULL,
    "version"         INTEGER     NOT NULL DEFAULT 1,
    "payload"         JSONB       NOT NULL,
    "source_event_id" TEXT,
    "at"              TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "es_events_pkey" PRIMARY KEY ("id"),
    -- Verrou optimiste : l'unicité (stream, seq) arbitre les écritures concurrentes (ES-0).
    CONSTRAINT "es_events_stream_seq_key" UNIQUE ("stream_type", "stream_id", "seq")
);

CREATE INDEX IF NOT EXISTS "es_events_tenant_at_idx" ON "es"."events" ("tenant_id", "at");
CREATE INDEX IF NOT EXISTS "es_events_source_event_idx" ON "es"."events" ("source_event_id");

-- Invariant 1 — append-only par TRIGGER : la mutation échoue en base, sans exception aucune.
CREATE OR REPLACE FUNCTION es.refuser_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'es.events est append-only (SURVEILLANCE-ES invariant 1) : % interdit', TG_OP
        USING ERRCODE = 'raise_exception';
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "es_events_append_only" ON "es"."events";
CREATE TRIGGER "es_events_append_only"
    BEFORE UPDATE OR DELETE ON "es"."events"
    FOR EACH ROW EXECUTE FUNCTION es.refuser_mutation();

-- RLS — modèle post-deploy-v2.sql : ENABLE + FORCE (le propriétaire aussi) + policy tenant.
ALTER TABLE "es"."events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "es"."events" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "es"."events";
CREATE POLICY "tenant_isolation" ON "es"."events"
    USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);

-- Droits du rôle applicatif non-owner (créé par post-deploy-v2.sql, HORS périmètre ES) :
-- lecture + append SEULEMENT — jamais UPDATE/DELETE (le trigger le refuse de toute façon).
-- Conditionnel : sur une base fraîche, migrate deploy tourne AVANT prisma:post (le rôle
-- n'existe pas encore) ; la recette e2e ES ré-applique ces grants idempotents.
DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'olive_app') THEN
        GRANT USAGE ON SCHEMA "es" TO olive_app;
        GRANT SELECT, INSERT ON "es"."events" TO olive_app;
    END IF;
END $$;
