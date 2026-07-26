# Tests d'Acceptation Fonctionnelle — Vague 4 (Écrans « plateforme »)

**Exécutés le 2026-07-22 contre le backend réel (6 FAT)** (`apps/api/test/e2e/fat-vague4.e2e-spec.ts`).
Preuve brute : `docs/tests/PREUVES/fat-vague4-run.txt`. Statut global : **6/6 PASS**.
FAT orientés : traçabilité · complétude documentaire · reporting exact.

Légende criticité : **C** = critique (bloquant recette) · **M** = majeur · **m** = mineur.

| ID FAT | Persona | Objectif métier | Préconditions | Étapes (langage humain) | Résultat attendu (métier) | Règle / exigence | Criticité | Statut |
|---|---|---|---|---|---|---|---|---|
| **FAT-TX-01** | Compliance Officer | Une transaction passe par le portail ; le client ne voit jamais de motif AML | Client au profil connu | 1. J'évalue une transaction très supérieure au profil. 2. Un rôle non habilité ouvre la file. 3. Je décide sans motif, puis avec. 4. Je lis le statut client. | Verdict **SUSPEND** tracé (R142) ; file **habilitée** (R143) ; sans motif **refusé** (R7) ; LIBERER → statut **EXECUTEE**, **sans** motif ni garde (art. 10a, R132). | R140/R142/R143/R7/R132 | **C** | ✅ PASS |
| **FAT-SETTLE-01** | Compliance Officer | L'exécution se lit d'un **port** ; sans port, refus explicite (jamais un simulacre) | Aucun connecteur core | 1. Je lis l'état de synchronisation. 2. Je tente un import. | État lisible (lecture seule, R168) ; import **refusé** explicitement (R114/R167) — **aucune** donnée inventée. | R167/R168/R114 | **C** | ✅ PASS |
| **FAT-SCREEN-ADV-01** | Compliance Officer | Screener sur une liste complémentaire (adverse media) sans multiplier les moteurs | — | 1. Je lance un run sur `ADVERSE_MEDIA`. 2. Je qualifie le hit. | Trace de passage écrite (R103) ; hit qualifié (R101) ; la liste est un **paramètre**, pas un moteur séparé. | R100→R103 · R101 | **M** | ✅ PASS |
| **FAT-MROS-01** | MLRO | Reporting réglementaire **exact & opposable** ; dossier figé ; art. 10a | Cas de risque ESCALADÉ | 1. Je décide (communiquer) avec motif + pièces. 2. Je relis. 3. Je re-décide. 4. Un non-habilité lit. | Communication + **empreinte** `dossierSha256` ; relecture **identique** (R130) ; re-décision **refusée** (figé) ; non-habilité → **403** (art. 10a, R132). | R129/R130/R132 | **C** | ✅ PASS |
| **FAT-GED-COFFRE-01** | Compliance Officer | La pièce porte sa **preuve** (versions), jamais son contenu | Pièce classée + 1 version | 1. Je liste (rôle autorisé / non autorisé). 2. J'ouvre la fiche. | Liste **filtrée au rôle** (R110) ; fiche = **versions** (≥1), **jamais** de contenu (R145). | R110 · R145 | **C** | ✅ PASS |
| **FAT-REGISTRE-01** | Compliance Officer | Le registre LBA **agrège** les journaux append-only, cloisonné | Comms MROS + runs d'un tenant | 1. J'ouvre le registre. 2. Un autre tenant regarde. | Piste d'audit agrégée (comms, runs) ; autre tenant → **0** (RLS). | Traçabilité · RLS | **M** | ✅ PASS |

**Doctrine tenue** : INTÉGRER, pas refaire. Aucun moteur de portefeuille ni core réimplémenté — le core est un **port** (R167→R169). **Liste noire respectée** : aucun écran RH / e-learning / business trip / budget / réunions / cyber-SOC n'a été construit.

**Portes backend nouvelles (spec-first, sur services ratifiés)** : `TransactionsModule` (`/v1/transactions/evaluer|revue|:id/decider|:id/statut-client`) · `MrosModule` (`/v1/mros`, `/decider`, `/:id`, `/:id/notification`, `/:id/gel`, `/:id/gel/lever`) · `CorebankingModule` (`/v1/corebanking/etat|importer`). **Aucun modèle Prisma nouveau** — tables préexistantes, déjà dans la boucle RLS FORCE.

**Correctif d'infrastructure (fond)** : ajout de `PrismaService.onModuleDestroy(){ $disconnect() }` — sans ce hook, les connexions ne se libéraient jamais entre suites e2e et saturaient Postgres. Plafond `connection_limit=3` sur la `DATABASE_URL` test/CI (1 saturait la CI par starvation des transactions interactives). Dette d'architecture signalée : un `PrismaModule` @Global (client unique) est le correctif de fond (≈18 clients aujourd'hui — un par module).

**Écart signalé (fiche GED)** : `ged-consultation.fiche` lit `v.no`/`v.empreinte`/`v.creeAt` alors que le modèle expose `numero`/`sha256`/`deposeAt` ; le fake ratifié GS-04 utilise `no`/`empreinte` (harnais vert), le vrai endpoint renvoie des métadonnées `undefined`. Correctif = aligner service + fake ratifié → hors périmètre (touche le canon GS).
