# O-Live — SCRIPT DE DÉMONSTRATION « Gharsallah Wealth Bank » (R329, 2026-07-29)

Le tenant de démo est produit par `OLIVE_SEED_DEMO=1 npm run seed:demo` (apps/api) — un
tenant ORDINAIRE, semé par les VRAIES APIs, idempotent par références (re-seed = même état).
Ce document est le déroulé COMMERCIAL minuté : quel écran, quel persona, quelle scène.
Reset = purge du tenant + re-seed (RUNBOOK-OPS §9) — jamais de nettoyage manuel.

## Personas (mots de passe de démo — au coffre en staging, jamais au repo)
| Rôle | E-mail | Ce qu'il incarne dans la démo |
|------|--------|-------------------------------|
| ADMIN | alice@gwb-demo.ch | paramétrage, licence, IAM |
| RM | marc@gwb-demo.ch | le front — prospects, clients, KYC, CoC |
| CO | carla@gwb-demo.ch | compliance — CPSI, screening, OpRisk |
| CO_SR | selim@gwb-demo.ch | compliance senior — voit les motifs sensibles (OF-07) |
| DIR | diane@gwb-demo.ch | direction — Command Center, déploiements |
| SO | sofia@gwb-demo.ch | Security Officer — audit, transport, journaux |
MFA de démo : documentée à l'enrôlement (chaque persona enrôle un TOTP au premier login).

## Le déroulé (≈ 12 min)

1. **Login deux temps (R296)** — `marc@gwb-demo.ch` → l'e-mail résout le tenant par domaine,
   la méthode suit `sso_mode`. *(30 s — écran login)*
2. **Prospects → onboarding** *(RM, écran Onboarding, 90 s)* — 3 prospects au pipeline
   (Famille Keller PP, Nordwind Handel SA, Meridian Trust) ; l'un avance
   PROSPECT → COLLECTE → KYC_EN_COURS. La scène montre le tunnel, pas un état figé.
3. **Clients & KYC** *(RM, écran Clients puis KYC, 120 s)* — 3 structures (personne physique,
   société op., trust) ; un dossier KYC multi-rôles servi par le moteur de règles.
3-bis. **Cycle de vie du dossier & matrice documentaire (Lot B)** *(CO_SR, 75 s)* — le dossier
   **Nordwind est SUSPENDU** sur alerte AML (R17 : opérations gelées, écritures métier refusées) ;
   une **matrice documentaire de démo est publiée** (R26/R27 : documents × entité × juridiction,
   groupe d'équivalence CH→PASSEPORT_CH) — le contenu réel est arbitré banque (GOUVERNANCE-LOTC.md) ;
   une **recertification est ouverte** sur le dossier validé Keller (R23 : un événement de risque la
   mettrait en pause, priorité). Tout par les vraies routes, ajouté au seed.
4. **CPSI — le score perpétuel** *(CO, écran CPSI · Profil, 90 s)* — Famille Keller
   enregistrée (PEP), un signal `hit_screening` ; le score et ses drivers expliqués (R67),
   la jauge de rejeu R250 visible.
5. **CoC HAUTE (R276)** *(RM → CO, écran Chgt circonstances, 90 s)* — statut PEP acquis :
   matérialité HAUTE force REVISION_KYC (SD-06) ; le signal CPSI est rattaché au dossier.
6. **OpRisk** *(CO, écran Octopulse OpRisk, 60 s)* — un incident « double exécution d'un
   virement » (taxonomie Bâle) ; la heatmap CALCULÉE, le plan d'action.
7. **Offboarding art. 10a — LA scène OF-07** *(90 s)* — sortie EXIT_COMPLIANCE de Meridian
   Trust : connecté en **RM**, le motif sensible est INVISIBLE ; connecté en **CO_SR**, il
   est visible. Le cloisonnement R270 se DÉMONTRE en changeant de persona.
8. **Audit & transport** *(SO, écran Audit & transport, 60 s)* — les journaux, la santé du
   transport, l'intégrité (SO-07), le journal des déploiements (RZ-04).
9. **Rejeu à date** *(n'importe quel écran + sélecteur asOf, 45 s)* — « replayable by design »
   se joue sur le tenant de démo (DM-05) : une lecture à une date antérieure.
10. **Olivia (AI Core)** *(écran Olivia, 60 s)* — propositions en attente ; un run v2 si le
    canon Olivia v2 est déroulé (déjà livré, R259-R266) — le run de démo s'ajoute au seed.

## Ce que la démo PROUVE (les invariants, pas juste les écrans)
- **DM-04 / OF-07** : le même dossier, deux vérités selon le rôle connecté — le cloisonnement
  n'est pas cosmétique.
- **DM-05** : le rejeu à date fonctionne sur le tenant de démo.
- **DM-06** : le tenant de démo est isolé (RLS) — absent de tout agrégat cross-tenant.
- **R167** : aucune donnée simulée en prod — la démo est un TENANT, gardé par OLIVE_SEED_DEMO.

---

## G4 — Trust + settlor PEP : la checklist d'exigences (module A, P-L7-5)

Parcours 100 % capacités RÉELLES (aucune valeur fabriquée au front — leçon L6-3) ; écran
« Checklist exigences » (🧭), branché sur GET /v1/inference/:kycId/ledger et /explain/:rid.

| Étape (action réelle) | État attendu de la checklist |
|---|---|
| 1. Créer le dossier Trust (client structure=TRUST) + lier le settlor (personne_liens, cible KYC) | Gap initial : ⛔ REQ-DOC-T (Formulaire T, CDB 20 art. 41), ⛔ REQ-VISA-CO ; ✅ REQ-CHECK-SCREEN (0 hit = vacuité) ; REQ-EDD-PEP ABSENT (inactif — pas de PEP lié) |
| 2. Réception du Formulaire T (document ACTIF, non expiré, nom=FORMULAIRE_T) | ✅ REQ-DOC-T avec preuve = id de la pièce ; « pourquoi ? » montre règle + base légale + pièce |
| 3. Screening PEP → hit → proposition (L4) → PEPisation DÉCIDÉE par un humain (personnes/:id/pep, sourceHitId tracé) | REQ-EDD-PEP APPARAÎT (when any(relatedPersons, p => p.pep) devient vrai) : ⛔ Rapport EDD manquant ; le hit BRUT rend ⛔ REQ-CHECK-SCREEN |
| 4. Qualifier le hit (motif R7) + déposer le RAPPORT_EDD | ✅ REQ-CHECK-SCREEN (tous qualifiés) ; ✅ REQ-EDD-PEP |
| 5. Visa CO sur IDENTITY (SIGNED, verdict OK — R86) | ✅ REQ-VISA-CO, preuve = id du visa ; gap VIDE — cohérent avec les gardes (P-L7-4 ; divergences connues : MIGRATION_DIVERGENCES.md) |
