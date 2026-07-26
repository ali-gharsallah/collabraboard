# language: fr
Fonctionnalité: Vague 3 — Le cycle client de bout en bout (spec-first)
  Statut: Vague 3
  Écrans: Onboarding · Account Review · Screening · Personnes liées/UBO · Change of Circumstances · Dashboard
  Objectif: qu'un dossier vive de l'entrée à la revue, sans trou — entièrement sur le vrai backend.
  Implémentation: React (apps/web) sur routes réelles (apps/api), preuve e2e.

  # ── Écran 1 : Onboarding / entrée en relation — aiguillage SDD/CDD/EDD ──
  Scénario: V3-ONBOARD — ouvrir une relation ; le système aiguille vers le bon niveau de diligence
    Étant donné un Relationship Manager authentifié
    Quand il ouvre une relation (prospect) puis entre en collecte avec les 4 infos (structure, compte, pays)
    Alors O-Live crée le dossier KYC lié et l'aiguille (R117/R118) :
      | structure=TRUST + pays à haut risque | EDD |
      | structure=PP + pays standard         | SDD |
    Et la trace de risque (riskTrace) est auditable
    Et l'ouverture reste refusée tant que le KYC n'est pas VALIDATED (R119)

  # ── Écran 2 : Account Review (revue périodique) — orchestration, zéro canon inventé ──
  Scénario: V3-REVIEW — conduire une revue ; conclusion et visas tracés
    Étant donné un dossier KYC existant
    Quand le Compliance Officer conduit une revue (re-screening + décision)
    Alors le re-screening laisse une trace de passage (R103, screening.run)
    Et la conclusion s'appuie sur des primitives RATIFIÉES (visas/validate KYC) — aucun agrégat « revue » inventé
    Et l'auteur de chaque décision = le jeton, jamais le corps

  # ── Écran 3 : Screening (sanctions/PEP) — lever ou confirmer un hit ──
  Scénario: V3-SCREEN — qualifier un hit ; la décision est documentée
    Étant donné un screening lancé sur un client dont le nom correspond à une entrée de liste
    Quand le Compliance Officer qualifie le hit VRAI_POSITIF avec un motif
    Alors O-Live PROPOSE l'escalade (gel/clarification/MROS) sans jamais l'exécuter (R39/R44)
    Quand il tente de qualifier sans motif
    Alors O-Live refuse (R7)
    Et la trace de passage s'écrit TOUJOURS, hit ou pas (R103)

  # ── Écran 4 : Personnes liées / UBO — chaîne de contrôle ──
  Scénario: V3-UBO — voir la chaîne de contrôle et les UBO
    Étant donné un dossier et des personnes
    Quand le RM rattache une personne comme UBO au dossier et déclare une relation bijective
    Alors la chaîne de contrôle et les relations se relisent (R31/R34)
    Et un autre tenant ne voit rien (isolation RLS)
    # Écart signalé : le % de détention n'est pas un attribut ratifié du modèle — non fabriqué.

  # ── Écran 5 : Change of Circumstances (CoC) — matérialité, circuit ──
  Scénario: V3-COC — un changement matériel déclenche le bon circuit
    Étant donné une personne liée à un dossier
    Quand le Compliance Officer enregistre un changement sur un champ d'IDENTITÉ (nom)
    Alors O-Live propage le changement aux dossiers (événement tracé) — aucune bascule d'état par effet de bord
    Et un re-screening est DÉCLENCHÉ (R42), proposé jamais exécuté

  # ── Écran 6 : Dashboard exécutif (minimal) — stock par état, goulots ──
  Scénario: V3-DASH — voir où sont les dossiers et ce qui bloque
    Étant donné des onboardings, des dossiers de risque et des hits de screening d'un tenant
    Quand le COO ouvre le tableau de bord
    Alors il voit le stock par état (onboarding par étape, dossiers de risque par statut, hits par statut)
    Et les chiffres sont cloisonnés au tenant (RLS)

  # ── Objectif de fin de vague : un dossier COMPLET de bout en bout ──
  Scénario: V3-CYCLE — entrée → KYC → screening → revue → changement, sur le vrai backend
    Étant donné un prospect
    Quand on l'entre en relation, aiguille en diligence, screene, revoit puis enregistre un changement
    Alors chaque étape laisse sa trace, sans trou, entièrement sur Postgres réel
