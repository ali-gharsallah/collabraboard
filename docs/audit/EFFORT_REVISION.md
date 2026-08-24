# Révision d'effort — Surveillance / Transaction Monitoring (et suites d'audit)

> Date : 2026-08-06 · Portée : révision des estimations d'effort à la lumière des constats d'audit (`AUDIT.md`, `RULES_INVENTORY.md`, `TEST_AUDIT.md`) et des décisions ADR-TM-001 / ADR-PEP-001. « Le repo fait foi. »

---

## 0. Le « §15 » de la spec : introuvable comme section d'estimations

L'énoncé renvoie à un **« §15 » de la spec** portant des **estimations d'effort**. **Vérification faite, cette section n'existe pas.**

- Le `.docx` `spec/OLive-Specifications-Moteur-Workflow-v4.20.docx` a été extrait (`python3 zipfile` → `word/document.xml`, tags dépouillés, 263 124 caractères) : **aucun `§15`, aucun `C4`, aucune table d'estimation d'effort** (recherche `§ ?15`, `estimation`, `charge`/`jours-homme`/`effort` → seules occurrences = « charge » au sens *charge de travail réglementaire* R40/R70/R183, pas des estimations projet). Idem `v4.21`.
- `spec/wf-v2.md` : **aucun `§15`, aucun `C4`, aucun `estimation`/`effort`/`sprint`/`jours-homme`**.
- Le **seul** `§15` du dépôt est une note de statut CI : *« §15 — CI VERTE SUR RUNNERS GITHUB (19.07, 19h20) »* (`docs/olive-session-handoff-2026-07-19.md:333`) — **sans rapport** avec des estimations d'effort.
- Le seul `C4` du corpus est une **capacité Olivia** (« C4 — Proposition de paramétrage », `spec/spec-fonctionnelle-home-olivia.md:162`).

**Conséquence : il n'y a pas d'« estimations d'origine §15 » à réviser.** Conformément à la consigne, ce document fournit à la place une **estimation ascendante (bottom-up) NEUVE**, clairement étiquetée comme telle, pour la construction du contexte **Surveillance / Transaction Monitoring** (décision ADR-TM-001), calibrée sur ce qui **EXISTE déjà** dans le code.

---

## 1. Hypothèses de calibrage (issues de l'audit)

Ces faits **réduisent** ou **déplacent** l'effort par rapport à un chantier vierge :

| Fait d'audit | Effet sur l'effort |
|---|---|
| **Réalité bi-moteur** : le scoring perpétuel est déjà un moteur séparé (CPSI Python, `engine.py`, R63-R84). | Pas de moteur de scoring à écrire ; l'effort porte sur **l'orchestration + le câblage de tests + l'interface anti-corruption**, pas sur le calcul. |
| **Surveillance déjà partiellement câblée** : `txflux` (journal R297), `txrisk` (surface CPSI R298), `transaction-gate` (portail R140-R143), `swift` (R300), screening des parties (R100). | On **consolide/durcit** l'existant, on ne le crée pas. |
| **Capacités screening déjà construites** : moteur fin `@olive/screening-engine` (Jaro-Winkler + IDF + pré-filtre trigramme, R408-R417), golden set 127 cas **assertés** avec cliquet (`services/screening/*.test.mjs`), équivalence-aux-défauts. | La brique screening PEP/sanctions est **mature** ; effort résiduel = **routage des propositions**, pas un moteur. |
| **Surface de test réelle ~1 400+ cas** sur 9 surfaces (pas « 64 »), discipline événementielle établie (`TEST_AUDIT.md` §1,§4). | Le patron de test (`faux-Prisma + evts()`) est **connu et réutilisable** → coût unitaire d'une wiring spec **bas**, mais le **volume** de specs à ajouter est réel. |
| **Vague R222→R238 non testée en propre** (`txflux`/`txrisk`/`fx`/`swift`… `ABSENT` de `run-rule-tests.sh`, `TEST_AUDIT.md` §2-3). | C'est le **gros poste** : câbler les tests manquants et fermer la porte bloquante. |
| **RLS + transactions synchrones réutilisées** (ADR-TM-001, Option C). | Pas de coût d'extraction de service, pas de RLS à ré-implémenter. |
| **`bloc61` / Analytique 2G hors CI** + **runner CPSI en faux-vert** (`TEST_AUDIT.md` §3). | Poste de **fiabilisation du signal** à budgéter, sinon la surveillance repose sur une CI trompeuse. |

Unité : **j·h** (jours-homme) d'un dev senior familier du repo. Barème d'incertitude : **P50** (médiane) / **P80** (pessimiste raisonnable).

---

## 2. Estimation ascendante — Construction du contexte Surveillance / TM

> **ESTIMATION BOTTOM-UP NEUVE** (aucune estimation d'origine spec à réviser — cf. §0). Chiffres calibrés sur l'existant du repo, pas sur un greenfield.

| # | Lot de travail | Assise dans le code (ce qui existe) | Reste à faire | P50 (j·h) | P80 (j·h) | Justification |
|---|---|---|---|---:|---:|---|
| S1 | **Nommer la frontière `surveillance`** (contexte borné logique, ADR-TM-001 Option C) | `txflux`, `txrisk`, `transactions/transaction-gate`, `swift`, screening des parties déjà présents | Regrouper par convention + barre de dépendances inter-modules (lint), aucun déplacement de base | 3 | 6 | Réorganisation logique, pas de réécriture ; risque = imports croisés à casser |
| S2 | **Formaliser les ports** (entrée `TxFluxPort`, port scoring→CPSI anti-corruption, sorties→`riskcases`/`mros`) | `TxFluxPort` existe (`txflux.module.ts:20-21`) ; couplage `txrisk→cpsi` existe (`txrisk.module.ts:4-5`) | Expliciter l'interface anti-corruption + typer les DTO d'échange | 5 | 9 | Le couplage est là mais informel ; travail d'interface, pas de logique |
| S3 | **Câbler les tests R222→R238** (wiring spec par surface : `txflux`, `txrisk`, `fx`, `swift`, `txrisk`, + revue portail) sur patron `faux-Prisma + evts()`, intégrées à `run-rule-tests.sh` | Patron de test établi et réutilisé partout (`TEST_AUDIT.md` §4) ; ~1 664 lignes de modules à couvrir | Écrire ~8-10 wiring specs + les rendre bloquantes | 12 | 20 | **Gros poste.** Coût unitaire bas (patron connu) × volume réel ; ferme le plus gros gap d'audit |
| S4 | **Router les propositions PEP** (hit screening → `personne.pep.propose` → `declarerPep`) — dépendance ADR-PEP-001 | `screening` émet déjà des escalades **proposées** (`screening.service.ts:12-13`) ; `declarerPep` existe (`personnes.service.ts:132-142`) | Brancher le canal + file de ratification + SLA R39 | 6 | 11 | Réutilise deux mécanismes existants ; l'effort = la file + l'alerte SLA |
| S5 | **Fiabiliser le signal CPSI** : runner `run_tests.py` qui échoue sur `ko>0` (supprimer le faux-vert), + **contrat Nest↔CPSI bloquant** sortant `bloc61`/Analytique 2G de quarantaine | Tests CPSI existent (117 `def test_`) ; `bloc61` exclu (`ci.yml:301`) ; faux-vert (`TEST_AUDIT.md` §3) | Corriger le runner + écrire un test de contrat sur fixtures figées | 5 | 9 | Sans ce lot, la surveillance repose sur une CI trompeuse — prérequis de confiance |
| S6 | **Portail transactionnel — durcissement** : verdicts `PASSE/BLOQUE/SUSPEND` (R140-R143), gardes registre (`txGardes`), fail-secure, file de revue habilitée, cohérence MROS (art. 10a) | `transaction-gate.service.ts` déjà écrit (164 l., R140-R143) + wiring spec (`transaction-gate.wiring.spec.ts`) | Revue de complétude des gardes + cas limites (garde en ERREUR→SUSPEND, seuils par profil) | 5 | 10 | Base solide déjà testée ; effort = complétude/cas limites, pas création |
| S7 | **Interface anti-corruption CPSI publiée** : documenter attributs R79 → `cpsi.client.registered` comme contrat du contexte | `txrisk` calcule déjà les agrégats R79 (`txrisk.module.ts:22-46`) | Documenter + verrouiller le contrat par test (S5) | 3 | 5 | Surtout documentaire + un test de contrat |
| S8 | **Observabilité / registres réglementaires** : registre PEP en attente, retards SLA, export (R50) | `rapports` porte déjà des registres (R50) | Ajouter les vues « propositions PEP en attente » + retards surveillance | 4 | 7 | Extension de registres existants |
| — | **Sous-total ingénierie** | | | **43** | **77** | |
| — | **Marge d'intégration / revue / RLS recette (≈20 %)** | | | **9** | **15** | Recette RLS bloquante à repasser, revues de frontière |
| — | **TOTAL contexte Surveillance / TM** | | | **≈ 52 j·h** | **≈ 92 j·h** | soit **~2,5 à ~4,5 semaines-personne** |

---

## 3. Postes de dette d'audit à budgéter EN PARALLÈLE (hors périmètre TM strict)

Ces postes ne sont pas la construction TM mais la **fiabilisent** ; l'audit les a identifiés comme risques actifs.

| Poste | Constat | P50 (j·h) | P80 (j·h) |
|---|---|---:|---:|
| Faux-vert runner CPSI | `run_tests.py` rend 0 même sur échec (`TEST_AUDIT.md` §3) — **inclus en S5** ci-dessus | (S5) | (S5) |
| `bloc61` / Analytique 2G hors CI | exclu par `--testPathIgnorePatterns bloc61` (`ci.yml:301`) — **inclus en S5** | (S5) | (S5) |
| Front web quasi non testé | 3 fichiers / 14 cas vitest ; Playwright non bloquant (`TEST_AUDIT.md` §3) — hors TM | 8 | 15 |
| Olivia flaky-tolérant | e2e avec 1 retry, pas de wiring spec (`TEST_AUDIT.md` §3,§5) — hors TM | 5 | 9 |

---

## 4. Ce qui, à l'inverse, N'est PAS à estimer (déjà fait — évite le sur-chiffrage)

Le sur-dimensionnement classique d'un chantier « TM from scratch » suppose d'écrire ces briques ; **elles existent** :

- **Moteur de scoring perpétuel** → CPSI (`engine.py`, 838 l., R63-R84, 117 tests). Fait.
- **Journal transactionnel canonique** → `txflux` (R297, append-only, idempotent, port core banking). Fait.
- **Moteur de screening fin** → `@olive/screening-engine` (R408-R417, golden set 127 cas assertés + équivalence-aux-défauts). Fait.
- **Portail transactionnel** → `transaction-gate` (R140-R143, gardes registre, fail-secure, MROS). Fait, à durcir (S6).
- **Agrégats transactionnels R79** → `txrisk` (vélocité in/out, cross-border…). Fait.
- **Cases d'investigation** → `riskcases` (R76, R133-136). Fait.
- **Isolation RLS** → `prisma.service.ts` + recette RLS. Fait (réutilisé, décision ADR-TM-001).

Estimer ces briques serait **doublon** : l'effort résiduel est **consolidation + tests + interfaces**, chiffré au §2.

---

## 5. Synthèse

- **Il n'existe pas de §15/estimations d'origine** dans la spec (docx v4.20/v4.21, wf-v2.md) — rien à « réviser » ; le §15 du dépôt est une note CI.
- **Estimation bottom-up neuve** de la construction Surveillance / TM : **≈ 52 j·h (P50) → ≈ 92 j·h (P80)**, soit ~2,5 à ~4,5 semaines-personne, **grâce à** un existant substantiel (deux moteurs, screening mature, journal, portail) et **grevé par** le gros poste de **câblage de tests R222→R238** (S3) et de **fiabilisation du signal CPSI** (S5).
- Le facteur décisif du chiffrage bas est la décision **ADR-TM-001 (contexte logique in-monolith)** : elle évite tout coût d'extraction de service et de ré-implémentation RLS.

### Références
`spec/OLive-Specifications-Moteur-Workflow-v4.20.docx` (extraction zipfile) · `spec/wf-v2.md` · `docs/olive-session-handoff-2026-07-19.md:333` · `spec/spec-fonctionnelle-home-olivia.md:162` · `docs/audit/AUDIT.md` · `docs/audit/TEST_AUDIT.md` §1-5 · `apps/api/src/modules/txflux/*`, `transactions/transaction-gate.service.ts`, `screening/*`, `personnes/personnes.service.ts` · `services/cpsi-server-py/olive_cpsi/engine.py`.
