# Fiche de parité — KycDetailScreen (Annexe D) — v1

Source : `docs/reference/olive-demo.html` **16626–17656**. Port : `apps/web/src/parity/KycDetailScreen.tsx`
(+ `kyc-detail-data.ts`). Branché dans la coquille : KYC (ou Clients) → clic ligne → dossier.

## Porté (v1) — verbatim
- Bandeau : ← Retour · « KYC / {code} » + Rn · ddl · statut · AUM · RM · bouton Score AML
  (evalAmlRules, bande LOW/MEDIUM/HIGH) · bascule Consultation / Création · ▤ Documents ·
  ⇄ Comparer versions (modale, KYCS_DATA du client).
- Note MOD-70 (OliveNote).
- Bandeau workflow (WF_STEPS/WF_ORDER, étape courante depuis wfPhase) + « Voir le workflow → »
  (modale diagramme : étapes + décision finale HPB+CEO, légende).
- Rail des 14 sections (visibilité par rôle `kycMatrixRole`/`sectionVisibleTo`) : icône, libellé,
  progression filled/total, pastille de statut, repli « logos seuls ».
- Contenu de section : en-tête (icône, libellé, statut, filled/total) · « Visa requis » (pilules B.5
  + bouton Signer en mode création) · questions QUESTIONS_TEMPLATE × droits (MODIFIABLE / LECTURE
  SEULE / CONTRIBUTION REQUISE / masquée) — consultation = valeur, création = input ; « Dernière
  modification · {by} · {at} » + indicateur changed. Section AML : score explicable + RiskFactorsList.
- Fil « 💬 Messages entre intervenants » (seed + envoi).
- Modale « Apposer le visa » (3 verdicts, message obligatoire si ≠ OK).

## CONSIGNÉ — prochaine(s) session(s) (le spec prévoit « plusieurs sessions »)
- Moteur de transitions WF_DEFS (boutons Valider/Rejeter/Renvoyer + wfModal + guards + journal).
- Visas d'étape (stepVisas), thèmes KYC_THEMES (onglets), matrice rôles×sections (showMatrix),
  change tracker, appréciations, Account Reviews chaînés, DocGenUploadModal, verrou (lock)
  pessimiste + popup « Dossier en cours d'édition », bloc SOF/SOW IA.
