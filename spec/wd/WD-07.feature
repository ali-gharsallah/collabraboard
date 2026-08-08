# language: fr
Fonctionnalité: WD-07 — R432/R436 — Transitions de statut DRAFT_AI → DRAFT_HUMAN → PUBLISHED

  Scénario: édition humaine
    Étant donné un WIR en DRAFT_AI
    Quand un humain édite un nœud
    Alors le statut devient "DRAFT_HUMAN" et l'événement WF_IR_EDITED est produit
  Scénario: publication hors circuit refusée
    Étant donné un WIR ratifié en DRAFT_HUMAN
    Quand une publication est demandée hors du circuit "gouvernance"
    Alors elle est refusée (pas de circuit parallèle)
