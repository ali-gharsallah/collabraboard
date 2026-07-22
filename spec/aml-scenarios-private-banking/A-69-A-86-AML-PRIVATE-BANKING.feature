# language: fr
Fonctionnalité: AML Scénarios Private Banking (A-69..A-86)
  Statut: Validé Bloc 48
  Règles: R189→R206
  Implémentation: TypeScript + ScreeningService + AmlScoringEngine

  Scénario: A-69 Structuring Pattern Détecté
    Étant donné un compte privé client Alice avec solde CHF 1M
    Et aucune structure de virement historique
    Quand Alice effectue 5 virements sortants [CHF 19999, 19999, 19999, 20000, 20000] en 2 jours
    Vers des comptes différents (mais même bénéficiaire ultime)
    Alors O-Live génère Signal STRUCTURING (Niveau 2)
    Et note : "5 virements proche seuil CHF 100k en 48h"
    Et motif : "Pattern structuring (R189)"

  Scénario: A-70 Cross-Border Circular Movements
    Étant donné compte client Bob
    Et Acme Ltd (UK), Acme GmbH (DE), Acme SA (FR) = bénéficiaires ultimes identiques
    Quand Bob effectue 3 virements [CHF 250k, 250k, 250k] vers ces 3 entités
    Dans 3 pays différents en 24 heures
    Alors Signal CROSS_BORDER_CIRCULAR (Niveau 2)
    Et motif : "Même UBO, 3 juridictions, 24h (R190)"

  Scénario: A-71 Account Velocity Spike
    Étant donné compte Alice
    Et historique : moyenne CHF 0 virements/mois sur 18 mois
    Quand Alice effectue CHF 10M sorties (5 × CHF 2M) en 3 jours
    Alors Signal UNUSUAL_VELOCITY (Niveau 2)
    Et motif : "Compte dormant 18m → CHF 10M en 72h (R191)"

  Scénario: A-72 Sanctions List Hit
    Étant donné O-Live alimenté avec listes OFAC daily
    Quand client Carol transfère CHF 500k vers bénéficiaire
    Et bénéficiaire = entité OFAC Specially Designated Nationals
    Alors O-Live **refuse immédiatement** (Niveau 1 BLOQUER)
    Et motif non-modifiable : "Sanctions OFAC SDN (R192)"

  Scénario: A-73 UBO Mismatch Detection
    Étant donné compte Alice, UBO documenté = Alice
    Quand O-Live détecte (via pattern) : vrai UBO = Xavier (père, PEP)
    Alors Signal UBO_MISMATCH (Niveau 2)
    Et action : "KYC à renouveler (R193)"

  Scénario: A-74 Money Laundry In-Out Same Day
    Étant donné compte Dave
    Quand virement entrée CHF 1M (10h) + sortie CHF 980k (14h)
    Vers juridiction différente
    Alors Signal PLACEMENT_WITHDRAWAL (Niveau 2)
    Et motif : "In/Out même jour, layering (R194)"

  Scénario: A-75 Third Party Always Pays
    Étant donné compte EveCorp
    Et factures supplier : 12 × CHF 50k
    Quand 0% payé directement Eve, 100% par FormationX SARL
    Alors Signal THIRD_PARTY_PAYER (Niveau 1)
    Et motif : "Titulaire ne paie jamais (R195)"

  Scénario: A-76 Circular Fund Flow Pattern
    Étant donné comptes Frank (A), Ghost Inc (B), Phantom Ltd (C)
    Et tous = même UBO
    Quand A→B (CHF 500k, J1), B→C (CHF 490k, J2), C→A (CHF 480k, J3)
    Alors Signal CIRCULAR_FLOW (Niveau 2)
    Et motif : "Cycle A→B→C→A (R196)"

  Scénario: A-77 HRI Jurisdiction Transaction
    Étant donné config HRI = [Iran, Syria, DPRK, Cuba]
    Quand client Grace transfère CHF 100k vers Iran
    Alors Signal HRI_JURISDICTION (Niveau 2)
    Et blocage : "attente CO approval (R197)"

  Scénario: A-78 Suspicious Round Amounts
    Étant donné compte Helen
    Quand 80% transactions = CHF 100k, 50k, 25k exactement
    Et variation < 5%
    Alors Signal ROUND_AMOUNTS (Niveau 1)
    Et motif : "Pattern montants ronds (R198)"

  Scénario: A-79 Cash Deposit Wire Out
    Étant donné compte Ivan, dépôt espèces CHF 200k (J1, 10h)
    Quand virement sortant CHF 195k (J1, 16h)
    Vers Cayman
    Alors Signal CASH_WIRE_PATTERN (Niveau 2)
    Et motif : "Dépôt cash → wire out (R199)"

  Scénario: A-80 PEP Adjacent Payments
    Étant donné compte Jack
    Quand Jack paie CHF 30k/mois
    Et bénéficiaire = Michel (père, PEP)
    Alors Signal PEP_ADJACENT (Niveau 2)
    Et action : "KYC update + 4-eyes (R200)"

  Scénario: A-81 Invoice Underpayment Pattern
    Étant donné factures supplier : CHF 50k, 75k, 100k
    Quand paiements : CHF 49.95k, 74.95k, 99.95k (toujours -0.1%)
    Alors Signal INVOICE_UNDERPAY (Niveau 1)
    Et motif : "Sous-paiement systématique (R201)"

  Scénario: A-82 Counterparty Amount Explosion
    Étant donné compte Kate, supplier habituel CHF 10k/mois
    Quand virement CHF 2M (200× normal)
    Et suivi 3 × CHF 1.5M en 48h
    Alors Signal COUNTERPARTY_VELOCITY (Niveau 2)
    Et motif : "Montant supplier × 200 (R202)"

  Scénario: A-83 CRS Non-Compliance Indicator
    Étant donné client Lisa, fiscal France, compte CHF 1M+
    Quand Lisa non-reportée IRS
    Alors Signal CRS_NON_COMPLIANCE (Niveau 2 BLOCK)
    Et action : "Blocage opérations (R203)"

  Scénario: A-84 Fiduciary Escrow Abuse
    Étant donné compte "Maître Pierre SARL" (fiduciary)
    Quand dépôts clients CHF 50M
    Et retraits personnels CHF 20M (3 mois)
    Alors Signal FIDUCIARY_ABUSE (Niveau 2)
    Et action : "Audit immédiat (R204)"

  Scénario: A-85 Tax Minimization Circuit
    Étant donné compte Olivier, revenu CHF 200k déclaré
    Quand pattern virements Suisse→Luxembourg→Suisse
    Et pas de fiscalisation documentée
    Alors Signal TAX_MINIMIZATION (Niveau 1)
    Et motif : "Pattern optimisation fiscale (R205)"

  Scénario: A-86 Portfolio Concentration
    Étant donné patrimoine Nathalie CHF 50M
    Quand 45M (90%) en 1 compte courant seulement
    Alors Signal CONCENTRATION_RISK (Niveau 1)
    Et motif : "Non-diversifié (R206)"
