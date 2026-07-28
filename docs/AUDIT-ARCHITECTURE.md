# AUDIT ARCHITECTURE & SCALABILITÉ — O-Live (apps/api + apps/web)

> **Statut d'application (branche `claude/audit-architecture`)** — A1 ✅ (PrismaModule @Global) · A5 ✅ (N+1 BusinessTrip batché) · A4 ✅ (pagination keyset bornée) · A2 ✅ (sources uniques emit/settings/visibilité) · A6 ✅ (code-splitting 252→152 KB) · A3 ◻︎ amorcé (alias `Tx` + 4 helpers + 3 modules ; sweep incrémental en cours). Tous behavior-preserving : e2e 85/85, harness 425/425, Vitest 13/13, tsc 0, lint 0.**


**Date : 2026-07-27.** Audit **en lecture seule** — aucune fonctionnalité modifiée, aucun refactor
appliqué. Réalisé dans l'esprit des cinq personas d'ingénierie fournis (reverse-engineering,
debug root-cause, performance, clean-architecture). **Portée & garde-fou** : le backend est un
**canon ratifié** (comportement gelé, suite verte : e2e **84** · harnais **425** · Vitest **13**).
Cet audit **diagnostique** ; toute correction éventuelle devra être **behavior-preserving** et
prouvée par la suite existante. Les prompts « build from scratch » et « rebuild folder structure »
**ne s'appliquent pas** : l'application existe, est correcte et CI-verte — la réécrire détruirait
les invariants (RLS, append-only, four-eyes, rejeu à date) qui sont la valeur du produit.

---

## 0. Ce qui est déjà sain (à préserver tel quel)

- **Isolation multi-tenant réelle** : RLS `FORCE` + policy `tenant_id = current_setting('app.tenant_id')`
  sur toutes les tables tenantées (recette : `olive_app` 0 ligne sans GUC). Rôle non-propriétaire.
- **Invariants append-only** par triggers Postgres (`audit_immutable`) sur les journaux (events, visas,
  signaux AML/Shariah, attestations…). Le rejeu à date (R48/R49) rejoue les événements.
- **Auteur = jeton** (`ctx.userId`) jamais le corps ; four-eyes (R13) ; refus motivés (R7).
- **Spec-first** : chaque domaine a son Gherkin ratifié + FAT e2e contre Postgres réel.
- **Frontière de sortie réseau unique** côté front (`src/lib/api.ts`), mode démo signalé.

Aucun de ces points ne doit être « nettoyé » : ils sont le moat.

---

## 1. Constats priorisés (preuves à l'appui)

### A1 — Connexions Prisma : ~16 clients au lieu d'un seul · **HAUT (scalabilité)**
**Fait.** Chaque module câble `PrismaService` par `useFactory: (p) => new XxxService(p, …)` avec
`PrismaService` déclaré **provider local** — soit **~16 `PrismaClient`** distincts, **chacun son pool
de connexions**. `PrismaService.onModuleInit(){$connect()}` / `onModuleDestroy(){$disconnect()}`
(`apps/api/src/common/prisma.service.ts:6,10`) sont corrects, mais multipliés par le nombre de modules.

**Root cause (persona debug).** C'est l'origine réelle de l'incident « too many clients » rencontré en
lot e2e (5 suites × ~18 clients). Le correctif posé — `connection_limit=3` dans `DATABASE_URL`
(`apps/api/.env`) — **plafonne les dégâts, ne les supprime pas** : 16 pools × N tenants × réplicas
montent vite au plafond Postgres (100). Debt déjà consignée au RUNBOOK : « un `PrismaModule` @Global
(client unique) reste le correctif d'architecture — lot dédié ».

**Impact à l'échelle.** Ne passe pas « des millions d'utilisateurs » : les connexions DB sont la
ressource la plus rare ; 16× le besoin réel est un plafond structurel + gaspillage mémoire.

**Stratégie (behavior-preserving).** Un `PrismaModule` `@Global` exposant **un** `PrismaService`
partagé ; retirer `PrismaService` des providers locaux, laisser l'injection le résoudre. ~16 fichiers
`*.module.ts` touchés, **zéro changement de comportement** — prouvé par e2e 84 + recette RLS
(l'isolation est applicative + RLS, indépendante du nombre de clients). Contenu, rentable, réversible.

### A4 — Listes sans pagination · **HAUT (perf à l'échelle)**
**Fait.** ~90 `findMany` sans `take/skip/cursor`. Les portes de liste récentes retournent **tout le
tenant** : `tasks.module.ts:94` (`task.findMany`), `businesstrip.module.ts:165` (`trip.findMany`),
`nba.module.ts:49` (`nbaSuggestion.findMany`), `workflow-instances` (kycFile.findMany). La spec v2
exigeait la **virtualisation ≥100 lignes** côté front — non faite.

**Impact.** Un tenant à 10⁵ tâches/voyages → scan + payload non bornés à chaque `GET`. Latence et
mémoire linéaires au volume.

**Stratégie.** Ajouter `?limit=&cursor=` (keyset sur `createdAt,id`) aux portes de liste **nouvelles**
(tasks/trips/nba/workflow-instances) — additif, défaut borné, aucun contrat cassé. Front : virtualiser
les tables (react-window) au-delà d'un seuil. Behavior-preserving (mêmes lignes, paginées).

### A5 — Requêtes N+1 dans l'instruction · **MOYEN (perf)**
**Fait.** `businesstrip.instruire` : `kycFile.findFirst` **par client visité** (`businesstrip.module.ts:59`)
+ `certification.findMany` **par destination** (`:65`). `formations`/`tasks` résolvent les membres
d'équipe par requête à chaque listing.

**Stratégie.** Regrouper : un `kycFile.findMany({where:{clientId:{in:[...]}}})` + agrégation en mémoire ;
idem certifications (`code:{in}`). Aucun changement de résultat, moins d'allers-retours DB.

### A2 — Duplication : `emit()` (×35), `settings(ctx)` (×16), visibilité d'équipe (×2) · **MOYEN (maintenabilité)**
**Fait.** Le helper d'événement `domainEvent.create({tenantId,type,aggregateId,payload,at})` est
**réécrit à l'identique** dans 35 services (`risk-case`, `mros`, `pms`, `coffre`, `crm`, `personnes`,
`core-sync`, `tasks`, `businesstrip`, `nba`…). Le lecteur `tenant.findFirst({where:{id:ctx.tenantId}})`
est dupliqué ×16. La logique « voit-tout + responsable → équipe » est copiée entre `formations` et `tasks`.

**Risque.** Une correction (ex. ajouter un champ d'événement, changer la source d'horloge) doit être
faite 35 fois — dérive garantie. Pas un bug aujourd'hui, une **dette de cohérence**.

**Stratégie.** Extraire `DomainEventService.emit(tx, …)`, `TenantSettingsService.get(ctx)`, et un
`VisibilityService.scope(ctx, settings)` partagés ; les services les injectent. **Aucun changement de
comportement** (mêmes écritures) ; suite verte = équivalence prouvée.

### A3 — Typage : 512 `: any` dans les services · **MOYEN (maintenabilité)**
**Fait.** `tx: any` (transactions Prisma interactives), casts de `payload`/`settings`. Concentré
exactement là où vivent les invariants (audit, montants, visas). Debt déjà signalée (lot 41 : « typage
`tx:any` » au backlog).

**Stratégie.** Typer `tx` via `Prisma.TransactionClient` ; typer `settings` par un schéma (zod) ;
`payload` d'événement par une union discriminée. Incrémental, fichier par fichier, sans toucher la logique.

### A6 — Front : bundle unique 252 KB, routeur monolithique, pas de virtualisation · **MOYEN (perf front)**
**Fait.** `dist/assets/index-*.js` = **252 KB** en **un seul chunk** ; `app/router.tsx` (90 lignes) =
un `switch` avec **35 imports eager** ; aucune liste virtualisée (contra spec v2). Styles inline encore
majoritaires (migration `theme/tokens.ts` en cours, règle boy-scout A1/D3).

**Stratégie.** `React.lazy` + `Suspense` par écran (code-splitting) ; virtualisation des tables ;
poursuivre la migration tokens au fil des écrans touchés (déjà la doctrine). Behavior-preserving.

---

## 2. Tableau de priorisation

| # | Constat | Sévérité | Effort | Behavior-preserving ? | Prouvé par |
|---|---|---|---|---|---|
| **A1** | Prisma @Global (1 client) | Haut (scale) | Faible (~16 fichiers) | Oui | e2e 84 + recette RLS |
| **A4** | Pagination des listes | Haut (perf) | Moyen | Oui (additif) | e2e + nouveaux tests limite |
| **A5** | N+1 instruction | Moyen | Faible | Oui | e2e (mêmes assertions) |
| **A2** | Helpers partagés (emit/settings/visibilité) | Moyen | Moyen (~40 fichiers) | Oui | e2e 84 + harnais 425 |
| **A3** | Typage `tx`/payload/settings | Moyen | Élevé (incrémental) | Oui | typecheck + e2e |
| **A6** | Code-splitting + virtualisation front | Moyen | Moyen | Oui | vite build + Vitest |

**Ordre recommandé** : A1 → A5 → A4 → A2 → A6 → A3. A1 est le meilleur rapport valeur/risque
(le plus contenu, le plus impactant à l'échelle, déjà identifié comme dette intentionnelle).

---

## 3. Ce que l'audit NE recommande PAS

- **Réécriture « from scratch » / refonte de l'arborescence** : détruirait les invariants ratifiés et
  la valeur probante des 84 e2e. Interdit par la doctrine du projet.
- **Toucher le moteur workflow (R1–R51)** ou tout service ratifié pour « améliorer » sa logique : le
  comportement est gelé ; seules des extractions/optimisations **iso-fonctionnelles** sont admissibles.
- **Changer les invariants** (RLS, append-only, four-eyes, rejeu à date) : ce sont des exigences, pas
  de la dette.

---

## 4. Écarts déjà connus (rappel, hors de cet audit)

- **GED fiche** : `ged-consultation.fiche` mappe `no/empreinte/creeAt` alors que le modèle porte
  `numero/sha256/deposeAt` (le fake ratifié masque l'écart au harnais). Correctif = canon → hors périmètre, signalé.
- **`PersonneLienService` (R152→R155) dormant** (aucun modèle `Personne`).
- **Vocabulaire statut Task** (OPEN/COMPLETED/CANCELLED ↔ OUVERTE/FAITE/ANNULEE) — mapping DTO assumé (V16).

---

*Conclusion. Le produit est correct et cohérent ; la dette est de **scalabilité** (A1, A4) et de
**cohérence** (A2, A3), pas de correction. La priorité « millions d'utilisateurs » se joue sur A1 puis
A4. Chaque correction reste optionnelle et devra prouver son iso-fonctionnalité par la suite verte.*
