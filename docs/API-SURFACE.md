# O-Live — Surface d'API (GÉNÉRÉ — ne pas éditer à la main)

> Source : `tools/api-contract/api-surface.snapshot.txt` (contrat RB-07, vérifié en CI).
> Régénérer : `node tools/api-contract/generer-doc.mjs > docs/API-SURFACE.md`.
> La documentation VIVANTE (extraite du routeur au runtime) est servie par `GET /v1/apidoc` ;
> ce document en est la projection committée, au même niveau que le snapshot.

**439 routes** · **60 modules** · préfixe global `/v1` · authentification JWT RS256 (le contexte tenant vient du jeton, R328) · RLS FORCE par tenant.

| Module | Routes |
|---|---|
| [`.well-known`](#well-known) | 1 |
| [`admin`](#admin) | 11 |
| [`aml`](#aml) | 20 |
| [`apidoc`](#apidoc) | 1 |
| [`audit`](#audit) | 4 |
| [`auth`](#auth) | 6 |
| [`bi`](#bi) | 2 |
| [`builder`](#builder) | 5 |
| [`clients`](#clients) | 3 |
| [`coc`](#coc) | 8 |
| [`corebanking`](#corebanking) | 2 |
| [`cpsi`](#cpsi) | 29 |
| [`crm`](#crm) | 4 |
| [`crossborder`](#crossborder) | 17 |
| [`custody`](#custody) | 3 |
| [`deploiements`](#deploiements) | 2 |
| [`doc-matrix`](#doc-matrix) | 3 |
| [`events`](#events) | 3 |
| [`formations`](#formations) | 8 |
| [`fx`](#fx) | 1 |
| [`ged`](#ged) | 8 |
| [`healthz`](#healthz) | 1 |
| [`ia`](#ia) | 5 |
| [`inference`](#inference) | 2 |
| [`islamic`](#islamic) | 10 |
| [`kyc`](#kyc) | 35 |
| [`legal`](#legal) | 6 |
| [`mobile`](#mobile) | 11 |
| [`modules`](#modules) | 3 |
| [`mros`](#mros) | 9 |
| [`nba`](#nba) | 4 |
| [`offboarding`](#offboarding) | 9 |
| [`offboarding-moteur`](#offboarding-moteur) | 8 |
| [`olivia`](#olivia) | 28 |
| [`onboarding`](#onboarding) | 5 |
| [`oprisk`](#oprisk) | 8 |
| [`parametres`](#parametres) | 5 |
| [`personnes`](#personnes) | 9 |
| [`pms`](#pms) | 7 |
| [`ports`](#ports) | 3 |
| [`rapports`](#rapports) | 6 |
| [`readyz`](#readyz) | 1 |
| [`regwatch`](#regwatch) | 5 |
| [`reviews`](#reviews) | 10 |
| [`revues`](#revues) | 18 |
| [`riskcases`](#riskcases) | 8 |
| [`sandbox`](#sandbox) | 5 |
| [`screening`](#screening) | 14 |
| [`surveillance-es`](#surveillance-es) | 6 |
| [`swift`](#swift) | 3 |
| [`ta`](#ta) | 4 |
| [`tasks`](#tasks) | 8 |
| [`transactions`](#transactions) | 4 |
| [`trips`](#trips) | 15 |
| [`txflux`](#txflux) | 3 |
| [`txrisk`](#txrisk) | 2 |
| [`workflow`](#workflow) | 5 |
| [`workflow-designer`](#workflow-designer) | 4 |
| [`workflow-instances`](#workflow-instances) | 3 |
| [`workload`](#workload) | 6 |

## .well-known

| Méthode | Chemin |
|---|---|
| GET | `/v1/.well-known/jwks.json` |

## admin

| Méthode | Chemin |
|---|---|
| GET | `/v1/admin/iam/guide` |
| GET | `/v1/admin/sso/etat` |
| POST | `/v1/admin/sso/jwks/rotation` |
| POST | `/v1/admin/sso/mode` |
| POST | `/v1/admin/sso/mode/visa` |
| POST | `/v1/admin/sso/test` |
| GET | `/v1/admin/users` |
| POST | `/v1/admin/users` |
| POST | `/v1/admin/users/:id/active` |
| POST | `/v1/admin/users/:id/reset-mfa` |
| POST | `/v1/admin/users/:id/role` |

## aml

| Méthode | Chemin |
|---|---|
| GET | `/v1/aml/clients/:id/signaux` |
| POST | `/v1/aml/eval/backtest` |
| POST | `/v1/aml/eval/backtest-version` |
| POST | `/v1/aml/eval/btl` |
| POST | `/v1/aml/eval/calibrage-annuel` |
| POST | `/v1/aml/eval/client` |
| POST | `/v1/aml/eval/client-async` |
| POST | `/v1/aml/eval/dq` |
| POST | `/v1/aml/eval/drain` |
| POST | `/v1/aml/evaluer` |
| GET | `/v1/aml/ground-truth` |
| GET | `/v1/aml/ground-truth/db` |
| POST | `/v1/aml/ground-truth/seed` |
| GET | `/v1/aml/referentiel` |
| POST | `/v1/aml/sandbox` |
| GET | `/v1/aml/scenarios` |
| GET | `/v1/aml/signals` |
| POST | `/v1/aml/signals` |
| POST | `/v1/aml/signals/:id/qualify` |
| POST | `/v1/aml/signals/evaluate-2g` |

## apidoc

| Méthode | Chemin |
|---|---|
| GET | `/v1/apidoc` |

## audit

| Méthode | Chemin |
|---|---|
| GET | `/v1/audit/acces` |
| POST | `/v1/audit/export` |
| GET | `/v1/audit/integrite` |
| GET | `/v1/audit/parametrages` |

## auth

| Méthode | Chemin |
|---|---|
| POST | `/v1/auth/login` |
| POST | `/v1/auth/methode` |
| POST | `/v1/auth/mfa/confirm` |
| POST | `/v1/auth/mfa/enroll` |
| POST | `/v1/auth/oidc/login` |
| POST | `/v1/auth/token` |

## bi

| Méthode | Chemin |
|---|---|
| POST | `/v1/bi/annuaire` |
| POST | `/v1/bi/requete` |

## builder

| Méthode | Chemin |
|---|---|
| GET | `/v1/builder/artefacts` |
| POST | `/v1/builder/artefacts` |
| POST | `/v1/builder/artefacts/:id/publier` |
| POST | `/v1/builder/artefacts/:id/simuler` |
| GET | `/v1/builder/publications` |

## clients

| Méthode | Chemin |
|---|---|
| GET | `/v1/clients` |
| POST | `/v1/clients` |
| POST | `/v1/clients/:id/events` |

## coc

| Méthode | Chemin |
|---|---|
| GET | `/v1/coc` |
| POST | `/v1/coc` |
| GET | `/v1/coc/:id/replay` |
| POST | `/v1/coc/:id/traiter` |
| POST | `/v1/coc/:id/transition` |
| GET | `/v1/coc/config` |
| POST | `/v1/coc/config` |
| GET | `/v1/coc/reporting` |

## corebanking

| Méthode | Chemin |
|---|---|
| GET | `/v1/corebanking/etat` |
| POST | `/v1/corebanking/importer` |

## cpsi

| Méthode | Chemin |
|---|---|
| GET | `/v1/cpsi/alerts` |
| GET | `/v1/cpsi/case-proposals` |
| POST | `/v1/cpsi/case-proposals` |
| POST | `/v1/cpsi/clients` |
| GET | `/v1/cpsi/clients/:cid/groups` |
| POST | `/v1/cpsi/clients/:cid/insider` |
| POST | `/v1/cpsi/clients/:cid/insider/lift` |
| GET | `/v1/cpsi/clients/:cid/score` |
| POST | `/v1/cpsi/clients/:cid/signals` |
| GET | `/v1/cpsi/clients/:cid/timeline` |
| GET | `/v1/cpsi/compliance-catalogue` |
| POST | `/v1/cpsi/false-positives` |
| GET | `/v1/cpsi/groups` |
| POST | `/v1/cpsi/groups` |
| GET | `/v1/cpsi/health` |
| POST | `/v1/cpsi/params/apply` |
| GET | `/v1/cpsi/params/history` |
| GET | `/v1/cpsi/params/proposals` |
| POST | `/v1/cpsi/params/proposals` |
| POST | `/v1/cpsi/params/proposals/:pid/adopt` |
| POST | `/v1/cpsi/params/proposals/:pid/reject` |
| GET | `/v1/cpsi/reporting/sla` |
| POST | `/v1/cpsi/reporting/sla/tick` |
| GET | `/v1/cpsi/rules` |
| POST | `/v1/cpsi/sandbox/simulate` |
| POST | `/v1/cpsi/scenarios` |
| GET | `/v1/cpsi/scenarios/:sid/evaluate` |
| GET | `/v1/cpsi/segmentation` |
| GET | `/v1/cpsi/volumetrie` |

## crm

| Méthode | Chemin |
|---|---|
| POST | `/v1/crm/clients/:id/entretiens` |
| POST | `/v1/crm/clients/:id/entretiens/pre-remplir` |
| GET | `/v1/crm/clients/:id/gestes` |
| GET | `/v1/crm/clients/:id/timeline` |

## crossborder

| Méthode | Chemin |
|---|---|
| POST | `/v1/crossborder/actes-distants` |
| GET | `/v1/crossborder/actes/:id/rejeu` |
| POST | `/v1/crossborder/check` |
| POST | `/v1/crossborder/derogations` |
| POST | `/v1/crossborder/derogations/:id/visa` |
| GET | `/v1/crossborder/exposition` |
| POST | `/v1/crossborder/localisations` |
| GET | `/v1/crossborder/matrice` |
| POST | `/v1/crossborder/matrice/sync` |
| POST | `/v1/crossborder/ordres` |
| POST | `/v1/crossborder/params/modifier` |
| GET | `/v1/crossborder/params/registre` |
| POST | `/v1/crossborder/pre-acte` |
| GET | `/v1/crossborder/reporting` |
| POST | `/v1/crossborder/reverse-solicitation` |
| POST | `/v1/crossborder/reverse-solicitation/:id/visa` |
| GET | `/v1/crossborder/voyages/:id/conformite` |

## custody

| Méthode | Chemin |
|---|---|
| POST | `/v1/custody/ecarts/resoudre` |
| GET | `/v1/custody/positions` |
| GET | `/v1/custody/rapprochement` |

## deploiements

| Méthode | Chemin |
|---|---|
| GET | `/v1/deploiements` |
| POST | `/v1/deploiements` |

## doc-matrix

| Méthode | Chemin |
|---|---|
| POST | `/v1/doc-matrix` |
| POST | `/v1/doc-matrix/completude` |
| GET | `/v1/doc-matrix/en-vigueur` |

## events

| Méthode | Chemin |
|---|---|
| POST | `/v1/events/dead-letters/:id/rejouer` |
| GET | `/v1/events/sante` |
| GET | `/v1/events/stream` |

## formations

| Méthode | Chemin |
|---|---|
| GET | `/v1/formations/assignments` |
| POST | `/v1/formations/assignments` |
| POST | `/v1/formations/assignments/:id/complete` |
| POST | `/v1/formations/assignments/:id/visa` |
| GET | `/v1/formations/catalog` |
| GET | `/v1/formations/certifications` |
| POST | `/v1/formations/certifications` |
| POST | `/v1/formations/rappels/tick` |

## fx

| Méthode | Chemin |
|---|---|
| GET | `/v1/fx/exposition` |

## ged

| Méthode | Chemin |
|---|---|
| GET | `/v1/ged/documents` |
| POST | `/v1/ged/documents` |
| GET | `/v1/ged/documents/:id` |
| POST | `/v1/ged/documents/:id/classement` |
| GET | `/v1/ged/documents/:id/contenu/:versionId` |
| POST | `/v1/ged/documents/:id/gel` |
| GET | `/v1/ged/recherche` |
| GET | `/v1/ged/vues/:code` |

## healthz

| Méthode | Chemin |
|---|---|
| GET | `/v1/healthz` |

## ia

| Méthode | Chemin |
|---|---|
| GET | `/v1/ia/prerevue/:id` |
| POST | `/v1/ia/prerevue/:id/points/:idx` |
| POST | `/v1/ia/prerevue/kyc/:id` |
| GET | `/v1/ia/prerevue/kyc/:id/traitement` |
| POST | `/v1/ia/prerevue/prompt` |

## inference

| Méthode | Chemin |
|---|---|
| GET | `/v1/inference/:kycId/explain/:rid` |
| GET | `/v1/inference/:kycId/ledger` |

## islamic

| Méthode | Chemin |
|---|---|
| POST | `/v1/islamic/audit` |
| GET | `/v1/islamic/clients/:id/signaux` |
| GET | `/v1/islamic/clients/:id/zakat` |
| POST | `/v1/islamic/evaluer` |
| POST | `/v1/islamic/mudaraba` |
| POST | `/v1/islamic/qard` |
| POST | `/v1/islamic/sukuk/maturite` |
| POST | `/v1/islamic/takaful` |
| POST | `/v1/islamic/waqf/retrait` |
| POST | `/v1/islamic/zakat` |

## kyc

| Méthode | Chemin |
|---|---|
| GET | `/v1/kyc` |
| POST | `/v1/kyc` |
| GET | `/v1/kyc/:code` |
| GET | `/v1/kyc/:code/a-date` |
| POST | `/v1/kyc/:code/abandonner` |
| GET | `/v1/kyc/:code/access-matrix` |
| POST | `/v1/kyc/:code/changement-circonstances` |
| POST | `/v1/kyc/:code/comite` |
| POST | `/v1/kyc/:code/effacement-lpd` |
| POST | `/v1/kyc/:code/geler-hit` |
| POST | `/v1/kyc/:code/handoff/back` |
| POST | `/v1/kyc/:code/handoff/next` |
| POST | `/v1/kyc/:code/handoff/reject` |
| POST | `/v1/kyc/:code/handoff/validate` |
| POST | `/v1/kyc/:code/lock` |
| GET | `/v1/kyc/:code/operation-autorisee` |
| POST | `/v1/kyc/:code/pass-hand` |
| GET | `/v1/kyc/:code/processes` |
| POST | `/v1/kyc/:code/processes` |
| POST | `/v1/kyc/:code/processes/:processId/cloturer` |
| POST | `/v1/kyc/:code/processes/:processId/reprendre` |
| PATCH | `/v1/kyc/:code/questions/:qcode` |
| PATCH | `/v1/kyc/:code/questions/:qcode/access` |
| POST | `/v1/kyc/:code/reactiver` |
| POST | `/v1/kyc/:code/release` |
| POST | `/v1/kyc/:code/request-hand` |
| POST | `/v1/kyc/:code/suspendre` |
| POST | `/v1/kyc/:code/validate` |
| POST | `/v1/kyc/:code/visas/:section` |
| POST | `/v1/kyc/:code/visas/:section/annuler-vice` |
| POST | `/v1/kyc/:code/visas/:section/reassign` |
| POST | `/v1/kyc/:code/visas/:section/revoke` |
| GET | `/v1/kyc/:code/voir-comme/:role` |
| GET | `/v1/kyc/visas/charge` |
| GET | `/v1/kyc/visas/pending` |

## legal

| Méthode | Chemin |
|---|---|
| GET | `/v1/legal/echeances` |
| GET | `/v1/legal/objets` |
| POST | `/v1/legal/objets` |
| POST | `/v1/legal/objets/:id/dates` |
| GET | `/v1/legal/par-reference` |
| POST | `/v1/legal/tick` |

## mobile

| Méthode | Chemin |
|---|---|
| POST | `/v1/mobile/activer` |
| POST | `/v1/mobile/auth/activer` |
| POST | `/v1/mobile/auth/login` |
| GET | `/v1/mobile/client/comptes` |
| GET | `/v1/mobile/client/documents` |
| GET | `/v1/mobile/client/messages` |
| POST | `/v1/mobile/client/messages` |
| GET | `/v1/mobile/messages` |
| POST | `/v1/mobile/messages/:clientId/repondre` |
| POST | `/v1/mobile/messages/:id/ouvrir-coc` |
| POST | `/v1/mobile/partager` |

## modules

| Méthode | Chemin |
|---|---|
| GET | `/v1/modules/actifs` |
| POST | `/v1/modules/licence` |
| POST | `/v1/modules/licence/tick` |

## mros

| Méthode | Chemin |
|---|---|
| GET | `/v1/mros` |
| GET | `/v1/mros/:id` |
| POST | `/v1/mros/:id/gel` |
| POST | `/v1/mros/:id/gel/lever` |
| GET | `/v1/mros/:id/goaml` |
| POST | `/v1/mros/:id/goaml/soumettre` |
| POST | `/v1/mros/:id/notification` |
| POST | `/v1/mros/chrono/tick` |
| POST | `/v1/mros/decider` |

## nba

| Méthode | Chemin |
|---|---|
| GET | `/v1/nba` |
| GET | `/v1/nba/:id` |
| POST | `/v1/nba/:id/decision` |
| POST | `/v1/nba/propose` |

## offboarding

| Méthode | Chemin |
|---|---|
| GET | `/v1/offboarding` |
| POST | `/v1/offboarding` |
| GET | `/v1/offboarding/:id` |
| POST | `/v1/offboarding/:id/attestation-avoirs` |
| GET | `/v1/offboarding/:id/courrier` |
| POST | `/v1/offboarding/:id/documents` |
| POST | `/v1/offboarding/:id/transition` |
| POST | `/v1/offboarding/:id/visa` |
| GET | `/v1/offboarding/statut/:clientId` |

## offboarding-moteur

| Méthode | Chemin |
|---|---|
| POST | `/v1/offboarding-moteur/instances` |
| GET | `/v1/offboarding-moteur/instances/:id` |
| POST | `/v1/offboarding-moteur/instances/:id/checklist` |
| GET | `/v1/offboarding-moteur/instances/:id/health` |
| GET | `/v1/offboarding-moteur/instances/:id/trail` |
| POST | `/v1/offboarding-moteur/instances/:id/viser` |
| GET | `/v1/offboarding-moteur/params` |
| PATCH | `/v1/offboarding-moteur/params` |

## olivia

| Méthode | Chemin |
|---|---|
| GET | `/v1/olivia/agents` |
| POST | `/v1/olivia/agents` |
| GET | `/v1/olivia/agents/:code/en-vigueur` |
| POST | `/v1/olivia/agents/:code/retirer` |
| POST | `/v1/olivia/conversations` |
| GET | `/v1/olivia/conversations/:id` |
| POST | `/v1/olivia/conversations/:id/feedback` |
| POST | `/v1/olivia/conversations/:id/messages` |
| GET | `/v1/olivia/conversations/:id/replay` |
| GET | `/v1/olivia/gouvernance/curseur` |
| POST | `/v1/olivia/gouvernance/curseur` |
| GET | `/v1/olivia/gouvernance/rapport-valeur` |
| GET | `/v1/olivia/health` |
| GET | `/v1/olivia/missions` |
| GET | `/v1/olivia/proposals` |
| POST | `/v1/olivia/proposals` |
| POST | `/v1/olivia/proposals/:id/adopt` |
| POST | `/v1/olivia/proposals/:id/reject` |
| GET | `/v1/olivia/runs` |
| POST | `/v1/olivia/runs` |
| GET | `/v1/olivia/runs/:id` |
| POST | `/v1/olivia/runs/:id/gate-decision` |
| GET | `/v1/olivia/runs/:id/replay` |
| POST | `/v1/olivia/runs/:id/stop` |
| GET | `/v1/olivia/runs/agregat` |
| POST | `/v1/olivia/runs/reprise` |
| GET | `/v1/olivia/tools` |
| POST | `/v1/olivia/tools` |

## onboarding

| Méthode | Chemin |
|---|---|
| GET | `/v1/onboarding` |
| POST | `/v1/onboarding` |
| GET | `/v1/onboarding/:id/funnel` |
| POST | `/v1/onboarding/:id/transition` |
| POST | `/v1/onboarding/sandbox` |

## oprisk

| Méthode | Chemin |
|---|---|
| GET | `/v1/oprisk/actions` |
| POST | `/v1/oprisk/actions` |
| POST | `/v1/oprisk/actions/:id/statut` |
| GET | `/v1/oprisk/heatmap` |
| GET | `/v1/oprisk/incidents` |
| POST | `/v1/oprisk/incidents` |
| POST | `/v1/oprisk/incidents/:id/transition` |
| POST | `/v1/oprisk/tick` |

## parametres

| Méthode | Chemin |
|---|---|
| POST | `/v1/parametres/activer` |
| GET | `/v1/parametres/config` |
| GET | `/v1/parametres/registre` |
| GET | `/v1/parametres/valeur/:cle` |
| POST | `/v1/parametres/valeur/:cle` |

## personnes

| Méthode | Chemin |
|---|---|
| POST | `/v1/personnes` |
| POST | `/v1/personnes/:id/coc` |
| POST | `/v1/personnes/:id/corroboration` |
| POST | `/v1/personnes/:id/pep` |
| POST | `/v1/personnes/:id/pep/lever` |
| GET | `/v1/personnes/:id/relations` |
| POST | `/v1/personnes/:id/roles` |
| POST | `/v1/personnes/pep/propositions/rejeter` |
| POST | `/v1/personnes/relations` |

## pms

| Méthode | Chemin |
|---|---|
| GET | `/v1/pms/breaches` |
| POST | `/v1/pms/breaches/:id/clore` |
| GET | `/v1/pms/clients/:id/adequation` |
| GET | `/v1/pms/mandats` |
| POST | `/v1/pms/mandats` |
| POST | `/v1/pms/mandats/:id/pre-trade` |
| GET | `/v1/pms/mandats/:id/valoriser` |

## ports

| Méthode | Chemin |
|---|---|
| GET | `/v1/ports` |
| GET | `/v1/ports/:portId/health` |
| POST | `/v1/ports/:portId/health` |

## rapports

| Méthode | Chemin |
|---|---|
| GET | `/v1/rapports/derogations` |
| GET | `/v1/rapports/hits` |
| GET | `/v1/rapports/kpi` |
| GET | `/v1/rapports/kpi/trimestre` |
| GET | `/v1/rapports/pep` |
| GET | `/v1/rapports/retards-recertification` |

## readyz

| Méthode | Chemin |
|---|---|
| GET | `/v1/readyz` |

## regwatch

| Méthode | Chemin |
|---|---|
| POST | `/v1/regwatch/collecter` |
| POST | `/v1/regwatch/digest` |
| GET | `/v1/regwatch/items` |
| POST | `/v1/regwatch/items/:empreinte/proposer` |
| POST | `/v1/regwatch/items/:empreinte/qualifier` |

## reviews

| Méthode | Chemin |
|---|---|
| POST | `/v1/reviews/clients/:clientId/recalcul` |
| GET | `/v1/reviews/deadlines` |
| POST | `/v1/reviews/deadlines/:id/anticiper` |
| POST | `/v1/reviews/deadlines/:id/lancer` |
| POST | `/v1/reviews/deadlines/:id/report` |
| POST | `/v1/reviews/deadlines/:id/report/visa` |
| POST | `/v1/reviews/kyc/:code/reconfirmer/:section` |
| POST | `/v1/reviews/kyc/:code/signaler-changement` |
| GET | `/v1/reviews/profils` |
| POST | `/v1/reviews/tick` |

## revues

| Méthode | Chemin |
|---|---|
| POST | `/v1/revues/clients/:id/risque` |
| POST | `/v1/revues/deadlines/:id/ouvrir` |
| GET | `/v1/revues/dossiers/:ref` |
| GET | `/v1/revues/gar/:id/consolidee` |
| POST | `/v1/revues/gar/:id/decision` |
| GET | `/v1/revues/gar/:id/rejeu` |
| GET | `/v1/revues/groupes` |
| POST | `/v1/revues/groupes/declencher` |
| POST | `/v1/revues/kyc/:code/aiguillage` |
| POST | `/v1/revues/kyc/:code/cloturer` |
| GET | `/v1/revues/kyc/:code/delta` |
| POST | `/v1/revues/kyc/:code/delta/visa` |
| POST | `/v1/revues/kyc/:code/reponse` |
| POST | `/v1/revues/kyc/:code/verdict` |
| POST | `/v1/revues/kyc/:code/visa-bloc` |
| POST | `/v1/revues/membres/declencher` |
| POST | `/v1/revues/params/modifier` |
| GET | `/v1/revues/params/registre` |

## riskcases

| Méthode | Chemin |
|---|---|
| GET | `/v1/riskcases` |
| POST | `/v1/riskcases` |
| POST | `/v1/riskcases/:id/detacher` |
| GET | `/v1/riskcases/:id/notes` |
| POST | `/v1/riskcases/:id/notes` |
| POST | `/v1/riskcases/:id/rattacher` |
| POST | `/v1/riskcases/:id/transition` |
| POST | `/v1/riskcases/consommer-proposition` |

## sandbox

| Méthode | Chemin |
|---|---|
| POST | `/v1/sandbox/brm-seuils` |
| POST | `/v1/sandbox/cf-exigences` |
| POST | `/v1/sandbox/kyc-droits` |
| POST | `/v1/sandbox/onb-aiguillage` |
| POST | `/v1/sandbox/wf-delais` |

## screening

| Méthode | Chemin |
|---|---|
| GET | `/v1/screening/config` |
| POST | `/v1/screening/config` |
| GET | `/v1/screening/hits` |
| POST | `/v1/screening/hits/:id/qualify` |
| GET | `/v1/screening/hits/export` |
| GET | `/v1/screening/hits/export.csv` |
| GET | `/v1/screening/listes` |
| POST | `/v1/screening/listes/importer` |
| POST | `/v1/screening/listes/purger` |
| POST | `/v1/screening/run` |
| POST | `/v1/screening/run-flux` |
| POST | `/v1/screening/run-swift` |
| GET | `/v1/screening/runs` |
| POST | `/v1/screening/runs/:id/replay` |

## surveillance-es

| Méthode | Chemin |
|---|---|
| GET | `/v1/surveillance-es/alertes` |
| GET | `/v1/surveillance-es/etat` |
| GET | `/v1/surveillance-es/hits` |
| GET | `/v1/surveillance-es/hits/:hitId` |
| GET | `/v1/surveillance-es/pep` |
| GET | `/v1/surveillance-es/pep/:personId` |

## swift

| Méthode | Chemin |
|---|---|
| POST | `/v1/swift/analyser` |
| GET | `/v1/swift/messages` |
| GET | `/v1/swift/quarantaine` |

## ta

| Méthode | Chemin |
|---|---|
| POST | `/v1/ta/mouvements` |
| POST | `/v1/ta/mouvements/:ref/contrepasser` |
| POST | `/v1/ta/mouvements/:ref/visa` |
| GET | `/v1/ta/registre` |

## tasks

| Méthode | Chemin |
|---|---|
| GET | `/v1/tasks` |
| POST | `/v1/tasks` |
| POST | `/v1/tasks/:id/complete` |
| POST | `/v1/tasks/:id/delegate` |
| POST | `/v1/tasks/:id/reassign` |
| POST | `/v1/tasks/from-event` |
| POST | `/v1/tasks/routed` |
| POST | `/v1/tasks/sla/tick` |

## transactions

| Méthode | Chemin |
|---|---|
| POST | `/v1/transactions/:id/decider` |
| GET | `/v1/transactions/:id/statut-client` |
| POST | `/v1/transactions/evaluer` |
| GET | `/v1/transactions/revue` |

## trips

| Méthode | Chemin |
|---|---|
| GET | `/v1/trips` |
| POST | `/v1/trips` |
| GET | `/v1/trips/:id` |
| POST | `/v1/trips/:id/certificat` |
| POST | `/v1/trips/:id/certificat/visa` |
| POST | `/v1/trips/:id/contact-reports/mesurer` |
| POST | `/v1/trips/:id/modifier` |
| POST | `/v1/trips/:id/prospects` |
| GET | `/v1/trips/:id/rejouer-check` |
| POST | `/v1/trips/:id/revise` |
| POST | `/v1/trips/:id/submit` |
| POST | `/v1/trips/:id/visa` |
| POST | `/v1/trips/certificats/tick-sla` |
| POST | `/v1/trips/params/modifier` |
| GET | `/v1/trips/params/registre` |

## txflux

| Méthode | Chemin |
|---|---|
| GET | `/v1/txflux` |
| GET | `/v1/txflux/etat` |
| POST | `/v1/txflux/importer` |

## txrisk

| Méthode | Chemin |
|---|---|
| POST | `/v1/txrisk/alimenter` |
| GET | `/v1/txrisk/tendances` |

## workflow

| Méthode | Chemin |
|---|---|
| GET | `/v1/workflow/definitions` |
| POST | `/v1/workflow/definitions` |
| PATCH | `/v1/workflow/definitions/:id` |
| POST | `/v1/workflow/definitions/:id/publier` |
| GET | `/v1/workflow/resoudre` |

## workflow-designer

| Méthode | Chemin |
|---|---|
| GET | `/v1/workflow-designer/:id` |
| PATCH | `/v1/workflow-designer/:id/ir` |
| POST | `/v1/workflow-designer/:id/ratify` |
| POST | `/v1/workflow-designer/import` |

## workflow-instances

| Méthode | Chemin |
|---|---|
| GET | `/v1/workflow-instances` |
| GET | `/v1/workflow-instances/:id` |
| GET | `/v1/workflow-instances/:id/events` |

## workload

| Méthode | Chemin |
|---|---|
| GET | `/v1/workload/equipes/:role` |
| POST | `/v1/workload/equipes/:role/snapshot-rh` |
| POST | `/v1/workload/equipes/:role/surcharges` |
| GET | `/v1/workload/mesures/:userId` |
| GET | `/v1/workload/points/:userId` |
| POST | `/v1/workload/taches/:id/reassigner` |

