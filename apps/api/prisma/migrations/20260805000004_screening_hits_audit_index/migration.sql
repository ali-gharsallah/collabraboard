-- HISTORISATION / AUDIT (sous R411) — index pour lire l'historique de screening d'un SUJET dans le
-- temps (hits d'un client, fenêtre de dates) à l'échelle réelle, sans scan de table. Le hit reste une
-- pièce IMMUABLE (score, décomposition, version de liste) ; cet index n'ajoute qu'un chemin de lecture.
-- Additif, non destructif (R334). IF NOT EXISTS : idempotent contre les bases déjà « db push »-ées.
CREATE INDEX IF NOT EXISTS "screening_hits_tenant_id_client_id_at_idx" ON "screening_hits" ("tenant_id", "client_id", "at");
