# Fiche de parité — WfEngineScreen (Workflow Rules) — v1
Source : olive-demo.html **24150–24336** (WfRulesCatalogPanel + WfEngineScreen).
Ports : `WfEngineScreen.tsx` + fixture `RULES_CATALOG` (169 règles). Branché : NAV Workflow → « Workflow Rules » (`case "wfengine"`).
Porté verbatim : nav Designer/Instances/Audit, **catalogue R1→R104** (recherche, filtres tous/implémentées/
paramétrables/invariants, vue compacte, ancres par bloc, badges statut + invariant/paramétrable +
« comment paramétrer » / « pourquoi fixe »), règles du workflow (invariants WF_INVARIANTS + règles tenant
via `WF_ENGINE.addTenantRule`/`setTenantRuleActive`), propositions Olivia (`wfOliviaPropose` + adoption
tracée), versioning (événements REGLE_TENANT du journal moteur). Consomme le moteur OliveWfEngine porté.
Preuve : capture → 169 règles, blocs, R1/R2 IMPLÉMENTÉE·TESTÉE → 0 erreur runtime. Frontière : 80/80 · 177.5 kB gz.
