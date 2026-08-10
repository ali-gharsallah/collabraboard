# ETL & intégration core banking — spec V2-M7

**Statut : ARBITRÉE (PO, 10.08.2026) — les 5 questions du §7 sont tranchées :**

- **Q1** : connecteur v1 = **générique CSV/SFTP** (il sert aussi de harnais aux
  connecteurs propriétaires) ;
- **Q2** : périmètre v1 = **clients + comptes + transactions** (positions titres en v2) ;
- **Q3** : cadence v1 = **fin de journée (EOD)** ;
- **Q4** : défaut d'application = **tout-ou-rien** (paramètre tenant gouverné, R483) ;
- **Q5** : numérotation **R480–R489 RATIFIÉE** — la réservation On-premise PK glisse à
  **R490+** (règle établie du mapping, consignée dans `spec/mapping-session-repo.md`).

L'implémentation suit la discipline des blocs : ET-01..08 **rouges d'abord**, puis le
moteur, puis l'écran « Intégrations » (Paramétrage §Général).

---

## 1. Problème et périmètre

O-Live doit recevoir du core banking (Avaloq, Finnova, Temenos, ou un export générique
CSV/SFTP) le **stock initial** puis les **deltas** de trois familles de données :

1. **Clients & relations** (identités, structures, rôles) ;
2. **Comptes** (références, devises, statuts) ;
3. **Transactions** (flux — la matière du monitoring AML).

**Hors périmètre v1** (consigné, pas décidé) : écriture retour vers le core banking
(v1 = lecture seule), initiation de paiements, positions titres (Q2), synchronisation
temps réel (Q3).

## 2. Acquis du repo sur lesquels la spec s'appuie (le repo fait foi)

| Acquis | Où | Ce qu'on réutilise |
|---|---|---|
| Ports d'intégration R284/R286 | `modules/ports` | Un connecteur = un PORT au registre ; « pas de secret = refus gracieux » |
| Portail transactionnel R140–R143 | `modules/transactions` | Toute transaction importée passe par LE portail (verdict PASSE/BLOQUE/SUSPEND) |
| Matrice XB synchronisée R453 | `modules/crossborder` | Précédent d'un flux entrant versionné par le port, avec échec de sync tracé |
| Seed idempotent par références R329 | seed GWB | Le modèle d'application : idempotence par référence externe, jamais par heuristique |
| Migrations expand/contract R334 | runbook | Toute évolution de schéma liée à l'ETL suit expand/contract |
| Journal R49 + catalogue C6 | `modules/events` | L'application du lot ÉMET des événements ; aucun UPDATE/DELETE sur `domain_events` |
| DSL AST restreint (invariant §8) | inférence | Le mapping est déclaratif ; aucun `eval`/`exec` |
| Bacs à sable dry-run (px-2) | paramétrage | Le dry-run avant application est un pattern déjà accepté |

## 3. Architecture proposée (pipeline en 4 temps)

```
réception (port) → validation typée → staging (append-only) → application idempotente
     R486              R483                  R482                    R481/R489
```

1. **Réception** : le port du connecteur reçoit le lot (fichier ou flux), le consigne
   (`etl.lot.recu`) avec empreinte. Secrets côté port uniquement (R486).
2. **Validation typée** : chaque ligne est validée contre le **contrat d'import
   versionné** (R480) ; les rejets sont motivés ligne à ligne (`etl.ligne.rejetee`,
   R483). Aucun rejet silencieux.
3. **Staging** : les lignes valides sont posées en zone de staging append-only (R482) —
   rien n'a encore touché l'état métier.
4. **Application** : idempotente par **référence externe** (R481, modèle R329) ; elle
   passe EXCLUSIVEMENT par `emitEvent` (types `etl.*` du catalogue C6, R482) puis par
   les moteurs existants — l'import ne décide rien (R489) : une transaction importée
   va au portail R140, un client importé entre dans le screening périodique, un écart
   de flux ira à l'AML. La **réconciliation chiffrée** clôt le lot (R485).

**Dry-run** : obligatoire pour la première version d'un contrat et pour toute montée de
version (R484) — même doctrine que l'écran 10 : effet simulé montré (créations, mises à
jour, rejets, no-op), application = acte humain daté et signé.

**Rejeu** : l'état importé se rejoue à date comme le reste (R48) — le lot et sa
réconciliation sont dans le journal.

## 4. Règles proposées (R480–R489)

- **R480 — Contrat d'import versionné.** Un contrat par connecteur × famille de données,
  gouverné par date d'effet (R29) : un lot est validé contre le contrat en vigueur à sa
  date de réception, jamais le « courant ».
- **R481 — Idempotence par référence externe.** Unicité `tenant × famille × externalRef`.
  Réimporter un lot déjà appliqué = no-op consigné, jamais un doublon, jamais une erreur.
- **R482 — Staging append-only, application par événements.** Aucune écriture directe
  d'état métier depuis l'ETL : staging, puis `emitEvent` (types `etl.*`), puis
  projections. R49 intact.
- **R483 — Rejets motivés, jamais silencieux.** Chaque ligne rejetée porte son motif
  typé. Le lot est applicable partiellement OU tout-ou-rien selon un paramètre tenant
  gouverné (défaut proposé : tout-ou-rien — Q4).
- **R484 — Dry-run obligatoire.** Première version de contrat et toute montée de
  version : simulation montrée (modèle écran 10), application signée. Jamais
  d'application directe d'un contrat jamais simulé.
- **R485 — Réconciliation chiffrée par lot.** `source = appliqué + rejeté + no-op`,
  versée au journal (`etl.lot.reconcilie`). Toute divergence est un INCIDENT consigné
  (doctrine `MIGRATION_DIVERGENCES.md`), jamais une correction silencieuse.
- **R486 — Secrets côté port uniquement.** R284/R286 s'appliquent : pas de secret =
  refus gracieux ; aucune donnée core banking dans les logs techniques.
- **R487 — Mapping déclaratif.** Le mapping source→cible est un DSL déclaratif à AST
  restreint (invariant §8) : expressions invalides rejetées au chargement, aucun code
  arbitraire, aucune I/O dans le mapping.
- **R488 — Fraîcheur exposée.** Âge du dernier lot appliqué par connecteur × famille,
  exposé à l'API et en bandeau (modèle R409 — âge des listes de screening) ; seuil
  d'alerte paramétrable tenant.
- **R489 — L'import ne décide rien.** R44 appliqué à l'ETL : l'import crée des données
  et des signaux ; toute conséquence (blocage, alerte, revue) passe par les moteurs
  existants et leurs gardes. Aucun chemin ETL ne pose un verdict.

## 5. Événements proposés au catalogue C6 (schémas stricts à l'implémentation)

`etl.contrat.publie` · `etl.lot.recu` · `etl.lot.valide` · `etl.ligne.rejetee` ·
`etl.lot.applique` · `etl.lot.reconcilie` — 6 types, schémas `.strict()` comme le
reste du catalogue, garde d'inventaire incluse.

## 6. Critères de recette (rouges d'abord à l'implémentation)

- **ET-01** : un lot validé contre le contrat en vigueur À SA DATE (R480/R29).
- **ET-02** : réimport du même lot → 100 % no-op consignés, zéro doublon (R481).
- **ET-03** : zéro écriture d'état hors `emitEvent` ; `domain_events` sans UPDATE (R482/R49).
- **ET-04** : ligne invalide → rejet motivé typé ; mode tout-ou-rien vs partiel gouverné (R483).
- **ET-05** : montée de version de contrat sans dry-run → refus (R484).
- **ET-06** : réconciliation fausse (source ≠ appliqué+rejeté+no-op) → incident consigné (R485).
- **ET-07** : port sans secret → refus gracieux, message actionnable (R486).
- **ET-08** : transaction importée → verdict du portail R140 tracé ; aucun verdict posé par l'ETL (R489).

## 7. Questions ouvertes — POUR ARBITRAGE PO (rien n'est tranché ici)

- **Q1 — Connecteur v1** : générique CSV/SFTP d'abord (recommandation : oui — il sert
  aussi de harnais de test aux connecteurs propriétaires), ou Avaloq directement ?
- **Q2 — Périmètre données v1** : clients + comptes + transactions (recommandation),
  avec positions titres en v2 ?
- **Q3 — Cadence v1** : EOD (fin de journée, recommandation) ou intraday ?
- **Q4 — Défaut d'application** : tout-ou-rien (recommandation, prudent) ou partiel ?
- **Q5 — Numérotation** : ratifier R480–R489 et faire glisser la réservation PK à R490+
  (règle établie), ou attribuer un autre créneau ?

## 8. Ce que ce lot NE fait PAS

Pas de code, pas de schéma Prisma, pas de route, pas d'écran. L'implémentation (tests
ET-01..08 rouges d'abord, puis moteur, puis écran « Intégrations » du Paramétrage
§Général) démarre après l'arbitrage des questions Q1–Q5 et la validation de cette spec.
