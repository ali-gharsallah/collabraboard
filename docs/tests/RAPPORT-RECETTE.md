# Rapport de recette — Vague 1

**Document de prononcé de recette.** À contresigner par le sponsor / Compliance.

| | |
|---|---|
| **Produit** | O-Live — CLM/KYC/AML multi-tenant (banque privée suisse) |
| **Périmètre** | Vague 1 : Clients · KYC (four-eyes) · Règles AML · Alertes · Rejeu à date |
| **Date d'exécution** | 2026-07-22 |
| **Environnement** | Recette locale — Postgres 16 :5433 (`olive_test`), backend NestFactory réel, RLS FORCE active |
| **Version testée** | `master` (branche de recette `claude/vague1-recette`) |
| **Réf. plan de test** | `docs/tests/PLAN-DE-TEST.md` |
| **Réf. preuves** | `docs/tests/PREUVES/fat-vague1-run.txt` |

## Synthèse

| Indicateur | Résultat |
|---|---|
| **FAT exécutés** | **8** |
| **FAT PASS** | **8** |
| **FAT FAIL** | **0** |
| **Taux de réussite recette** | **100 %** |
| FAT **critiques** (C) PASS | **6 / 6** |
| Tests de règles (non-régression) | **425 / 425** |
| Tests e2e (intégration + FAT, Postgres réel) | **14 / 14** |
| Régressions détectées | **0** |

## Détail des FAT

| ID FAT | Objectif métier | Criticité | Statut |
|---|---|---|---|
| FAT-CLIENT-01 | Création client + isolation multi-tenant | C | ✅ PASS |
| FAT-KYC-01 | Four-eyes + golden record après validation | C | ✅ PASS |
| FAT-KYC-02 | Contributeur exclu de son visa (R13) | C | ✅ PASS |
| FAT-AML-01 | Sanctions → blocage automatique (R192) | C | ✅ PASS |
| FAT-AML-02 | Structuring → alerte niveau 2 (R189) | M | ✅ PASS |
| FAT-ALERTE-01 | Alertes consultables + cloisonnées | M | ✅ PASS |
| FAT-ALERTE-02 | Maysir bloque (R209) ; caritative → revue humaine (R216) | C | ✅ PASS |
| FAT-REJEU-01 | Rejeu à date d'une règle/paramètre (R127) | C | ✅ PASS |

## Preuve — rejeu à date (exigence sensible)

> `FAT-REJEU-01 PASS — aujourd'hui=45, à la date 2026-07-21 (hier)=30 (valeur d'alors, R127)`

La valeur du paramètre `slaKycJours` est **45 aujourd'hui** (après changement motivé) et **30 à
la date d'hier** : le système restitue la valeur **telle qu'elle était** à la date demandée,
reconstruite depuis le journal append-only `tenant_param_changes`. Rejeu à date : **PASS**
(pour les paramètres/règles ; non généralisé aux agrégats métier — cf. plan de test §1).

## Anomalies

- **Bloquantes / Majeures** : **aucune**.
- **Observation** : erratum E4 — sous-requête e2e `kyc-rules` scopée au tenant (correction stricte
  de test, sans impact fonctionnel).

## Couverture des exigences

**10 / 10 exigences métier de Vague 1 couvertes (100 %)** — cf. `docs/tests/COUVERTURE-REGLES.md`.

## Décision de recette

- [ ] **Recette PRONONCÉE** — 100 % des FAT critiques PASS, 0 régression.
- Signé (sponsor / Compliance) : ______________________  Date : __________

---
*Rapport généré à partir d'une exécution réelle (preuve archivée). Aucun résultat n'est déclaré sans sortie de test correspondante.*
