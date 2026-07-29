<!-- SEED DE MAPPING session→repo — §1 RATIFIÉ par Ali Gharsallah le 2026-07-29 (les 9 mappings
     confirmés, grounded repo, sont figés). Le REPO FAIT FOI. Ce fichier est la SEULE source
     autorisée du mapping numéros-session → numéros-repo pour le générateur docs/CANON-MASTER.md.
     Le générateur NE DÉDUIT JAMAIS un mapping : il lit les lignes confirmées ci-dessous ; tout
     numéro hors de cette table est rapporté « mapping non annoté », jamais inventé. Chaque ligne
     est grounded sur un fichier du repo (colonne Preuve). Les entrées À CONFIRMER / DIVERGENCES
     ne sont PAS consommées comme mapping : elles sont listées pour décision ultérieure. -->

# Mapping session → repo (clé de lecture des documents d'Ali)

**Statut §1 : RATIFIÉ (Ali Gharsallah, 2026-07-29).** §2 (à confirmer) et §3 (divergences) restent ouverts.

## 1. Mappings CONFIRMÉS — RATIFIÉS (grounded repo — consommés par le générateur)

Format machine : le générateur lit les lignes `| Rxxx | Ryyy | … |` de CETTE section uniquement.

| Session | Repo | Objet | Familles | Preuve (repo) |
|---------|------|-------|----------|---------------|
| R325 | R328 | Clôture JWT (jetons réels partout) | JW-01..06 | `spec/canon-vague-cloture-R328-R330.md` |
| R326 | R329 | Tenant démo GWB scripté (zéro if-demo) | DM-01..06 | `spec/canon-vague-cloture-R328-R330.md` |
| R327 | R330 | Readiness + pipeline conditionnel | RZ-01..04 | `spec/canon-vague-cloture-R328-R330.md` |
| R328 | R331 | Registrar inbox→PR de ratification | IX-01..05 | `spec/canon-industrialisation-R331-R334.md` · `tools/registrar/` |
| R329 | R332 | FAT dérivée du catalogue, gate absolue | FB-01..04 | `spec/canon-industrialisation-R331-R334.md` · `tools/fat/` |
| R330 | R333 | BAT cahier généré + signature visa | FB-05..07 | `spec/canon-industrialisation-R331-R334.md` · `tools/bat/` |
| R331 | R334 | Migrations expand/contract | MG-01..05 | `spec/canon-industrialisation-R331-R334.md` · `tools/migrations/` |
| R70  | R95  | Mapping droits (renumérotation étape 0 signalée) | — | doctrine étape 0 (mapping R70→R95 signalé) |
| R222 | R248 | Porte CPSI (enveloppe versionnée) | PC-01..14 | `spec/catalogue-amendement-R248-R252-porte-cpsi.md` |

> **Règle observée** : décalage constant **+3** sur toute la région clôture→industrialisation
> (session R325–R331 ⇒ repo R328–R334). Les renumérotations R70→R95 et R222→R248 sont ponctuelles.

## 2. À CONFIRMER (source de renumérotation introuvable au repo — NON consommé)

| Session | Repo présumé | Objet | Pourquoi en attente |
|---------|--------------|-------|---------------------|
| R253–R266 | R253–R266 (identité ?) | Olivia v1/v1.1/v2 | La doctrine cite « Olivia R253–R266 » comme renumérotation, mais le repo utilise déjà R253–R266 pour Olivia. Source de la renumérotation d'origine introuvable — identité probable, à trancher. |
| Home « R253* » | (sans R-number) | Écran Home | `PROJECT-INDEX.md` : Home = principe **sans R-number**. Le `*` de session est à retirer. |

## 3. DIVERGENCES structurelles session↔repo (à signaler, pas à absorber)

| Session | Repo | Nature |
|---------|------|--------|
| R332–R334 (On-premise PK-01..06) | **réservé R340+** | L'On-premise packaging (paquet signé autosuffisant) **n'est pas implémenté** au repo. Son créneau présumé (R335–R337 par le décalage +3) a été **réattribué à la robustesse** : R335=RB, R336=LK, R337=IDM, R338=PJ, R339=EV. **DÉCISION Ali (2026-07-29) : PK renuméroté > R339** — à la ratification de l'On-premise, il prendra **R340+** (après la robustesse). Réservation notée ici jusqu'à la spec PK. |
| Industrialisation « R328–R331 » (§4 session) | R331–R334 | La borne haute session (R331) et repo (R334) diffèrent : même décalage +3, mais la plage session couvre 4 numéros pour 4 objets → cohérent une fois décalée. |
| i18n « R323–R324 » (session) | R324–R327 région | `spec/canon-solde-4-ecarts-R324-R327.md` couvre le solde d'écarts + i18n cliquet côté repo aux R324–R327 ; mapping fin à confirmer par relecture du canon. |
