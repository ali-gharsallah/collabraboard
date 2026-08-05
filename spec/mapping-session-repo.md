<!-- SEED DE MAPPING session→repo — §1 RATIFIÉ par Ali Gharsallah le 2026-07-29 (les 9 mappings
     confirmés, grounded repo, sont figés). Le REPO FAIT FOI. Ce fichier est la SEULE source
     autorisée du mapping numéros-session → numéros-repo pour le générateur docs/CANON-MASTER.md.
     Le générateur NE DÉDUIT JAMAIS un mapping : il lit les lignes confirmées ci-dessous ; tout
     numéro hors de cette table est rapporté « mapping non annoté », jamais inventé. Chaque ligne
     est grounded sur un fichier du repo (colonne Preuve). Les entrées À CONFIRMER / DIVERGENCES
     ne sont PAS consommées comme mapping : elles sont listées pour décision ultérieure. -->

# Mapping session → repo (clé de lecture des documents d'Ali)

**Statut §1 : RATIFIÉ (Ali, 2026-07-29).** **§2 : RÉSOLU (Ali, 2026-07-29)** — identité Olivia + Home sans numéro. §3 (divergences structurelles) reste ouvert.

## 1. Mappings CONFIRMÉS — RATIFIÉS (grounded repo — consommés par le générateur)

Format machine : le générateur lit les lignes `| Rxxx | Ryyy | … |` de CETTE section uniquement.

| Session | Repo | Objet | Familles | Preuve (repo) |
|---------|------|-------|----------|---------------|
| R325 | R328 | Clôture JWT (jetons réels partout) | JW-01..06 | `spec/canon-vague-cloture-R328-R330.md` |
| R326 | R329 | Tenant démo GWB scripté (zéro if-demo) | DM-01..06 | `spec/canon-vague-cloture-R328-R330.md` |
| R327 | R330 | Readiness + pipeline conditionnel | RZ-01..04 | `spec/canon-vague-cloture-R328-R330.md` |
| R328 | R331 | Registrar inbox→PR de ratification | IX-01..05 | `spec/canon-industrialisation-R331-R334.md` · `tools/registrar/` |
| R329 | R332 | FAT dérivée du catalogue, gate absolue | FB-01..04 | `spec/canon-industrialisation-R331-R334.md` · `tools/fat/` |
| R330 | R333 | BAT cahier généré + signature visa | FB-05..07 | `spec/canon-industrialisation-R331-R334.md` · `tools/bat/` |
| R331 | R334 | Migrations expand/contract | MG-01..05 | `spec/canon-industrialisation-R331-R334.md` · `tools/migrations/` |
| R70  | R95  | Mapping droits (renumérotation étape 0 signalée) | — | doctrine étape 0 (mapping R70→R95 signalé) |
| R222 | R248 | Porte CPSI (enveloppe versionnée) | PC-01..14 | `spec/catalogue-amendement-R248-R252-porte-cpsi.md` |

> **Règle observée** : décalage constant **+3** sur toute la région clôture→industrialisation
> (session R325–R331 ⇒ repo R328–R334). Les renumérotations R70→R95 et R222→R248 sont ponctuelles.

## 2. RÉSOLU (Ali, 2026-07-29) — identité / sans numéro : PAS des renumérotations, donc PAS consommé

Vérifié sur le repo, où la numérotation Olivia est **RATIFIÉE (Ali, 2026-07-27)** dans les en-têtes
des specs. Résultat : ni l'un ni l'autre n'est un décalage session→repo.

| Session | Repo | Verdict | Preuve (repo) |
|---------|------|---------|---------------|
| R253–R266 | R253–R266 | **IDENTITÉ** — aucune renumérotation. Olivia **v1 = R253–R257**, **v1.1 = R258**, **v2 = R259–R266** (familles OL-01..34, SW-01..18). La mention doctrinale « Olivia R253–R266 » nommait la plage, pas un décalage. | `spec/spec-fonctionnelle-home-olivia.md` (en-tête « NUMÉROTATION RATIFIÉE ») · `spec/spec-olivia-v1.1-comportement-v2-agents.md` (en-tête) |
| Home « R253* » | (sans R-number) | **SANS NUMÉRO DE RÈGLE** — décision Ali 2026-07-27 (pattern écrans vagues 1-9) ; invariants portés par **HO-01..08**. Le `*` de session était un placeholder, retiré. | `spec/spec-fonctionnelle-home-olivia.md` (PARTIE A) · `docs/PROJECT-INDEX.md` |

> Conséquence : le générateur teste l'**identité** par défaut pour tout numéro hors §1 ; ces deux
> entrées n'ajoutent **aucune** ligne de mapping (identité triviale / absence de numéro). Rien à
> traduire, rien à consommer — §2 est clos.

## 3. DIVERGENCES structurelles session↔repo (à signaler, pas à absorber)

| Session | Repo | Nature |
|---------|------|--------|
| R332–R334 (On-premise PK-01..06) | **réservé R405+** | L'On-premise packaging (paquet signé autosuffisant) **n'est pas implémenté** au repo. Son créneau présumé (R335–R337 par le décalage +3) a été **réattribué à la robustesse** : R335=RB, R336=LK, R337=IDM, R338=PJ, R339=EV. **DÉCISION Ali (2026-07-29) : PK renuméroté > R339.** **Step-0 (2026-08-04, §4) — révisé par le drop PO `SESSION-2026-08-04.md` : R340–R377 = AML Gap Wave 1, R378–R403 = AML Gap Wave 2 (26 règles, blocs 57–61), R404 = FilterBar (R-FB). La réservation PK (non implémentée) glisse donc à R405+** (même règle que le déplacement R335→R340 : l'implémenté/ratifié prend le créneau contigu, la réservation glisse). Réservation notée ici jusqu'à la spec PK. |
| Industrialisation « R328–R331 » (§4 session) | R331–R334 | La borne haute session (R331) et repo (R334) diffèrent : même décalage +3, mais la plage session couvre 4 numéros pour 4 objets → cohérent une fois décalée. |
| i18n « R323–R324 » (session) | R324–R327 région | `spec/canon-solde-4-ecarts-R324-R327.md` couvre le solde d'écarts + i18n cliquet côté repo aux R324–R327 ; mapping fin à confirmer par relecture du canon. |

## 4. STEP-0 (2026-08-04) — attribution des specs ratifiées PO (04.08.2026)

**Résolution de collision.** Les numéros *provisoires* des specs AML Gap (Wave 1 `R340–R377`,
Wave 2 `R378–R403`) et de la FilterBar (symbole `R-FB`) heurtaient la **réservation *soft***
« R340+ » de l'On-premise (PK), **non implémentée**. Règle appliquée (déjà employée pour PK en
2026-07-29) : *l'implémenté/ratifié prend le créneau contigu, la réservation glisse*.

> **Révision (drop PO `docs/SESSION-2026-08-04.md`, action 1).** Le premier jet de ce step-0 avait
> attribué **R378** à la FilterBar. Le drop PO du même jour introduit **AML Gap Wave 2** (blocs
> 57–61, 26 règles) et lui assigne explicitement **R378–R403**. La FilterBar glisse donc à **R404**
> (numéro non pris par les deux vagues ratifiées), et PK à **R405+**. C'est la seule attribution
> ci-dessous qui fait foi.

Attribution définitive (visa PO au merge) :

| Spec (provisoire) | Repo (définitif) | Objet | Familles | Preuve / source |
|---|---|---|---|---|
| AML Gap Wave 1 R340–R377 | **R340–R377** (identité) | 38 scénarios AML, blocs 50–56 | SF-01..07, QO-01..05, GU-01..04, IP-01..07, CR-01..06, FT-01..05, GV-01..04 | `spec/SPEC-AML-GAP-WAVE1.md` (ratifiée) · `tools/aml-gap/gen_aml_gap.py` |
| AML Gap Wave 2 R378–R403 | **R378–R403** (identité) | 26 scénarios AML, blocs 57–61 (TBML, correspondent banking, prolifération, immobilier & art, analytique 2G) | (blocs 57–61) | `spec/SPEC-AML-GAP-WAVE2.md` (ratifiée) · `tools/wave2_rules.py` |
| FilterBar `R-FB` | **R404** | Barre de filtres uniforme (panneau rétractable + combobox + chips actifs + reset + clés uniques R-FB.4) | FB-01..07 | `spec/SPEC-FILTERBAR.md` (ratifiée) · `apps/web/src/components/FilterBar.tsx` |

**Détail AML Gap Wave 1 (identité provisoire = repo — aucun remap du générateur/dataset/démo) :**

| Bloc | Règles (repo) | Scénarios |
|---|---|---|
| 50 — Screening en flux | R340–R346 | SF-01..07 |
| 51 — Indices OBA-FINMA | R347–R351 | QO-01..05 |
| 52 — Vision groupe UBO | R352–R355 | GU-01..04 |
| 53 — Instruments PB | R356–R362 | IP-01..07 |
| 54 — Crypto / VASP | R363–R368 | CR-01..06 |
| 55 — CFT | R369–R373 | FT-01..05 |
| 56 — Gouvernance du dispositif | R374–R377 | GV-01..04 |

> **Amas contigu après step-0 (révisé)** : R339 (robustesse EV) → **R340–R377** (AML Gap Wave 1)
> → **R378–R403** (AML Gap Wave 2) → **R404** (FilterBar). PK réservé **R405+**. CANON-MASTER
> (`docs/CANON-MASTER.md`, généré) fait foi et **ne montrera ces numéros qu'à mesure de leur
> implémentation réelle** au repo (familles + suites de tests) — le repo fait foi, la table
> ci-dessus est l'attribution, pas l'implémentation.

### 4.1 Réconciliation des générateurs AML Gap (2026-08-04)

Le drop PO ratifie **`tools/gen_aml_gap.py` + `tools/wave2_rules.py`** comme *source de vérité
unique* des règles (Waves 1+2, 64 règles R340–R403) et le corpus **`data/aml-gap-dataset-gt.json`**
(130 cas GT : 66 TP / 64 FP). Ces fichiers sont **versés tels quels** (visa PO). Deux rôles
coexistent, liés par un test de parité — pas deux vérités concurrentes :

| Fichier | Rôle | Portée |
|---|---|---|
| `tools/gen_aml_gap.py` · `tools/wave2_rules.py` · `data/aml-gap-dataset-gt.json` | **Canon PO ratifié** (définitions de règles + corpus GT) | Waves 1+2 (R340–R403) |
| `tools/aml-gap/gen_aml_gap.py` (+ `.gen.ts` émis) | **Émetteur Nest/React** in-repo (référentiel + GT + seed web, enrichi de `ecartement` + payloads déterministes) | Wave 1 (R340–R377) |

- **Parité prouvée** : `test_gen_aml_gap.py` AG-17/AG-17b vérifie que la tranche Wave 1 de l'émetteur
  (mêmes règles, mêmes cas GT scénario/label/narratif) **égale le canon PO** — toute dérive rougit.
- **Divergence documentée** : GV-04/FP est un *placeholder vide* côté émetteur (« ») et « — » au canon
  (même sémantique : cas laissé vide par la spec). Les enrichissements de l'émetteur (`ecartement`,
  payloads synthétiques) n'existent pas au canon PO — ils servent le backend/front implémentés.
- **Runnable in-repo (2026-08-04, action 6 « brancher la ré-émission »)** : les chemins absolus
  `/home/claude/olive/` du générateur PO ont été **portés en chemins relatifs au dépôt** (logique
  inchangée). `python3 tools/gen_aml_gap.py` régénère `data/aml-gap-dataset-gt.json` (byte-identique
  au versé — no-drift prouvé), `data/c50gap.gen.js` (bloc démo) et `spec/generated/aml-gap-wave{1,2}-sections.md`.
  Garde CI **3d** (`test_gen_aml_gap.py`, 24/24) : invariants + fraîcheur des artefacts émis + parité
  canon PO + régénération sans dérive + registre R-Q (AG-19). Le **backend/front Wave 2** (détecteurs
  statistiques exécutés dans le service Python CPSI — jamais réécrits en Nest) reste un lot ultérieur.

### 4.2 — Registre R-Q + spécification exécutable (Addendum 2 du 2026-08-04)

- **Action 5 « inscrire les paramètres tenant au registre R-Q » : FAIT.** Les 80 paramètres tenant
  des 64 règles (R340–R403) sont **émis par le générateur** dans
  `apps/api/src/modules/parametres/aml-gap.rq.gen.ts` (`AML_GAP_RQ`) puis **étalés dans `REGISTRE_RQ`**
  (`parametres.service.ts`). Le questionnaire R-Q les expose donc directement (write-path typé, motivé,
  daté, jamais rétroactif — R125/R7/R29/R126). Défauts `tenant` → `requis: true`, `type: json`,
  `exemple: []` : **pas de défaut silencieux** (bonType exige une réponse au go-live). Dérivé des
  params du référentiel — jamais saisi à la main ; invariant **AG-19** au test du générateur.
  Vérifié : `parametres.wiring.spec` (RQ-01..07) et `apps/api` typecheck restent verts.
- **Artefacts PO versés tels quels** (visa PO) : `data/registre-rq-aml-gap.{md,json}` (questionnaire
  des 80 params), `data/rules-catalog-aml-gap.json` (64 règles machine-readable : Gherkin, params, GT).
- **Suites Gherkin** `backend-tests/aml-gap/` (12 blocs 50–61 + `contract.ts`/`fixtures.ts`/`README`) :
  spécification exécutable. Livrées rouges par construction, **rendues vertes pour les blocs 50–60**
  (voir §4.3).

### 4.3 — Moteur d'évaluation (blocs 50–60) + Analytique 2G déférée CPSI

- **`src/aml/engine.ts` — `evaluateScenario(scenarioId, facts, params?)`** : MESURE des faits contre
  les paramètres tenant effectifs (registre R-Q, défauts surchargés par la valeur tenant), retourne
  un `ScenarioResult` explicable. **N'exécute rien, ne décide rien (R44)** — l'appelant en fait un
  événement qu'un humain qualifie (TP/FP). `blocking` n'est vrai que si le signal est levé.
- **`src/aml/detectors.ts`** : le JUGEMENT de détection (code, pas data) — un détecteur par scénario
  (R340–R398), comparant la mesure au paramètre dans le SENS de son Gherkin (gte/lte/gt, ou match de
  référentiel/liste tenant). **`src/aml/aml-gap.meta.gen.ts`** (généré) porte niveau/blocking/signal/
  params/`deferred` ; niveau `None` (campagnes GV) → `0`.
- **Fixtures GT** (`backend-tests/aml-gap/fixtures.ts`) : les faits déclencheurs proviennent du
  détecteur du scénario — moteur et fixtures **ne peuvent pas diverger**. TP ET FP déclenchent (le FP
  est une alerte légitime écartée en investigation, pas une non-alerte — décision 5).
- **État : blocs 50–60 VERTS** (11 suites, **179 tests**) — `pnpm --filter @olive/api test:aml-gap`,
  step CI **3e**. **Bloc 61 (Analytique 2G, R399–R403) RESTE ROUGE, à dessein** : `meta.deferred` →
  le moteur lève `CpsiDeferredError`, la fixture échoue avec le motif CPSI. Les détecteurs
  statistiques (z-score robuste, changepoint, dormance) **s'exécutent dans le service CPSI Python —
  jamais réécrits en Nest** (décision 4) ; le bloc 61 est **exclu du step CI Nest** et le sera
  jusqu'à la livraison du pont CPSI (Postgres/Redis/CPSI). Garde générateur : invariant **AG-20**
  (méta émise, AN-* deferred) — `test_gen_aml_gap.py` 25/25.
- **Détecteurs 2G livrés côté CPSI Python** (là où l'invariant les place) :
  `services/cpsi-server-py/olive_cpsi/analytique_2g.py` — les 5 détecteurs R399–R403 en **statistiques
  robustes, NumPy-free** : AN-01 z-score médiane/MAD (dispersion insensible aux outliers), AN-02
  changepoint baseline↔fenêtre récente, AN-03 first-time × matérialité (Niveau 1, non bloquant, R39),
  AN-04 réactivation de segment dormant, AN-05 mismatch revenus entrants ↔ KYC. Chaque détecteur
  MESURE et retourne un résultat explicable (R44). Tests : `tests/test_cpsi_bloc20.py` — 13 tests qui
  vérifient la **discrimination** (le déviant déclenche, le normal NON — contrairement au corpus GT).
  Exécutés par `run_tests.py` (step CI **5c**, désormais **20/20**, 17 tests au bloc 20 : 13
  discrimination + 4 pont).

### 4.4 — Pont Nest↔CPSI (bloc 61) + couche de détection (Postgres/Redis/CPSI réels)

Le **pont** est livré et vérifié de bout en bout contre Postgres + Redis + le moteur CPSI Python réels.

- **Transport** : la commande d'enveloppe CPSI **`aml_gap_2g`** (R248, contrat 1.1, PC-17) est ajoutée
  au pont `services/cpsi-server-py/bridge.py` — elle dispatche vers `DETECTEURS_2G` (aucune règle
  dupliquée). Scénario/observation invalide → `erreur_typee` (default-deny), jamais un 500.
- **Porte Nest** : `CpsiService.evaluerAmlGap2G(ctx, scenario, observation, params, asOf?)` délègue au
  moteur via le worker NDJSON existant (`bridge.py --serve`). `AmlGapService.evaluer2G` résout les
  seuils tenant (R-Q, version en vigueur R29), délègue à CPSI, et — si le signal est levé — le
  PERSISTE par le chemin commun (`enregistrerSignal` : append-only, idempotent, RLS, événement,
  blocage éventuel). Un scénario des blocs 50–60 est REFUSÉ ici (garde d'invariant : il s'évalue en
  Nest). Endpoint **`POST /v1/aml/signals/evaluate-2g`**. Le service dépend d'un PORT minimal
  (`AmlGap2GPort`), pas du module CPSI concret — le harnais fakePrisma reste léger.
- **Vérifié (infra réelle)** : e2e `fat-aml-gap-2g.e2e-spec.ts` **5/5** — AN-01 déviant lève et
  persiste un signal explicable (R44), AN-05 cohérent ne déclenche rien, idempotence (R48), garde
  d'invariant (SF-01 refusé), observation incomplète → 4xx typé. CPSI e2e `fat-cpsi` **28/28**.
  Postgres 16 (schéma + RLS post-deploy, `aml_gap_signals`/`cpsi_events`) + Redis + worker CPSI
  montés localement pour la recette.
- **Corpus GT en base** (matière du worker aml-eval + Olivia) : `POST /v1/aml/ground-truth/seed`
  (`AmlGapService.seedGroundTruth`) sème les **130 cas** (66 TP / 64 FP) du corpus généré dans
  `ground_truth_cases` — **idempotent** par (tenant, caseId), **RBAC** (rôles qualif, R13),
  **tenant-scopé** (RLS). Le clientId synthétique du corpus (« CLI-… », non-UUID) va au payload, la
  colonne `client_id` (uuid) reste null. `GET /v1/aml/ground-truth/db?fam=&label=&scenarioCode=` lit
  le corpus semé. Vérifié : e2e `fat-aml-gap-gt.e2e-spec.ts` **5/5** (seed, idempotence, filtres,
  isolation tenant, refus RM) contre le vrai Postgres.
- **Worker aml-eval (backtest / rappel)** : `AmlEvalService.backtest` rejoue le corpus GT semé à
  travers le moteur de détection blocs 50–60 **côté serveur** — le moteur (`src/aml/engine` +
  `detectors`) est IMPORTÉ, pas redéfini (source unique, partagée avec les suites backend-tests).
  Faits déclencheurs = `detector.trigger()` du scénario ; paramètres tenant en vigueur (R29). Mesure
  le rappel global + par famille : sémantique du corpus (décision 5) ⇒ **TP ET FP déclenchent**,
  rappel attendu **100 %** — un miss = régression de détecteur/paramètre. **R39 (mesurer, pas
  coercer)** : le backtest N'INONDE PAS l'inbox — il émet `aml.eval.completed` (auditable) et rend
  un rapport `{ recall, parFamille, deferred2G, misses }`. Bloc 61 **différé** (le corpus ne porte
  pas d'observation statistique). `POST /v1/aml/eval/backtest`. Vérifié : e2e `fat-aml-eval` **3/3**
  (rappel 100 %, 0 signal inbox + événement émis, 400 si corpus non semé) contre Postgres réel.
- **Détection LIVE** (`AmlEvalService.evaluerClient`, `POST /v1/aml/eval/client`) : les FAITS RÉELS
  d'un client sont évalués contre les scénarios de détection des blocs 50–60 (paramètres tenant en
  vigueur, R29) et chaque déclenchement PERSISTE un signal dans l'inbox par le chemin commun
  (`enregistrerSignal` — append-only, idempotent, `aml.block.requested` si bloquant). Un scénario
  dont les faits requis sont absents ne déclenche pas (NaN → false, aucun faux positif par omission).
  Idempotence **stable** : les faits scellés dérivent des faits d'entrée + de la mesure, jamais de
  l'instant d'évaluation (l'`asOf` volatile est retiré du payload avant le hash — sinon deux
  évaluations identiques créeraient deux signaux). Bloc 61 refusé ici (→ `evaluate-2g`). Vérifié :
  e2e `fat-aml-live` **6/6** (déclenchement + inbox, sous-seuil silencieux, bloquant → block.requested,
  idempotence, balayage multi-scénarios, garde 2G).
- **Backtest complet (bloc 61 inclus)** : les **fixtures d'observation 2G** (`aml-2g-fixtures.ts`)
  fournissent une observation déterministe et déclenchante par scénario AN — l'analogue 2G du
  `detector.trigger()`. Le backtest route désormais les cas du bloc 61 par `AmlGapService.mesurer2G`
  (MESURE seule, sans persistance, R39) → pont CPSI. `mesurer2G` ne passe au détecteur que les seuils
  tenant **numériques** en vigueur ; les paramètres `list`/`tenant` (chaînes non renseignées ou
  référentiels) retombent sur le défaut du détecteur CPSI. Résultat : `fat-aml-eval` mesure **130/130
  cas, rappel 100 %** dont **10 via CPSI** (`via2G`), `deferred2G = 0`, la famille **AN** apparaît au
  rapport. `evaluer2G` (détection live) partage `mesurer2G` (DRY). CPSI 20/20, AML e2e 4 suites 19/19.
- **Gouvernance du tuning — backtest par version (GV-02, R375)** : `AmlEvalService.backtestVersion`
  (`POST /v1/aml/eval/backtest-version`) rejoue le corpus (blocs 50–60) sous les seuils EN VIGUEUR
  (baseline) puis sous une VERSION CANDIDATE (`overrides`) et compare le rappel. R44/R39 : il MESURE
  et PROPOSE un rollback si le rappel se dégrade (`rollbackPropose`), il n'applique rien — la décision
  est humaine ; la comparaison émet `aml.eval.version_compared` (auditable). Rapport :
  `{ recallBefore, recallAfter, degradation, rollbackPropose, regressions, improvements, scenariosTouches }`.
  Vérifié : e2e `fat-aml-tuning` **3/3** (seuil PEP relevé 78→95 ⇒ SF-01 régresse, rappel 100→98 %,
  rollback proposé ; seuil abaissé ⇒ rappel stable ; overrides vide ⇒ 400).
- **Gouvernance du tuning — campagne Below-The-Line (GV-01, R374)** : `AmlEvalService.campagneBTL`
  (`POST /v1/aml/eval/btl`) échantillonne les transactions JUSTE SOUS le seuil d'un scénario pour
  revue Compliance. Config de campagne = paramètres GV-01 (bande `bande_btl` en % du seuil, taux
  `taux_echantillon_btl`) ; seuil = premier paramètre numérique du scénario cible (R29). Bande
  `[80 % du seuil, seuil)` (au-delà = déjà en alerte). Échantillon **stratifié déterministe**
  (couverture régulière de la bande triée, aucun RNG → rejouable). R44/R39 : la campagne PROPOSE un
  échantillon, l'humain revoit ; un TP sous seuil ⇒ proposition de baisse via `backtest-version`
  (boucle fermée avec GV-02). Émet `tuning.btl.campagne`. Bloc 61 refusé (campagne CPSI). Vérifié :
  e2e `fat-aml-btl` **4/4** (bande seule échantillonnée, taille `ceil(inBand×taux)`, déterminisme,
  bande vide ⇒ échantillon vide, garde 2G).
- **Gouvernance du dispositif — contrôle Data-Quality (GV-03, R376)** : `AmlEvalService.controleDQ`
  (`POST /v1/aml/eval/dq`) mesure la COMPLÉTUDE des champs critiques d'un lot de flux ; sous
  `completude_min` (R-Q GV-03, 98 %), les scénarios DÉPENDANTS (`dependances` tenant) sont marqués
  « dégradés » et un signal **DQ_DEGRADED (Niveau 1, ops)** est PERSISTÉ dans l'inbox — visible,
  JAMAIS silencieux (R39 : un scénario aveugle = faux négatif silencieux). Le rapport `parChamp` est
  toujours rendu (mesure), dégradation ou non ; idempotent (R48). Émet `dq.degraded`. Vérifié : e2e
  `fat-aml-dq` **4/4** (ordonnateur 92 %<98 % ⇒ DQ_DEGRADED + scénarios dépendants ; 100 % ⇒ aucun
  signal, rapport rendu ; idempotence ; `champsCritiques` vide ⇒ 400).

Bloc 56 (gouvernance du tuning) désormais opérationnel : **GV-01 BTL** ✓, **GV-02 backtest par
version** ✓, **GV-03 DQ** ✓ — reste GV-04 (revue annuelle de calibrage, consolidation de rapport).

- **Ce qui reste** : les suites **Gherkin Nest du bloc 61** restent volontairement rouges (le pont
  HTTP/DI couvre le bloc 61, prouvé par `fat-aml-gap-2g` + le backtest). Lots dédiés restants :
  **dispatch asynchrone** (file Redis quand `REDIS_URL`, in-process sinon — doctrine du rate-limit)
  et **GV-04** (revue annuelle de calibrage : matrice de couverture typologique × scénarios).
