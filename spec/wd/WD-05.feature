# language: fr
Fonctionnalité: WD-05 — R434 — Au moins un terminal

  Scénario: pas de terminal
    Étant donné un WIR où chaque nœud a une arête sortante
    Quand la validation s'exécute
    Alors l'anomalie "TERMINAL_ABSENT" est listée
