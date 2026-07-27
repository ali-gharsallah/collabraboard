# language: fr
@ratifie @R231-R238 @MOD-43 @implemente-vague13
Fonctionnalité: MOD-43 Formations & Certifications (R231..R238) — RATIFIÉ, implémenté (Vague 13)
  Statut: RATIFIÉ (« OK pour R222..R238 », Ali) — IMPLÉMENTÉ en Vague 13.

  Numérotation R231..R238 continue après R230 (Business Trip). Toute divergence en
  implémentation → nouvelle règle au catalogue, jamais de règle implicite.

  Scénario: FO-01 Référentiel tenant sans dur (R231)
    Étant donné le tenant A définit la formation "AML annuelle" validité 12 mois cible [RM, CO]
    Et le tenant B ne la définit pas
    Quand on liste les formations de chaque tenant
    Alors A voit "AML annuelle" et B ne la voit pas
    Et aucun type de formation n'existe hors paramétrage

  Scénario: FO-02 Complétion événementielle avec attestation (R232)
    Étant donné une assignation ASSIGNED pour u1
    Quand u1 complète avec l'attestation doc-123 (GED)
    Alors un événement TRAINING_COMPLETED est écrit avec { docId: doc-123 }
    Et le statut passe COMPLETED (mode AUTO)

  Scénario: FO-03 Rappels J-x informatifs (R233, R39)
    Étant donné training.reminder_days = [30, 7]
    Et une certification expirant le 2026-10-01
    Quand les jobs des 2026-09-01 et 2026-09-24 s'exécutent
    Alors deux notifications de rappel sont émises
    Et aucun accès ni objet n'est restreint

  Scénario: FO-04 Append-only des attestations (R234, R48)
    Étant donné une attestation 2025 puis une attestation 2026 pour la même formation
    Quand on consulte l'historique
    Alors les deux attestations sont présentes, horodatées
    Et toute tentative d'UPDATE sur une attestation échoue

  Scénario: FO-05 Validation par visa (R235, R15)
    Étant donné training.completion_validation = VALIDATED avec rôle RH
    Quand u1 dépose son attestation
    Alors l'assignation reste IN_PROGRESS avec un visa RH PENDING
    Et elle passe COMPLETED à la signature du visa

  Scénario: FO-06 Auto-validation interdite (R235, déclinaison R13)
    Étant donné u1 détient aussi le rôle RH
    Quand u1 tente de signer le visa de sa propre complétion
    Alors l'appel échoue avec TRAINING_SELF_VALIDATION_FORBIDDEN

  Scénario: FO-07 Visibilité par profil (R236)
    Étant donné u1 (RM) et son responsable m1, et un CO habilité "voit tout"
    Quand chacun liste les dossiers formation
    Alors u1 voit uniquement le sien
    Et m1 voit son équipe
    Et le CO voit l'ensemble du tenant

  Scénario: FO-08 Rejeu certifiant (R238)
    Étant donné une certification obtenue le 2024-05-01, expirée le 2025-05-01, renouvelée le 2025-06-15
    Quand on interroge l'état au 2025-05-20
    Alors la réponse est "non certifié" avec l'historique justificatif
