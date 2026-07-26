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
| **Intégration (e2e)** | Prouver la pile réelle (NestFactory + **Postgres réel** + RLS) | `test:e2e` (`kyc-rules` + `fat-vague1..4`) | **33 tests, 5 suites** |
| **Acceptation fonctionnelle (FAT)** | Prouver les besoins **métier** par persona | `fat-vague1..4.e2e-spec.ts` | **27 FAT (V1 10 + V2 4 + V3 7 + V4 6)** |
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
- **0 régression** : 425 règles + 33 e2e verts.
- Toute exigence métier de Vagues 1 à 4 tracée à ≥ 1 FAT (matrice §COUVERTURE-REGLES).

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
