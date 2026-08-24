# language: fr
Fonctionnalité: WD-04 — R434 — État initial unique

  Scénario: deux états initiaux
    Étant donné un WIR où deux nœuds n'ont aucune arête entrante
    Quand la validation s'exécute
    Alors l'anomalie "INITIAL_MULTIPLE" est listée
  Scénario: aucun état initial
    Étant donné un WIR où tous les nœuds ont une arête entrante
    Quand la validation s'exécute
    Alors l'anomalie "INITIAL_ABSENT" est listée
