# Catalogue O-Live — Patch v4.5 → v4.6 (RATIFICATION du 19.07.2026, fin de nuit)

**Décision : Ali Gharsallah ratifie, le 19.07.2026, les règles R129 → R132** (Bloc 22 ·
Communication MROS — art. 9 LBA). Page de garde Word : v4.6.

| Bloc | Règles | Corpus | Verts |
|---|---|---|---|
| 22 · Communication MROS | **R129 R130 R131 R132** | MR-01..06 | 8/8 |

- **Scénarios catalogue** : 193 (v4.5) + MR 6 = **199 IDs**.
- **Corpus backend** : 209 + 8 = **217** — vérifié sur l'arbre réel le jour même.
- **Paramètres R-Q** (entrés AU REGISTRE, discipline R125) : `mrosRolesHabilites` (["MLRO"]) ·
  `mrosGelJoursOuvrables` (5).
- **Invariants** : l'abstention se motive comme la communication (c'est elle qu'un inspecteur
  regarde en premier — R129) · le dossier transmis est opposable byte par byte et jamais
  re-décidé (R130) · le gel art. 10 est appliqué par le moteur mais posé et levé par l'humain
  (R131) · la tentative de lecture refusée est elle-même une trace (art. 10a, R132).
- **Limite assumée au catalogue** : `riskCaseId` opaque tant que le backend risk cases (R83)
  n'existe pas — candidat R133.
- Catalogue : **R1 → R132, aucune règle proposée.**
