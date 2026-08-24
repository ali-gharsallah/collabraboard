<!-- ═══════════════════════════════════════════════════════════════════════════
  BLOC 65 — versé au repo le 09.08.2026 (session PO du 09.08.2026).
  RENUMÉROTATION (arbitrage PO 09.08.2026, même règle que Blocs 62/63/64) :
  session R459–R472 → repo R466–R479 (la réservation On-premise PK glisse à R480+).
  Références transverses : session R438 (pop-up) → repo R445 · session R328 → repo R331.
  Table complète : spec/mapping-session-repo.md. LE REPO FAIT FOI.
  Découpage d'exécution (arbitrage PO) : Volet A = moteur (HR-01..14, R466–R473),
  Volet B = décision unifiée (HR-15..22, R474–R479).
  Mapping des outcomes AR libres (arbitrage PO) : « EDD triggered »→NON CONFORME+proposition
  EDD · « Risk upgraded »→RÉSERVES+tâches · « Escalation required »→NON CONFORME+proposition
  CoC · « Completed / No change »→CONFORME — consigné dans MIGRATION_DIVERGENCES.md.
  RATIFICATION PO le 10.08.2026 — après 22/22 verts (Volet A HR-01..14 · Volet B HR-15..22,
  CI verte d0ccb41/b680964) et migration des écrans démo (étape 9, v2026-08-09.17/.18,
  recettes 15/15 + 20/20). Reliquat consigné (ECARTS-FRONT E-HR-4) : barre R474 sur les
  écrans BT/Offboarding démo.
════════════════════════════════════════════════════════════════════════════ -->

# Bloc 65 · Harmonisation des revues — KYC · Account Review · Group Account Review
**Règles R466–R479 · Scénarios HR-01…HR-22 · Statut : RATIFIÉ (PO, 10.08.2026) — 22/22 verts**
**Principe directeur** : un seul dossier, un seul moteur, un seul écran, **une seule façon de décider** — trois contenus. Le KYC, l'Account Review et la Group Account Review deviennent trois **types** du même objet dossier, jamais trois implémentations. La décision d'étape (valider · refuser · renvoyer) est un composant unique, fluide, réutilisé par tous les workflows du moteur.
---
## 0. Audit préalable (constat démo, 08.08.2026)
| Constat | Détail | Écart |
|---|---|---|
| **KYC = référence** | Dossier moteur certifié (KYC_STD 34/34) : sections R78 (questionnaire, droits par rôle, owner, validateur, échange), visas R15, états R16, événements | — |
| **AR = table plate hors moteur** | `ACCOUNT_REVIEWS_DATA` : `status` muté à la main (PENDING/IN_PROGRESS/COMPLETED/OVERDUE), `outcome` en **texte libre** (« EDD triggered », « Risk upgraded », « Escalation required »), `nextReviewDate` posée à la main ou null. `WF_DEFS ACCOUNT_REVIEW` existe au moteur et `INSTANCE_STARTED` est émis — mais le record ne vit pas comme un dossier à sections/visas | **E-HR-1** |
| **Section Designer déjà unifié** | UN composant, trois jeux de paramètres (`WF_KYC/WF_AR/WF_GAR_SECTIONS_PARAM`) — « même mécanique de visas » (R24) déclarée pour l'AR, sections GAR définies (comptes liés, vue consolidée, décision de groupe) | acquis à réutiliser |
| **GAR = config sans objet** | Le template GAW (WF_MGMT) et les sections GAR existent en **couche de configuration**, mais aucun dossier de groupe n'existe au moteur : le déclenchement groupe crée N records AR marqués `groupTriggered` — la « consolidation » et la « décision de groupe » n'ont **aucun objet porteur** | **E-HR-3** |
| **Cascade hors moteur** | `AR_GROUP_CONFIG` muté en direct (PARAM_CHANGED émis mais sans pop-up ni versioning), cascade par appels de fonction directs, critère de groupe **codé en dur** (UBO commun) | **E-HR-2** |
| **Verdicts non normalisés** | Le registre art. 7 calcule CONFORME/RÉSERVES/NON CONFORME ; l'AR sort des outcomes libres — deux vocabulaires pour la même réalité | couvert R468 |
| **Deux couches de définition** | WF_MGMT_TEMPLATES (config, 12 workflows dont GAW) et WF_DEFS (moteur) coexistent sans lien de compilation | couvert R472 |
---
## 1. Règles
### R466 — KYC, AR et GAR sont trois TYPES du même dossier
**Invariant (fixe).**
Un seul modèle : le dossier — sections R78 complètes (questionnaire, droits par rôle, préparateur, validateur nommé R2, remplaçant R4, échange), visas R15, exclusion R13, états R16, événements append-only, SLA moteur. Le type (`KYC` | `ACCOUNT_REVIEW` | `GROUP_ACCOUNT_REVIEW`) sélectionne le jeu de sections paramétré (Section Designer existant) et le gabarit de workflow — **jamais** une structure de données ou un code dédié. `ACCOUNT_REVIEWS_DATA` cesse d'être une table plate : chaque revue est une instance, son statut une projection (E-HR-1). Aucun `outcome` en texte libre.
### R467 — L'Account Review part du dernier KYC approuvé — la revue est un DIFF visé
**Invariant (fixe).**
À l'ouverture d'une AR, les sections sont **pré-remplies** depuis le dernier dossier KYC approuvé du client (le lien `kycRef` existant devient structurel). Chaque réponse porte son origine : `REPRISE` (inchangée, avec référence à la réponse source) ou `MODIFIÉE` (ancien/nouveau tracés). L'objet de la revue est le **delta** : le validateur voit la liste des changements, son visa la référence. Une section sans changement peut être visée en bloc (« revu, inchangé ») — comportement tenant. La revue ne re-saisit jamais ce qui n'a pas bougé ; elle prouve ce qui a bougé.
### R468 — Verdict de revue normalisé, conséquences proposées — jamais exécutées seules
**Invariant (vocabulaire) — conséquences tenant.**
Le verdict d'une revue est un objet visé, à trois valeurs alignées sur le registre art. 7 LBA : `CONFORME` | `RÉSERVES` | `NON CONFORME`. Les conséquences sont **paramétrables et toujours proposées, jamais automatiques** (R44) : RÉSERVES → tâches de remédiation nominatives ; NON CONFORME → proposition d'aiguillage (passage EDD, Change of Circumstances, ouverture d'offboarding Bloc 62) que l'humain accepte, ajuste ou rejette. Les outcomes libres existants migrent en verdicts + tâches (mapping consigné). `nextReviewDate` n'est **jamais posée à la main** : elle se calcule depuis la périodicité tenant par niveau de risque à la clôture de la revue, et se recalcule si le niveau de risque change.
### R469 — Le groupe est un RÉFÉRENTIEL paramétrable, sa composition une projection
**Tenant.**
Le critère de groupe est un paramètre : `UBO_COMMUN` (existant) | `FAMILLE` | `GROUPE_CORPORATE_DECLARE` — combinables. La composition d'un groupe est calculée (projection sur le graphe des personnes et liens R30+), jamais une liste stockée ; chaque évaluation d'appartenance est traçable. Changer de critère recompose les groupes **pour les revues futures** (grandfathering R29 sur les GAR en cours) et passe par le pop-up R445 (E-HR-2).
### R470 — La GAR est un dossier PARENT lié à ses dossiers membres
**Invariant (fixe).**
Le déclenchement d'une revue de groupe crée : (1) **un dossier parent** de type `GROUP_ACCOUNT_REVIEW` portant les sections propres au groupe (comptes liés, vue consolidée du risque, décision de groupe — Section Designer GAR existant) ; (2) **N dossiers AR standard**, un par membre, chacun lié au parent (E-HR-3 : la consolidation a enfin un objet porteur). La **vue consolidée** est une projection des dossiers membres (verdicts, scores, alertes) — jamais une re-saisie. La **décision de groupe** est un visa R15 qui référence les verdicts de tous les membres. Guard « membres non clôturés » sur la validation du parent (sévérité tenant, défaut BLOQUANT). Le préparateur du parent ne vise pas la décision de groupe (R13).
### R471 — Les cascades sont des ÉVÉNEMENTS du moteur, paramétrées tenant
**Mécanisme invariant — activation tenant.**
Trois paramètres (`enabled`, `cascadeGroupToMembers`, `cascadeMemberToGroup` — repris de l'existant) pilotent des **événements** (`REVIEW_CASCADE_TRIGGERED` portant l'origine), jamais des appels de fonction directs. Anti-boucle invariant : un dossier né d'une cascade ne re-cascade pas. Chaque dossier créé par cascade trace son origine (dossier source + paramètre invoqué). Modification des toggles : pop-up R445, versionné, grandfathering.
### R472 — Une interface, une couche de définition
**Invariant (fixe) — affichage tenant.**
Les trois types rendent le **même gabarit d'écran de dossier** : liste des sections avec état de visa, timeline d'événements, documents, barre d'actions — un seul composant, zéro fork. Les différences (colonnes, libellés, panneaux additionnels comme la vue consolidée GAR) sont des **paramètres d'affichage tenant** (mécanisme « Colonnes & libellés par écran » existant). Côté définition : les templates de la couche Workflow Management (SOW…GAW) se **compilent** en WF_DEF versionnées du moteur — deux couches, une seule vérité ; un template modifié produit une nouvelle version datée, jamais une divergence silencieuse.
### R473 — Paramétrage §Review unifié
**Tenant + pop-up R445.**
Un seul registre pour les trois types : périodicités par niveau de risque, sections par type (Section Designer), verdicts et conséquences proposées, critère de groupe, cascades, sévérité du guard de consolidation, comportement « visa en bloc des sections inchangées ». Toute modification : pop-up d'engagement → `PARAM_CHANGED` versionné, grandfathering R29 sur les revues en cours.
---
## 1bis. La décision d'étape — un geste, trois issues, partout pareil
### R474 — La décision d'étape est un objet uniforme à trois issues
**Invariant (fixe) — libellés tenant.**
Sur toute étape à visa, la barre de décision est **le même composant** avec exactement trois issues + une action de disponibilité :
- **✓ Valider** — appose le visa R15 (validateur nommé, horodaté), franchit la transition si les guards passent ;
- **✕ Refuser** — motif obligatoire (code + texte), issue routée selon le paramétrage de l'étape (R476) ;
- **↩ Renvoyer** — rebroussement vers une étape antérieure **ciblée** (R475), motif obligatoire ;
- **⇄ Déléguer** — passe la main au remplaçant désigné (R4), tracé.
Mêmes boutons, même ordre, mêmes raccourcis, mêmes règles (exclusion R13, guards) sur KYC, AR, GAR — et réutilisables par tout workflow du moteur (Business Trip, Offboarding). Les libellés sont paramétrables par tenant et par type ; le comportement, jamais.
### R475 — Le renvoi est un rebroussement CIBLÉ, tracé, jamais une gomme
**Invariant (fixe).**
Renvoyer émet `STEP_SENT_BACK` portant : étape cible (choisie parmi les étapes antérieures du gabarit), motif obligatoire, sections/points à reprendre (cochables). Effets :
- les visas des étapes **re-traversées tombent** — par événements de chute tracés, jamais par effacement (l'historique montre le premier passage ET le renvoi) ;
- les tâches de reprise sont **recréées nominativement** pour les owners des sections concernées, avec le motif en tête ;
- le dossier reste le même dossier (pas de nouvelle version, pas de duplication) — c'est une nouvelle traversée du même chemin, comptée.
Un **compteur de boucles** est visible sur le dossier ; au-delà d'un seuil tenant (défaut 3), un signal est levé vers le manager (AVERTISSEMENT — jamais de blocage automatique, R39). Le renvoi de la décision de groupe GAR peut cibler un dossier membre : le motif est routé vers ce membre.
### R476 — Le refus est motivé et son issue paramétrée par étape
**Mécanisme invariant — issue tenant.**
Un refus n'est pas la mort du dossier par défaut. Chaque étape du gabarit déclare son issue de refus : `TERMINAL` (dossier REJECTED, état R16) | `RENVOI` (équivaut à un renvoi vers une étape désignée) | `CLOTURE_MOTIVEE` (fin propre avec verdict). Le motif est structuré : code depuis un référentiel tenant (documents insuffisants, risque inacceptable, informations contradictoires…) + texte libre obligatoire. Le refus est un événement, l'issue une transition — rien ne se perd.
### R477 — Fluidité d'exécution : décider ne coûte qu'un geste
**Invariant UX (fixe).**
- La décision se prend **depuis la barre**, sans navigation : le motif se saisit inline (panneau qui s'ouvre sous le bouton), jamais sur une autre page.
- **Confirmation optimiste** : le visa s'affiche immédiatement, l'événement se consigne en arrière-plan ; si le moteur refuse (guard, R13), l'interface **revient en arrière visiblement** et affiche la règle en clair (« Exclusion 4-yeux — vous avez préparé cette section (R13) ») — jamais un échec silencieux, jamais un rechargement de page.
- **Raccourcis clavier** : V valider · R refuser · B renvoyer · D déléguer — actifs quand la barre a le focus, affichés au survol.
- Ce qui bloque est **annoncé avant le clic** : si un guard échoue déjà (section incomplète, membre non clôturé), le bouton Valider est actif mais porte le badge du blocage — cliquer montre le détail, le moteur reste seul juge.
- Le contexte nécessaire à la décision (delta R467, verdicts membres R470, documents) est **sur le même écran** que la barre — décider ne demande jamais d'ouvrir un autre onglet.
### R478 — La corbeille de visas unifiée : « À décider »
**Invariant (fixe) — tri tenant.**
Un écran unique liste **toutes** les décisions en attente de l'utilisateur, tous types confondus (KYC, AR, GAR, Business Trip, Offboarding…), triées par SLA (défaut) avec badge de délai (vert/ambre/rouge = échu). Chaque ligne ouvre le dossier **directement à l'étape à décider**, barre de décision prête. Les tâches de reprise nées d'un renvoi (R475) y figurent pour les owners. C'est la promesse : l'utilisateur ne cherche jamais où décider.
### R479 — Après la décision : l'enchaînement est proposé, jamais imposé
**Tenant.**
Après une décision, le comportement est paramétrable par utilisateur : `SUIVANT` (défaut — le prochain dossier de la corbeille s'ouvre, avec bandeau de confirmation de la décision précédente et **annulation possible tant que la transition n'est pas consommée par un tiers**) | `RESTER` (le dossier reste ouvert, état mis à jour). Le mode SUIVANT fait de la corbeille une file de travail fluide ; le mode RESTER convient à l'instruction approfondie. Jamais de dialogue modal de confirmation pour une validation simple — la confirmation, c'est le bandeau réversible.
---
## 2. Paramètres tenant — R-Q §Review
| Clé | Type | Défaut | Règle |
|---|---|---|---|
| `settings.review.periodiciteMois` | map risque→mois | HIGH 12 · MEDIUM 24 · LOW 36 · PEP 12 | R468 |
| `settings.review.verdictConsequences` | map verdict→actions proposées | RÉSERVES→[TACHES_REMEDIATION] · NON_CONFORME→[PROPOSER_EDD, PROPOSER_COC, PROPOSER_OFFBOARDING] | R468 — proposées, jamais exécutées seules |
| `settings.review.visaEnBlocSectionsInchangees` | bool | `true` | R467 |
| `settings.review.groupe.criteres` | enum[] | `["UBO_COMMUN"]` | R469 |
| `settings.review.groupe.enabled` | bool | `true` | R471 (repris AR_GROUP_CONFIG) |
| `settings.review.groupe.cascadeGroupToMembers` | bool | `true` | R471 |
| `settings.review.groupe.cascadeMemberToGroup` | bool | `true` | R471 |
| `settings.review.groupe.guardMembresNonClotures` | enum BLOQUANT\|AVERTISSEMENT | `BLOQUANT` | R470 |
| `settings.review.affichageParType` | map type→config écran | gabarit unique, colonnes par défaut | R472 |
| `settings.decision.libelles` | map type→{valider, refuser, renvoyer, deleguer} | ✓ Valider · ✕ Refuser · ↩ Renvoyer · ⇄ Déléguer | R474 — libellés seulement, jamais le comportement |
| `settings.decision.motifsRefus` | code[] | DOCS_INSUFFISANTS · RISQUE_INACCEPTABLE · INFOS_CONTRADICTOIRES · AUTRE | R476 |
| `settings.decision.issueRefusParEtape` | map gabarit×étape→TERMINAL\|RENVOI\|CLOTURE_MOTIVEE | validation finale=TERMINAL · étapes intermédiaires=RENVOI | R476 |
| `settings.decision.renvoi.seuilBoucles` | int | `3` | R475 — signal manager au-delà, jamais de blocage |
| `settings.decision.apresDecision` | enum SUIVANT\|RESTER (par utilisateur) | `SUIVANT` | R479 |
| `settings.decision.corbeille.tri` | enum SLA\|DATE\|TYPE | `SLA` | R478 |
Écran : **Paramétrage → Revues (KYC · AR · GAR)** — remplace le panneau AR isolé ; chaque changement via pop-up R445.
---
## 3. Scénarios Gherkin — HR-01…HR-22
*Rouges avant tout code. Bloc terminé à 22/22 verts.*
### HR-01 — Trois types, une structure (R466)
```gherkin
Quand un dossier KYC, une Account Review et une Group Account Review sont créés
Alors les trois émettent les mêmes événements de cycle (WORKFLOW_STARTED, TRANSITION_FIRED…)
Et les trois portent des sections R78 avec visas R15 — aucune table plate, aucun champ status muté
Et le type ne change que le jeu de sections et le gabarit résolus — jamais la structure
```
### HR-02 — L'AR est pré-remplie du dernier KYC (R467)
```gherkin
Étant donné un client dont le dernier KYC approuvé contient la réponse "Origine des fonds : héritage 2019"
Quand une Account Review est ouverte
Alors la section correspondante est pré-remplie avec origine=REPRISE et la référence à la réponse source
Quand le RM modifie la réponse en "héritage 2019 + cession d'entreprise 2026"
Alors l'origine devient MODIFIÉE avec ancien et nouveau tracés
```
### HR-03 — La revue est un diff visé (R467)
```gherkin
Étant donné une AR dont 2 réponses sont MODIFIÉES et 14 REPRISES
Quand le validateur ouvre la revue
Alors le delta (2 changements, ancien/nouveau) lui est présenté en tête
Et son visa référence la liste des changements revus
Et les sections sans changement sont visées en bloc "revu, inchangé" (paramètre tenant actif)
```
### HR-04 — Verdict normalisé, conséquence proposée — l'humain décide (R468, R44)
```gherkin
Étant donné une AR dont le validateur pose le verdict NON CONFORME
Alors une tâche de proposition d'aiguillage est créée (options : EDD, Change of Circumstances, offboarding)
Et AUCUN aiguillage n'est exécuté sans acceptation humaine explicite
Et le verdict visé et la décision d'aiguillage sont deux événements distincts, tous deux tracés
```
### HR-05 — nextReviewDate = calcul, jamais saisie (R468)
```gherkin
Étant donné la périodicité tenant HIGH=12 mois et un client HIGH dont l'AR est clôturée le 15.08.2026
Alors nextReviewDate est calculée au 15.08.2027 — aucune saisie manuelle possible
Quand le niveau de risque du client passe à MEDIUM (24 mois)
Alors la prochaine échéance est recalculée et l'événement de recalcul trace la cause
```
### HR-06 — Critère de groupe paramétrable, composition projetée (R469)
```gherkin
Étant donné le critère ["UBO_COMMUN"] et 3 clients partageant l'UBO "Famille Al-Fayed"
Alors la composition du groupe est calculée à 3 membres — aucune liste stockée
Quand l'admin ajoute le critère GROUPE_CORPORATE_DECLARE via le pop-up R445
Alors PARAM_CHANGED versionné est émis et les compositions futures intègrent le nouveau critère
Et les GAR en cours conservent la composition de leur date d'initiation (R29)
```
### HR-07 — Déclenchement groupe : parent + membres liés (R470)
```gherkin
Quand une revue de groupe est déclenchée pour un groupe de 3 membres
Alors un dossier parent GROUP_ACCOUNT_REVIEW est créé avec les sections GAR (vue consolidée, décision de groupe)
Et 3 dossiers ACCOUNT_REVIEW standard sont créés, chacun lié au parent
Et chaque création est un événement portant l'origine (déclenchement groupe)
```
### HR-08 — Guard de consolidation (R470)
```gherkin
Étant donné un parent GAR dont 2 membres sont clôturés et 1 en cours
Quand le validateur tente la décision de groupe
Alors GUARD_BLOCKED est émis : "1 dossier membre non clôturé (AR-xxxx)"
Quand le dernier membre est clôturé
Alors le guard réévalué passe — sans intervention manuelle sur le parent
```
### HR-09 — La décision de groupe référence les verdicts membres (R470)
```gherkin
Étant donné 3 membres clôturés : 2 CONFORME, 1 RÉSERVES
Quand le validateur pose la décision de groupe
Alors le visa référence les 3 verdicts membres et porte la motivation de la décision
Et la vue consolidée affichée est une projection des dossiers membres — jamais une re-saisie
```
### HR-10 — Cascade = événement, avec anti-boucle (R471)
```gherkin
Étant donné cascadeMemberToGroup=true et un groupe de 3 membres
Quand une AR est déclenchée sur le membre M1 (alerte AML)
Alors REVIEW_CASCADE_TRIGGERED est émis et les dossiers de M2, M3 et le parent sont créés avec origine="cascade depuis AR de M1"
Et aucun des dossiers nés de la cascade ne déclenche de nouvelle cascade
```
### HR-11 — Cascades OFF : rien ne part, le toggle est engagé (R471)
```gherkin
Étant donné cascadeMemberToGroup=false
Quand une AR est déclenchée sur un membre
Alors aucun autre dossier n'est créé
Et la modification du toggle exige le pop-up R445 (ancien/nouveau, portée) — sans confirmation, aucune écriture
```
### HR-12 — Exclusion 4-yeux à tous les niveaux (R13, R466, R470)
```gherkin
Étant donné U1 (rôle RM) préparateur des sections de l'AR du membre M1
Alors U1 ne peut viser aucune section qu'il a préparée
Et le préparateur du dossier parent GAR ne peut pas poser la décision de groupe
```
### HR-13 — Un gabarit d'écran, trois types (R472)
```gherkin
Quand l'utilisateur ouvre un dossier KYC, une AR puis une GAR
Alors les trois rendent le même gabarit (sections+visas, timeline, documents, actions) — même composant
Et la GAR affiche en plus le panneau "vue consolidée" — activé par paramètre d'affichage, pas par un fork
Et les colonnes/libellés proviennent du paramétrage d'écran existant
```
### HR-14 — Rejeu à date d'une GAR (R48, R29)
```gherkin
Étant donné une GAR initiée le 01.06 avec une composition de 3 membres sous le critère UBO_COMMUN
Et le critère élargi le 01.07 (composition passant à 5)
Quand un auditeur rejoue la GAR à la date du 15.06
Alors la composition restituée est celle de l'initiation (3 membres), avec le critère et les sections d'époque
```
### HR-15 — Une barre de décision, partout la même (R474)
```gherkin
Quand un validateur ouvre une étape à visa sur un KYC, une AR puis une GAR
Alors la barre présente les mêmes issues dans le même ordre : Valider · Refuser · Renvoyer · Déléguer
Et Valider appose un visa R15 ; Déléguer passe la main au remplaçant R4 (tracé)
Et le même composant sert les workflows Business Trip et Offboarding — aucun fork
```
### HR-16 — Renvoi ciblé : visas tombés tracés, tâches recréées, historique intact (R475)
```gherkin
Étant donné un dossier à l'étape "Validation" dont les étapes "Collecte" et "Review" sont visées
Quand le validateur renvoie vers "Collecte" avec le motif "Justificatif d'origine des fonds illisible" et la section SOW cochée
Alors STEP_SENT_BACK est émis (cible, motif, sections)
Et les visas de "Collecte" et "Review" tombent par événements de chute — les visas d'origine restent lisibles dans l'historique
Et une tâche de reprise nominative est créée pour l'owner de la section SOW, motif en tête
Et le dossier reste le même dossier — aucune duplication, compteur de boucles = 1
```
### HR-17 — Pas de motif, pas de décision (R475, R476)
```gherkin
Quand un validateur tente Refuser ou Renvoyer sans motif
Alors la commande est refusée — le panneau inline exige code + texte
Et aucun événement d'état n'est émis
```
### HR-18 — Boucles comptées, signal au seuil — jamais de blocage (R475, R39)
```gherkin
Étant donné un dossier renvoyé 2 fois et le seuil tenant à 3
Quand un 3e renvoi est prononcé
Alors le compteur affiche 3 et un signal AVERTISSEMENT est notifié au manager de l'équipe
Et le dossier continue son chemin — aucun blocage automatique
```
### HR-19 — L'issue du refus dépend de l'étape (R476)
```gherkin
Étant donné une étape intermédiaire "Review" paramétrée issueRefus=RENVOI vers "Collecte"
Quand le validateur refuse avec motif
Alors le refus équivaut à un renvoi vers "Collecte" (mêmes effets que R475)
Et sur l'étape "Validation finale" paramétrée TERMINAL, le même refus passe le dossier à REJECTED (R16)
```
### HR-20 — Optimiste, mais honnête : l'erreur moteur revient en clair (R477, R13)
```gherkin
Étant donné U1 préparateur de la section qu'il tente de viser
Quand U1 clique Valider
Alors l'interface affiche le visa immédiatement puis le moteur refuse (R13)
Et l'interface revient visiblement en arrière avec le message "Exclusion 4-yeux — vous avez préparé cette section (R13)"
Et aucun événement de visa n'existe au journal — l'affichage optimiste n'a jamais été une écriture
```
### HR-21 — La corbeille « À décider » : tout, trié, ouvert au bon endroit (R478)
```gherkin
Étant donné U2 validateur en attente sur 2 KYC, 1 GAR et 1 Business Trip, dont 1 SLA échu
Quand U2 ouvre la corbeille
Alors les 4 décisions apparaissent triées par SLA, l'échue en tête avec badge rouge
Et cliquer une ligne ouvre le dossier directement à l'étape à décider, barre de décision prête
Et les tâches de reprise nées d'un renvoi y figurent pour leurs owners
```
### HR-22 — Enchaîner sans friction, annuler sans peur (R479)
```gherkin
Étant donné U2 en mode apresDecision=SUIVANT
Quand U2 valide une étape
Alors le dossier suivant de la corbeille s'ouvre avec un bandeau "Visa apposé sur <dossier> — Annuler"
Et l'annulation est possible tant qu'aucun tiers n'a consommé la transition — elle émet un événement d'annulation tracé
Et aucun dialogue modal de confirmation n'a interrompu la validation simple
```
---
## 4. Ordre d'implémentation proposé
1. Tests HR-01…HR-22 rouges (`review-harmonisation.spec.ts` + `decision-bar.spec.ts` pour HR-15…HR-22).
2. Type de dossier généralisé au moteur : `ACCOUNT_REVIEW` et `GROUP_ACCOUNT_REVIEW` rejoignent `KYC` sur la même structure (sections R78 résolues par type via le Section Designer existant).
3. Pré-remplissage AR + moteur de diff (REPRISE/MODIFIÉE) sur le dernier KYC approuvé.
4. Verdicts normalisés + calcul de périodicité ; migration des outcomes libres (mapping consigné : « EDD triggered »→NON CONFORME+proposition EDD, etc. — arbitrage PO sur le mapping).
5. Référentiel de groupe (projection sur le graphe personnes/liens) + dossier parent GAR + guard consolidation.
6. Cascades en événements (anti-boucle) + registre §Review + pop-up R445 (remplace AR_GROUP_CONFIG).
7. Compilation WF_MGMT templates → WF_DEF versionnées (une seule vérité).
8. Composant unique de barre de décision (R474–R477) + corbeille « À décider » (R478) + mode SUIVANT (R479) — branchés d'abord sur les trois types, puis réutilisés par Business Trip et Offboarding (remplacement des boutons ad hoc existants, écart consigné si divergence).
9. Migration écrans : l'écran AR table plate devient l'écran dossier unique ; écran GAR créé sur le même gabarit ; panneau admin AR remplacé par Paramétrage → Revues.
10. 22/22 verts → ratification → CANON-MASTER.md (R331).
**Écarts consignés** : E-HR-1 (AR table plate hors moteur, outcomes libres), E-HR-2 (critère de groupe codé en dur, config mutée sans pop-up), E-HR-3 (GAR en config sans objet moteur ; deux couches de définition non reliées), E-HR-4 (boutons de décision hétérogènes entre écrans — Approuver/Refuser ad hoc, aucun renvoi ciblé, aucune corbeille unifiée) → `docs/ECARTS-FRONT.md`.
