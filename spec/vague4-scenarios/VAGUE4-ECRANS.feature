# language: fr
Fonctionnalité: Vague 4 — Les écrans « plateforme » qui complètent l'offre (spec-first)
  Statut: Vague 4
  Écrans: Transferts & ordres · Settlement/exécution · Screening avancé · Reporting MROS · GED/coffre · Registre LBA
  Doctrine: INTÉGRER, pas refaire. On ne reconstruit ni PMS ni core — si la donnée vient d'un
  core externe, on branche un PORT (R167→R169), jamais une réimplémentation.
  Liste noire (JAMAIS construite) : RH, e-learning, business trip, budget, réunions, cyber-SOC.

  # ── Écran 1 : Transferts & ordres — suivi, statuts ──
  Scénario: V4-TX — une transaction passe par le portail ; verdict tracé, statut client sans fuite
    Étant donné un client au profil connu (golden record)
    Quand une transaction très supérieure au profil est évaluée (R140/R142)
    Alors le portail rend un verdict SUSPEND, tracé garde par garde (append-only)
    Et la file de revue n'est lisible que par un rôle habilité (R143)
    Quand un rôle habilité décide LIBERER avec motif (R7)
    Alors la transaction est libérée
    Et la vue CLIENT ne porte JAMAIS de motif AML (art. 10a, R132) — seulement un statut

  # ── Écran 2 : Settlement / exécution — port core, pas de moteur ──
  Scénario: V4-SETTLE — l'exécution se lit d'un PORT core ; sans port, refus explicite (jamais un simulacre)
    Étant donné aucun port core banking configuré
    Quand on demande l'état de synchronisation
    Alors O-Live restitue l'état (lots, quarantaine) en LECTURE SEULE (R168)
    Quand on tente d'importer un lot sans port
    Alors O-Live REFUSE explicitement (R114/R167) — jamais de donnée inventée

  # ── Écran 3 : Screening avancé — adverse media & listes complémentaires ──
  Scénario: V4-SCREEN-ADV — screener sur une liste complémentaire (adverse media/PEP)
    Étant donné une liste complémentaire (adverse media)
    Quand on lance le screening sur cette liste
    Alors la trace de passage s'écrit (R103) et les hits se qualifient (R101)
    # La « liste complémentaire » est un paramètre d'entrée, pas un moteur séparé — signalé.

  # ── Écran 4 : Reporting réglementaire (MROS, états) — exact & opposable ──
  Scénario: V4-MROS — décider, relire à l'identique, geler ; le dossier est figé
    Étant donné un cas de risque ESCALADÉ
    Quand le MLRO décide (communiquer/s'abstenir) avec motif et pièces
    Alors une communication est créée avec une EMPREINTE de dossier (dossierSha256)
    Et la relecture rend EXACTEMENT la même empreinte (opposable, R130)
    Et une seconde décision sur le même cas est REFUSÉE (dossier figé, R130)
    Et un rôle non habilité ne lit rien (art. 10a, R132)

  # ── Écran 5 : GED / documents — coffre, preuve ──
  Scénario: V4-GED — la pièce porte sa preuve d'intégrité, jamais son contenu
    Étant donné une pièce classée avec des versions
    Quand un rôle autorisé ouvre la fiche
    Alors il voit l'EMPREINTE des versions (preuve d'intégrité, R145), jamais le contenu
    Et un rôle non autorisé ne voit rien (R110)

  # ── Écran 6 : Registre LBA — traçabilité agrégée ──
  Scénario: V4-REGISTRE — le registre LBA agrège les journaux append-only, cloisonné
    Étant donné des décisions MROS, des verdicts de transaction et des passages de screening d'un tenant
    Quand le Compliance ouvre le registre LBA
    Alors il voit une piste d'audit agrégée (communications, verdicts, runs)
    Et un autre tenant ne voit RIEN (isolation RLS)
