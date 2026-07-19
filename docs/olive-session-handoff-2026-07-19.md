# O-Live — Journal de session & handoff · 2026-07-19

> **À lire avant toute reprise.** La source de vérité est le **dépôt + la matrice de traçabilité +
> le catalogue v4.x**, PAS la mémoire de l'assistant. Cette session a démarré sur une mémoire
> périmée (« R13 à implémenter, tests rouges ») qui était **fausse** : R13 est fait et vert depuis
> le 12.07. Vérifier le code qui tourne avant d'ordonnancer quoi que ce soit.

Base auditée : `olive-mvp-production.zip` (état au 15.07), spécs `spec/…v2.1/v4.0.docx`, matrice
`OLive-Matrice-Tracabilite-Regles.md`, catalogues ratifiés R89-R99 et R100-R103.

---

## 1. Correction d'état — ce qui est FAIT (et que la mémoire croyait à faire)

| Domaine | Statut réel (vérifié sur code) |
|---|---|
| **R13** four-eyes section + **R52** contributeur exclu finale | `apps/api/src/modules/kyc/rules/section-four-eyes.ts` — port fidèle de `workflow-engine-py/olive_engine/domain.py`. Unit (`four-eyes.spec.ts`) + e2e. Vert. |
| **R2/R4** validateur nommé · **R84** lock · **R85** handoff · **R86** visa qualifié | Implémentés, testés (matrice §2). |
| **IAM** (MOD-30) | 47 tests, R89-R92 (I-01..I-05). |
| **Screening** R100-R103 | `apps/api/src/modules/screening/` + `services/cpsi-server-py` — 4/4 SC verts. |
| Backend total | **107 verts** (103 `test:rules` + 4 screening) ; démo **B-01..B-07** verts. |

Le bloc « Session 3 : R13→R15 » de la mémoire est **clos**. Ne pas le rouvrir.

---

## 2. Pré-vol e2e (6 tests, `test/e2e/kyc-rules.e2e-spec.ts`) — 1 bloqueur

Les 6 e2e étaient écrits mais **jamais exécutés** (exigent un Postgres réel). Audit statique complet
avant premier run :

- **BLOQUEUR (corrigé) — le guard RBAC masque le four-eyes sur `validate`.** L'endpoint porte
  `@UseGuards(RolesGuard) @Roles("CO_SR","MLRO","DIR","ADMIN")`. Un guard s'exécute avant le handler :
  le créateur RM reçoit **403** (rôle) alors que le test R52 attend **409** (« Four-eyes »). C'est très
  probablement pourquoi ces e2e n'ont jamais été verts. **Correctif** : retirer le guard de ce seul
  endpoint — le service `KycService.validate` contrôle déjà le rôle, APRÈS four-eyes/R52. Voir
  `kyc.controller.PATCHED.ts` (livré). Les 5 autres tests et les 2 autres assertions R52 passent.
- **Faits de setup** (pas des bugs) : `npm run test:e2e:setup` cité dans l'en-tête du test **n'existe
  pas** dans `apps/api/package.json` ; pas de `docker-compose.test.yml` dans le zip. Le chemin réel est
  **la CI** (`.github/workflows/ci.yml` : service Postgres `:5433`, `prisma:push && test:e2e`).

### Écarts de conformité (tests verts, mais claim à nuancer)
1. **RLS inerte.** `post-deploy.sql` fait `ENABLE` (pas `FORCE`) ; l'utilisateur `olive` possède les
   tables → bypass RLS ; le GUC `app.tenant_id` n'est **jamais** posé (`PrismaService.forTenant()` est
   un no-op). Seul le `where: { tenantId }` applicatif isole. La matrice §1 (« isolation au niveau
   moteur ») est aspirationnelle. Pour la rendre vraie : `FORCE RLS` + `SET LOCAL app.tenant_id` par
   transaction, ou rôle non-propriétaire.
2. **`prisma:post` jamais lancé en CI** (`prisma:push && test:e2e` seulement) → les triggers
   d'immuabilité append-only (R48) ne sont créés dans aucun run automatisé. Le code existe, rien ne
   prouve qu'il se déclenche.

---

## 2bis. Pré-vol des suites branchées en CI (audit du 19.07, avant premier run)

Les ~200 tests que `ci.PATCHED.yml` ajoute (test:rules 103 + CPSI 97) ont été audités statiquement
avant leur premier run réel :

- **`test:rules` — CI-safe, aucun ajustement.** Le harnais bash `run-rule-tests.sh` compile avec
  `tsc` et exécute en `node`. Vérifié : **aucun VALUE-import de `@prisma/client`** dans les fichiers
  compilés (seul `kyc.templates.ts` importe `Role`/`AccessRight` en position *type* → élidés à la
  compilation). Donc **pas besoin de `prisma generate`** avant `test:rules`. RAS.
- **CPSI — portable, mais FAUX-VERT à corriger.** Les tests n'importent que stdlib + `olive_cpsi`
  (local) + le shim `pytest.py` vendu dans le dossier → tournent sous le `python3` de la CI sans pip.
  **MAIS `services/cpsi-server-py/run_tests.py` ne fait PAS `sys.exit()`** : il imprime les échecs et
  rend malgré tout **code 0**. Branché tel quel, la CI serait **verte même avec des tests rouges** —
  le pire cas. Les deux autres runners (`workflow-engine-py/run_tests.py` et `run_tests_sql.py`)
  sortent bien en non-zéro ; seul le CPSI est troué.

  **Correctif d'une ligne** (à ajouter en fin de `services/cpsi-server-py/run_tests.py`, `sys` déjà importé) :
  ```python
  sys.exit(0 if total_ok == len(mods) else 1)
  ```
  En attendant ce correctif, `ci.PATCHED.yml` **garde une garde grep** (`### 18/18 suites vertes ###`)
  qui vire la CI au rouge si une suite casse — défense de niveau CI, indépendante du runner.

---

| Nombre | Ce que c'est | Verdict |
|---|---|---|
| **68** | Chiffre du préambule projet, jamais énuméré (ADR-14). | **Retiré.** |
| **61** | Catalogue v2 (17V+9D+8S+8P+7T+7A+5X). | Obsolète. |
| **64 / 65** | Core moteur : 64 IDs primaires / 65 avec la variante S-10b. | Convention v4.1 : **on compte S-10b → 65**. Papier v2.1 = exécutable, prouvé ∅ dans les 2 sens. |
| **151** | Catalogue complet v4.1 (150 v4.0 + SC-04). | **Couverture certifiée** (§4). |

**Nomenclature à deux couches** (elles ne s'additionnent pas) :
1. Scénarios de comportement (normatif) : `V/D/S/P/T/A/X` + `RT/RC/EX` + `C/K/SN` + `H/DV/F/G` (R58-61).
2. Tests backend (couche preuve) : `FE/SV/NV`, `CK/LK/HM/HF/VQ`, IAM `AU/TP/RG/OI/KS/MF/AD/TM`, `I/B`, `SC`.
Le décompte normatif n'inclut jamais la couche 2. Crosswalk R2/R13/R52/R84/R85/R86 : voir
`catalogue-patch-v4.0-vers-v4.1.md` §4.

---

## 4. Certification de couverture (150 → 151)

Croisement des 150 IDs du Word v4.0 contre **tous** les tests, comparaison normalisée (insensible au
tiret : `C-02` = `test_C02`).

- **150/150 IDs couverts · 0 orpheline · → 151/151 après SC-04.**
- **Trois couches exécutables** (une piste de faux départ évitée : un scan du seul moteur aurait cru
  12 familles orphelines — elles vivent dans le CPSI) :
  - `services/workflow-engine-py/` — moteur de référence : **145 tests**.
  - `services/cpsi-server-py/` — profilage/paramétrage (`IN/PS/GP/ST/SG/PT/BG/IA/BD/TR/PM/PD`…) : **97 tests**.
  - `apps/api/` — backend NestJS + e2e : **~128 tests**.
- **Portée** : certification de **couverture nominale** (chaque scénario a un test du même ID). PAS un
  vert-en-un-run, PAS une preuve d'adéquation assertion↔Gherkin.

**Gap CI** : la CI lance le moteur de référence (`workflow-engine-py` + SQL) et les **e2e backend**
(`test:e2e`, probablement rouges à cause du bloqueur §2 tant qu'il n'est pas corrigé), mais **ni
`test:rules`** (103 tests règles/IAM/screening — harnais bash hors `test:unit`) **ni `cpsi-server-py`**
(97 tests). Soit **~200 tests sur ~370** *réputés* verts (matrice), pas *prouvés* verts en continu.
Corrigé par `ci.PATCHED.yml`.

---

## 5. Artefacts produits cette session (à commiter)

| Fichier | Destination repo suggérée | Rôle |
|---|---|---|
| `olive-session-handoff-2026-07-19.md` | `docs/` | ce journal (anti-mémoire-périmée) |
| `catalogue-patch-v4.0-vers-v4.1.md` | `spec/` | SC-04 + rebasage comptage + certification §3bis |
| `kyc.controller.PATCHED.ts` | `apps/api/src/modules/kyc/` | correctif du bloqueur e2e (guard `validate`) |
| `ci.PATCHED.yml` | `.github/workflows/ci.yml` | branche CPSI + e2e backend + `prisma:post` |

---

## 6. Reste à faire — priorisé

1. **Appliquer le correctif `validate`** (`kyc.controller.PATCHED.ts`) puis exécuter les e2e sur un
   Postgres réel : c'est le seul geste qui fait passer « conforme en logique » à « conforme en système ».
2. **Brancher `test:rules` + `cpsi-server-py` à la CI** (`ci.PATCHED.yml`, + `prisma:post` avant e2e) :
   transforme « réputé vert » en « prouvé vert » pour ~200 tests. **Prérequis** : corriger le faux-vert
   du runner CPSI (une ligne `sys.exit`, §2bis) — sinon la garde grep de la CI est le seul filet.
3. **Fold SC-04 dans le `.docx` v4.0 → v4.1** + note de version (retirer le 68).
4. **Migration Prisma + e2e** (Postgres réel) ; ajouter `prisma:post` avant e2e pour prouver R48.
5. **JWKS de l'IdP** (`verifyIdToken`) ; **chiffrement `mfa_secret` au repos** (avant prod).
6. Anomalies référentiel (6 comptes RM, 19 segments) — décision banque, pas ingénierie.

---

## 7. Leçons de méthode (inscrites au dossier)

- **La mémoire de l'assistant périme.** Elle a affirmé « R13 rouge » alors que R13 était vert depuis 3
  jours. Toujours revérifier sur le code avant d'ordonnancer.
- **Scanner TOUT le dépôt.** Le corpus vit sur **trois** couches (`workflow-engine-py`,
  `cpsi-server-py`, `apps/api`). Un scan partiel a failli produire 12 fausses orphelines.
- **Les greps mentent** (tiret vs sans-tiret : 10 fausses orphelines). Normaliser avant de conclure ;
  vérifier l'existence réelle des fonctions.
- **Ne pas annoncer un chiffre non énuméré** : c'est l'erreur du « 68 ». Un nombre normatif se prouve
  (couverture), il ne s'annonce pas.

---

## 8. Session — partie 2 (même journée) : dev backend + intégration démo

Cinq blocs livrés **tests d'abord, tous exécutés réellement** — 50/50 verts, y compris en une
seule passe séquentielle (ordre du harnais prouvé) :

| Bloc | Corpus | Verts | Fichiers (chemins repo) |
|---|---|---|---|
| Propagation golden record — **R104 (nouvelle règle, PROPOSÉE)** | GR-01..04 (+5 gardes) | 9/9 | `modules/events/golden-record.projector{,.spec}.ts` + `outbox.worker.PATCHED.ts` (dispatch en tx du drain) |
| Screening persistant (R100→R103, ratifiées) | SC wiring | 10/10 | `modules/screening/screening.service.ts` + controller/module + `prisma/schema.screening.prisma` |
| Vérif JWKS de l'IdP (ferme le stub `verifyIdToken`) | JV-01..07 | 9/9 | `modules/auth/jwks-verifier{,.spec}.ts` — RS256 strict, anti-confusion d'algo, rollover 1 re-fetch, cache TTL |
| Chiffrement `mfa_secret` au repos | SB-01..06 | 9/9 | `common/secret-box.ts` + `mfa.service.PATCHED.ts` — AES-256-GCM, legacy passthrough (aucun user verrouillé) |
| Personnes (R30→R36, port fidèle du moteur Python bloc 4) | P-01..08 | 13/13 | `modules/personnes/*` + `Tenant.settings` (voie R-Q : cumul R31, délai R33) |

**Corrections d'audit en cours de route (à retenir)** : « endpoint auth absent » était FAUX —
les controllers sont inline dans `auth.module.ts` (`ls *.controller.ts` a menti). Seul vrai trou
auth : `verifyIdToken` — désormais fermé.

**Intégration dans la VRAIE démo (`demo/olive-demo.html`)** : onglet « 🧪 Preuves moteur » ajouté
dans Screening (5ᵉ onglet). Trois splices `chg()` count==1 ; `node --check` sur le script appli
entier (2,08 Mo) ; bloc ré-extrait du fichier livré → 16/16 scénarios verts ; panneau monté avec
le React inline de la démo. Un bug de parenthésage et un bug sha256 (8 constantes au lieu de 64)
attrapés par les smokes AVANT livraison.

**Ops livré avec la consolidation** : `run-rule-tests.sh` patché (+5 corpus → 153 verts attendus),
`docker-compose.test.yml` + scripts `test:e2e:setup/teardown` (le trou du pré-vol),
`post-deploy-v2.sql` (RLS **réelle** : FORCE + rôle non-propriétaire `olive_app` + policies, garde
outbox, immuabilité étendue aux tables screening — bascule en 2 temps documentée),
`docs/RUNBOOK-OPS.md` (chaîne de vérification, déploiement, incidents).

**Reste ouvert après cette consolidation** : ratifier **R104** ; premier run réel (CI patchée +
e2e Postgres) ; bascule RLS T2 (`olive_app` + `forTenant` réel) + e2e de recette RLS ; fix
`sys.exit` du runner CPSI ; fold SC-04 dans le Word v4.1.


---

## 9. Session — partie 3 : PMS (R105→R108) + catalogue UI + paramétrage généralisé + démo allégée

**PMS entré dans la discipline** — amendement `catalogue-amendement-R105-R108-pms.md` (PROPOSÉ,
famille **PF** — PM prise par le post-marché CPSI) rédigé AVANT le code, puis corpus PF-01..06
(**9/9 verts** ; premier run 7/9 — le rouge venait du JEU DE TEST, portefeuille dérivant sur deux
classes, pas du service). `pms.service.ts` : valoriser (drift constaté jamais corrigé, R105),
preTrade (exclusions + concentration bloquent avec motif, passage tracé, R106), verifierAdequation
(riskLevel CLIENT — golden record R104 — borne le mandat, jamais rétrogradé auto, R107),
tickBreaches/cloreBreach (registre, escalade une fois, clôture R7 + jeton, R108). Modèles Mandate/
Position/PmsBreach + controller. **Câblage clé documenté** : le projector R104 appelle
verifierAdequation à chaque kyc.validated. Params R-Q : pmsDriftToleranceBp (200) ·
pmsBreachDelaiJours (30). Harnais patché : corpus attendu **162**. RLS v2 : +mandates/positions/
pms_breaches.

**Démo** : catalogue de règles UI = **89 règles R1→R108** (bloc 17 · PMS, JSON re-parsé) ; les 4
paramétrables sans clé explicite (R11/R29/R56/R90) précisées ; « Champs & droits » généralisé :
**10 domaines · 43 sections · 227 champs · 0 fallback** (prouvé), modes par défaut métier (READ
pour les calculés moteur, OFF pour les optionnels).

**Chargement lent (mobile)** : MESURÉ avant d\'agir — boot Node 81 ms, module entier exécuté
jusqu\'à createRoot → le fichier est sain, la lenteur est le viewer face à ~2,8 Mo. Correctif :
strip d\'indentation conservatif (16 lignes en template multi-ligne préservées) → **2 523 790
octets (−9,4 %)**, re-validé : node --check, boot complet, catalogue JSON 89 règles, preuves
16/16 SUR LE FICHIER MINIFIÉ. `olive-demo-source.html` = canon des futurs splices (le minifié ne
se splice pas). Si le viewer de l\'app reste lent : ouvrir dans un vrai navigateur (Fichiers →
Safari/Chrome) — le boot mesuré est ~100 ms.

**Pièges de splice attrapés cette partie** (tous par node --check / re-parse JSON avant livraison) :
ancre insérée AVANT l\'accolade fermante de R104 ; ordre des champs comment/statut différent dans
R104 ; `const const` (le splice mange le const original) — désormais réflexe : vérifier le
préfixe de déclaration (var/const) avant toute ancre.


---

## 10. Session — partie 4 : GED (R109→R112)

Amendement `catalogue-amendement-R109-R112-ged.md` (PROPOSÉ, famille **GD** vérifiée libre) AVANT
le code, corpus GD-01..06 **9/9 verts du premier coup**. `ged.service.ts` : deposer (versions
append-only, empreinte SHA-256 réelle au dépôt, R109/R111), archiver (logique motivé R7, jamais de
suppression physique, restitution survit — LBA), tickPeremptions (constate une fois, ne bloque
rien — R39, réarmé au re-dépôt), verifierCompletude (manquants + expirés par POINT DE PASSAGE —
la GED constate, l'appelant bloque), restituer (default-deny par type — refus TRACÉ —, intégrité
recalculée et confrontée, accès « qui a vu quoi » R112). Référentiel R-Q :
`Tenant.settings.gedDocTypes[]` { code, validiteMois|null, requisPour[], rolesAutorises[] }.
Modèle : DocumentVersion (append-only, trigger R48) + 7 champs sur Document existant. Câblages
documentés : validation KYC → verifierCompletude(KYC_VALIDATION) ; tâche maj_ged du CoC (P-01) →
deposer(). Harnais : corpus attendu **171**. RLS v2 : +document_versions (RLS ET append-only).
Démo : catalogue **93 règles** (bloc 18), « Champs & droits » **11 domaines · 46 sections ·
244 champs · 0 fallback** — splices sur SOURCE puis re-strip (2 528 642 octets), les deux fichiers
revalidés (syntaxe, JSON, montage).


---

## 11. Session — partie 5 : RATIFICATION GLOBALE + GED avancée (R113→R116)

**Ali ratifie en bloc R104→R116 le 19.07.2026.** Propagé : 4 docs d'amendement, statuts du
catalogue UI (97 règles, plus AUCUNE proposée — vérifié mécaniquement), R56 dé-périmé,
`catalogue-patch-v4.1-vers-v4.2.md` (à reporter dans le Word).

**R113→R116 livrées** (amendement AVANT code, corpus GD-07..14 **9/9 verts**) :
`ged-avance.service.ts` avec PORTS injectés (tsa/qes/ia — le moteur définit le contrat,
l'adaptateur est Phase 2). R113 ancrage : Merkle réel (racine recalculée indépendamment par le
test), horodatage TSA, preuve d'appartenance vérifiable par un tiers (`verifierChemin` pur),
lot unique par tick. R114 QES : la signature EST une version (succession R109), preuve du
prestataire portée, refus explicite sans port — jamais de simulacre. R115 rétention : l'échéance
PROPOSE (une fois), la destruction se DÉCIDE (R7, jeton) et CERTIFIE (empreintes conservées —
le registre subsiste), le legal hold gèle tick ET destruction, pose/levée motivées. R116 :
classification IA en deux événements (proposee/confirmee), le type inchangé entre les deux (R44).
Modèles : AnchorBatch (+RLS +append-only), DocumentVersion +anchorBatchId/merkleProof/signature,
Document +legalHold/holdMotif/destruction*/destructionProposee. Harnais : corpus attendu **180**.
Démo : 97 règles · 11 domaines · 47 sections · 252 champs · 0 fallback — source splicée,
re-strippée (2 532 069 octets), les deux fichiers revalidés.

**Chez Ali maintenant** : reporter v4.2 dans le Word ; premier `verify:all` réel (180 attendus) ;
capture d'`olive-viewer-test.html` toujours attendue pour l'affaire du viewer.
