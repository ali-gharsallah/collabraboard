# O-Live — Catalogue des règles R1–R56 (état v2.4, 12.07.2026) & propositions R57–R62

Source de vérité : *OLive-Specifications-Moteur-Workflow-v2.4* — 80 scénarios Gherkin, chacun couvert par un test vert.
🔒 = invariant câblé (non négociable) · ⚙ = paramètre tenant (questionnaire R-Q) · les autres = mécanique du moteur.

## Bloc 1 — Cycle de vie du visa 4-yeux (R1–R15, R52)
| # | Règle |
|---|---|
| R1 | **Portée du visa** — le visa porte sur une section ; visas parallèles sur sections distinctes. |
| R2 🔒 | **Validateur nommé** — seul le validateur nommé (ou son relais) signe ; sinon dérogation R4 tracée. |
| R3 | **Granularité de l'exclusion** — pas d'exclusion globale : préparer une section n'interdit que le visa de *cette* section. |
| R4 ⚙ | **Absence du validateur** — relais paramétré ; à défaut, dérogation tracée adossée à la fiche de poste. |
| R5 ⚙ | **Rappels et escalade** — un visa en attente déclenche rappels puis escalade (délais tenant). |
| R6 | **Invalidation sur modification** — toute modification des données invalide le visa de la section. |
| R7 🔒 | **Refus motivé** — un refus sans motivation est bloqué. |
| R8 | **Durée de vie du visa** — le visa accordé vit jusqu'au prochain événement ; le temps seul ne change rien. |
| R9 🔒 | **Pas de révocation discrétionnaire** — un visa accordé ne se retire pas « parce qu'on a changé d'avis ». |
| R10 | **Invalidation ciblée** — modifier une section n'invalide que son visa, jamais les autres. |
| R11 | **Changement de validateur** — la réassignation est réservée aux rôles habilités, tracée. |
| R12 | **Visa hors process** — un visa hors délégation valide = incident de risque opérationnel. |
| R13 🔒 | **Exclusion 4-yeux** — le préparateur d'une section ne vise jamais sa section ; tentative tracée. |
| R14 🔒 | **Annulation pour vice** — conjointe process owner + validateur final ; **pop-up d'engagement de responsabilité à la validation finale** ; *complément v2.4 : l'annulation fait repasser la section En préparation*. |
| R15 | **Validation finale = visa** — la finale est un visa comme les autres, déclenchée quand tout est visé, invalidée en cascade. |
| R52 🔒 | **Contributeur exclu de la finale** — quiconque a contribué à une section du dossier ne signe pas la validation finale. |

## Bloc 2 — Cycle de vie du dossier (R16–R23, R53)
| # | Règle |
|---|---|
| R16 | **États du dossier** — Brouillon, En préparation, Validation finale, Actif, En mise à jour, Suspendu, Rejeté, Abandonné, Clôturé. |
| R17 ⚙ | **Suspendu** — restrictions paramétrées (entrées/sorties) ; discrétion type MROS : le client n'est jamais notifié (art. 9a LBA). |
| R18 | **Rejeté** — distinct de la clôture ; le retour d'un prospect refusé est détecté et alerté. |
| R19 ⚙ | **Abandon** — rappels J30/J60, clôture J90 (délais tenant) sur dossier en préparation inactif. |
| R20 | **Conservation** — les données d'un dossier abandonné sont conservées (durées légales), l'effacement LPD est un process. |
| R21 | **Réouverture ciblée** — un changement de circonstances ne rouvre que les sections concernées ; le client reste opérationnel. |
| R22 | **Le risque décide** — c'est le risque du changement, pas le changement, qui déclenche les restrictions. |
| R23 | **Collision de process** — pas de fusion : priorité, pause/reprise, trails distincts, absorption des sections revalidées. |
| R53 🔒 | **Concurrence optimiste** — commande sur version périmée = rejet sans effet + version courante (« rechargez ») ; conflit tracé ; lectures et pilotage hors version. |

## Bloc 3 — Sections & matrice documentaire (R24–R29)
| # | Règle |
|---|---|
| R24 | **Sections fixes, contenu variable** — la structure vient du référentiel ; le contenu dépend du cas. |
| R25 ⚙ | **Visa conditionnel** — visa sous réserve d'un document attendu ; délai tenant, expiration = invalidation (obligatoire) ou escalade (optionnel). |
| R26 | **Matrice documentaire** — croise documents requis × type d'entité × juridiction × rôle (entité, personnes liées, comptes). |
| R27 | **Juridiction d'abord** — fixée en premier, elle résout les documents concrets. |
| R28 | **Péremption sur dossier actif** — un document expiré crée une tâche de collecte, ne suspend pas mécaniquement. |
| R29 | **Versioning par date de vigueur** — matrice versionnée ; chaque dossier estampille sa version : **grandfathering**. |

## Bloc 4 — Personnes & rôles (R30–R36)
| # | Règle |
|---|---|
| R30 | **Personne unique** — objet unique du référentiel, propagation par événement vers les N dossiers. |
| R31 ⚙ | **Cumul de rôles** — autorisé ou non par la banque ; contrôlé à la liaison. |
| R32 | **PEPisation contagieuse** — détection (CoC, screening) → tâche de réévaluation par dossier ; aucune bascule silencieuse. |
| R33 ⚙ | **Dé-PEPisation humaine** — le délai écoulé alerte, ne déclasse jamais ; décision humaine (délai tenant). |
| R34 | **Bijectivité** — toute relation déclarée crée automatiquement sa réciproque typée. |
| R35 | **Archivage** — une personne sans plus aucun rôle est archivée, jamais supprimée. |
| R36 | **Divergence d'identité** — constats contradictoires = divergence à résoudre, avec document probant et décideur. |

## Bloc 5 — Tâches, rôles & SLA (R37–R41, R54)
| # | Règle |
|---|---|
| R37 ⚙ | **Central File** — gardien documentaire ; périmètre paramétré ; contrôle CF rend le document réputé valide. |
| R38 | **Rôle puis personne** — tâche assignée à un rôle, résolue vers une personne connaissant la relation ; routage hors périmètre interdit. |
| R39 🔒 | **SLA mesure et notifie** — le dépassement ne force rien : le système ne coerce pas. |
| R40 | **Réaffectation managériale** — vue de charge par rôle, réaffectation par le responsable. |
| R41 ⚙ | **Déblocage d'urgence & homme-clé** — chaîne d'escalade paramétrée ; rôle sans titulaire actif = risque homme-clé signalé. |
| R54 🔒 | **Déclencheur du temps** — `tick_global(now)` unique : idempotent, monotone (horloge qui recule refusée et tracée), rattrapant, bilan journalisé. |

## Bloc 6 — Screening & hits (R42–R46)
| # | Règle |
|---|---|
| R42 ⚙ | **Screening perpétuel** — quatre déclencheurs, fréquences par domaine paramétrées. |
| R43 ⚙ | **Cycle de vie du hit** — analyse LoD1, clôture confirmée LoD2 (rôle tenant). |
| R44 🔒 | **Whitelist & IA** — faux positifs récurrents whitelistés avec justification ; **l'IA analyse, l'humain décide**. |
| R45 ⚙ | **Hit sanctions confirmé** — sévérité paramétrée (suspension immédiate / gel avec analyse / comité). |
| R46 | **Hit pendant la validation** — gèle le circuit en cours, comité décide, tout est tracé. |

## Bloc 7 — Audit trail & exploitation (R47–R51, R55)
| # | Règle |
|---|---|
| R47 ⚙ | **Journalisation des lectures** — activable par la banque. |
| R48 | **Rejeu à date** — état + versions du référentiel « tels qu'ils étaient » : une requête, pas une reconstruction. |
| R49 🔒 | **Immutabilité** — journal append-only ; personne n'efface, pas même l'admin (triggers en base). |
| R50 | **Exports réglementaires** — registre des dérogations, PEP, hits, retards de recertification, en un clic. |
| R51 | **Extraction par ID KYC** — toute demande d'audit (preuve 4-yeux comprise) est une extraction indexée du journal. |
| R55 🔒 | **Snapshots de reprise** — photographie à version R53, restauration fidèle ET vivante, O(récent), retard signalé, store append-only. |

## Transverse (proposé, en cours de port Python)
| # | Règle |
|---|---|
| R56 | **Règles tenant additionnelles** — typologie fermée (contributeurs min., séquencement, 4-yeux renforcé, engagement étendu, motivation min.) ; elles ne peuvent que **durcir** ; ajout/désactivation tracés avec source (manuel/IA) ; l'IA propose, l'humain adopte (R44). |  
> **Ratifiée bi-moteur (2026-07-13)** — portée au moteur Python de référence : 5 types (minPreparateurs, sectionsPrealables, quatreYeuxRenforce, engagementSection, motifRefusMin), garde default-deny, événements `regle_tenant_ajoutee/activee/desactivee`, scénarios **RT-01..RT-08** verts — parité JS ⇄ Python (17/17 suites).

---

# Propositions de nouvelles règles (R57–R62) — à discuter puis ratifier

**R57 — Récusation pour conflit d'intérêts.** Un validateur peut (et doit) se récuser d'un visa en déclarant un lien avec le client (familial, financier, d'affaires) ; la récusation est motivée, tracée, et route le visa vers le relais R4. Une récusation ne peut pas être levée par le récusé lui-même.
*Pourquoi* : l'indépendance du contrôle est l'angle mort des workflows actuels — le 4-yeux protège contre l'auto-validation, pas contre la proximité. Très fort en pitch CDB 20. *Scénarios* : RC-01 récusation tracée et routage relais · RC-02 le récusé ne peut pas se dé-récuser · RC-03 registre des récusations (export R50).

**R58 — Habilitation du signataire.** Un visa ne peut être apposé que par un signataire dont l'habilitation/formation requise (LBA, CDB, produit) est **en cours de validité** ; habilitation expirée = refus cité, tâche de renouvellement créée, dérogation possible uniquement via R4 avec décideur.
*Pourquoi* : lie le moteur au module *Formations & habilitations* déjà dans la démo — cross-sell interne immédiat, et exigence FINMA réelle (compétence du contrôle). *Scénarios* : H-01 habilitation expirée bloque · H-02 renouvellement rouvre · H-03 dérogation tracée.

**R59 — Double visa au-delà d'un seuil.** ⚙ Au-delà d'un seuil paramétré (AUM, score de risque, pays FATF), la validation finale exige **deux signataires distincts** (ex. Head PB + MLRO), chacun avec son engagement R14 ; les deux exclusions (R13/R52) s'appliquent à chacun.
*Pourquoi* : le « comité » des banques, formalisé en visa — aujourd'hui il vit hors système. *Scénarios* : DV-01 seuil franchi ⇒ 2 visas requis · DV-02 un seul signataire ne suffit pas · DV-03 sous le seuil, circuit normal.

**R60 — Fraîcheur des sections à la finale.** ⚙ Si une section a été visée il y a plus de N mois (paramètre tenant) au moment où la validation finale est demandée, une **re-confirmation légère** de son validateur est exigée (pas une re-préparation) ; refus de re-confirmer = invalidation ciblée R10.
*Pourquoi* : le dossier « visé par morceaux sur 14 mois » est un vrai risque d'audit — la finale signe alors sur de la donnée périmée. *Scénarios* : F-01 section fraîche passe · F-02 section ancienne exige re-confirmation · F-03 refus ⇒ R10.

**R61 — Anti-goulot mesuré.** Un validateur dont la file dépasse N visas en attente (ou M jours de retard cumulé) est signalé, et le système **propose** — sans l'imposer (esprit R39) — le routage des nouveaux visas vers son relais R4 ; la décision reste au responsable R40.
*Pourquoi* : complète R40/R41 par la prévention ; c'est la réponse au « notre CO senior est le goulot de toute la banque ». *Scénarios* : G-01 seuil ⇒ signal + proposition · G-02 rien n'est forcé · G-03 décision du responsable tracée.

**R62 — Export d'audit scellé.** Toute extraction d'audit (R50/R51, preuve 4-yeux, rejeu à date) peut être produite en **export scellé** : hash chaîné des événements inclus + horodatage + périmètre, vérifiable hors système ; le sceau lui-même est journalisé.
*Pourquoi* : transforme « notre audit trail est immuable » (affirmation) en « vérifiez-le vous-même » (preuve portable) — l'argument qui ferme la discussion avec un auditeur externe. S'appuie sur l'HMAC déjà présent au backend. *Scénarios* : SC-01 export scellé vérifiable · SC-02 altération détectée · SC-03 le sceau est dans le journal.

---
*Méthode inchangée : chaque proposition retenue reçoit ses scénarios Gherkin complets au catalogue (numérotation continue), ses tests AVANT le code, puis ratification et report au Word.*


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
