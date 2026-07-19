# Catalogue O-Live — Patch v4.1 → v4.2 (RATIFICATION du 19.07.2026)

**Décision : Ali Gharsallah ratifie en bloc, le 19.07.2026, les règles R104 → R116.**
À reporter dans le Word normatif (page de garde : v4.2 · 19.07.2026).

## 1. Règles ratifiées

| Bloc | Règles | Corpus | Verts |
|---|---|---|---|
| 16 · Golden record | **R104** | GR-01..04 | 9/9 |
| 17 · PMS — mandats & adéquation | **R105 R106 R107 R108** | PF-01..06 | 9/9 |
| 18 · GED — documents & preuve | **R109 R110 R111 R112** | GD-01..06 | 9/9 |
| 18 · GED — preuve avancée | **R113 R114 R115 R116** | GD-07..14 | 9/9 |

Statuts « PROPOSÉ » → « RATIFIÉE 19.07.2026 » propagés : 4 documents d'amendement,
catalogue UI de la démo (97 règles, plus aucune PROPOSÉE), matrice de traçabilité.
R56 : titre débarrassé du « À RATIFIER » périmé (ratifiée bi-moteur le 13.07.2026).

## 2. Comptages après fusion

- **Scénarios catalogue** : 151 (v4.1) + GR 4 + PF 6 + GD 14 = **175 IDs**.
- **Corpus backend exécutable** : 153 + GR/SC/JV/SB/P (déjà comptés) … total harnais = **180**
  (171 + ged-avance 9). Chaque ID des nouveaux blocs a son exécutable (couche preuve).
- **Catalogue UI (démo)** : 97 règles — vue de vulgarisation, non normative ; le normatif
  reste le Word + les amendements.

## 3. Paramètres tenant ajoutés au questionnaire R-Q

`pmsDriftToleranceBp` (200) · `pmsBreachDelaiJours` (30) · `gedDocTypes[]`
(code, validiteMois|null, requisPour[], rolesAutorises[]) · prestataire QES (port) ·
port IA classification · `GOLDEN_RECORD_MAPPING` (liste fermée, MVP riskLevel).

## 4. Invariants ajoutés (non paramétrables, avec leur pourquoi)

R107 (l'adéquation LSFin ne se désactive pas) · R109 (jamais de suppression physique) ·
R111 (empreinte non contournable) · R113 (preuve d'antériorité non optionnelle) ·
le default-deny R112, le trio proposer/décider/certifier R115 et la séparation
proposition/application R116 (R44).
