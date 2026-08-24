# language: fr
Fonctionnalité: WD-01 — R432 — Toute source d'import produit un WorkflowIR normalisé

  Scénario: extraction texte vers WIR
    Étant donné une description libre de workflow EDD
    Quand l'extraction produit des nœuds et des arêtes
    Alors un objet WorkflowIR est créé avec nodes[{id,label,ownerRole,slaHours,visaRequired,approvalType,confidence}]
    Et edges[{from,to,condition}] et meta{source,status}
