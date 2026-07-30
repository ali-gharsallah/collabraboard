# Fiche de parité — ProspectionScreen (Pré-prospection) — v1

Source : `docs/reference/olive-demo.html` **31405–31468** (écran) + **31370–31404** (données/`crossSellFor`)
+ **21358** (`exoticOverlay`) + **30008** (`aumMOf`). Ports : `ProspectionScreen.tsx`,
`prospection-support.ts` (ajouts), `demo-init.ts`. Branché : NAV « Front & Croissance » →
« Pré-prospection » (`case "prospection"`).

## Porté (v1) — verbatim
- En-tête « 🧲 Pré-prospection » + compteurs (canaux · événements · opportunités cross-sell).
- 4 onglets :
  - **Où chercher** : `PROSPECTION_CHANNELS` (6 canaux : apporteurs, événements, liquidity events,
    réseaux, recommandation, cross-selling) — libellé, méthode, stats.
  - **Événements** : `PROSPECTION_EVENTS` (Art Basel, Geneva Watch Days, …) — date, cible, todo, RM, statut.
  - **Cross-selling** : `crossSellFor(user)` **réellement calculé** — Crédit Lombard (AUM ≥ 30M),
    Mandat discrétionnaire (dérive PMS ≥ 10%, via `pmsPortfolio`), Conseil patrimonial spécialisé
    (clients à secteur exotique), Planification successorale (≥ 50M) ; bouton « → CRM » qui pousse
    un contact report (`CONTACT_REPORTS.unshift`).
  - **Journal** : `PROSPECTION_LOG`.

## Intégration inter-modules (débloquée par le portage PMS)
- `crossSellFor` consomme le **moteur PMS** porté (`pmsPortfolio(c).drift`) → offres « Mandat
  discrétionnaire » avec dérives réelles (14.5%, 22.8%, 45.3%…).
- **`demo-init.ts`** (nouveau) rejoue les enrichissements globaux de démarrage de la maquette,
  idempotents, exécutés à l'import (comme les IIFE top-level) :
  - `runExoticOverlay()` — ~12% des clients reçoivent un secteur exotique (art, crypto, casinos…),
    passent LOW→MEDIUM, tagués SECTEUR-EXOTIQUE. Muté en place sur la fixture `CLIENTS` partagée →
    **tous les écrans en héritent** (fidèle à la maquette qui mute au chargement). Importé au sommet
    de `shell-entry.tsx` (démarrage app) et de `prospection-support.ts` (si Pré-prospection est le
    premier écran ouvert).
  - `aumMOf` — parseur AUM partagé.

Preuve : capture `parity-app.html` → login → Front & Croissance → Pré-prospection → onglets
« Où chercher » (6 canaux) & « Cross-selling » (24 offres, dérives PMS + secteurs exotiques) →
0 erreur runtime. Frontière : 80/80 vitest · build sans fuite parity · budget 177.5 kB gz.

## Note
Le groupe « Front & Croissance » n'a plus que **CRM Banque**, **Prochaines actions** (agrégateur
cross-module), **Business Trip** (couplé Cross-Border) en attente.
