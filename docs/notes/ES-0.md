# ES-0 — Socle surveillance-es : store, triggers, RLS (gate + écarts)

Référence : `docs/SURVEILLANCE-ES.md` §2-§3, prompt ES-0. Série exécutée **en parallèle**
du playbook principal (L6 clos au moment de ce prompt ; prérequis L1 « signal fiable »
satisfait — CI verte de bout en bout depuis `ca7a59e`).

## Livré

- **Migration `20260807000001_es_socle`** : schéma Postgres dédié `es`, table `es.events`
  (stream_type, stream_id, seq, type, version, payload jsonb, source_event_id, tenant_id uuid,
  at timestamptz), unicité `(stream_type, stream_id, seq)`, index `(tenant_id, at)` et
  `(source_event_id)`. **Triggers** interdisant UPDATE et DELETE (l'erreur vient de la base).
  **RLS** ENABLE + FORCE + policy `tenant_isolation` sur le modèle de `post-deploy-v2.sql`
  (GUC `app.tenant_id`, cast uuid). Le schéma `es` est HORS datamodel Prisma : la gate
  no-drift 0b (`migrate diff`) reste aveugle à `es` — vérifié : « No difference detected ».
- **`modules/surveillance-es/`** : `EsEventStore` (append à verrou optimiste par `expectedSeq`,
  `read` ordonné par seq, `derniereSeq`), accès SQL brut, aucune primitive de mutation exposée,
  aucun état module-global (C8). `SurveillanceEsModule` sans controller.
- **Recette `test/e2e/es-store.e2e-spec.ts`** (ES0-01..06, suite e2e CI étape 4) : aller-retour
  ordonné, conflit de séquence franc, UPDATE **et** DELETE rejetés PAR LA BASE, RLS olive_app
  (0 ligne sans GUC ; tenant seul avec GUC), moindre privilège (olive_app ne peut pas muter).

## Gate ES-0 — verdicts

| Critère | Verdict |
|---|---|
| Toutes specs vertes | ✅ ES0-01..06, 6/6 (suite e2e complète : 63 suites, 417/417) |
| UPDATE manuel en psql échoue sur le trigger | ✅ `ERROR: es.events est append-only … UPDATE interdit` |
| RLS deux tenants, aucune fuite | ✅ ES0-05 (sans GUC : 0 ligne ; avec : jamais l'autre tenant) |

## Écarts au périmètre §4 (assumés, minimaux)

1. **`apps/api/test/e2e/es-store.e2e-spec.ts`** — hors périmètre listé, mais les preuves du
   socle sont par nature côté base (trigger, RLS) et la suite e2e est LEUR seule maison en CI
   (« aucune suite de tests hors CI »). Ramassée automatiquement par le testMatch existant,
   zéro config modifiée.
2. **`.github/workflows/ci.yml`** — le label de l'étape 4 passe de « 62 suites 411/411 » à
   « 63 suites 417/417 » (un label qui ment est une dérive ; l'enforcement reste le code de sortie).
3. **`app.module.ts`** — une ligne d'enregistrement, commit dédié (exception prévue par §4).

## Note grants (pour ES-1+)

`olive_app` reçoit USAGE sur `es` + SELECT/INSERT sur `es.events` — conditionnellement dans la
migration (le rôle peut ne pas exister sur base fraîche : `migrate deploy` précède `prisma:post`)
et idempotemment dans la recette. Au moment de la bascule post-ES-4, ces grants devront rejoindre
le mécanisme de déploiement pérenne (post-deploy) — décision hors périmètre ES, à consigner alors.
