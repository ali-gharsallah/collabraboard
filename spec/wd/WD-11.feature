# language: fr
Fonctionnalité: WD-11 — R437 — Canvas contraint par les rôles tenant

  Scénario: projection borne les rôles
    Étant donné un WIR dont un nœud a un rôle non mappé
    Quand la projection est demandée
    Alors la projection est refusée tant que l'anomalie ROLE_NON_MAPPE subsiste
