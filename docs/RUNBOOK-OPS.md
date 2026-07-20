# O-Live — Runbook OPS (v1 · 19.07.2026)

Procédures d'exploitation. Principe : **rien ne se déclare vert sans run** ; chaque étape a sa
commande et sa preuve attendue.

---

## 1. Démarrage local (dev)

```bash
cd apps/api
cp .env.example .env      # DATABASE_URL · AUDIT_HMAC_SECRET · MFA_ENC_KEY · OIDC_* · OIDC_JWKS_URI
npm i
npm run prisma:push && npm run prisma:post      # schéma + triggers + RLS (post-deploy-v2)
npm run start:dev
```
Secrets **obligatoires au boot** (fail-fast volontaire) : `AUDIT_HMAC_SECRET` (audit sans valeur
probante sinon), `MFA_ENC_KEY` (chiffrement mfa_secret). L'appli refuse de démarrer sans.

## 2. Chaîne de vérification — l'ordre qui fait foi

| Étape | Commande | Preuve attendue |
|---|---|---|
| 1. Lint + types | `npm run lint && npm run typecheck` | 0 erreur — **bloquant en CI** (eslint.config.mjs racine + apps/api/tsconfig.json ajoutés au chantier B) |
| 2. Unitaires | — | **Couverte par `test:rules`** — pas de suite jest unitaire dans le dépôt. Step retiré du CI (`jest` sans config/spec ⇒ « No tests found ») ; à réintroduire **bloquant** le jour où un harnais jest unitaire existe. |
| 3. Règles + IAM + corpus session | `npm run test:rules` | **268 verts** (… + Recherche RS-01..06 R148→R151 + Personnes liées PL-01..04 R152→R155 + Annotations AN-01..06 R156→R159 + Chaînes de câblage CB-01..06 (clauses R144/R148/R151) depuis le lot 30 ; cf. `docs/verify-run-2026-07-19.txt`) |
| 4. e2e Postgres réel | `npm run test:e2e:setup && npm run test:e2e` | 6/6 — exige le patch `kyc.controller` (guard `validate` retiré, sinon 403≠409) |
| 5. Moteurs Python | `python3 services/workflow-engine-py/run_tests.py` · `…/run_tests_sql.py` · `…/cpsi-server-py/run_tests.py` | 19/19 · SQL vert · **18/18** (⚠ faux-vert CPSI : ajouter `sys.exit(0 if total_ok==len(mods) else 1)` — la CI a une garde grep en attendant) |
| 6. Démo | `npm run test:smoke` (73 écrans) + onglet Screening → « 🧪 Preuves moteur » → Tout rejouer | 73/73 · 16/16 verts — **hors CI** : exige Playwright + navigateurs (hors scope CI actuel). Step retiré du workflow, même doctrine que test:unit ; à réintroduire bloquant quand l'environnement navigateurs sera provisionné. |

`verify:all` enchaîne 1→4. La CI (`.github/workflows/ci.yml`) rejoue le tout, `prisma:post`
inclus — les triggers R48 sont enfin exercés en continu. **Tous les steps CI sont bloquants**
(plus aucun advisory) : lint + typecheck, `prisma:post`, `test:rules` (268), e2e (6/6),
recette RLS, moteurs Python (19/19 · SQL 11/11 · CPSI 18/18). Hors CI : démo Playwright (étape 6).

> **RÉSOLU (chantier « alignement Document », 20.07.2026)** : le modèle `Document`/`DocumentVersion`
> est désormais aligné sur le contrat GED R109→R116 + R137→R139 — champ Prisma = contrat
> (`statut`, `nom`) avec `@map` conservant les colonnes v0.2 (migration douce), `clientId`/`retentionUntil`
> nullable, ajout `ingereAt`/`inboxSignale`/`ocrDerives`, champs v0.2 hors contrat (`s3Key`,`code`,`lang`,
> `sizeBytes`,`uploadedBy`) conservés en nullable. **Preuve de fin : le pont `as any` du bloc 24 est
> retiré et le typecheck reste vert.** Migration des données `A_VALIDER → ACTIF` (mapping ratifié Ali,
> idempotente : `prisma/data-migration-document-statut.sql`).

## 3. Déploiement — ordre impératif

1. **Migrations** : `prisma migrate deploy` puis `prisma:post` (**post-deploy-v2.sql** : immuabilité
   append-only sur les 5 journaux, garde outbox « seul published_at mutable », RLS **FORCE** + policies).
2. **Bascule RLS en 2 temps, sans interruption** :
   T1 — exécuter le SQL (l'appli, en propriétaire, bypasse encore : rien ne change) ;
   T2 — basculer `DATABASE_URL` sur le rôle **olive_app** (non-propriétaire) + activer
   `PrismaService.forTenant` (SET LOCAL `app.tenant_id`). Test de recette : en `olive_app` sans
   `set_config`, `SELECT * FROM clients` → **0 ligne**.
3. **Rotation de clés JWT** : `KeyStore.rotate()` — période de grâce 3 clés, les sessions en cours
   survivent (résolution par kid via `/.well-known/jwks.json`).
4. **SSO** : renseigner `OIDC_JWKS_URI` — `verifyIdToken` est branché sur le JWKS réel de l'IdP
   depuis le 19.07 (JV-01..07) ; sans la variable, le login OIDC refuse proprement.

## 4. Incidents — chemins courts

| Symptôme | Cause probable | Geste |
|---|---|---|
| Boot refuse : `AUDIT_HMAC_SECRET manquant` / `MFA_ENC_KEY` | secret absent | poser la variable — ne PAS contourner le fail-fast |
| e2e `validate` rend 403 au lieu de 409 | patch guard non appliqué | appliquer `kyc.controller.PATCHED.ts` |
| Login MFA échoue après déploiement chiffrement | — | impossible par conception : `SecretBox.open` fait passthrough des secrets legacy (SB-05) ; si ça arrive, vérifier `MFA_ENC_KEY` identique entre instances |
| `append-only: UPDATE interdit sur …` | tentative de mutation d'un journal | c'est le trigger R48 qui fait son travail — corriger l'appelant, jamais le trigger |
| Jeton OIDC rejeté « kid inconnu » | rotation IdP + cache | le vérificateur re-fetch une fois tout seul (JV-04) ; si persistant : `OIDC_JWKS_URI` erroné |
| SELECT rend 0 ligne partout après bascule T2 | `forTenant` non routé (GUC jamais posé) | vérifier que les requêtes passent par `forTenant` ; rollback = repasser au rôle propriétaire (T1) |
| CI verte mais CPSI rouge dans les logs | faux-vert du runner | appliquer le `sys.exit` d'une ligne ; la garde grep `### 18/18 suites vertes ###` est le filet |

## 5. Sauvegarde & preuve réglementaire

- Les journaux (`audit_log`, `kyc_question_history`, `screening_runs`, `screening_qualifications`,
  `domain_events`) sont **append-only sous trigger** : la sauvegarde est la seule voie de purge,
  jamais un DELETE.
- Réponse à l'inspecteur « cette inscription a-t-elle été confrontée à votre base ? » :
  `GET /v1/screening/runs` — périmètre, version de liste, seuil, pré-filtre, horodatage (R103),
  lisible sans reconstruction.

## 6. Activation du coffre Exoscale (R144→R147)

Le coffre (`CoffreService`) est **débranché par défaut** : sans port de stockage, tout dépôt est
refusé explicitement (R144 — « pas de dépôt fantôme »). L'adaptateur de production
`s3-storage.adapter.ts` (Exoscale SOS, S3-compatible, résidence suisse) est **exclu du typecheck**
(il dépend de `@aws-sdk/client-s3`, hors périmètre du corpus) ; il se câble à l'activation.

**Prérequis** :
1. Installer le SDK au déploiement : `pnpm --filter @olive/api add @aws-sdk/client-s3` et retirer
   l'exclusion `src/modules/coffre/s3-storage.adapter.ts` de `apps/api/tsconfig.json`.
2. Variables d'environnement (secrets) : `EXOSCALE_SOS_KEY`, `EXOSCALE_SOS_SECRET`,
   `EXOSCALE_SOS_BUCKET`. Sans elles, `exoscaleStoragePort()` **refuse au boot** (fail-fast R144).
3. Région : servie par le **registre R-Q** `storageRegion` (défaut `ch-gva-2`) — engagement de
   résidence contractuel, jamais en dur. Chiffrement par tenant : `storageChiffrement`.

**Câblage** (verbatim) :
```ts
new CoffreService(prisma, audit, { storage: exoscaleStoragePort() })
```

**Recette de bascule** (par tenant, jamais global) :
- (a) **Activer sur un tenant de test** : poser `storageRegion` (R-Q) + les env Exoscale, câbler le port.
- (b) **Dépôt / lecture / altération** : `ecrire(ctx, versionId, contenu)` (empreinte R111 vérifiée
  au dépôt) ; `lire` recalcule l'empreinte AVANT de servir ; **altérer volontairement l'objet au
  bucket** puis relire → **R145 refuse** (« intégrité du coffre en défaut — contenu NON servi »)
  et émet `coffre.integrite.alerte`. Le contenu altéré ne sort jamais.
- (c) **Réconciliation R147 à vide** : `reconcilier(ctx)` sur un tenant cohérent base↔coffre
  → **aucun** événement `coffre.reconciliation.orphelin` ni `…manquant`. Un écart d'inventaire est
  un FAIT D'AUDIT (orphelin → alerte ; manquant → CRITIQUE + tâche, une fois) — jamais de ménage
  automatique (R39/R147). La purge n'existe qu'en destruction certifiée R115 (l'empreinte survit).
