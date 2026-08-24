# language: fr
Fonctionnalité: WD-02 — R433 — Statut initial DRAFT_AI, jamais activable

  Scénario: un import naît DRAFT_AI
    Quand un WIR est créé depuis n'importe quelle source
    Alors meta.status vaut "DRAFT_AI"
    Et toute tentative de publication directe depuis DRAFT_AI est refusée
