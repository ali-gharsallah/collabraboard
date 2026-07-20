# O-Live Engine — Moteur de workflow compliance (from scratch)

Implémentation event-sourced du catalogue de règles R1-R51
(document : OLive-Specifications-Moteur-Workflow-v2).

## État d'avancement

| Bloc | Règles | Scénarios | Statut |
|---|---|---|---|
| 1 — Visa 4-yeux | R1-R15, R52 | V-01 à V-18 | **18/18 verts** |
| 2 — Cycle de vie du dossier | R16-R23, R53 | D-01 à D-09, C-01 à C-05 | **14/14 verts** |
| 3 — Section & matrice | R24-R29 | S-01 à S-10 | **11/11 verts** |
| 4 — Personnes liées | R30-R36 | P-01 à P-08 | **8/8 verts** |
| 5 — Tâches & rôles | R37-R41, R54 | T-01 à T-07, K-01 à K-05 | **12/12 verts** |
| 6 — Screening AML | R42-R46 | A-01 à A-07 | **7/7 verts** |
| 7 — Audit trail | R47-R51, R55 | X-01 à X-05, SN-01 à SN-05 | **10/10 verts** |

## Architecture

- **Domaine pur** (`olive_engine/domain.py`) : aucune dépendance infra, horloge
  injectée (le temps est un paramètre, jamais un effet de bord).
- **Event-sourced dès le premier commit** (`olive_engine/events.py`) : journal
  append-only immuable (R49), rejeu à date `as_of()` (R48), extraction par ID
  KYC `for_dossier()` (R51). L'audit trail n'est pas une couche ajoutée, c'est
  le cœur du modèle.
- **Référentiel versionné généralisé** (`olive_engine/referentiel.py`) : TOUT
  artefact de configuration (matrice documentaire, sections, questionnaires,
  règles) est versionné par date de mise en vigueur. Un dossier validé est
  estampillé avec le snapshot complet du référentiel (grandfathering R29
  généralisé = R48) ; la recertification rebase obligatoirement.
- **Erreurs = règles** (`olive_engine/errors.py`) : chaque exception porte le
  numéro de règle qu'elle protège.

## Exécution

```
python3 run_tests.py     # suite bloc 1 (17 scénarios)
python3 demo_audit.py    # démo R48 (rejeu à date) et R51 (extraction par ID)
```

`pytest.py` est un mini-runner hors ligne ; les tests sont 100% compatibles
avec le vrai pytest en CI (`pip install pytest && pytest tests/ -v`).

## Méthode

Spécification exécutable : chaque scénario Gherkin du catalogue devient un test
AVANT le code. Un bloc est terminé à 100% de scénarios verts. Toute nouvelle
règle découverte entre au catalogue (numérotation continue) avant implémentation.

## Amendements au catalogue (session bloc 3)

- **S-09** (nouveau) : versioning généralisé à tout artefact de configuration +
  rebasage obligatoire à la recertification. Décision produit : le versioning
  R29 s'applique à tout changement de règle (sections, questionnaires...), pas
  seulement à la matrice documentaire.
- **S-10 / S-10b** (nouveaux) : délai du visa conditionnel (R25) — document
  obligatoire jamais reçu : le visa saute à 30 jours avec escalade ; document
  optionnel : escalade sans invalidation.

## CATALOGUE COMPLET : 80/80 scénarios verts (v2.4 FINALE ratifiée 2026-07-12 — R1–R55, zéro amendement en attente)

Le domaine couvre l'intégralité du contrat d'implémentation (R1-R51 + S-09/S-10).
~2 200 lignes, domaine pur sans dépendance, horloge injectée, event-sourced.

## Adaptateurs (hexagonal : le domaine ne les connaît pas)

- **`storage.py`** — journal SQL. `SqlJournal` (SQLite, référence testée) et
  `PostgresJournal` (production, même schéma). Immutabilité R49 imposée AU
  NIVEAU BASE : triggers anti-UPDATE/DELETE — même un accès SQL direct ne
  peut pas falsifier l'audit trail. Preuve : `run_tests_sql.py` rejoue les
  64 scénarios + 6 tests de persistance sur le store SQL, sans changer une
  ligne du domaine ni des tests.
- **`ia_adapter.py`** — R44 AI-assisted/human-decided. `AnalyseIALocale`
  (déterministe, défaut) et `AnalyseIAClaude` (API Anthropic, prompt
  compliance inclus). L'IA propose et alimente le journal ; la décision
  reste humaine (`decider_whitelist`).
- **`api.py`** — FastAPI. Les erreurs métier deviennent des 422 portant le
  numéro de règle (`{"regle": "R13", ...}`) directement affichables.
  Endpoints livrés : visa/refus, audit par ID KYC, preuve 4-yeux sur lot,
  état à date.

## Parallel run (strangler fig) — `olive_engine/shadow.py`

Migration sans big bang : l'engine actuel reste MAÎTRE, chaque commande est
dupliquée vers le moteur catalogue en OMBRE (aucun effet visible, crash de
l'ombre sans conséquence). Le comparateur vérifie décision + règle citée sur
refus + état canonique ; les divergences partent au rapport quotidien, triées
en trois causes : BUG_OMBRE (corriger, le test existe), BUG_MAITRE (le
catalogue vient de le révéler), REGLE_IMPLICITE (brouillon Rn auto-généré,
numérotation continue, dédoublonné par cause). Critère de bascule :
`pret_a_basculer(N)` = N parcours complets consécutifs à zéro divergence.

- Tests : `tests/test_shadow.py` (SH-01..SH-06) — dans `run_tests.py` (8/8).
- Démo sans intégration : `python3 run_shadow_demo.py` — rejoue 3 parcours
  contre un legacy simulé (laxisme R7 + règle implicite « pas de visa sans
  document ») et produit `rapport-parallel-run.md` avec le brouillon R53.
- **Corpus catalogue** (`olive_engine/replay.py` + `run_replay_corpus.py`) :
  les 65 scénarios du catalogue sont CAPTURÉS en exécutant les suites de tests
  sur des moteurs enregistreurs (capture par handles : les objets retournés —
  dossiers, process, hits, tâches — sont référencés, `actifs`/`absences`/
  `relais`/`referentiel` capturés aussi), puis REJOUÉS dans deux moteurs neufs
  avec comparaison pas à pas et CONTRÔLE DE FIDÉLITÉ (un scénario dont le rejeu
  ne reproduit pas la capture est REJEU_PARTIEL, hors corpus de bascule).
  État : **65/65 fidèles, 637 commandes, zéro divergence**. Pour auditer un
  engine legacy : `CorpusReplayer(fabrique_legacy, fabrique_catalogue)` — le
  corpus du catalogue devient la batterie d'acceptance du parallel run réel.
- **Croisement bidirectionnel** (`olive_engine/cross.py` + `run_cross_engines.py`,
  tests XC-01..XC-03) : les cas qui MARCHENT sur le workflow actuel (moteur JS,
  via `packages/workflow-engine/bridge.mjs`, protocole JSON-lines canonique)
  sont rejoués sur le nouveau moteur — et inversement — sur 16 parcours.
  Résultat : **14/16 convergents ; les 2 divergences sont les écarts réels** :
  R14 (pas de pop-up d'engagement à la finale côté JS) et R2 (le JS accepte un
  signataire non validateur). Prise immédiate : le croisement a attrapé une
  incohérence du port JS (visa ANNULÉ mais section restée VISÉE) — corrigée,
  ses 26 tests restent verts. Écart de vocabulaire documenté et normalisé :
  SOUMISE (JS) ≡ EN_VALIDATION (Py).
- **Filet de propriétés** (`tests/test_proprietes.py`, PR-00..PR-05) : 120
  séquences aléatoires seedées × 30 commandes (dont hostiles) par invariant —
  I1 jamais de visa signé par un préparateur (R13/R52, finale incluse), I2
  journal strictement croissant à préfixe immuable (R49), I3 rejeu à date
  déterministe et monotone (R48), I4 visa accordé ⇒ zéro modification
  postérieure, I5 engagement apparié (R14) et motivation présente (R7) dans le
  journal. PR-00 est le méta-test : un moteur saboté (4-yeux neutralisé) fait
  mordre le filet — il n'est pas décoratif. Prérequis du chantier concurrence.
- **R53 — Concurrence optimiste** (`tests/test_bloc_concurrence.py`, C-01..C-05,
  proposé au catalogue) : `version(dossier)` = nombre d'événements effectifs
  (ni lectures R47, ni conflits) ; les 5 commandes utilisateur acceptent
  `expected_version` — version périmée ⇒ rejet SANS EFFET avec la version
  courante (« rechargez ») et tentative tracée `conflit_concurrence`. Sans
  version fournie : compatibilité totale (processus internes, migration).
  Vérifié aussi sur journal SQL (9/9 suites du runner SQL).
  **R55 — Snapshots de reprise** (`olive_engine/snapshots.py`, SN-01..SN-05,
  proposé au catalogue) : sérialisation GÉNÉRIQUE par introspection des
  dataclasses (un champ ajouté au domaine est photographié automatiquement),
  store SQLite append-only à triggers (réécriture d'une version refusée —
  R49), restauration O(récent) via l'index par dossier R51 (500 événements
  d'autres dossiers : zéro lecture), retard signalé (l'exploitant sait combien
  de commandes manquent), et fidélité COMPORTEMENTALE prouvée : le dossier
  restauré refuse les mêmes règles et accepte les mêmes commandes que
  l'original (SN-02).
- **Config tenant versionnée** (`olive_engine/config_tenant.py`, CT-01..CT-05) :
  le questionnaire R-Q signé devient un artefact TYPÉ (schéma des 16 réponses,
  bornes contractuelles), validé AVANT publication, publié au référentiel par
  date de vigueur (S-09) et tracé (`config_tenant_publiee`). Le moteur lit la
  config À DATE (`config_a`) : une réforme des restrictions R17 ne réécrit pas
  les suspensions passées — grandfathering mécanique, zéro code dédié. Sans
  publication : défauts moteur (compatibilité totale). La config entre dans
  l'estampille S-09 du dossier validé et dans le rejeu à date R48.
- **R54 — Déclencheur du temps** (`tick_global(now)`, K-01..K-05, proposé au
  catalogue) : point d'entrée unique du scheduler couvrant R5/R19/R25/R33/
  R39/R42 en une passe. Idempotent (rejouer au même now ⇒ 0 événement métier),
  monotone (horloge qui recule ⇒ refus sans effet + trace `tick_refuse_horloge`),
  rattrapant (échéances intermédiaires en une passe, sans sur-émission), et
  auditable (bilan `tick_execute {now, emis}` à chaque exécution — le batch
  lui-même est dans l'audit trail). Production : un cron (BullMQ repeatable ou
  systemd timer) appelle `POST /tick` toutes les N minutes — le rejeu sur
  chevauchement ou crash est sans danger par construction.
- **UI pilote** (`run_ui.py` → http://localhost:8700, zéro dépendance —
  stdlib pur, argument on-prem) : corbeille de tâches par rôle (SLA R39 en
  rouge, vue de charge R40, bouton tick_global R54), dossiers rendus en
  BRANCHE D'OLIVIER (une feuille par section : verte visée, dorée en cours,
  rouge en alerte ; l'olive = validation finale), écran de visa avec POP-UP
  D'ENGAGEMENT R14 (obligatoire à la finale) et refus motivé R7 — chaque
  refus du moteur s'affiche avec sa règle (« R14 — … », « R53 — rechargez »).
  Onglet Audit FINMA : REJEU À DATE X-02 (choisir une date → les événements
  connus ce jour-là et les versions du référentiel en vigueur) et PREUVE
  4-YEUX X-05 sur lot (préparateurs vs validateur, verdict par section).
  Tests UI-01..UI-06 (urllib contre le serveur vivant).
- Intégration réelle : implémenter un `EngineAdapter` sur l'engine existant
  (4 commandes + snapshot), instancier `ShadowRunner(maitre, ombre)` autour
  des appels actuels. Rien d'autre ne change.

Reste : UI (corbeilles, dossier, écrans de visa) et branchement des
connecteurs externes (World-Check, GED, core banking) en périphérie.

```
python3 run_tests.py       # domaine : 64 scénarios verts
python3 run_tests_sql.py   # les mêmes sur journal SQL : 8/8 suites
python3 demo_audit.py      # démos FINMA : rejeu à date + extraction par ID
```
