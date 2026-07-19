# Catalogue O-Live — Patch v4.6 → v4.7 (RATIFICATION du 20.07.2026, aube)

**Décision : Ali Gharsallah ratifie, le 20.07.2026, les règles R133 → R136** (Bloc 23 ·
Risk cases — l'instruction AML). Page de garde Word : v4.7.

| Bloc | Règles | Corpus | Verts |
|---|---|---|---|
| 23 · Risk cases — l'instruction AML | **R133 R134 R135 R136** | RK-01..06 (+ MR renforcé) | 7/7 + 8/8 |

- **Scénarios catalogue** : 199 (v4.6) + RK 6 = **205 IDs**.
- **Corpus backend** : 217 + 7 = **224** — vérifié sur l'arbre réel le jour même.
- **Paramètre R-Q** (au registre, discipline R125) : `riskCaseSlaJours`
  { NOUVELLE: 2, EN_ANALYSE: 15, CLARIFICATION: 10 }.
- **R136 ferme la limite assumée du bloc 22** : `MrosService.decider` exige un cas EXISTANT et
  ESCALADÉ ; la clôture d'un cas est refusée tant que sa communication MROS est active. Le
  corpus MR a été **renforcé** en conséquence (préconditions semées) — jamais affaibli.
- **Correction pré-ratification actée** : la 1re machine à états faisait d'ESCALADEE un état
  sans sortie (RK-06 inatteignable — montré par le premier run) ; `ESCALADEE → CLOTUREE` existe,
  gardée par R136.
- La chaîne AML est fermée de bout en bout : **signal → cas → escalade → décision → gel**.
- Catalogue : **R1 → R136, aucune règle proposée.**
