# Fiche de parité — ContactReportScreen (CRM) — v1

Source : `docs/reference/olive-demo.html` **21552–21672** (écran) + **21336–21438** (données/helpers).
Ports : `apps/web/src/parity/ContactReportScreen.tsx` + `apps/web/src/parity/contactreports-support.ts`.
Branché : NAV « Front & Croissance » → « Contact Reports » (`case "contactreports"`).

## Porté (v1) — verbatim
- En-tête « CRM » / `SCREEN_LABEL.contactreports` (« Contact Reports ») + descriptif « Chaque contact…
  relié au client ET à la personne… Rédaction assistée par IA, cas similaires analysés ».
- Recherche (client / sujet / personne) + bouton « ＋ Nouveau contact report ».
- KPI (via `StatsToggle`, regroupés Accueil — B.6) : Contact reports / Business Trip / Rendez-vous /
  Personnes distinctes (`KpiCard`).
- Modale « 📇 Nouveau contact report » : Client (80), Personne contactée (rôles liés au client, défaut
  UBO), Canal (`CONTACT_REPORT_CHANNELS`), Sujet, Notes brutes (puces), encart « Cas similaires »
  (`similarContactReports` — secteur/segment/sujet), bouton « ✦ Générer avec l'assistant IA »
  (`draftContactReport` : puces + contexte cas similaires + note EDD si risque HIGH), zone brouillon
  éditable, Annuler / Enregistrer → (`save`, unshift). Libellés via `fl("contactReport", …)`.
- Table (60 max, filtrée) : Date · Client · Personne · Canal (Badge) · Sujet · RM. État vide.
- Données : `CONTACT_REPORTS` reconstruit **à l'identique** — 8 CR seed (picks × CLIENTS × PERSONS_DATA)
  + expandeur déterministe (`amlHash`, ~60% des clients, 1-3 CR, dates 2025/2026) ; `FIELD_LABELS`,
  `fl`, `CONTACT_REPORT_CHANNELS` verbatim. Aucun nouveau fixture (généré depuis CLIENTS/PERSONS_DATA).

## Consignations
- `pushParamAudit` / `wfEmit` : no-op (hors périmètre front).
- `flSet` (renommage des libellés depuis l'admin) non porté ici — l'écran d'admin des libellés
  (`FIELD_LABELS`) sera porté avec le module Paramétrage.

Preuve : capture `parity-app.html` → login → Front & Croissance → Contact Reports (seed + expand)
→ modale IA → 0 erreur runtime. Personnes liées, canaux, cas similaires conformes.
