# Inventaire des règles workflow KYC R1–R51

> Périmètre primaire de l'énoncé d'audit : le **noyau workflow-visa** R1–R51.
> Sources : `spec/wf-v2.md` (catalogue normatif R1–R51 + Gherkin), `spec/olive-catalogue-R1-R56-et-propositions.md` (descriptions ratifiées), et le code réel `apps/api/src` (voir `AUDIT.md`).
> Les 51 identifiants R1–R51 sont tous présents dans `spec/wf-v2.md` (vérifié). La colonne « Câblé » indique si un ancrage de la règle a été trouvé **dans le code TS** (sinon la règle vit dans la spec / le moteur Python de référence, ce qui est signalé).

**Légende Type** : `invariant` (garde 🔒 non négociable) · `garde` (contrôle conditionnel) · `projection` (propagation/événement) · `calcul` (scoring/matrice déterministe) · `état` (machine à états) · `config` (paramètre tenant).
**Base réglementaire** : dérivée de `spec/wf-v2.md:9-12` (« KYC/CLM banque privée suisse, CDB 20, LBA ») et des mentions explicites du catalogue (art. 9a LBA, LPD). Marquée « (dérivé) » quand inférée du domaine, non citée littéralement.

| # | Type | Déclencheur | Câblé (preuve) | Reformulable en Requirement ? | Base réglementaire |
|---|---|---|---|---|---|
| R1 | invariant | Apposition d'un visa sur une section | spec (visas par section : `kyc.templates.ts`, `VISAS_BY_WORKFLOW`) | **OUI** — « Un visa porte sur une seule section ; des visas sur sections distinctes sont indépendants. » | CDB 20 / OBA-FINMA (dérivé) |
| R2 | invariant 🔒 | Tentative de visa par un acteur | `rules/named-validator.ts:45-57` | **OUI** — « Seul le validateur nommé (ou son relais R4) peut viser, sauf dérogation tracée. » | LBA art. 8 / CDB 20 (contrôle nommé) |
| R3 | garde | Préparation d'une section | `rules/section-four-eyes.ts:43-47` (exclusion limitée à la section) | **OUI** — « Préparer une section n'exclut du visa que de cette section. » | Principe 4-yeux (dérivé) |
| R4 | config ⚙ | Absence du validateur | `rules/named-validator.ts:26-36` (relais), `:51-54` (dérogation tracée) | **OUI** — « En cas d'absence, le relais nommé vise ; à défaut, dérogation tracée + fiche de poste. » | CDB 20 (suppléance) |
| R5 | config ⚙ | Visa en attente (délai) | spec uniquement — non trouvé de rappel/escalade câblé sous « R5 » dans `apps/api/src` | **OUI** — « Un visa en attente déclenche rappels puis escalade selon délais tenant. » | OBA-FINMA (surveillance) (dérivé) |
| R6 | garde | Modification de données d'une section visée | `kyc.service.ts:234-241` (`kyc.visa.invalide`) | **OUI** — « Toute modification des données invalide le visa de la section touchée. » | CDB 20 (intégrité) (dérivé) |
| R7 | invariant 🔒 | Refus de visa sans motif | `rules/kyc-handoff.ts:74` (motif obligatoire au rejet) | **OUI** — « Un refus sans motivation est bloqué. » | LBA (traçabilité décision) |
| R8 | état | Écoulement du temps sur un visa accordé | spec — pas de garde temporelle dédiée « R8 » trouvée (le visa vit jusqu'au prochain événement, cf. modèle handoff) | **OUI** — « Un visa accordé reste valide jusqu'au prochain événement ; le temps seul ne le change pas. » | Principe event-driven (dérivé) |
| R9 | invariant 🔒 | Tentative de retrait discrétionnaire d'un visa | `rules/qualified-visa.service.ts:40-46` (seul le signataire retire) ; `kyc.service.ts:307` (retrait discrétionnaire refusé) | **OUI** — « Un visa accordé ne se retire pas par simple changement d'avis. » | OBA-FINMA (dérivé) |
| R10 | garde | Modification d'une section | `kyc.service.ts:234-241` (invalidation ciblée, cause `donnees_modifiees`) | **OUI** — « Modifier une section n'invalide que son visa, jamais les autres. » | CDB 20 (dérivé) |
| R11 | garde | Réassignation d'un validateur | `kyc.service.ts:315-319` (`kyc.visa.validateur.reassigne`), rôles `ROLES_REASSIGNATION` `:522` | **OUI** — « La réassignation de validateur est réservée aux rôles habilités et tracée. » | OBA-FINMA (gouvernance) |
| R12 | projection | Visa apposé hors délégation valide | `kyc.service.ts:337-338` (`risque.operationnel.incident`) | **OUI** — « Un visa hors délégation valide génère un incident de risque opérationnel. » | OBA-FINMA (risque op.) |
| R13 | invariant 🔒 | Tentative de visa par un préparateur de la section | `rules/section-four-eyes.ts:43-54` (`FourEyesViolation`) | **OUI** — « Le préparateur d'une section ne peut pas viser cette section (4-yeux). » | CDB 20 / OBA-FINMA (double contrôle) |
| R14 | invariant 🔒 | Validation finale | `kyc.service.ts:553-556` (engagement obligatoire) | **OUI** — « La validation finale exige un engagement de responsabilité explicite du signataire. » | OBA-FINMA (responsabilité) |
| R15 | état | Toutes sections visées | `kyc.service.ts:519-574` (la finale est un visa) ; `VISAS_BY_WORKFLOW` | **OUI** — « La validation finale est un visa comme un autre, déclenché quand tout est visé, invalidable en cascade. » | Principe uniforme (dérivé) |
| R16 | état | Transition de statut du dossier | `kyc.service.ts:380` (`ETATS_ACTIFS`), `:383-388, 394, 415, 530` | **OUI** — « Le dossier suit une machine à états fermée (Brouillon…Clôturé). » | OBA-FINMA (cycle de vie) (dérivé) |
| R17 | config ⚙ | Suspension d'un dossier | `kyc.service.ts:383-400` (fige + `kyc.dossier.suspendu`) ; discrétion MROS | **OUI** — « Un dossier suspendu applique des restrictions paramétrées ; le client n'est jamais notifié (art. 9a LBA). » | **LBA art. 9a** (interdiction d'informer) |
| R18 | projection | Création d'un dossier pour un prospect déjà refusé | `kyc.service.ts:163-167` (`prospect.retour.refuse.detecte`), `:373-377` | **OUI** — « Le retour d'un prospect précédemment refusé est détecté et alerté (sans blocage). » | LBA (vigilance) (dérivé) |
| R19 | config ⚙ | Inactivité d'un dossier en préparation | `kyc.service.ts:415` (abandon, état IN_PROGRESS) | **OUI** — « Un dossier en préparation inactif suit rappels J30/J60 et clôture J90 (délais tenant). » | LPD / rétention (dérivé) |
| R20 | garde | Écriture sur dossier abandonné/figé | `kyc.service.ts:383-388` (écriture métier refusée) | **OUI** — « Les données d'un dossier abandonné sont conservées (durées légales) ; pas d'écriture métier. » | **LPD** (conservation) |
| R21 | état | Changement de circonstances | spec — réouverture ciblée par section (cf. R10 mécanique) ; pas de garde unique « R21 » isolée trouvée | **OUI** — « Un changement de circonstances ne rouvre que les sections concernées ; le client reste opérationnel. » | OBA-FINMA (CoC) (dérivé) |
| R22 | garde | Évaluation d'un changement | risk-engine (le risque décide), `risk-engine.ts:36-49` | **PARTIEL/OUI** — « Ce sont les restrictions qui découlent du *risque* du changement, pas du changement lui-même. » | OBA-FINMA (approche risque) |
| R23 | état | Collision de deux process sur un dossier | spec — priorité/pause/reprise ; non isolé sous « R23 » dans le code TS trouvé | **OUI** — « Deux process concurrents ne fusionnent pas : priorité, pause/reprise, trails distincts. » | OBA-FINMA (dérivé) |
| R24 | calcul | Composition d'un dossier | `kyc.templates.ts` (`SECTIONS_BY_WORKFLOW`) | **OUI** — « Sections fixes issues du référentiel ; contenu variable selon le cas. » | CDB 20 (documentation) (dérivé) |
| R25 | config ⚙ | Visa sous réserve d'un document attendu | spec — visa conditionnel (verdict `CONDITIONAL`, `qualified-visa.service.ts:12`) | **OUI** — « Un visa conditionnel expire selon délai tenant → invalidation ou escalade. » | CDB 20 (dérivé) |
| R26 | calcul | Résolution des documents requis | `kyc/docmatrix.service.ts` (matrice documentaire) | **OUI** — « Les documents requis se déduisent du croisement type d'entité × juridiction × rôle. » | **CDB 20** (identification) |
| R27 | calcul | Sélection de juridiction | `docmatrix.service.ts` (juridiction d'abord) | **OUI** — « La juridiction, fixée en premier, résout les documents concrets. » | CDB 20 / LBA (dérivé) |
| R28 | projection | Péremption d'un document sur dossier actif | spec — crée une tâche de collecte (pas de suspension mécanique) | **OUI** — « Un document expiré crée une tâche de collecte, sans suspendre le dossier. » | CDB 20 (mise à jour) (dérivé) |
| R29 | calcul | Application d'un référentiel versionné | `kyc.service.ts:193-199` (matrice à la création), `risk-engine.ts:25-33` (barème à date) | **OUI** — « Chaque dossier estampille la version du référentiel en vigueur à sa création (grandfathering). » | OBA-FINMA (non-rétroactivité) |
| R30 | projection | Modification d'une personne | module `personnes` (personne unique, propagation par événement) | **OUI** — « La personne est un objet unique ; ses changements se propagent par événement aux N dossiers. » | CDB 20 (ayant droit) (dérivé) |
| R31 | config ⚙ | Liaison d'un rôle à une personne | module `personnes` (cumul contrôlé à la liaison) | **OUI** — « Le cumul de rôles est autorisé ou non par la banque, contrôlé à la liaison. » | CDB 20 (dérivé) |
| R32 | projection | Détection PEP (CoC/screening) | modules `personnes`/`screening` (tâche de réévaluation) | **OUI** — « La PEPisation crée une tâche de réévaluation par dossier ; aucune bascule silencieuse. » | **LBA art. 6 / OBA-FINMA** (PEP) |
| R33 | config ⚙ | Écoulement du délai PEP | spec — alerte, jamais déclassement auto | **OUI** — « L'écoulement du délai PEP alerte mais ne déclasse jamais : décision humaine (délai tenant). » | OBA-FINMA (PEP) |
| R34 | projection | Déclaration d'une relation | module `personnes` (bijectivité) | **OUI** — « Toute relation déclarée crée automatiquement sa réciproque typée. » | CDB 20 (dérivé) |
| R35 | état | Personne sans plus aucun rôle | module `personnes` (archivage, jamais suppression) | **OUI** — « Une personne sans rôle est archivée, jamais supprimée. » | LPD / rétention (dérivé) |
| R36 | garde | Constats d'identité contradictoires | spec — divergence à résoudre avec document probant + décideur | **OUI** — « Une divergence d'identité se résout avec document probant et décideur nommé. » | CDB 20 (identification) |
| R37 | config ⚙ | Contrôle Central File d'un document | spec (module `coffre`/`ged`) | **OUI** — « Le Central File, périmètre paramétré, rend un document réputé valide après contrôle. » | CDB 20 (dérivé) |
| R38 | garde | Assignation d'une tâche | module `tasks` (rôle puis personne) | **OUI** — « Une tâche assignée à un rôle est résolue vers une personne ; routage hors périmètre interdit. » | OBA-FINMA (organisation) (dérivé) |
| R39 | invariant 🔒 | Dépassement de SLA | `screening.service.ts:12-13` et CPSI `engine.py:10-11` (mesure/notifie, ne coerce pas) | **OUI** — « Le dépassement de SLA mesure et notifie ; le système ne force jamais. » | OBA-FINMA (dérivé) |
| R40 | garde | Vue de charge / réaffectation | module `workload` (réaffectation par le responsable) | **OUI** — « La réaffectation se fait par le responsable via une vue de charge par rôle. » | OBA-FINMA (organisation) (dérivé) |
| R41 | config ⚙ | Rôle sans titulaire actif | spec (déblocage d'urgence / homme-clé) | **OUI** — « Un rôle sans titulaire actif signale un risque homme-clé ; escalade paramétrée. » | OBA-FINMA (risque op.) |
| R42 | config ⚙ | Déclencheurs de screening perpétuel | module `screening`, `screening.service.ts` (4 déclencheurs) | **OUI** — « Le screening perpétuel a 4 déclencheurs, fréquences par domaine paramétrées. » | **LBA / OBA-FINMA** (surveillance) |
| R43 | config ⚙ | Cycle de vie d'un hit | `screening/rules/screening-qualification.ts` (LoD1/LoD2) | **OUI** — « Un hit suit analyse LoD1 puis clôture confirmée LoD2 (rôle tenant). » | OBA-FINMA (LoD) (dérivé) |
| R44 | invariant 🔒 | Whitelist / analyse IA | `golden-record.projector.ts` esprit R44 ; `screening.service.ts:13` ; CPSI `engine.py:10-11` | **OUI** — « L'IA analyse, l'humain décide ; les faux positifs récurrents sont whitelistés avec justification. » | OBA-FINMA (décision humaine) |
| R45 | config ⚙ | Hit sanctions confirmé | spec + `kyc.service.ts:344-365` (gel/comité) | **OUI** — « Un hit sanctions confirmé applique une sévérité paramétrée (suspension/gel/comité). » | **Sanctions / LBA** (embargo) |
| R46 | garde | Hit pendant la validation | `kyc.service.ts:344-365` (`kyc.visas.geles`, `kyc.comite.decision`) | **OUI** — « Un hit pendant la validation gèle le circuit ; le comité décide, tout est tracé. » | OBA-FINMA (dérivé) |
| R47 | config ⚙ | Lecture d'une donnée | `common/audit.service.ts` (journalisation activable) | **OUI** — « La journalisation des lectures est activable par la banque. » | LPD (dérivé) |
| R48 | calcul | Requête d'état à une date passée | `kyc.service.ts:177-190` (`etatADate`) ; `upcasters.ts` | **OUI** — « L'état à une date passée est une requête sur le journal, pas une reconstruction. » | OBA-FINMA (auditabilité) |
| R49 | invariant 🔒 | Toute écriture d'événement | `common/domain-event.ts:11-13` (append-only) ; `upcasters.ts:2-3` | **OUI** — « Le journal est append-only ; personne n'efface, pas même l'admin. » | OBA-FINMA (immutabilité) |
| R50 | projection | Demande d'export réglementaire | modules `rapports`/`audit` (registres dérogations/PEP/hits) | **OUI** — « Les registres réglementaires (dérogations, PEP, hits, retards) s'exportent en un clic. » | OBA-FINMA / LBA (reporting) |
| R51 | projection | Demande d'audit par ID KYC | `kyc.service.ts:177-190` (extraction indexée du journal) | **OUI** — « Toute demande d'audit est une extraction indexée du journal par ID KYC. » | OBA-FINMA (auditabilité) |

### Règles R1–R51 dont aucun ancrage code TS distinct n'a été trouvé
Présentes dans la spec (`spec/wf-v2.md`) et/ou le moteur Python de référence, mais **pas isolées sous leur numéro dans `apps/api/src`** lors de cet audit : **R5** (rappels/escalade de visa), **R8** (durée de vie du visa dans le temps), **R21** (réouverture ciblée), **R23** (collision de process). Elles ne sont pas déclarées absentes du produit — seulement non localisées comme garde nommée côté TS (elles peuvent vivre dans le moteur Python `workflow-engine-py`/`olive_cpsi` ou dans des modules d'écran). Ce point est un **constat de localisation**, pas un manque fonctionnel affirmé.

---

## Prolongement du namespace au-delà de R51

Le numéro de règle **continue bien au-delà de R51**, jusqu'à **R417** dans le code TS (`grep -rhoE "\bR[0-9]{1,3}\b" apps/api/src` → max R417). Répartition (indicative) :

- **R52** four-eyes final renforcé (`kyc.service.ts:533-538`) · **R53/R336** concurrence optimiste (`common/optimistic-lock.ts`).
- **R56–R62** règles tenant additionnelles + propositions ratifiées (`spec/olive-catalogue-R1-R56-et-propositions.md`).
- **R63–R86** moteur **CPSI** de scoring perpétuel — Python (`services/cpsi-server-py/olive_cpsi/engine.py:5-14`), tests `tests/test_cpsi_bloc*.py`.
- **R89–R188** vagues de câblage (golden record R104, PMS R105–108, GED R109–116, onboarding R117–124, paramètres R125–128, MROS R129–132, riskcases R133–136, personnes liées R152–159, capacité d'équipe R183–185…), consignées dans `spec/catalogue-amendement-R*.md` et le `.docx` v4.20 (285 scénarios / 319 tests, en-tête du `.docx` extrait).
- **R282–R291** matrice versionnée & barèmes de scoring · **R300** parseur SWIFT · **R336–R339** robustesse (verrou, snapshots, upcasting) · **R408–R417** moteur de screening fin (`packages/screening-engine`, `screening.service.ts`).

Le `.docx` `spec/OLive-Specifications-Moteur-Workflow-v4.20.docx` **a pu être lu** (extraction `zipfile` de `word/document.xml`, 331 138 caractères) : son en-tête confirme « Intègre les ratifications … R89→R185 · 285 identifiants de scénarios · 319 tests de corpus ».

---

## % migrable en Requirements

**Estimation : ~90 % des règles R1–R51 sont reformulables en Requirements** (48/51 marquées OUI ; R22 marquée PARTIEL car elle exprime un *principe* — « le risque décide » — plus qu'une garde isolée).

**Justification (constat) :**
- Les règles R1–R51 sont **déjà rédigées en langage d'exigence** dans `spec/wf-v2.md` (chaque règle + scénarios Gherkin « spécification exécutable », `wf-v2.md:14-17`), ce qui les rend directement transposables en Requirements testables.
- Chaque règle a un **déclencheur identifiable** et un **effet observable** (throw, événement, tâche), condition suffisante pour une reformulation « Given/When/Then ».
- Les **freins à la migration** ne sont pas la nature des règles mais leur **implémentation impérative** : l'ordre de précédence des gardes est codé dans le flux de contrôle (`kyc.service.ts:528-556`), et 4 règles (R5, R8, R21, R23) ne sont pas localisées comme garde nommée côté TS — leur reformulation en Requirement est possible sur la base de la spec, mais la **traçabilité règle↔code** devrait être reconstruite.
- Les règles marquées 🔒 (R2, R7, R9, R13, R14, R39, R44, R49…) sont des **invariants durs** : elles se reformulent en Requirements de type « invariant / il ne doit jamais arriver que… », les plus solides à migrer.

*Cette estimation porte sur la **reformulabilité** en Requirements, pas sur l'effort d'une migration technique du moteur impératif vers un moteur déclaratif (voir AUDIT.md §6, les 5 points de résistance).*
