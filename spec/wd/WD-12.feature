# language: fr
Fonctionnalité: WD-12 — R438 — Extraction dégradée assumée

  Scénario: confiance faible affichée
    Étant donné une extraction où un nœud a confidence < 0.5
    Quand le WIR est affiché
    Alors le nœud est marqué "à vérifier" et le WIR reste DRAFT_AI
    Et rien n'est corrigé silencieusement
