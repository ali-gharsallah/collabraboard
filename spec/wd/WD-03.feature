# language: fr
Fonctionnalité: WD-03 — R434 — Validation structurelle : connexité

  Scénario: nœud isolé détecté
    Étant donné un WIR avec un nœud sans aucune arête entrante ni sortante
    Quand la validation structurelle s'exécute à l'ingestion
    Alors l'anomalie "NON_CONNEXE" est listée avec le nœud fautif
    Et aucune correction silencieuse n'est appliquée
