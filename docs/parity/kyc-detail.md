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

## Ajout — moteur de workflow (WF_DEFS) ✅
`apps/web/src/parity/wf-engine.ts` (WF_DEFS, wfAvailable, wfCheckGuards, wfHeadId, KYC_PHASES —
verbatim). Panneau « Détail du workflow » : stepper KYC_PHASES (état par phase), en-tête
WFH-KYC_STD-v3 + statut, **transitions gouvernées role-gated** (wfAvailable) avec guards
(COMMENT_REQUIRED, FOUR_EYES, ROLE_SEGREGATION, SECTIONS_COMPLETE, SCREENING_CLEAR → boutons
désactivés + tooltip), **modale de confirmation** (motif obligatoire hors validate ; texte
« quatre yeux » pour l'approbation finale) qui applique la transition (avance le stepper,
bascule approuvé/rejeté) et écrit le **journal des transitions** (piste d'audit).
Preuve : CO → « Aucune action pour votre rôle (CO) — responsabilité AML » ; AML → « Lever vers
comité » / « Renvoyer à la Compliance ». Role-gating conforme.

## CONSIGNÉ — prochaine(s) session(s)
- Visas d'étape (stepVisas), thèmes KYC_THEMES (onglets), matrice rôles×sections (showMatrix),
  change tracker, appréciations, Account Reviews chaînés, DocGenUploadModal, verrou (lock)
  pessimiste + popup « Dossier en cours d'édition », bloc SOF/SOW IA.
