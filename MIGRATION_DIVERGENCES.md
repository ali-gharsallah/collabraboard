# MIGRATION_DIVERGENCES — verdicts gardes ↔ ledger (P-L7-4)

Registre des divergences entre le verdict « **validable** » des gardes existantes
(équivalent dry-run de `kyc.service.validate()` : tous les visas requis du workflow
`SIGNED` et verdict ≠ NOK, aucun visa `GELE` — R14/R15/R46/R86) et le verdict
« **gap vide** » du RequirementLedger (P-L7-3), mesurés sur le corpus de fixtures du
test de cohérence (`inference-coherence.spec.ts`, CI bloquante).

**Doctrine (CLAUDE.md, invariant 4)** : R1–R51 restent actives et inchangées ; le ledger
est une VUE. Toute divergence est CONSIGNÉE ici avec diagnostic — **jamais corrigée
silencieusement**, ni côté gardes, ni côté ledger. Le test de cohérence échoue si une
divergence observée n'est pas documentée ici.

Limites de l'équivalent dry-run (assumées) : l'engagement de responsabilité (R14) est un
fait d'ACTION fourni à l'appel de validate(), pas un état lisible — exclu des deux côtés.

---

## DIV-1 — Expiration des pièces : le ledger la voit, la garde de validation non

- **Cas** : dossier dont tous les visas requis sont SIGNED/OK, mais dont une pièce
  requise (ex. FORMULAIRE_T) est ACTIF **et expirée** (`documents.expire_at` passé).
- **Verdicts** : gardes → VALIDABLE ; ledger → GAP (document « présent + non expiré »
  exigé, R26/R187).
- **Diagnostic** : `validate()` contrôle les visas et l'état du dossier, pas la validité
  temporelle des pièces — celle-ci vit dans la matrice documentaire (R26) et le signal
  « pièce expirante » (R187), qui alimentent la revue, pas la validation. Le ledger, vue
  de complétude, l'exige à raison.
- **Traitement** : divergence LÉGITIME et documentée — aucune correction silencieuse.
  Décision d'harmonisation (faire porter l'expiration par une garde de validation ?) =
  décision produit/réglementaire à trancher hors code (revue humaine).

## DIV-2 — Hits screening non qualifiés APRÈS visas : le ledger l'exige, la garde ne revalide pas

- **Cas** : visas tous SIGNED/OK, puis un hit screening arrive et reste `BRUT`
  (aucun visa n'a été gelé — le gel R46 ne frappe que pendant la validation).
- **Verdicts** : gardes → VALIDABLE ; ledger → GAP (check « hits tous qualifiés »).
- **Diagnostic** : la garde R46 gèle les visas quand un hit tombe PENDANT le processus de
  validation ; un hit postérieur ne re-déclenche pas la garde (c'est le re-screening et la
  file de hits qui le portent, R100–R103). Le ledger, lui, lit l'état COURANT : un hit non
  qualifié est un manque de complétude.
- **Traitement** : divergence LÉGITIME et documentée — le ledger ne « corrige » pas la
  garde, la garde n'absorbe pas le ledger. Harmonisation éventuelle = revue humaine.
