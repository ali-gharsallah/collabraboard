# Fiche de parité — `clients` (ClientsScreen)

Source : `docs/reference/olive-demo.html` **13642–13754** (helpers : 13068 clientById/kycsByClientId,
13077 clientLifecycleStages, 13131 RiskFactorsList/ScorePopover, 13475–13641 BrancheDeVie/
ClientTimelineModal, 15091–15162 AML engine, 16523–16548 LifecycleBadge, 18082 ExportBtn).
Port : `apps/web/src/parity/ClientsScreen.tsx` (+ `components-data.tsx`, `aml.ts`). Entrée
DEV-ONLY `parity-clients.html`. Données : fixture `CLIENTS` (60).

## Structure (verbatim)
- **MineBar** : « Tous les clients » / « ◉ Mes clients » + `ExportBtn` (⇩ Export Excel/CSV).
  ⚠ PAS de `ColsBtn` ici (corrigé — le ⚙ Colonnes n'existe pas dans ClientsScreen).
- **StatsToggle** (KPI Clients référencés / UHNWI-HNWI / PEP / Structures) → **rend null** (B.6).
- **Filtres** : recherche « Nom, ID, pays, RM… » · segments [Tous/UHNWI/HNWI/Affluent/Mass Aff.] ·
  risque [Tout risque/Faible/Moyen/Élevé] · select « Toutes structures ».
- **Table** (`colOn("clients",…)`) : Client(avatar+nom+RM) · ID *(off défaut)* · Structure(Badge) ·
  Segment · AUM · Pays(drapeau) · Risque(pill) · Score *(off défaut : Donut+ScorePopover)* ·
  KYC(pill statut) · Statut(LifecycleBadge) · 🪪(Vue 360°) · ›. En-tête « N client(s) » +
  « Cliquez pour ouvrir le dossier KYC ». Pagination 25/page.
- **🪪 → ClientTimelineModal** « Vue 360° — {nom} » : carte 4 colonnes (Identité, UBO, Screening,
  Facteurs de risque explicables via `evalAmlRules`) + **Branche de vie** (frise olivier verticale,
  événements KYC + Account Reviews + Onboarding).

## Parité — statut
- [x] Colonnes/ordre/labels, filtres, MineBar, pagination, table, ScorePopover, LifecycleBadge,
      ClientTimelineModal, BrancheDeVie : **conformes** (capture démo connecté vs app).
- [x] Score AML explicable (`evalAmlRules`, 36 règles) — facteurs non transactionnels exacts.

## Écarts CONSIGNÉS (non-inventés, résolus au portage de la coquille §2)
1. **Compte 60 vs 84** : la vue connectée ajoute `extra: promoted` — clients issus de prospects
   onboardés, **calculés au runtime par la coquille** (non littéral). La fixture `CLIENTS` = 60 (§5).
2. **Statut « Client — sortie en cours »** (ex. Anne Greco) : dérive de `OFFBOARDING_CASES`,
   **valeur calculée au runtime** (non extractible) → stub « Client actif » en attendant la coquille.
3. **Facteurs transactionnels du ScorePopover** (S31–S36) : dépendent de `TX_DATA`/`AML_ALERTS`
   non extraits → règles inertes. Le SCORE affiché (colonne, `c.score` fixture) reste exact.
4. **Timeline** : événements COC/AML/TX/Business-Trip omis (fixtures non extraites) — KYC +
   Account Reviews + Onboarding présents.
