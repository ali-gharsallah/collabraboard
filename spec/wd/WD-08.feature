# language: fr
Fonctionnalité: WD-08 — R435/R13 — Visa 4-yeux : importeur ≠ ratifieur

  Scénario: auto-ratification refusée
    Étant donné un WIR importé par "i.vernet"
    Quand "i.vernet" tente de le ratifier
    Alors la ratification est refusée avec le motif R435
  Scénario: ratification par un autre
    Quand "a.gharsallah" ratifie le même WIR en DRAFT_HUMAN sans anomalie bloquante
    Alors meta.ratifiePar vaut "a.gharsallah" et WF_RATIFIED est produit
