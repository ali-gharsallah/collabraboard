# MIGRATION-FRONT — journal des migrations d'écrans (A1/D3, règle du boy-scout)

Décision A1/D3 : **pas de big-bang**. `apiGet/apiPost/useApiOrSeed` et `theme/tokens.ts` sont
utilisés par tout code **nouveau ou modifié** ; les écrans existants (`apiGetSourced`, styles inline)
ne sont **pas** migrés préventivement — seulement quand ils sont touchés pour une autre raison.
Chaque migration d'un écran existant = **commit séparé, iso-fonctionnel**, listé ici (écran, date, delta).

| Écran migré | Date | Delta (avant → après) | Iso-fonctionnel |
|---|---|---|---|
| _(aucune migration à ce jour)_ | — | Les 31 écrans existants ne sont pas touchés. Les écrans **nouveaux** (Ports, NBA, Workflow Instances, Tâches) utilisent directement `api.ts`/`useApiOrSeed`/`tokens`. | — |

**Nouveaux écrans conformes dès l'origine (non des migrations)** : `Ports`, `NextBestAction` (Vague 10) ;
`WorkflowInstances`, `Tasks` (Vague 11, FE-05, tokens + seed lecture seule).
