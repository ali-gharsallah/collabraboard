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
| CoC, offboarding, MROS, review, PMS, transactions… (~75 écrans) | à retrofiter par tranches | idem | ⏳ tranches ≥3 |

> Convention d'adoption : remplacer chaque bouton d'action mutante par `ask({...})` + rendre `{modal}` ;
> fournir un `items` de pré-vol quand une complétude est vérifiable ; garder la garde serveur comme
> autorité. Un écran est « au contrat » quand toutes ses actions mutantes passent par la modale et que
> ses sections éditables auto-sauvent.
