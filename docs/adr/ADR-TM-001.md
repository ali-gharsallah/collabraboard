# ADR-TM-001 — Transaction Monitoring / « Surveillance » : contexte borné séparé vs extension du monolithe

> Statut : **ACCEPTÉ (tranché)** · Date : 2026-08-06 · Portée : architecture cible du dispositif de surveillance des transactions (« Transaction Monitoring » / Surveillance perpétuelle).
> Décideur : architecture principale. Sources : `docs/audit/AUDIT.md`, code réel `apps/api`, `services/cpsi-server-py`. « Le repo fait foi. »

---

## 1. Contexte

### 1.1 L'architecture réelle telle qu'auditée

O-Live n'est **pas** un système event-sourcé : c'est un monolithe NestJS **CRUD-primaire** doublé d'un **journal d'événements append-only** (`apps/api/src/common/optimistic-lock.ts:4-8` : « O-Live est CRUD-primaire (pas event-sourcé) » ; `common/domain-event.ts:11-13` : écriture d'événement centralisée, horloge serveur, append-only). Trois propriétés transverses conditionnent toute décision d'architecture :

- **Prisma partagé, une seule base.** Tous les ~50 modules de `apps/api/src/modules` partagent le même `PrismaService` et la même base Postgres (`AUDIT.md` §1). Il n'y a pas de découpage physique de données par domaine.
- **Isolation locative par RLS applicative.** L'isolation tenant est une **RLS Postgres** posée par transaction : sous `FF_RLS_ENFORCED`, `PrismaService` fait un `SET LOCAL app.tenant_id` (`set_config`, portée transaction) pour que la RLS FORCE s'applique dans la transaction (`common/prisma.service.ts:14-15`), doublée d'une isolation applicative (`common/core.module.ts:12-13` : « l'isolation reste RLS + applicative … prouvé par e2e 84/84 + recette RLS »). Cette garantie est **gratuite tant qu'on reste dans le même moteur Prisma/Postgres**.
- **Journal d'événements comme colonne vertébrale de découplage.** La propagation ne se fait **jamais par effet de bord** : tout passe par événement / tâche / **proposition** à décision humaine (R39/R44). Le CPSI « émet tâches et propositions … jamais d'effet de bord » (`services/cpsi-server-py/olive_cpsi/engine.py:10-11`) ; le screening émet une **escalade PROPOSÉE par événement, jamais exécutée** (`screening/screening.service.ts:12-13`).

### 1.2 La réalité « deux moteurs »

Le système est déjà **bi-moteur** (`AUDIT.md` §0) :
- le **moteur workflow KYC** en TypeScript/NestJS (`apps/api`) ;
- le **moteur CPSI** de scoring de risque **perpétuel** en Python (`services/cpsi-server-py/olive_cpsi/engine.py`, R63–R84), déjà **déployé séparément**, couplé au monolithe uniquement par **propositions/tâches**.

Autrement dit, le besoin classique qui justifie d'externaliser la surveillance — *« isoler un moteur de scoring lourd, à cycle de vie propre, monté en charge indépendamment »* — **est déjà satisfait** par le CPSI. Le CPSI EST le moteur de surveillance perpétuelle du risque.

### 1.3 Ce qui existe DÉJÀ pour la surveillance transactionnelle (dans le monolithe)

La capacité « Transaction Monitoring » n'est pas un chantier vierge. Une part substantielle est **déjà câblée in-monolith**, en surfaces couplées :

| Brique | Rôle | Preuve |
|---|---|---|
| `txflux` | **Journal transactionnel canonique** append-only, alimenté *exclusivement* par le port core banking (R167-R169), idempotent par `(tenant, source, refExterne)`, enrichi/tracé. | `modules/txflux/txflux.module.ts:7-17` (R297/R294) |
| `txrisk` | **Surface du moteur CPSI** : agrège le journal R297 en attributs transactionnels (R79 : `tx_par_mois`, `volume_tx_mensuel_chf`, `rapidite_in_out`, `ratio_cross_border`) et les **pousse au CPSI** (événement `cpsi.client.registered`). « Ce module ne DÉCIDE rien. » | `modules/txflux/txrisk.module.ts:7-15` (R298/R295) |
| `transactions` (portail) | **Portail transactionnel** R140-R143 : chaque transaction passe par le portail avant exécution, verdict `PASSE|BLOQUE|SUSPEND`, gardes = registre paramétrable tenant (`txGardes`), fail-secure, signal AML + tâche de requalification, file de revue habilitée, MROS. | `modules/transactions/transaction-gate.service.ts:7-22` |
| `swift` | Parseur SWIFT (R300) pour extraire les parties d'un virement. | `modules/txflux/swift.module.ts` |
| `screening` | Screening des **parties d'une transaction** contre les listes (`SujetType = "transaction"`, R100). | `modules/screening/screening.service.ts:22-24` |
| `aml` | Référentiel de scénarios AML 2G, gap-analysis. | `modules/aml/*` |
| `riskcases` | **Cases d'investigation** issues des hits/scénarios (R76, R133-136). | `modules/riskcases/risk-case.service.ts` |
| `mros` | Communication MROS (art. 9 LBA), discrétion client (art. 10a). | `modules/mros/*` |

Constat : la surveillance transactionnelle est **déjà un contexte fonctionnel de fait**, mais **implicite** — dispersé en modules mono-fichier, dont plusieurs sont dans la vague **R222→R238 non testée en propre** (`docs/audit/TEST_AUDIT.md` §2-3 : `txflux`/`txrisk`/`fx`/`swift` `ABSENT` de `run-rule-tests.sh`).

### 1.4 Volumétrie et équipe

- **Régime d'arrivée des transactions : par lot (batch), pas streaming haute fréquence.** Le flux est tiré du **port core banking** à la demande (`lireTransactions(depuis?)`, `txflux.module.ts:44-56`), idempotent at-least-once (R286). Il n'y a pas, dans le repo, de contrainte de débit type « millions d'événements/s » qui forcerait une topologie dédiée.
- **Une équipe, un pipeline.** Un seul déploiement, une seule CI portant **~1 400+ cas de test** sur 9 surfaces (`TEST_AUDIT.md` §1) et une **recette RLS** bloquante. Multiplier les déployables multiplie cette matrice.

---

## 2. Décision à trancher

**Où doit vivre le contexte « Surveillance / Transaction Monitoring » ?**

- **Option A — Service / contexte borné physiquement séparé** (nouveau déployable, base propre ou schéma propre, communication par API/événements inter-services).
- **Option B — Module(s) dans le monolithe**, sans frontière explicite (statu quo étendu : on continue d'ajouter des modules mono-fichier).
- **Option C — Contexte borné *logique* DANS le monolithe** : une frontière de domaine `surveillance` explicite (agrégat, ports, interface anti-corruption vers le CPSI), déployée avec `apps/api`, s'appuyant sur le Prisma/RLS partagés et sur le CPSI comme moteur de scoring déjà externalisé.

---

## 3. Options en regard des contraintes réelles

### Option A — Service séparé physiquement

| Force | Faiblesse (mesurée sur CE repo) |
|---|---|
| Cycle de déploiement et montée en charge indépendants. | Le besoin de scale est **déjà couvert par le CPSI** (`engine.py`), qui est le vrai moteur lourd. La surveillance côté monolithe est de l'**orchestration mince** (agrégation + création de cases), pas du calcul. |
| Frontière de données stricte. | **Casse la garantie RLS gratuite.** L'isolation tenant repose sur `SET LOCAL app.tenant_id` dans la même transaction Postgres (`prisma.service.ts:14-15`). Un service séparé doit **ré-implémenter** la RLS + la recette RLS (`core.module.ts:13`), ou accéder à la base du monolithe (couplage caché pire qu'un module). |
| — | Le portail transactionnel a besoin **synchrone** du **golden record** (profil onboardé) et du module **MROS** (`transaction-gate.service.ts:4,7-22`). Extraire = transformer 4-5 appels in-process en appels réseau + cohérence distribuée, alors que R140 exige un verdict **avant exécution**. |
| — | Duplication de la colonne vertébrale : le journal `domainEvent` et l'outbox (`events/outbox.worker.ts`) devraient être franchis par un bus inter-services — surface d'incohérence nouvelle, pour un gain nul de découplage (le découplage async **existe déjà** via événements/propositions R39/R44). |
| — | Double matrice CI/ops pour une seule équipe. |

### Option B — Modules dans le monolithe, sans frontière

| Force | Faiblesse |
|---|---|
| Aucun coût d'extraction ; réutilise Prisma/RLS/événements. | C'est le **statu quo qui a produit le trou d'audit** : `txflux`/`txrisk`/`fx`/`swift`/`txrisk` sont des modules mono-fichier **hors `run-rule-tests.sh`**, non testés en propre (`TEST_AUDIT.md` §2-3). Sans frontière, la surveillance reste **implicite**, non gardée, régressable en silence. |
| — | Pas d'interface anti-corruption nommée vers le CPSI : le couplage `txrisk → cpsi` est déjà là (`txrisk.module.ts:4-5`) mais informel. |

### Option C — Contexte borné logique dans le monolithe (+ CPSI comme sidecar de scoring déjà séparé)

| Force | Faiblesse |
|---|---|
| Conserve **RLS gratuite**, transactions synchrones avec golden record / MROS, journal d'événements partagé. | Ne procure pas d'**isolation de déploiement** — acceptable ici car la volumétrie est batch et le vrai moteur lourd (CPSI) est déjà séparé. |
| Rend la frontière **explicite et testable** : un agrégat `surveillance` + ports, câblé dans `run-rule-tests.sh`, ferme le gap R222→R238. | Discipline d'équipe requise pour ne pas re-percer la frontière (imports croisés). |
| Garde un **joint d'extraction** : si un jour la volumétrie devient streaming, la frontière logique + le port CPSI permettent d'extraire le contexte sans réécriture du domaine. | — |
| Aligne le code sur la doctrine déjà écrite : « propose, jamais n'exécute » (R39/R44) est une frontière **sémantique**, pas physique. | — |

---

## 4. Décision (tranchée)

> **On adopte l'Option C : la Surveillance / Transaction Monitoring est un CONTEXTE BORNÉ LOGIQUE À L'INTÉRIEUR du monolithe `apps/api`, PAS un nouveau service déployé séparément. Le moteur CPSI (Python) reste l'unique moteur de scoring — il est le sidecar de calcul déjà externalisé, atteint par une interface anti-corruption (ports + propositions/événements R39/R44).**

Autrement dit : **on ÉTEND le monolithe, mais en formalisant une frontière de domaine `surveillance`** (agrégat, ports d'entrée `txflux`, port de scoring vers CPSI, sorties = cases `riskcases` + signaux AML + MROS), au lieu d'ouvrir un service séparé.

### Justification contre les contraintes du repo

1. **RLS.** L'isolation tenant est une propriété **de transaction Postgres** (`prisma.service.ts:14-15`) prouvée par recette (`core.module.ts:13`). Un service séparé la casserait ou la dupliquerait ; un contexte logique en hérite sans coût.
2. **Deux moteurs, déjà.** Le seul composant justifiant une séparation physique — le scoring perpétuel lourd — **est déjà** un process séparé (CPSI, `engine.py`). Externaliser l'orchestration mince par-dessus serait une séparation **sans le calcul**, donc tout le coût sans le bénéfice.
3. **Volume d'événements.** Arrivée **par lot** depuis le port core banking (`txflux.module.ts:44-56`), idempotente (R286). Aucune contrainte de débit ne réclame une topologie dédiée.
4. **Synchronisme réglementaire.** R140 exige un verdict `PASSE|BLOQUE|SUSPEND` **avant exécution**, en s'appuyant sur le golden record et MROS in-process (`transaction-gate.service.ts:7-22`) : un franchissement réseau introduirait latence et incohérence distribuée sur un chemin critique.
5. **Découplage déjà obtenu autrement.** Le découplage asynchrone qu'un service séparé apporterait existe déjà via le **journal + outbox + propositions** (R39/R44) : la frontière utile est **sémantique** (« propose, l'humain décide »), pas physique.
6. **Équipe/CI.** Une équipe, une CI de 1 400+ tests + recette RLS ; un second déployable double la matrice ops sans bénéfice mesurable.

---

## 5. Conséquences

### Positives
- **Ferme le plus gros gap d'audit** : la vague R222→R238 (dont `txflux`/`txrisk`) devient un contexte **nommé et testé** — wiring spec par surface, intégrée à la porte bloquante `test:rules` (`TEST_AUDIT.md` §5, action 1).
- **Zéro régression d'isolation** : RLS + recette RLS conservées telles quelles.
- **Interface CPSI explicitée** : le couplage `txrisk → cpsi` (`txrisk.module.ts:4-5`) devient un **port anti-corruption** documenté (attributs R79 → `cpsi.client.registered`), au lieu d'un import direct.
- **Réversibilité** : la frontière logique laisse un joint d'extraction si la volumétrie bascule un jour en streaming.

### Négatives / dette assumée
- **Pas d'isolation de déploiement** : un incident du contexte surveillance peut affecter le process `apps/api`. Mitigation : la partie coûteuse (scoring) est déjà hors-process (CPSI) ; le contexte surveillance reste de l'orchestration.
- **Discipline de frontière à tenir** : risque de re-perçage par imports croisés (le mal du statu quo Option B). Mitigation : lint de dépendances inter-modules + revue.
- **État module-global du moteur de screening** (IDF, `screening.service.ts:19-21`) : dette Phase 2 à instancier par run le jour du multi-tenant concurrent — indépendante de cette décision mais à porter par le contexte.

### Chemin de migration (incrémental, sans big-bang)
1. **Nommer la frontière** : regrouper sous un contexte `surveillance` les surfaces existantes (`txflux`, `txrisk`, `transactions/transaction-gate`, screening des parties, liens `aml`/`riskcases`/`mros`) — d'abord par convention et barre de dépendances, sans déplacer la base.
2. **Formaliser les ports** : port d'entrée `TxFluxPort` (déjà présent, `txflux.module.ts:20-21`), port de scoring `→ CPSI` (anti-corruption), ports de sortie `→ riskcases / mros`.
3. **Câbler les tests** : une wiring spec par surface sur le patron faux-Prisma + `evts()`, intégrée à `run-rule-tests.sh` (ferme R222→R238).
4. **Sortir `bloc61` / Analytique 2G de quarantaine** par un test de **contrat** Nest↔CPSI (`TEST_AUDIT.md` §5, action 3), qui devient l'interface publiée du contexte.
5. **Ne PAS extraire de service** tant qu'aucune contrainte de volumétrie (streaming) ou de cycle de vie ne l'exige ; le joint est prêt si elle survient.

---

## 6. Références code

- `apps/api/src/common/optimistic-lock.ts:4-8` — CRUD-primaire, pas event-sourcé.
- `apps/api/src/common/domain-event.ts:11-13` — journal append-only centralisé.
- `apps/api/src/common/prisma.service.ts:14-15` — RLS `SET LOCAL app.tenant_id` par transaction.
- `apps/api/src/common/core.module.ts:12-13` — isolation RLS + applicative, recette RLS.
- `apps/api/src/modules/txflux/txflux.module.ts:7-17,20-21,44-56` — journal transactionnel canonique (R297).
- `apps/api/src/modules/txflux/txrisk.module.ts:4-5,7-15` — surface CPSI, couplage par événement (R298).
- `apps/api/src/modules/transactions/transaction-gate.service.ts:4,7-22` — portail transactionnel (R140-R143).
- `apps/api/src/modules/screening/screening.service.ts:12-13,19-24` — escalade proposée, screening des parties.
- `services/cpsi-server-py/olive_cpsi/engine.py:5-14,10-11` — moteur CPSI, propositions jamais effet de bord.
- `docs/audit/AUDIT.md` §0-1, §6 ; `docs/audit/TEST_AUDIT.md` §2-3, §5.
