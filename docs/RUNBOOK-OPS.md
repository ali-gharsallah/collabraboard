# O-Live — Runbook OPS (v1 · 19.07.2026)

Procédures d'exploitation. Principe : **rien ne se déclare vert sans run** ; chaque étape a sa
commande et sa preuve attendue.

---

## 1. Démarrage local (dev)

```bash
cd apps/api
cp .env.example .env      # DATABASE_URL · AUDIT_HMAC_SECRET · MFA_ENC_KEY · OIDC_* · OIDC_JWKS_URI
npm i
npm run prisma:migrate && npm run prisma:post   # migrations versionnées (lot 42) + triggers/RLS (post-deploy-v2)
npm run start:dev
```
Secrets **obligatoires au boot** (fail-fast volontaire) : `AUDIT_HMAC_SECRET` (audit sans valeur
probante sinon), `MFA_ENC_KEY` (chiffrement mfa_secret). L'appli refuse de démarrer sans.

## 2. Chaîne de vérification — l'ordre qui fait foi

| Étape | Commande | Preuve attendue |
|---|---|---|
| 1. Lint + types | `npm run lint && npm run typecheck` | 0 erreur — **bloquant en CI** (eslint.config.mjs racine + apps/api/tsconfig.json ajoutés au chantier B) |
| 2. Unitaires | — | **Couverte par `test:rules`** — pas de suite jest unitaire dans le dépôt. Step retiré du CI (`jest` sans config/spec ⇒ « No tests found ») ; à réintroduire **bloquant** le jour où un harnais jest unitaire existe. |
| 3. Règles + IAM + corpus session | `npm run test:rules` | **384 verts** (339 + **Surveillance AML A-69..A-86 / R189→R206 = 45**, lot 48) (+ Surface consultation GED GS-01..05 lot 42 + Adaptateur WebDAV WD-01..05 lot 44 + Adaptateur Claude CL-01..05 R44/R138/R188 lot 45) (… + Licence vendor LC-01..05 R177→R179 + Port GED externe GX-01..05 R180→R182 + Capacité d'équipe WK-01..05 R183→R185 + CRM Relation CR-01..05 R186→R188 depuis le lot 40 ; cf. `docs/verify-run-2026-07-19.txt`) |
| 4. e2e Postgres réel | `npm run test:e2e:setup && npm run test:e2e` | 6/6 — exige le patch `kyc.controller` (guard `validate` retiré, sinon 403≠409) |
| 5. Moteurs Python | `python3 services/workflow-engine-py/run_tests.py` · `…/run_tests_sql.py` · `…/cpsi-server-py/run_tests.py` | 19/19 · SQL vert · **18/18** (⚠ faux-vert CPSI : ajouter `sys.exit(0 if total_ok==len(mods) else 1)` — la CI a une garde grep en attendant) |
| 6. Démo | `npm run test:smoke` (73 écrans) + onglet Screening → « 🧪 Preuves moteur » → Tout rejouer | 73/73 · 16/16 verts — **hors CI** : exige Playwright + navigateurs (hors scope CI actuel). Step retiré du workflow, même doctrine que test:unit ; à réintroduire bloquant quand l'environnement navigateurs sera provisionné. |

`verify:all` enchaîne 1→4. La CI (`.github/workflows/ci.yml`) rejoue le tout, `prisma:post`
inclus — les triggers R48 sont enfin exercés en continu. **Tous les steps CI sont bloquants**
(plus aucun advisory) : lint + typecheck, `prisma:post`, `test:rules` (384), e2e (6/6),
recette RLS, moteurs Python (19/19 · SQL 11/11 · CPSI 18/18). Hors CI : démo Playwright (étape 6).

> **CONFORMITÉ (lot 41, 21.07.2026)** — Lot d'arbitrage, **aucune règle nouvelle, harnais INCHANGÉ à 324**.
> Le modèle s'aligne sur les services ratifiés : `DomainEvent.at` devient un champ réel (les services
> l'écrivaient déjà), `DomainEvent.aggregateId` perd `@db.Uuid` (codes métier prouvés par les corpus,
> ex. R182/R183), `Document.expireAt` ajouté (active le signal R187 « pièce expirante », jusqu'ici
> dormant). Erratum E1 : `crm.service`/`crm.wiring.spec` alignés sur `Client.rmUserId` (comportement
> inchangé, CR 5/5). Non traités (backlog reconnu, lots dédiés) : surface GED `lister`/`lire`, typage `tx:any`.

> **CÂBLAGE (lot 43, 21.07.2026)** — Lot de **pur câblage DI, aucune règle, aucun test nouveau, harnais INCHANGÉ à 329**.
> `GedModule` (nouveau) câble les services GED par **`useFactory`** — les services à **ports optionnels** (`ports = {}` : ingestion, avancé, coffre, resolver) ne passent pas la résolution auto de Nest, la factory appelle le constructeur avec les ports vides (= comportement ratifié). `app.module` importe `GedModule`. **Boot RÉEL vérifié** : la DI résout (aucune erreur), `GET /v1/ged/documents` → 200 (filtré au registre : CO voit, INTRUS `[]` — R110), `GET /v1/ged/documents/<uuid-inexistant>` → 404. `ged.controller` : dépendance MORTE `GedService` retirée (aucun endpoint ne l'appelait) — aucun service modifié.

> **CÂBLAGE (lot 46, 21.07.2026)** — Trois portes HTTP minces (**délégation pure**, harnais INCHANGÉ à 339, aucun test nouveau) : `ParametresModule` (`GET /parametres/registre`, `GET`/`POST /parametres/valeur/:cle`), `CrmModule` (`timeline`/`gestes`/`pre-remplir`/`entretiens` — **sans port IA** : `pre-remplir` refuse R138), `WorkloadModule` (`equipes`/`mesures`/`surcharges`/`reassigner`/`points`/`snapshot-rh`) — importés par `app.module`, providers par `useFactory` (pattern lot 43). **Refus, motifs et traces vivent aux SERVICES**, pas aux controllers. **Boot RÉEL vérifié** : registre→200 (40 clés) · POST paramètre sans motif→400 (R7/R126) · timeline client inconnu→404 · pre-remplir sans clé→400 « port » (R138) · workload équipe par un non-responsable→403 (R183). **Aucun service modifié.**

> **BLOC 48 — Surveillance AML (22.07.2026, R189→R206, A-69..A-86)** — ⚠ **Provenance singulière** : le zip ne livrait NI service NI test ratifié (seulement un `.feature` + un catalogue de doc). Implémentation + tests **écrits depuis le Gherkin**, sur **exception ratifiée par Ali** à la doctrine « canon d'abord ». Ces tests valent ce que vaut le Gherkin — ils ne remplacent pas un corpus ratifié. Nouveau module `aml/` : `AmlScoringEngine` (18 détecteurs PURS R189→R206), `AmlService` (persistance append-only tenant-scopée, auteur = jeton, blocage niveau 1 sanctions/HRI/CRS), porte HTTP `POST /aml/evaluer` + `GET /aml/clients/:id/signaux`. Modèle `AmlSignal` (RLS FORCE + immuabilité). Seuils = **registre R-Q** (20 clés `aml*`, R7/R125) — l'onglet React « Paramétrages AML » n'est qu'une vue filtrée. Harnais **339 → 384** (+45). Boot RÉEL vérifié : sanctions→`bloque:true` signé jeton · structuring→signal N2 · GET signaux tenant-scopé. Recette RLS : `aml_signals` 0 ligne sans GUC, UPDATE refusé. Baseline migration régénérée (+`aml_signals`). Erratum **E3** séparé : dates relatives du spec vendor-license (base rétablie 339 avant travaux). *(NB : `apps/web` hors périmètre CI — l'onglet est vérifié par `vite build` local.)*

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
5. **Adaptateurs réels (lot 43)** : l'injection des ports de production — coffre S3 suisse
   (Exoscale SOS), GED externe (CMIS/WebDAV) — se fait en **remplaçant les factories du
   `GedModule`** (`useFactory`), **jamais** les services (dont le comportement est ratifié et testé).
6. **Bascule WebDAV (lot 44)** : (a) renseigner `WEBDAV_*` ; (b) remplacer la factory
   `StorageResolverService` du `GedModule` par `new StorageResolverService(p, { GED_EXTERNE:
   new WebDavStorageAdapter({...}) })` ; (c) basculer le registre `docStorage` du tenant sur
   `GED_EXTERNE` — **acte motivé** (R7/R181, jamais rétroactif) ; (d) recette : un **dépôt →
   relecture sonde** (le coffre recalcule l'empreinte R145 ; falsification côté GED → refus
   explicite, panne → refus explicite). Le mot de passe ne voyage qu'en en-tête, jamais journalisé.
7. **Port IA réel — adaptateur Claude (lot 45)** : **sans `ANTHROPIC_API_KEY`, PAS de port** —
   la factory `claudeIaAdapter()` refuse explicitement (R138) ; l'appel eager du câblage est **gardé**
   (`ia: process.env.ANTHROPIC_API_KEY ? claudeIaAdapter() : undefined`), donc l'app **démarre** et les
   fonctions assistées (pré-revue R44, complétion, pré-remplissage CRM R188) **refusent proprement à
   l'appel**. Avec clé : injection aux modules par factories (pattern lot 43) ; le secret ne voyage qu'en
   en-tête `x-api-key`, jamais dans l'URL ni un message d'erreur (masqué).

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

## 7. Migrations versionnées (bascule lot 42, 21.07.2026)

Le dépôt fonctionnait en `prisma db push` (schéma poussé, aucun historique). **Depuis le lot 42,
le schéma est versionné par migrations Prisma** — `db push` ne sert plus qu'en sandbox jetable.

- **Baseline** : `prisma/migrations/0_baseline_lot42/migration.sql` fige l'état complet du schéma
  (48 tables/enums) à la bascule. Générée par `prisma migrate diff --from-empty
  --to-schema-datamodel prisma/schema.prisma --script`.
- **Toute évolution de schéma désormais** : `npm run prisma:migrate` (`prisma migrate dev -n <nom>`)
  — **jamais** `db push` hors sandbox. La migration est commitée avec le changement de `schema.prisma`.
- **Déploiement / CI** : `prisma migrate deploy` (remplace `db push` dans `ci.yml`), puis `prisma:post`
  (triggers R48 + RLS FORCE, hors périmètre migrations). Vérifié : `migrate reset`/`deploy` rejoue la
  baseline, e2e 6/6, recette RLS `clients` → 0 ligne sans GUC.
- **Base existante déjà poussée par `db push`** (sans `_prisma_migrations`) : marquer la baseline
  appliquée une fois — `prisma migrate resolve --applied 0_baseline_lot42` — puis basculer sur `deploy`.
