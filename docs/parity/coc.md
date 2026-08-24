# Fiche de parité — CocScreen (Change of Circumstances) — v1

Source : `docs/reference/olive-demo.html` **42346–42501**. Port : `apps/web/src/parity/CocScreen.tsx`.
Branché dans la coquille : NAV « Clients & Relations » → « Change of Circumstances » (`case "coc"`).

## Porté (v1) — verbatim
- En-tête « Change of Circumstances ⇆ » + sous-titre « Réévaluation ciblée du risque — sans
  relancer un KYC complet. » + bouton « + Nouveau COC » / « ✕ Fermer ».
- KPI (via `StatsToggle`, regroupés à l'Accueil — Annexe B.6, donc masqués sur écran) :
  Total COC / KYC déclenchés / Affectés à un rôle / En attente de revue.
- Panneau de création (`creating`) : « Déclarer un changement de situation », Client (30 premiers),
  Type de changement (`COC_TYPE_LABELS`), Détail « ancienne → nouvelle valeur », prévisualisation du
  traitement paramétré (matérialité + « → Révision KYC + four-eyes » ou « → Affecté à {rôle} »),
  bouton « Créer le COC ». `createCoc` applique le paramétrage (`config[type]`) : action KYC → SUBMITTED,
  sinon LOW → ASSIGNED / autre → SUBMITTED ; four-eyes si matérialité ≠ LOW.
- Table : Réf. · Client · Type · Détail · Matérialité (`matColor`/Badge) · Statut (`stColor` :
  Appliqué/Affecté/KYC déclenché/Soumis/En revue/Brouillon/Rejeté, + 👁👁 four-eyes) · Traitement
  (↳ kycRef en rouge / rôle affecté en violet) · Action (Approuver/Rejeter si SUBMITTED|UNDER_REVIEW,
  sinon reviewer). `approve` : action KYC → KYC_TRIGGERED, sinon ASSIGNED ; `reject` → REJECTED.
- Note de pied verbatim : « Le **traitement de chaque type** est paramétrable (⚙) : déclencher une
  révision KYC, ou affecter à un rôle (Central File, Compliance…). Réservé aux profils habilités. »
- Données : `COC_DATA` (10 lignes) ajouté aux fixtures (extract_demo_data.mjs TARGETS) ; +
  `COC_TYPE_LABELS` (41), `COC_ROLES` (6), `COC_CONFIG_DEFAULT`.

## Observation de fidélité (verbatim)
- `canConfig` (habilitation CF/ADMIN/COMPLIANCE/CO/SO) et le panneau `showCfg` « Paramétrage du
  traitement par type de changement » sont **définis dans la source mais non reliés** : la maquette
  (42346–42501) ne câble aucun bouton `setShowCfg(true)` dans l'en-tête (seul « + Nouveau COC » y
  figure). Reproduit à l'identique — le panneau et `canConfig` restent présents mais inatteignables,
  exactement comme la maquette. Le paramétrage par type reste accessible via l'écran dédié
  « CoC — Types & sensibilité » (g_param → `cocparam`), à porter ultérieurement.

Preuve : capture `parity-app.html` → login → Change of Circumstances → 0 erreur runtime. 10 COC,
badges matérialité/statut/four-eyes conformes, panneau de création fonctionnel.
