# Olive — Plan d'exécution global & priorisation

Date : 2026-07-11 · Hypothèse d'équipe : solo (toi + IA) jusqu'au pilote signé,
puis +1 dev senior. Les durées sont calibrées sur cette hypothèse.

## 0. État réel des actifs (ce qui est FAIT)
| Actif | État | Rôle |
|---|---|---|
| Démo SPA (1.9 MB, 54 écrans, 4 langues) | ✅ validée écran par écran | **Machine à vendre** — RDV banques dès maintenant |
| Module KYC backend durci v0.2.0 | ✅ testé (unit + e2e) | Cœur du produit réel |
| Monorepo MVP + P0 enterprise | ✅ ce commit | Squelette d'industrialisation |
| Gap analysis 20 briques | ✅ | Carte de route technique |
| Revues d'architecture (SPA + backend) | ✅ | Due diligence investisseur prête |

## 1. Ligne directrice
**On vend avec la démo pendant qu'on industrialise.** Trois jalons, chacun
vendable :
- **J1 — Démo commerciale** : FAIT. Objectif : 10 RDV, 2 lettres d'intention.
- **J2 — Pilote on-premise (1 banque)** : le produit réel, périmètre KYC+GED+
  Screening+AR, chez un établissement, données réelles. **C'est le jalon qui
  transforme Olive en société.**
- **J3 — Plateforme multi-tenant (5+ banques)** : SaaS suisse (Exoscale ZH).

## 2. Backlog priorisé

### 🔴 P0 — Bloquants du pilote (S1 → S10, chemin critique)
| # | Action | Durée | Dépend de | Definition of done |
|---|---|---|---|---|
| P0-1 | **Constitution & protection** — statut RÉGLÉ : fin de contrat SpeciTec 30.06.2026, lettre du 07.07 « libre de tout engagement hormis confidentialité » (+ art. 340c al. 2 CO : départ initié par l'employeur → non-concurrence caduque). Actions : archiver la lettre · note clean-room datée (zéro matériel SpeciTec dans Olive) · constitution Sàrl/SA à ton nom · dépôt marque (vérifier antériorité « Olive eKYC » IN) · si chômage : règles de fondation à vérifier avec la caisse | 2-3 sem (parallèle) | — | Société inscrite au RC + marque déposée + note clean-room signée. La seule ligne rouge restante : confidentialité SpeciTec (321a al. 4 CO, 162 CP, LCD) |
| P0-2 | Brancher le frontend produit sur l'API réelle (clients+KYC bout-en-bout, pattern useApiOrSeed) | 2 sem | monorepo ✅ | Créer un KYC depuis l'UI → visas → validation four-eyes → outbox, sur Postgres |
| P0-3 | IAM Keycloak (OIDC, MFA, mapping 9 rôles) | 1.5 sem | P0-2 | Login SSO, rôles appliqués, impersonation auditée |
| P0-4 | GED réelle : upload S3/MinIO, SHA-256 serveur, rétention, antivirus | 1.5 sem | P0-2 | Dépôt → hash → workflow validation → rétention calculée |
| P0-5 | Screening service v1 : listes OFAC/SECO/UE/ONU **réelles** (parseurs officiels), matching du moteur démo porté serveur | 2 sem | P0-2 | Import des fichiers officiels + hit qualifiable + 2e signature |
| P0-6 | Chiffrement colonnes sensibles (FieldEncryption posé) appliqué à clients/documents + Vault dev | 1 sem | P0-2 | Nom/IBAN/TIN chiffrés en base, blind index fonctionnel |
| P0-7 | Observabilité minimale : OTel → Grafana, alerte erreurs+latence | 0.5 sem | P0-2 | Dashboard + alerte mail |
| P0-8 | Installeur on-premise : compose durci + runbook + backup/restore chiffré testé | 1 sem | P0-3..7 | Install vierge < 2 h, restore prouvé |
**Sortie P0 = Pilote installable.** ~10 semaines solo (P0-1 en parallèle).

### 🟠 P1 — Exigences du pilote en marche (S8 → S16, chevauche P0)
| # | Action | Durée |
|---|---|---|
| P1-1 | Account Review + CoC serveur (workflow simple persisté, pas encore le moteur BPMN) | 2 sem |
| P1-2 | Notifications (email + in-app) consommant le bus | 1 sem |
| P1-3 | Scheduler : pKYC, expiry documents, relances SLA (BullMQ repeatable) | 1 sem |
| P1-4 | LicenseService branché (modules du pilote activés par licence signée) | 0.5 sem |
| P1-5 | Reporting : exports CRS/FATCA/goAML depuis données réelles | 1.5 sem |
| P1-6 | Tests de charge (k6 : 50 users, 10k clients) + durcissement | 1 sem |

### 🟡 P2 — Différenciation & 2e-5e banque (M5 → M9)
Rule Engine configurable → Workflow Engine (state machine persistée) →
**Olivia gateway locale** (LLM on-prem + RAG sur la base de connaissances —
le différenciant stratégique vs Fenergo/Avaloq) → OpenSearch via CDC →
Template engine documentaire (Word/PDF depuis golden record) → Data generator
synthétique (entraînement Olivia + démos client personnalisées) →
Configuration Studio v1 (matrices risque + questionnaires).

### ⚪ P3 — Scale (M10+)
Multi-tenant SaaS Exoscale · Digital Twin · Kafka si >200 tenants ·
Configuration Studio complet · certification ISAE 3402 / préparation FINMA.

## 3. Chemin critique
P0-1 (juridique) ━━ seul bloquant NON technique, à lancer AUJOURD'HUI
P0-2 → P0-3/4/5/6 (parallélisables par lots) → P0-8 → **PILOTE**
Le reste (P1) se livre pendant que le pilote tourne.

## 4. Hors-code (aussi important que le code)
1. **Avocat** : SpeciTec + marque O-Live (antériorité « Olive eKYC » Inde) — S1.
2. **Cible pilote** : 3 banques GE/ZH taille 50-200 employés identifiées via la
   pré-prospection ; proposer pilote payant (CHF 30-60k, 4 mois) — crédibilise.
3. **Pricing licence** : par module (le LicenseService le permet), socle +
   KYC/AML/Screening, on-prem premium.
4. **Recrutement** : 1 dev senior TS/Postgres dès lettre d'intention signée.
5. **Dossier FINMA-readiness** : les revues d'archi + audit HMAC + RLS + Vault
   = annexe sécurité du dossier commercial. À assembler (2 j).

## 5. Planning global (vue 12 mois)
```
S1─S3    Constitution+marque ▓▓▓ · P0-2 bout-en-bout ▓▓▓  (chemin juridique raccourci — statut purgé le 30.06)
S4─S8    IAM ▓▓ · GED ▓▓ · Screening ▓▓▓
S8─S10   Chiffrement ▓ · Observabilité ▓ · Installeur ▓▓  ──▶ 🎯 PILOTE INSTALLABLE
S10─S16  Pilote en banque (support) + P1 complet ▓▓▓▓▓▓
M5─M9    P2 : Rules → Workflow → Olivia locale → Search → Templates → Studio v1
M10+     P3 : SaaS multi-tenant Exoscale · 2e-5e banque · ISAE 3402
```

## 6. Risques & parades
| Risque | Parade |
|---|---|
| Confidentialité SpeciTec (seul risque juridique restant) | Note clean-room + zéro réutilisation SpeciVIM + démarchage des clients via canaux publics uniquement (art. 6 LCD) |
| Solo = bus factor 1 | Monorepo documenté + CI verte + runbook = reprenable ; recruter dès la LOI |
| Pilote exige une feature démo non industrialisée | Contrat de pilote à périmètre fermé : KYC+GED+Screening+AR, le reste en roadmap |
| Listes officielles (parsing OFAC/SECO) plus dures que prévu | Formats XML/CSV publics stables ; fallback : la base 20 entrées de la démo pour la recette |
| Dérive démo vs produit | La démo reste l'outil de VENTE ; toute feature nouvelle se spécifie désormais côté produit d'abord |
