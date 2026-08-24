# Fiche de parité — OffboardingScreen (Intelligent Offboarding) — v1

Source : `docs/reference/olive-demo.html` **20662–20881** (écran) + **20984–21063** (données/helpers).
Port : `apps/web/src/parity/OffboardingScreen.tsx` + `apps/web/src/parity/offboarding-support.ts`.
Branché dans la coquille : NAV « Clients & Relations » → « Offboarding » (`case "offboarding"`).

## Porté (v1) — verbatim
- En-tête « Intelligent Offboarding » / titre `SCREEN_LABEL.offboarding` (« Sortie de relation ») +
  sous-titre + bascule d'onglets Dossiers / Dashboard + bouton « ＋ Nouvel offboarding ».
- Modale « 🚪 Nouvel offboarding » : sélecteur client (60 premiers), sélecteur motif **restreint au
  rôle** (`offCanInitiate` / `OFF_REASON_ROLES`), garde-fou si aucun motif autorisé, Annuler / Initier →.
  `createCase` insère un dossier (checklist réinitialisée) et le sélectionne.
- Onglet **Dossiers** : rail gauche (nom client, motif · id, pastille ARCHIVÉ / BLOQUÉ / EN COURS
  calculée par `offHealthCheck`) + panneau droit :
  - Carte client (drapeau, nom, motif · initié le · par · typeLabel).
  - **AI Exit Assessment — Compliance Health Check** : narratif **réellement calculé**
    (`offHealthCheck`) depuis les Account Reviews non clôturées + hits de screening du KYC
    (AML_ALERTS / REPORTING_DATA consignés vides, cf. infra).
  - **Checklist intelligente** (PP → `OFF_PP_CHECKLIST` 8 items / société → `OFF_CORP_CHECKLIST`
    6 items), cases cochables (`toggleChecklistItem`, barré quand fait).
  - **Workflow d'approbation quatre yeux** : chaîne `offApprovalChain` par niveau de risque
    (`OFF_APPROVAL_CHAINS`) avec forçage par motif (`OFF_REASON_FORCE` : AML/Sanctions → HIGH,
    Fusion/acquisition → MEDIUM) ; étapes ✓/●, bouton « Valider {étape} → » / « Finaliser —
    Relationship Closed → » **désactivé tant que le Health Check bloque** ; passage en ARCHIVE.
  - **Digital Twin** : progression globale + 6 jauges (`offStepsFor`).
- Onglet **Dashboard** : 4 histogrammes (Motifs de sortie / Départs par RM / segment / pays,
  `barRow`) + **AI Exit Analytics** (insights HNWI/UHNWI, EDD, dossiers bloqués, motif AML/sanctions).
- Données : `OFFBOARDING_CASES` reconstruit **à l'identique** (IIFE `picks` × CLIENTS, 10 dossiers),
  `OFFBOARDING_REASONS`, checklists, `OFF_APPROVAL_CHAINS`/`OFF_REASON_FORCE`/`OFF_REASON_ROLES`,
  `ROLE_LABELS` — tous portés dans `offboarding-support.ts` (aucun nouveau fixture ; seed déterministe).

## Observations de fidélité / consignations
- `AML_ALERTS` et `REPORTING_DATA` ne sont pas encore portés (identique à `aml.ts`) → tableaux vides :
  aucun blocage AML/SAR ajouté. Le Health Check reste **réel** via les Account Reviews non clôturées
  et les hits de screening — d'où les 10 dossiers en « BLOQUÉ » à l'ouverture (AR ouvertes). À
  compléter au portage AML / MROS.
- `pushParamAudit` / `wfEmit` (piste d'audit + bus d'événements) : no-op local — hors périmètre front.

Preuve : capture `parity-app.html` → login → Offboarding → onglets Dossiers & Dashboard → 0 erreur
runtime. Health Check calculé, chaîne quatre-yeux forcée HIGH sur motif AML, analytics live.
