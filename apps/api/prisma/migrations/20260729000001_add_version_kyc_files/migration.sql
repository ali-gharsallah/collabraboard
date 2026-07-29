-- Bloc A robustesse (R336/LK) — jeton de verrou optimiste sur le dossier KYC (table d'état
-- mutable). Expand-only : ADD COLUMN avec DEFAULT (aucune réécriture bloquante, aucune ligne
-- rejetée). Le UPDATE … WHERE id AND version fera le contrôle de concurrence (helper majVersionnee).
ALTER TABLE "kyc_files" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
