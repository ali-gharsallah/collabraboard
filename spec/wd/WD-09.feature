# language: fr
Fonctionnalité: WD-09 — R436 — Traçabilité source append-only

  Scénario: import d'image tracé
    Quand un WIR est créé depuis une image
    Alors WF_IMPORTED_FROM_IMAGE est émis avec le hash du fichier, le modèle+version et le WIR brut
    Et le journal des événements est append-only (R48/R49)
