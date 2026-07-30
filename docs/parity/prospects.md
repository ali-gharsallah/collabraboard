# Fiche de parité — Funnel Prospection (stades 1 & 2) — v1

Sources : `docs/reference/olive-demo.html` — ProspectToContactScreen **13924–14000**,
PreOnboardingScreen **21163–21266**, moteur prospection **16551–16617**, moteur pré-onboarding
**21107–21162** (+ amlHash 14678, DOC_STRUCTURES 18123).
Ports : `ProspectToContactScreen.tsx`, `PreOnboardingScreen.tsx`, `prospection-support.ts`,
`preonboarding-support.ts`. Branchés : NAV « Clients & Relations » → « Prospect à contacter »
(`prospect_contact`) et « Prospect en contact » (`prospect_test`), navigation via `goTo` (= setScreen).

## Porté (v1) — verbatim
### Stade 1 — Prospect à contacter (`prospect_contact`)
- En-tête « Prospect — stade 1 » / « Prospect à contacter » + descriptif.
- Carte **Module prospection (MOD-72)** :
  - **Suggestions IA** : `prospectionSuggest()` **réellement calculé** sur le réseau `PERSONS_DATA`
    (personnes ayant des rôles sur des dossiers clients mais sans relation en nom propre) — score
    pondéré (`PROSPECTION_ROLE_WEIGHT`), rationale « Réseau existant : … », flag PEP/Near-PEP, RM
    suggéré, bouton « ＋ Ajouter au pipeline » (`addProspectLead(…, "IA")`).
  - **Ajout manuel (RM)** : nom / pays / secteur / note + « Ajouter » (`addProspectLead(…, "RM")`).
- Liste `PROSPECT_LEADS` (3 seed + ajouts) : avatar, drapeau, nom, badge Identifié par IA/RM, statut
  (`STATUS_STYLE` À tester / GO / NO-GO), RM, bouton « → Tester l'onboardabilité » (PENDING.testLeadId
  → `prospect_test`) ou « → Démarrer l'onboarding » si GO (PENDING.onboardName → `prospect_onboard`).

### Stade 2 — Prospect en contact / Pré-onboarding (`prospect_test`)
- H1 interne = `SCREEN_LABEL.preonboarding` (**absent du dictionnaire dans la maquette → rendu vide**,
  reproduit verbatim ; le titre visible « Ce client est-il onboardable ? » vient de l'en-tête coquille).
- Formulaire : **OCR (simulation)** (`ocrExtract` déterministe via `amlHash`, pré-remplit nom/pays/
  structure), nom, pays/juridiction (15), structure (`DOC_STRUCTURES`), secteur, AUM, case PEP.
- **Verdict live** (`runPreOnboardingCheck` / `PRE_ONBOARD_RULES` PRE1–PRE7 taguées par juridiction) :
  ONBOARDABLE / SOUS CONDITIONS / NON ONBOARDABLE + liste « Quoi faire pour rendre le dossier
  onboardable » (bloquant/conditionnel, message, action).
- Pré-remplissage depuis le lead lié (handoff `PENDING.testLeadId`, lu-puis-effacé) + panneau
  « Marquer GO / NO-GO » (`markLeadDecision`, GO désactivé si verdict BLOCKED) → retour `prospect_contact`.

## Handoff inter-écrans
La maquette réassigne des variables module-level (`PENDING_TEST_LEAD_ID` / `PENDING_ONBOARD_LEAD_NAME`).
Les imports ESM étant en lecture seule, le pattern est reproduit via un objet-conteneur mutable
`PENDING = { testLeadId, onboardName }` dans `prospection-support.ts`.

## CONSIGNÉ — prochaine session
- **Stade 3 — Prospect à onboarder** (`prospect_onboard` → `OnboardingScreen`, source 14001+) : assistant
  d'onboarding branché sur `PROSPECTS_DATA` avec promotion prospect→client (`enterBank` / `onNewProspect`
  / `openProspectKyc`) — nécessite la plomberie de création client (état global de l'app). Placeholder
  en attendant ; le bouton « → Démarrer l'onboarding » (leads GO) y mène.
- `pushParamAudit` / `wfEmit` : no-op (hors périmètre front).

Preuve : capture `parity-app.html` → login → Prospect à contacter (suggestions IA live) → Tester
l'onboardabilité (pré-rempli depuis le lead, verdict ONBOARDABLE) → 0 erreur runtime.
