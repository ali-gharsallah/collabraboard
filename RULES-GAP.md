# RULES-GAP.md — R1→R52 : canon, état VÉRIFIÉ dans `apps/*`, découpage proposé

> **Rapport avant code.** Objectif : porter dans le backend NestJS (`apps/api`) les règles moteur
> R1→R52 déjà **exécutables et testées** dans le moteur de référence Python
> (`services/workflow-engine-py/olive_engine/domain.py`) et le **canon**
> (`spec/olive-catalogue-R1-R56-et-propositions.md` + `docs/CANON-MASTER.md`). **Aucun code moteur
> n'est écrit avant ta validation du découpage (Lot A / B / C).**
>
> La colonne `apps/*` est un **audit vérifié ligne à ligne** (verdict jugé sur le *sens canonique*,
> pas le token ; fausses correspondances écartées — `KYC-…-R1` = suffixe de révision, `R282` ≠ R2 ;
> commentaire sans logique = REF). Légende : **IMPL** enforcement réel · **REF** mention sans logique
> · **ABSENT**. Marqueurs canon : 🔒 invariant · ⚙ paramètre tenant (R-Q).

## Tableau R1→R52 (statut vérifié)

| Réf | | Définition canonique | domain.py · test | `apps/*` (preuve) | Lot |
|---|---|---|---|---|---|
| R1 | | Visa porté par une section ; visas parallèles | `accorder_visa` · `test_V01` | **IMPL** kyc.service.ts:235 `signVisa` + `@@unique(kycFileId,sectionCode,requiredRole)` | — |
| R2 | 🔒 | Seul le validateur nommé (ou relais) signe | `accorder_visa` · `test_V01/V05` | **IMPL** rules/named-validator.ts:47 `viser` | — |
| R3 | | Exclusion 4-yeux limitée à la section préparée | `Section.preparateurs` · `test_V03` | **IMPL** rules/section-four-eyes.ts:44 `peutViser` | — |
| R4 | ⚙ | Relais à l'absence ; dérogation tracée | `_resoudre_validateur` · `test_V04/V05` | **IMPL** rules/named-validator.ts:34 | — |
| R5 | ⚙ | Rappels de visa puis escalade | `tick` · `test_V06` | **ABSENT** (aucun tick rappel-visa) | **C** |
| R6 | | Toute modif invalide le visa de la section | `modifier_donnee` · `test_V08` | **ABSENT** (kyc.service.ts:201 `answer` n'invalide pas) | **A** |
| R7 | 🔒 | Refus sans motivation = bloqué | `refuser_visa` · `test_V10` | **IMPL** screening.service.ts:76 (~40 sites) | — |
| R8 | | Pas d'expiration calendaire du visa | (absence) · `test_V13` | **ABSENT** (VisaStatus = PENDING\|SIGNED) | **A** |
| R9 | 🔒 | Pas de révocation discrétionnaire | `tenter_revocation` · `test_V14` | **ABSENT** (`retirer` in-memory, non câblé) | **A** |
| R10 | | Invalidation ciblée (autres visas intacts) | `modifier_donnee` · `test_V09` | **ABSENT** | **A** |
| R11 | | Réassignation validateur = rôles habilités | `reassigner_validateur` · `test_V12` | **ABSENT** (pas de gate de rôle) | **A** |
| R12 | | Visa hors process = incident op-risk | `annuler_pour_vice` · `test_V15` | **ABSENT** (pas de pont oprisk) | **A** |
| R13 | 🔒 | Le préparateur ne vise pas sa section | `accorder_visa` · `test_V02/PR01` | **IMPL** kyc.service.ts:252 | — |
| R14 | 🔒 | Engagement de responsabilité à la finale | `accorder_visa` · `test_V16/UI02` | **ABSENT** ⚠ (validate n'a aucun jeton d'engagement — front-only) | **A** |
| R15 | | La finale est un visa comme les autres | `_peut_etre_declencher_finale` · `test_V16/V17` | **IMPL** rules/qualified-visa.service.ts:27 | — |
| R16 | | États du dossier (Brouillon…Clôturé) | machine d'états · `test_D01` | **ABSENT** (KycStatus = 4 états plats) | **B** |
| R17 | ⚙ | Suspendu : restrictions paramétrées ; discrétion MROS | `suspendre` · `test_D02` | **ABSENT** | **C** |
| R18 | | Rejeté ≠ clôture ; retour prospect détecté | `rejeter` · `test_D03` | **ABSENT** (REFUSE existe, détection retour non) | **B** |
| R19 | ⚙ | Abandon J30/J60, clôture J90 | `tick` abandon · `test_D04` | **ABSENT** (tickSla alerte, « jamais d'auto-abandon ») | **C** |
| R20 | | Conservation LBA prime l'effacement LPD | `demande_effacement_lpd` · `test_D05` | **ABSENT** (rétention GED ≠ LBA>LPD) | **B** |
| R21 | | Réouverture ciblée ; client opérationnel | `changement_circonstances` · `test_D06` | **ABSENT** (R271 chaîne un NOUVEAU dossier) | **B** |
| R22 | | Le risque du changement décide | `changement_circonstances` · `test_D07` | **ABSENT** | **B** |
| R23 | | Collision process : pas de fusion | `ouvrir_process` · `test_D08/D09` | **ABSENT** | **B** |
| R24 | | Sections fixes, contenu variable | `evaluer_completude` · `test_S01` | **REF** kyc.templates.ts:12 (par SDD/CDD/EDD, pas 8 types) | **A** |
| R25 | ⚙ | Visa conditionnel + délai d'invalidation | `soumettre_au_visa`+`tick` · `test_S02/S10` | **ABSENT** (CONDITIONAL existe R86, délai non) | **C** |
| R26 | | Matrice doc = documents × entité × juridiction × rôle | `evaluer_completude` · `test_S03` | **IMPL** docmatrix.service.ts `evaluerCompletude` (union porteurs) — contenu ⚙ tenant | **B** |
| R27 | | La juridiction résout le document | `resoudre_document` · `test_S04` | **IMPL** docmatrix.service.ts `resoudreDocument` (groupe d'équivalence) | **B** |
| R28 | | Péremption doc = tâche, pas suspension | `tick` · `test_S05` | **IMPL** ged.service.ts `tickPeremptions` (émet `tache.ged.renouvellement`, statut reste ACTIF) | **B** |
| R29 | | Versioning matrice par date — grandfathering | snapshot FINAL_STEP · `test_S06/07/08` | **IMPL** kyc.service.ts:197/303 (via R282) | — |
| R30 | | Personne unique, propagation par événement | `creer_personne` · `test_P01` | **IMPL** personnes.service.ts:113 | — |
| R31 | ⚙ | Cumul de rôles ; flag insider | `lier_personne` · `test_P02/P03` | **IMPL** personnes.service.ts:65 | — |
| R32 | | PEPisation contagieuse → tâche | `declarer_pep` · `test_P04` | **IMPL** personnes.service.ts:132 | — |
| R33 | ⚙ | Dé-PEPisation humaine ; le délai alerte | `tick_personnes`/`lever_pep` · `test_P05` | **IMPL** personnes.service.ts:152 | — |
| R34 | | Bijectivité des relations | `declarer_relation` · `test_P06` | **IMPL** personnes.service.ts:182 | — |
| R35 | | Personne sans rôle = archivée | `retirer_role` · `test_P07` | **IMPL** personnes.service.ts:93 | — |
| R36 | | Divergence d'identité résolue | `signaler_divergence` · `test_P08` | **IMPL** personnes.service.ts:204 | — |
| R37 | ⚙ | Central File : contrôle = doc réputé valide | `controler_document` · `test_T01` | **ABSENT** | **C** |
| R38 | | Tâche rôle→personne in-scope | `creer_tache` · `test_T02/T03` | **IMPL** tasks.module.ts `creerRoutee`/`deleguer` (in-scope = RM titulaire ∪ rôle voit-tout) | **B** |
| R39 | 🔒 | Le SLA mesure/notifie, ne coerce pas | `tick_taches` · `test_T04` | **IMPL** tasks.module.ts:132 | — |
| R40 | | Vue de charge + réaffectation managériale | `reaffecter_tache` · `test_T05` | **IMPL** workload.service.ts:108 | — |
| R41 | ⚙ | Escalade d'urgence ; risque homme-clé | `escalader_deblocage` · `test_T06/T07` | **ABSENT** | **C** |
| R42 | ⚙ | Screening perpétuel, fréquences par domaine | `tick_screening` · `test_A01/A02` | **IMPL** partiel personnes.service.ts:126 (rescreen sur changement d'identité seulement) | — |
| R43 | ⚙ | Hit : LoD1 qualifie, LoD2 confirme | `qualifier_hit`/`confirmer_cloture_hit` · `test_A03` | **ABSENT** (qualify mono-acteur) | **C** |
| R44 | 🔒 | IA propose, humain décide ; whitelist justifiée | `creer_hit`/`ajouter_whitelist` · `test_A04/A05` | **IMPL** nba.module.ts:70 | — |
| R45 | ⚙ | Hit sanctions confirmé : sévérité paramétrée | `confirmer_hit` · `test_A06` | **ABSENT** | **C** |
| R46 | | Hit pendant validation gèle le circuit | `geler_pour_hit`/`decider_comite` · `test_A07` | **ABSENT** (pas d'état GELE) | **B** |
| R47 | ⚙ | Journalisation des lectures activable | `consulter_dossier` · `test_X01` | **ABSENT** (AUDIT_ACCESS existe mais non *togglable*) | **C** |
| R48 | | Rejeu à date = une requête | `etat_a_date` · `test_X02/PR03` | **IMPL** kyc.service.ts:172 `etatADate` | — |
| R49 | 🔒 | Journal append-only immuable | couche persistance · `test_X03/R49` | **IMPL** post-deploy-v2.sql:42 trigger `audit_immutable` | — |
| R50 | | Exports réglementaires standard | `rapport_*` · `test_X04` | **ABSENT** (export audit ≠ export dépôt réglementaire) | **A** |
| R51 | | Extraction preuve 4-yeux par ID | `preuve_quatre_yeux` · `test_X05/UI06` | **IMPL** audit.module.ts:44 `integrite` + `/export` | — |
| R52 | 🔒 | Contributeur exclu de la finale | `accorder_visa` FINAL · `test_V18/PR01` | **IMPL** kyc.service.ts:296 | — |

**Tally vérifié : IMPL = 23 · REF = 2 (R24, R26) · ABSENT = 27.**

## Réconciliation (audit v2 vs brouillon v1) — 3 corrections + notes

- **R1 : v1 REF → v2 IMPL.** `signVisa` (kyc.service.ts:235) résout le visa strictement par
  `sectionCode`, avec `@@unique([kycFileId, sectionCode, requiredRole])` (schema.prisma:187) : la
  portée-section du visa est un comportement enforced, pas une mention. → **retiré du Lot A.**
- **R3 : v1 ABSENT → v2 IMPL.** `SectionFourEyes` clé les contributeurs *par section* et `signVisa`
  ne l'amorce qu'avec la section courante (section-four-eyes.ts:44, kyc.service.ts:247-251) : un
  préparateur de A peut viser B — c'est exactement le sens de R3. → **retiré du Lot A.**
- **R14 : v1 IMPL → v2 ABSENT.** `validate` (kyc.service.ts:284-328) applique R13/R52/rôle/complétude
  mais **aucun jeton d'engagement de responsabilité** ; le pop-up R14 est purement front. → **ajouté
  au Lot A.**
- **Notes de dérive canonique (restent IMPL, signalées) :** **R42** ne couvre que le *rescreening sur
  changement d'identité*, pas les *fréquences perpétuelles* (facette ⚙). **R20/R28/R47/R50** ont un
  mécanisme *adjacent* mais non canonique (rétention→tâche, AUDIT_ACCESS non togglable, export audit) —
  classés ABSENT car l'élément distinctif manque.

---

## Lot A — portables directement dans NestJS (aucune migration Prisma) — 9 items

Logique pure sur `KycFile`, `KycVisa`, `KycSection`, `KycQuestionHistory`, `DomainEvent`, `Client`,
`OpRiskIncident` (déjà présents). Ordre proposé (R24 REF d'abord) :

1. **R24** (REF→IMPL) — sceller « sections fixes / contenu variable » par test canonique.
2. **R6 / R10** — modif d'une donnée invalide **le seul** visa de la section touchée (retour PENDING).
3. **R8** — pas d'expiration calendaire (règle d'absence : garde + test anti-régression).
4. **R9** — refus de révocation discrétionnaire (garde typée).
5. **R11** — réassignation validateur réservée aux rôles habilités, tracée (event).
6. **R12** — visa hors process → incident op-risk (réutilise le module OpRisk existant).
7. **R14** — jeton d'engagement de responsabilité obligatoire à la validation finale + event tracé.
8. **R50** — exports réglementaires (agrégations sur `DomainEvent`/tables existantes).

> Chiffrage : ~1 méthode service + 1 event + 1 spec autonome (fakePrisma) par règle, traduits
> **fidèlement de domain.py** (nominal ⊕ violation). Faible risque, **506 restent verts**.

## Lot B — extension du modèle Prisma (à chiffrer) — 11 items

| Règle(s) | Extension Prisma | Coût |
|---|---|---|
| **R16, R18, R20, R21, R22, R23** | `KycFile`/`Dossier` state-machine enrichie (Suspendu/Abandonné/Clôturé…) + rétention/réouverture + table `process` (collision) | **L** |
| **R26 (REF), R27, R28** | table `document_matrix` versionnée (documents × entité × juridiction × rôle, date de vigueur) | **L** |
| **R38** | `task` enrichie (résolution rôle→personne in-scope) | **M** |
| **R46** | `VisaStatus` + valeur `GELE` (enum expand) + décision comité | **S** (migration triviale) |

## Lot C — les 9 R-Q ⚙ (N'IMPLÉMENTE RIEN — question exacte, `spec/questionnaire-R-Q.md`)

| Réf | Question ouverte (verbatim) | Domaine |
|---|---|---|
| **R5** | Délais des rappels de visa et destinataires de l'escalade après le deuxième rappel ? | Visa / SLA |
| **R17** | Restrictions d'opérations en état Suspendu (ex. entrées autorisées / sorties gelées en cas de communication MROS) ? | Dossier |
| **R19** | Délais de rappel et de clôture administrative des dossiers abandonnés ? | Dossier |
| **R25** | Documents optionnels vs obligatoires par section, et délai d'invalidation du visa conditionnel (défaut 30 j) ? | Matrice doc. |
| **R37** | Périmètre exact du Central File : quels contrôles qualité, quels documents, quelle corroboration ? | Organisation |
| **R41** | Chaînes d'escalade et de déblocage d'urgence : application manager, managers de fonction, COO ; suppléances ? | Organisation |
| **R43** | Qui porte la LoD2 de confirmation des hits : MLRO ou autre rôle alloué ? | Screening |
| **R45** | Sévérité sur hit sanctions confirmé : suspension immédiate par défaut, modalités du distressed asset offboarding ? | Screening |
| **R47** | La journalisation des accès en lecture est-elle exigée ? | Audit trail |

> Chaque R-Q est **⚙ paramètre tenant** : à trancher par la banque et à répertorier au registre
> gouverné (R125→R128) avant toute implémentation. Aucune valeur par défaut codée sans arbitrage.
> Note : R5/R17/R19/R25/R43/R45/R47 supposent aussi le *mécanisme* du Lot B (états, rappels) —
> le mécanisme se porte, les *seuils/rôles* restent gouvernés.

## Règles déjà codées dans le moteur PARITÉ (front) portables vers le backend

`apps/web/src/parity/olive-wf-engine.tsx` implémente déjà, en mémoire et rejouable, le cycle de vie
visa/dossier — candidat au **port backend** (domain.py = source de vérité, parité = oracle) :
- **R6, R8, R9, R10, R11, R12, R14** (Lot A) — gardes visa (invalidation, révocation, engagement)
  déjà présentes côté parité : le port backend traduit une logique **déjà écrite et éprouvée**.
- **R16–R23** (Lot B) — machine d'états dossier + `evalInactivity`~R19 / restrictions~R17 côté parité :
  porter le mécanisme, pas les seuils (R-Q).

---

## Recommandation & attente de validation

1. **Lot A** (9 items, faible risque, 506 verts entre chaque règle), dans l'ordre listé.
2. **Lot C** : instruire les 9 R-Q au registre gouverné — décision banque, pas de code.
3. **Lot B** : après arbitrage du périmètre (états dossier + matrice doc), idéalement avec e2e Postgres.

**J'attends ta validation de ce découpage avant d'écrire la moindre ligne du Lot A.**
