# O-Live — CERTIFICAT D'ÉTAT (checkpoint POST-PLAYBOOK, 2026-08-07)

**Source de vérité unique de l'état du produit.** Remplace la version du 2026-07-29.
Établi par une passe verte COMPLÈTE rejouée le 2026-08-07 (HEAD `e75ce79`, branche
`claude/olive-mvp-bootstrap-m02v1x`, CI GitHub verte sur ce même commit — 2 workflows CI
+ fat-visuel « completed success »). Index maître : `docs/PROJECT-INDEX.md`.

> **Intégrité CI (rappel de période)** : entre le 02.08 et le 05.08, la CI est restée rouge
> ~30 runs sur un FAUX POSITIF de la garde R329 (IDs d'onglet parité attrapés par le grep
> `demo`) qui masquait en cascade d'autres dérives (snapshot de surface API, stamps canon,
> exception MG-05, comptage grep AML). Tout a été pelé un par un, chaque exception documentée
> (`docs/notes/ci-r329-faux-positif.md`) — **aucune garde affaiblie**. La CI est verte et
> honnête depuis, et chaque commit de cette période l'a revérifiée.

## 1. Verdict global : PRÊT POUR LE PILOTE (code)

Tout le canon ratifié est codé, testé, poussé. Il ne reste AUCUN chantier de code
bloquant — les restes sont des décisions humaines (§6), des backlogs documentés non
bloquants (§7) et le continu hors code du playbook (§8).

## 2. Livré depuis le certificat du 29.07/02.08

- **PLAYBOOK v2 COMPLET (L0→L8)** — `docs/PLAYBOOK.md`, chaque gate franchie :
  - **L1 signal fiable** : runners propagent les codes de sortie (canari CPSI en CI),
    zéro suite hors CI.
  - **L2** couverture R222–R238 (complétude 16/16 en CI) · **L3** frontière Surveillance
    ADR-TM-001 (import inter-contexte = test d'architecture rouge) · **L4** routage PEP
    ADR-PEP-001 (PEPisation tracée OU rejet motivé, registre R50 voit les deux chemins).
  - **L5 dettes C5/C6/C7/C8** : registre de règles généré, catalogue d'événements au
    write (`apps/api/src/contracts/events-catalog.ts`), services instanciés par run.
  - **L6 screening réel** : moteur `packages/screening-engine` (JW + IDF + blocking
    trigramme + Double Metaphone) branché dans l'écran — `parity/screening-support.ts`
    réécrit en délégation au vrai moteur (l'interdit de langage est levé pour cet écran),
    gate golden 127 cas + matcher R405-R407/R410 bloquants en CI.
  - **L7 module A inférence** : Requirement/CompletionProfile chargés YAML (zod strict),
    DSL AST restreint SANS eval, RequirementLedger éphémère (vue, R1–R51 inchangées),
    miroir 50 règles généré no-drift, divergences consignées (`MIGRATION_DIVERGENCES.md`,
    DIV-1/DIV-2) avec verrou CI bidirectionnel (CO-03), écran Checklist exigences.
  - **L8 complétion D + packaging O** : goAML (XSD-subset committé, soumission MANUELLE
    tracée, chrono J+5 OUVRÉS idempotent, cloisonnement 9a/10a) · KPI conformité
    (projections de lecture R50, P90 ordinal, définitions affichées, trimestriel CSV) ·
    gouvernance O (curseur observe/suggere/copilote_gouverne par tenant, événement
    catalogué, rapport de valeur mensuel).
- **Série ES complète (ES-0→ES-5) + extensions ES-6/ES-7** — `docs/SURVEILLANCE-ES.md`,
  notes `docs/notes/ES-*.md` : sidecar event-sourcé sur schéma `es` dédié (append-only
  par TRIGGER SQL, RLS FORCE, streams physiques scopés tenant), souscripteur R286 né au
  présent (idempotence par source_event_id, quarantaine zod), agrégat alertes pur
  (evidence figée, sorties = propositions R44 uniquement), backtest = rejeu déterministe,
  shadow ES-4 structurellement incapable d'émettre + rapport de réconciliation avec
  critères de bascule oui/non, timeline des hits (ES-6) et décisions PEP (ES-7) par rejeu.
  Le module est DORMANT (`ES_SOUSCRIPTEUR=on` absent) tant que la bascule humaine n'est
  pas actée. Discours §7 du doc ES : autorisé APRÈS bascule seulement.
- **AML Gap waves 1+2** — `spec/SPEC-AML-GAP-WAVE1/2.md` : référentiel généré R340–R403
  (64 règles, 12 familles de `spec/GAP-ANALYSIS-AML.md` couvertes : screening en flux,
  OBA-FINMA, UBO, instruments PB, crypto/VASP, CFT, tuning, TBML, correspondent banking,
  prolifération, immobilier/art, analytique 2G), 122 cas GT au référentiel, analytique 2G
  exécutée côté CPSI Python (bloc 20, jamais en Nest), écran AML Gap. Les règles exigeant
  une intégration externe (prix HS, tracking conteneurs, on-chain) restent définies mais
  inactives par tenant — statut visible, jamais dégradées en silence.
- **FilterBar R404** (composant unique, FB-01..07) · **i18n 4 langues** (EN/DE/IT/AR,
  cliquet R326 : tout nouveau libellé nav doit ses 4 traductions sinon CI rouge) ·
  **budget bundle relevé à 225 kB gz** (commit motivé, packs de langue paresseux).

## 3. Frontière verte (rejouée ce jour, 2026-08-07, HEAD `e75ce79`)

| Suite | Résultat | Portée |
|-------|----------|--------|
| e2e API (Postgres réel) | **446 / 446** (69 suites) | tout le backend tenant + série ES (es-store, souscription, alerte, backtest, shadow, hits, pep) |
| Harnais de règles (`test:rules`) | **exit 0** (label CI 526/526) | R1..R417 + IAM + corpus + miroir no-drift + inférence IN/DS/LG/CO |
| Moteur CPSI (Python, runner L1) | **20 / 20 suites** + canari propagation OK | R63..R86 + PC-20 + analytique 2G (bloc 20) |
| Contrats Nest↔Python | **4/4** contrat + **3/3** cohérence PEP | L1 R248 · L4 ADR-PEP-001 |
| Gate screening | **4/4** matcher (R405-R407 · R410) | golden 127 cas, planchers qualité/perf/non-perte/non-latin |
| Front (vitest) | **116 / 116** (7 fichiers) | écrans + i18n + FilterBar + checklist inférence + sincérité screening |
| Build web + budget | ✓ | core **222.4 / 225 kB gz** + packs langue 4.6 kB (paresseux) |
| Console vendor (séparée) | **6 / 6** | R319/R320 versant vendor |
| Lint + typecheck (codes de sortie) | **exit 0 / exit 0** | eslint src · tsc --noEmit |
| CI GitHub sur HEAD | **verte** (2× CI + fat-visuel) | greps bloquants, snapshot surface API RB-07, industrialisation R331-R334, cliquet i18n |

## 4. Périmètre fonctionnel livré

Tout le périmètre du certificat précédent (socle multi-tenant RLS FORCE + JWT RS256,
KYC/onboarding/screening/CoC/review/offboarding, AML PB R189-R206, Shariah R207-R221,
CPSI R63-R86, MROS, cross-border, legal, BI, PMS, formations, trips, dégel V1-V9
R297-R323, Olivia v1/v1.1/v2 agentique R259-R266, bacs à sable, readiness R330, tenant
démo GWB R329, industrialisation R331-R334), PLUS le §2 ci-dessus. Architecture inchangée :
**journal immuable + état à date (R48) + référentiels versionnés par date d'effet** —
le cœur reste CRUD-primaire ; seul le sidecar surveillance-es est event-sourcé, et il
est dormant jusqu'à bascule humaine.

## 5. Infra & sécurité PRÉPARÉES (à appliquer par un humain)

Inchangé : `infra/` (Terraform Exoscale, WAL-G + restore-test, compose 2-instances,
Redis AOF, Caddy TLS/HSTS, alertes) · `docs/SECURITE.md` (ASVS L2, CI sécurité) ·
RUNBOOK-OPS §8 expand/contract, §9 seed/purge démo.

## 6. Décisions HUMAINES en attente (non codables)

- **Bascule ES-4** : shadow → actif sur la foi du rapport de réconciliation (critères
  oui/no explicites : zéro alerte existante manquée par ES, écarts additionnels tous
  expliqués). C'est elle qui autorise le discours commercial §7 du doc ES.
- **DIV-1 / DIV-2** (`MIGRATION_DIVERGENCES.md`) : harmonisation gardes↔ledger
  (expiration des pièces dans la validation ? revalidation sur hit post-visas ?) =
  décision produit/réglementaire.
- **Lot C — 9 R-Q ⚙** (R5, R17, R19, R25, R37, R41, R43, R45, R47) : valeurs à arbitrer
  par la banque via le questionnaire R-Q signé (prérequis contractuel). Mécanisme prêt.
- Actes opérationnels : `terraform apply` (restore testé = critère) · canal d'alerte
  réel · pentest (dossier ASVS = sa matière) · avocat CO art. 332 · marque O-Live.

## 7. Backlogs de code DOCUMENTÉS (non bloquants)

- **Catalogue C6** (`docs/notes/L5-events-todo.md`) : 568 types « en attente » à
  schématiser par familles ; creates directs restants à basculer vers `emitEvent` ;
  garde d'inventaire `--generer` à envisager.
- **ES ↔ catalogue** (`docs/notes/ES-catalogue-gaps.md`) : 4 types en garde locale à
  monter au catalogue puis étendre `DU_CATALOGUE`.
- **i18n cliquet** : conversion des écrans restants par tranches (la nav est 100 %
  traduite × 4 langues ; le cliquet CI interdit toute régression).
- **AML gap** : activation par tenant des règles à intégration externe (prix HS,
  conteneurs, on-chain) quand les données arrivent.

## 8. Continu hors code (playbook)

PV-4 pricing (guide + 10 entretiens EAM/fiduciaires) · PS-3 revue croisée de chaque
lot vs la spec v2 (`docs/OLive-Specification-Produit-v2-PostAudit.docx`) · PS-1 revue
OKR mensuelle (kill criteria oui/non).

## 9. Note de fiabilité des tests

Les suites Olivia v2 (pont Python) et les assertions de latence peuvent TIMEOUT sous
charge CI froide (flaky environnemental, CERTIFICAT §8 historique) : la CI joue UN
second passage (step 4) — un vrai échec échoue aux deux, seul un flake est absorbé.
Rien d'autre n'est retenté nulle part.
