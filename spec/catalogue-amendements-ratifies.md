# Catalogue O-Live — Amendements ratifiés (v2 → v2.1)
Ratification : Ali Gharsallah, 2026-07-12. Numérotation continue conforme à la
méthode. Texte prêt à intégrer au document normatif.

## S-09 — Versioning généralisé du référentiel (extension R29)
**Règle.** Le versioning par date de mise en vigueur avec grandfathering (R29)
s'applique à TOUT artefact de configuration : matrice documentaire, définitions
de sections, questionnaires, règles de scoring, workflows. Un dossier validé est
estampillé avec le snapshot complet du référentiel en vigueur. La
recertification rebase obligatoirement sur le référentiel courant.

## S-10 / S-10b — Délai du visa conditionnel (extension R25)
**Règle.** Une section peut être visée conditionnellement à la réception d'un
document manquant. Si le document est OBLIGATOIRE et n'est jamais reçu, le visa
conditionnel saute à l'échéance du délai (paramètre tenant, défaut 30 jours)
avec escalade. Si le document est OPTIONNEL, l'échéance déclenche une escalade
sans invalidation du visa.

## R52 — Exclusion du contributeur à la validation finale (extension R13/R15)
**Règle.** Tout contributeur de données du dossier — quelle que soit la section
touchée — est exclu du visa de validation finale. Le 4-yeux de l'étape finale
est global au dossier, pas limité à la section finale.

> **Scénario V-18 — Contributeur exclu de la validation finale (R52)**
> **Étant donné** un dossier dont U1 a modifié au moins un champ d'une section
> **Et** toutes les sections sont visées
> **Et** U1 est le validateur nommé de l'étape « Validation finale »
> **Quand** U1 tente d'accorder le visa de validation finale
> **Alors** le système refuse avec le motif « R52 : contributeur du dossier
> exclu du visa de validation finale »
> **Et** la tentative est tracée dans l'audit trail
> **Et** un validateur non-contributeur peut accorder ce visa

## État de conformité post-ratification
Implémentation de référence (`services/workflow-engine-py`) : **65 scénarios
verts** (V-01…V-18, D, S-01…S-10b, P, T, A, X) + 6 tests de persistance SQL.
Le comptage officiel du catalogue v2.1 devient **65** (remplace le « 68 » du
préambule v2, non réconcilié).

## Complément R14/V-15 — RATIFIÉ le 12.07.2026 (reporté au Word v2.4)
**V-15 (précision)** : l'annulation d'un visa pour vice de process fait repasser
la section concernée à l'état « En préparation » (le travail doit être refait et
re-visé). Constat : le port JS laissait la section « Visée » avec un visa
« Annulé » — incohérence attrapée par le croisement bidirectionnel, corrigée.
**Backlog du workflow actuel (JS) documenté par le croisement** : R2 (contrôle
du signataire = validateur nommé) et R14 (pop-up d'engagement à la validation
finale) ne sont pas implémentés côté JS — à porter si le port est dégelé.

## R53 — Concurrence optimiste — RATIFIÉ le 12.07.2026 (reporté au Word v2.2)
**Règle.** Toute commande utilisateur peut porter la version attendue de son
dossier (nombre d'événements effectifs le concernant). Une commande fondée sur
une version périmée est rejetée SANS AUCUN EFFET sur le dossier, avec la version
courante en retour (« dossier modifié entre-temps, rechargez ») ; la tentative
est tracée dans l'audit trail. Les lectures journalisées (R47) et les conflits
eux-mêmes n'incrémentent pas la version. Une commande sans version attendue
(processus internes, migration) reste valide.

> **Scénario C-01 — Deux intervenants, le second est périmé**
> **Étant donné** un dossier en version v chargé par CO1 et CO2
> **Quand** CO1 modifie une donnée (le dossier passe en v+1)
> **Et** CO2 soumet une modification fondée sur la version v
> **Alors** la commande de CO2 est rejetée avec le motif R53
> **Et** le dossier ne porte aucune trace de la modification de CO2
>
> **Scénario C-02 — Le rejet guide le rechargement**
> **Alors** la réponse de rejet contient la version courante du dossier
>
> **Scénario C-03 — Compatibilité : commande sans version**
> **Quand** une commande est émise sans version attendue
> **Alors** elle s'applique selon les règles ordinaires (R1-R52)
>
> **Scénario C-04 — Le conflit ne consomme pas de version**
> **Étant donné** un conflit R53 subi par CO2
> **Quand** CO2 recharge et rejoue sa commande avec la version courante
> **Alors** la commande s'applique
>
> **Scénario C-05 — Version strictement monotone**
> **Alors** la version d'un dossier croît de 1 par événement effectif le
> concernant, et jamais sur lecture (R47) ni sur conflit (R53)

## R54 — Déclencheur du temps — RATIFIÉ le 12.07.2026 (reporté au Word v2.3)
**Règle.** Un point d'entrée unique `tick_global(now)` exécute toutes les
échéances du moteur (rappels et escalades R5, abandon R19, visa conditionnel
R25, dé-PEPisation R33, SLA R39, screening périodique R42). Il est :
(a) **idempotent** — rejouer à la même date n'émet aucun événement métier
supplémentaire ; (b) **monotone** — un tick antérieur au dernier tick exécuté
est refusé sans effet et la tentative est tracée (horloge qui recule) ;
(c) **rattrapant** — un tick tardif traite en une passe toutes les échéances
intermédiaires ; (d) **auditable** — chaque exécution journalise son bilan
(date, nombre d'événements émis). Scénarios K-01 à K-05.

## R55 — Snapshots de reprise — RATIFIÉ le 12.07.2026 (reporté au Word v2.4)
**Règle.** L'état d'un dossier peut être photographié (snapshot) à sa version
R53 courante et restauré à l'identique. (a) **Fidélité** : le dossier restauré
est canoniquement identique ET comportementalement vivant — une commande y
produit le même résultat que sur l'original. (b) **O(récent)** : la
restauration lit le dernier snapshot et les seuls événements du dossier qui
lui sont postérieurs — jamais le journal entier. (c) **Retard signalé** : si
des événements postérieurs au snapshot existent, la restauration retourne leur
nombre — l'exploitant sait ce qui manque. (d) **Immuabilité** : un snapshot
écrit ne peut être ni modifié ni réécrit à la même version (cohérence R49).
Scénarios SN-01 à SN-05.


---
## ÉTAT FINAL DE CONCORDANCE — 12 juillet 2026
Catalogue **v2.4** : R1–R55, **80 scénarios normatifs** (V-01..18, D-01..09,
C-01..05, S-01..10b, P-01..08, T-01..07, K-01..05, A-01..07, X-01..05,
SN-01..05) + complément R14/V-15. **Plus aucun amendement en attente.**
Catalogue papier ≡ catalogue exécutable : 15/15 suites domaine, 11/11 sur
journal SQL, corpus 65/65 fidèle zéro divergence, croisé 14/16 (les 2 écarts
réels du port JS, documentés), filet de propriétés avec méta-test.

## R56 — Règles tenant additionnelles (PROPOSITION du 12.07.2026) — À RATIFIER  
> **Ratifiée bi-moteur (2026-07-13)** — portée au moteur Python de référence : 5 types (minPreparateurs, sectionsPrealables, quatreYeuxRenforce, engagementSection, motifRefusMin), garde default-deny, événements `regle_tenant_ajoutee/activee/desactivee`, scénarios **RT-01..RT-08** verts — parité JS ⇄ Python (17/17 suites).
**Règle.** Une banque peut AJOUTER des règles de workflow paramétrables, dans
une typologie fermée fournie par l'éditeur (contributeurs minimum, séquencement
de sections, 4-yeux renforcé, engagement étendu, motivation minimale…). Ces
règles ne peuvent que DURCIR les exigences : aucune règle tenant ne peut lever
ni affaiblir un invariant câblé (R2, R7, R9, R13, R14, R49…). Tout ajout,
activation ou désactivation est un événement tracé portant la source
(« manuel » ou « IA ») et la justification. L'IA peut PROPOSER des règles à
partir de l'analyse du journal ; seule l'adoption humaine les active (R44 :
AI-assisted, human-decided). Scénarios RT-01 à RT-04.
> RT-01 ajout tracé, la règle bloque puis passe quand satisfaite ·
> RT-02 séquencement de sections · RT-03 un type inconnu/assouplissant est
> rejeté et les invariants tirent toujours · RT-04 durcissement de R7 +
> désactivation tracée.
**Écart temporaire assumé** : RT-01..04 exécutables sur le port JS (démo) ;
port au moteur Python de référence requis avant ratification définitive.


## R57 & R62 — ratification bi-moteur (2026-07-13)
- **R57 — Récusation** : le validateur assigné peut se récuser (conflit d'intérêts), motivation obligatoire, événement `recusation_prononcee` ; il ne peut plus JAMAIS viser la section, même après réassignation R11 ; récusation sur la finale → escalade process owner. Scénarios **RC-01..RC-05** verts.
- **R62 — Export d'audit scellé** : export d'une plage du journal avec hash chaîné SHA-256 ; l'export est lui-même journalisé (`export_scelle_emis`) ; vérifiable hors ligne, toute altération casse le scellé, déterministe. Scénarios **EX-01..EX-04** verts.
- Implémentées dans les DEUX moteurs (Python de référence : 18/18 suites ; JS embarqué : SHA-256 pur JS à parité bit-à-bit avec crypto). R58–R61 restent des propositions ouvertes.


## R58–R61 — ratification bi-moteur (2026-07-13) — LE CATALOGUE EST INTÉGRALEMENT RATIFIÉ (R1–R62)
- **R58 — Habilitation du signataire** : le visa exige une habilitation/formation en cours de validité ; expirée → refus tracé + tâche de renouvellement ; dérogation possible via R4 (tracée). Scénarios **H-01..H-03** verts.
- **R59 — Double visa au-delà du seuil** : si le score de risque du dossier atteint le seuil tenant, la validation finale exige DEUX signataires distincts, chacun avec son engagement R14 ; R2 ne s'applique qu'au premier. Scénarios **DV-01..DV-03** verts.
- **R60 — Fraîcheur des sections** : à la finale, toute section visée il y a plus de N jours (paramètre tenant) exige une re-confirmation légère de SON validateur ; refus motivé = invalidation ciblée (mécanique R10). Scénarios **F-01..F-03** verts.
- **R61 — Anti-goulot mesuré** : au-delà de N visas en file (paramètre tenant), le système SIGNALE le goulot et PROPOSE le relais R4 — jamais d'imposition (R39/R40) ; le routage reste une décision humaine tracée. Scénarios **G-01..G-03** verts.
- Paramètres tenant : `R59_score_seuil`, `R60_fraicheur_jours`, `R61_seuil_file` (None/null = règle inactive) — ajoutés au questionnaire R-Q.
- Implémentées dans les DEUX moteurs : Python de référence **19/19 suites** (bloc 10, 11 tests) ; JS embarqué smoke 12/12, exemption R2 du 2e signataire, horodatage de fraîcheur, signal goulot à la soumission.


## R63–R67 — O-Live CPSI (Client Profiling & Segmentation Intelligence Server) — ratifiées (2026-07-13)
Nouvelle brique : serveur dédié de profilage perpétuel des clients — scoring continu, segmentation en groupes de pairs, consommé par l'AML (seuils par segment), l'aiguillage workflow (SDD/CDD/EDD, alimente R59) et les revues périodiques.
- **R63 — Score perpétuel événementiel** : tout signal (alerte qualifiée, hit screening, review défavorable, CoC sensible, vélocité tx) recalcule le score ; chaque recalcul est un événement append-only ; le score est une fonction pure (statique, signaux ≤ date, config) → rejouable à date (R48/R49). Scénarios **PS-01, PS-03, PS-05**.
- **R64 — Décroissance temporelle** : half-life exponentielle (paramètre tenant, défaut 180 j) — un signal vieux d'une demi-vie pèse moitié. Scénario **PS-02**.
- **R65 — Segmentation en groupes de pairs** : grille quantile déterministe statique (B/M/H) × comportement (CALME/ACTIF/INTENSE) — labels stables, segment explicable en une phrase (choix méthodologique vs k-means : pas de permutation de labels, pas de clusters singletons) ; appartenance et changements tracés ; anomalie = z-score comportemental au sein du groupe de pairs statique. Scénarios **SG-01..SG-03**.
- **R66 — Franchissement de bande = événement, jamais effet de bord** : bandes LOW/MEDIUM/HIGH (tenant) ; franchissement → tâche de revue + PROPOSITION d'aiguillage (EDD à la hausse, allègement à la baisse) — la re-classification effective reste humaine/workflow (R44) ; l'anomalie signale sans altérer le score (R39, pas de boucle auto-amplifiante). Scénarios **BD-01, SG-02**.
- **R67 — Explicabilité obligatoire** : chaque score publie ses drivers (contributions par source) dont la somme reconstitue le score — aucun score boîte noire n'alimente l'AML ni l'aiguillage. Scénario **PS-04**.
- Paramètres tenant (R-Q) : poids des signaux et du statique, `half_life_jours`, `bandes`, `seg_stat_seuils`, `seg_comp_seuils`. Défaut : half-life 180 j, bandes (40, 70).
- Serveur de référence : `services/cpsi-server-py` (pur Python, déterministe) — suite CPSI bloc 1 **10/10 verte** (PS-01..05 · SG-01..03 · BD-01..02). Moteur workflow inchangé : 19/19.


## R68–R70 — Gouvernance des règles de calcul CPSI — ratifiées (2026-07-13)
- **R68 — Paramètres transparents, en clair, versionnés** : poids, half-life, bandes et seuils de segments sont des paramètres tenant AFFICHÉS EN CLAIR à côté de leur écran de paramétrage (formule en français, valeurs courantes) ; toute modification est un événement versionné par date de mise en vigueur — le rejeu à date utilise la config en vigueur ce jour-là. Scénarios **PT-01..PT-03** verts.
- **R69 — L'IA propose, l'humain décide** : les propositions (Olivia) embarquent justification + impact simulé ; aucun effet avant adoption humaine tracée ; rejet motivé obligatoire. Scénarios **IA-01..IA-02** verts.
- **R70 — Bac à sable de stress test** : tout changement se simule d'abord (Δ scores, franchissements nominatifs, nouveaux HIGH, charge de revues induite) sans rien muter ; le rapport d'impact accompagne l'adoption ; dans l'UI, « Appliquer » est verrouillé tant que les valeurs saisies n'ont pas été simulées. Scénarios **ST-01..ST-03** verts. Bi-niveau : serveur Python (2/2 suites, 18 tests) + UI démo sur 204 clients.

## Câblages ratifiés (2026-07-13)
- **Paramétrage CoC centralisé** : store unique COC_CONFIG (matérialité, action, rôle, sévérité du signal CPSI coc_sensible par type de changement) — écran « CoC — Types & sensibilité » sous Paramétrage → Règles & moteur ; matérialité Haute force « Révision KYC proposée » ; l'écran opérationnel consomme le même store. Menu Paramétrage réorganisé par thèmes (Sections & questionnaires · Règles & moteur · Accès & rôles · Général).
- **CPSI → aiguillage workflow (R66/R44)** : les écarts entre bande CPSI et régime de diligence en vigueur deviennent des propositions actionnables (durcissement vers EDD, allègement depuis EDD) — adoption humaine tracée dans le trail du dossier + journal, rejet motivé obligatoire. Sur le dataset : 6 durcissements, 38 allègements proposés.


## R71–R74 — Groupes de population (segmentation, barème par groupe, ciblage AML) — ratifiées (2026-07-13)
État de l'art : customer segmentation / peer-group analysis (Actimize, SAS AML, Oracle FCCM, Quantexa) = traduction opérationnelle de l'approche par les risques FATF/FINMA.
- **R71 — Groupes de population** : cohortes définies par prédicat déclaratif composable (ET/OU de conditions sur secteur, type, aum_band, pays_risque, pep, score, historique) ; simple / couple / triple+ ; chevauchement autorisé, priorité pour le groupe primaire ; appartenances tracées. **GP-01..05**.
- **R72 — Barème de score par groupe** : chaque groupe peut surcharger poids/half-life/bandes ; héritage du barème global à défaut ; barème effectif = celui du groupe primaire ; appartenance calculée au barème global (pas de circularité). **BG-01..03**.
- **R73 — Ciblage des scénarios AML par groupe** : un scénario vise des groupes et porte un seuil PROPRE à chaque groupe ; il n'évalue QUE les membres de ces groupes → les hors-périmètre ne sont jamais évalués (levier n°1 anti-faux-positifs). **SC-01..03**.
- **R74 — Tout paramétrable, tout affiché** : groupes, prédicats, barèmes, effectifs, scénarios ciblés en clair ; héritent de la gouvernance R68 (versionné) / R69 (IA propose) / R70 (bac à sable).
- Serveur Python : suite CPSI bloc 3 **11/11 verte** (3/3 suites, 29 tests). Démo : écran « Groupes de population » (Paramétrage → Règles & moteur) ; scénario AML ciblé à seuils par groupe éditables ; sur 204 clients, 80 évalués / 124 hors périmètre. Moteur workflow 19/19.


## Annexe A (v3.1) — Bibliothèque étendue (application de R71–R74, PAS de nouvelle règle)
Écart signalé : extension de DONNÉES, aucun invariant nouveau — R71–R74 couvrent le mécanisme.
- **Dataset enrichi** : attributs comportementaux déterministes (LCG par id) — transactionnel (tx/mois, volume, cash, cross-border, structuration, rapidité in/out, dormant→actif), custody (FOP, in-specie, règlements tiers, rotation titres, concentration), abus de marché (trades pré-annonce, ratio annulation, wash trades, concentration intraday).
- **34 groupes / 9 familles** : Type d'entité (7), Secteur (4), AUM (4), Juridiction (3), PEP & risque (3), Transactionnel (5), Custody (3), Abus de marché (3), Combinés (2 — couple + triple). Règles en clair, barème par groupe (offshore/PEP/combinés surchargés).
- **14 scénarios / 3 domaines** : Activité transactionnelle after-market (LBA/AML — vélocité, volume, fractionnement, rapidité in/out, cross-border, cash) · Transfer-agent/custody (FOP, in-specie, règlements tiers, rotation titres) · Abus de marché MAR/LSFin (insider pré-annonce, spoofing, wash trades, concentration intraday). Seuils PAR groupe éditables ; ciblage = les hors-périmètre jamais évalués (ex. FOP : 23 évalués / 181 hors sur 204).
- Vérif : serveur Python bloc 4 vert (TX/CU/MA/SPEC), 4/4 suites, 36 tests ; démo e2e sur 204 clients.


## R75 — Marquage insider (liste d'initiés surveillée, MAR) — ratifiée (2026-07-13)
Obligation MAR de tenir une liste d'initiés. Statut sensible porté par le client, analogue au PEP.
- **R75** : un client peut être marqué « insider » ; marquage tracé (auteur/date/motif/instrument), append-only (R49), réservé aux rôles habilités (compliance/market surveillance), réversible avec motivation obligatoire. Le statut alimente les prédicats de groupe (R71 — groupe « Initiés déclarés ») et le ciblage des scénarios d'abus de marché (R73 — scénario insider dealing à seuil serré). IA propose / humain décide (R44). Scénarios **IN-01..IN-06** verts.
- Serveur Python : bloc 5 vert, 5/5 suites, 42 tests. Démo : carte « Liste d'initiés surveillés (MAR) » (vue Profilage CPSI) — tag/levée réservés et tracés ; groupe « Initiés déclarés » dans la famille Abus de marché ; ~9 initiés seedés déterministes.


## R76 — Cases d'investigation depuis les scénarios + annexe B (2026-07-13)
- **R76** : un hit de scénario devient une case tracée (id, scénario, client, groupe, valeur, seuil, sévérité, statut) alimentant le workflow d'investigation — rien par effet de bord (R66), génération idempotente. Décisions : clôture (motif obligatoire), escalade EDD/MROS, révision KYC (alimente le dossier), demande d'info ; tracées, append-only (R49) ; escalade/révision = humain décide (R44). Onglet « Cases CPSI » dans l'AML Investigation Workspace. Scénarios **CASE-01..04** verts.
- **Annexe B (application R71–R76, pas de nouvelle règle)** : bibliothèque portée à **42 groupes / 11 familles** et **24 scénarios / 5 domaines**. Nouvelles familles : **Transferts & correspondances** (virements juridictions à risque, pass-through même jour, virements tiers, structurés sous seuil, funnel) et **Post-marché & trading** (titres illiquides, churning, cross trades comptes liés, marking the close, prix hors marché). Attributs déterministes ajoutés. **Éditeur visuel de prédicats** : création de groupe depuis l'UI (nom/famille/priorité/logique/conditions), tracé (R74).
- Vérif : serveur Python bloc 6 vert (6/6 suites, 48 tests) ; e2e — 232 cases générées, escalade/clôture/révision tracées, création de groupe depuis l'UI.


## Annexe C (v3.4) — CoC exhaustif + pump & dump toutes classes (application R71–R76, PAS de nouvelle règle)
Extension de config + bibliothèque ; flag : aucun invariant nouveau.
- **CoC exhaustif** : ~40 types paramétrés (identité/personnel, statut/risque, structure/UBO, patrimoine/activité, compte/produit, documentaire, réglementaire, comportemental), chacun matérialité + action (rôle/KYC) + sévérité CPSI. Haute matérialité → révision KYC. **Éditeur UI** : ajouter un type depuis Paramétrage → CoC (libellé/matérialité/action/rôle), tracé PARAM_AUDIT, gouverne aussitôt l'opérationnel.
- **Pump & dump toutes classes** : attribut asset_dominant (8 classes) + pump_dump_score composite (accumulation/concentration/illiquidité/rotation, amplifié pour illiquides). Famille « Classe d'actifs » (8 groupes) + groupe G-PUMPDUMP + scénario SCN-PUMPDUMP ciblant chaque classe à son seuil (crypto/penny 40 → obligations 80). 53 hits sur 7 classes. Biblio : **51 groupes / 25 scénarios**.
- Vérif : serveur Python bloc 7 vert (PD-01..03), 7/7 suites, 51 tests ; e2e — CoC 40 types + ajout UI, pump & dump multi-classes.


## Annexe D (v3.5) — Bibliothèque de scénarios AML par domaine (application R71–R76, PAS de nouvelle règle)
Réorganisation + enrichissement ; flag : aucun invariant nouveau. **31 scénarios / 6 domaines / 51 groupes**, chaque scénario avec descriptif (typologie+contexte) affiché et au survol.
- **1. Cash & espèces** : fractionnement, intensité cash, dépôts/retraits espèces importants.
- **2. Transferts & transfer agent** : virements juridictions à risque, pass-through, tiers, structurés, funnel, FOP, in-specie, règlements tiers, rotation titres.
- **3. Activité transactionnelle** : vélocité, volume, mouvements rapides in/out, concentration transfrontalière.
- **4. Trading & marchés** : titres illiquides, churning, cross trades comptes liés.
- **5. Capital markets / CIB** (nouveau) : appels de capitaux atypiques, placements privés non cotés, flux IPO/pre-IPO, investissements non cotés/SPV.
- **6. Abus de marché** : insider dealing, spoofing, wash trades, concentration intraday, marking the close, prix hors marché, pump & dump toutes classes.
Écran : domaine → scénarios (descriptif ⓘ + survol) → seuils par groupe éditables + périmètre/hits en direct → cases R76. Vérif : Python bloc 8 vert (8/8 suites, 55 tests) ; e2e 6 domaines, 31 scénarios décrits.


## R77 — Séparation Screening / AML + bac à sable AML (2026-07-13)
- **R77** (produit) : le screening (rapprochement de listes — sanctions OFAC/SECO, PEP, médias, via LSEG/Dow Jones/ComplyAdvantage) et la surveillance AML comportementale (scénarios) sont **deux domaines distincts**. Un hit de screening n'est PAS une alerte AML. AML Investigation → par défaut les **alertes AML (scénarios)** ; sanctions/PEP sous onglet « Screening (listes) » distinct. **Tout paramétrage de la bibliothèque (activation/seuils/bac à sable) réside dans Paramétrage → Règles & moteur**, jamais dans l'écran opérationnel. Enforcement produit (flag).
- **Bac à sable AML** (application R70) : simulation dry-run de toute la bibliothèque, projette les alertes par domaine/sévérité, curseur de sensibilité (× seuils) en direct, SANS créer de case ni muter l'état. Scénarios **SIM-01..03** verts.
- Vérif : serveur Python bloc 9 vert (9/9 suites, 58 tests) ; e2e — bandeau R77, 291 alertes AML auto-générées, onglet Screening séparé, bac à sable 576 alertes projetées / 0 case.

## Bloc 19 — Risk case animé par workflow (R83) — ratifié
- **R83** Risk case d'investigation animé par un workflow. Regroupe ≥1 alertes scorées d'un même client (corrélation R81). Workflow : NOUVELLE → EN_ANALYSE → (CLARIFICATION ↔ EN_ANALYSE) → CLOTUREE | ESCALADEE (terminaux ; ESCALADEE → voie MROS/SAR).
- Motif obligatoire (R7) pour clore / escalader / demander clarification. Documentation append-only (R48/R49). Rien par effet de bord (R66), décision humaine (R44).
- Scénarios RC-01..05 (bloc 14 CPSI). 14/14 suites, 76 tests verts.
- UI : onglet « Cases (investigation) » = risk case manager (liste + détail workflow + documentation + historique) ; rattachement depuis le drill d'une alerte (Signaux scorés → 🔍 → Rattacher).


## Point 4 — Reporting AML & délai hit → SAR/MROS — application (sans nouvelle règle)
- Reporting de la surveillance : volumétrie des signaux scorés (alertes/near-miss/analyses par domaine et scénario) + **délai de traitement hit → déclaration MROS/SAR**, rejoué depuis l'historique tracé des risk cases.
- **Aucune nouvelle règle** : c'est une application de **R39** (le système mesure et notifie les dépassements de SLA, il ne coerce pas) et **R48/R49** (rejeu à date depuis l'audit append-only).
- Moteur : `delai_case`, `reporting_cases(sla)` — testés bloc 15 (RP-01..04). Le dépassement de SLA est signalé, jamais bloquant.

## Vocabulaire — franchissement vs alerte scorée (reconciliation, sans nouvelle règle)
- **Franchissement** : hit brut de détection — une personne franchit le seuil d'un scénario pour son groupe. Niveau détection.
- **Signal scoré** : franchissement dédupliqué par (client, scénario) (R81), doté d'un score impact+fréquence.
- **Alerte scorée** : signal dont le score ≥ seuil X (R80). Niveau investigation. En deçà : *near-miss* (bande sous X) ou *analyse*.
- Référentiel, KPI et Compliance Center relabellés en conséquence : la colonne « Alertes » (hits) devient « Franchissements » ; le décompte « alertes scorées » (≥ X) est affiché à côté avec renvoi à AML → Signaux scorés. Résout l'écart signalé (576 franchissements ≠ 178 alertes scorées).

## Bloc 20 — Refonte remplissage KYC (R84–R88) — en cours
### R84 — Édition exclusive du dossier KYC (« la main » / checkout) — ratifié
- Un dossier KYC en édition est détenu par **un seul intervenant à la fois** (comme un dossier physique). Les autres ne peuvent **pas le consulter** tant qu'il n'est pas libéré (release) ; un pop-up leur propose de **demander la main** (requête tracée). Le détenteur peut libérer ou passer la main. Journalisé (R48/R49).
- Moteur : `KycLock` (prendre/libérer/demander/passer la main) — testé bloc 16 (CK-01..05). UI : pop-up bloquant + barre de main dans l'écran KYC.
### R85 — Passage de main workflow (Next step / Revenir) — ratifié
- Le validateur passe la main à l'étape suivante (« Valider et passer à l'étape suivante ») ou rend au précédent (« Renvoyer à l'étape précédente ») ; **message OBLIGATOIRE à chaque passage** (adressé à l'intervenant concerné, consigné) ; jusqu'à la section validation (valider/rejeter). Tracé (R48/R49).
- Moteur de référence : `KycHandoff` (next_step/revenir/valider/rejeter, message obligatoire, terminal) — testé bloc 17 (HM-01..06). UI : le mécanisme workflow existant durci — `validate` exige désormais un message (comme pushback/reject).
- Note : R85 était en grande partie déjà présent (stepper de phases, modal de transition, timeline `wfLog`, verrou intégré) ; seul le **message obligatoire au passage à l'étape suivante** manquait.
- Le validateur d'une section passe la main au owner/validateur de la section suivante (« send to next step ») ou rend au précédent (« revenir ») ; **message obligatoire** à chaque passage ; jusqu'à la section de validation (validation/rejet).
### R86 — Visa qualifié (verdict + message) — ratifié
- Apposer un visa rend un **verdict** — OK (favorable) / CONDITIONAL (sous condition) / NOK (défavorable) — et un **message**. Un verdict NOK ou CONDITIONAL EXIGE un message justificatif ; OK peut rester sans message. Visa retirable par son seul signataire, tracé (R48/R49). NOK bloquant.
- Moteur de référence : `QualifiedVisa` (apposer/retirer, message obligatoire si NOK/CONDITIONAL, verdict invalide refusé) — testé bloc 18 (VQ-01..06). UI : modale de verdict (3 choix + message) branchée sur les visas par section ; la pastille affiche le verdict (✓ favorable / ~ sous condition / ✕ défavorable) et le message en survol.
- Extension du visa uniforme (R15).
- Apposer un visa porte un **verdict** (OK / NOK / sous condition) et un **message** (extension de R15, visa uniforme).
### R87 — Fil d'échange par section/sous-section — à venir
- Chaque section/sous-section a son **fil d'échange cloisonné** (affiché à droite, en longueur).
### R88 — Appréciation d'intervenant rétractable — à venir
- Par section, bloc dépliable en bas pour consulter/ajouter une appréciation.
- Timeline du KYC (qui a fait quoi + messages) dans la section validation = application R48/R49 (pas de nouvelle règle).

### Affinage — Règles de score AML (application, pas de nouvelle règle)
- Les règles de calcul du score AML ne s'affichent que sur la **section AML**, en **accordéon replié par défaut** (score toujours visible ; clic pour détailler les règles nommées). Application de la méthodologie explicable existante.

---

# Amendements ratifiés (v2.1 → v2.2)
Ratification : Ali Gharsallah, 2026-07-15. Règles R89 → R99, scénarios I-01..I-05 et B-01..B-07.
Origine : formalisation a posteriori des blocs IAM (MOD-30) et « paramétrage instruit », construits
sous instruction directe avant leur inscription au catalogue — écart de séquence assumé et tracé.

# A. IAM — Identité & accès (MOD-30)

## R89 — Rôle non falsifiable
**Règle.** Le rôle porté par le jeton d'accès provient **exclusivement** du compte utilisateur en base.
Aucun paramètre fourni par l'appelant — corps de requête, en-tête, revendication d'un jeton tiers — ne peut
déterminer ou élever le rôle. L'échec d'authentification renvoie un message unique, sans révéler l'existence
du compte.

> **Scénario I-01 — Le rôle ne se réclame pas**
> **Étant donné** un utilisateur U1 dont le rôle en base est RM
> **Quand** U1 s'authentifie en demandant le rôle ADMIN
> **Alors** le jeton émis porte le rôle RM
> **Et** aucune vérification ultérieure ne consulte le rôle demandé
> **Étant donné** un email inconnu
> **Quand** une authentification est tentée
> **Alors** le refus est indiscernable d'un mot de passe erroné (message et durée)

*Couvert par : AU-02, AU-04, AU-06 (`auth.spec.ts`).*

## R90 — Second facteur & enrôlement prouvé
**Règle.** Si la MFA est activée pour un utilisateur, un code TOTP (RFC 6238) valide est exigé **en plus**
du mot de passe. L'enrôlement se fait en deux temps : génération du secret, puis **activation seulement
après un premier code valide** — un secret posé ne protège rien tant qu'il n'est pas prouvé côté client.
La réinitialisation est une action d'administration tracée.

> **Scénario I-02 — L'enrôlement ne s'auto-proclame pas**
> **Étant donné** un utilisateur sans MFA
> **Quand** l'enrôlement est démarré
> **Alors** un secret et une URI `otpauth://` sont produits
> **Et** la MFA reste **inactive**
> **Quand** un code invalide est présenté
> **Alors** l'activation est refusée et la MFA reste inactive
> **Quand** un code valide est présenté
> **Alors** la MFA devient active

> **Scénario I-03 — Le mot de passe seul ne suffit plus**
> **Étant donné** un utilisateur dont la MFA est active
> **Quand** il s'authentifie avec le bon mot de passe et sans code
> **Alors** l'accès est refusé

*Couvert par : MF-01..06, AU-07..09, TP-01..04 (vecteurs officiels RFC 6238).*

## R91 — Fédération d'identité : l'IdP est source de vérité
**Règle.** En SSO (OIDC ou SAML), l'émetteur et l'audience sont vérifiés, le jeton expiré est rejeté, et le
rôle O-Live est **dérivé des groupes de l'IdP à chaque connexion** — jamais figé au provisioning. Le compte
est créé à la volée (JIT) s'il n'existe pas. Le **mapping groupes → rôles** et le **rôle par défaut** sont des
paramètres tenants (R-Q) ; le défaut recommandé est *aucun rôle → accès refusé*.

> **Scénario I-04 — Le rôle suit l'annuaire**
> **Étant donné** un utilisateur fédéré dont le compte local porte le rôle RM
> **Et** un jeton IdP valide dont les groupes mappent vers CO_SR
> **Quand** il se connecte
> **Alors** le compte est resynchronisé sur CO_SR
> **Et** aucun compte en double n'est créé
> **Étant donné** un jeton dont aucun groupe n'est mappé et sans rôle par défaut
> **Quand** il se connecte
> **Alors** l'accès est refusé

*Couvert par : OI-01..06 (`oidc.spec.ts`).*

## R92 — Rotation des clés sans coupure
**Règle.** Les jetons sont signés par la clé **active** du trousseau, identifiée par son `kid`. Le vérificateur
résout la clé publique par `kid` : une rotation n'invalide **pas** les sessions en cours pendant la période de
grâce. Les clés publiques sont exposées au standard JWKS. Une clé purgée rend ses jetons invalides.

> **Scénario I-05 — Tourner sans casser**
> **Étant donné** un jeton signé avec la clé K1
> **Quand** le trousseau tourne vers K2
> **Alors** le jeton K1 reste vérifiable tant que K1 est en grâce
> **Et** les nouveaux jetons portent le kid K2
> **Quand** K1 est purgée du trousseau
> **Alors** le jeton K1 est rejeté

*Couvert par : KS-01..05, TM-01..07.*

---

# B. Paramétrage instruit — bacs à sable & comité

## R93 — Aucun score implicite
**Règle.** Toute valeur d'un référentiel entrant dans un calcul de risque porte un score **explicite**. Une
valeur sans score ne vaut pas « neutre » : elle est **signalée** comme non scorée, et le référentiel affiche
le décompte des valeurs concernées. Une valeur nouvelle apparue dans les données (activité, structure, pays)
est traitée comme non scorée jusqu'à décision.

> **Scénario B-01 — Le zéro doit être un choix**
> **Étant donné** un référentiel d'activités dont N valeurs n'ont pas de score
> **Quand** l'écran de paramétrage est ouvert
> **Alors** il affiche « N valeurs sans score → 0 implicite »
> **Et** chaque valeur non scorée est distinguée visuellement
> **Quand** un score est attribué à l'une d'elles
> **Alors** le décompte passe à N−1 et le changement est journalisé

*Motivation.* Découvert à l'exécution : 10 activités sensibles au sens GAFI (négoce d'art, crypto-actifs,
casinos, pierres précieuses, antiquités, yachts, aviation privée…) valaient **0** au moteur de score, faute
d'entrée au référentiel.

## R94 — Paramétrage instruit : dry-run obligatoire
**Règle.** Tout changement de paramètre affectant le risque, la charge ou l'aiguillage doit pouvoir être
**simulé sans écriture**, sur les données réelles, avec un **impact nominatif** : non seulement les volumes
avant/après, mais l'identité des dossiers ou clients qui entrent et sortent. La simulation ne crée ni tâche,
ni alerte, ni case (R70).

> **Scénario B-02 — Voir avant d'écrire**
> **Étant donné** un scénario AML paramétré avec un seuil par groupe
> **Quand** un seuil simulé est modifié
> **Alors** le système affiche les alertes avant, après, les nouvelles et les disparues
> **Et** chaque alerte nouvelle est nommée (client, valeur, seuil franchi)
> **Et** aucune écriture n'est effectuée
> **Quand** l'utilisateur applique
> **Alors** le changement est écrit avec sa date de mise en vigueur (R29) et journalisé

*Couvert par : bacs à sable AML, KYC, BRM, Onboarding, Central File, Workflow.*

## R95 — Robustesse du réglage (stress test)
**Règle.** Le système présente la **courbe de réponse** autour du réglage simulé (balayage du paramètre) et
signale une **discontinuité disproportionnée** — une hausse au moins double du saut médian. Une croissance
régulière n'est pas une discontinuité : c'est un coût linéaire assumé. Le système **signale, il ne bloque pas** (R39).

> **Scénario B-03 — La falaise se voit avant la chute**
> **Étant donné** un paramètre simulé
> **Quand** le système balaie ce paramètre autour de la valeur choisie
> **Alors** il affiche la métrique obtenue à chaque cran
> **Et** si un cran produit une hausse au moins double du saut médian, il le signale comme point de rupture
> **Et** si la réponse est régulière, il l'indique comme progressive
> **Et** dans les deux cas l'utilisateur peut appliquer

*Motivation.* Une première heuristique signalait une « falaise » sur une droite. Corrigée et rejouée sur six
courbes types (linéaire, falaise, explosion, plate, décroissante, bruitée).

## R96 — Séparation de la proposition et de l'arbitrage
**Règle.** Les bacs à sable **proposent** ; l'owner de l'application **arbitre**. Une recommandation porte son
auteur nommé, sa source, sa date de mise en vigueur demandée et son **impact mesuré**. L'acceptation applique
le changement et le journalise. Le **refus exige un motif** (R7) ; un refus sans motif est bloqué. Le refus
motivé a la même valeur probante que l'acceptation : il prouve que la question a été posée et arbitrée.

> **Scénario B-04 — Proposer n'est pas appliquer**
> **Étant donné** un réglage simulé par un métier
> **Quand** il est soumis au comité
> **Alors** aucune écriture n'a lieu
> **Et** la recommandation porte auteur, source, date d'effet et impacts mesurés
> **Quand** l'owner refuse sans motif
> **Alors** le refus est bloqué avec le motif « R7 : un refus exige un motif »
> **Quand** l'owner refuse avec motif
> **Alors** le refus et son motif sont journalisés
> **Quand** l'owner accepte
> **Alors** le changement est appliqué et journalisé avec l'impact annoncé

## R97 — Cumul des changements
**Règle.** Le comité présente l'**effet combiné** des recommandations retenues, et non seulement leur effet
individuel. Une tension globale est calculée à partir des impacts qui coûtent réellement (dossiers passant en
diligence renforcée, réponses à collecter, alertes nouvelles). Au-delà d'un seuil, le système **conseille
d'étaler les dates de mise en vigueur** — il ne bloque pas (R39).

> **Scénario B-05 — Dix réglages raisonnables font une crise**
> **Étant donné** plusieurs recommandations en attente, chacune d'impact modéré
> **Quand** l'owner en retient plusieurs
> **Alors** le système additionne leurs impacts par nature
> **Et** affiche une tension combinée (maîtrisée / élevée / critique)
> **Et** au-delà du seuil élevé, conseille l'étalement des dates d'effet
> **Et** n'empêche aucune acceptation

## R98 — Conflit porteur / contrôleur
**Règle.** Un gestionnaire qui porte un portefeuille client **et** détient un rôle de contrôle (validation
finale, visa de risque) est signalé comme conflit structurel : il ne pourra pas viser ses propres dossiers
(R13/R52). Le référentiel expose ce conflit ; l'arbitrage — réattribuer le portefeuille ou nommer un
validateur tiers (R2) — revient à la banque.

> **Scénario B-06 — Le contrôleur qui vend**
> **Étant donné** un gestionnaire détenant un rôle de contrôle et portant N clients
> **Quand** le référentiel des gestionnaires est ouvert
> **Alors** le conflit est signalé avec le rôle en cause et le nombre de clients
> **Et** le message rappelle qu'il ne pourra pas viser ses propres dossiers

*Motivation.* Découvert à l'exécution : deux gestionnaires portaient un portefeuille avec un rôle de contrôle
(Head of Private Banking, Business Risk Manager).

## R99 — Relais réel (extension R4)
**Règle.** Le suppléant d'un validateur doit **différer** du validateur lui-même. Un suppléant identique au
validateur est un **relais fictif** : en cas d'absence, il n'existe aucun relais, et le dossier attend ou passe
par une dérogation tracée. Le système signale les relais fictifs ; il ne les interdit pas (R39).

> **Scénario B-07 — Un relais qui n'en est pas un**
> **Étant donné** une section dont le validateur et le suppléant sont le même rôle
> **Quand** la chaîne de visas est affichée
> **Alors** le relais fictif est signalé
> **Et** le compteur de relais fictifs est incrémenté

---

---

# Amendements ratifiés (v2.2 → v2.3)
Ratification : Ali Gharsallah, 2026-07-15. Règles R100 → R103 (workflow de qualification du
screening), scénarios SC-01..SC-04. **Catalogue écrit avant le code** — l'ordre normal, rétabli.

## R100 — Un hit n'est pas une alerte

**Règle.** Le rapprochement d'un client avec une entrée de liste produit un **hit brut** : un événement
horodaté portant le score, l'entrée rapprochée, et **la version de la liste** contre laquelle il a été
produit. Un hit brut n'est ni une alerte, ni un soupçon, ni une décision — c'est de la matière.

Il ne devient **alerte** qu'après qualification humaine (R101). Présenter des hits bruts à un analyste
comme des alertes, c'est le noyer : à 85 de seuil, un portefeuille de 2 000 clients produit 262 hits
dont 222 sont des faux positifs.

> **Scénario SC-01 — Le hit est une matière, pas un verdict**
> **Étant donné** un client dont le nom se rapproche d'une entrée de liste au-dessus du seuil
> **Quand** le screening s'exécute
> **Alors** un hit brut est produit, portant le score, l'uid de l'entrée et **la version de la liste**
> **Et** aucune alerte n'est créée
> **Et** aucun case n'est ouvert
> **Et** le hit est horodaté et rejouable (R48/R49)

---

## R101 — Qualification motivée

**Règle.** Un hit brut se qualifie en **vrai positif** ou **faux positif**, par une **personne nommée**,
avec un **motif obligatoire** (R7) choisi dans le référentiel des motifs standardisés. Aucune
qualification anonyme, aucune qualification sans motif — y compris pour un faux positif évident.

*Pourquoi y compris l'évident :* c'est précisément le hit « évident » que l'inspecteur choisira, trois
ans plus tard, pour demander qui l'a écarté et pourquoi.

> **Scénario SC-02 — Écarter un hit est une décision, pas un geste**
> **Étant donné** un hit brut non qualifié
> **Quand** un utilisateur tente de le qualifier sans motif
> **Alors** la qualification est refusée
> **Quand** il le qualifie « faux positif » avec le motif « homonyme — date de naissance incompatible »
> **Alors** la qualification est enregistrée avec son auteur, son motif et son horodatage
> **Et** le hit ne remonte plus à l'analyste
> **Quand** il qualifie un hit « vrai positif »
> **Alors** une escalade est proposée (gel, clarification, MROS) — **proposée, pas exécutée** (R39/R44)

---

## R102 — Whitelist datée, jamais éternelle

**Règle.** Un faux positif qualifié écarte le hit **pour cette entrée et cette version de liste**. Si
l'entrée de liste **change** — nouvel alias, nouvelle date de naissance, nouveau programme — la
whitelist ne s'applique plus : le hit **réapparaît** et doit être re-qualifié.

Une whitelist éternelle est une bombe à retardement : elle transforme une décision prise sur les
informations de 2024 en aveuglement permanent.

> **Scénario SC-03 — Une décision vaut pour ce qu'on savait ce jour-là**
> **Étant donné** un hit qualifié « faux positif » contre l'entrée E en version V1
> **Quand** le screening rejoue contre la version V1
> **Alors** le hit reste écarté
> **Quand** l'entrée E est modifiée (nouvel alias) et la liste passe en V2
> **Alors** le hit **réapparaît** comme non qualifié
> **Et** le motif de la qualification précédente reste consultable — il n'est pas effacé (R48)

---

## R103 — Preuve de fraîcheur

**Règle.** Chaque passage de screening laisse une trace, **même sans aucun hit** : quel périmètre a été
confronté, à quelle version de quelle liste, à quel horodatage, avec quels seuils et quel réglage de
pré-filtre.

*Pourquoi :* l'attente du régulateur n'est pas « avez-vous un outil », c'est « votre base a-t-elle été
confrontée à cette inscription, et quand ». Un screening sans trace de passage ne prouve rien —
l'absence de hit n'est pas une preuve de contrôle.

Et le **réglage du pré-filtre fait partie de la trace** : trois nombres décident de ce qui n'a jamais
été comparé. Les taire, c'est cacher l'essentiel.

> **Scénario SC-04 — L'absence de hit doit se prouver**
> **Étant donné** une liste en version V et un portefeuille de N clients
> **Quand** le screening s'exécute et ne produit aucun hit
> **Alors** une trace de passage est enregistrée : périmètre, version de liste, horodatage, seuil,
>   réglage du pré-filtre
> **Et** cette trace est rejouable à date (R49)
> **Quand** l'inspecteur demande « cette inscription a-t-elle été confrontée à votre base, et quand ? »
> **Alors** la réponse est lisible sans reconstruction

---

