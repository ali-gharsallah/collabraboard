-- Bloc E robustesse (R339/EV) — version du schéma de payload sur le journal. Expand-only :
-- ADD COLUMN avec DEFAULT 1 (backfill des lignes existantes à 1). L'événement stocké n'est
-- JAMAIS réécrit : l'upcast v1→v2→… se fait à la LECTURE (deserialiser), append-only respecté.
ALTER TABLE "domain_events" ADD COLUMN "event_version" INTEGER NOT NULL DEFAULT 1;
