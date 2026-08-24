# Fiche de parité — `kyc` (KycListScreen)

Source : `docs/reference/olive-demo.html` **13280–13474** (helpers : 14663 wfNomenclature,
14670 wfNomColor/Bg, 16520 kycTypeOf, 15625–15642 WF_RULE_PARAMS/wfTier/wfTriage,
16618–16625 latestKycFor/nextRevisionFor, 44444 OliveNote). Port :
`apps/web/src/parity/KycListScreen.tsx` (+ `kyc-support.ts`). Entrée DEV-ONLY `parity-kyc.html`.
Données : fixtures KYCS_DATA (81) + CLIENTS + USERS + DS_STATS.

## Structure (verbatim)
- **MineBar** : Tous / ◉ Mes KYC · séparateur · Tous statuts / En cours / Fermés · ExportBtn.
- **StatsToggle** (Total dossiers / En cours-révision / Approuvés / Révisions Rn≥2) → null (B.6).
- **Filtres** : recherche « Code KYC, client, RM… » · workflow [Tous/SOW/HOW/POW/SKW/HKW/PKW] ·
  statut [Tous/Approuvé/En cours/En revue/Att. appro./Brouillon/Rejeté] · select « Tous les RM ».
- **Table** (`colOn("kycs",…)`) : Code KYC(mono) · Client · Structure(Badge) · Type(Onboarding
  violet / Review bleu) · Rév. *(off défaut)* · Workflow(nomenclature SOW/HOW/… coloré) · Score
  (Donut) · Statut(pill) · RM(nom court) · Créé le *(off défaut)* · ›. En-tête « N dossier(s) —
  filtrés » + « 🌱 Créer KYC ». Pagination 20/page.
- **Modale « Créer KYC »** : sélection client existant + OliveNote (prochaine version) + motif +
  RM ; « Calculer & initier → » → score `evalAmlRules` + tier `wfTriage` + « ✓ Dossier initié »
  + RiskFactorsList.

## Parité — statut
- [x] MineBar, filtres, colonnes/ordre/labels, nomenclature workflow, Type, Score, Statut,
      pagination, modale Créer KYC : **conformes** (capture démo connecté vs app, mêmes lignes/ordre).

## Écart CONSIGNÉ
1. **Compte 81 vs 105** : la vue connectée ajoute les KYC des clients `promoted` (runtime coquille §2)
   — la fixture KYCS_DATA = 81 (§5). Résolu au portage de la coquille.
