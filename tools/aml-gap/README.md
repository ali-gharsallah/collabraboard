# AML Gap Wave 1 — générateur (source de vérité)

Vague AML « Gap » wave 1, blocs **50–56**, règles **R340–R377** (numéros définitifs, step-0 du
2026-08-04 — voir `spec/mapping-session-repo.md §4`). Spec ratifiée PO : `SPEC-AMLGAP-WAVE1.md`.

## Le générateur fait foi

`gen_aml_gap.py` transcrit l'annexe de la spec (38 scénarios, familles `SF QO GU IP CR FT GV`) et
émet deux artefacts. **Ne jamais éditer les `.json` à la main** — toute évolution d'une règle ou
d'un cas GT passe par le générateur (même discipline que `services/screening/generate.mjs` et les
outils de gouvernance sous `tools/`).

```
python3 tools/aml-gap/gen_aml_gap.py        # (re)génère aml-gap-rules.json + aml-gap-dataset-gt.json
python3 tools/aml-gap/test_gen_aml_gap.py   # 17 invariants — rouge = régression ou dérive d'artefact
```

## Artefacts

| Fichier | Contenu | Consommé par |
|---|---|---|
| `aml-gap-rules.json` | 38 définitions versionnables (id, ruleRef, bloc, niveau, `blocking`, signal, Gherkin, paramètres R-Q) | seed backend `AmlScenario`, thèmes FilterBar du front, CANON-MASTER (à mesure de l'implémentation) |
| `aml-gap-dataset-gt.json` | 78 cas GT (**40 TP / 38 FP**), narratif + cause d'écartement (FP) + payload synthétique déterministe | seed `GroundTruthCase`, tests paramétrés de recall, backtesting R375 |

## Invariants garantis (test)

- **R340–R377 contigus**, 1 règle par scénario, familles aux effectifs de la spec (SF7 QO5 GU4 IP7 CR6 FT5 GV4).
- **6 bloquantes** exactement = `{R344, R346, R363, R365, R367, R373}` (§1.2 : émettent `aml.block.requested`, jamais d'effet de bord).
- **78 cas GT = 40 TP / 38 FP** ; chaque règle a ≥ 1 TP **et** ≥ 1 FP — TP comme FP **déclenchent** (corpus de recall ; un FP est une alerte légitime écartée, pas une non-alerte).
- Chaque FP porte une **cause d'écartement documentée**, sauf **un placeholder unique** (R377/GV-04) que la spec laisse vide (« — — — ») : compté, **jamais comblé** (never invent).
- Chaque règle porte ≥ 1 **paramètre tenant** (registre R-Q), clés globalement uniques.
- **Déterminisme** (graine fixe `20260804`) et **fraîcheur** : les `.json` sur disque doivent correspondre au générateur (CI rouge sinon).

## Réconciliation avec le canon PO (2026-08-04)

Le PO a ratifié **`tools/gen_aml_gap.py` + `tools/wave2_rules.py`** comme *source de vérité unique*
des règles (Waves 1+2, R340–R403) et **`data/aml-gap-dataset-gt.json`** (130 cas GT). Ces fichiers
sont versés tels quels. Ce dossier (`tools/aml-gap/`) est **l'émetteur Nest/React in-repo** pour la
**Wave 1** : il produit les artefacts TS consommés par le backend (`apps/api/.../aml-gap.*.gen.ts`)
et le front (`apps/web/.../aml-gap.seed.gen.ts`), enrichis de `ecartement` (cause d'écartement FP) et
de payloads synthétiques déterministes — absents du canon PO plus mince.

La **parité** entre les deux est verrouillée par `test_gen_aml_gap.py` (AG-17/AG-17b) : la tranche
Wave 1 de cet émetteur doit égaler le canon PO (mêmes règles, mêmes cas GT). Toute dérive rougit.
Le générateur PO écrit vers des chemins absolus de l'env PO (`/home/claude/olive/`) : c'est un record
canonique, pas encore l'émetteur du pipeline. Voir `spec/mapping-session-repo.md §4.1`.

## Données

100 % **synthétiques**, aucune personne réelle. Les `CLI-xxxxx` réutilisent les clients du seed démo
GWB ; la gouvernance (bloc 56) est hors client (`—`). Les payloads sont des stubs déterministes que
le seed backend étendra en transactions synthétiques rejouables.
