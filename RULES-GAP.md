# RULES-GAP.md — R1→R52 : canon, état dans `apps/*`, découpage proposé

> **Rapport avant code.** Objectif : porter dans le backend NestJS (`apps/api`) les règles moteur
> R1→R52 déjà **exécutables et testées** dans le moteur de référence Python
> (`services/workflow-engine-py/olive_engine/domain.py`) et le **canon** (`docs/CANON-MASTER.md`
> §invariants + `spec/olive-catalogue-R1-R56-et-propositions.md`). **Aucun code n'est écrit avant
> ta validation du découpage (Lot A / B / C).**
>
> Légende statut `apps/*` : **IMPL** = enforcement réel en NestJS · **REF** = mentionné sans
> logique · **ABSENT** = aucune occurrence. Marqueurs canon : 🔒 invariant câblé · ⚙ paramètre
> tenant (R-Q). Colonne domain.py = fonction + test Python (nominal ⊕ violation) faisant foi.

## Tableau R1→R52

| Réf | | Définition canonique (catalogue) | domain.py — fonction · test | `apps/*` | Lot |
|---|---|---|---|---|---|
| R1 | | Portée du visa = une section ; visas parallèles sur sections distinctes | `soumettre_au_visa`/`accorder_visa` · `test_V01` | REF | **A** |
| R2 | 🔒 | Seul le validateur nommé (ou relais R4) signe | `accorder_visa` (NotNamedValidator) · `test_V01/V05` | **IMPL** (kyc.service) | — |
| R3 | | Exclusion 4-yeux limitée à la section préparée | `Section.preparateurs` · `test_V03` | ABSENT | **A** |
| R4 | ⚙ | Relais nommé en l'absence du validateur ; dérogation tracée | `_resoudre_validateur` · `test_V04/V05` | **IMPL** (kyc.service) | — |
| R5 | ⚙ | Rappels de visa puis escalade (délais tenant) | `tick` · `test_V06/V07` | ABSENT | **C** |
| R6 | | Toute modif de donnée invalide le visa de la section | `modifier_donnee` · `test_V08` | ABSENT | **A** |
| R7 | 🔒 | Refus sans motivation = bloqué | `refuser_visa` (MotivationRequired) · `test_V10/UI03` | **IMPL** (transverse) | — |
| R8 | | Le visa accordé ne s'expire pas au calendrier | (absence de logique) · `test_V13` | ABSENT | **A** |
| R9 | 🔒 | Pas de révocation discrétionnaire | `tenter_revocation` (RevocationNotAllowed) · `test_V14` | ABSENT | **A** |
| R10 | | Modifier une section n'invalide que son visa | `modifier_donnee` · `test_V09` | ABSENT | **A** |
| R11 | | Réassignation validateur réservée aux rôles habilités, tracée | `reassigner_validateur` · `test_V12` | ABSENT | **A** |
| R12 | | Visa hors process = incident de risque opérationnel | `annuler_pour_vice` · `test_V15` | ABSENT | **A** |
| R13 | 🔒 | Le préparateur d'une section ne vise jamais sa section | `accorder_visa` (FourEyesViolation) · `test_V02/PR01` | **IMPL** (kyc.service) | — |
| R14 | 🔒 | Pop-up d'engagement à la validation finale | `accorder_visa` (EngagementRequired) · `test_V16/UI02` | **IMPL** (kyc.service) | — |
| R15 | | La finale est un visa comme les autres | `_peut_etre_declencher_finale` · `test_V16/V17` | **IMPL** (kyc.service) | — |
| R16 | | États du dossier (Brouillon…Clôturé) | `rattacher_alerte`/machine d'états · `test_D01` | ABSENT | **B** |
| R17 | ⚙ | Suspendu : restrictions paramétrées ; discrétion MROS | `suspendre`/`operation_autorisee` · `test_D02` | ABSENT | **C** |
| R18 | | Rejeté ≠ clôture ; retour d'un prospect refusé détecté | `rejeter`/detection `creer_dossier` · `test_D03` | ABSENT | **B** |
| R19 | ⚙ | Abandon : rappels J30/J60, clôture J90 (tenant) | `tick` abandon · `test_D04/K01` | ABSENT | **C** |
| R20 | | Conservation LBA (durée légale) prime l'effacement LPD | `demande_effacement_lpd` · `test_D05` | ABSENT | **B** |
| R21 | | Réouverture ciblée ; client reste opérationnel | `changement_circonstances` · `test_D06` | ABSENT | **B** |
| R22 | | C'est le risque du changement qui déclenche les restrictions | `changement_circonstances` (branche risque) · `test_D07` | ABSENT | **B** |
| R23 | | Collision de process : pas de fusion, trails distincts | `ouvrir_process`/`reprendre_recertification` · `test_D08/D09` | ABSENT | **B** |
| R24 | | Sections fixes, contenu variable (8 types) | `type_entite`→`evaluer_completude` · `test_S01` | REF | **A** |
| R25 | ⚙ | Visa conditionnel + délai d'invalidation (défaut 30 j) | `soumettre_au_visa`+`tick` · `test_S02/S10` | ABSENT | **C** |
| R26 | | Matrice doc = documents × entité × juridiction × rôle | `evaluer_completude` · `test_S03` | REF | **B** |
| R27 | | La juridiction (fixée d'abord) résout le document | `resoudre_document` · `test_S04` | ABSENT | **B** |
| R28 | | Péremption sur dossier actif = tâche, pas suspension | `tick` (péremption) · `test_S05` | ABSENT | **B** |
| R29 | | Versioning matrice par date de vigueur — grandfathering | snapshot au FINAL_STEP · `test_S06/S07/S08` | **IMPL** partiel (R282, kyc) | **B** |
| R30 | | Personne = objet unique, propagation par événement | `creer_personne`/`changement_circonstances_personne` · `test_P01` | **IMPL** (personnes) | — |
| R31 | ⚙ | Cumul de rôles selon politique ; flag insider | `lier_personne` · `test_P02/P03` | **IMPL** (personnes) | — |
| R32 | | PEPisation contagieuse → tâche de réévaluation | `declarer_pep` · `test_P04` | **IMPL** (personnes) | — |
| R33 | ⚙ | Dé-PEPisation humaine ; le délai alerte, ne déclasse pas | `tick_personnes`/`lever_pep` · `test_P05` | **IMPL** (personnes) | — |
| R34 | | Bijectivité des relations déclarées | `declarer_relation`/`supprimer_relation` · `test_P06` | **IMPL** (personnes) | — |
| R35 | | Personne sans rôle = archivée, jamais supprimée | `retirer_role` · `test_P07` | **IMPL** (personnes) | — |
| R36 | | Divergence d'identité = à résoudre (doc + décideur) | `signaler_divergence`/`resoudre_divergence` · `test_P08` | **IMPL** (personnes) | — |
| R37 | ⚙ | Central File : périmètre paramétré ; contrôle = doc réputé valide | `deposer_document_central_file`/`controler_document` · `test_T01` | ABSENT | **C** |
| R38 | | Tâche : rôle puis personne en scope ; routage hors périmètre interdit | `creer_tache` (NotAuthorized)/`deleguer_tache` · `test_T02/T03` | ABSENT | **B** |
| R39 | 🔒 | Le SLA mesure et notifie, ne coerce jamais | `tick_taches` · `test_T04/K01` | **IMPL** (reviews/tasks) | — |
| R40 | | Vue de charge par rôle + réaffectation managériale | `reaffecter_tache`/`vue_de_charge` · `test_T05` | **IMPL** partiel (workload R183) | **B** |
| R41 | ⚙ | Chaîne d'escalade d'urgence ; risque homme-clé | `escalader_deblocage`/`detecter_vacances` · `test_T06/T07` | ABSENT | **C** |
| R42 | ⚙ | Screening perpétuel, fréquences par domaine | `tick_screening` · `test_A01/A02` | **IMPL** partiel (personnes/screening) | — |
| R43 | ⚙ | Cycle de vie du hit : LoD1 qualifie, LoD2 confirme | `qualifier_hit`/`confirmer_cloture_hit` · `test_A03` | ABSENT | **C** |
| R44 | 🔒 | IA analyse, humain décide ; whitelist justifiée | `creer_hit`/`ajouter_whitelist`/`decider_whitelist` · `test_A04/A05` | **IMPL** (mros/screening) | — |
| R45 | ⚙ | Hit sanctions confirmé : sévérité paramétrée | `confirmer_hit` · `test_A06` | ABSENT | **C** |
| R46 | | Hit pendant validation : gèle le circuit, comité décide | `geler_pour_hit`/`decider_comite` · `test_A07` | ABSENT | **A** |
| R47 | ⚙ | Journalisation des lectures activable | `consulter_dossier` · `test_X01` | ABSENT | **C** |
| R48 | | Rejeu à date = une requête, pas une reconstruction | `etat_a_date` · `test_X02/R48/PR03` | **IMPL** (asOf) | — |
| R49 | 🔒 | Journal append-only immuable (triggers base) | couche persistance (events.py + triggers) · `test_X03/R49` | **IMPL** (DB triggers) | — |
| R50 | | Exports réglementaires (dérogations, PEP, hits, retards) | `rapport_*` · `test_X04` | ABSENT | **A** |
| R51 | | Extraction par ID KYC (preuve 4-yeux) | `preuve_quatre_yeux` · `test_X05/UI06` | **IMPL** partiel (audit) | — |
| R52 | 🔒 | Contributeur au dossier exclu de la validation finale | `accorder_visa` (FINAL_STEP) · `test_V18/PR01` | **IMPL** (kyc.service) | — |

**Tally** ≈ **22 IMPL · 3 REF (R1, R24, R26) · 27 ABSENT** — cohérent avec l'audit repo (les
27 ABSENT se répartissent 9 en **Lot C**, ~8 en **Lot A**, ~10 en **Lot B**).

---

## Lot A — portables directement dans NestJS (logique pure sur les modèles existants)

Aucune migration Prisma : ces règles opèrent sur `KycFile`, `KycVisa`, `KycSection`,
`KycQuestionHistory`, `DomainEvent`, `Client` déjà présents. Ordre proposé (commence par les
formalisations REF que tu as citées) :

1. **R1** (REF→IMPL) — portée du visa = section ; formaliser l'invariant + test.
2. **R24** (REF→IMPL) — sections fixes / contenu variable (déjà structurel : sceller par test).
3. **R3** — exclusion 4-yeux strictement limitée à la section (contribs par section).
4. **R6 / R10** — invalidation du visa sur modif de donnée, **ciblée** à la section touchée.
5. **R8** — pas d'expiration calendaire du visa (règle d'absence : garde + test anti-régression).
6. **R9** — refus de révocation discrétionnaire (garde typée).
7. **R11** — réassignation validateur réservée aux rôles habilités, tracée (event).
8. **R12** — annulation pour vice → incident op-risk tracé.
9. **R46** — hit pendant validation : statut visa `GELE` + décision comité (sur `KycVisa`).
10. **R50** — exports réglementaires standard (agrégations sur `DomainEvent`/tables existantes).

> Chiffrage Lot A : ~1 service-method + 1 event + 1 spec autonome (fakePrisma) par règle,
> traduits **fidèlement de domain.py** (nominal ⊕ violation). Faible risque, 506 restent verts.

## Lot B — nécessitent une extension du modèle Prisma (à chiffrer)

| Règle(s) | Extension Prisma requise | Coût |
|---|---|---|
| **R16, R18, R20, R21, R22** | `KycFile.status` enrichi (Suspendu/Abandonné/Clôturé…) + colonnes rétention/réouverture ; `Dossier` state-machine | **M** (migration expand + service d'états) |
| **R23** | table `process` (collision, priorité, pause/reprise, trails distincts) | **L** |
| **R26, R27, R28, R29** | table `document_matrix` versionnée (documents × entité × juridiction × rôle, date de vigueur) — R29 partiellement fait via R282 | **L** |
| **R38, R40** | table `task` enrichie (rôle→personne in-scope, vue de charge) — R40 partiel via workload R183 | **M** |

> Chiffrage global Lot B : 3–4 migrations expand-only + services d'états + specs. À planifier
> **après** validation du périmètre (et idéalement avec e2e Postgres actif pour la state-machine).

## Lot C — les 9 R-Q ouvertes (N'IMPLÉMENTE RIEN — question exacte, `spec/questionnaire-R-Q.md`)

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

> Chaque R-Q est **⚙ paramètre tenant** : la question doit être tranchée par la banque et
> répertoriée au registre gouverné (R125→R128) avant toute implémentation. Aucune valeur par
> défaut n'est codée sans arbitrage.

## Règles déjà codées dans le moteur PARITÉ (front) portables vers le backend

Le moteur parité `apps/web/src/parity/olive-wf-engine.tsx` implémente déjà, en mémoire, une part
du cycle de vie visa/dossier — candidates au **port backend** plutôt qu'à une réécriture :

- **R1–R15, R52** — cycle de vie du visa 4-yeux (createDossier/editField/submitForVisa/grantVisa/
  recuseVisa) : le pont `wfProdEngine` (olive-demo) montre que ces événements sont déjà rejouables.
- **R5 (tickReminder)**, **R17 (restrictions état suspendu)**, **R19 (evalInactivity)** — la logique
  de rappel/inactivité/restriction existe côté parité ; **mais ce sont des R-Q (Lot C)** : porter le
  *mécanisme*, pas les *seuils* (qui restent gouvernés).
- **R9, R11, R14** — gardes de révocation / réassignation / engagement déjà présentes en parité.

> Recommandation : le port backend prend **domain.py comme source de vérité** (exécutable + testé),
> et se sert du moteur parité comme **oracle d'équivalence** (parité JS ⇄ Python déjà prouvée).

---

## Recommandation d'ordre & attente de validation

1. **Lot A** d'abord (faible risque, 506 verts entre chaque règle), règle par règle, tests
   traduits de domain.py, dans l'ordre listé (R1, R24 d'abord).
2. **Lot C** : ouvrir/instruire les 9 R-Q au registre gouverné — décision banque, pas de code.
3. **Lot B** : après arbitrage du périmètre d'états dossier + matrice documentaire.

**J'attends ta validation de ce découpage avant d'écrire la moindre ligne du Lot A.**
