# Fiche de parité — AccountReviewScreen — v1

Source : `docs/reference/olive-demo.html` **42173–42345**. Port : `apps/web/src/parity/AccountReviewScreen.tsx`.
Branché dans la coquille : NAV « Clients & Relations » → « Account Review » (`case "review"`).

## Porté (v1) — verbatim
- KPI (via `StatsToggle`, regroupés à l'Accueil — Annexe B.6, donc masqués sur écran) :
  Révisions totales / En retard / En cours / Complétées.
- Bandeau FINMA rouge : « {n} révision(s) en retard — action Compliance requise sous 30 jours (FINMA) »
  (source 42266), affiché si des révisions sont en retard.
- Barre de recherche « ID, client, reviewer… » + puces de statut (Tous / En retard / En cours /
  En attente / Complétée) + sélecteur « Tous les déclencheurs ».
- Bouton « ＋ Déclencher une revue » → modale « ↻ Déclencher une Account Review » avec note groupe
  verbatim « Revue groupée — si le client appartient à un groupe (UBO commun), la cascade s'applique
  automatiquement selon le paramétrage. » (source 42242), sélecteur client, motif de déclenchement,
  Annuler / Déclencher → ; détection `clientGroupMembers` par `uboName` (cascade sur le groupe).
- Table : ☑ · ID Révision · Client · Déclencheur · Statut (`AR_STATUS_CFG` : Complétée/En cours/
  En attente/En retard) · Date · Outcome · Reviewer · 🔒 (verrou « Prendre » / porteur) · KYC Réf. ·
  chevron → détail. En-tête « {n} révision(s) » + « Délai max : 30j (FINMA Circ. 2016/7) ».
- Barre de clôture groupée (sélection multi-lignes) : `grpOutcome` + `applyGroup`.
- Pagination 20. État local `rows` (copie de `ACCOUNT_REVIEWS_DATA`, 113 lignes) + `locks`.

Preuve : capture `parity-app.html` → login → Account Review → 0 erreur runtime. 113 révisions,
25 en retard (bandeau), modale de déclenchement conforme.

## CONSIGNÉ — prochaine(s) session(s)
- `AccountReviewDetailScreen` (clic ligne → `selArId`) : placeholder consigné.
- Chaînage KYC (KYC Réf. → dossier), historique de revue, pièces jointes.
