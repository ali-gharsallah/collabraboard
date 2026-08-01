-- R38 : routage rôle→personne in-scope. Colonne additive nullable (expand-only).
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "role_cible" TEXT;
