# Note de câblage — KYC ↔ Workflow gouverné (KW-01..05) · Lot 35

**AUCUNE RÈGLE NOUVELLE.** Ce lot applique la clause **R172** (« le dossier emporte sa
version ») au dossier KYC réel — sans modifier un seul service ratifié :
`workflow/kyc-workflow.chaine.ts` est un **composeur**. Le KYC entre par un **port**
(`KycPort` : `create`/`get`) — le vrai `KycService` y est structurellement compatible ;
l'injection se fait au module NestJS (une ligne de wiring, pas un changement de service).

| Pièce | Ce qu'elle tient | Preuve |
|---|---|---|
| `ouvrirGouverne` | créer PUIS timbrer : la définition publiée applicable à la date d'ouverture fait foi ; **le timbre est un ÉVÉNEMENT append-only** (`kyc.dossier.workflow`) — pas de colonne ajoutée, l'état par l'événement | KW-01 |
| Grandfathering réel | dossier A sous v1, v2 publiée, dossier B sous v2 — **A garde v1, ses étapes aussi** ; même table, deux mondes | KW-02, KW-04 |
| Repli tracé | sans définition publiée : le dossier naît sur les **templates historiques** — comportement inchangé, mais `source: TEMPLATE` à l'événement — rien ne casse, tout se sait | KW-03 |
| Le timbre ne se rejoue pas | re-timbrer refuse | KW-05 |

Corpus : 293 + 5 KW = **298**. Reste (déploiement) : injecter le vrai `KycService` comme
`KycPort` dans `workflow.module` et router les créations de dossiers par `ouvrirGouverne`.
