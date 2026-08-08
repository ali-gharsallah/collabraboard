# language: fr
Fonctionnalité: WD-10 — E-WD-3 — customNodes/customEdges = projection du WIR

  Scénario: projection
    Étant donné un WIR valide
    Quand il est projeté vers le canvas
    Alors customNodes/customEdges sont dérivés du WIR (positions calculées)
    Et l'écriture directe de customNodes sans WIR n'existe plus
  Scénario: aller-retour canvas
    Quand le canvas commet des nœuds/arêtes
    Alors un WIR est reconstruit (wirDepuisCanvas) et le statut redevient DRAFT_HUMAN
