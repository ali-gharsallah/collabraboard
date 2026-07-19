# Catalogue O-Live — Amendement PROPOSÉ (R125 → R128) · Bloc 21 « Gouvernance des paramètres tenant — le R-Q exécutable »

**Statut : RATIFIÉ le 19.07.2026 par Ali Gharsallah.**
Numérotation continue après R124. Famille de scénarios : **RQ** (vérifiée libre — Word + spec).
**Le catalogue précède le code.**

## Le problème — la dette de la journée elle-même

La méthode dit : « tout point *ça dépend de la banque* est un paramètre tenant, répertorié au
questionnaire R-Q ». On en a créé une douzaine aujourd'hui (`pmsDriftToleranceBp`,
`pmsBreachDelaiJours`, `gedDocTypes`, `onboardingSlaJours`, `iaPrerevueTraitementRequis`,
`iaPseudonymise`…) — et **rien ne les gouverne** : `Tenant.settings` accepte n'importe quelle
clé, sans type, sans motif, sans date d'effet, sans rejeu. Or un paramètre tenant **est une
règle de la banque** : le changer en silence, c'est changer une règle en silence — exactement ce
que R124 interdit au prompt IA. Quatre règles ferment la boucle, et le questionnaire R-Q cesse
d'être un document pour devenir un **objet exécutable**.

---

## R125 — Le registre des paramètres est le seul chemin d'écriture

Chaque paramètre tenant vit dans un **registre exécutable** : clé, type (int / bool / json /
string), valeur par défaut, **règle Rxx de rattachement**, caractère REQUIS pour l'activation.
Écrire une clé inconnue du registre est **refusé** ; écrire une valeur du mauvais type est
refusé. Le questionnaire R-Q n'est plus rédigé à la main : il **se génère** du registre.

> **Scénario RQ-01 — Plus de paramètre sauvage**
> **Quand** on écrit une clé absente du registre **Alors** refus (clé inconnue)
> **Quand** on écrit `pmsDriftToleranceBp = "beaucoup"` **Alors** refus (type int attendu)
> **Quand** on écrit `pmsDriftToleranceBp = 300` avec motif **Alors** accepté

> **Scénario RQ-02 — Le questionnaire se génère du registre**
> **Quand** le registre est lu
> **Alors** chaque paramètre expose clé, type, défaut, règle Rxx de rattachement et caractère
> requis — c'est le questionnaire R-Q, généré, jamais rédigé

## R126 — Changer un paramètre est un événement daté et motivé

Tout changement porte : valeur avant / valeur après, **auteur (jeton)**, **motif (R7)** — un
paramètre est une règle, une règle ne change pas sans dire pourquoi — et une **date d'effet**
(immédiate ou **future** : cohérence R29, l'effet différé est un droit ; l'effet **rétroactif est
refusé** — on ne réécrit pas le passé, R48). Le registre des changements est **append-only**.

> **Scénario RQ-03 — Pas de motif, pas de changement**
> **Quand** un changement est soumis sans motif **Alors** refus (R7)
> **Quand** il est motivé **Alors** l'événement porte avant / après / auteur / date d'effet

> **Scénario RQ-04 — L'effet différé est un droit, le rétroactif un refus**
> **Étant donné** un changement à date d'effet J+30
> **Alors** la valeur effective reste l'ancienne jusqu'à J+30 (R29)
> **Quand** un changement à date d'effet passée est soumis **Alors** refus (jamais rétroactif)

## R127 — La configuration se rejoue à date

« Quelle était la configuration de la banque le 3 mars ? » se répond **depuis les événements**
(R48/R49) : pour toute clé et toute date, la valeur effective est reconstructible — dernier
changement dont la date d'effet est atteinte, sinon le défaut du registre. C'est la condition du
rejeu global : rejouer un dossier à date (R49) sans la config d'alors ne prouve rien.

> **Scénario RQ-05 — La valeur d'alors, pas celle d'aujourd'hui**
> **Étant donné** trois changements datés d'un même paramètre
> **Quand** on demande la valeur effective à une date intermédiaire
> **Alors** c'est la valeur d'alors — et à une date antérieure au premier changement, le défaut

## R128 — Un tenant ne s'active qu'avec son R-Q complet et signé

L'activation (go-live) exige que **tous les paramètres REQUIS** du registre aient une valeur
effective **et** que le questionnaire soit **signé** (répondant bancaire nommé — le prérequis
contractuel du R-Q devient un gate exécutable). Le service **constate** les manquants ;
l'activation **bloque** (contrainte structurelle, type R13). L'activation est un événement.

> **Scénario RQ-06 — Pas de go-live sur un questionnaire troué**
> **Étant donné** un paramètre REQUIS sans valeur
> **Quand** l'activation est demandée **Alors** refus avec la liste des manquants
> **Quand** tout est renseigné et signé **Alors** le tenant passe ACTIF, événement tracé

---

## Implications techniques

| Point | Conséquence |
|---|---|
| Registre | constante versionnée `REGISTRE_RQ` (code) : ~12 entrées initiales rattachées à leurs règles (R31, R33, R104, R105, R108, R110, R112, R120, R123, R124…) — s'enrichit par amendement, comme le catalogue |
| Modèle | `TenantParamChange` (append-only : cle, avant, apres, motif, par, at, **effetAt**) · `Tenant` +`statut` (PROVISIONING \| ACTIF) +`rqSignePar/rqSigneAt` |
| Service | `ParametresService` : `registre()` (RQ-02), `ecrire()` (RQ-01/03/04), `valeurEffective(cle, date)` + `configALaDate(date)` (RQ-05), `activer(signataire)` (RQ-06) |
| Matérialisation | `Tenant.settings` reste la **vue courante** (matérialisée à l'écriture quand l'effet est atteint — un tick applique les effets différés) ; la **vérité** est le registre des changements |
| RLS / append-only | `tenant_param_changes` : RLS **et** append-only |
| Événements | `param.change` · `param.effet.applique` · `tenant.active` |

Tests : RQ-01..06 (`parametres.wiring.spec.ts`). Écrits **avant** l'implémentation.

`RATIFIÉ le 19.07.2026 par Ali Gharsallah`
