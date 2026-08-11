# Codification métier des règles de détection

> Demande PO du 11.08.2026 : « une codification de règle en adéquation avec la famille de
> règle — CIB-SEN1, ISLAMIC-SEN2 ». Lot **V2-M15**. Générateur : `tools/codification/`.
> Le dépôt fait foi : le référentiel `apps/api/src/modules/aml/codification.gen.ts` est
> **généré**, jamais saisi.

## Le principe : trois identifiants, chacun son rôle

Une règle porte désormais **trois** identifiants. Ils ne se remplacent pas — chacun répond à
une question différente, et confondre les trois est la façon la plus sûre de casser soit le
canon, soit les données.

| Identifiant | Exemple | Qui s'en sert | Peut-il changer ? |
|---|---|---|---|
| `ref` — numéro R | `R208` | le canon, le régulateur, les specs | **non** — namespace ratifié R1→R417 |
| `idMoteur` | `SF-01`, `SCN-CAPCALL`, `STRUCTURING` | le moteur, **la base de données** | **non** — persisté dans les signaux |
| `code` — code métier | `ISLAMIC-SEN02` | les écrans, rapports, échanges, recettes | **non** une fois attribué |

**Pourquoi ne pas simplement renommer ?** Parce que `idMoteur` est écrit en base :
`aml_gap_signals.scenarioCode` vaut `"SF-01"` sur tous les signaux déjà levés. Le renommer
réécrirait le passé, ce que R49 interdit. La codification s'**ajoute** donc par-dessus, sans
toucher ni au canon ni aux données.

## Le format

```
FAMILLE-SENnn
```

- **FAMILLE** : code de la famille métier (2 à 7 lettres majuscules) — voir la table ci-dessous.
- **SEN** : scénario. Fixe, il rend le code prononçable et cherchable.
- **nn** : rang dans la famille, sur **deux chiffres**, à partir de `01`. Deux chiffres parce
  qu'aucune famille n'atteint 99 règles et que le tri alphabétique reste alors correct
  (`CIB-SEN02` avant `CIB-SEN10`).

Exemples réels : `CIB-SEN01` (appels de capitaux atypiques) · `ISLAMIC-SEN02` (riba) ·
`TX-SEN04` (sanctions) · `ABUS-SEN07` (pump & dump toutes classes).

## Les 20 familles

| Code | Famille | Règles | Source |
|---|---|---:|---|
| `TX` | Surveillance transactionnelle | 18 | moteur |
| `SF` | Screening en flux | 7 | moteur |
| `QO` | Indices OBA-FINMA | 5 | moteur |
| `GU` | Vision groupe UBO | 4 | moteur |
| `IP` | Instruments PB | 7 | moteur |
| `CR` | Crypto / VASP | 6 | moteur |
| `FT` | CFT | 5 | moteur |
| `GV` | Gouvernance du dispositif | 4 | moteur |
| `TB` | TBML | 8 | moteur |
| `CB` | Correspondent Banking | 7 | moteur |
| `PF` | Prolifération | 3 | moteur |
| `IA` | Immobilier & Art | 3 | moteur |
| `AN` | Analytique 2G | 5 | moteur |
| `CASH` | Cash & espèces | 4 | bibliothèque CPSI |
| `TRF` | Transferts & transfer agent | 9 | bibliothèque CPSI |
| `ACT` | Activité transactionnelle | 4 | bibliothèque CPSI |
| `TRAD` | Trading & marchés | 3 | bibliothèque CPSI |
| **`CIB`** | **Capital markets / CIB** | **4** | bibliothèque CPSI |
| `ABUS` | Abus de marché | 7 | bibliothèque CPSI |
| **`ISLAMIC`** | **Conformité Shariah** | **15** | moteur |
| | **Total** | **128** | |

Le champ `source` dit la vérité sur le statut : `moteur` = règle portée par un référentiel du
dépôt · `biblio-cpsi` = scénario de la bibliothèque du front v1, pas encore un référentiel
gouverné (écart E-AML-2, `docs/REFERENTIEL-DETECTION.md`).

## Les invariants

1. **Immuabilité.** Un code attribué ne change plus. Une règle retirée **garde** son numéro ;
   celui-ci n'est jamais réattribué à une autre règle — sinon un rapport ancien, un cahier de
   recette ou une correspondance avec le régulateur deviennent faux rétroactivement.
2. **Contiguïté.** La numérotation d'une famille part de `01` et ne comporte pas de trou. Un
   trou signale une règle perdue en route — exactement le défaut que ce chantier corrige
   ailleurs (26 capacités disparues de la cartographie, cf. E-V2-3).
3. **Neutralité.** Le code ne porte aucune sémantique au-delà de la famille : ni sévérité, ni
   statut, ni ordre d'exécution, ni caractère bloquant. Ces informations vivent dans le
   référentiel et peuvent évoluer ; l'identifiant, lui, ne doit jamais mentir.
4. **Unicité croisée.** `code` et `idMoteur` sont uniques chacun sur l'ensemble des 128 règles.

## La garde

`python3 tools/codification/test_gen_codification.py` — **bloquante en CI**. Elle vérifie la
fraîcheur (le fichier généré correspond-il aux sources d'aujourd'hui ?) et les quatre
invariants, plus un jeu d'**ancres de stabilité** : onze codes dont l'association à une règle
est figée dans le test. Toute modification volontaire d'une ancre est un acte tracé — un commit
motivé —, jamais l'effet de bord d'une régénération.

Vérifié à la livraison : une altération d'un seul code fait rougir trois vérifications
(fraîcheur, contiguïté, stabilité) et sortir le test en code 1.

## Ajouter une règle

1. L'ajouter à sa source (référentiel généré, moteur, ou bibliothèque).
2. Lancer `python3 tools/codification/gen_codification.py`.
3. Le nouveau code est attribué à la suite de sa famille. Vérifier que **les codes existants
   n'ont pas bougé** : c'est le sens de l'invariant n°1, et le test le prouve.
4. Si la règle inaugure une famille, la déclarer dans `FAMILLES` du générateur — le test
   refuse toute famille non déclarée comme toute famille déclarée à vide.
