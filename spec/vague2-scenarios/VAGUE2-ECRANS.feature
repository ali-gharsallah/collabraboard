# language: fr
Fonctionnalité: Vague 2 — Surveillance & Dossiers (spec-first)
  Statut: Vague 2
  Écrans: Dossiers de risque (instruction) · Pièces GED (consultation)
  Implémentation: React (apps/web) sur routes réelles (apps/api), preuve e2e.

  # ── Écran 1 : Instruction d'un dossier de risque ──
  Scénario: V2-DOSSIER — instruire un dossier ouvert depuis une alerte
    Étant donné un dossier de risque ouvert sur une alerte (R133)
    Quand le Compliance Officer ajoute une note d'instruction
    Alors la note est enregistrée en APPEND-ONLY (R134 : aucune édition/suppression)
    Et l'historique des notes se relit dans l'ordre chronologique
    Quand le CO fait avancer le dossier NOUVELLE → EN_ANALYSE
    Alors la transition est acceptée (R133)
    Quand le CO tente de CLÔTURER sans motif
    Alors O-Live refuse (R7 : un état terminal exige un motif)
    Quand le CO clôture AVEC motif
    Alors le dossier passe CLOTUREE

  Scénario: V2-DOSSIER-ILLEGAL — une transition non prévue est refusée
    Étant donné un dossier NOUVELLE
    Quand on tente NOUVELLE → CLOTUREE directement
    Alors O-Live refuse (transition illégale, R133)

  # ── Écran 2 : Consultation des pièces (GED) ──
  Scénario: V2-GED — consulter les pièces d'un client, filtrées au rôle
    Étant donné un document classé d'un type dont l'accès est réservé à certains rôles (R110)
    Quand un Compliance Officer autorisé liste les pièces
    Alors il voit le document (et sa fiche)
    Quand un rôle NON autorisé liste les pièces
    Alors il ne voit RIEN (filtrage au résultat, R110), et jamais le contenu (R145)
    Et un autre tenant ne voit aucune pièce (isolation RLS)
