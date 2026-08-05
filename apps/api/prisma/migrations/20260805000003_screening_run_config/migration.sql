-- R269 — la config moteur EFFECTIVE d'un run de screening (knobs R268 + scénario/version en vigueur)
-- est tracée sur le run, pour le rejeu (R48/R49) : on doit pouvoir reconstruire AVEC QUEL réglage un
-- hit a été produit. Colonne additive nullable (expand-only, R334) ; les runs sans scénario la
-- laissent à NULL (comportement par défaut, inchangé).
ALTER TABLE "screening_runs" ADD COLUMN IF NOT EXISTS "config" JSONB;
