# `missionsActives` : un interrupteur d'activation sans clé au registre gouverné

**Découvert** : lot V2-M47, en confrontant le sous-onglet « Runs Olivia » à l'API vivante.
**Statut** : HORS PÉRIMÈTRE du lot — consigné, non corrigé (discipline CLAUDE.md).

## Le constat, reproductible

```
GET  /v1/olivia/missions        → {"actives":[],"declarees":["PREREVUE_DOSSIER","ANALYSE_CORRELATION"]}
POST /v1/olivia/runs            → 403 RUN_MISSION_INACTIVE: « PREREVUE_DOSSIER » n'est pas dans
                                  missions_actives (SW-18 — activation explicite, pattern R177/HO-02)
POST /v1/parametres/valeur/missionsActives
                                → 400 R125 : clé inconnue du registre — «missionsActives»
GET  /v1/parametres/registre    → 251 clés, AUCUNE ne contient « mission », « run » ou « olivia »
```

`swarm.module.ts:248` lit `settings.missionsActives` directement dans les *settings* du tenant.
La valeur par défaut `[]` est délibérée et juste (B.5/SW-18 : la v2 est ÉTEINTE tant qu'on ne
l'allume pas, exactement comme R177/HO-02). Ce qui manque n'est pas le défaut : c'est
l'**interrupteur**. SW-18 exige une « activation explicite » et il n'existe aucun chemin gouverné
pour l'actionner — ni clé R125, ni motif, ni date d'effet, ni trace. Le seul moyen aujourd'hui est
un `UPDATE` direct sur `tenants.settings`, c'est-à-dire précisément ce que R125-R128 existent pour
empêcher.

## Pourquoi ça compte

1. **R125** — un paramètre qui gouverne un comportement moteur doit être au registre. Celui-ci
   décide si l'IA tourne : c'est le paramètre le plus engageant de la famille Olivia.
2. **R29** — sans clé gouvernée, pas de version datée : impossible de répondre à « la mission
   était-elle active le 12.08.2026 ? », donc impossible de rejouer un run dans son contexte.
3. **Conséquence immédiate, mesurée** : le journal des runs est vide et **le restera** tant que
   l'interrupteur n'existe pas. La forme des lignes de `/v1/olivia/runs` n'a donc PAS pu être
   relevée sur l'API vivante en V2-M47 — le seed de l'écran s'appuie sur la projection `vue()`
   lue dans le code (`swarm.module.ts:691`), preuve plus faible, et le commentaire du composant le
   dit explicitement.

## Ce qu'il faudrait faire (non fait, à arbitrer)

Déclarer `olivia.missionsActives` au registre R125 avec sa valeur par défaut `[]`, sa description
et son rattachement à la section Paramétrage → IA, puis faire lire `swarm.module.ts` **à date**
(R29) plutôt que dans les settings courants. Le point d'attention réglementaire : une mission
activée puis désactivée ne doit pas réécrire l'histoire des runs déjà exécutés — la résolution
doit rester « en vigueur à la date du run », comme la résolution d'agent (SW-01/SW-02) le fait
déjà. C'est ce parallèle qui rend la correction non triviale, et donc pas opportuniste.
