# Catalogue O-Live — Patch v4.2 → v4.3 (RATIFICATION du 19.07.2026, soirée)

**Décision : Ali Gharsallah ratifie, le 19.07.2026, les règles R117 → R120** (Bloc 19 ·
Onboarding — l'entrée en relation). À reporter dans le Word (page de garde v4.3).

| Bloc | Règles | Corpus | Verts |
|---|---|---|---|
| 19 · Onboarding | **R117 R118 R119 R120** | OB-01..06 | 9/9 |

- **Scénarios catalogue** : 175 (v4.2) + OB 6 = **181 IDs**.
- **Corpus backend** : 184 + 9 = **193** — vérifié sur l'arbre réel le jour même.
- **Paramètre R-Q ajouté** : `onboardingSlaJours` { COLLECTE: 30, KYC_EN_COURS: 45, DECISION: 10 }.
- **Invariants** (avec leur pourquoi) : R117 machine à états fermée (des états ouverts ne
  s'auditent pas) · R118 le KYC naît du moteur, jamais à la main (un seul chemin de création =
  un seul endroit à prouver) · R119 pas d'ouverture sans APPROVED (la dépendance MOD-01→MOD-09
  devenue blocage testé).
- Le catalogue ne compte plus **aucune règle proposée** : R1 → R120, toutes ratifiées.
