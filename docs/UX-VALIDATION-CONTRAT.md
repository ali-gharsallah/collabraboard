# Contrat UX — confirmation + pré-vol + auto-save (transverse)

Décision Ali (2026-08-02) : **généralisé à toute l'app**.

1. **Toute action de validation / publication / commit** passe par une **modale de confirmation**
   qui affiche un **pré-vol « ce qui reste à valider »** (points ✓/✗) avant d'engager l'action.
   L'humain confirme en connaissance de cause ; le back reste l'autorité (garde serveur inchangée).
2. **En quittant une section éditable, sauvegarde serveur immédiate** des champs modifiés
   (jamais de perte en naviguant).

## Primitives réutilisables (livrées)

- `components/ConfirmValidation.tsx`
  - `<ConfirmValidation title items input? blockIfIncomplete? danger? onConfirm onCancel/>` — la modale.
  - `useConfirmGate()` → `{ ask, modal }` : `ask({ title, items, input?, onConfirm })` ouvre,
    `{modal}` rend. Motif/cause saisi dans la modale et transmis à `onConfirm(value)`.
  - `items: {label, ok}[]` = le pré-vol. `blockIfIncomplete` interdit la confirmation tant qu'un
    point est ✗ (utilisé pour les validations finales à complétude obligatoire).
- **Auto-save section** : le patron de référence est le PATCH `onBlur` par champ (déjà en place sur
  KYC) — quitter un champ/section persiste immédiatement. Les nouveaux écrans à sections l'adoptent
  (sauvegarde au `onBlur` / au changement d'onglet, avant tout commit).

## Registre de déploiement (cliquet — comme l'i18n)

| Écran | Confirmation + pré-vol | Auto-save section | État |
|---|---|---|---|
| `features/kyc/KycDetail` | validation finale (pré-vol : questions obligatoires + visas), suspendre/abandonner/réactiver/recert | PATCH réponses `onBlur` (déjà) | ✅ tranche 1 |
| `features/parametrage` matrice doc (R26/R27) | publier via modale + pré-vol (types d'entité complets) | brouillon persistant + publish = commit | ⏳ tranche 2 |
| `features/tasks` (R38 + R241) | routage via modale + pré-vol (rôle/cible), complétion via modale | n/a | ✅ tranche 2 |
| KYC — gel sur hit (R46) | geler + décision comité (poursuite/offboarding) via modale | n/a | ✅ tranche 3 |
| `features/parametrage/MatriceDoc` (R26/R27) — écran créé + router | publier via modale + pré-vol (JSON valide + bloc exigences) | saisie + publish = commit | ✅ tranche 3 |
| `features/mros/ReportingMros` (R7/R129-132) | gel (motif) + transmission autorité via modale | n/a | ✅ tranche 4 |
| `features/pms/PmsMandats` (R108/R7) | clôture de breach (motif) via modale | n/a | ✅ tranche 4 |
| `features/nba/NextBestAction` (R244) | accepter/ajuster/rejeter via modale (fin de window.prompt) | n/a | ✅ tranche 4 |
| `features/offboarding/Offboarding` (R267-271/R7) | EN_CLOTURE / clôture (pré-vol visas+obstacles, bloquant) / annulation via modale | n/a | ✅ tranche 4 |
| `features/screening/Screening` (R101/R7) | qualification VP/FP (motif) via modale | n/a | ✅ tranche 5 |
| `features/corroboration/CorroborationKyc` (R36) | signalement de divergence via modale + pré-vol | n/a | ✅ tranche 5 |
| `features/review/AccountReview` (R103) | conduire la revue (re-screening) via modale | n/a | ✅ tranche 5 |
| `features/coc/ChangementCirconstances` (R30/R42/R276) | changement + déclaration de dossier via modale | n/a | ✅ tranche 5 |
| `features/transactions/TransfertsOrdres` (R143/R7) | libérer/bloquer (motif) via modale | n/a | ✅ tranche 6 |
| `features/crossborder/CrossBorder` (R7/R13) | demande de dérogation + visa second regard via modale | n/a | ✅ tranche 6 |
| `features/settlement/Settlement` (R167-169) | import lot core banking via modale | n/a | ✅ tranche 6 |
| _SWIFT_ (`swift/SwiftLab`) | analyse = parsing, PAS un commit gouverné → hors contrat (noté) | n/a | — |
| iam, workflow, aml, olivia, custody, txrisk, fx… (~62 écrans) | à retrofiter par tranches | idem | ⏳ tranches ≥7 |

> Convention d'adoption : remplacer chaque bouton d'action mutante par `ask({...})` + rendre `{modal}` ;
> fournir un `items` de pré-vol quand une complétude est vérifiable ; garder la garde serveur comme
> autorité. Un écran est « au contrat » quand toutes ses actions mutantes passent par la modale et que
> ses sections éditables auto-sauvent.
