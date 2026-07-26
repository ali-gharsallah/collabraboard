# language: fr
Fonctionnalité: Vague 7 — PMS : Mandats, Adéquation & Breaches (spec-first)
  Statut: Vague 7
  Écran: PMS (mandats · valorisation/drift · pre-trade · adéquation · breaches)
  Doctrine: INTÉGRER, pas refaire. Ce n'est PAS un moteur de portefeuille — c'est la couche
  COMPLIANCE sur des positions (importées d'un core). R105→R108 ratifiés.

  # ── Adéquation à la souscription (R107) ──
  Scénario: V7-ADEQ — le riskLevel CLIENT borne le mandat ; l'humain décide, rien n'est rétrogradé
    Étant donné un client de profil LOW
    Quand on tente d'attacher un mandat exigeant un profil HIGH
    Alors O-Live refuse (inadéquation LSFin, R107)
    Quand un mandat exigeant plus que le client existe déjà
    Alors l'adéquation lève une ALERTE nommée (R107) sans jamais rétrograder le mandat

  # ── Valorisation & drift (R105) ──
  Scénario: V7-DRIFT — l'écart d'allocation se CONSTATE, jamais un rééquilibrage automatique
    Étant donné un mandat avec des bornes d'allocation et des positions hors bornes
    Quand on valorise le mandat
    Alors un drift est détecté et un breach OUVERT est inscrit (R105/R108)
    Et les positions restent INTACTES (aucun rééquilibrage auto, R44)

  # ── Pre-trade (R106) ──
  Scénario: V7-PRETRADE — exclusions et concentration bloquent en amont, motivé
    Étant donné un mandat avec exclusions sectorielles et plafond de concentration
    Quand un ordre touche un secteur exclu
    Alors O-Live BLOQUE (exclusion mandat, R106)
    Quand un ordre dépasse le plafond de concentration
    Alors O-Live BLOQUE (concentration, R106)
    Quand un ordre est conforme
    Alors O-Live laisse PASSER (le passage se prouve)

  # ── Breaches (R108/R7) ──
  Scénario: V7-BREACH — le registre des breaches ; l'échéance escalade, ne liquide pas
    Étant donné un breach OUVERT
    Quand on tente de le clôturer sans motif
    Alors O-Live refuse (R7)
    Quand on le clôture avec motif
    Alors le breach passe CLOS (auteur = jeton)
