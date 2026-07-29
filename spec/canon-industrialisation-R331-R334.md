# CANON — INDUSTRIALISATION (enregistré 2026-07-29, statut RATIFIÉ)

**Étape 0 ratifiée (Ali)** — deux collisions résolues :

| Canon PO | Dépôt | Famille canon | Famille dépôt | Objet |
|----------|-------|---------------|---------------|-------|
| R328 | **R331** | SY (prise : core-sync) | **IX** (indexation, libre) | Registrar : inbox indexée, versionnée, tracée sans main |
| R329 | **R332** | FB | **FB** (libre) | Programme FAT — suite métier e2e générée du canon, bloquante |
| R330 | **R333** | FB | **FB** (partagée FAT/BAT) | Programme BAT — cahier généré, exécuté client, signé |
| R331 | **R334** | MG | **MG** (libre) | Migrations expand/contract vérifiées, répétées |

Collisions : R328-R330 pris (vague de clôture) → +3. SY pris (core-sync R167-R169) ET RG
pris (roles.guard) → registrar en **IX**. FB et MG libres.

## Cadrage ratifié
- **Ordre** : (1) R331 registrar+inbox, (2) A.1 golden set + A.5 suite d'attaque,
  (3) R332 FAT, (4) R334 migrations, (5) guide C.1 pipeline, (6) R333 BAT. Branche unique
  PR #46, un commit par item, tests rouges d'abord, point d'étape entre items majeurs.
- **Partie A** : SEUL A.1 (golden set) et A.5 (suite d'attaque) exécutés maintenant, en
  HARNAIS DE FIXTURES — jamais un appel modèle réel en CI (R167 : pas de donnée/appel
  simulé en prod ; la mesure tourne sur gabarits + logique déterministe). Le reste de A
  attend priorisation. Verrou anti-dégradation type R70.
- **Interdits repris** : renumérotation automatique · ratification automatisée (le merge
  d'Ali EST l'acte) · migration destructive en N · UPDATE sur append-only même en
  migration · FAT contournable · cahier BAT rédigé à la main · code avant test.

Le texte du canon PO fait foi pour le CONTENU (IX-01..05, FB-01..07, MG-01..05, phases
0-5 du guide, A.1/A.5) — message PO du 2026-07-29.

## R334 [canon R331] — Migrations expand/contract vérifiées, répétées

Cadre `tools/migrations/` (MG-01..05, harnais 5/5) :
- **MG-01 expand-only** : une migration de phase N n'ajoute que ; DROP/RENAME/TRUNCATE, ADD
  COLUMN NOT NULL sans DEFAULT, SET NOT NULL a posteriori = refusés (porte CI « 3m »). Le
  contract (suppression) vient en N+1, quand plus aucun code ne lit l'ancien.
- **MG-02 plan à vérifs obligatoires** : `plan-template.md` — un plan sans Pré-/Post-vérification
  et « Contract différé (N+1) » est refusé.
- **MG-03 backfill idempotent à filigrane** : rejouable, jamais de doublon, reprend au filigrane.
- **MG-04 append-only intouchable** : aucune migration ne mute une table de journal ; la liste
  est LUE de `post-deploy-v2.sql` (source unique, 24 tables).
- **MG-05 répétition** : job hebdo `migrations-repetition.yml` restore→migrate→post-deploy→
  FAT-rapide sur une COPIE (base neuve en CI ; `pg_restore` d'un dump pour la vraie prod).

Interdits tenus : migration destructive en N · UPDATE sur append-only même en migration.

## R332 [canon R329] — Programme FAT : parcours métier tracés, générés, bloquants

**Décision PO (2026-07-29) — substrat FAT** : « API pour la porte CI + Playwright en job
séparé ». Deux versants :
- **Porte CI BLOQUANTE** = parcours API à jetons réels (la suite e2e existante, 336 verts, est
  le substrat). Un CATALOGUE de parcours métier (`tools/fat/parcours.mjs`) déclare, par
  parcours, les scénarios (identifiants de tests e2e RÉELS) et les règles traversées ; le
  TRACER (`tools/fat/tracer.mjs`) génère `docs/FAT-TRACABILITE.md` et ÉCHOUE si un scénario ou
  une règle déclaré n'est adossé à rien (anti-fiction, FB-02). DEMO-SCRIPT = parcours FAT
  (FB-04). Harnais `tools/fat/test.mjs` FB-01..04, verrou CI « 3f ».
- **Recette VISUELLE NON BLOQUANTE** = job Playwright séparé (`.github/workflows/fat-visuel.yml`
  + `apps/web/playwright/`) : le bundle construit boote dans Chromium et les points d'entrée des
  parcours phares sont cliquables. Job séparé, jamais un check requis : sa rougeur ne bloque pas
  le merge. `@playwright/test` installé ad-hoc en CI (lockfile workspace intact).

## R331 [canon R328] — Le repo a une BOÎTE D'ENTRÉE indexée sans main humaine
`spec/inbox/` : tout artefact y tombe. Un job CI l'indexe (normalise le nom, extrait
règles/familles/statut, détecte les collisions SANS renumériser, met à jour PROJECT-INDEX
en « PROPOSÉ », ouvre une PR de ratification). Le MERGE d'Ali = ratification (événement
daté signé). Append-only : un artefact modifié après ratification = refusé (nouvelle
version = nouveau fichier chaîné). IX-01..05.
