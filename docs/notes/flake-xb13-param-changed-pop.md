# Note hors périmètre — XB-13 fragile à l'ordre physique (découvert le 2026-08-09, session Bloc 65 B)

`test/e2e/cross-border-moteur.e2e-spec.ts` (XB-13, ~L271) lit le « dernier » PARAM_CHANGED par
`findMany({ where: { tenantId, type: "PARAM_CHANGED" } }).pop()` — **sans `orderBy`**. Postgres ne
garantit pas l'ordre physique : sous la passe complète (75 suites), le `.pop()` a rendu
`acteDistant.severiteNON` au lieu de `preActe.severites.MKT` (1 échec, vert au retry — régime
CI §8). Fix trivial quand un prompt l'ouvrira : `orderBy: { id: "desc" }, take: 1` (ou
`orderBy: { id: "asc" }` + `.pop()`), et balayer les autres `.pop()` sans orderBy des suites e2e.
Aucune incidence moteur — défaut de TEST uniquement.
