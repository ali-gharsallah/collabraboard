# Catalogue O-Live — Patch v4.15 → v4.16 (RATIFICATION du 21.07.2026)

**Décision d'Ali Gharsallah, 21.07.2026 :** ratification des règles **R167 → R170**
(Bloc 33 · Le core banking est un port + R170 · La rétention naît au classement).
Page de garde Word : v4.16.

| Bloc | Règles | Corpus | Verts |
|---|---|---|---|
| 33 · Le core banking est un port | **R167 R168 R169** | SY-01..05 | 5/5 |
| La rétention naît au classement | **R170** | RN-01..04 | 4/4 |

- **Scénarios catalogue** : 250 (v4.15) + SY 5 + RN 4 = **259 IDs**.
- **Corpus backend** : 279 + 5 + 4 = **288** (harnais canon ET miroir, identiques).
- Le sine qua non suisse est du droit interne : port DÉCLARÉ jamais simulé (R167), lot
  SIGNÉ lecture seule par construction (R168), mapping versionné à date de mise en vigueur
  et QUARANTAINE pour l'inconnu (R169). La règle de vente : « nous ne demandons pas à la
  banque de remplacer son core — nous demandons au core de passer par un port, en lecture
  seule, signé ligne à ligne. »
- R170 ferme le chaînon manquant trouvé à l'audit du paramétrage : le type porte
  `retentionAnnees` (dans `gedDocTypes` — la clé maîtresse s'enrichit), le classement pose
  l'échéance, GD-11 propose, l'humain décide (R7), rien ne bloque (R39).
- Familles SY et RN — la vérification systématique a évité ses 4e collisions (RT pris).
- **Paramètres R-Q** : `coreMapping` · `coreSystemeRef` · `gedDocTypes.retentionAnnees`.
- Catalogue : **R1 → R170, aucune règle proposée.** Consolidation anti-régression active
  (canon unique, miroir reconstruit, batterie v2 à 6 contrôles).
