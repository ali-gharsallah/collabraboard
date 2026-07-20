# ADR-14 — Implémentation de référence du moteur de workflow

## Contexte
Trois implémentations du même catalogue normatif (R1-R51) coexistent :
| Impl. | Localisation | Couverture | Rôle |
|---|---|---|---|
| **Python** (event-sourced, hexagonal) | `services/workflow-engine-py/` | **7/7 blocs, 65 scénarios + 6 persistance SQL — tous verts** | domaine complet, journal SQL avec triggers anti-UPDATE/DELETE (R49 au niveau base), rejeu à date (R48), adaptateur IA (R44), FastAPI |
| JavaScript (event-sourced) | `packages/workflow-engine/` | blocs 1-2, 26 scénarios verts | port navigateur / embarquable démo |
| Port TSX démo | `olive-workflow-demo.html` | extraits (R6/7/10/13/14/15/17/29/46/49/51) | vitrine commerciale interactive |

## Décision
1. **Le moteur Python est l'implémentation de référence d'exécution.** Il est le
   seul complet et le seul dont l'immutabilité de l'audit est prouvée au niveau
   base. Il s'expose en service (FastAPI) derrière le port Workflow défini en
   ADR modular-monolith ; le NestJS l'appelle, ne le réimplémente pas.
2. **La source de vérité reste le CATALOGUE, pas une implémentation.** Toute
   implémentation vivante doit passer la même suite de scénarios (IDs V/D/S/P/
   T/A/X). Le port JS est gelé à blocs 1-2 : il ne progresse que si un besoin
   navigateur l'exige, et alors scénario par scénario.
3. La démo TSX est un artefact de VENTE : jamais citée comme référence.

## Amendements catalogue — RATIFIÉS le 2026-07-12 (voir catalogue-amendements-ratifies.md)
- **S-09** : versioning R29 généralisé à tout artefact de configuration,
  rebasage obligatoire à la recertification.
- **S-10 / S-10b** : délai du visa conditionnel (R25) — doc obligatoire jamais
  reçu : saut à 30 j avec escalade ; doc optionnel : escalade sans invalidation.
- **R52 — ratifié et implémenté dans le moteur de référence (V-18 vert).**

## Écart de comptage signalé
Le préambule projet annonce 68 scénarios ; le catalogue v2 en liste 61
(17+9+8+8+7+7+5) et l'implémentation Python en couvre 64 (61 + S-09/S-10/S-10b).
À réconcilier dans la prochaine révision du document normatif.
