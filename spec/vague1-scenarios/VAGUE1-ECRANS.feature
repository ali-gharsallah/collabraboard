# language: fr
Fonctionnalité: Vague 1 — écrans du cœur vendable (spec-first)
  Statut: Vague 1
  Écrans: Clients · KYC · Règles AML · File d'alertes · Rejeu KYC à date
  Implémentation: React (apps/web) sur routes réelles (apps/api), preuve e2e.

  # ── Écran 4 : File d'alertes — décision via vraie route POST ──
  Scénario: V1-ALERTE-DECISION — ouvrir un dossier de risque depuis une alerte
    Étant donné une alerte AML levée sur un client (signal persisté)
    Quand le Compliance Officer décide d'instruire cette alerte
    Alors O-Live ouvre un dossier de risque rattaché à l'alerte (POST /v1/riskcases)
    Et un dossier ne peut PAS naître sans alerte (R133 : au moins un signal)

  Scénario: V1-ALERTE-LISTE — la file d'alertes et les dossiers sont consultables et cloisonnés
    Étant donné des alertes et des dossiers de risque d'un tenant
    Quand un autre tenant consulte
    Alors il ne voit ni les alertes ni les dossiers du premier (isolation RLS)

  # ── Écran 5 : Rejeu KYC à date — reconstruction point-in-time (esprit R127) ──
  Scénario: V1-REJEU-KYC — voir un dossier KYC tel qu'il était à une date passée
    Étant donné un dossier KYC créé puis validé (journal append-only kyc.created, kyc.validated)
    Quand l'auditeur demande l'état du dossier À une date située AVANT sa création
    Alors O-Live répond "n'existait pas" à cette date
    Quand l'auditeur demande l'état À la date de création (avant validation)
    Alors O-Live répond "EN_COURS"
    Quand l'auditeur demande l'état À la date de validation
    Alors O-Live répond "VALIDE"
    Et l'état est reconstruit UNIQUEMENT depuis le journal d'événements (auditable)
