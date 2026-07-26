# language: fr
Fonctionnalité: Vague 6 — Paramétrage & Gouvernance de la configuration (spec-first)
  Statut: Vague 6
  Écrans: Registre de paramétrage (R-Q) · Config à date & Go-live
  Doctrine: tout le paramétrage vit sous « Paramètres » (R125→R128). Zéro invention.
  NB : les bacs à sable de DRY-RUN (R93→R99) n'ont pas de service Nest ratifié — DIFFÉRÉS, signalés.

  # ── Écran 1 : Registre de paramétrage ──
  Scénario: V6-REGISTRE — changer un paramètre est changer une règle : typé, motivé, jamais rétroactif
    Étant donné le registre R-Q généré du canon (R125)
    Quand un CO écrit une valeur bien typée avec un motif
    Alors le changement est tracé append-only et matérialisé (R126)
    Quand il écrit sans motif
    Alors O-Live refuse (R7)
    Quand il écrit une valeur du mauvais type
    Alors O-Live refuse (R125)
    Quand il tente un effet rétroactif
    Alors O-Live refuse (R126 : on ne réécrit pas le passé)
    Et la valeur à une date passée reste la valeur d'alors (R127)

  # ── Écran 2 : Config à date & Go-live ──
  Scénario: V6-GOLIVE — pas d'activation sur un questionnaire troué
    Étant donné une configuration reconstruite à une date (R127)
    Quand on tente d'activer sans signature
    Alors O-Live refuse (R128)
    Quand on tente d'activer avec une clé requise manquante
    Alors O-Live refuse en NOMMANT la clé manquante (R128)
    Quand toutes les clés requises sont renseignées et la signature fournie
    Alors le tenant passe ACTIF (go-live gouverné)
