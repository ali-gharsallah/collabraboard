# ADR-PEP-001 — Source de vérité du statut PEP : déclaratif (KYC/CDB) vs dérivé des listes de screening vs hybride

> Statut : **ACCEPTÉ (tranché)** · Date : 2026-08-06 · Portée : quelle brique fait AUTORITÉ sur le statut PEP d'une personne, et comment les autres consommateurs (CPSI, AML, reporting) s'y branchent.
> Décideur : architecture principale. Sources : code réel `apps/api`, `services/cpsi-server-py`, `spec/wf-v2.md`. « Le repo fait foi. »

---

## 0. Note préalable sur la « recommandation C4 » de la spec

L'énoncé d'audit renvoie à une **« recommandation C4 »** du spec pour la question PEP. **Vérification faite, ce « C4 » n'existe pas comme recommandation PEP.** Le seul `C4` présent dans le corpus est une **capacité d'Olivia** — « C4 — Proposition de paramétrage » (`spec/spec-fonctionnelle-home-olivia.md:162`, R254/R70), sans rapport avec le PEP. Aucun `§`/identifiant `C4` du `.docx` v4.20 ni de `wf-v2.md` ne porte de recommandation sur la source de vérité PEP (grep `\bC4\b` / `C-4` sur `spec/**` et extraction `zipfile` du `.docx` : 0 occurrence pertinente).

**En conséquence, cette ADR ne s'appuie PAS sur une recommandation spec C4 (inexistante), mais sur (a) le comportement réel du code et (b) le raisonnement conformité LBA/OBA-FINMA.** Les règles spec réellement applicables sont **R32 (PEPisation contagieuse)** et **R33 (dé-PEPisation humaine)** — `spec/wf-v2.md:713-728`.

---

## 1. Contexte : comment le PEP est traité aujourd'hui dans le repo

Le PEP apparaît sous **trois formes** dans le code, qu'il faut distinguer :

### 1.1 Entrée déclarative — le formulaire KYC (CDB)
Le statut PEP est une **question du dossier KYC**, graduée par workflow :
- SDD : `IDE-Q3 "Statut PEP (déclaration)"` (`apps/api/src/modules/kyc/kyc.templates.ts:17`) ;
- CDD : `IDE-Q3 "Statut PEP (déclaration + screening)"` (`:25`) ;
- AML : `AML-Q1 "Screening sanctions/PEP/adverse media exécuté"` (`:33`) ;
- EDD : `IDE-Q3 "Statut PEP détaillé (fonction, période, déclassement)"` (`:39`).

C'est une **saisie/attestation** portée par le dossier, croisée avec le screening en CDD/EDD.

### 1.2 État canonique — le flag porté par la PERSONNE
La vérité vivante n'est **ni** sur le dossier **ni** sur une liste : c'est un booléen `statutPep` **porté par l'entité Person** du référentiel :
- initialisé `statutPep: false` à la création (`apps/api/src/modules/personnes/personnes.service.ts:57`) ;
- **posé par un acte explicite** `declarerPep(ctx, personId, source)` (R32) : met `statutPep = true`, émet `personne.pep.declare` puis **propage par événement** à tous les dossiers (`tache.reevaluation_pep`, `personne.pep.propage`) — **aucune bascule de risque** en propre (`:132-142`, commentaire « AUCUNE bascule de risque ») ;
- **jamais dé-PEPisé automatiquement** : l'écoulement du délai post-mandat **alerte une fois** (`personne.alerte.depep`) mais ne déclasse pas (`:152-171`, R33) ;
- **levé uniquement par décision humaine** `leverPep` : `statutPep = false`, événement `personne.pep.leve` avec `decideur`, audit `PEP_LIFTED` (`:173-178`).

La `source` de `declarerPep` est un **paramètre libre** : conformément à R32, la PEPisation « est détectée via CoC, nouveau KYC, account review ou EDD » (`spec/wf-v2.md:713-717`) — plusieurs canaux **alimentent** l'acte, mais l'acte reste **une décision tracée**, jamais un effet de bord.

### 1.3 Signal dérivé des listes — le screening
Le screening rapproche les sujets (personnes, parties de transaction) des listes **sanctions / PEP / adverse media** et produit des **hits qualifiés**. Mais il **ne pose jamais** `statutPep` : il **émet une escalade PROPOSÉE par événement, jamais exécutée** (`apps/api/src/modules/screening/screening.service.ts:12-13`, R39/R44 : « l'IA analyse, l'humain décide », `RULES_INVENTORY.md` R44). Le hit-liste est donc un **candidat**, pas une autorité.

### 1.4 Consommateur — la « contamination » du scoring CPSI
Le CPSI **consomme** le statut PEP comme attribut **structurel de la personne** et le décrit explicitement : *« Statut PEP … statut porté par la personne (**contamine le dossier seulement si KYC validé**) »* (`services/cpsi-server-py/olive_cpsi/engine.py:510`). Il pèse dans le score statique (`"pep": 15.0`, `engine.py:29`) et dans le signal `hit_screening` (`engine.py:23`). C'est la **règle de contamination du scoring de risque** évoquée par l'énoncé : le PEP ne durcit le risque du dossier **qu'après** validation KYC — pas au moment d'un hit-liste brut.

### 1.5 Autres consommateurs
- `personnes` : flag insider pour scénarios AML (R31), bijectivité pour **proches de PEP art. 2a LBA** (`wf-v2.md:724-728`, R34) ;
- `rapports` : **registre PEP** exportable (R50) ;
- `aml` : scénarios ciblant la population PEP.

### 1.6 Lecture d'ensemble
Le repo implémente **de facto** : **une personne = une vérité PEP (`Person.statutPep`), posée et levée par décision humaine tracée, alimentée par plusieurs canaux de détection (déclaration KYC, CoC, account review, EDD, hits de screening), et consommée en aval (CPSI/AML/reporting).** Le screening est un **détecteur qui propose**, jamais la source. Le déclaratif KYC est un **canal d'entrée** matérialisé sur la personne.

---

## 2. Décision à trancher

**Quelle brique fait AUTORITÉ (source of truth) sur le statut PEP ?**

- **Option A — Déclaratif pur (KYC/CDB).** La vérité = ce qui est attesté au dossier / saisi par le RM.
- **Option B — Dérivé des listes de screening.** La vérité = présence sur une liste PEP ; le statut suit mécaniquement le hit.
- **Option C — Hybride, avec le flag PERSONNE (déclaratif/CDB, décidé par l'humain) comme AUTORITÉ, et les listes comme SIGNAUX-CANDIDATS non autoritaires** qui ne peuvent que **proposer** une (dé)PEPisation soumise à ratification humaine.

---

## 3. Options en regard des obligations LBA/OBA-FINMA et du code

### Cadre réglementaire (rappel)
- **LBA art. 6** + **OBA-FINMA** : l'intermédiaire financier doit **déterminer** le statut de PEP dans une **approche fondée sur les risques** ; le PEP déclenche une **relation d'affaires comportant des risques accrus** et des **clarifications complémentaires**. La détermination est une **obligation de l'établissement**, pas la sortie brute d'un outil.
- **Décision de déclassement** : la sortie du statut PEP relève d'une appréciation de l'établissement (délai post-mandat, fonction), pas d'un automatisme — ce que R33 code littéralement.
- **art. 2a LBA** : les **proches** d'un PEP sont concernés → la vérité doit vivre sur un **graphe de personnes**, pas sur un hit-liste isolé.

### Option A — Déclaratif pur
| Force | Faiblesse |
|---|---|
| Traçable, sous responsabilité du RM. | **Ignore le screening perpétuel** : un client devenu PEP après l'onboarding resterait non-PEP jusqu'à la prochaine déclaration → **non-conformité** au screening continu (R42) et à l'approche risque. Insuffisant seul. |

### Option B — Dérivé des listes
| Force | Faiblesse |
|---|---|
| Couvre le stock mondial de PEP, mis à jour. | **Contraire à R44/R39 et au code** : le screening **propose**, n'exécute pas (`screening.service.ts:12-13`). Une bascule automatique sur hit produirait des **faux positifs contaminant le scoring** (`engine.py:510`) sans décision humaine, violerait R32 (« jamais de bascule silencieuse ») et R33 (déclassement = décision humaine), et retirerait à l'établissement la **détermination** que LBA art. 6 lui impose. **Rejetée.** |

### Option C — Hybride, autorité = flag personne décidé par l'humain
| Force | Faiblesse |
|---|---|
| **C'est déjà ce que le code fait** (`personnes.service.ts:132-178`) : autorité = `Person.statutPep`, posé/levé par décision tracée, alimenté par tous les canaux (déclaration, CoC, EDD, hits). | Exige de **maintenir la file de ratification** (les hits proposés doivent être traités) — dette opérationnelle, pas architecturale. |
| Conforme LBA art. 6 (l'établissement **détermine**), R32 (contagieux, sans bascule silencieuse), R33 (déclassement humain), R44 (l'humain décide). | — |
| Vit sur le **graphe de personnes** → couvre les proches (art. 2a LBA, R34). | — |
| Fournit **une** source unique aux consommateurs (CPSI/AML/reporting) avec la règle de contamination bien définie (post-validation KYC). | — |

---

## 4. Décision (tranchée)

> **On adopte l'Option C : la SOURCE DE VÉRITÉ du statut PEP est le flag `statutPep` PORTÉ PAR LA PERSONNE (registre / CDB), posé et levé UNIQUEMENT par décision humaine tracée (R32/R33). Les listes de screening sont des SIGNAUX-CANDIDATS non autoritaires : un hit PEP ne fait que PROPOSER une (dé)PEPisation (événement R39/R44), soumise à ratification. La déclaration KYC est un canal d'entrée matérialisé sur la personne, pas une autorité concurrente.**

C'est un **hybride à autorité déclarative/CDB** : déclaratif et CoC/EDD/screening **convergent** vers un unique acte humain sur la personne ; aucune source ne bascule le statut en propre.

### Justification
1. **Conformité LBA art. 6 / OBA-FINMA** : la **détermination** du PEP incombe à l'établissement, approche risque → une **décision** (Option C), pas un miroir de liste (Option B) ni une simple attestation figée (Option A).
2. **Le code l'impose déjà** : `declarerPep`/`leverPep` sont les **seuls** chemins d'écriture de `statutPep` (`personnes.service.ts:136,176`) ; le screening n'écrit pas le flag, il propose (`screening.service.ts:12-13`).
3. **R32/R33 sont littéralement l'Option C** (`wf-v2.md:713-724`) : contagieux **sans** bascule silencieuse ; déclassement toujours humain.
4. **Règle de contamination du scoring préservée** : le CPSI ne durcit le dossier **qu'après** validation KYC (`engine.py:510`), ce qui exige un statut **stable et décidé**, incompatible avec un flag qui suivrait chaque hit brut.
5. **Proches de PEP** (art. 2a LBA) : seule une vérité sur le **graphe de personnes** (R34) les couvre — ni le dossier seul (A) ni un hit isolé (B) ne le font.

---

## 5. Conséquences

### Positives
- **Une seule source** interrogeable par tous les consommateurs (CPSI, AML, `rapports` registre PEP R50) → cohérence et explicabilité.
- **Conforme et auditable** : chaque (dé)PEPisation porte `decideur` + audit (`PEP_LIFTED`, `personnes.service.ts:178`) et `source`.
- **Robuste aux faux positifs** : les hits n'altèrent pas le scoring tant qu'un humain n'a pas ratifié (protège la contamination CPSI).
- **Aligné sur le screening perpétuel** (R42) sans lui déléguer la décision.

### Négatives / dette assumée
- **File de ratification à tenir** : un hit PEP proposé mais non traité laisse la personne « détectée mais non PEPisée » — il faut **mesurer le retard** (SLA R39) et le rendre visible, sinon risque de sous-classement. Mitigation : registre des propositions PEP en attente + alerte SLA.
- **Double saisie apparente** (déclaration KYC vs flag personne) : à clarifier en UX — la déclaration KYC **alimente** l'acte sur la personne, elle n'est pas une seconde vérité. Mitigation : la déclaration KYC `IDE-Q3` doit **proposer** la PEPisation de la personne liée, pas stocker un statut parallèle.
- **Dépendance au graphe de personnes** : la couverture des proches (art. 2a) vaut ce que vaut la complétude des relations (R34) — qualité de données à surveiller.

### Chemin de mise en conformité (incrémental)
1. **Publier le contrat** : `Person.statutPep` est déclaré **seule** source ; tout consommateur (CPSI/AML/reporting) lit ce flag, jamais un hit-liste directement.
2. **Router les hits PEP de screening** vers une **proposition** `personne.pep.propose` alimentant `declarerPep` (canal, pas écriture directe) — matérialise R44 sur le chemin PEP.
3. **Rendre la déclaration KYC `IDE-Q3` proposante** (elle alimente l'acte sur la personne, ne crée pas d'état parallèle).
4. **Instrumenter la file de ratification** (propositions PEP en attente, SLA R39) pour couvrir la négative principale.

---

## 6. Références code / spec

- `apps/api/src/modules/kyc/kyc.templates.ts:17,25,33,39` — déclaration PEP par workflow (SDD/CDD/AML/EDD).
- `apps/api/src/modules/personnes/personnes.service.ts:57,132-142,147-171,173-178` — `statutPep`, `declarerPep` (R32), délai R33, `leverPep` (décision humaine).
- `apps/api/src/modules/screening/screening.service.ts:12-13,22-24` — hit PEP proposé par événement, jamais exécuté (R39/R44).
- `services/cpsi-server-py/olive_cpsi/engine.py:23,29,510` — poids PEP, contamination post-validation KYC.
- `spec/wf-v2.md:713-728` — R32 PEPisation contagieuse, R33 dé-PEPisation humaine, R34 proches de PEP (art. 2a LBA).
- `spec/spec-fonctionnelle-home-olivia.md:162` — « C4 » = capacité Olivia (paramétrage), **pas** une recommandation PEP.
- `docs/audit/RULES_INVENTORY.md` R32/R33/R44 (bases LBA art. 6 / OBA-FINMA / décision humaine).
