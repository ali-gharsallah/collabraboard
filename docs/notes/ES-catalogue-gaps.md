# ES-5 — Types consommés par surveillance-es ABSENTS du catalogue central

Référence : docs/SURVEILLANCE-ES.md prompt ES-5. Le catalogue central
(apps/api/src/contracts/events-catalog.ts, P-L5-2) couvre 3 des 7 types consommés —
screening.escalade.proposee, pep.proposition.creee, pep.proposition.rejetee — désormais
IMPORTÉS (zéro duplication). Les 4 suivants restent en garde LOCALE
(surveillance-es/contracts/*.v1.ts) tant qu'ils ne sont pas schématisés au catalogue
(backlog : docs/notes/L5-events-todo.md) :

| Type | Garde locale | À schématiser au catalogue ? |
|---|---|---|
| tx.flux.importee | tx-flux-importee.v1.ts | Oui (famille tx.*, backlog L5) |
| kyc.validated | kyc-validated.v1.ts | Oui (famille kyc.*, backlog L5) |
| personne.pep.declare | personne-pep-declare.v1.ts | Oui (famille personne.pep.*, backlog L5) |
| personne.pep.leve | personne-pep-leve.v1.ts | Oui (famille personne.pep.*, backlog L5) |

Au fur et à mesure que le catalogue les couvre, la garde locale correspondante se supprime
et DU_CATALOGUE (contracts/index.ts) s'allonge — même geste qu'ES-5.
