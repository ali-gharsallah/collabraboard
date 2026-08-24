-- R100 (sujets étendus) — le screening ne vise plus que les CLIENTS : il s'applique au même titre aux
-- PERSONNES et aux PROSPECTS/pré-prospects (même moteur, même règle « un hit n'est pas une alerte »,
-- déclencheur de plus). On trace QUEL type de sujet a été screené, sur le run et sur chaque hit.
-- Colonnes additives NOT NULL DEFAULT 'client' : les runs/hits existants restent des screenings client
-- (comportement inchangé). Idempotent (IF NOT EXISTS), non destructif (R334).
ALTER TABLE "screening_runs" ADD COLUMN IF NOT EXISTS "sujet_type" TEXT NOT NULL DEFAULT 'client';
ALTER TABLE "screening_hits" ADD COLUMN IF NOT EXISTS "sujet_type" TEXT NOT NULL DEFAULT 'client';
