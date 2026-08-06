# PLAYBOOK v2 — O-Live post-audit

Prompts d'exécution séquencés par lots (L0→L8), réécrits pour le **repo réel**
(NestJS/TS + CPSI Python + screening-engine). Discipline : un prompt = une session
Claude Code = un commit ; la **gate** du lot est vérifiée avant le lot suivant.
Chaque prompt suppose `CLAUDE.md` à la racine et les livrables d'audit sous `docs/`.

Référentiels cités : la spec v2 (`docs/OLive-Specification-Produit-v2-PostAudit.docx`),
la v1.1 pour le contenu détaillé des chantiers restants, `docs/audit/*.md`, `docs/adr/*.md`.

---

## L0 — Ancrage (1 prompt, 30 min)

### P-L0-1 — Commit des artefacts de gouvernance
```
Crée l'arborescence docs/audit/, docs/adr/, docs/notes/ si absente.
Déplace/committe : AUDIT.md, RULES_INVENTORY.md, TEST_AUDIT.md, GAP_ANALYSIS.md,
EFFORT_REVISION.md sous docs/audit/ ; ADR-TM-001.md et ADR-PEP-001.md sous docs/adr/.
Ajoute docs/README.md : une page qui liste chaque document, son statut (normatif /
constat / décision) et la règle « le repo fait foi ». Ne modifie aucun contenu.
Critère de sortie : `git log` montre un commit unique "docs: gouvernance post-audit".
```

---

## L1 — Signal fiable (2 prompts) — GATE : un test cassé volontairement fait échouer la CI sur chaque surface ; zéro suite hors CI

### P-L1-1 — Runner CPSI : tuer le faux-vert
```
Contexte : TEST_AUDIT signale que le runner des tests CPSI retourne 0 même en échec.
Tâche : corrige le script d'orchestration des tests Python (services/cpsi-server-py)
pour propager fidèlement le code de sortie de pytest (set -euo pipefail ou équivalent
npm-script). Ajoute un test de méta-vérification : un fichier test_canary.py avec un
test qui échoue, exécuté par le runner en mode --canary, DOIT produire un exit code ≠ 0
(le canary n'est pas dans la suite normale). Documente dans docs/notes/L1.md la cause
racine du faux-vert.
Critère de sortie : casser volontairement un assert dans test_cpsi_bloc1.py fait
échouer la commande de CI ; le canary est vert en mode normal.
```

### P-L1-2 — Bloc61 / Analytique 2G et contrat Nest↔Python en CI bloquante
```
Contexte : TEST_AUDIT — bloc61 (Analytique 2G) est exclu de la CI ; le contrat entre
apps/api et le CPSI n'est jamais vérifié de façon bloquante.
Tâche : (1) réintègre la suite bloc61 dans le pipeline CI comme étape bloquante ;
si elle est rouge, corrige les tests OU consigne chaque échec dans docs/notes/L1.md
avec diagnostic — ne désactive rien silencieusement. (2) Ajoute un test de contrat :
pour 3 payloads représentatifs (signal simple, franchissement de bande, config tenant
versionnée), la réponse du bridge Python (services/cpsi-server-py/bridge.py) est
validée contre un schéma JSON committé sous docs/contracts/cpsi.schema.json, exécuté
côté apps/api en spec Jest.
Critère de sortie : CI rouge si bloc61 échoue ou si le contrat diverge du schéma.
```

---

## L2 — Couverture R222–R238 (3 prompts) — GATE : mutation d'une garde de la vague = test rouge

### P-L2-1 — Inventaire testable de la vague
```
Parcours les modules businesstrip, oprisk, custody, ta, crossborder, txflux,
regwatch, formations, nba dans apps/api/src/modules. Produis docs/notes/R222-238-map.md :
pour chaque identifiant R222..R238 trouvé dans le code — fichier:ligne, comportement
observable (throw / événement / calcul), et le cas de test minimal qui le fige
(Given/When/Then une ligne). Marque les gardes réglementaires (celles dont la
violation serait un incident de conformité) d'un ⚠. Aucun code modifié.
Critère de sortie : la carte couvre 100 % des occurrences R222–R238 du grep.
```

### P-L2-2 — Tests des gardes réglementaires (⚠ d'abord)
```
Sur la base de docs/notes/R222-238-map.md : écris les specs Jest des gardes marquées ⚠,
module par module, en suivant les conventions des specs existantes (mêmes helpers,
mêmes fixtures). Chaque test cite son identifiant R en describe(). Interdit : modifier
le code de production pour « faciliter » un test — si une garde est intestable sans
refactor, consigne-la dans docs/notes/L2-blocages.md.
Critère de sortie : suites vertes ; inverser une condition de garde ⚠ (mutation
manuelle locale) fait rougir au moins un test.
```

### P-L2-3 — Compléter la vague et verrouiller
```
Écris les specs des R222–R238 restants (non-⚠) au même standard. Mets à jour
docs/notes/R222-238-map.md avec la colonne « testé par : fichier ». Ajoute un test
de complétude : un script qui greppe les identifiants R222..R238 du code et vérifie
que chacun apparaît dans au moins un describe() de spec — rouge sinon.
Critère de sortie : le test de complétude est vert et en CI.
```

---

## L3 — Frontière Surveillance, ADR-TM-001 (2 prompts) — GATE : import direct inter-contexte = test d'architecture rouge

### P-L3-1 — Carte et ports
```
Contexte : docs/adr/ADR-TM-001.md (Option C — contexte borné logique in-monolith).
Tâche : identifie les modules du contexte Surveillance (screening, aml, riskcases,
mros, et leurs dépendances) et documente docs/notes/surveillance-frontiere.md :
ce qui entre (événements consommés, appels), ce qui sort (propositions, verdicts),
les points où un module externe importe directement un interne du contexte.
Définis les ports TypeScript (interfaces) aux points de croisement — déclaration
seulement, zéro refactor d'implémentation dans ce prompt.
Critère de sortie : la carte liste chaque violation de frontière avec fichier:ligne.
```

### P-L3-2 — Matérialiser la frontière
```
Sur la base de la carte : remplace les imports directs inter-contextes par les ports
définis (adaptation minimale, comportement identique — les specs existantes restent
vertes). Ajoute un test d'architecture (dependency-cruiser ou ESLint no-restricted-
imports) qui interdit les imports directs vers les internes du contexte Surveillance
depuis l'extérieur, et inversement.
Critère de sortie : test d'archi vert en CI ; le violer localement le fait rougir ;
zéro spec existante cassée.
```

---

## L4 — Routage PEP, ADR-PEP-001 (2 prompts) — GATE : un hit PEP-liste finit en PEPisation tracée ou rejet motivé ; le registre R50 voit les deux chemins

### P-L4-1 — Le câblage hit → proposition → décision
```
Contexte : docs/adr/ADR-PEP-001.md (autorité = personnes.statutPep, humain décide) ;
GAP_ANALYSIS C4 : aucun chemin ne relie un hit PEP-liste à statutPep.
Tâche : quand un run de screening produit un hit sur une liste de catégorie PEP
au-dessus du seuil de revue, émets une proposition de PEPisation (événement
pep.proposition.creee + tâche assignée au rôle compliance) portant hitId, listVersion,
score, décomposition. La décision humaine passe par les chemins EXISTANTS
declarerPep/leverPep, étendus d'un champ optionnel sourceHitId (trace liante).
Un rejet de proposition exige un motif (événement pep.proposition.rejetee).
INTERDIT : toute bascule automatique de statutPep (R44). Specs : hit → proposition,
acceptation → statutPep=true avec trace, rejet motivé, idempotence (même hit,
même version de liste = une seule proposition).
Critère de sortie : les 4 specs vertes ; grep confirme que personnes.service.ts
reste le seul écrivain de statutPep.
```

### P-L4-2 — Registre R50 et cohérence CPSI
```
Étends le registre PEP réglementaire (rapports, R50) : il expose désormais les PEP
déclarés ET les propositions ouvertes/rejetées issues de hits (deux sections
distinctes, jamais confondues — le registre reflète l'autorité, pas les signaux).
Vérifie par spec que le poids CPSI `pep` lit bien l'attribut structurel de la fiche
personne et documente dans docs/notes/L4.md le délai de propagation attendu
fiche → prochain score. Ajoute au rapport d'audit d'un dossier la trace liante
hit ↔ décision PEP quand elle existe.
Critère de sortie : export du registre montre un cas de chaque chemin sur les
fixtures ; specs vertes.
```

---

## L5 — Dettes structurelles C5/C6/C7/C8 (3 prompts) — GATE : collision d'identifiant ou d'événement = CI rouge ; runs concurrents sans fuite d'IDF

### P-L5-1 — Registre central des règles (C5)
```
Crée docs/rules-registry.json : registre des identifiants R (numéro, module
propriétaire, fichier d'ancrage, statut actif/brûlé). Peuple-le par grep des
R existants (apps/api/src, services/cpsi-server-py, packages). Ajoute un test CI :
tout identifiant R présent dans le code et absent du registre, ou déclaré deux fois
avec des propriétaires différents, fait rougir. Les numéros retirés restent au
registre en statut « brûlé » (jamais réattribués).
Critère de sortie : registre exhaustif, test vert, collision simulée = rouge.
```

### P-L5-2 — Catalogue d'événements au write (C6)
```
Crée docs/contracts/events-catalog.ts : pour chaque type d'événement émis via
emitEvent, un schéma zod (payload v-courante) et la version. Modifie emitEvent pour
valider le payload contre le catalogue AVANT insertion (échec = exception typée,
jamais d'écriture partielle) et poser event_version depuis le catalogue. Les types
inconnus sont refusés. Migration douce : commence par les événements du noyau KYC
et du screening ; liste les types restants dans docs/notes/L5-events-todo.md.
INTERDIT : toucher aux événements déjà stockés (R49) — le catalogue régit le write,
les upcasters continuent de régir la lecture.
Critère de sortie : émettre un payload non conforme en spec lève l'exception ;
specs existantes vertes.
```

### P-L5-3 — Précédence de config (C7) et IDF par run (C8)
```
C7 : dans resoudreConfig (screening.service.ts), l'override d'appel ne peut plus
écraser silencieusement la config gouvernée : soit le tenant a activé
allowCallOverride (tenant.settings, défaut false), soit l'override est rejeté ;
tout override accepté exige un champ justification, tracé sur le run.
C8 : instancie l'IDF et l'index par run (plus d'état module-global) — suis la piste
« à instancier par run » notée dans le code ; le cache d'index reste clé par
liste@version (données de liste, pas de fuite tenant) mais l'état de scoring est
local à l'appel. Spec de concurrence : deux runs interleavés (tenants différents,
listes différentes) produisent des scores identiques à leurs runs isolés.
Critère de sortie : spec de concurrence verte ; gate golden 127 cas toujours verte
(non-régression du moteur).
```

---

## L6 — Screening réel (3 prompts) — GATE : rescreening delta sur base réelle ; rappel ≥ 0.90 sur golden étendu non-latin ; l'écran affiche les scores du moteur

### P-L6-1 — Ingestion de listes réelles versionnée
```
Contexte : v1.1 §7 (SCR-DF) pour le contenu ; GAP_ANALYSIS capacité 5 (fixtures
synthétiques). Tâche : pipeline d'ingestion OpenSanctions (bulk + delta) avec
sources de secours SECO/OFAC : chaque version immuable (source, timestamp, hash),
conservation ≥ 90 j, delta-detection entité par entité, rescreening ciblé du stock
via le blocking, delisting → hits ouverts en revue accélérée (jamais de clôture
auto), âge de la liste exposé (bandeau + API). Événements au catalogue L5-2.
Critère de sortie : ingestion d'un dump réel + un delta simulé → rescreening ciblé
tracé ; specs d'idempotence et de delisting vertes.
```

### P-L6-2 — Translittération non-latine + golden étendu
```
Contexte : normalisation latin-only (GAP_ANALYSIS capacité 1). Tâche : ajoute la
translittération arabe/cyrillique (ICU + table de variantes de romanisation) dans
packages/screening-engine, en amont du pipeline existant. Étends le golden set :
≥ 50 paires arabe/latin et ≥ 30 cyrillique/latin, positives et négatives, marquées
par origine. Recalibre si nécessaire SANS toucher aux planchers du gate.
Critère de sortie : gate CI verte avec golden étendu — rappel global ≥ 0.90,
précision ≥ 0.95, FP homonyme = 0 maintenus.
```

### P-L6-3 — Le front dit la vérité
```
Contexte : apps/web/src/parity/screening-support.ts fabrique la confiance par
hachage (nameSim=78+hN%22) — interdit en démo. Tâche : branche l'écran screening
sur l'API réelle (scores et décomposition du moteur, R411) ; supprime le générateur
de hachage ; affiche la décomposition (JW/tokens/phonétique/discriminants) et la
version de liste + config du run. Ajoute un test de sincérité : l'écran ne contient
plus aucune valeur de confiance calculée côté front.
Critère de sortie : la démo affiche les scores du moteur sur les fixtures réelles ;
grep « 78+h » ne retourne rien.
```

---

## L7 — Module A, inférence goal-driven adaptée (5 prompts) — GATE : gap < 1 s ; verdict ledger = verdict gardes sur corpus ; démo Trust+PEP jouable

### P-L7-1 — Modèle Requirements + profils YAML
```
Contexte : spec v2 §7 (design adapté) ; v1.1 §6 pour le contenu ; RULES_INVENTORY
(~90 % de R1–R51 reformulables). Crée apps/api/src/modules/inference/ SANS modifier
l'existant : types Requirement (id, kind ∈ {data, document, check, approval}, basis,
severity, params), CompletionProfile, RequirementStatus (satisfied, satisfiedBy,
derivedBy) ; chargeur YAML strict (champ inconnu refusé, erreur = chemin du champ) ;
résolveur de profil avec fallback juridiction. TDD ≥ 8 specs dont erreurs de config.
Critère de sortie : specs vertes ; zéro import depuis les modules existants
hors types partagés.
```

### P-L7-2 — DSL d'activation sûr
```
Évaluateur des activation_rules (champ when) : AST restreint (comparaisons,
and/or/not, in, any/all, attributs whitelistés d'un Protocol CaseFacts :
entityType, jurisdiction, riskLevel, relatedPersons[{role,pep,sanctioned}],
documents[], checks[]). Pas d'eval. Expression invalide rejetée AU CHARGEMENT.
Specs : valides/invalides, injection, any() sur liste vide.
```

### P-L7-3 — CaseFactsReader + RequirementLedger (service de lecture)
```
Contexte : AUDIT §6 (5 résistances) — le ledger est un SERVICE DE LECTURE, pas une
projection rejouée. Implémente CaseFactsReader : construit CaseFacts depuis les
tables d'état (kycFile, sections, visas via qualified-visa, documents/matrice,
personnes+statutPep, screening_hits) sous RLS, complété par le journal uniquement
où la donnée n'existe qu'en événement. Instancié par requête (leçon C8), zéro
écriture. Puis RequirementLedger : résolution du profil, évaluation des activations,
statut par Requirement (Document : présent + non expiré ; Check : hits tous
qualifiés ; Approval : visa existant du bon rôle — RÉUTILISE qualified-visa),
gap() bloquants d'abord, explain(rid) : règle, faits, base légale, événement/ligne
satisfaisante.
Critère de sortie : gap < 1 s sur un dossier de fixtures ; specs des 4 scénarios
d'inférence de la v1.1 §6.3 adaptées au repo, vertes.
```

### P-L7-4 — Miroir des règles et test de cohérence
```
Pour chaque règle marquée reformulable dans docs/audit/RULES_INVENTORY.md, génère
l'entrée YAML (basis repris de l'inventaire). RÈGLE ABSOLUE : R1–R51 inchangées.
Test de cohérence : sur le corpus de dossiers de fixtures, le verdict « validable »
des gardes existantes (validate() en dry-run ou équivalent) et le verdict
« gap vide » du ledger coïncident ; toute divergence dans MIGRATION_DIVERGENCES.md
avec diagnostic — jamais corrigée silencieusement.
Critère de sortie : test de cohérence en CI ; divergences = documentées, pas cachées.
```

### P-L7-5 — RequirementChecklist + démo G4
```
Composant front <RequirementChecklist caseId/> (Encre & Olive : INK #232A1E,
OLIVE #5C6B3C, PAPER #EEF0EA) branché sur l'API réelle du ledger : groupes
Données/Documents/Contrôles/Visas, bloquants d'abord, badge base légale (tooltip),
lien « pourquoi ? » → explain(). Aucune valeur fabriquée côté front (leçon L6-3).
Scénarise docs/DEMO_SCRIPT.md : parcours Trust + settlor PEP — gap initial,
réception Formulaire T, proposition PEP (L4), EDD, visa CO — état attendu de la
checklist à chaque étape, en n'utilisant QUE des capacités réelles.
Critère de sortie : démo jouable de bout en bout sur les fixtures.
```

---

## L8 — Complétion D + packaging O (3 prompts) — GATE : goAML valide XSD ; rapport de valeur généré sur tenant de démo

### P-L8-1 — goAML XSD + chronomètre
```
Contexte : v1.1 §9 (module D) pour le contenu. Étends mros/ : génération du
brouillon goAML XML pré-rempli (dossier, transactions en évidence, récit),
validation XSD en spec, soumission manuelle. Chronomètre réglementaire : horodatage
de la caractérisation du soupçon, alerte J+5 ouvrés, testé par simulation d'horloge.
Re-vérifie par spec le cloisonnement art. 9a/10a (aucune trace côté front — tests
RLS + rôle).
```

### P-L8-2 — KPI conformité
```
Projections KPI : volumes par scénario/sévérité/statut, âge moyen et P90,
conversion alerte→déclaration, charge par analyste ; rapport trimestriel exportable.
Données lues des tables réelles (riskcases, screening_hits, mros).
```

### P-L8-3 — Module O : rapport de valeur et curseur
```
Contexte : v1.1 §13 (packaging O1/O2/O3). Sur le module olivia existant : expose le
curseur d'autonomie par capacité et par tenant (tenant.settings, défaut observe) ;
implémente le rapport de valeur mensuel par tenant (suggestions émises/acceptées,
repriorisations, relances, dérives détectées — depuis le journal) ; chaque action
reste actor: olivia@version via les chemins API existants (R44). Aucune capacité
nouvelle dans ce prompt — uniquement la gouvernance et la visibilité.
Critère de sortie : rapport généré sur le tenant de démo ; changer le curseur émet
un événement catalogué.
```

---

## Continu (hors code)

- **PV-4 pricing** : guide d'entretien + 10 entretiens EAM/fiduciaires — démarre
  en parallèle de L1, pas après.
- **PS-3 revue croisée** : à la fin de chaque lot, comparer l'implémentation à la
  spec v2 et au contenu v1.1 correspondant ; écarts → plan de correction le plus court.
- **PS-1 revue OKR mensuelle** : kill criteria vérifiés explicitement (oui/non).
