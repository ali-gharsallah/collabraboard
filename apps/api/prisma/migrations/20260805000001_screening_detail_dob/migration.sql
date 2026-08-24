-- R408/R411 (Phase 1 câblage du moteur fin) — colonnes additives nullable (expand-only, R334).
-- clients.date_naissance : DOB du client, discriminant d'homonymie du screening (rejet Muhammad
-- Haddad/2002 vs liste/1980). screening_hits.detail : décomposition explicable du score persisté
-- {via, nameScore, typePenalty, dobContribution} — le système explique, il ne décide pas (R44).
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "date_naissance" TEXT;
ALTER TABLE "screening_hits" ADD COLUMN IF NOT EXISTS "detail" JSONB;
