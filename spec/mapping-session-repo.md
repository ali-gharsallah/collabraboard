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

- **Revue annuelle de calibrage (GV-04, R377)** : `AmlEvalService.revueCalibrageAnnuelle`
  (`POST /v1/aml/eval/calibrage-annuel`, rôles compliance four-eyes) consolide la COUVERTURE (64
  scénarios × 12 familles, matrice `matrice_couverture` = GAFI+OBA-FINMA), la PERFORMANCE par
  scénario (corpus GT + signaux live TP/FP/NEW/ESCALATED, version en vigueur) et les ÉCARTS (angles
  morts sans matière ; **placeholders documentés** laissés vides par la spec — surfacés, jamais
  comblés ni comptés comme perf). R44 : le système consolide et propose ; le visa four-eyes +
  l'archivage GED restent humains. Émet `tuning.calibrage.annuel`. Vérifié : e2e `fat-aml-calibrage`
  **4/4** (couverture 64/64 · 12 familles, placeholder GV-04 surfacé hors perf, TP live remonté, RM
  refusé). **Bloc 56 gouvernance COMPLET** : GV-01 BTL ✓, GV-02 backtest-version ✓, GV-03 DQ ✓,
  GV-04 calibrage ✓.
- **Correctif d'intégrité (append-only) mis au jour par l'e2e réel** : `aml_gap_signals` avait été
  ajouté à tort à la boucle d'immuabilité append-only (post-deploy-v2.sql), mais le signal
  TRANSITIONNE (NEW→TP/FP à la qualification humaine R44) — l'`UPDATE` du qualificateur était donc
  bloqué au niveau DB (jamais détecté : le harnais fakePrisma n'a pas les triggers, aucun e2e ne
  qualifiait). Corrigé comme `risk_cases`/`tx_verdicts` : la table est un agrégat qui transitionne,
  la vérité append-only étant le journal `domain_events` (aml.signal.raised/qualified). Isolation RLS
  d'`aml_gap_signals` inchangée ; recette `rls-runtime` verte.

- **Dispatch asynchrone** (`aml-eval.queue.ts`) : file de travail **PAR TENANT** — `MemoryQueue`
  par défaut (mono-instance), `RedisQueue` dès que `REDIS_URL` est posé (ioredis chargé
  dynamiquement, sous-ensemble `RedisQueueMinimal` — MÊME doctrine que le rate-limit login-rate).
  `enqueueClient` met en file sans rien calculer (R39 : ne bloque pas le flux) ; `drain` (tick du
  worker) traite la file DU TENANT (jamais celle d'un autre) → signaux persistés, borné par `max`.
  L'auteur du signal reste le jeton qui a mis en file. `POST /v1/aml/eval/client-async` +
  `POST /v1/aml/eval/drain`. Vérifié : e2e `fat-aml-async` **4/4** (enqueue ne calcule rien puis
  drain → 3 signaux ; drain à vide ; isolation tenant ; borne `max`). Le chemin Redis est présent
  mais non exercé ici (ioredis absent du store, comme pour le rate-limit — seul le chemin mémoire est
  testé en CI).

Couche détection AML gap **complète** sur infra réelle : seed → détection (live + backtest, blocs
50–60 en Nest + bloc 61 via CPSI) → qualification → mesure de rappel → tuning (BTL / backtest par
version / DQ) → revue de calibrage → dispatch async. Il ne reste que les **suites Gherkin Nest du
bloc 61**, volontairement rouges (le pont HTTP/DI les couvre, prouvé par `fat-aml-gap-2g` + le
backtest).

## 5 — i18n AML gap + 5e langue (arabe) — drop du 2026-08-04

**Contradiction du drop, arbitrée PO.** Le drop portait trois définitions incompatibles de la 4e
langue : IT (repo live R323–R327 + `GLOSSAIRE-AML-4L.md` CONTRAIGNANT + `i18n-aml-gap.json` +
`_quarantine-a-arbitrer/README.md`) vs **AR** (`SPEC-I18N.md`, se disant « ratifié », dégradant l'IT).
Écart NON résolu silencieusement (surfacé au PO). **Décision PO : « Both »** — l'IT reste, l'**arabe
devient la 5e langue** (résout E-FB-4, décision produit/marché au-delà de R323–R327).

**Livré (front) :**
- Artefacts versés : `data/GLOSSAIRE-AML-4L.md` (glossaire CONTRAIGNANT), `data/i18n-aml-gap.json`
  (traductions PO), `spec/SPEC-I18N.md` ; la quarantaine → `tools/i18n-ar-extraction/` (extraction AR
  partielle, non fusionnée au runtime — matière de la relecture AR).
- `lib/i18n.ts` : **AR ajouté en 5e langue** (`Langue`, `LANGUES`) + helper `estRTL`. L'arabe n'a PAS
  de contenu (le glossaire contraignant n'a pas de colonne AR) → **repli FR propre** (jamais un trou),
  exactement comme une clé manquante. Le cliquet `rapport-i18n.js`/FE-I18N-2 reste **0 écart** (il
  contrôle EN/DE/IT ; l'AR est une langue neuve dont le contenu relève d'une relecture humaine).
- `lib/i18n-aml-gap.gen.ts` (généré de `data/i18n-aml-gap.json`) : **familles + libellés UI** (chrome)
  EN/DE/IT, fusionnés au dictionnaire. Le **contenu des 64 règles (nom/desc) N'EST PAS bundlé**
  (SPEC-I18N §3 : le front affiche le contenu métier, il ne le traduit pas ; budget bundle tenu,
  219/220 kB gz) — servi à terme par l'API (`AmlScenario.i18n` versionné R29).
- Shell (`router.tsx`) : `dir=rtl`/`lang` sur `<html>` en arabe (géométrie logique, données LTR
  verbatim intactes) ; le sélecteur expose AR via `LANGUES`. `AmlGap.tsx` : familles traduites (`famLbl`).
- Tests : FE-I18N étendu (familles EN/DE/IT ; AR ratifiée + RTL + repli FR). vitest **99/99**, budget +
  cliquet i18n verts, `vite build` OK, eslint OK.

### 5.1 — i18n des règles SERVIE PAR L'API (SPEC-I18N §3, 2026-08-05)

SPEC-I18N §3 (« le front ne traduit pas le contenu métier, il l'affiche ») appliqué : le **contenu
des règles** (nom/desc EN/DE/IT, source PO `data/i18n-aml-gap.json`) voyage désormais **avec le
référentiel servi par l'API**, jamais bundlé au front (budget), jamais fabriqué à la main.

- **Générateur** (source unique) : `_attach_i18n(rules)` — appelé DANS `build()` (déterminisme :
  même sortie à chaque build, freshness AG-15/AG-18 intacte) — lit la source PO et attache
  `rule.i18n = { en, de, it }` (nom+desc) au **référentiel backend** (`aml-gap.referentiel.gen.ts`
  + `aml-gap-rules.json`). Le **seed web** (`aml-gap.seed.gen.ts`, émis par sélection de champs) ne
  reçoit **PAS** `i18n` → bundle inchangé (**219,1/220 kB gz**). Le Gherkin reste **FR** (normatif) ;
  l'**AR n'a aucun contenu** (glossaire CONTRAIGNANT sans colonne AR) et n'est jamais posé.
- **Types** : `AmlGapRule.i18n?` (interfaces `AmlGapI18nEntry`/`AmlGapI18n`) ; `AmlGapScenarioSeed.i18n?`
  (déclaré pour les scénarios venant de l'API, jamais bundlé).
- **API** : `AmlGapService.referentiel()` projette `i18n: r.i18n` ; `GET /v1/aml/scenarios` le sert.
- **Front** : `AmlGap.tsx` — `ruleNom`/`ruleDesc` consomment `s.i18n?.[langue]?.nom ?? s.titre`
  (repli FR/AR sur le libellé normatif — « jamais un trou »). Aucune donnée de traduction bundlée.
- **Garde générateur** : **AG-21** — i18n PO présente au référentiel (EN/DE/IT nom+desc non vides),
  **absente** du seed web, **AR jamais** posé. Self-test **26/26**.
- **e2e réel** : `fat-aml-i18n.e2e-spec.ts` (2) — `GET /v1/aml/scenarios` porte les traductions
  EN/DE/IT ; Gherkin FR conservé ; AR absent. Suite AML e2e **10 suites / 40 tests** vertes.

### 5.2 — i18n VERSIONNÉE sur `AmlScenario`, servie à date (SPEC-I18N §3 pt 4 + DoD §3, 2026-08-05)

SPEC-I18N §3 point 4 (« `AmlScenario` gagne un champ `i18n Json` versionné avec la règle — une
traduction de règle est un changement versionné par date de vigueur, R29 ») + DoD §3 point 3
(« Backend : `i18n` versionné sur les scénarios, servi par l'API ») appliqués. Le §5.1 servait la
traduction PO *par défaut* (constante générée) ; ce lot ajoute la **surcharge tenant grandfatherée
par date** (même mécanique que `params`, R29).

- **Schéma** : `AmlScenario.i18n Json?` (nullable, expand-only ; `aml_scenarios` déjà couvert RLS
  post-deploy-v2.sql). Appliqué par `prisma db push` — chemin établi de toute la vague AML gap
  (aucune migration dédiée : la table elle-même n'en a pas, cohérence préservée).
- **Service** : `referentielEnVigueur(ctx, date)` — base = référentiel généré (défaut PO) ; pour
  chaque code, la version active la plus haute dont `effectiveFrom ≤ date` **qui porte un `i18n`**
  surcharge la traduction (nom/desc) et remonte `version`. Surcharge **ciblée** (un code à la fois),
  Gherkin FR intact, jamais inventé. `versionEnVigueur` remonte aussi l'`i18n` en vigueur.
- **API** : `GET /v1/aml/scenarios?date=` (défaut : now) → `referentielEnVigueur(r.ctx, date)`. Le
  front (`useApiOrSeed`) consomme l'API en ligne (i18n live) et retombe sur le seed FR hors-ligne.
- **Gardes** : wiring fakePrisma **+3** (défaut PO servi ; override grandfatheré avant/après vigueur ;
  `versionEnVigueur` porte l'i18n) → **28/28**. e2e `fat-aml-i18n` **+1** (I18N-3 : override tenant
  versionné servi à date contre Postgres réel, surcharge ciblée) → **10 suites / 41 tests**.
- Front : budget/vitest inchangés (réponse API gagne `version`, champ additif inoffensif). tsc OK.

*Reste inchangé (relecture humaine, SPEC-I18N §4)* : contenu AR pro, colonne AR glossaire, audit RTL
par écran + formats `ar`.

### 5.3 — Formats localisés (nombres/dates) par langue d'affichage (SPEC-I18N §3 + DoD §2, 2026-08-05)

SPEC-I18N §3 (« Locales de formatage : fr-CH, en-GB, de-CH, ar — dates, nombres, CHF ; chiffres
arabes occidentaux par défaut ») + DoD §2 (« formats fr-CH/de-CH/en-GB/ar corrects »). Constat :
`formatMontant` existait mais **sans aucun appelant**, et les surfaces dynamiques figeaient `"fr-CH"`
(voire, `VisaBadge`, un `toLocaleString()` **sans locale** — non déterministe, ignorant la langue).

- **`lib/i18n.ts`** : `localeDe(l, {chiffresArabesOrientaux?})` mappe la langue d'affichage sur sa
  locale BCP-47 (FR→fr-CH, EN→en-GB, DE→de-CH, IT→it-CH, AR→**`ar-u-nu-latn`**). L'arabe formate en
  **chiffres occidentaux par défaut** (spec) ; l'opt-in tenant `chiffres_arabes_orientaux` →
  `ar-u-nu-arab` (٠١٢…). Helpers `formatNombre` / `formatDate` (Intl, options passthrough). Le
  formatage ≠ contenu : l'AR ici est un socle **nombres/dates**, aucune traduction fabriquée (la
  relecture AR reste sur le CONTENU, §4).
- **`VisaBadge`** : l'horodatage du visa suit désormais la langue (`formatDate(signeAt, langue(),
  {dateStyle,timeStyle})`) — corrige le `toLocaleString()` sans locale.
- **Périmètre** : les écrans `src/parity/*` gardent `fr-CH` **à dessein** (parité VERBATIM maquette,
  tests de parité) — ils ne sont pas retouchés. Le socle sert les surfaces câblées i18n.
- **Tests** : FE-LN **+3** — `localeDe` (5 langues + opt-in oriental) ; nombre par locale (virgule
  en-GB / apostrophe de-CH / espace fr-CH ; AR en chiffres occidentaux, orientaux sur opt-in) ; date
  par locale (ordre/séparateur EN vs DE ; AR occidental). vitest **104/104**, budget **219,4/220**,
  `vite build` OK, eslint des fichiers touchés OK.
  *(Gate lint/typecheck web = `continue-on-error` en CI et rouge au baseline — 2093 erreurs
  pré-existantes, pas de tsconfig web ; les vraies portes web sont `vite build` + `vitest`.)*

**Reste (lots dédiés, relecture humaine CONTRAIGNANTE avant BAT — SPEC-I18N §4) :** contenu AR (UI +
familles + règles) traduit et relu par un locuteur pro ; colonne AR au glossaire ; audit RTL écran
par écran + formats `ar` (Intl). *(i18n des règles servi par l'API : LIVRÉ — cf. §5.1.)*

### 5.4 — PASSE ARABE du CHROME AML gap (machine, SPEC-I18N §2, 2026-08-05 — décision PO « skip review »)

Le PO a levé la garde de relecture humaine pour AVANCER (« skip human review and next »). SPEC-I18N §2
prévoit explicitement une **« passe de traduction Claude Code »** suivie de relecture. Livré ici : la
passe **MACHINE (MSA)** du **CHROME AML gap** — 12 familles + 18 libellés UI — l'arabe devient une
langue d'UI effective (plus seulement un repli FR). **Provenance conservée honnêtement** : ces chaînes
sont étiquetées *traduction machine en attente de relecture pro avant BAT* (en-tête généré + note de
la source PO) — le repo ne PRÉTEND à aucune ratification qui n'a pas eu lieu ; le repli FR reste sous
chaque clé absente (« jamais un trou »).

- **Source unique** : `data/i18n-aml-gap.json` gagne la clé `ar` par entrée `familles`/`ui` (add-only,
  30 chaînes). Le **CONTENU des règles reste sans AR** (repli FR) — hors périmètre de cette passe.
- **Générateur** : le chrome `apps/web/src/lib/i18n-aml-gap.gen.ts` (jusqu'ici émis par un one-off
  **non versionné**) est désormais produit par `gen_aml_gap.py::_emit_web_chrome_i18n` — dette « pas de
  générateur » **résorbée**, source unique rétablie. `AmlGapLang` = `EN|DE|IT|AR`. EN/DE/IT **byte-à-byte
  inchangés** (régénération additive).
- **`lib/i18n.ts`** : la boucle de fusion AML gap inclut désormais `AR` → le chrome AR alimente `DICT.AR`.
- **Garde** : self-test **AG-22** (chrome à jour + AR complet sur familles+UI + type à 4 langues) →
  **27/27**. FE-I18N mis à jour (AR chrome traduit ; nav générale + contenu règles toujours repli FR).
  vitest **104/104**, cliquet EN/DE/IT **0 écart**, `vite build` OK.
- **⚠ Budget bundle relevé 220 → 224 kB gz** (`verifier-budget-bundle.js`) : l'AR, **5e langue d'UI
  ratifiée**, fait entrer son chrome dans le bundle (à 220,003 kB, 3 octets au-dessus). Relève **motivée
  et visible** (mécanisme prévu par la doctrine du script : « relever = commit motivé qui édite CES
  constantes, jamais un contournement ») — le contenu des règles reste servi par l'API, jamais bundlé.
  **À viser par le PO.** Mesure gzip réelle + blocage CI intacts (nouveau plafond 224).

*Reste (relecture pro AR avant BAT)* : validation du chrome AR par un locuteur ; AR de la nav générale
(EXT/ECRANS) + du contenu des règles ; colonne AR au glossaire ; audit RTL par écran.

### 5.5 — PASSE ARABE de la NAV PRINCIPALE (machine, SPEC-I18N §2, 2026-08-05 — « skip review »)

Suite du §5.4 : la **navigation principale** (barre latérale) devient arabe. Sélectionner AR
transforme désormais le chrome de tête de l'app (au-delà des seules familles AML gap). Toujours une
passe **MACHINE (MSA)** en attente de relecture pro — provenance en clair dans `lib/i18n.ts`.

- **`lib/i18n.ts`** : `DICT.AR` (jusqu'ici `{}` → repli FR) reçoit les **53 libellés de nav de base**
  (Accueil→الرئيسية, Clients & Relations→العملاء والعلاقات, Compliance & Risque→الامتثال والمخاطر, …).
  Noms de produits/acronymes internationaux conservés (Octopulse, PMS, Olivia, KYC, API). Édition d'un
  fichier **source** (hand-authored, pas un artefact généré) — cohérent avec la doctrine « clé FR ».
- **Périmètre** : base nav uniquement. La sous-nav ÉDITEUR (`EXT`) et les contenus d'écrans (`ECRANS`)
  restent sans AR → **repli FR PROPRE** (« jamais un trou »), prochaine passe.
- **Garde** : FE-I18N mis à jour (nav AR servie : `Accueil`/`Compliance & Risque` ; EXT/ECRANS toujours
  repli FR — assertions ciblées `Profilage CPSI`/`Se reconnecter`). vitest **104/104**, cliquet
  EN/DE/IT **0 écart** (l'AR n'est pas dans le cliquet ratifié — c'est une passe machine, pas la garde
  EN/DE/IT). **Budget 220,6/224 kB gz** (sous le plafond relevé au §5.4 ; pas de nouvelle relève).
  `vite build` OK, eslint `i18n.ts` OK.

### 5.6 — « PULL AR OUT » : pack de langue arabe à CHARGEMENT PARESSEUX (décision PO, 2026-08-05)

Le PO a choisi de **sortir l'AR du bundle de base** plutôt que de relever le budget (§5.4). Le budget
revient à **220** ; l'arabe reste la 5e langue mais son contenu ne pèse plus sur le **chargement
initial** — il est téléchargé **à la demande** par les seuls utilisateurs qui choisissent l'arabe.

- **Split** : le CHROME AML gap AR quitte `i18n-aml-gap.gen.ts` (redevenu **EN/DE/IT statique**) pour
  un fichier généré dédié `i18n-aml-gap.ar.gen.ts` (import **dynamique** seulement). La NAV AR quitte
  `DICT.AR` (redevenu `{}`) pour `lib/i18n-ar.ts`. Ce pack `AR_PACK` (nav + chrome) est le **seul**
  importeur du fichier AR généré → il forme un **chunk séparé** (`i18n-ar-*.js`, ~2,0 kB gz).
- **Chargement** : `i18n.ts::chargerAR()` (idempotent) `import()`e le pack et fusionne dans `DICT.AR` ;
  `arEstCharge()` expose l'état. Le shell l'attend **au clic langue** (`onClick` async) et **au montage**
  si l'AR est déjà persistée (puis re-rend). Avant chargement → repli FR PROPRE (« jamais un trou »).
- **Budget** : `verifier-budget-bundle.js` **revient à 220** ; il **exclut** les packs de langue
  paresseux (`i18n-ar-*`) du total **core**, les **mesure et affiche à part** (transparence, pas un
  contournement). Résultat : **core 219,3/220** + **packs langue 2,0 kB** (à la demande). Ajouter une
  langue paresseuse n'inflate plus le core. *(La relève 220→224 du §5.4 est ainsi ANNULÉE.)*
- **Gardes** : self-test **AG-22** ré-outillé (statique EN/DE/IT **sans AR** + pack AR généré complet)
  → **27/27**. FE-I18N réécrit (repli FR **avant** `chargerAR()`, servi **après**). vitest **104/104**,
  cliquet EN/DE/IT **0 écart**, `vite build` OK, eslint OK.

*Reste (relecture pro AR avant BAT)* : validation des passes machine ; AR de la sous-nav ÉDITEUR
(`EXT`) + écrans (`ECRANS`) + contenu des règles (à ajouter dans le même pack paresseux) ; colonne AR
au glossaire ; audit RTL par écran.

### 5.7 — AR de la sous-nav ÉDITEUR (`EXT`) dans le pack paresseux (machine, 2026-08-05)

Extension du pack de langue paresseux (§5.6) : les **53 libellés de la sous-nav ÉDITEUR/ADMIN**
(`EXT`) passent en arabe → **le sidebar complet** (nav de base §5.5 + sous-nav éditeur) s'affiche en
arabe. Passe **MACHINE (MSA)**, produits/acronymes conservés (CPSI, Olivia, MROS, KYC, BRM, SSO, IAM,
BAT, AML Gap). **Coût bundle core = 0** : `EXT_AR` rejoint `AR_PACK` dans `lib/i18n-ar.ts` (chunk
paresseux). Reste sans AR : écrans (`ECRANS`) + contenu des règles → repli FR (prochaine passe).

- **Gardes** : FE-I18N (sous-nav AR servie : `Profilage CPSI`→تنميط CPSI ; `ECRANS` toujours repli
  FR — `Se reconnecter`). vitest **104/104**, **core 219,4/220** + **pack langue 2,9 kB gz** (à la
  demande), cliquet EN/DE/IT **0 écart**, `vite build` OK, eslint OK.

### 5.8 — AR des CONTENUS D'ÉCRANS (`ECRANS`) dans le pack paresseux (machine, 2026-08-05)

Extension du pack (§5.7) : les **48 chaînes de contenus d'écrans** (`ECRANS` — login, BI, Octopulse
OpRisk, Mobile Banking, CoC) passent en arabe. Le CHROME complet (nav base + sous-nav éditeur + UI
AML gap + écrans du dictionnaire) est désormais couvert en AR. Passe **MACHINE (MSA)** ; références
règles/produits conservées (R318, R276, GED, CoC, RM). **Coût bundle core = 0** (chunk paresseux).

- **Clés byte-exactes** : `ECRANS_AR` est apparié aux clés FR par EXTRACTION (guillemets « », espaces
  insécables, `×`, `…` conservés à l'octet) → aucune traduction silencieusement orpheline.
- **Reste sans AR** : le CONTENU des RÈGLES (nom/desc, servi par l'API — à ajouter au pack) et toute
  chaîne hors dictionnaire → repli FR PROPRE (testé par une clé synthétique hors-dictionnaire).
- **Gardes** : FE-I18N (`Se reconnecter`→إعادة الاتصال ; repli FR d'une clé hors-dico). vitest
  **104/104**, **core 219,3/220** + **pack langue 4,5 kB gz** (à la demande), cliquet EN/DE/IT
  **0 écart**, `vite build` OK, eslint OK.

### 5.9 — AR du CONTENU des RÈGLES (nom+desc), SERVI PAR L'API (machine, 2026-08-05)

Dernier maillon de la couverture AR : le **contenu des 64 règles** (nom + desc) passe en arabe. Servi
par l'API (`GET /v1/aml/scenarios`, SPEC-I18N §3), **jamais bundlé** → **coût bundle = 0** (pas de
pack paresseux nécessaire). Passe **MACHINE (MSA)** en attente de relecture pro ; réfs
réglementaires/produits conservées (FINMA, GAFI, OFAC SDN, BIC, IMO, HS, LC, RMA, CBDDQ, KYCC,
z-score, CPSI, corridors RU/BY/IR/KP…). **Le Gherkin reste FR** (langue normative unique du contrat).

- **Source unique** : `data/i18n-aml-gap.json` gagne `ar: {nom, desc}` sur les 64 règles (add-only).
  `_attach_i18n` inclut `ar` → référentiel backend + `aml-gap-rules.json`. Interfaces `AmlGapI18n`/seed
  gagnent `ar?`. Le front (`AmlGap.tsx::ruleLc`) élargi à `ar` : `s.i18n?.ar?.nom ?? s.titre`.
- **Gardes** : **AG-21 inversé** (exige désormais l'AR nom+desc au référentiel, plus « AR jamais
  fabriqué ») → self-test **27/27**. e2e réel `fat-aml-i18n` : les 4 langues servent nom+desc, l'AR
  porte bien de l'écriture arabe (regex bloc Unicode arabe), le Gherkin **reste FR** même en AR →
  **10 suites / 41 tests**. Câblage AML **28/28**, `tsc` OK, front vitest OK, budget inchangé.

**AR : couverture désormais complète** (chrome sidebar + écrans + contenu des règles). *Reste avant
BAT* : **relecture pro** de toutes les passes machine ; colonne AR au glossaire CONTRAIGNANT ; audit
RTL écran par écran.
