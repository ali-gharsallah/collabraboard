-- Bloc 63 (repo R446/R448) — colonnes ADDITIVES sur trips (expand R334, jamais de contract ici) :
-- activités prévues (check pré-voyage, guards verdictNON) + budget (chaîne risque×budget, seuil HPB).
ALTER TABLE "trips" ADD COLUMN "activites" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "trips" ADD COLUMN "budget" DOUBLE PRECISION;
