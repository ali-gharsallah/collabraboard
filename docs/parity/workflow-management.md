# Fiche de parité — WorkflowManagementScreen (Instances / Designer) — v1
Source : olive-demo.html **15399–15496** (données/helpers) + **41667–41836** (écran).
Ports : `WorkflowManagementScreen.tsx` + `wf-mgmt-support.ts` + `param-audit-support.ts` (+ OFF_ROLE_SEQ).
Branché : NAV Workflow → « Instances de workflow » (`wfmanagement`) ET « Workflow Designer » (`wfdesigner`)
— la maquette route les deux vers ce même écran (fixedTab ignoré dans la source).
Porté verbatim : 5 onglets — Dashboard (12 templates WF_MGMT_TEMPLATES, étapes + instances calculées
live par wfMgmtInstanceCount depuis PROSPECTS/ACCOUNT_REVIEWS/OFFBOARDING_CASES/groupes UBO), Designer
(rail d'étapes cliquables + Step Configuration : name/approval/owner/validator/SLA/visa/comments/
description/escalation via wfMgmtUpdateStep, ajout/suppression d'étape), Instances (table dérivée),
History (PARAM_AUDIT partagé), Parameters (lecture, applicabilité WF_MGMT_APPLICABILITY).
Consigné : window.OLIVE_NAVIGATE (bouton Gouvernance) → no-op garde.
Preuve : capture Dashboard → 12 templates, compteurs d'instances corrects → 0 erreur runtime.
Frontière : 80/80 · 177.5 kB gz. Groupe Workflow complet (wfengine + wfmanagement + wfdesigner).
