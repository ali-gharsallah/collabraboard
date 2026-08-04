<!-- SEED DE MAPPING session→repo — §1 RATIFIÉ par Ali Gharsallah le 2026-07-29 (les 9 mappings
     confirmés, grounded repo, sont figés). Le REPO FAIT FOI. Ce fichier est la SEULE source
     autorisée du mapping numéros-session → numéros-repo pour le générateur docs/CANON-MASTER.md.
     Le générateur NE DÉDUIT JAMAIS un mapping : il lit les lignes confirmées ci-dessous ; tout
     numéro hors de cette table est rapporté « mapping non annoté », jamais inventé. Chaque ligne
     est grounded sur un fichier du repo (colonne Preuve). Les entrées À CONFIRMER / DIVERGENCES
     ne sont PAS consommées comme mapping : elles sont listées pour décision ultérieure. -->

# Mapping session → repo (clé de lecture des documents d'Ali)

**Statut §1 : RATIFIÉ (Ali, 2026-07-29).** **§2 : RÉSOLU (Ali, 2026-07-29)** — identité Olivia + Home sans numéro. §3 (divergences structurelles) reste ouvert.

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

## 2. RÉSOLU (Ali, 2026-07-29) — identité / sans numéro : PAS des renumérotations, donc PAS consommé

Vérifié sur le repo, où la numérotation Olivia est **RATIFIÉE (Ali, 2026-07-27)** dans les en-têtes
des specs. Résultat : ni l'un ni l'autre n'est un décalage session→repo.

| Session | Repo | Verdict | Preuve (repo) |
|---------|------|---------|---------------|
| R253–R266 | R253–R266 | **IDENTITÉ** — aucune renumérotation. Olivia **v1 = R253–R257**, **v1.1 = R258**, **v2 = R259–R266** (familles OL-01..34, SW-01..18). La mention doctrinale « Olivia R253–R266 » nommait la plage, pas un décalage. | `spec/spec-fonctionnelle-home-olivia.md` (en-tête « NUMÉROTATION RATIFIÉE ») · `spec/spec-olivia-v1.1-comportement-v2-agents.md` (en-tête) |
| Home « R253* » | (sans R-number) | **SANS NUMÉRO DE RÈGLE** — décision Ali 2026-07-27 (pattern écrans vagues 1-9) ; invariants portés par **HO-01..08**. Le `*` de session était un placeholder, retiré. | `spec/spec-fonctionnelle-home-olivia.md` (PARTIE A) · `docs/PROJECT-INDEX.md` |

> Conséquence : le générateur teste l'**identité** par défaut pour tout numéro hors §1 ; ces deux
> entrées n'ajoutent **aucune** ligne de mapping (identité triviale / absence de numéro). Rien à
> traduire, rien à consommer — §2 est clos.

## 3. DIVERGENCES structurelles session↔repo (à signaler, pas à absorber)

| Session | Repo | Nature |
|---------|------|--------|
| R332–R334 (On-premise PK-01..06) | **réservé R405+** | L'On-premise packaging (paquet signé autosuffisant) **n'est pas implémenté** au repo. Son créneau présumé (R335–R337 par le décalage +3) a été **réattribué à la robustesse** : R335=RB, R336=LK, R337=IDM, R338=PJ, R339=EV. **DÉCISION Ali (2026-07-29) : PK renuméroté > R339.** **Step-0 (2026-08-04, §4) — révisé par le drop PO `SESSION-2026-08-04.md` : R340–R377 = AML Gap Wave 1, R378–R403 = AML Gap Wave 2 (26 règles, blocs 57–61), R404 = FilterBar (R-FB). La réservation PK (non implémentée) glisse donc à R405+** (même règle que le déplacement R335→R340 : l'implémenté/ratifié prend le créneau contigu, la réservation glisse). Réservation notée ici jusqu'à la spec PK. |
| Industrialisation « R328–R331 » (§4 session) | R331–R334 | La borne haute session (R331) et repo (R334) diffèrent : même décalage +3, mais la plage session couvre 4 numéros pour 4 objets → cohérent une fois décalée. |
| i18n « R323–R324 » (session) | R324–R327 région | `spec/canon-solde-4-ecarts-R324-R327.md` couvre le solde d'écarts + i18n cliquet côté repo aux R324–R327 ; mapping fin à confirmer par relecture du canon. |

## 4. STEP-0 (2026-08-04) — attribution des specs ratifiées PO (04.08.2026)

**Résolution de collision.** Les numéros *provisoires* des specs AML Gap (Wave 1 `R340–R377`,
Wave 2 `R378–R403`) et de la FilterBar (symbole `R-FB`) heurtaient la **réservation *soft***
« R340+ » de l'On-premise (PK), **non implémentée**. Règle appliquée (déjà employée pour PK en
2026-07-29) : *l'implémenté/ratifié prend le créneau contigu, la réservation glisse*.

> **Révision (drop PO `docs/SESSION-2026-08-04.md`, action 1).** Le premier jet de ce step-0 avait
> attribué **R378** à la FilterBar. Le drop PO du même jour introduit **AML Gap Wave 2** (blocs
> 57–61, 26 règles) et lui assigne explicitement **R378–R403**. La FilterBar glisse donc à **R404**
> (numéro non pris par les deux vagues ratifiées), et PK à **R405+**. C'est la seule attribution
> ci-dessous qui fait foi.

Attribution définitive (visa PO au merge) :

| Spec (provisoire) | Repo (définitif) | Objet | Familles | Preuve / source |
|---|---|---|---|---|
| AML Gap Wave 1 R340–R377 | **R340–R377** (identité) | 38 scénarios AML, blocs 50–56 | SF-01..07, QO-01..05, GU-01..04, IP-01..07, CR-01..06, FT-01..05, GV-01..04 | `spec/SPEC-AML-GAP-WAVE1.md` (ratifiée) · `tools/aml-gap/gen_aml_gap.py` |
| AML Gap Wave 2 R378–R403 | **R378–R403** (identité) | 26 scénarios AML, blocs 57–61 (TBML, correspondent banking, prolifération, immobilier & art, analytique 2G) | (blocs 57–61) | `spec/SPEC-AML-GAP-WAVE2.md` (ratifiée) · `tools/wave2_rules.py` |
| FilterBar `R-FB` | **R404** | Barre de filtres uniforme (panneau rétractable + combobox + chips actifs + reset + clés uniques R-FB.4) | FB-01..07 | `spec/SPEC-FILTERBAR.md` (ratifiée) · `apps/web/src/components/FilterBar.tsx` |

**Détail AML Gap Wave 1 (identité provisoire = repo — aucun remap du générateur/dataset/démo) :**

| Bloc | Règles (repo) | Scénarios |
|---|---|---|
| 50 — Screening en flux | R340–R346 | SF-01..07 |
| 51 — Indices OBA-FINMA | R347–R351 | QO-01..05 |
| 52 — Vision groupe UBO | R352–R355 | GU-01..04 |
| 53 — Instruments PB | R356–R362 | IP-01..07 |
| 54 — Crypto / VASP | R363–R368 | CR-01..06 |
| 55 — CFT | R369–R373 | FT-01..05 |
| 56 — Gouvernance du dispositif | R374–R377 | GV-01..04 |

> **Amas contigu après step-0 (révisé)** : R339 (robustesse EV) → **R340–R377** (AML Gap Wave 1)
> → **R378–R403** (AML Gap Wave 2) → **R404** (FilterBar). PK réservé **R405+**. CANON-MASTER
> (`docs/CANON-MASTER.md`, généré) fait foi et **ne montrera ces numéros qu'à mesure de leur
> implémentation réelle** au repo (familles + suites de tests) — le repo fait foi, la table
> ci-dessus est l'attribution, pas l'implémentation.
