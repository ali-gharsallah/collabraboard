# Parité — GED / Gestion électronique des documents (`ged`)

**Source** : `docs/reference/olive-demo.html`
- `GedScreen` : 31060–31183 · sous-composants `GedFonctionsTab`/`GedWorkflowTab`/`GedConnexionsTab`/
  `GedPuissanceTab` : 30635–30868 · données `GED_PLAN`/`GED_STATUS`/`GED_DOCS` : 30294–30309
- `GedVivant` (30870) et `GedOcrTab` (30442) : pilotés par le monde GED backend `OLIVE_GED_MONDE`/`OLIVE_PROOFS`

## Fichiers portés
- `apps/web/src/parity/legal-support.ts` — `GED_DOCS` désormais **seedé** (30 clients × 1-3 documents,
  déterministe `amlHash`, source 30297) + `corrLangOverlay` (langue de correspondance par client). Référence
  partagée GED ⇄ CRM (vue 360°) ⇄ Legal (génération de contrats) : **lève la consignation « Documents GED 0 »
  du CRM**.
- `apps/web/src/parity/ged-support.ts` — données statiques verbatim : `GED_PLAN`, `GED_STATUS`,
  `GED_FONCTIONS`, `GED_WORKFLOW_ETAGES`/`_TRANSVERSAUX`, `GED_CONNEXIONS`, `GED_PUISSANCE`,
  `GED_PUISSANCE_INVARIANTS`.
- `apps/web/src/parity/GedScreen.tsx` — écran 9 onglets porté verbatim : **Documents** (dépôt réel via
  `<input type=file>`, alerte langue ≠ correspondance, recherche plein texte, validation/archivage
  versionné, empreinte SHA-256 + rétention 10 ans par document), **Plan** de classement (comptage par
  code), **Workflow** (9 étages + transversaux), **Connexions** (inter-écrans), **Puissance** (eux/nous
  + invariants), **Fonctionnalités** (carte statuts), **API** (endpoints REST). Sous-composants statiques
  portés intégralement.
- Wiring `Shell.tsx` : `case "ged"` (prop `user`).

## Réutilise (déjà porté)
- `CLIENTS` (fixture), `clientById` (components-data), `settleHash` (settlement-support, empreinte),
  `pushParamAudit`, `GED_DOCS` (legal-support, seed partagé).

## Réellement calculé (pas figé)
- L'onglet Documents opère sur `GED_DOCS` : dépôt (upload réel, taille lue du fichier), validation (droit
  par rôle CO/CO_SR/CF/ADMIN/MLRO), archivage (incrémente la version), recherche plein texte, empreinte
  SHA-256 déterministe et compteurs de plan — tout muté en direct et tracé. Le seed alimente aussi la
  vue 360° du CRM.

## Consigné (hors périmètre parité)
- **GED vivante** (`GedVivant`) et **Vérification OCR** (`GedOcrTab`) reposent sur le monde GED backend
  (`OLIVE_GED_MONDE`/`OLIVE_PROOFS` — services GedIngestion/Coffre/Vues/OCR réels, harnais gouverné).
  Ces deux onglets affichent un panneau de consignation neutre (comme le Preuves moteur du Screening).
  Les 7 autres onglets sont pleinement fonctionnels. Dégradation fidèle et honnête.

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`GedScreen`, `GED_FONCTIONS`,
  `parity/` absents de `dist`).
- Dev-transform esbuild + Playwright : 0 erreur runtime ; onglets Documents (docs seedés) et Puissance conformes.
