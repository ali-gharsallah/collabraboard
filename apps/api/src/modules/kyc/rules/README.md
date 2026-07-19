# Règles moteur portées côté backend — R84 / R85 / R86

Port fidèle du moteur Python de référence (`services/cpsi-server-py/olive_cpsi/`)
vers NestJS/TypeScript. **Logique de domaine pure, testée avant tout câblage DB.**

| Règle | Fichier | Sémantique |
|------|---------|-----------|
| **R84** | `kyc-lock.service.ts` (`@Injectable`) — **câblé** (méthodes `takeLock/releaseLock/requestHand/passHand` + endpoints, persistance `kyc_locks`/`kyc_lock_requests` + événements outbox) | Édition exclusive (« la main » / checkout) : prendre / libérer / demander / passer la main. Un seul détenteur ; consultation bloquée sinon ; demandes tracées (R48/R49). |
| **R85** | `kyc-handoff.ts` (entité de domaine) — **câblé** (méthodes `handoffNext/Back/Validate/Reject` + endpoints, phase persistée sur `kyc_files.handoff_phase` + événements) | Passage de main section par section, **message obligatoire** ; valider/rejeter à la section de validation (motif obligatoire, R7). |
| **R2/R4** | `named-validator.ts` (entité de domaine) | Visa lié à une **personne nommée** : seul le validateur nommé résolu peut signer (R2) ; un **relais nommé** le remplace s'il est absent (R4) ; un tiers ne signe que sous **dérogation tracée** (décideur + fiche de poste, R4). Câblé dans `kyc.service.ts` (`signVisa`, si `KycVisa.validateur` défini). |
| **R13/R52** | `section-four-eyes.ts` (entité de domaine) | Exclusion 4-yeux au **niveau section** : toucher un champ fait de vous un « préparateur », exclu du visa de sa section (exclusion **limitée**, V-03). Sur l'étape finale, **tout** contributeur du dossier est exclu (R52). Câblé dans `kyc.service.ts` (`signVisa` → R13 via `KycQuestionHistory`, `validate` → R52). |
| **R86** | `qualified-visa.service.ts` (`@Injectable`) — **câblé dans `signVisa`** (verdict+message validés, persistés sur `KycVisa`) | Visa qualifié : verdict OK / CONDITIONAL / NOK + message. NOK et CONDITIONAL **exigent un message** ; NOK **bloquant** ; retrait par le seul signataire. Étend le visa uniforme R15. |

Invariant respecté : rien ne change d'état sans événement tracé.

## Tests (miroir des suites Python CPSI bloc 16/17/18)
`rules.spec.ts` couvre **CK-01..05**, **HM-01..06**, **VQ-01..06** (R84/85/86) ; `four-eyes.spec.ts` couvre **FE-01..06** (R13/R52) ; `named-validator.spec.ts` couvre **NV-01..06** (R2/R4) — **29 cas de domaine**.

**Test de service** (`kyc-service.spec.ts`, 22 cas) : instancie le vrai `KycService` avec un faux Prisma en mémoire et vérifie le câblage R13/R2/R52 **+ R86 (verdict) + R84 (verrou : prendre/libérer/demander/passer)** de bout en bout (requête → règle → exception), sans base. **51 tests verts au total.**
Harnais autonome (sans Jest) — compilé par `tsc`, exécuté par `node` :

```bash
tsc src/modules/kyc/rules/*.ts --target es2020 --module commonjs \
  --experimentalDecorators --emitDecoratorMetadata --skipLibCheck --strict --outDir dist-rules
node dist-rules/rules.spec.js        # → "R84/R85/R86 — 17/17 tests verts"
```

## Reste (câblage, non fait ici pour préserver la fonctionnalité existante)
- Schéma étendu : `KycVisa.validateur` (R2), `KycVisa.verdict`/`message` (R86) — migration à générer.
- Persistance restante : verrous → table `KycLock` (advisory lock / RLS) ; verdict+message → colonnes sur `KycVisa` ; handoff → état workflow sur `KycFile`.
- Endpoints contrôleur : `POST /kyc/:id/lock|release|request-hand|pass-hand`, `POST /kyc/:id/handoff/{next,back,validate,reject}`, `POST /kyc/:id/visa` (verdict+message).
- Émission `DomainEvent` + `AuditLog` sur chaque action (les services journalisent déjà en mémoire ; brancher sur `AuditService`/outbox).
