# Catalogue normatif v2 — inventaire (source : OLive-Specifications-Moteur-Workflow-v2)
| Bloc | Règles | Scénarios | Statut |
|---|---|---|---|
| 1. Cycle de vie du visa 4-yeux | R1–R15 | V-01…V-17 | ✅ 17/17 verts (packages/workflow-engine) |
| 2. Cycle de vie du dossier | R16–R23 | D-01…D-09 | ✅ 9/9 verts |
| 3. Matrice documentaire & versioning | R24–R29 | S-01…S-08 | à faire |
| 4. Propagation & relations (CoC) | R30–R36 | P-01…P-08 | à faire |
| 5. Central File, assignation, SLA | R37–R41 | T-01…T-07 | à faire |
| 6. Screening, IA, sanctions | R42–R46 | A-01…A-07 | à faire |
| 7. Audit trail & rejeu à date | R47–R51 | X-01…X-05 | à faire |
Invariants transverses appliqués dès le Bloc 1 : event-driven pur (zéro effet de
bord), visa uniforme (R15), audit append-only, paramètres tenant injectés (R-Q).
Écart signalé : « OLive-Kit-Integration-Projet.md » absent des fichiers reçus.

## Implémentation de référence (ADR-14)
`services/workflow-engine-py/` : **7/7 blocs, 64 scénarios + 6 tests de
persistance SQL, tous verts** (run_tests.py, run_tests_sql.py). Le port JS
`packages/workflow-engine` (blocs 1-2, 26/26) est gelé — vitrine navigateur.
Amendements S-09/S-10/S-10b + R52 **RATIFIÉS le 2026-07-12** — catalogue v2.1,
65 scénarios normatifs. V-18 vert dans le moteur de référence.

**Catalogue papier = catalogue exécutable** : le Word v2.1
(`spec/OLive-Specifications-Moteur-Workflow-v2.1.docx`) contient exactement les
65 IDs de la suite de tests — égalité prouvée par extraction croisée (∅ dans
les deux sens).
