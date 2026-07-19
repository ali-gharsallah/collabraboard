-- ════════════════════════════════════════════════════════════════════════════
-- Migration de données idempotente — documents.status (v0.2) → statut du contrat GED
-- ════════════════════════════════════════════════════════════════════════════
-- Contexte : le chantier « alignement Document » renomme le champ Prisma status → statut
-- (colonne physique conservée via @map("status")). Les VALEURS v0.2 doivent rejoindre les
-- statuts du contrat GED : A_CLASSER | ACTIF | ARCHIVE | DETRUIT.
--
-- Mapping RATIFIÉ (Ali Gharsallah, 20.07.2026) : A_VALIDER → ACTIF
--   (un document v0.2 « à valider » a été déposé et est vivant → ACTIF, cf. ged.deposer).
--
-- Idempotent : ne touche que les lignes encore en 'A_VALIDER' ; un 2e passage voit 0 ligne.
-- Dry-run : le RAISE NOTICE journalise le volume AVANT bascule.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

DO $$
DECLARE n_avalider int; n_hors int;
BEGIN
  SELECT count(*) INTO n_avalider FROM documents WHERE status = 'A_VALIDER';
  -- Garde-fou : toute valeur v0.2 NON prévue au mapping est signalée, jamais convertie en douce.
  SELECT count(*) INTO n_hors FROM documents
    WHERE status NOT IN ('A_VALIDER', 'A_CLASSER', 'ACTIF', 'ARCHIVE', 'DETRUIT');
  RAISE NOTICE 'data-migration documents.status : % ligne(s) A_VALIDER -> ACTIF', n_avalider;
  IF n_hors > 0 THEN
    RAISE WARNING 'data-migration documents.status : % ligne(s) de statut HORS mapping connu -> laissées telles quelles (à trancher)', n_hors;
  END IF;
END $$;

UPDATE documents SET status = 'ACTIF' WHERE status = 'A_VALIDER';

COMMIT;
