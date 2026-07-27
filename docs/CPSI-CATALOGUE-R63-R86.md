# O-Live CPSI — Client Profiling & Segmentation Intelligence Server
## Catalogue consolidé des règles R63–R83 (référence pour Claude Code)

> **Provenance.** Document fourni et ratifié par Ali (catalogue consolidé). Source de canon :
> `spec/catalogue-amendements-ratifies.md` (ratifié 2026-07-13) + moteur de référence
> `services/cpsi-server-py/olive_cpsi/engine.py` (pur Python, déterministe).
> **Statut d'intégration (vérifié 2026-07-27)** : moteur Python **autonome, 18/18 suites vertes**
> (`services/cpsi-server-py/run_tests.py`). R84–R86 (KYC) portés dans `apps/api/src/modules/kyc/rules/`.
> **Cœur CPSI R63–R83 INTÉGRÉ via la porte HTTP mince** `apps/api/src/modules/cpsi` (CP-01..18,
> e2e `test/e2e/fat-cpsi.e2e-spec.ts` verts contre le moteur réel) : journal append-only Postgres
> tenant-scopé (`cpsi_events`, RLS) rejoué vers le moteur via `services/cpsi-server-py/bridge.py`
> (shell-out). Aucune règle réimplémentée — le moteur reste la source de vérité (CP-19). Spec :
> `spec/cpsi-scenarios/CPSI-PORTE.feature`.

⚠️ **Écart signalé : R78 n'existe nulle part** (ni spec, ni code) — gap de numérotation entre
R77 (screening/AML) et R79 (catalogue de conformité). À ratifier ou documenter comme réservé.
Consigné dans `docs/ECARTS-FRONT.md`.

---

## Bloc 1 — Score & segmentation (R63–R67) · suites 1-2

| Règle | Énoncé | Scénarios |
|---|---|---|
| **R63** | **Score perpétuel événementiel** : tout signal (alerte qualifiée, hit screening, review défavorable, CoC sensible, vélocité tx) recalcule le score ; chaque recalcul est un événement append-only ; le score est une fonction pure (statique, signaux ≤ date, config) → rejouable à date (R48/R49). | PS-01, PS-03, PS-05 |
| **R64** | **Décroissance temporelle** : half-life exponentielle (paramètre tenant, défaut 180 j) — un signal vieux d'une demi-vie pèse moitié. | PS-02 |
| **R65** | **Segmentation en groupes de pairs** : grille quantile déterministe statique (B/M/H) × comportement (CALME/ACTIF/INTENSE) — labels stables, segment explicable en une phrase (choix vs k-means : pas de permutation de labels, pas de singletons) ; appartenance et changements tracés ; anomalie = z-score comportemental au sein du groupe de pairs statique. | SG-01..SG-03 |
| **R66** | **Franchissement de bande = événement, jamais effet de bord** : bandes LOW/MEDIUM/HIGH (tenant) ; franchissement → tâche de revue + PROPOSITION d'aiguillage (EDD à la hausse, allègement à la baisse) — la re-classification effective reste humaine/workflow (R44) ; l'anomalie signale sans altérer le score (R39, pas de boucle auto-amplifiante). | BD-01, SG-02 |
| **R67** | **Explicabilité obligatoire** : chaque score publie ses drivers (contributions par source) dont la somme reconstitue le score — aucun score boîte noire n'alimente l'AML ni l'aiguillage. | PS-04 |

## Bloc 2 — Gouvernance des règles de calcul (R68–R70)

| Règle | Énoncé | Scénarios |
|---|---|---|
| **R68** | **Paramètres transparents, en clair, versionnés** : poids, half-life, bandes et seuils de segments sont des paramètres tenant AFFICHÉS EN CLAIR (formule en français, valeurs courantes) ; toute modification est un événement versionné par date de mise en vigueur — le rejeu à date utilise la config en vigueur ce jour-là. | PT-01..PT-03 |
| **R69** | **L'IA propose, l'humain décide** : les propositions (Olivia) embarquent justification + impact simulé ; aucun effet avant adoption humaine tracée ; rejet motivé obligatoire. | IA-01..IA-02 |
| **R70** | **Bac à sable de stress test** : tout changement se simule d'abord (Δ scores, franchissements nominatifs, nouveaux HIGH, charge de revues induite) sans rien muter ; rapport d'impact obligatoire à l'adoption ; « Appliquer » verrouillé tant que les valeurs saisies n'ont pas été simulées. | ST-01..ST-03 |

## Bloc 3 — Groupes de population & ciblage AML (R71–R74) · suite 3

| Règle | Énoncé | Scénarios |
|---|---|---|
| **R71** | **Groupes de population** : cohortes définies par prédicat déclaratif composable (ET/OU sur secteur, type, aum_band, pays_risque, pep, score, historique) ; simple/couple/triple+ ; chevauchement autorisé, priorité pour le groupe primaire ; appartenances tracées. | GP-01..05 |
| **R72** | **Barème de score par groupe** : chaque groupe peut surcharger poids/half-life/bandes ; héritage du barème global à défaut ; barème effectif = celui du groupe primaire ; appartenance calculée au barème global (pas de circularité). | BG-01..03 |
| **R73** | **Ciblage des scénarios AML par groupe** : un scénario vise des groupes et porte un seuil PROPRE à chaque groupe ; il n'évalue QUE les membres de ces groupes → les hors-périmètre ne sont jamais évalués (levier n°1 anti-faux-positifs). | SC-01..03 |
| **R74** | **Tout paramétrable, tout affiché** : groupes, prédicats, barèmes, effectifs, scénarios ciblés en clair ; héritent de R68 (versionné) / R69 (IA propose) / R70 (bac à sable). | — |

Annexes A/B/C/D : bibliothèque 42 groupes / 11 familles, 24+ scénarios / 5-6 domaines,
CoC exhaustif (~40 types) — **applications de R71–R76, pas de nouvelles règles**.

## Bloc 5+ — Insider, cases, séparation screening (R75–R77)

| Règle | Énoncé | Scénarios |
|---|---|---|
| **R75** | **Marquage insider (MAR)** : marquage tracé (auteur/date/motif/instrument), append-only (R49), réservé aux rôles habilités (`roles_insider` : COMPLIANCE, CO_SR, CO, SO, ADMIN, CF — paramètre tenant), réversible avec motivation obligatoire. Alimente les prédicats de groupe (R71) et le ciblage insider dealing (R73). | IN-01..IN-06 |
| **R76** | **Cases d'investigation depuis les scénarios** : un hit devient une case tracée (id, scénario, client, groupe, valeur, seuil, sévérité, statut) ; génération idempotente, rien par effet de bord (R66). Décisions : clôture (motif obligatoire), escalade EDD/MROS, révision KYC, demande d'info — tracées, append-only, humain décide (R44). | CASE-01..04 |
| **R77** | **Séparation Screening / AML** (produit) : le screening (listes — sanctions/PEP/médias) et la surveillance AML comportementale (scénarios) sont deux domaines distincts. Un hit de screening n'est PAS une alerte AML. Tout paramétrage réside dans Paramétrage → Règles & moteur, jamais dans l'écran opérationnel. + bac à sable AML (application R70) : dry-run complet, 0 mutation. | SIM-01..03 |

> ⚠️ **R78 — RÉSERVÉ / INEXISTANT.** Aucune définition en spec ni en code. Gap de numérotation
> entre R77 et R79. À ratifier ou documenter formellement comme réservé (voir `docs/ECARTS-FRONT.md`).

## Blocs 10-15 — Pipeline signaux scorés & risk cases (R79–R83)

| Règle | Énoncé | Scénarios / suites |
|---|---|---|
| **R79** | **Catalogue de conformité, lecture seule** : registre `ATTR_DEFS` — comment CHAQUE attribut surveillé est calculé (nature structurel/calculé, domaine, unité, formule en français) + paramètres EXACTS de chaque scénario, exposés en lecture seule. Source de vérité unique de l'explicabilité. | bloc 11 |
| **R80** | **Alerte = signal scoré franchissant un seuil X paramétrable** : score = w_impact·impact + w_freq·fréquence (défauts 0.6/0.4) ; seuil X (défaut 55) paramétrable tenant/scénario ; bande near-miss [X−marge, X) (marge défaut 10). En deçà de near-miss : *analyse*. | bloc 12 |
| **R81** | **Déduplication & corrélation** : UN signal scoré par (client, scénario) — agrégation, impact max sur les groupes ; corrélation = un même client touché par ≥2 scénarios (phénomène commun) → base du regroupement en risk case. | bloc 13 |
| **R82** | **Rétroaction faux-positif** (suppression apprenante) : pénalité escaladante −(10·1 + … + 10·n) pour n faux positifs déclarés par (client, scénario) ; désactivable (paramètre tenant `fp_suppression_active`) ; tracée. | bloc 13 |
| **R83** | **Risk case animé par workflow** : regroupe ≥1 alertes scorées d'un même client (corrélation R81). Workflow : NOUVELLE → EN_ANALYSE → (CLARIFICATION ↔ EN_ANALYSE) → CLOTUREE \| ESCALADEE (terminaux ; ESCALADEE → voie MROS/SAR). Motif obligatoire (R7) pour clore/escalader/clarifier. Append-only (R48/R49), rien par effet de bord (R66), humain décide (R44). | RC-01..05 (bloc 14) |

**Vocabulaire ratifié** : *franchissement* (hit brut de détection) → *signal scoré* (dédupliqué R81, score impact+fréquence) → *alerte scorée* (score ≥ X, R80) ; sous X : *near-miss* ou *analyse*.

**Reporting SLA hit → MROS/SAR** (bloc 15, RP-01..04) : application de R39 (mesure et notifie, ne coerce pas) + R48/R49 (rejeu depuis l'historique tracé) — pas de nouvelle règle.

## Blocs 16-18 — Extension KYC hébergée dans le serveur CPSI (R84–R86)

Hébergées dans `cpsi-server-py` mais hors périmètre profilage. **Déjà portées dans `apps/api`** :
`apps/api/src/modules/kyc/rules/` — R84 (KycLock, `kyc-lock.service.ts`, CK-01..05),
R85 (KycHandoff, `kyc-handoff.ts`, HM-01..06), R86 (QualifiedVisa, `qualified-visa.service.ts`,
VQ-01..06 — extension du visa uniforme R15).

---

## Paramètres tenant (questionnaire R-Q) — défauts du moteur

| Paramètre | Défaut | Règle |
|---|---|---|
| `half_life_jours` | 180 | R64 |
| `bandes` (LOW/MED/HIGH) | (40, 70) | R66 |
| `seg_stat_seuils` / `seg_comp_seuils` | (15, 30) / (8, 25) | R65 |
| `poids_signaux` | alerte_fondee 12 · alerte_non_fondee 2 · hit_screening 8 · review_defavorable 9 · coc_sensible 6 · velocite_tx 5 | R63 |
| `poids_statique` | pays_risque 6 · structure_risque 5 · pep 15 · secteur_risque 4 | R63 |
| `seuil_alerte` X / `marge_near_miss` | 55 / 10 | R80 |
| `w_impact` / `w_freq` | 0.6 / 0.4 | R80 |
| `fp_suppression_active` | true | R82 |
| `roles_insider` | COMPLIANCE, CO_SR, CO, SO, ADMIN, CF | R75 |
| `k_segments` | 4 (granularité future) | R65 |

Toute config est versionnée par date de mise en vigueur (R68) — le rejeu à date (R48)
s'applique aussi aux règles de calcul.

## Implémentation de référence

```
services/cpsi-server-py/
├── olive_cpsi/engine.py      # OliveCpsiEngine (52 Ko) — R63..R83
├── olive_cpsi/kyc_lock.py    # R84
├── olive_cpsi/kyc_handoff.py # R85
├── olive_cpsi/kyc_visa.py    # R86
├── tests/test_cpsi_bloc1..18.py
└── run_tests.py              # 18/18 suites vertes (vérifié 2026-07-27)
```

Ingestion : `ingester_signal` est **default-deny** (type de signal inconnu → `CpsiError`).
Journal `events` append-only avec `seq` monotone (R49). Les tâches sont émises,
jamais d'effet de bord sur un dossier (R66/R39).

---

## Porte HTTP mince — LIVRÉE (ratifiée « OK pour la porte CPSI »)

`apps/api/src/modules/cpsi` relaie les surfaces du moteur (score+drivers R67, segmentation R65,
groupes & ciblage R71/R73, catalogue conformité R79, alertes R80/R81, bac à sable R70, propositions
R69, insider R75, risk cases R83, reporting R39) SANS réécrire de règle. Journal append-only Postgres
(`cpsi_events`, RLS) rejoué vers le moteur (`bridge.py`, shell-out). Écritures gouvernées validées par
rejeu avant persistance ; auteur = jeton ; rejeu à date `?asOf=` (R48/R49). e2e : 18 scénarios verts
contre le moteur réel. Frontière avec l'AML/riskcases R133-136 : **complète, aucune route existante
touchée** (Q3). CP-19 (la porte ne calcule rien) tenu par construction.
