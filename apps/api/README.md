# O-Live — API backend (NestJS + Prisma)

Module KYC durci + **moteur de règles** porté depuis le moteur Python de référence
(`services/workflow-engine-py`, `services/cpsi-server-py`).

## Règles implémentées & câblées

| Règle | Fichier de domaine | Câblage service | Tests |
|---|---|---|---|
| **R2/R4** — visa lié à la personne nommée (+ relais / dérogation) | `rules/named-validator.ts` | `signVisa` (si `KycVisa.validateur` défini) | NV-01..06 |
| **R13/R52** — four-eyes au niveau section (+ finale) | `rules/section-four-eyes.ts` | `signVisa` (R13) · `validate` (R52) | FE-01..06 |
| **R84** — édition exclusive (« la main » / checkout) | `rules/kyc-lock.service.ts` | `takeLock/releaseLock/requestHand/passHand` | CK + LK-01..06 |
| **R85** — passage de main (message obligatoire) | `rules/kyc-handoff.ts` | `handoffNext/Back/Validate/Reject` | HM + HF-01..06 |
| **R86** — visa qualifié (verdict + message) | `rules/qualified-visa.service.ts` | `signVisa` (verdict/message persistés) | VQ + SV-R86 |

Invariant : **rien ne change d'état sans événement tracé** — chaque mutation écrit sa ligne
`domain_events` (outbox transactionnel) + `audit_log` dans la même transaction. Cf.
`docs/OLive-Backend-Schema-Evenements.md`.

## IAM (authentification)

`POST /v1/auth/token` `{ tenant_id, email, password }` → vérifie l'identité (scrypt) et l'état actif,
puis émet un JWT RS256 dont le **rôle est celui du user en base** (jamais un paramètre client —
anti-escalade). `password.ts` (scrypt natif, timing-safe), `auth.service.ts`. **MFA TOTP** (RFC 6238, `totp.ts`) exigée si `User.mfa_enabled`. **RBAC** : guard `@Roles()` (`roles.guard.ts`) appliqué à `validate`. Tests AU-01..09, TP-01..04, RG-01..04.


### Fédération & gestion d'identité (IAM avancé)
- **SSO OIDC** (`oidc.service.ts`) : valide l'id_token IdP (émetteur/audience/exp), mappe les groupes → rôle O-Live, provisionne le user en JIT (l'IdP est source de vérité du rôle). SAML = même flux, adaptateur d'assertion XML. Endpoint `POST /v1/auth/oidc/login`. Tests OI-01..06.
- **Rotation des clés JWT / JWKS** (`key-store.ts`) : trousseau multi-clés (kid), signature avec la clé active, période de grâce pour les anciennes, endpoint `GET /v1/.well-known/jwks.json`. **Câblé de bout en bout** : `AuthService` signe avec la clé active (kid dans l'en-tête) et `TenantMiddleware` résout la clé publique **par kid** — une rotation n'invalide plus les jetons en cours. Tests KS-01..05 · TM-01..07.
- **Provisioning MFA** (`mfa.service.ts`) : `POST /v1/auth/mfa/enroll` → secret + URI `otpauth://` (QR) ; `POST /v1/auth/mfa/confirm` → active après un premier code valide. Tests MF-01..06.
- **API admin users** (`users.service.ts`, `/v1/admin/users/*`, gardée `@Roles("ADMIN")`) : création (hash), liste, activation/désactivation, changement de rôle, reset MFA. Tests AD-01..06.

## Tests

```bash
npm run test:unit    # jest (mock Prisma) — caractérisation
npm run test:rules   # règles moteur + câblage service, harnais autonome SANS base (51 tests)
npm run test:e2e     # intégration supertest sur Postgres jetable (:5433)
```

**e2e** (`test/e2e/kyc-rules.e2e-spec.ts`) : les 6 règles contre l'API réelle (NestFactory + supertest + Postgres jetable, JWT RS256). `npm run test:e2e:setup && npm run test:e2e`.

`test:rules` compile les entités de domaine + le vrai `KycService` avec un faux Prisma en mémoire
et vérifie le flux **requête → règle → exception** de bout en bout (R13/R2/R52/R86/R84/R85).
**51 tests verts** : 29 de domaine + 22 de service.

## Migration (nouveaux champs de ce lot)

`KycLock`, `KycLockRequest`, `KycVisa.validateur/verdict/message`, `KycFile.handoff_phase`, **`User.password_hash` + `active` + `mfa_enabled` + `mfa_secret` (IAM)**.

```bash
npx prisma db push                                   # applique le schéma
npm run prisma:post                                  # RLS + triggers d'immuabilité (post-deploy.sql)
# ou, en mode migrations versionnées :
# npx prisma migrate dev --name r84_r2_r86_r85_iam
```

La RLS des nouvelles tables (`kyc_locks`, `kyc_lock_requests`) est incluse dans `prisma/post-deploy.sql`.

## Endpoints (Headers : `x-tenant-id`, `x-user-id`, `x-user-role`)

`POST /api/v1/kyc` · `GET /api/v1/kyc/:code` · `PATCH …/questions/:qcode` ·
`POST …/:code/visas/:section` (body `verdict`,`message`) · `POST …/:code/validate` ·
`POST …/:code/lock|release|request-hand|pass-hand` (R84) ·
`POST …/:code/handoff/next|back|validate|reject` (body `message`, R85).
