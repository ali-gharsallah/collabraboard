# Règles PROPOSÉES R222..R238 — GELÉES (attente validation Ali)

Source : `SPEC-FRONT-CÂBLAGE v2`, sections 7.1 (Business Trip / MOD-75, R222..R230) et
7.2 (Formations & Certifications / MOD-43, R231..R238).

**Statut : PROPOSÉES, non ratifiées.** Par consigne explicite de la spec :

> Ces règles sont **PROPOSÉES — code front et back gelé tant qu'Ali n'a pas validé
> « OK pour R222..R238 ».** Gherkin d'abord, code après validation.

En conséquence, ce dossier ne contient **que du Gherkin** (`@proposed`), non exécuté et
non branché au harnais. **Aucun** service Nest, contrôleur, modèle Prisma, écran React ni
test n'est écrit pour R222..R238 avant validation. La numérotation continue après R221 (Bloc 49).

Quand Ali répond « OK pour R222..R238 », l'ordre de bataille (spec §8) est :
1. Backend MOD-75 : BT-01..BT-10 verts (Jest/supertest) → écran FE-TRIP (FE-50..57).
2. Backend MOD-43 : FO-01..FO-08 verts → écran FE-FORM (FE-60..66).

Toute divergence découverte à l'implémentation devient une **nouvelle règle au catalogue**,
jamais une règle implicite.
