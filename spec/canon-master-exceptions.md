<!-- Registre des exceptions CANON-MASTER — consommé par tools/canon-master/. Chaque entrée
     JUSTIFIE une anomalie connue avec sa RÉFÉRENCE (jamais un silence : le générateur les affiche
     dans une sous-section « connues & justifiées », distincte des anomalies « à traiter »).
     Le REPO FAIT FOI. Ajouter une entrée ICI = décision tracée, pas une rustine dans le code. -->

# Registre des exceptions CANON-MASTER (anomalies connues & justifiées)

## Motifs de fichiers ERRATA — corrections datées, PAS des collisions de numéro

Un erratum re-touche un numéro EXISTANT pour l'aligner sur le code qui tourne (décision tracée).
Il ne « possède » donc pas le numéro en conflit avec le canon d'origine.

- `erratum-`

## Motifs de fichiers HISTORIQUES / RÉFÉRENCE — hors couverture familles/scénarios actives

Changelogs entre versions Word, inventaires de versions antérieures, ADR de référence : ils
citent des numéros et parfois des jetons `XX-NN` (décisions UX, invariants) qui NE SONT PAS des
familles de scénarios actives. Exclus de la couverture (sinon faux positifs DB-/MO-).

- `catalogue-patch-`
- `catalogue-v2-inventaire`
- `wf-v2`
- `ADR-`

## Numéros RÉSERVÉS / NON APPLICABLES — documentés, PAS des trous

| Numéro | Motif | Référence |
|--------|-------|-----------|
| R78 | Numéro RÉSERVÉ au catalogue CPSI (gap documenté, non attribué) | `docs/CPSI-CATALOGUE-R63-R86.md` · référentiel §4 |
| R247 | Read-model workflow **CAS B — NON APPLICABLE** (O-Live = CAS A : état persisté & requêtable, rejeu read-side) | `docs/ECARTS-FRONT.md` §A3 · `docs/RUNBOOK-OPS.md` · `docs/tests/FAT/FAT-A3-WORKFLOW.md` |

## Numéros PLACEHOLDERS de test — citations intentionnelles hors catalogue

| Numéro | Motif | Référence |
|--------|-------|-----------|
| R999 | Citation « REGLE:R999 inexistante » du test négatif **OL-14** (prouve le rejet d'une règle inconnue au catalogue) | `spec/spec-fonctionnelle-home-olivia.md` (OL-14) |
