# Lot C — paramètres gouvernés en attente d'arbitrage banque

Les 9 règles ci-dessous (facette ⚙ « R-Q ») ne sont **pas** codées avec des valeurs par défaut :
leur *mécanisme* est en place, mais les *seuils / rôles / délais / périmètres* relèvent d'une
décision métier de la banque. Ce document est le bordereau de décision : pour chaque règle, ce qui
est **déjà porté** (le mécanisme, testé) et ce qui **reste à trancher** (la valeur). Une fois la
valeur arbitrée, elle se saisit au **registre gouverné** (`Tenant.settings`, R125→R128) ou via la
publication de référentiel (`publier()`), **sans nouvelle ligne de code applicatif**.

> Principe : *le mécanisme se porte, la valeur se gouverne.* Aucun seuil n'est codé en dur ;
> l'absence de valeur donne un défaut **neutre** (ne bloque rien, ne fabrique aucun seuil).

| Réf | Décision attendue (verbatim R-Q) | Domaine | Mécanisme déjà en place | Point de saisie |
|---|---|---|---|---|
| **R5** | Délais des rappels de visa et destinataires de l'escalade après le 2ᵉ rappel ? | Visa / SLA | Rappels/escalade SLA mesurés & tracés, jamais coercitifs (R39/R242 — `tasks`) | `settings` (délais, rôle d'escalade) |
| **R17** | Restrictions d'opérations en état Suspendu (entrées autorisées / sorties gelées si comm. MROS) ? | Dossier | `suspendre` pose un snapshot `restrictions` ; `operationAutorisee(entree\|sortie)` le lit | `restrictions` à la suspension / `settings` |
| **R19** | Délais de rappel et de clôture administrative des dossiers abandonnés ? | Dossier | `abandonner`/`reactiver` + tick d'inactivité (mécanisme R19) | `settings` (rappel 1/2, clôture) |
| **R25** | Documents optionnels vs obligatoires par section ; délai d'invalidation du visa conditionnel (défaut proposé 30 j) ? | Matrice doc. | Matrice versionnée `doc_matrix_versions` + `evaluerCompletude` (union porteurs, R26/R27) | `publier()` (contenu matrice) |
| **R37** | Périmètre exact du Central File : quels contrôles qualité, quels documents, quelle corroboration ? | Organisation | GED : contrôle qualité / réputation de validité (mécanique R110) | `settings` (périmètre CF) |
| **R41** | Chaînes d'escalade & déblocage d'urgence : application manager, managers de fonction, COO ; suppléances ? | Organisation | Réaffectation managériale tracée (R40 — `workload`) | `settings` (chaîne d'escalade) |
| **R43** | Qui porte la LoD2 de confirmation des hits : MLRO ou autre rôle alloué ? | Screening | Décision comité sur hit (`deciderComite`, R46) ; gel des visas (`GELE`) | `settings` (rôle LoD2) |
| **R45** | Sévérité sur hit sanctions confirmé : suspension immédiate par défaut ? modalités du distressed asset offboarding ? | Screening | `gelerPourHit` + `deciderComite(offboarding)` propose l'offboarding | `settings` (politique de sévérité) |
| **R47** | La journalisation des accès en lecture est-elle exigée ? | Audit trail | Restitution GED tracée « qui a vu quoi » (R112) déjà émise | `settings` (activation log lecture) |

## Ce que la banque doit fournir, par domaine

- **Visa / SLA (R5)** : durées des rappels 1 & 2, seuil d'escalade, rôle destinataire de l'escalade.
- **Dossier (R17, R19)** : matrice entrées/sorties autorisées par cause de suspension (dont cas MROS) ;
  délais de rappel puis de clôture administrative d'un dossier abandonné.
- **Matrice documentaire (R25)** : par type d'entité et juridiction, la liste des documents
  **obligatoires** vs **optionnels** et les groupes d'équivalence ; délai d'invalidation d'un visa
  conditionnel (proposition à valider : 30 j).
- **Organisation (R37, R41)** : périmètre de contrôle du Central File ; chaînes d'escalade et de
  déblocage d'urgence (application manager → managers de fonction → COO) et règles de suppléance.
- **Screening (R43, R45)** : rôle porteur de la LoD2 (confirmation des hits) ; politique de sévérité
  sur hit sanctions confirmé et modalités d'offboarding.
- **Audit (R47)** : exigence (oui/non) de journalisation des accès en lecture.

## Après arbitrage

1. Saisir chaque valeur au registre gouverné (`Tenant.settings`) ou publier la matrice
   (`POST /doc-matrix`) — **pas de code applicatif**.
2. Le mécanisme correspondant l'applique immédiatement (défaut neutre → valeur gouvernée).
3. Tracer la décision (acteur, date) au journal de gouvernance (R125→R128).

_Source de vérité des mécanismes : `services/workflow-engine-py` (domain.py / referentiel.py).
Correspondance règle→implémentation : `RULES-GAP.md`._
