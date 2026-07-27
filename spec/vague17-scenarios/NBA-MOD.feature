# language: fr
@ratifie @R243-R246 @MOD-nba @implemente-vague17
Fonctionnalité: MOD Décision NBA (R243..R246) — RATIFIÉ, implémenté (Vague 17)
  Statut: RATIFIÉ (« OK pour R239..R246 », Ali) — IMPLÉMENTÉ en Vague 17.
  Source: SPEC-FRONT-CÂBLAGE v2 · AMENDEMENT A2 §A2.2. R44 strict : humain seulement,
  zéro exécution directe — l'ACCEPT émet NBA_DECIDED, le service Tâches en fait naître la tâche.

  Scénario: NB-01 Suggestion immuable une fois proposée (R243)
    Étant donné une suggestion S PROPOSED avec 4 facteurs
    Quand toute tentative de modification survient
    Alors elle échoue (aucune route d'écriture) et S reste identique

  Scénario: NB-02 Décision unique (R244)
    Étant donné une suggestion S PROPOSED
    Quand u1 décide ACCEPT
    Alors NBA_DECIDED { acteur: u1 } est écrit append-only et S passe DECIDED
    Et une seconde décision échoue avec NBA_ALREADY_DECIDED

  Scénario: NB-03 Motif de rejet paramétré (R244)
    Étant donné nba.reject_rationale_required = true
    Quand u1 rejette sans motif
    Alors l'appel échoue avec NBA_REJECT_RATIONALE_REQUIRED
    Et un rejet motivé est enregistré

  Scénario: NB-04 Ajustement non vide (R244)
    Étant donné une suggestion PROPOSED
    Quand u1 décide ADJUST sans adjustment
    Alors l'appel échoue avec NBA_ADJUSTMENT_REQUIRED
    Et avec adjustment, la proposition d'origine reste intacte

  Scénario: NB-05 Humain seulement, zéro exécution directe (R245, R44)
    Étant donné un compte de service
    Quand il tente de décider
    Alors l'appel échoue avec NBA_DECISION_HUMAN_ONLY
    Et quand un humain accepte, le seul effet NBA est NBA_DECIDED
    Et la tâche naît du service Tâches consommant cet événement (TA-01)

  Scénario: NB-06 Rejeu des suggestions et décisions (R246, R48)
    Étant donné une suggestion proposée puis rejetée
    Quand on rejoue avant sa création, elle est inexistante
    Et après décision, elle est DECIDED { REJECT } avec acteur et motif
