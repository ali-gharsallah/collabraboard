# Fiche de parité — OILScreen + moteur workflow OliveWfEngine — v1
Sources : olive-demo.html **21819–22615** (moteur), **24964–25193** (OIL).
Ports : `olive-wf-engine.tsx` (moteur event-sourced R1-R62 + wfSemerDemo + WfBranche/WfPuce +
wfPreuve4Yeux/wfOliviaPropose/wfRejoue + WF_ENGINE/WF_IDS/WF_TITULAIRES/WF_ACTEURS/WF_INVARIANTS/
WF_TYPES_RT/WF_VCOL), `oil-support.ts` (oilAnalyse/oilAdvisor + OIL_CATALOGUE/PRODUITS/DOCS/MATRICE +
seed Sharia Board), `OILScreen.tsx`, `wf-styles.ts`. Branché : NAV Wealth → « OIL — Islamic Layer ».

Porté verbatim : moteur workflow complet (émission d'événements append-only, projections, 4-yeux R13,
refus motivé R7, engagement R14, dérogations R4, récusation R57, habilitation R58, double visa R59,
fraîcheur R60, anti-goulot R61, export scellé SHA-256 R62). OIL 6 onglets : Sharia Analyser (ratios
AAOIFI dette≤33/liq≤49/rnc≤5 + purification), Produits conformes (label live), Sharia Board (dossiers
sur le moteur, WfBranche = état visas par section), Matrice documentaire (produits × docs), AI Advisor
(oilAdvisor par mots-clés), Sharia Audit (contrôles live + journal d'événements).

Le moteur débloque aussi wfdesigner / wfengine / wfmanagement / sandbox (à porter).
Preuve : capture Board → OIL-2026-001 (QUANT visé / SCHOL1 en attente / SCHOL2 en prépa) → 0 erreur
runtime. Frontière : 80/80 · budget 177.5 kB gz.
