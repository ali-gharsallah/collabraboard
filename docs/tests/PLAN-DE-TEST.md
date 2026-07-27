# Plan de test — O-Live CLM/KYC/AML (banque privée suisse)

**Version 1.0 — 2026-07-22.** Document stratégique de recette. Références réglementaires du
domaine : CDB 20, LBA/OBA-FINMA, LSFin, CRS/FATCA.

---

## 1. Objet et périmètre

**Objet.** Définir la stratégie, les niveaux, les critères et la traçabilité des tests
permettant de prononcer la recette des **Vagues 1 & 2** d'O-Live.

**Dans le périmètre (Vague 1)** — 5 domaines fonctionnels :
1. **Clients** — création, consultation, isolation multi-tenant.
2. **KYC** — dossier gouverné, four-eyes, golden record.
3. **Règles AML** — détection (structuring, sanctions…), seuils gouvernés.
4. **Alertes** — signaux levés, blocage automatique vs revue humaine, consultation.
5. **Rejeu à date** — valeur d'un paramètre/règle telle qu'elle était à une date passée.

**Dans le périmètre (Vague 2 — Surveillance & Dossiers)** — 2 domaines fonctionnels supplémentaires :
6. **Dossiers de risque** — instruction : notes append-only (R134), transitions gouvernées avec motif (R133/R136/R7).
7. **Pièces (GED)** — consultation filtrée au rôle (R110), fiche = empreinte, jamais le contenu (R145), isolation tenant.

**Dans le périmètre (Vague 3 — Le cycle client de bout en bout)** — 6 domaines fonctionnels supplémentaires :
8. **Onboarding / aiguillage** — entrée en relation + diligence SDD/CDD/EDD (R117/R118), ouverture sous KYC VALIDATED (R119).
9. **Account Review** — revue périodique par **orchestration** (re-screening R103 + visas KYC), zéro canon inventé.
10. **Screening** — run (R100/R103), qualification motivée (R101/R7), escalade proposée (R39/R44).
11. **Personnes liées / UBO** — rôles (R31), relations bijectives (R34).
12. **Change of Circumstances** — CoC propagé + re-screening déclenché sur identité (R30/R42).
13. **Dashboard exécutif** — stock par état, cloisonné RLS.

**Dans le périmètre (Vague 4 — Écrans « plateforme »)** — 6 domaines fonctionnels supplémentaires :
14. **Transferts & ordres** — portail transactionnel (R140/R142), file habilitée (R143), statut client sans motif AML (R132).
15. **Settlement** — core = **port** (R167→R169) ; sans connecteur, refus explicite (R114), jamais un simulacre.
16. **Screening avancé** — adverse media / listes complémentaires = paramètre du moteur ratifié (R100→R103).
17. **Reporting MROS** — décision figée + empreinte opposable (R130), art. 10a (R132).
18. **GED / coffre** — preuve d'intégrité (versions), jamais le contenu (R110/R145).
19. **Registre LBA** — piste d'audit agrégée, cloisonnée RLS.

**Dans le périmètre (Vague 5 — Rattrapage maquette : CRM & Workflow)** — 4 domaines (canon ratifié) :
20. **CRM Banque** — timeline (R186) + prochains gestes (R187).
21. **Contact Reports** — compte rendu tracé (R188), pré-remplissage IA gouverné (R138).
22. **Workflow Designer/Rules** — définition versionnée, publiée datée + immuable, grandfathering (R171→R173).
23. **Corroboration KYC** — divergence → Central File, sans modification (R36).

**Dans le périmètre (Vague 6 — Paramétrage & Gouvernance)** — 2 domaines (canon ratifié) :
24. **Registre de paramétrage** — écriture typée/motivée/datée non-rétroactive (R125/R126), valeur à date (R127).
25. **Config à date & Go-live** — config reconstruite (R127), activation gouvernée (R128).

**Dans le périmètre (Vague 7 — PMS)** — 1 domaine (canon ratifié, intégration) :
26. **PMS** — adéquation LSFin (R107), drift constaté (R105/R44), pre-trade bloquant (R106), breaches (R108/R7).

**Dans le périmètre (Vague 10 — Front-câblage v2, phase 1)** — SPEC-FRONT-CÂBLAGE v2, décisions actées :
29. **Ports** (FE-PORT) — état des ports **ratifiés** (core/IA/coffre), refus gracieux, **aucun secret** (R167/R163/R180).
30. **Next Best Action** (FE-NBA) — gestes R187 en lecture, cadre R44 (décision non ratifiée → désactivée).
31. **FE-CORE** (`api.ts`) — seed signalé, propagation session, rejeu `asOf` (R48), erreurs non traduites (Vitest).

**Dans le périmètre (Vague 12 — Workflow Instances)** — FE-WFI câblé au canon KYC :
32. **Workflow Instances** — projection du workflow gouverné ratifié (dossier KYC) : liste, détail (steps + visas R15), timeline append-only (FE-20). Porte mince `WorkflowInstancesModule`.

*Gelé (attente « OK pour R222..R238 »)* : Business Trip (MOD-75) & Formations (MOD-43) — Gherkin seul.
*Reste FE-05 (aucun service backlog ratifié)* : Tâches (FE-TASK). Décision NBA non ratifiée. Détail : `docs/ECARTS-FRONT.md`.

**Dans le périmètre (Vagues 13-14 — R222→R238 ratifié « OK pour R222..R238 »)** :
33. **Formations & Certifications** (MOD-43, R231→R238) — catalogue tenant, complétion événementielle, visa R235/R13, append-only R234, rejeu certifiant R238.
34. **Business Trip** (MOD-75, R222→R230) — cycle événementiel, avis cross-border (ne décide pas), signaux KYC/certif, visa R225/R13, contact reports mesurés, rejeu grandfathering, révision chaînée.

*(Vague 9 — Bac à sable AML : dry-run d'un seuil R94/B-02 ; Vague 8 — Référentiel AML R189→R206, cf. FAT-VAGUE8/9.)*

**Hors périmètre (à ce stade)** : reporting CRS/FATCA/goAML depuis données réelles ;
rejeu-à-date **généralisé** aux agrégats métier (aujourd'hui : paramètres + dossier KYC) ;
écrans front des domaines non encore construits (workflow — le backend existe, la surface
produit non) ; **liste noire** (RH, e-learning, business trip, budget, réunions, cyber-SOC) —
jamais construite ; `PersonneLienService` (R152→R155) **dormant** (aucun modèle `Personne`) ;
**% de détention** non ratifié ; **fiche GED** : empreinte de version non restituée (divergence
fake/modèle `no`/`empreinte` vs `numero`/`sha256`, correctif hors périmètre). Ces points sont
documentés dans `docs/DECALAGE-FRONT-BACK.md` et `docs/ETAT-REEL-VERIFIE.md`.

## 2. Niveaux de test

| Niveau | But | Où | Volume prouvé |
|---|---|---|---|
| **Unitaire / règles** | Prouver chaque règle moteur R1→R221 en isolation | Harnais offline (`test:rules`, faux Prisma en mémoire) | **425 tests, 50 suites** |
| **Intégration (e2e)** | Prouver la pile réelle (NestFactory + **Postgres réel** + RLS) | `test:e2e` (`kyc-rules` + `fat-vague1..16` + A3) | **78 tests, 16 suites** |
| **Acceptation fonctionnelle (FAT)** | Prouver les besoins **métier** par persona | `fat-vague1..14.e2e-spec.ts` | **62 FAT (… + V12 3 + V13 8 + V14 10)** |
| **Front (Vitest + RTL + MSW)** | Prouver FE-CORE (`api.ts`) + composants hors backend | `pnpm --filter web run test:unit` | **13 tests (FE-01..06 + composants)** |
| **Non-régression** | Garantir 0 régression à chaque lot | Rejeu intégral 1→4 en CI (`.github/workflows/ci.yml`) | Bloquant |

## 3. Stratégie par niveau

- **Unitaire** : chaque règle a un `*.wiring.spec.ts` auto-rapportant « X/X verts ». Aucune base,
  déterministe. Outil : `tsc` + Node. Données : fixtures en mémoire.
- **Intégration** : `boot()` (Test.createTestingModule + createNestApplication), JWT RS256
  (`bearer(tid, sub, role)`), Postgres jetable réinitialisé (`prisma migrate reset` + `prisma:post`
  → RLS FORCE + triggers d'immuabilité). Données : tenants/clients semés par test (`seedTenantClient`).
- **FAT** : mêmes moyens que l'e2e, mais **rédigés du point de vue des personas** (RM, CO, CF,
  MLRO, Auditeur) et **exécutés contre le vrai backend**. La sortie ✓/✕ est la preuve de recette.
- **Non-régression** : la CI rejoue lint+typecheck, 425 règles, e2e, recette RLS, moteurs Python.

## 4. Environnements

| Env | Existe ? | Usage |
|---|---|---|
| **dev (local)** | ✅ Postgres 16 natif :5433 (`olive_test`) | développement + FAT |
| **CI** | ✅ GitHub Actions (Postgres service, `migrate deploy` + `prisma:post`) | non-régression bloquante |
| **recette / UAT** | ⚠️ non provisionné séparément | la recette Vague 1 est exécutée sur l'env dev/CI (isofonctionnel) |
| **production** | ❌ non déployé | — |

## 5. Rôles

| Rôle | Responsabilité |
|---|---|
| **Éditeur (dev)** | Écrit les tests unitaires/e2e/FAT, les maintient verts. |
| **Ingénieur recette** | Exécute les FAT, remplit les statuts, produit le rapport. |
| **Métier (RM/CO/CF/MLRO)** | Valide que les FAT reflètent le besoin réel. |
| **Sponsor / Compliance** | **Signe** le rapport de recette (prononce la recette). |

## 6. Critères d'entrée / de sortie

**Entrée (un test peut commencer quand)** : base réinitialisée + `prisma:post` OK ; backend
démarre (secrets `AUDIT_HMAC_SECRET`/`MFA_ENC_KEY` présents) ; harnais 425 vert.

**Sortie (un test est réussi quand)** : assertions métier vérifiées contre le backend réel,
sortie ✓ ; preuve archivée dans `docs/tests/PREUVES/`.

## 7. Critères de réussite globaux

- **100 % des FAT critiques PASS** (bloquant pour la recette).
- **0 régression** : 425 règles + 78 e2e + 13 Vitest verts.
- Toute exigence métier de Vagues 1 à 8 tracée à ≥ 1 FAT (matrice §COUVERTURE-REGLES).

## 8. Gestion des anomalies

| Sévérité | Définition | Traitement |
|---|---|---|
| **Bloquante** | Un FAT critique échoue (ex. sanctions non bloquées, four-eyes contournable) | Recette suspendue jusqu'à correction |
| **Majeure** | Écart fonctionnel sans contournement | Corrigé avant prononcé, ou dérogation tracée |
| **Mineure** | Écart cosmétique / contournable | Backlog, n'empêche pas la recette |
| **Observation** | Fragilité technique sans impact métier | Notée (ex. erratum E4 : sous-requête e2e tenant-scopée) |

## 9. Matrice de traçabilité

Voir **`docs/tests/COUVERTURE-REGLES.md`** — chaque exigence métier / règle Rxxx → FAT + test
technique qui la couvre.
