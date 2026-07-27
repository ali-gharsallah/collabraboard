# language: fr
@ratifie @R239-R242 @MOD-taches @implemente-vague16
Fonctionnalité: MOD Tâches (R239..R242) — RATIFIÉ, implémenté (Vague 16)
  Statut: RATIFIÉ (« OK pour R239..R246 », Ali) — IMPLÉMENTÉ en Vague 16.
  Source: SPEC-FRONT-CÂBLAGE v2 · AMENDEMENT A2 §A2.1. Réassignation = ratifié
  workload.reassigner (aucune règle nouvelle). Statut mappé au vocabulaire Task ratifié.

  Scénario: TA-01 Naissance par événement uniquement (R239)
    Étant donné un événement KYC_SECTION_REJECTED émis par le moteur
    Quand le service tâches le consomme
    Alors une tâche OPEN est créée, référençant le kycFileId
    Et un événement TASK_CREATED est écrit dans l'audit trail

  Scénario: TA-02 Création manuelle paramétrée (R239)
    Étant donné task.manual_creation = false pour le tenant
    Quand un utilisateur tente POST /v1/tasks
    Alors l'appel échoue avec TASK_MANUAL_CREATION_DISABLED

  Scénario: TA-03 Visibilité scopée serveur (R240)
    Étant donné u1 (RM), m1 (responsable équipe), co1 (voit tout)
    Quand chacun appelle GET /v1/tasks
    Alors u1 ne reçoit que les siennes, m1 celles de son équipe, co1 l'ensemble
    Et aucun paramètre de requête n'élargit son propre périmètre

  Scénario: TA-04 Complétion événementielle immuable (R241)
    Étant donné une tâche T OPEN assignée à u1
    Quand u1 la complète avec le commentaire "OK"
    Alors TASK_COMPLETED { acteur: u1 } est écrit append-only et T passe COMPLETED
    Et une nouvelle tentative échoue avec TASK_ALREADY_COMPLETED

  Scénario: TA-05 Habilitation de complétion (R241)
    Étant donné une tâche assignée à u1 et task.complete_roles = [CO]
    Quand u2 (non assigné, non habilité) tente de compléter
    Alors l'appel échoue avec TASK_COMPLETE_FORBIDDEN
    Et co1 (CO) complète, l'événement portant acteur=co1 (≠ assignee)

  Scénario: TA-06 SLA mesuré, jamais coercitif (R242, R39)
    Étant donné une tâche échue
    Quand le job de mesure s'exécute
    Alors une notification de retard est émise
    Et la tâche reste OPEN, complétable, réassignable
