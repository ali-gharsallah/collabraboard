# SPEC — AML Gap Wave 1 : blocs 50–56 (R340–R377 provisoires)

Statut : ratifié PO (04.08.2026). Numérotation **provisoire** — Claude Code exécute le step-0 (résolution des collisions, table session→repo, régénération CANON-MASTER via R328).
Périmètre wave 1 (priorités P1+P2 de GAP-ANALYSIS-AML.md) : Screening en flux, Indices OBA-FINMA, Vision groupe UBO, Instruments PB, Crypto/VASP, CFT, Gouvernance du tuning. Wave 2 (P3 : TBML, Correspondent banking, Prolifération, Art/Immobilier, Analytique 2G) fera l'objet d'une spec séparée.
Livrables associés : `aml-gap-dataset-gt.json` (78 cas GT : 40 TP / 38 FP), `gen_aml_gap.py` (source de vérité — toute modification de règle passe par le générateur, jamais par édition manuelle des artefacts), démo HTML mise à jour.

---

## 0 · Invariants applicables (rappel — non négociables)

- Aucun scénario ne décide : détection → **événement** → signal/alerte → humain (R44). Les règles « BLOQUANTES » émettent un événement `block.requested` consommé par le module d'exécution (pattern NBA/MOD-76) — jamais d'exécution directe par le moteur.
- Tout signal est **append-only**, rejouable à date (R48/R49). Toute modification de seuil est versionnée par date de mise en vigueur avec grandfathering (R29).
- Tout « ça dépend de la banque » est un **paramètre tenant** au registre R-Q (listés par règle ci-dessous).
- Le système mesure et notifie, il ne coerce pas (R39) — sauf contraintes réglementaires bloquantes explicites (type R13), marquées BLOQUANT.
- Spec-first : chaque scénario Gherkin ci-dessous devient un test **rouge avant le code** ; un bloc est terminé à 100 % vert, cas GT inclus.

---

## 1 · Backend (NestJS/Prisma)

### 1.1 Modèle de données (Prisma — nouveau ou étendu)

```prisma
model AmlScenario {            // définition versionnée par date de vigueur (R29)
  id            String   @id                 // ex. "SF-01"
  ruleRef       String                       // "R340" (après step-0)
  fam           String                       // bloc fonctionnel
  version       Int
  effectiveFrom DateTime                     // grandfathering
  params        Json                         // paramètres tenant (clés du registre R-Q)
  niveau        Int
  blocking      Boolean
  active        Boolean
  tenantId      String                       // RLS
  @@unique([id, version, tenantId])
}

model AmlSignal {              // append-only — écrit UNIQUEMENT via appendEvent
  id          String   @id @default(uuid())
  scenarioId  String
  scenarioVer Int                            // version en vigueur au déclenchement
  clientId    String
  uboGroupId  String?                        // bloc 52
  payload     Json                           // faits déclencheurs (montants, contreparties, scores)
  niveau      Int
  blocking    Boolean
  status      String                         // NEW → UNDER_REVIEW → TP | FP | ESCALATED (transitions via appendEvent)
  outcome     String?                        // TP / FP + motif — alimente R375
  createdAt   DateTime
  tenantId    String
}

model GroundTruthCase {        // corpus GT — seed depuis aml-gap-dataset-gt.json
  caseId     String  @id
  scenarioId String
  ruleRef    String
  label      String                          // TP | FP
  clientId   String
  narrative  String
  tenantId   String
}

model UboGroup {               // bloc 52 — matérialisation du périmètre UBO
  id        String  @id
  uboPersonId String
  memberClientIds String[]                   // dérivé du graphe personnes liées, recalculé sur événement
  tenantId  String
}
```

Extensions : `ScreeningHit` gagne `channel` (ONBOARDING | FLOW | PERPETUAL | CFT) et `matchScript` (bloc 50) ; `CocCase` gagne le type `SCREENING_DELTA` (R342).

### 1.2 Moteur d'évaluation

- Worker BullMQ `aml-eval` : consomme les événements transactionnels de l'outbox (at-least-once, watermarks, dead-letters visibles — transport existant), évalue les scénarios actifs à la date de l'événement (version en vigueur), émet `aml.signal.raised` via `appendEvent`. Idempotence par clé (scenarioId, clientId, fenêtre, hash des faits).
- Règles BLOQUANTES (R344, R346, R363, R365, R367, R373) : le moteur émet `aml.block.requested` ; le module transferts/ordres consomme et suspend l'exécution en attendant `human.decision.recorded`. Zéro effet de bord.
- Bloc 52 : service `UboPerimeter` recalcule `UboGroup` sur tout événement du graphe personnes liées ; les scénarios GU-* agrègent par `uboGroupId`.
- Screening en flux (bloc 50) : pipeline synchrone pré-exécution pour les canaux bloquants, asynchrone pour PEP/adverse (niveau 2). Normalisation multi-scripts (R345) en amont du moteur baseline IDF+trigram existant — le moteur n'est pas réécrit, il reçoit des variantes normalisées.
- Gouvernance (bloc 56) : jobs planifiés `btl-campaign` (R374) et `backtest-run` (R375) — le backtest **rejoue** les événements historiques contre deux versions de scénario (capacité de rejeu R49 réutilisée telle quelle).

### 1.3 API `/v1` (préfixe unique dans api.ts — discipline existante)

```
GET   /v1/aml/scenarios                      // définitions + version en vigueur
PATCH /v1/aml/scenarios/:id                  // nouvelle version (effectiveFrom) — visa 4-yeux, jamais de mutation in place
GET   /v1/aml/signals?status=&fam=&clientId= // inbox signaux (FilterBar côté front)
POST  /v1/aml/signals/:id/qualify            // { outcome: TP|FP, motif } → appendEvent
GET   /v1/aml/ground-truth                   // corpus GT (lecture)
POST  /v1/aml/backtest/run                   // { scenarioId, fromVersion, toVersion, window }
GET   /v1/aml/backtest/:runId                // rapport TP/FP/misses par version
POST  /v1/aml/btl/run                        // campagne BTL (R374)
GET   /v1/aml/dq/status                      // complétude par flux (R376)
```

RBAC : lecture Compliance+ ; PATCH scénarios et qualification = rôles CO/CO_SR avec 4-yeux (R13/R15 — objet visa uniforme).

### 1.4 Tests backend

- 1 suite Jest par bloc : chaque Gherkin ci-dessous = 1 test (rouge d'abord).
- **Corpus GT** : test paramétré sur les 78 cas — chaque cas (TP **et** FP) DOIT déclencher son scénario (un FP est une alerte légitime écartée en investigation, pas une non-alerte) ; l'outcome seedé alimente les métriques R375.
- Tests de non-régression rejeu : un signal émis sous v1 reste identique au rejeu à sa date après déploiement de v2 (R29/R48).

---

## 2 · Front React (Vite/TS)

- **Règles AML** (écran existant) : les 7 nouvelles familles apparaissent comme thèmes — aucune nouvelle UI de filtre, la FilterBar (SPEC-FILTERBAR.md) les absorbe. Carte = même gabarit (desc, seuils tenant éditables selon RBAC, Given/When/Then au clic, hits).
- **Détail de carte enrichi** : section « Cas GT » — liste TP/FP avec narratif (source `/v1/aml/ground-truth`), badge `n TP · m FP`.
- **Inbox signaux** : `/v1/aml/signals` + FilterBar (Statut, Famille, Niveau, Bloquant) ; qualification TP/FP avec motif obligatoire (formulaire, visa).
- **Écran Gouvernance du tuning** (nouveau, onglet du Compliance Center) : campagnes BTL, rapports de backtest par version avec delta TP/FP, statut DQ par flux (R376), export du rapport de calibrage annuel (R377) branché sur le rapport Direction existant.
- Discipline : `api.ts` point de sortie unique, `useApiOrSeed()` pour tous les nouveaux endpoints (seed = dataset GT + définitions du générateur), thin controllers, boy-scout (pas de refactor big-bang).
- Playwright : extension de la suite B-0x — 1 parcours par bloc (filtrer la famille, ouvrir une carte, vérifier les cas GT ; qualifier un signal ; lancer un backtest simulé).

---

## 3 · Démo HTML (fait — référence d'implémentation)

`olive-demo-patched.html` intègre : bloc `C50_GAP` (38 entrées, générées), injection dans le référentiel unifié de `AmlEncyclopediaScreen` (les familles deviennent des thèmes de la FilterBar automatiquement), rendu des cas GT (TP vert / FP ambre) dans le détail de chaque carte, simulation ▶ opérationnelle. Le front React reprend ces gabarits.

---

## 4 · Dataset GT — contrat

- Fichier : `aml-gap-dataset-gt.json` — 78 cas (40 TP, 38 FP), déterministes, clients existants du seed GWB (CLI-xxxxx) sauf gouvernance (« — »).
- Sémantique : **TP** = alerte déclenchée puis confirmée ; **FP** = alerte légitimement déclenchée puis écartée avec motif documenté. Les deux déclenchent — c'est le corpus de recall ; les FP calibrent la précision et nourrissent le backtesting (R375) et l'Intelligence Studio.
- Chaque FP encode une **cause d'écartement réaliste** (homonymie, événement de vie documenté, activité déclarée au KYC, erreur de référentiel) — matière d'entraînement pour Olivia (analyse assistée, décision humaine).
- Seed backend : table `GroundTruthCase` + génération des transactions synthétiques sous-jacentes par Claude Code (générateur déterministe par cas, pattern du dataset screening existant : ground truth planté, rejouable).

---

## 5 · Definition of Done (par bloc)

1. Step-0 exécuté (numéros définitifs, CANON-MASTER régénéré).
2. 100 % des Gherkin du bloc verts (backend) + corpus GT du bloc vert (chaque cas déclenche, outcome correct).
3. Endpoints `/v1` livrés, RBAC vérifié (tests IAM), signaux append-only vérifiés par test de rejeu.
4. Front : famille visible via FilterBar, cas GT rendus, parcours Playwright vert.
5. Paramètres du bloc inscrits au registre R-Q.
6. Merge GitHub = visa PO.

---
# ANNEXE — RÈGLES DÉTAILLÉES (générées depuis gen_aml_gap.py)

## Bloc 50 — Screening en flux (R340–R346)

### R340 (SF-01) — Contrepartie PEP en flux — Niveau 2
Screening PEP de la contrepartie de chaque transaction entrante/sortante, pas seulement du client à l'onboarding.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Un virement entrant de CHF 180k provient d'une contrepartie non cliente matchant une liste PEP (ministre en fonction, pays tiers).
- When — Le screening en flux (nom + pays + date de naissance si dispo) matche la contrepartie avec un score ≥ seuil tenant.
- Then — Signal PEP_COUNTERPARTY (Niveau 2) — alerte CO avec fiche de match, aucune contamination du statut client sans revue humaine (R44).

**Paramètres tenant (registre R-Q)** : `seuil_match_pep_flux` (score de similarité minimal, défaut 78 %) ; `listes_pep` (fournisseurs de listes actives, défaut tenant)

**Cas GT plantés** : 2 TP · 1 FP
- [TP] CLI-00016 — Virement de 180k reçu du frère d'un ministre en exercice (liste PEP, match 91%) — investigation confirme l'origine politique des fonds.
- [TP] CLI-00039 — Sortie de 95k vers une société détenue par un PEP régional sanctionnable — lien confirmé au registre.
- [FP] CLI-00003 — Homonyme parfait d'un PEP brésilien ; la date de naissance et le pays divergent — clôturé FP après vérification documentaire.

### R341 (SF-02) — Adverse media sur contrepartie — Niveau 2
Presse négative (blanchiment, fraude, corruption) sur la contrepartie d'une transaction au moment du flux.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Une sortie de CHF 60k vise une société citée la veille dans une enquête pour corruption (source de rang 1).
- When — Le screening adverse media en flux matche la contrepartie avec une catégorie AML-pertinente et une source pondérée ≥ seuil.
- Then — Signal ADVERSE_COUNTERPARTY (Niveau 2) — alerte avec extrait sourcé et daté ; l'humain qualifie.

**Paramètres tenant (registre R-Q)** : `rang_source_min` (rang minimal de fiabilité de la source, défaut 2) ; `categories_am` (catégories retenues (ML, fraude, corruption, TF), défaut tenant)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00075 — Paiement fournisseur vers une société mise en accusation pour corruption d'agents publics (3 sources de rang 1) — TP confirmé.
- [FP] CLI-00041 — Match sur un article concernant une société homonyme d'un autre canton — secteur et IDE différents, clôturé FP.

### R342 (SF-03) — Re-screening périodique (perpetual) — Niveau 2
Re-screening automatique périodique de tout le stock clients + personnes liées (sanctions/PEP/adverse), différentiel uniquement.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Le batch nocturne re-screene 5'000 clients ; un client existant apparaît nouvellement sur une liste PEP suite à une nomination.
- When — Le différentiel (nouveau hit vs dernier run) est détecté et rattaché au dossier.
- Then — Événement screening.delta → ouverture automatique d'un Change of Circumstances typé SCREENING_DELTA, routé au rôle Compliance (registre CoC).

**Paramètres tenant (registre R-Q)** : `frequence_rescreen` (fréquence du re-screening du stock, défaut 24 heures) ; `scope_personnes_liees` (inclure les personnes liées, défaut true)

**Cas GT plantés** : 2 TP · 1 FP
- [TP] CLI-00034 — Client nommé au conseil d'administration d'une entreprise publique — delta PEP détecté à J+1, CoC ouvert, EDD déclenchée.
- [TP] CLI-00070 — UBO ajouté à la liste SECO lors d'un train de sanctions — delta détecté, relation gelée après décision humaine.
- [FP] CLI-00005 — Mise à jour de format du fournisseur de listes régénère un hit déjà écarté (même ID de profil) — dédoublonné puis clôturé FP ; correctif de mapping consigné.

### R343 (SF-04) — Banques intermédiaires (BIC) — Niveau 2
Screening des BIC de la chaîne de paiement (champ 56/57), pas seulement des parties finales.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Un MT103 transite par une banque intermédiaire dont la maison mère est sous sanctions sectorielles.
- When — Chaque BIC de la chaîne est screené contre les listes sanctions + liste interne banques à risque.
- Then — Signal INTERMEDIARY_HIT (Niveau 2) — routage alternatif proposé, décision humaine avant exécution.

**Paramètres tenant (registre R-Q)** : `liste_bic_interne` (liste interne de banques surveillées, défaut tenant)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00130 — Paiement vers Singapour routé via une intermédiaire filiale d'un groupe sous sanctions sectorielles — re-routé après alerte.
- [FP] CLI-00018 — BIC matché sur l'ancien code d'une banque assainie et retirée des listes depuis 2024 — référentiel BIC mis à jour, FP.

### R344 (SF-05) — Adresse / localisation sanctionnée — Niveau 1 · **BLOQUANT** (contrainte type R13, pas SLA)
Sanctions par localisation : adresses et villes de régions sous embargo (Crimée, régions occupées), au-delà du seul nom.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Un virement sortant indique une adresse bénéficiaire à Sébastopol.
- When — Le parsing d'adresse (ville, région, code postal) matche le référentiel géographique sanctionné.
- Then — TRANSACTION BLOQUÉE (Niveau 1) — motif géographique explicite, dossier MROS préparé, décision humaine requise (R44).

**Paramètres tenant (registre R-Q)** : `referentiel_geo_sanctions` (référentiel des zones sanctionnées, défaut tenant)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00070 — Bénéficiaire domicilié dans une région sous embargo — blocage confirmé, déclaration préparée.
- [FP] CLI-00035 — Rue « Crimée » à Paris 19e matchée par le parseur — règle affinée (ville+pays requis), FP documenté.

### R345 (SF-06) — Translittération multi-scripts — Niveau 2
Matching étendu arabe/cyrillique/chinois : variantes de translittération normalisées avant screening (le moteur IDF+trigram est latin-centrique).

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Un ordonnateur « Мухаммад Аль-Рашид » (cyrillique) correspond à un profil sanctionné translittéré « Muhammad Al-Rashid ».
- When — La normalisation multi-scripts (ICU + tables de translittération) produit les variantes avant le matching baseline.
- Then — Le hit est détecté malgré l'écart de script — signal standard du canal concerné, variante gagnante tracée.

**Paramètres tenant (registre R-Q)** : `scripts_actifs` (scripts normalisés, défaut AR,CYR,ZH)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00045 — Contrepartie en caractères chinois matchant un profil OFAC translittéré — non détectable sans normalisation, TP.
- [FP] CLI-00193 — Translittération agressive rapproche deux patronymes arabes courants distincts — seuil par script relevé, FP.

### R346 (SF-07) — Navires & IMO — Niveau 1 · **BLOQUANT** (contrainte type R13, pas SLA)
Screening des navires (nom, numéro IMO, pavillon) sur les paiements liés au négoce et au shipping.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Un crédit documentaire référence un navire dont l'IMO figure sur la liste OFAC (shadow fleet).
- When — Extraction du nom/IMO depuis les champs libres et les documents, screening dédié navires.
- Then — TRANSACTION BLOQUÉE (Niveau 1) — gel, escalade sanctions, décision humaine requise.

**Paramètres tenant (registre R-Q)** : `extraction_imo` (extraction IMO des champs libres, défaut true)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00039 — LC référençant un tanker de la flotte fantôme (IMO sanctionné, pavillon changé 3× en 12 mois) — blocage confirmé.
- [FP] CLI-00130 — Navire homonyme d'une unité sanctionnée mais IMO distinct et pavillon UE — libéré après vérification IMO, FP.


## Bloc 51 — Indices OBA-FINMA (R347–R351)

### R347 (QO-01) — Refus de fournir des informations — Niveau 2
Le refus du client de fournir les informations usuelles (origine des fonds, justificatifs) devient un signal structuré, pas une note libre.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Le RM demande un justificatif d'origine pour un apport de CHF 500k ; le client refuse explicitement à deux reprises.
- When — Le RM déclare le refus via le workflow dédié (motif, pièces demandées, dates) — événement kyc.refus_information.
- Then — Signal INFO_REFUSAL (Niveau 2) — tâche CO, blocage possible de l'apport après décision humaine, trace au registre art. 7.

**Paramètres tenant (registre R-Q)** : `nb_relances_avant_signal` (relances avant signal, défaut 2)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00043 — Refus réitéré de documenter un apport de 500k malgré 2 relances écrites — relation dénoncée après comité.
- [FP] CLI-00053 — Retard de 3 semaines dû à une succession en cours chez le notaire — documents fournis, signal clôturé FP.

### R348 (QO-02) — Compte de passage multi-titulaires — Niveau 2
Compte utilisé comme compte de passage par de nombreuses personnes distinctes (indice annexe OBA-FINMA), au-delà du seul critère temporel.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Un compte reçoit des fonds de 9 ordonnateurs distincts sans lien documenté en 30 jours, ressortis vers 6 bénéficiaires.
- When — Comptage des tiers distincts entrée + sortie / fenêtre glissante, croisé avec les personnes liées du KYC.
- Then — Signal TRANSIT_ACCOUNT (Niveau 2) — cartographie des tiers jointe, revue du but de la relation.

**Paramètres tenant (registre R-Q)** : `tiers_distincts_seuil` (tiers distincts / 30j, défaut 6)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00072 — 11 ordonnateurs inconnus en 3 semaines, fonds ressortis sous 48h — typologie mule/passage confirmée.
- [FP] CLI-00110 — Fondation caritative recevant des dons multiples pendant sa campagne annuelle déclarée au KYC — but documenté, FP.

### R349 (QO-03) — Opération sans justification économique — Niveau 2
Red flag déclaratif du conseiller : opération constatée sans justification économique apparente, tracée et routée (jamais silencieuse).

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Le RM constate un achat-revente de titres à perte immédiate entre comptes du même client, sans logique d'investissement.
- When — Le RM soulève le red flag via le formulaire structuré (opération, constat, échange client) — événement rm.redflag.
- Then — Signal NO_ECON_RATIONALE (Niveau 2) — investigation CO, réponse du client consignée.

**Paramètres tenant (registre R-Q)** : `delai_reponse_client` (délai de réponse attendu, défaut 10 jours)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00080 — Aller-retour titres à perte de 4% en 48h répété 3× — habillage de transferts de valeur confirmé.
- [FP] CLI-00104 — Vente à perte fin décembre puis rachat en janvier — tax-loss harvesting documenté par le gérant, FP.

### R350 (QO-04) — Adresse partagée multi-clients — Niveau 1
Domiciliation c/o ou adresse identique partagée par de nombreux clients sans lien déclaré.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — 8 clients sans lien familial ni sociétal déclaré partagent la même adresse de domiciliation c/o une fiduciaire.
- When — Normalisation d'adresse + comptage des clients distincts par adresse, seuil tenant.
- Then — Signal SHARED_ADDRESS (Niveau 1) — revue du caractère de société de domicile (CDB 20, form. K).

**Paramètres tenant (registre R-Q)** : `clients_par_adresse_seuil` (clients distincts par adresse, défaut 5)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00043 — 14 sociétés clientes domiciliées à la même adresse d'un prestataire offshore — requalification en sociétés de domicile.
- [FP] CLI-00018 — Membres d'une même famille (grand-parents, enfants, holding familiale) à l'adresse du family office — liens déclarés, FP.

### R351 (QO-05) — Rotation des procurations / instructions — Niveau 2
Changements fréquents de procurations, signataires ou instructions permanentes sans justification.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — 3 changements de fondé de pouvoir en 6 mois, dont un révoqué 2 semaines après nomination.
- When — Comptage des événements de gouvernance du compte / fenêtre, croisé avec l'activité transactionnelle.
- Then — Signal GOVERNANCE_CHURN (Niveau 2) — revue de la maîtrise réelle du compte (ADE effectif).

**Paramètres tenant (registre R-Q)** : `chgts_gouvernance_seuil` (changements / 6 mois, défaut 3)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00034 — Rotation de 4 mandataires en 5 mois masquant l'opérateur réel du compte — ADE requalifié.
- [FP] CLI-00016 — Réorganisation du family office documentée (départ CFO, arrivée de deux successeurs) — actes fournis, FP.


## Bloc 52 — Vision groupe UBO (R352–R355)

### R352 (GU-01) — Structuring cross-comptes du groupe — Niveau 2
Agrégation des flux sur le périmètre consolidé de l'UBO (tous comptes, toutes entités) : le fractionnement réparti sur plusieurs entités devient visible.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Un UBO contrôle 4 entités ; chacune dépose CHF 18k la même semaine (72k agrégés, unitaire sous le seuil de 20k).
- When — Le moteur agrège par ubo_group_id (graphe des personnes liées) sur la fenêtre glissante.
- Then — Signal GROUP_STRUCTURING (Niveau 2) — vue consolidée jointe, chaque entité référencée.

**Paramètres tenant (registre R-Q)** : `fenetre_agregation_ubo` (fenêtre d'agrégation, défaut 7 jours) ; `seuil_agrege_ubo` (seuil agrégé groupe, défaut 50000 CHF)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00005 — 4 dépôts de 18-19k via holding, SCI et deux comptes personnels du même UBO en 6 jours — structuring de groupe confirmé.
- [FP] CLI-00152 — Distributions de dividendes simultanées des filiales vers la holding, calendrier d'AG documenté — flux légitimes, FP.

### R353 (GU-02) — Flux circulaires intra-groupe — Niveau 2
Fonds circulant entre entités du même UBO sans substance (A→B→C→A intra-périmètre).

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — CHF 300k font le tour de 3 entités du même UBO en 12 jours et reviennent au point de départ.
- When — Détection de cycle sur le graphe restreint au périmètre UBO.
- Then — Signal GROUP_CIRCULAR (Niveau 2) — demande de justification économique consolidée.

**Paramètres tenant (registre R-Q)** : `duree_cycle_max` (durée max du cycle détecté, défaut 30 jours)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00101 — Rotation de 300k entre 3 entités pour gonfler artificiellement les bilans avant une demande de crédit — TP.
- [FP] CLI-00016 — Cash pooling intra-groupe documenté par convention de trésorerie — mécanique déclarée au KYC, FP.

### R354 (GU-03) — Cash consolidé du périmètre — Niveau 2
Intensité cash mesurée au niveau du périmètre UBO : chaque entité reste sous les radars, le groupe non.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — 5 entités du même UBO déposent chacune ~CHF 9k d'espèces par mois (45k/mois consolidés).
- When — Ratio cash consolidé / volume consolidé du groupe, seuils par groupe CPSI.
- Then — Signal GROUP_CASH_INTENSITY (Niveau 2) — ventilation par entité jointe.

**Paramètres tenant (registre R-Q)** : `ratio_cash_groupe` (ratio cash consolidé max, défaut 25 %)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00033 — 45k/mois d'espèces répartis sur 5 entités d'un même bénéficiaire, activité déclarée sans lien avec le cash — TP.
- [FP] CLI-00041 — Groupe de restaurants du même propriétaire : intensité cash cohérente avec le secteur déclaré de chaque entité, FP.

### R355 (GU-04) — Seuils agrégés cross-produits — Niveau 2
Agrégation cash + titres + FX + crédit : un pattern réparti entre produits (dépôt cash, achat titres FOP, tirage lombard) est détecté globalement.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Dépôt cash 15k + transfert in-specie 40k + tirage lombard 30k la même semaine, aucun produit ne franchit seul son seuil.
- When — Normalisation en équivalent CHF et agrégation cross-produits par client et par groupe UBO.
- Then — Signal CROSS_PRODUCT_AGGREGATE (Niveau 2) — décomposition par produit jointe.

**Paramètres tenant (registre R-Q)** : `seuil_cross_produits` (seuil agrégé équivalent, défaut 75000 CHF)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00072 — Combinaison cash + in-specie + lombard totalisant 85k/semaine en contournement des seuils unitaires — TP.
- [FP] CLI-00164 — Rééquilibrage trimestriel de portefeuille documenté par le mandat de gestion (mouvements multi-produits simultanés), FP.


## Bloc 53 — Instruments PB (R356–R362)

### R356 (IP-01) — Lombard — remboursement par tiers — Niveau 2
Crédit lombard remboursé par anticipation par un tiers sans lien documenté avec l'emprunteur.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Un lombard de CHF 800k est soldé 4 mois après tirage par un virement d'une société tierce inconnue du dossier.
- When — Croisement remboursement anticipé × identité de l'ordonnateur × personnes liées du KYC.
- Then — Signal LOMBARD_THIRD_PARTY (Niveau 2) — fonds en attente de documentation SOF avant mainlevée du nantissement.

**Paramètres tenant (registre R-Q)** : `delai_anticipe_min` (remboursement considéré anticipé si <, défaut 12 mois)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00043 — Lombard soldé par une société panaméenne étrangère au dossier — le crédit servait à donner une apparence bancaire aux fonds, TP.
- [FP] CLI-00152 — Remboursement par la holding mère de l'emprunteur, convention de trésorerie au dossier — lien documenté, FP.

### R357 (IP-02) — Back-to-back loan — Niveau 1
Dépôt (souvent offshore) nantissant un prêt accordé à une entité liée : séparation artificielle de l'origine des fonds.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Un dépôt de CHF 2M d'une entité des Caïmans garantit un prêt de 1.8M à une société suisse du même UBO.
- When — Détection nantissement × prêt dont déposant et emprunteur partagent le périmètre UBO ou des liens déclarés/détectés.
- Then — Signal BACK_TO_BACK (Niveau 1) — origine du dépôt à corroborer avant tout tirage, escalade EDD.

**Paramètres tenant (registre R-Q)** : `perimetre_lien` (liens retenus (UBO, famille, signataires), défaut tenant)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00033 — Dépôt offshore non corroboré garantissant un prêt à l'entité opérationnelle suisse du même bénéficiaire — schéma B2B confirmé.
- [FP] CLI-00016 — Garantie intra-groupe standard d'un family office, origine des fonds corroborée à l'ouverture — structure déclarée, FP.

### R358 (IP-03) — Wrapper assurance — prime hors profil — Niveau 2
Souscription d'assurance-vie à prime unique élevée, incohérente avec le patrimoine et les revenus déclarés.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Prime unique de CHF 1.5M pour un client au patrimoine déclaré de 900k.
- When — Ratio prime / patrimoine déclaré + origine de la prime (compte tiers ?).
- Then — Signal WRAPPER_PREMIUM (Niveau 2) — corroboration SOW avant acceptation du contrat.

**Paramètres tenant (registre R-Q)** : `ratio_prime_patrimoine` (ratio prime/patrimoine max, défaut 60 %)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00048 — Prime de 1.5M financée par trois virements de sociétés tierces, patrimoine déclaré 900k — support d'intégration, TP.
- [FP] CLI-00005 — Prime élevée financée par la vente documentée d'un bien immobilier (acte notarié au dossier) — SOW corroborée, FP.

### R359 (IP-04) — Wrapper assurance — rachat précoce — Niveau 2
Rachat de la police peu après souscription, pénalités acceptées sans discussion (le coût du blanchiment est assumé).

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Rachat total à 7 mois d'une police à prime unique, pénalité de 4% acceptée sans négociation.
- When — Délai souscription→rachat < seuil + acceptation de pénalité + bénéficiaire du rachat ≠ souscripteur.
- Then — Signal EARLY_SURRENDER (Niveau 2) — investigation sur la finalité réelle du produit.

**Paramètres tenant (registre R-Q)** : `delai_rachat_min` (rachat considéré précoce si <, défaut 24 mois)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00043 — Rachat à 7 mois versé sur un compte tiers à Dubaï, pénalité assumée — la police n'a servi que de sas, TP.
- [FP] CLI-00110 — Rachat à 10 mois pour financer une acquisition immobilière urgente (compromis de vente fourni) — besoin réel, FP.

### R360 (IP-05) — Changement de bénéficiaire post-souscription — Niveau 2
Modification du bénéficiaire de la police peu après souscription, vers un tiers sans lien.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Le bénéficiaire passe du conjoint à une société étrangère 3 mois après souscription.
- When — Événement de changement de bénéficiaire × délai × nature du nouveau bénéficiaire.
- Then — Signal BENEFICIARY_SWITCH (Niveau 2) — justification requise, CoC ouvert.

**Paramètres tenant (registre R-Q)** : `delai_chgt_benef` (fenêtre de surveillance post-souscription, défaut 24 mois)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00034 — Bénéficiaire basculé vers une fondation panaméenne contrôlée par un tiers — transfert de valeur déguisé, TP.
- [FP] CLI-00053 — Changement vers les enfants suite à un divorce (jugement au dossier) — événement de vie documenté, FP.

### R361 (IP-06) — Coffres — corrélation cash — Niveau 2
Accès au coffre-fort corrélés temporellement à des dépôts ou retraits d'espèces.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — 6 accès au coffre en 2 mois, chacun suivi sous 24h d'un dépôt espèces de 15-19k.
- When — Corrélation temporelle accès coffre × mouvements cash / fenêtre.
- Then — Signal VAULT_CASH_PATTERN (Niveau 2) — entretien client et corroboration d'origine.

**Paramètres tenant (registre R-Q)** : `fenetre_correlation` (corrélation accès↔cash, défaut 48 heures) ; `nb_correlations_seuil` (corrélations / 90j, défaut 3)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00072 — 6 séquences coffre→dépôt sous 24h totalisant 100k — le coffre alimente les dépôts, TP.
- [FP] CLI-00063 — Numismate déclaré accédant au coffre avant chaque vente aux enchères documentée (bordereaux fournis) — activité déclarée, FP.

### R362 (IP-07) — Métaux précieux physiques — Niveau 2
Achats/ventes/livraisons de métaux physiques hors profil déclaré (OBA négoce OR).

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Achat de 12 kg d'or physique avec livraison hors banque, client sans profil métaux.
- When — Volume métaux / profil déclaré + mode de livraison (garde vs sortie physique).
- Then — Signal PHYSICAL_METALS (Niveau 2) — sortie physique documentée, destination tracée.

**Paramètres tenant (registre R-Q)** : `seuil_metaux` (équivalent CHF / 90j, défaut 100000 CHF)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00080 — Achats répétés d'or livré à un tiers non documenté à l'étranger — conversion de valeur portable, TP.
- [FP] CLI-00164 — Allocation or de 5% du portefeuille en garde bancaire, conforme au mandat de gestion — investissement standard, FP.


## Bloc 54 — Crypto / VASP (R363–R368)

### R363 (CR-01) — Travel rule DLT — Niveau 1 · **BLOQUANT** (contrainte type R13, pas SLA)
Transferts DLT sans informations complètes d'ordonnateur/bénéficiaire (comm. FINMA 02/2019, GAFI R.16).

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Un transfert sortant de 0.8 BTC vise un VASP qui ne transmet pas les informations travel rule.
- When — Contrôle de complétude des données travel rule avant exécution du transfert.
- Then — TRANSFERT BLOQUÉ (Niveau 1) — jusqu'à réception des informations ou décision humaine documentée.

**Paramètres tenant (registre R-Q)** : `vasp_conformes` (registre des VASP conformes travel rule, défaut tenant)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00022 — Sortie vers un exchange non coopératif refusant l'échange travel rule — blocage maintenu, relation revue.
- [FP] CLI-00068 — Message travel rule retardé par une panne du protocole d'échange du VASP partenaire (reçu à H+6) — libéré, FP.

### R364 (CR-02) — Exposition mixer / tumbler — Niveau 1
Fonds entrants dont l'analyse on-chain révèle une exposition directe ou à 1 hop à un mixer.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Un dépôt de 2.1 BTC provient à 64% d'un mixer connu (analyse de provenance).
- When — Score d'exposition mixer du fournisseur d'analytique on-chain ≥ seuil (paramètre tenant, intégration Chainalysis/Elliptic).
- Then — Signal MIXER_EXPOSURE (Niveau 1) — fonds gelés en attente d'explication, EDD.

**Paramètres tenant (registre R-Q)** : `seuil_exposition_mixer` (exposition directe max, défaut 10 %) ; `hops_analyses` (profondeur d'analyse, défaut 2 hops)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00022 — 64% de provenance mixer sur un dépôt de 2.1 BTC, client incapable d'expliquer la chaîne — fonds refusés, TP.
- [FP] CLI-00068 — Exposition indirecte de 3% à 2 hops via un exchange majeur (pollution de cluster) — sous matérialité, FP.

### R365 (CR-03) — Adresse sanctionnée on-chain — Niveau 1 · **BLOQUANT** (contrainte type R13, pas SLA)
Contrepartie on-chain figurant dans les adresses crypto de la liste SDN OFAC.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Une adresse de destination correspond à une adresse SDN (entité de ransomware listée).
- When — Screening des adresses contre les listes crypto SDN/SECO à l'initiation.
- Then — TRANSFERT BLOQUÉ (Niveau 1) — gel, dossier sanctions, MROS préparé.

**Paramètres tenant (registre R-Q)** : `listes_adresses` (listes d'adresses actives, défaut OFAC,SECO)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00022 — Destination = adresse SDN d'un groupe ransomware — blocage, déclaration effectuée.
- [FP] CLI-00068 — Adresse retirée de la liste SDN au dernier délisting, cache local obsolète — synchronisation corrigée, FP.

### R366 (CR-04) — Cluster darknet / ransomware — Niveau 1
Exposition de provenance à des clusters darknet markets ou ransomware (hors listes formelles).

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Provenance à 30% d'un cluster étiqueté darknet market par l'analytique on-chain.
- When — Score de provenance par catégorie de cluster ≥ seuil.
- Then — Signal ILLICIT_CLUSTER (Niveau 1) — fonds en quarantaine, investigation.

**Paramètres tenant (registre R-Q)** : `seuil_cluster_illicite` (provenance illicite max, défaut 5 %)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00022 — 30% de provenance darknet sur un dépôt, historique d'adresses cohérent avec du peel chaining — TP.
- [FP] CLI-00068 — Étiquetage erroné d'un cluster par le fournisseur (corrigé dans sa release suivante) — FP documenté fournisseur.

### R367 (CR-05) — Wallet auto-hébergé sans preuve — Niveau 1 · **BLOQUANT** (contrainte type R13, pas SLA)
Transferts vers/depuis un wallet auto-hébergé sans preuve de contrôle (satoshi test / signature de message).

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Le client demande une sortie de 50k CHF en ETH vers un wallet non custodial jamais vérifié.
- When — Contrôle d'existence d'une preuve de contrôle valide pour l'adresse (registre des adresses vérifiées).
- Then — SORTIE BLOQUÉE (Niveau 1) — jusqu'à preuve de contrôle (signature) enregistrée.

**Paramètres tenant (registre R-Q)** : `methodes_preuve` (méthodes acceptées, défaut signature,satoshi_test) ; `validite_preuve` (validité de la preuve, défaut 12 mois)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00022 — Adresse prétendument personnelle appartenant en réalité à un tiers (échec du test de signature) — TP.
- [FP] CLI-00068 — Preuve expirée de 2 semaines pour une adresse déjà vérifiée 3× — re-signée le jour même, FP.

### R368 (CR-06) — On/off-ramp incohérent au profil — Niveau 2
Fréquence et volumes de conversion fiat↔crypto incohérents avec le profil d'investisseur déclaré.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Un client « investisseur long terme » convertit fiat→crypto→fiat 14 fois en un mois.
- When — Compteur de cycles on/off-ramp / 30j vs profil déclaré (au-delà du simple seuil CHF de l'ancienne règle AML-11).
- Then — Signal RAMP_VELOCITY (Niveau 2) — revue du profil transactionnel crypto.

**Paramètres tenant (registre R-Q)** : `cycles_ramp_seuil` (cycles / 30j, défaut 6)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00022 — 14 cycles/mois avec marge négative systématique — le coût de conversion est le prix du layering, TP.
- [FP] CLI-00068 — Trader actif déclaré avec profil « trading fréquent » validé à l'onboarding — comportement conforme, FP.


## Bloc 55 — CFT (R369–R373)

### R369 (FT-01) — Micro-transactions vers corridors sensibles — Niveau 2
Petits montants à haute fréquence vers des corridors géographiques sensibles (le CFT ne ressemble pas au blanchiment : montants faibles).

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — 23 transferts de CHF 150-400 en 60 jours vers 3 pays limitrophes d'une zone de conflit.
- When — Fréquence × faible montant unitaire × corridor sensible (liste tenant distincte des HRJ blanchiment).
- Then — Signal CFT_MICRO_PATTERN (Niveau 2) — analyse dédiée CFT, jamais agrégé avec les seuils ML classiques.

**Paramètres tenant (registre R-Q)** : `corridors_cft` (liste corridors CFT, défaut tenant) ; `freq_micro_seuil` (transferts / 60j, défaut 10) ; `montant_micro_max` (montant unitaire max, défaut 500 CHF)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00084 — 23 micro-transferts vers des collecteurs relais identifiés par la suite dans une enquête — TP.
- [FP] CLI-00035 — Soutien familial mensuel régulier vers le pays d'origine, bénéficiaire unique documenté (famille au KYC) — remittance légitime, FP.

### R370 (FT-02) — Collectes / ONG à risque — Niveau 2
Dons et collectes atypiques vers des organisations à but non lucratif à risque (GAFI R.8), crowdfunding non tracé.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Des dons partent vers une association récemment créée, sans agrément, active dans une zone à risque.
- When — Croisement bénéficiaire ONG × registre des NPO à risque × ancienneté/agrément.
- Then — Signal NPO_RISK (Niveau 2) — vérification de l'organisation et de la chaîne de distribution des fonds.

**Paramètres tenant (registre R-Q)** : `registre_npo` (référentiel NPO surveillées, défaut tenant)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00084 — Dons répétés vers une association-écran dissoute 8 mois plus tard, dirigeants condamnés — TP.
- [FP] CLI-00110 — Dons vers une ONG certifiée ZEWO opérant en zone à risque avec audit de distribution publié — organisation vérifiée, FP.

### R371 (FT-03) — Cartes prépayées multi-sources — Niveau 2
Rechargements de cartes prépayées depuis des sources multiples, retraits en zone frontalière ou à l'étranger.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Une carte est rechargée par 5 personnes différentes puis vidée en retraits ATM dans un pays frontalier d'une zone de conflit.
- When — Nombre de sources de rechargement distinctes + géographie des retraits.
- Then — Signal PREPAID_FUNDING (Niveau 2) — gel du rechargement tiers après décision humaine.

**Paramètres tenant (registre R-Q)** : `sources_rechargement_seuil` (sources distinctes / 90j, défaut 3)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00084 — Carte financée par 5 tiers et vidée en cash à la frontière turco-syrienne — TP.
- [FP] CLI-00121 — Carte d'étudiant rechargée par ses deux parents et un grand-parent (liens familiaux au dossier), retraits sur le lieu d'études — FP.

### R372 (FT-04) — Cohérence voyages ↔ flux — Niveau 2
Croisement des Business Trips / voyages connus du client avec des flux vers zones de conflit (le module Trip existe côté RM ; le croisement CFT n'existe pas).

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Un client retire du cash inhabituel juste avant un voyage déclaré vers un pays frontalier d'une zone de conflit.
- When — Corrélation temporelle voyage déclaré/détecté × retraits cash atypiques × destination sensible.
- Then — Signal TRAVEL_FLOW_MISMATCH (Niveau 2) — entretien de clarification, trace CFT dédiée.

**Paramètres tenant (registre R-Q)** : `fenetre_voyage` (fenêtre avant/après voyage, défaut 14 jours)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00084 — Retraits de 18k en 10 jours avant un déplacement vers une zone frontalière, sans explication — TP.
- [FP] CLI-00007 — Retraits avant un pèlerinage documenté avec agence de voyage agréée et itinéraire fourni — motif religieux légitime, FP.

### R373 (FT-05) — Listes terroristes dédiées — Niveau 1 · **BLOQUANT** (contrainte type R13, pas SLA)
Screening distinct contre les ordonnances/listes terroristes (séparé des sanctions économiques : gouvernance, escalade et déclaration diffèrent).

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Une contrepartie matche une liste d'une ordonnance fédérale anti-terrorisme (hors listes SECO économiques).
- When — Canal de screening dédié listes CFT, avec circuit d'escalade propre.
- Then — TRANSACTION BLOQUÉE (Niveau 1) — gel immédiat, MROS, escalade direction, décision humaine tracée.

**Paramètres tenant (registre R-Q)** : `listes_cft` (listes CFT actives, défaut tenant)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00084 — Match exact (nom + date de naissance) sur une liste d'ordonnance fédérale — gel et déclaration.
- [FP] CLI-00099 — Homonymie sur un nom très courant, date de naissance divergente de 30 ans — levé après vérification, FP.


## Bloc 56 — Gouvernance du dispositif (R374–R377)

### R374 (GV-01) — Below-the-line sampling — Campagne/ops
Campagne périodique d'échantillonnage sous les seuils : des transactions juste en-dessous des seuils actifs sont revues pour valider le calibrage.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Le trimestre écoulé compte 1'240 transactions entre 80% et 100% du seuil du scénario structuring.
- When — La campagne BTL tire un échantillon stratifié (paramètre tenant) et le route en revue Compliance.
- Then — Événement tuning.btl.campagne — résultats consolidés : si des TP sont trouvés sous le seuil, proposition de baisse via l'Intelligence Studio (validation humaine, versionnée, réversible).

**Paramètres tenant (registre R-Q)** : `taux_echantillon_btl` (taux d'échantillonnage, défaut 2 %) ; `bande_btl` (bande sous le seuil, défaut 80-100 %) ; `frequence_btl` (fréquence de campagne, défaut 90 jours)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] — — Campagne T2 : 2 cas suspects trouvés à 85% du seuil structuring → seuil abaissé de 20k à 18k (version v1.3, simulée puis déployée).
- [FP] — — Campagne T3 : 0 TP sous seuil sur 25 dossiers échantillonnés → calibrage confirmé, rapport archivé.

### R375 (GV-02) — Backtesting par version — Campagne/ops
Backtesting formel de chaque version de scénario : TP/FP historisés par version, comparaison avant/après tout changement de seuil.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Le seuil du scénario velocity est passé de 4× à 5× il y a 90 jours (v1.2).
- When — Le backtest rejoue la fenêtre sur les deux versions et compare TP, FP, alertes manquées.
- Then — Rapport de backtest versionné attaché à la version du scénario — rollback proposé si dégradation du rappel (décision humaine).

**Paramètres tenant (registre R-Q)** : `fenetre_backtest` (fenêtre de rejeu, défaut 90 jours) ; `seuil_degradation` (perte de rappel max tolérée, défaut 0 TP manqué)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] — — v1.2 du velocity : -40% de FP, 0 TP manqué sur 90j — changement validé et documenté.
- [FP] — — v2.0 du round-amounts aurait manqué 1 TP historique — rollback v1.4 exécuté, écart consigné.

### R376 (GV-03) — Data quality pré-conditions — Niveau 1
Contrôles de qualité de données amont comme pré-condition des scénarios : un scénario aveugle (champs SWIFT incomplets, devises manquantes) est un faux négatif silencieux.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — 8% des MT103 du jour arrivent sans champ ordonnateur exploitable.
- When — Le contrôle DQ mesure la complétude des champs critiques par flux ; sous le seuil, les scénarios dépendants sont marqués « dégradés ».
- Then — Signal DQ_DEGRADED (Niveau 1, ops) — visible au dashboard Compliance, jamais silencieux (esprit dead-letters R39).

**Paramètres tenant (registre R-Q)** : `completude_min` (complétude minimale des champs critiques, défaut 98 %)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] — — Champ 50 vide sur 8% des messages d'un correspondant pendant 3 jours : le wire-stripping était indétectable — corrigé, période re-screenée.
- [FP] — — Chute de complétude due à un nouveau format ISO 20022 mal mappé (données présentes, parsing KO) — mapping corrigé, FP.

### R377 (GV-04) — Revue annuelle de calibrage — Campagne/ops
Revue annuelle documentée du dispositif : couverture typologique, performance par scénario, décisions de calibrage — annexée au rapport LBA Direction (art. 25a OBA-FINMA).

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — L'exercice se clôt ; chaque scénario a un historique TP/FP et des versions.
- When — La revue consolide couverture (matrice typologies GAFI × scénarios), performance et écarts.
- Then — Rapport de calibrage annuel généré, visé four-eyes, archivé GED — section dédiée du rapport Direction.

**Paramètres tenant (registre R-Q)** : `matrice_couverture` (référentiel de typologies de la matrice, défaut GAFI+OBA-FINMA)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] — — Revue 2026 : 3 angles morts identifiés (TBML, CBK, prolifération) → wave 2 planifiée et arbitrée en comité.
- [FP] — — —

