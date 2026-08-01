-- Bloc A robustesse (R336/LK) — jeton de verrou optimiste sur le VISA de section (table d'état
-- mutable : PENDING → SIGNED). Expand-only : ADD COLUMN avec DEFAULT (aucune réécriture bloquante,
-- aucune ligne rejetée). Le UPDATE … WHERE id AND version fera le contrôle de concurrence
-- (helper majVersionnee) : deux porteurs du même rôle signant la même section → l'un réussit,
-- l'autre reçoit 409 (jamais d'écrasement silencieux d'un visa four-eyes).
ALTER TABLE "kyc_visas" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
