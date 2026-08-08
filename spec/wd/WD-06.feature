# language: fr
Fonctionnalité: WD-06 — R434 — Rôles mappés sur les rôles tenant

  Scénario: rôle inconnu bloquant
    Étant donné un WIR dont un nœud porte ownerRole "SORCIER"
    Quand la validation s'exécute avec les rôles tenant [ARM,RM,CO,CO_SR,CF,DIR,ADMIN,Système]
    Alors l'anomalie "ROLE_NON_MAPPE" est listée avec le nœud et le rôle
    Et l'anomalie est BLOQUANTE pour la ratification
