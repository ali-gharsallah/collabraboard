# language: fr
@proposed @R222-R230 @MOD-75 @gele-attente-validation-Ali
Fonctionnalité: MOD-75 Business Trip (R222..R230) — RÈGLES PROPOSÉES, code gelé
  Statut: PROPOSÉ (SPEC-FRONT-CÂBLAGE v2, section 7.1). AUCUN code front ni back
  tant qu'Ali n'a pas validé « OK pour R222..R238 ». Gherkin d'abord.
  Numérotation R222..R230 continue après R221 (Bloc 49). Toute divergence en
  implémentation → nouvelle règle au catalogue, jamais de règle implicite.

  Scénario: BT-01 Cycle de vie événementiel (R222)
    Étant donné un voyage en DRAFT
    Quand le RM le soumet
    Alors un événement TRIP_SUBMITTED est écrit dans l'audit trail
    Et le statut devient PENDING_APPROVAL
    Et aucune autre table n'est modifiée par effet de bord

  Scénario: BT-02 Pré-contrôle cross-border par destination (R223)
    Étant donné un voyage avec destinations [FR, SA]
    Et le référentiel tenant classe "sollicitation" INTERDITE en SA
    Quand le voyage est soumis
    Alors un avis cross-border est attaché pour chaque destination
    Et l'avis SA porte { activite: "sollicitation", verdict: "INTERDITE" }
    Et le statut du voyage reste PENDING_APPROVAL (l'avis ne décide pas)

  Scénario: BT-03 Client sans KYC approuvé — informatif (R224)
    Étant donné trip.kyc_check_severity = INFORMATIF
    Et un client visité avec KYC en IN_PROGRESS
    Quand le voyage est soumis
    Alors un signal KYC_NOT_APPROVED est attaché
    Et l'approbation reste possible

  Scénario: BT-04 Client sans KYC approuvé — bloquant (R224)
    Étant donné trip.kyc_check_severity = BLOQUANT_APPROBATION
    Et un client visité avec KYC en IN_PROGRESS
    Quand un approbateur tente d'apposer son visa
    Alors l'appel échoue avec le code TRIP_KYC_NOT_APPROVED

  Scénario: BT-05 Visa uniforme et matrice tenant (R225, R15)
    Étant donné trip.approval_matrix = [SUPERIEUR] et destination à risque ajoutant COMPLIANCE
    Quand le voyage est soumis
    Alors deux visas PENDING sont créés (SUPERIEUR, COMPLIANCE)
    Et le voyage passe APPROVED seulement quand les deux sont SIGNED

  Scénario: BT-06 Auto-approbation interdite (R225, déclinaison R13)
    Étant donné le voyageur détient aussi le rôle SUPERIEUR
    Quand il tente de signer le visa SUPERIEUR de son propre voyage
    Alors l'appel échoue avec le code TRIP_SELF_APPROVAL_FORBIDDEN

  Scénario: BT-07 Contact reports mesurés, jamais coercés (R226, R39)
    Étant donné un voyage COMPLETED avec 3 visites et trip.contact_report_deadline_days = 5
    Et 6 jours se sont écoulés avec 1 seul contact report créé
    Quand le job de mesure s'exécute
    Alors une notification liste les 2 reports manquants
    Et aucun objet n'est verrouillé, aucune action n'est bloquée

  Scénario: BT-08 Certification expirée à la date du voyage (R228)
    Étant donné la juridiction AE exige la certification CROSS_BORDER_AE
    Et la certification du RM expire le 2026-09-01
    Et le voyage commence le 2026-09-10
    Quand le voyage est soumis
    Alors un signal CERTIFICATION_EXPIRED_AT_TRIP_DATE est attaché

  Scénario: BT-09 Rejeu avec grandfathering (R229, R29, R48)
    Étant donné un voyage approuvé le 2026-03-01 sous la version V1 du référentiel cross-border
    Et la version V2 (plus stricte) entre en vigueur le 2026-06-01
    Quand on rejoue le voyage au 2026-03-01
    Alors les avis affichés sont ceux de la version V1
    Et l'approbation reste cohérente avec les règles de l'époque

  Scénario: BT-10 Révision après approbation (R230)
    Étant donné un voyage APPROVED
    Quand le RM ajoute la destination SG
    Alors une révision V2 chaînée à V1 est créée
    Et V2 repasse en PENDING_APPROVAL avec de nouveaux visas
    Et V1 reste intacte dans l'audit
