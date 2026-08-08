# Note hors périmètre — recette visuelle FAT rouge depuis la nav groupée

**Constatée le 2026-08-08** pendant le bloc WD (React + NestJS), en repassant la suite
Playwright complète après ajout de `apps/web/playwright/wd-parcours.spec.mjs`.

## Constat

Les 5 scénarios de `apps/web/playwright/fat-visuel.spec.mjs` qui cliquent un point
d'entrée (« Règles AML », « Chgt circonstances », « Account Review », « Offboarding »,
« Olivia ») sont ROUGES : ils attendent des boutons d'onglet **directs** dans la barre
latérale, alors que la navigation React est désormais **groupée** (menu latéral à groupes
repliés, `src/app/router.tsx` — arborescence reprise de la maquette). Le bouton n'est
visible qu'après ouverture du groupe parent.

- Panne PRÉEXISTANTE au bloc WD : la nav groupée a été livrée dans une session antérieure ;
  le spec `fat-visuel` n'a pas suivi. Les dossiers `apps/web/test-results/` périmés en
  témoignent.
- Impact CI : **aucun blocage** — le workflow `.github/workflows/fat-visuel.yml` est
  non bloquant par décision PO 2026-07-29 (« API pour la porte CI + Playwright en job
  séparé », `continue-on-error: true`). La porte bloquante reste la suite FAT API.
- Le test « shell boote » et les 3 scénarios WD (`wd-parcours.spec.mjs`) sont VERTS.

## Correctif — APPLIQUÉ (session suivante, même jour)

Dans `fat-visuel.spec.mjs`, chaque parcours phare porte désormais son groupe parent
(`{ groupe: "Compliance & Risque", onglet: "Règles AML" }`, etc.) et le test ouvre le
groupe avant d'asserter l'onglet — même geste que `wd-parcours.spec.mjs`. Suite complète
re-mesurée verte (9/9 : shell + 5 parcours phares + 3 WD) sur le bundle construit.
