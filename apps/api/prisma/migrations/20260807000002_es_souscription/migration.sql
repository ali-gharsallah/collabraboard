-- ES-1 (docs/SURVEILLANCE-ES.md §2) — position de lecture du souscripteur outbox.
-- Table d'INFRASTRUCTURE non tenantée (même statut que event_consumers du monolithe) : elle ne
-- porte aucune donnée métier, seulement le curseur du souscripteur privilégié qui lit le flux
-- global domain_events puis scope chaque fait à SON tenant dans es.events (où la RLS s'applique).
-- L'invariant RLS de CLAUDE.md vise les tables TENANTÉES — justification consignée ici.

CREATE TABLE IF NOT EXISTS "es"."subscription_cursor" (
    "consumer"       TEXT        NOT NULL,
    "last_seq"       BIGINT      NOT NULL,
    "nb_faits"       BIGINT      NOT NULL DEFAULT 0,
    "nb_quarantaine" BIGINT      NOT NULL DEFAULT 0,
    "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "es_subscription_cursor_pkey" PRIMARY KEY ("consumer")
);

-- Rôle applicatif : lecture seule du curseur (observabilité) — les avancées de curseur restent
-- au souscripteur (connexion owner). Conditionnel : cf. note grants de 20260807000001_es_socle.
DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'olive_app') THEN
        GRANT SELECT ON "es"."subscription_cursor" TO olive_app;
    END IF;
END $$;
