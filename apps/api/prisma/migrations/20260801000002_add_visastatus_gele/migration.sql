-- R46 (hit pendant la validation) : valeur d'énum GELE — un visa EN ATTENTE est GELÉ le temps de
-- la décision du comité Risk & Compliance (poursuite = dégel ; sinon offboarding). Expand-only :
-- ajout de valeur d'énum, aucune ligne réécrite ni rejetée.
ALTER TYPE "VisaStatus" ADD VALUE IF NOT EXISTS 'GELE';
