# ═══ VERDICT ÉTAPE 0 (Claude Code, 2026-07-27) — canon reçu d'Ali, enregistré tel quel ci-dessous ═══

**RATIFICATION (Ali, 2026-07-27)** : « OK BS ratifié, OK R267–R271 — partie 5 d'abord ».
→ Famille bacs à sable = **BS** (BS-01..06, les scénarios ex-SB-01..06 de la partie 3 se
lisent BS-01..06). Bloc Offboarding **R267–R271 RATIFIÉ** — partie 5 en exécution.
Conséquence codée : `CATALOGUE_MAX_REGLE` 266 → 271 (R256). Les autres points d'arbitrage
(portes P1/P2, dry-run P3, P4) restent OUVERTS.

**ARBITRAGES ALI (2026-07-27, 2e ratification)** : « BS ratifié. 2. P1 timeline/reporting =
commandes à AJOUTER au contrat de la porte CPSI (extension canon R248-R252, scénarios PC-11+,
signalées) ; P2 = l'application de paramètre est un événement du journal cpsi_events (R68/R249),
même extension ; P3 = crée les endpoints dry-run sous le patron SandboxAml, signalés comme
application de R70 — zéro mutation prouvée (BS-01). 3. Partie 4 : sdkyc rendu sur le modèle
actuel, SD-04 suspendu + écart « versionnage kyc_access_rules » consigné ; sdar/sdgar reportés
(écart) ; cocparam séquencé après la PR CoC du canon débloquants (R276 crée COC_CONFIG).
4. R267-R271 ratifiés — partie 5 d'abord, puis P1, P2, P4 partiel, P3. » Olivia étapes 6-8 en
parallèle : go.

**PARTIE 1 LIVRÉE (2026-07-27)** — écran `AmlWorkspace` (4 onglets, bandeau R77, drill 3 zones,
filtres = préférence localStorage, tri §1.3, compteurs = endpoints). AW-01..08 : AW-01/02/03/07
(Vitest), AW-04 (PC-14 e2e), AW-05 (rattachement idempotent même-cas — routes rattacher/detacher
EXPOSÉES, R135 intact entre cas), AW-06 (FP motivé R7, motif journalisé, pénalité au recalcul),
AW-08 (scope RM/ARM appliqué dans la porte CPSI — matrice A.3). Écarts : onglet Reporting =
volumétrie PC-13 (délai hit→MROS chez riskcases, PC-12 — porte de lecture à ratifier) ;
pré-analyse C3 exige un risk case ancré (écart d'ancrage consigné à l'étape 6 Olivia).

**PARTIE 2 LIVRÉE (2026-07-27)** — **PC-15 implémenté** : `cpsi.param.applied` est un événement
du journal `cpsi_events` (R68/R249) avec **date de vigueur** immédiate ou future — l'événement
est journalisé maintenant, sa PRISE D'EFFET attend sa date (PA-03 e2e : rien aujourd'hui,
appliqué au rejeu J+8) ; validé par rejeu À la date de vigueur avant persistance ; motivé R7,
réservé CO_SR/ADMIN. **Historique 2.1-4** = la LECTURE du journal (`GET /params/history` :
qui, quand, ancienne→nouvelle, date d'effet — aucune table neuve). Écran `CpsiParam` enrichi :
« Appliquer (R68, motivé) » sous le MÊME verrou R70 que « Proposer », historique rendu, héritage
des barèmes de groupe (« hérite du global sauf … », PA-04), proposition « Ouvrir dans le bac
(à simuler) » (PA-06/OL-20). `CpsiGuide` : « Exporter (PDF) » = l'écran lui-même (window.print,
zéro requête — PA-05 prouvé MSW). PA-01 : règles en clair (existant) + barème daté via
l'historique — la formule PAR CHAMP reste portée par `rules` (le moteur décrit ses règles).

**PARTIE 4 PARTIELLE LIVRÉE (2026-07-27, périmètre arbitré)** — `sdkyc` : matrice dérivée du
modèle ACTUEL (`GET /:code/access-matrix`, édition cellule `PATCH .../access` avec GARDE-FOUS
backend SD-02 — question sans éditeur refusée, rôle porteur de visa jamais aveugle — et événement
`kyc.access.modifie` au change tracker), « Voir comme » = projection SERVIE avec rôle simulé
(SD-03) ; **SD-04 SUSPENDU** (écart versionnage `kyc_access_rules` consigné). `paramfields` :
annuaire du registre R-Q (SD-05 prouvé MSW — zéro écriture). `cocparam` : store COC_CONFIG
(R276 étendu) rendu + éditeur versionné, SD-06 = refus typé SERVI. **`sdar`/`sdgar` REPORTÉS**
(écart : aucun store de questionnaire de review). e2e fat-sd 4/4 (SD-01/02/03/06), Vitest.

**PARTIE 3 LIVRÉE (2026-07-27, famille BS)** — 5 endpoints dry-run `/v1/sandbox/*` (patron
SandboxAml, arbitrage « application de R70 ») : `kyc-droits` (BS-03, dossiers incomplets nommés +
charge par rôle), `brm-seuils` (BS-04, reclassements NOMINATIFS avec score + Δ charge EDD, sur le
riskScore stocké — écart moteur BRM consigné), `onb-aiguillage` (BS-05, quarantaine pour l'inconnu,
default-deny sur le levier), `cf-exigences` (manquants par dossier, GED réelle), `wf-delais`
(goulots + charge par rôle). **BS-01 exécuté sur LES 5** (comptages byte-identiques, événements
compris). Écran `Sandboxes` (3 zones : leviers / projection SERVIE / rappel + pont) — BS-02
(indisponible sans repli) et BS-06 (AUCUN « Appliquer », pont « à simuler ») prouvés Vitest.
LA VAGUE ÉCRANS PILOTE EST LIVRÉE EN ENTIER (P5, P1, P2, P4 partielle arbitrée, P3).

**PARTIE 5 LIVRÉE (2026-07-27)** — R267 (machine à états + rétention 10 ans + lecture seule
intégrale) · R268 (visas/documents par type, refus listé, four-eyes R13) · R269 (obstacles TOUS
listés : risk cases, gel SECO même ADMIN, MROS en délai, avoirs port-core/attestation visée) ·
R270 (cloisonnement art. 10a : réponse réseau, courrier, Olivia R256, **policy SQL RESTRICTIVE
prouvée** — critère 5.6-2) · R271 (retour = NOUVEL onboarding, KYC Rn+1 `previousKycId`, EDD
imposé ex-EXIT_COMPLIANCE). **e2e fat-offboarding 12/12 (OF-01..12, OF-06 port présent ET
absent — critère 5.6-1)** ; écran `offboarding` + bannières lecture seule sur client/KYC/comptes
(critère 5.6-4, Vitest) ; paramètres §5.4 au questionnaire R-Q (critère 5.6-3). Écarts
d'implémentation signalés : `offboarding_sensibles` = table dédiée (pas de politique par colonne
en Postgres — même sémantique, vraie policy) ; Head PB → DIR ; SO → non ratifié (défaut CO_SR+MLRO).

**a) Numérotation : R267–R271 LIBRES.** Grep exhaustif (`spec/ docs/ apps/ services/`) : aucune
occurrence de R267..R271 après la renumérotation Olivia (v1 = R253–R257 · v1.1 = R258 ·
v2 = R259–R266). Le bloc Offboarding peut garder **R267–R271 tel que proposé**.
Conséquence codée à la ratification : `CATALOGUE_MAX_REGLE` (olivia.module.ts, R256) passe 266 → 271.

**b) Familles : AW, PA, SD, OF LIBRES — ⚠ COLLISION sur SB.**
`SB-01..SB-06` est **déjà pris** par le corpus SecretBox — chiffrement `mfa_secret` au repos
(2026-07-19 : `apps/api/src/modules/auth/secret-box.spec.ts`, harness 9/9, référencé dans
RUNBOOK-OPS.md et matrice-addendum). **Renommage proposé : `SB` → `BS` (Bacs à Sable),
BS-01..BS-06, vérifié libre.** Conformément au canon : **STOP — validation du renommage requise**
avant d'exécuter la partie 3. (Les parties 1, 2, 4, 5 ne sont pas bloquées par ce point.)

**c) Vérification des endpoints référencés (parties 1–4) — écart signalé AVANT de coder :**

*Partie 1 (AML workspace)* :
- ✅ Signaux scorés : `GET /v1/cpsi/alerts?asOf&seuil` (signaux, alertes ≥X, near-miss, **correlations** — le graphe 1.2-3 peut RENDRE `correlations` sans endpoint neuf).
- ✅ Risk cases : `GET/POST /v1/riskcases`, `POST /:id/transition`, `GET/POST /:id/notes`.
- ✅ Screening : `POST /v1/screening/run`, `POST /hits/:id/qualify`, `GET /hits`, `GET /runs`.
- ✅ Faux positif : `POST /v1/cpsi/false-positives` (motif + événement journal, R82).
- ❌ **Onglet Reporting (1.1) : AUCUN endpoint.** Le « endpoint reporting (bloc 15) » avec volumétrie par domaine/scénario + délai hit→MROS **n'existe pas**. La query `reporting` du pont Python (ex-CP-17, SLA cases) existe mais n'a **plus de route HTTP** (surface directe débranchée par R252). Écart : soit porte de LECTURE mince à ratifier, soit onglet Reporting reporté.
- ❌ **Timeline client (1.2-2) : AUCUN endpoint.** Aucune projection « événements CPSI d'un client, rejouable `as_of` » (seuls `score?asOf` et `alerts?asOf` tenant-entier existent). Écart : porte de lecture mince (query pont + route) à ratifier.
- 🟡 Pré-analyse Olivia C3 (1.2 actions) : la capacité **C3 n'ouvre qu'à l'étape 6 Olivia** (R254) — dépendance temporelle, pas un endpoint manquant.
- 🟡 Filtres « persistés par utilisateur » (1.3) : aucun store de préférences utilisateur côté backend ; proposition : `localStorage` (c'est une préférence d'affichage, pas un paramètre tenant) — à confirmer.
- 🟡 AW-05 (rattacher idempotent) : `POST /v1/riskcases` existe ; l'idempotence du rattachement signal→case est à PROUVER sur l'existant (pattern R76) — si elle manque, c'est un écart backend à signaler, pas à corriger en douce.

*Partie 2 (cpsiparam/cpsiguide)* :
- ✅ `GET /v1/cpsi/rules?asOf` (R68) · `GET /groups?asOf` (R72) · `POST /sandbox/simulate` (R70/CP-09) · `GET/POST /params/proposals` + `/adopt` `/reject` (R69) · `GET /compliance-catalogue?asOf` (R79) · `GET /health` (R250).
- ⚠ **Écrans `CpsiParam` et `CpsiGuide` EXISTENT déjà** (2026-07-27, Vitest verts) : verrou R70, propositions motivées, jauge santé, guide ancré. La partie 2 est une **EXTENSION** (barème global détaillé avec formules, héritage de groupe, historique, application à date, export PDF) — pas une reconstruction.
- ❌ **Historique des versions (2.1-4) : AUCUN endpoint.** Le journal `cpsi_events` est en base (append-only) mais aucune route ne le liste (qui/quand/ancienne→nouvelle valeur). Écart : porte de lecture mince à ratifier.
- ❌ **« Appliquer » un barème (2.1) : AUCUNE commande de mutation directe des paramètres.** Les seules mutations existantes : groupes, scénarios, propositions (proposed/adopted/rejected), FP, insider. L'application effective d'un barème (avec date de mise en vigueur immédiate/future, PA-03) **n'a pas de voie** — écart : commande `cpsi.param.applied` (journal + moteur) à ratifier.
- 🟡 PA-03 (mise en vigueur J+7) : le mécanisme de rejeu `≤ as_of` du pont la permettrait nativement SI la commande d'application existait (point précédent).

*Partie 3 (bacs à sable)* — outre la collision de famille (b) :
- ✅ Patron : `POST /v1/aml/sandbox` (SandboxAml, R94/B-02) existe.
- ⚠ **`sbonb` : ÉCART DE LEVIERS.** Le bac livré (2026-07-27, `POST /v1/onboarding/sandbox`, FAT-SBONB-01/02) simule des seuils **SLA** ; le canon spécifie des leviers d'**aiguillage structure→workflow** + cas non routables (BS-05/ex-SB-05). L'endpoint dry-run d'aiguillage **n'existe pas**. Écart : soit étendre le bac existant (nouvelle projection), soit le canon accepte le levier SLA en plus.
- ❌ **`sbkyc`, `sbbrm`, `sbcf`, `sbwf` : AUCUN endpoint dry-run** (reconnaissance ECARTS-FRONT du 2026-07-27 confirmée). Et sous-jacent : barèmes KYC non gouvernés en paramètres, moteurs BRM/CF non isolés en fonctions pures, objet `sbwf` non défini côté moteur workflow. Chaque endpoint dry-run est **à créer = signalé ici** (l'interdit « endpoint dry-run inventé sans signalement » est ainsi levé par CE signalement, sous réserve de ratification).

*Partie 4 (sections & droits)* :
- ✅ `paramfields` : `GET /v1/parametres/registre`, `GET/POST /valeur/:cle`, `GET /config` existent (annuaire possible).
- ❌ **`sdkyc` : AUCUN endpoint matrice.** `KycAccessRule` existe en base mais : (1) aucune route GET/PUT de la matrice ; (2) le modèle est par **QUESTION** (pas de ligne section×rôle native) ; (3) **aucun versionnage à date** (SD-04 grandfathering impossible sans évolution de modèle = canon nouveau) ; (4) aucun garde-fou « section sans EDIT » / « visa pour rôle HIDDEN » côté backend ; (5) aucun endpoint « Voir comme » (rôle simulé).
- ❌ **`sdar`/`sdgar` : AUCUN store de questionnaire de review.** L'account review vit sur screening+visas KYC ; il n'existe ni sections ni matrice de droits AR/GAR à rendre.
- ❌ **`cocparam` : le store `COC_CONFIG` N'EXISTE PAS dans le repo.** Le canon le dit « existant » (~40 types, matérialité, action) — or le CoC est un ÉVÉNEMENT brut (`POST /v1/personnes/:id/coc {champ, valeur, document}`) sans typologie stockée. **Divergence repo vs canon → STOP sur cocparam** (créer le store = nouvelle surface à ratifier, pas un rendu).

*Partie 5 (Offboarding)* — dépendances vérifiées : ✅ riskcases (R269) · ✅ gel `POST /v1/mros/:id/gel` (R269) · ✅ port core `GET /v1/corebanking/etat` (R269, port absent → attestation) · ✅ chaînage `KycFile.previousKycId` (R271) · ℹ `Client` n'a pas de champ statut — l'état ACTIVE/CLOTUREE vivra dans `offboarding_files.statut` (conforme 5.2), la lecture seule OF-10 s'appuiera dessus.

**Verdict : le canon reste PROPOSÉ. Points nécessitant arbitrage AVANT code : (1) renommage SB→BS ;
(2) portes de lecture minces partie 1 (reporting, timeline client) et partie 2 (historique) ;
(3) commande d'application de barème `cpsi.param.applied` ; (4) endpoints dry-run des 4 bacs +
écart de leviers sbonb ; (5) sdkyc (matrice sans endpoints ni versionnage à date), sdar/sdgar
(store inexistant), cocparam (store COC_CONFIG inexistant). La partie 5 est exécutable dès
ratification (R267–R271 confirmés libres, dépendances présentes).**

═══ FIN DU VERDICT ÉTAPE 0 — CANON REÇU CI-DESSOUS, VERBATIM ═══

# O-Live — Canon de la VAGUE ÉCRANS PILOTE
# AML Workspace · Paramétrage CPSI · 5 bacs à sable · Sections & droits · Bloc OFFBOARDING

**Statut : PROPOSÉ — en attente de ratification par Ali Gharsallah.**
Nature : les parties 1–4 sont des **écrans sur backend ratifié** — APPLICATION de règles
existantes, AUCUNE nouvelle règle (tout écart constaté = signaler, pas inventer).
La partie 5 (Offboarding) est un **nouveau bloc** : R267–R271 **sous réserve** (étape 0 :
Claude Code confirme le prochain numéro libre après la renumérotation Olivia v1/v1.1/v2 ;
collision → mapping proposé + STOP).
Familles de scénarios : **AW** (AML workspace), **PA** (paramétrage CPSI), **SB** (bacs à
sable), **SD** (sections & droits), **OF** (offboarding) — toutes à vérifier libres.
Conventions héritées : erreurs typées · RBAC+RLS côté backend (le front ne filtre
jamais) · module inactif = écran absent du menu (pattern R177/HO-02) · aucun chiffre
calculé côté front · aucune donnée simulée (pattern R167).

---
---

# PARTIE 1 — AML INVESTIGATION WORKSPACE (écran `aml` unifié)

**Application de** : R77 (séparation screening/AML), R80–R82 (signaux scorés), R83 +
R133–R136 (risk cases), R129–R132 (MROS), R44/R7 (décision humaine, motif), R48/R49
(trail). Le poste de travail quotidien du CO — priorité n°1 de la vague.

## 1.1 Structure — 4 onglets, un seul écran

| Onglet | Contenu | Source (existant) |
|---|---|---|
| **Signaux scorés** (défaut) | table des signaux (R80/R81) : client, scénario, groupe, score impact+fréquence, statut (alerte ≥ X / near-miss / analyse), âge | porte CPSI (R248–R252) |
| **Risk cases** | liste + détail workflow R133–R136 (reprend le risk case manager existant, ici intégré) | endpoints riskcases |
| **Screening (listes)** | hits sanctions/PEP/médias et leur qualification — onglet SÉPARÉ (R77 : un hit de screening n'est PAS une alerte AML) | endpoints screening R100–R103 |
| **Reporting** | volumétrie par domaine/scénario + délai hit → MROS/SAR (SLA R39 : notifié, jamais bloquant) | endpoint reporting (bloc 15) |

Bandeau permanent R77 : « Screening (listes) et surveillance AML (scénarios) sont deux
domaines distincts » — l'utilisateur ne peut jamais confondre les deux vocabulaires
(franchissement / signal scoré / alerte scorée — libellés ratifiés, bloc vocabulaire).

## 1.2 Drill d'un signal scoré — la vue d'investigation

Clic sur un signal → panneau de détail en 3 zones :

1. **Le fait** : scénario (paramètres exacts en lecture seule, R79), valeur observée vs
   seuil du groupe (R73), décomposition du score (impact / fréquence / pénalité FP R82)
   — chaque nombre est explicable, aucun score boîte noire (R67).
2. **La timeline du client** : événements CPSI du client (signaux, franchissements de
   bande, changements de segment) ordonnés, rejouables à date — c'est une PROJECTION du
   journal, servie par la porte (rejeu `as_of`), jamais un calcul front.
3. **Le graphe de corrélation** : le client au centre, ses scénarios touchés (R81), le
   risk case existant s'il y en a un. Nœuds cliquables. Données : endpoint corrélation
   existant — le graphe REND, il ne déduit rien.

Actions depuis le drill (toutes existantes, aucune nouvelle voie) :
- **Rattacher à un risk case** / **créer un risk case** (R83 — génération idempotente)
- **Déclarer faux positif** (R82 — la pénalité s'applique au moteur, tracée)
- **Demander une pré-analyse Olivia** (C3, si module actif) — la carte proposition
  s'affiche dans le drill, décidable selon la matrice
- Motif obligatoire partout où R7 l'exige ; chaque action = événement au trail.

## 1.3 Filtres & tri

Filtres persistés par utilisateur (préférence, pas paramètre tenant) : domaine, scénario,
groupe, statut (alerte/near-miss/analyse), bande de score, âge, assigné/non assigné.
Tri par défaut : alertes scorées d'abord, puis score décroissant, puis âge décroissant.
Compteur d'en-tête = celui du backend (cohérent avec la tuile T4 de Home — même endpoint).

## 1.4 Scénarios AW-01..AW-08

> **AW-01 — Le vocabulaire ratifié est respecté** : l'onglet Signaux affiche
> « franchissements » (hits bruts) et « alertes scorées » (≥ X) comme libellés distincts ;
> les compteurs correspondent aux endpoints (pas de re-calcul front).
> **AW-02 — Screening et AML ne se mélangent pas** : un hit sanctions n'apparaît JAMAIS
> dans l'onglet Signaux ; une alerte scorée n'apparaît jamais dans Screening (R77).
> **AW-03 — Le score se décompose** : le drill affiche impact, fréquence, pénalité FP,
> et leur combinaison reconstitue le score affiché (R67/R80/R82).
> **AW-04 — La timeline est un rejeu** : la timeline du client à `as_of = J-30` ne
> contient aucun événement postérieur ; la même requête rejouée donne le même résultat.
> **AW-05 — Rattacher est idempotent** : rattacher deux fois le même signal au même
> case → un seul lien, second appel sans effet ni erreur (pattern R76).
> **AW-06 — Le faux positif exige la voie tracée** : déclaration FP → motif obligatoire,
> événement au journal CPSI, la pénalité R82 apparaît au recalcul suivant.
> **AW-07 — Le SLA notifie, ne bloque pas** : un case au-delà du SLA hit→MROS est
> surligné et notifié — toutes ses actions restent disponibles (R39).
> **AW-08 — Le scope tient** : un RM (si autorisé en lecture par le paramétrage tenant)
> ne voit que les signaux de ses clients ; le CO voit le tenant — vérifié par les
> réponses backend, le front n'ayant aucun filtre de scope.

---

# PARTIE 2 — PARAMÉTRAGE CPSI (`cpsiparam`) & GUIDE (`cpsiguide`)

**Application de** : R68 (paramètres en clair, versionnés à date), R69 (IA propose),
R70 (bac à sable obligatoire avant application), R74 (tout affiché), R79 (catalogue de
conformité lecture seule), R72 (barèmes par groupe). Sans ces écrans, le CPSI viole son
propre catalogue en démo — c'est pourquoi ils sont dans la vague pilote.

## 2.1 `cpsiparam` — l'écran de paramétrage

Sections (dans l'ordre) :
1. **Barème global** : poids signaux, poids statiques, half-life, bandes LOW/MED/HIGH,
   seuils de segments — chaque champ accompagné de sa **formule en français** (R68 :
   « affiché EN CLAIR à côté de son écran de paramétrage ») et de sa valeur en vigueur
   avec date d'effet.
2. **Barèmes par groupe** (R72) : liste des groupes surchargés, héritage visible
   (« hérite du global sauf : half-life 90 j »), barème effectif affiché.
3. **Seuils d'alerte** : X, marge near-miss, w_impact/w_freq, suppression FP on/off.
4. **Historique des versions** : chaque modification passée (qui, quand, quoi, ancienne
   → nouvelle valeur, date de mise en vigueur) — c'est le journal R68 rendu.

**Le verrou R70 est structurel** : le bouton « Appliquer » n'existe pas tant que les
valeurs saisies n'ont pas été **simulées** (bouton « Simuler » → rapport d'impact :
Δ scores, franchissements nominatifs, nouveaux HIGH, charge de revues induite). Modifier
une valeur après simulation invalide la simulation (re-simuler requis). L'application
crée l'événement versionné à date de mise en vigueur (immédiate ou future).
Les propositions Olivia de type AJUSTEMENT_PARAM adoptées arrivent ICI pré-remplies
(OL-20) — même verrou, aucune voie de contournement.

## 2.2 `cpsiguide` — le catalogue de conformité (R79)

Écran 100 % lecture seule, destiné au CO, à l'auditeur et à l'inspecteur FINMA :
- **Registre des attributs** (ATTR_DEFS) : chaque attribut surveillé — libellé, domaine,
  nature (structurel/calculé), unité, formule en français.
- **Catalogue des scénarios** : par domaine, chaque scénario avec descriptif, groupes
  ciblés, seuil par groupe EN VIGUEUR, statut actif/inactif.
- **Méthodologie** : le texte des règles R63–R67 rendues (score, decay, segmentation,
  explicabilité) avec renvois au catalogue.
- Bouton « Exporter (PDF) » — le document remis à l'auditeur est exactement l'écran.

## 2.3 Scénarios PA-01..PA-06

> **PA-01 — La formule est à côté du champ** : chaque paramètre du barème affiche sa
> formule en français et sa valeur en vigueur datée (R68) — vérifié champ par champ.
> **PA-02 — Appliquer est verrouillé sans simulation** : saisir une half-life de 90 →
> « Appliquer » absent/inactif ; « Simuler » → rapport d'impact → « Appliquer » actif ;
> re-modifier la valeur → verrou de nouveau fermé (R70).
> **PA-03 — L'application est un événement à date** : appliquer avec mise en vigueur
> J+7 → la config courante est inchangée jusqu'à J+7 ; le rejeu à J+8 utilise la
> nouvelle ; l'historique montre l'entrée (auteur, valeurs, date d'effet).
> **PA-04 — Le barème de groupe montre son héritage** : un groupe surchargé affiche
> « hérite du global sauf … » et le barème effectif (R72) — cohérent avec le moteur.
> **PA-05 — Le guide est en lecture seule stricte** : aucune requête non-GET n'est émise
> depuis cpsiguide (interception e2e) ; l'export PDF reflète les valeurs en vigueur.
> **PA-06 — La proposition adoptée passe par le même verrou** : AJUSTEMENT_PARAM adopté
> → entrée pré-remplie dans cpsiparam, statut « à simuler » ; aucune application sans
> simulation (OL-20 rejoué côté écran).

---

# PARTIE 3 — LES 5 BACS À SABLE (`sbkyc`, `sbbrm`, `sbonb`, `sbcf`, `sbwf`)

**Application de** : R70 (simulation sans mutation) — MÊME patron que SandboxAml
existant. Un bac à sable = trois zones : (1) leviers (les paramètres qu'on fait varier),
(2) projection (l'impact calculé par le BACKEND en dry-run), (3) rappel « aucune donnée
n'est modifiée » + bouton « Ouvrir dans le paramétrage » qui pré-remplit l'écran de
paramétrage réel (où le verrou R70 s'applique).

| Bac | Leviers | Projection (dry-run backend) |
|---|---|---|
| `sbkyc` | matrice droits section×rôle, questions REQUIRED, visas requis par section | dossiers en cours qui deviendraient incomplets / re-validables ; charge par rôle (nb de contributions REQUIRED ajoutées) |
| `sbbrm` | seuils du profil de risque, grille SDD/CDD/EDD | reclassements nominatifs (qui monte, qui descend), Δ charge EDD |
| `sbonb` | règles d'aiguillage onboarding (structure → workflow), infos du mini-formulaire | répartition des dossiers entrants par workflow ; cas non routables (→ quarantaine, jamais devinés) |
| `sbcf` | exigences documentaires par type de structure (A/K/S/T, justificatifs) | dossiers existants qui deviendraient non conformes ; documents manquants par dossier |
| `sbwf` | étapes de workflow, rôles owners, délais cibles | goulots projetés (étapes > délai), charge par rôle, dossiers impactés |

Invariants communs (hérités de SandboxAml, à re-tester par bac) :
- La simulation est calculée **côté backend** en dry-run — zéro logique de projection
  au front, zéro mutation (aucune écriture SQL hors lecture, vérifiable).
- Le curseur/les leviers agissent en direct sur la projection.
- Aucun bouton « Appliquer » DANS le bac — l'application vit dans l'écran de
  paramétrage, avec son verrou.

## 3.1 Scénarios SB-01..SB-06

> **SB-01 — Le bac ne mute rien** (générique, exécuté sur les 5) : une session complète
> de simulation → inventaire SQL : uniquement des lectures ; snapshot avant/après des
> tables métier : byte-identique.
> **SB-02 — La projection vient du backend** : couper l'endpoint dry-run → le bac
> affiche « indisponible », aucun calcul de repli côté front.
> **SB-03 — sbkyc projette la charge** : ajouter un REQUIRED CO sur la section AML →
> la projection liste les dossiers en cours devenant incomplets et la charge CO ajoutée.
> **SB-04 — sbbrm nomme les reclassements** : abaisser le seuil EDD → liste nominative
> des clients qui basculeraient, avec leur score (pas un simple compteur).
> **SB-05 — sbonb met l'inconnu en quarantaine** : une combinaison structure/compte non
> routable → la projection la classe « non routable » — jamais un aiguillage deviné
> (pattern R169).
> **SB-06 — Le pont vers le paramétrage est pré-rempli, pas appliqué** : « Ouvrir dans
> le paramétrage » → l'écran cible porte les valeurs simulées, statut « à simuler » —
> rien n'est en vigueur.

---

# PARTIE 4 — SECTIONS & DROITS (`sdkyc`, `sdar`, `sdgar`, `paramfields`, `cocparam`)

**Application de** : le modèle kyc_access_rules (HIDDEN/VIEW/EDIT/REQUIRED), les visas
par section, le registre R-Q, le store COC_CONFIG (bloc CoC) et R68 (versionné à date).
Ces écrans RENDENT le paramétrage existant — ils n'introduisent aucun droit nouveau.

## 4.1 `sdkyc` — matrice sections × rôles du KYC
- Grille : lignes = 13 sections (+ questions dépliables), colonnes = rôles ; cellule =
  droit (H/V/E/R) + visa requis (badge). Édition par cellule ou par lot (ligne/colonne).
- Chaque modification = événement versionné à date (R68) ; historique consultable.
- **Garde-fous rendus (pas inventés)** : le backend refuse une section sans aucun rôle
  EDIT, ou un visa requis pour un rôle en HIDDEN sur la section — l'écran affiche le
  refus typé, il ne le pré-calcule pas.
- Sélecteur « Voir comme » : prévisualiser le KYC tel que le verrait chaque rôle
  (lecture seule, servie par le backend avec le rôle simulé — pas un masquage front).

## 4.2 `sdar` / `sdgar` — sections des reviews
Même patron que sdkyc appliqué aux questionnaires d'account review (périodique / grande
review). Un seul composant de grille, trois configurations — pas trois forks.

## 4.3 `paramfields` — registre R-Q rendu
Le questionnaire R-Q comme écran : chaque paramètre tenant (tous modules) avec libellé,
formule/explication, valeur en vigueur, date d'effet, règle source (Rn cliquable),
historique. Recherche et filtre par module. Édition → renvoi vers l'écran de paramétrage
du module concerné (paramfields est un ANNUAIRE, pas un éditeur — un seul lieu d'édition
par paramètre, jamais deux).

## 4.4 `cocparam` — types de CoC & sensibilité
Rend le store COC_CONFIG existant : ~40 types (libellé, matérialité, action, rôle,
sévérité du signal CPSI). Édition et ajout comme l'éditeur UI déjà ratifié (annexe C) ;
matérialité Haute force « Révision KYC proposée » (contrainte backend, affichée).

## 4.5 Scénarios SD-01..SD-06

> **SD-01 — La matrice reflète la base, et réciproquement** : passer AML×RM de VIEW à
> HIDDEN → l'accès backend le reflète (un GET du RM sur la section est filtré) ; le
> change tracker enregistre la modification.
> **SD-02 — Le garde-fou est backend** : tenter une section sans aucun EDIT → refus
> typé affiché tel quel ; la base est inchangée.
> **SD-03 — « Voir comme » est servi, pas masqué** : prévisualisation RM → la réponse
> réseau ne contient PAS les sections HIDDEN (pas un display:none sur des données
> présentes).
> **SD-04 — La modification est versionnée à date** : droit modifié avec effet J+1 →
> les dossiers d'aujourd'hui suivent l'ancienne matrice, ceux de demain la nouvelle
> (grandfathering R29/R68).
> **SD-05 — paramfields renvoie, n'édite pas** : cliquer « modifier » sur un paramètre
> CPSI → navigation vers cpsiparam ancré sur le champ ; aucune écriture depuis
> paramfields (interception e2e).
> **SD-06 — La matérialité Haute force la révision** : créer un type CoC matérialité
> Haute avec action ≠ révision KYC → refus typé du backend, affiché.

---
---

# PARTIE 5 — BLOC OFFBOARDING (R267–R271, sous réserve) — NOUVEAU BLOC

Le seul manque de canon de la vague. Enjeu réglementaire : la fin de relation est un
moment de risque (LBA art. 7 rétention, art. 10a interdiction d'informer, gel SECO) —
et un angle mort chez les concurrents centrés onboarding. « Le cycle de VIE inclut la
fin » — cohérent avec l'identité O-Live (la branche d'olivier va jusqu'à l'olive).

## 5.1 Les règles

### R267 — La clôture est un WORKFLOW tracé — jamais une suppression
La fin de relation est une machine à états, pas un DELETE :
```
ACTIVE → CLOTURE_DEMANDEE → EN_CLOTURE → { CLOTUREE | CLOTURE_ANNULEE }
```
Chaque transition est un événement (R48/R49). CLOTUREE = le dossier passe en **lecture
seule intégrale** (client, KYC, comptes, trail) pour la durée de rétention
`retention_post_cloture_ans` (défaut 10 — LBA art. 7), décomptée depuis la date de
clôture effective. AUCUNE donnée n'est supprimée à la clôture ; la purge en fin de
rétention est un processus distinct (R170), tracé, jamais implicite.

### R268 — Le motif est TYPÉ et obligatoire — chaque type a sa voie
Types : `DEMANDE_CLIENT` · `DECISION_BANQUE` (dé-risking, rentabilité) · `EXIT_COMPLIANCE`
(lié à un soupçon/une communication) · `DECES_SUCCESSION` · `TRANSFERT_ETABLISSEMENT`.
Le type détermine : les visas requis (paramètre tenant par type — ex. EXIT_COMPLIANCE
exige CO_SR + Head PB), les documents exigés (instruction de transfert signée pour
DEMANDE_CLIENT, acte de décès pour DECES_SUCCESSION), et les notifications. Motif libre
complémentaire obligatoire (R7). Four-eyes : l'initiateur de la clôture ne peut pas
apposer le visa final (pattern R13).

### R269 — Les BLOCAGES sont vérifiés par le backend — refus listé, jamais partiel
La transition vers CLOTUREE est refusée tant qu'il existe : un risk case ouvert du
client · un gel sanctions/SECO actif · des avoirs non transférés (solde ≠ 0 sur un
compte, vérifié via le port core banking s'il est connecté ; port absent = attestation
manuelle visée, tracée — jamais un silence) · une communication MROS en cours de délai.
Le refus liste TOUS les obstacles (pas le premier trouvé). Chaque levée d'obstacle est
un événement. Aucun contournement, même ADMIN.

### R270 — L'EXIT_COMPLIANCE respecte l'interdiction d'informer (LBA art. 10a)
Pour le type EXIT_COMPLIANCE : le motif détaillé et le lien vers la communication MROS
sont **cloisonnés** aux rôles habilités (CO_SR, MLRO — paramètre tenant) ; tout autre
rôle (y compris le RM du client) voit un motif générique « décision de l'établissement ».
Les courriers/notifications client générés ne portent JAMAIS le motif compliance.
Ce cloisonnement s'applique aussi à Olivia (le ContextBuilder R256 exclut le motif
détaillé pour les rôles non habilités) et au trail rendu (l'événement existe, son
payload sensible est à accès restreint — l'audit SO/MLRO voit tout).

### R271 — Après la clôture : lecture seule, rejeu, et RETOUR = NOUVEL onboarding
Le dossier clôturé reste consultable (rôles Compliance/Central File/SO + le RM
d'origine en lecture) et **rejouable à date** — la clôture n'ampute jamais l'audit.
Un client qui revient ne « rouvre » pas : c'est un NOUVEL onboarding (MOD-69) qui crée
un KYC Rn+1 chaîné au précédent (previous_kyc_id) — l'historique complet est visible du
CO au nouvel onboarding (le screening et le risque REPARTENT du dossier connu, pas de
zéro). Le statut CLOTUREE antérieur est un attribut de risque visible (paramètre :
`ex_exit_compliance_force_edd`, défaut vrai — un ex-EXIT_COMPLIANCE revient en EDD).

## 5.2 Modèle de données (delta)

```sql
CREATE TABLE offboarding_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    client_id UUID NOT NULL REFERENCES clients(id),
    type VARCHAR(25) NOT NULL CHECK (type IN ('DEMANDE_CLIENT','DECISION_BANQUE',
        'EXIT_COMPLIANCE','DECES_SUCCESSION','TRANSFERT_ETABLISSEMENT')),
    motif TEXT NOT NULL,
    motif_sensible TEXT,                  -- R270 : accès restreint (EXIT_COMPLIANCE)
    mros_ref UUID,                        -- R270 : lien communication, accès restreint
    statut VARCHAR(20) NOT NULL DEFAULT 'CLOTURE_DEMANDEE'
      CHECK (statut IN ('CLOTURE_DEMANDEE','EN_CLOTURE','CLOTUREE','CLOTURE_ANNULEE')),
    initiateur UUID NOT NULL REFERENCES users(id),
    cloture_effective_at TIMESTAMPTZ,     -- départ de la rétention R267
    retention_jusqua DATE,                -- calculée, affichée
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- RLS + colonne motif_sensible/mros_ref sous politique d'accès dédiée (R270).
-- Visas : réutilise le mécanisme de visa uniforme existant (R15/R86) — pas de table neuve.
-- Blocages : AUCUNE table — R269 est une VÉRIFICATION à la transition, contre les
-- sources de vérité existantes (riskcases, sanctions, core banking, MROS).
```

## 5.3 Écran `offboarding`

- Liste des clôtures (type, statut, âge, obstacles restants) + création (client, type,
  motif, documents selon type).
- Détail : machine à états rendue, **checklist d'obstacles R269 en direct** (chaque
  obstacle : source, statut, lien vers l'écran de levée — le risk case, l'écran
  sanctions…), visas requis par type, documents, trail.
- Pour EXIT_COMPLIANCE : le panneau motif sensible n'existe dans le DOM que pour les
  rôles habilités (servi conditionnellement, pattern SD-03).
- Post-clôture : bannière « Dossier clôturé le … — lecture seule — rétention
  jusqu'au … » sur TOUS les écrans du client (client, KYC, comptes).

## 5.4 Paramètres tenant (questionnaire R-Q)

| Paramètre | Défaut | Règle |
|---|---|---|
| `retention_post_cloture_ans` | 10 | R267 |
| `visas_par_type_cloture` | {EXIT_COMPLIANCE: [CO_SR, HEAD_PB], DECES_SUCCESSION: [CO], …} | R268 |
| `roles_motif_sensible` | {CO_SR, MLRO, SO} | R270 |
| `ex_exit_compliance_force_edd` | vrai | R271 |
| `documents_par_type_cloture` | table livrée, éditable | R268 |

## 5.5 Scénarios OF-01..OF-12

> **OF-01 — Clôturer ne supprime rien** : clôture effective → comptage de lignes de
> toutes les tables du client avant/après : identique ; le statut seul a changé.
> **OF-02 — Le type impose ses visas et documents** : EXIT_COMPLIANCE sans visa Head PB
> → transition refusée typée ; DEMANDE_CLIENT sans instruction de transfert → idem.
> **OF-03 — Four-eyes de clôture** : l'initiateur tente le visa final → refus (R13).
> **OF-04 — Les obstacles sont listés, tous** : client avec 1 risk case ouvert ET un
> solde non nul → le refus liste les DEUX obstacles ; lever le risk case → le refus
> n'en liste plus qu'un.
> **OF-05 — Le gel sanctions bloque, même ADMIN** : gel SECO actif → transition refusée
> pour tout rôle, y compris ADMIN.
> **OF-06 — Port core absent = attestation, pas silence** : sans port core banking,
> l'obstacle « avoirs » exige une attestation manuelle visée (tracée) — jamais de
> passage silencieux (pattern R167).
> **OF-07 — L'interdiction d'informer tient à l'écran** : EXIT_COMPLIANCE consulté par
> le RM → motif générique, panneau sensible ABSENT de la réponse réseau ; par le CO_SR
> → motif détaillé + réf MROS.
> **OF-08 — Elle tient aussi pour Olivia** : le RM interroge Olivia sur le client →
> contexte_objets ne contient ni motif_sensible ni mros_ref ; le CO_SR oui (R256+R270).
> **OF-09 — Le courrier client est propre** : le document de clôture généré pour un
> EXIT_COMPLIANCE ne contient aucune mention compliance/MROS (vérifié sur le contenu).
> **OF-10 — Clôturé = lecture seule intégrale** : toute écriture sur le client, ses
> KYC, ses comptes → refus typé « dossier clôturé » ; la consultation et le rejeu à
> date fonctionnent.
> **OF-11 — Le retour est un nouvel onboarding chaîné** : réonboarder un client
> CLOTUREE → nouveau KYC Rn+1 avec previous_kyc_id ; l'écran onboarding affiche
> l'historique ; ex-EXIT_COMPLIANCE → workflow EDD imposé (paramètre).
> **OF-12 — L'annulation est tracée, pas effacée** : CLOTURE_ANNULEE → le dossier
> redevient ACTIVE, la demande de clôture et son annulation restent au trail (motif
> d'annulation obligatoire).

## 5.6 Critères d'acceptation offboarding

1. OF-01..12 verts (e2e Postgres réel ; OF-06 testé port présent ET absent).
2. La politique d'accès motif_sensible/mros_ref testée au niveau SQL (pas seulement
   contrôleur).
3. Paramètres 5.4 au questionnaire R-Q.
4. Bannière lecture seule présente sur les écrans client/KYC/comptes (3 écrans testés).

---

# PROMPT POUR CLAUDE CODE (copier tel quel)

```
Contexte : vague écrans pilote. Fichier fourni : canon-vague-ecrans-pilote.md —
5 parties : 1-4 = écrans sur backend ratifié (AUCUNE nouvelle règle), 5 = nouveau bloc
Offboarding (R267-R271 SOUS RÉSERVE).

Étape 0 :
a) Prochain numéro de règle libre après la renumérotation Olivia (v1/v1.1/v2). Si
   R267 est pris → mapping + STOP validation.
b) Familles AW, PA, SB, SD, OF libres ? Collision → renommage proposé + STOP.
c) Enregistre le canon dans spec/, indexe. Pour les parties 1-4 : vérifie que CHAQUE
   endpoint référencé existe ; tout endpoint manquant = écart signalé AVANT de coder
   l'écran (on ne crée pas un endpoint pour un écran sans le signaler).

Ordre d'exécution (un commit par écran/règle, suite verte à chaque frontière) :

1. Partie 5 D'ABORD — c'est le seul backend à créer, le reste n'est que du rendu :
   R267 (workflow+rétention, OF-01, OF-10, OF-12) → R268 (types/visas/documents,
   OF-02, OF-03) → R269 (blocages listés, OF-04..06) → R270 (cloisonnement art. 10a,
   politique SQL, OF-07..09) → R271 (retour = nouvel onboarding chaîné, OF-11) →
   écran offboarding + bannières lecture seule.
2. Partie 1 : AML workspace (AW-01..08) — onglets, drill, timeline as_of, graphe,
   actions existantes uniquement.
3. Partie 2 : cpsiparam avec verrou R70 structurel (PA-01..04, PA-06) puis cpsiguide
   lecture seule + export (PA-05).
4. Partie 4 : UN composant de grille droits réutilisé par sdkyc/sdar/sdgar (SD-01..04),
   puis paramfields (annuaire, SD-05) et cocparam (SD-06).
5. Partie 3 : les 5 bacs à sable sur le patron SandboxAml — SB-01 (zéro mutation)
   exécuté sur CHACUN des 5, puis SB-02..06.

Interdits : nouvelle règle dans les parties 1-4 (écart → signaler) ; calcul ou filtrage
de scope côté front ; endpoint dry-run inventé sans signalement ; « Appliquer » dans un
bac à sable ; suppression de données à la clôture ; motif sensible servi à un rôle non
habilité (test SQL, pas seulement contrôleur). Tout écart repo vs canon : STOP et
signale.

Livrable : une PR par partie (5 PRs), critères d'acceptation cochés, suite complète
verte à chaque PR.
```