-- R16-R23 (machine d'états dossier) — EXPAND-ONLY. Ajout des états SUSPENDED (R17), ABANDONED
-- (R19), EN_MAJ (R21) à l'énum KycStatus (les 4 valeurs existantes sont conservées) + deux
-- colonnes additives : restrictions (snapshot figé à la suspension, S-09) et lecture_seule (R20 :
-- conservation LBA prime l'effacement LPD). Aucune ligne réécrite ni rejetée.
ALTER TYPE "KycStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';
ALTER TYPE "KycStatus" ADD VALUE IF NOT EXISTS 'ABANDONED';
ALTER TYPE "KycStatus" ADD VALUE IF NOT EXISTS 'EN_MAJ';
ALTER TABLE "kyc_files" ADD COLUMN IF NOT EXISTS "restrictions" JSONB;
ALTER TABLE "kyc_files" ADD COLUMN IF NOT EXISTS "lecture_seule" BOOLEAN NOT NULL DEFAULT false;
