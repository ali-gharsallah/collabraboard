-- ════════════════════════════════════════════════════════════════════════════
-- Migration idempotente — DocumentVersion : contrainte d'unicité alignée sur le canon
-- ════════════════════════════════════════════════════════════════════════════
-- Contexte : la forme normative (zip canon) de l'unicité d'une version est
--   [tenantId, documentId, numero], et non [documentId, numero]. documentId est un UUID
--   global, donc les deux formes sont FONCTIONNELLEMENT équivalentes ; mais la convention
--   du projet est le tenant STRUCTUREL partout (défense en profondeur avec la RLS, et
--   l'index composite sert les requêtes tenant-scopées). On s'aligne sur le canon.
--
-- Idempotent : DROP INDEX IF EXISTS de l'ancien nom + CREATE UNIQUE INDEX IF NOT EXISTS
--   du nom canonique généré par Prisma. Un 2e passage est un no-op.
--   (Un `prisma db push` crée déjà l'index canonique ; ce script garantit le retrait de
--    l'ancien même quand la bascule se fait par `migrate deploy`/environnement figé.)
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

-- Ancienne contrainte (forme non-tenantée) — retirée si présente.
DROP INDEX IF EXISTS document_versions_document_id_numero_key;

-- Contrainte canonique tenant-scopée — nom généré par Prisma pour @@unique([tenantId, documentId, numero]).
CREATE UNIQUE INDEX IF NOT EXISTS document_versions_tenant_id_document_id_numero_key
  ON document_versions (tenant_id, document_id, numero);

COMMIT;
