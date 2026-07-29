# O-Live — CERTIFICAT D'ÉTAT (checkpoint PRÉ-PILOTE, 2026-07-29)

**Source de vérité unique de l'état du produit.** Remplace la version du 2026-07-22.
Établi par une passe verte COMPLÈTE rejouée le 2026-07-29 (HEAD `da883af`, branche
`claude/olive-mvp-bootstrap-m02v1x`, PR #46). Index maître : `docs/PROJECT-INDEX.md`.

## 1. Verdict global : PRÊT POUR LE PILOTE (code)

Tout le canon ratifié est codé, testé, poussé. Il ne reste AUCUN chantier de code
bloquant — seulement des actes humains (§7) et un chantier de fond continu (i18n, §6).

## 2. Frontière verte (rejouée ce jour)

| Suite | Résultat | Portée |
|-------|----------|--------|
| e2e API (Postgres réel) | **336 / 336** (45 suites) | tout le backend tenant, jetons réels |
| Harnais de règles | **0 ✗** | R1..R323 + IAM + corpus session |
| Moteur CPSI (Python) | **19 / 19** | R63..R86 + PC-20 équivalence |
| Console vendor (séparée) | **6 / 6** | R319/R320, VE-01..03 versant vendor |
| Front (vitest) | **80 / 80** | écrans + i18n + comparaison maquette |
| Build web + budget | ✓ | 165.2 / 220 kB gz |
| Cliquet i18n / rapport nav | ✓ / 0 écart | 5 écrans convertis, nav 72/72 clés × 3 langues |
| Greps CI | ✓ | 0 en-tête de contexte · 0 branche `demo` · secrets · anthropic |

## 3. Périmètre fonctionnel livré

- **Socle** : multi-tenant RLS FORCE, JWT RS256/JWKS (contexte 100 % du jeton — R328,
  en-têtes morts), rate limiting login R296 (store partageable Redis), en-têtes de
  sécurité (ASVS V14.4), audit append-only (triggers d'immuabilité).
- **KYC / onboarding / screening / CoC / review / offboarding** (art. 10a cloisonné) ·
  **AML** private banking (18 scénarios R189-R206) · **Finance islamique** (Shariah
  R207-R221) · **CPSI** (score perpétuel, segmentation, risk cases, R63-R86) ·
  **MROS**, **cross-border**, **legal**, **BI**, **PMS**, **formations**, **business trip**.
- **Dégel V1-V9** (R297-R323) : flux/txrisk/fx/swift · custody & TA · Builder · regwatch ·
  legal · BI · mobile banking · console éditeur · Octopulse OpRisk.
- **Olivia** v1/v1.1 + **v2 agentique** (R259-R266, SW-01..18, 2 missions, missions_actives
  vide par défaut).
- **Bacs à sable** BS-01..06 (5 bacs dry-run, zéro mutation prouvée, pont vers paramétrage).
- **Readiness & pipeline** (R330 : /readyz, /healthz, smoke, journal déploiements).
- **Tenant de démo GWB** (R329 : seed idempotent par références, histoire complète,
  DEMO-SCRIPT.md).

## 4. Front : 72/72 écrans expliqués (comparaison maquette)

71 écrans au front tenant (dont les 4 bacs en deep-link vers le hub) + 1 sur l'instance
vendor séparée = **72/72**, aucun « absent » inexpliqué (COMPARAISON-FRONT-HTML.md).
Palette : cœur identique à la maquette + accents par module (G3 levé), prouvé en CI (FE-CMP).

## 5. Infra & sécurité PRÉPARÉES (à appliquer par un humain)

- `infra/` : Terraform Exoscale, WAL-G + restore-test chronométré, compose 2-instances +
  Redis AOF + Caddy TLS/HSTS, règles d'alerte (dead-letters, jauge R250, backups).
- `docs/SECURITE.md` : grille ASVS L2 contre le code réel + CI sécurité (audit deps, ZAP
  gated, grep secrets). RUNBOOK-OPS §8 : expand/contract. §9 : seed/purge démo.

## 6. Chantier de fond CONTINU (non bloquant)

- **i18n cliquet** : 5 écrans convertis (t() + tokens), ~67 restants — mécanique, par
  tranches. La nav est déjà 100 % traduite (72/72 clés × EN/DE/IT).

## 7. Ce qui reste = ACTES HUMAINS uniquement

`terraform apply` (avec restauration testée = critère) · brancher le canal d'alerte réel ·
commander le pentest (dossier ASVS = sa matière) · avocat CO art. 332 · marque O-Live.

## 8. Note de fiabilité des tests

Les suites Olivia v2 (fat-swarm) invoquent le pont Python et peuvent TIMEOUT sous charge
CPU/DB froide (flaky environnemental, jamais un échec produit) : un second passage rend
336/336 systématiquement. Consigné pour la CI (retry sur ces suites recommandé).
