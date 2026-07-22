# language: fr
Fonctionnalité: Islamic Shariah Compliance Layer (IS-01..IS-15)
  Statut: Validé Bloc 49
  Règles: R207→R221
  Implémentation: TypeScript + IslamicScreeningService
  # Provenance: ce .feature est la SEULE source livrée (ni service ni test ratifié dans le zip).
  # Implémentation + tests écrits depuis ce Gherkin, sur exception ratifiée par Ali (cf. Bloc 48).

  Scénario: IS-01 Client Islamic Validation
    Étant donné client Fatima avec préférence Islamic Banking
    Quand Fatima effectue virements vers [Brasserie Beaumont (alcool), PlayWin Casinos (jeux)]
    Alors O-Live génère Alert ISLAMIC_PROFILE_VIOLATION (Niveau 2)
    Et motif : "Client Islamic, pattern non-Shariah (R207)"

  Scénario: IS-02 Riba Transaction Detected
    Étant donné compte Islamic Hassan
    Quand virement entrant CHF 100k "Interest on deposited amount" d'une banque conventionnelle
    Alors Alert RIBA_INCOME (Niveau 2) — motif "Revenu intérêt Shariah non-compliant (R208)"

  Scénario: IS-03 Maysir Speculation Block
    Étant donné compte Islamic Samir
    Quand Samir transfère CHF 500k vers plateforme spéculation volatile (>80%)
    Alors O-Live refuse immédiatement (Niveau 1 BLOCK, R209) — maysir

  Scénario: IS-04 Gharar Contract Refusal
    Étant donné compte Islamic Noor
    Quand Noor veut signer un contrat dérivé (conditions complexes)
    Alors Alert GHARAR_DETECTED (Niveau 2, R210) — suggérer Murabaha/Musharaka/Ijarah

  Scénario: IS-05 Annual Zakat Calculation
    Étant donné compte Islamic Ahmed, patrimoine CHF 500k (> nisab CHF 100k)
    Quand l'année fiscale se termine
    Alors Zakat obligatoire = CHF 500k × 2.5% = CHF 12.5k, status PENDING_PAYMENT (R211)

  Scénario: IS-06 Sukuk Authenticity Verification
    Étant donné compte Islamic Layla achetant un Sukuk
    Si non-authentique (pas de certificat Shariah AAOIFI/ISRA)
    Alors Alert FAKE_SUKUK (Niveau 2, R212)

  Scénario: IS-07 Counterparty Halal Compliance
    Étant donné compte Islamic Amira payant un fournisseur au cœur de métier haram
    Alors Alert HARAM_COUNTERPARTY (Niveau 1, R213) — suggérer alternatives halal

  Scénario: IS-08 Qard Hasan Participation Tracking
    Étant donné Qard ul Hasan CHF 10k vers ONG islamique
    Alors ledger : Principal CHF 10k, Intérêt CHF 0 (R214)

  Scénario: IS-09 Mudaraba Account Distribution
    Étant donné Mudaraba profit CHF 12k, partage 70/30 banque/client
    Alors distribution banque CHF 8.4k / client CHF 3.6k, status POSTED (R215)

  Scénario: IS-10 Islamic Entity Sanctions Exception
    Étant donné bénéficiaire = entité islamique caritative sur liste OFAC
    Alors O-Live attend une revue manuelle (PAS d'auto-block) — peut être exception (R216)

  Scénario: IS-11 Annual Shariah Audit
    Étant donné portefeuille Islamic (150 clients, 5000 transactions, 10 violations)
    Alors rapport audit : 99.8% conforme AAOIFI (R217)

  Scénario: IS-12 Waqf Perpetual Account Management
    Étant donné Waqf principal CHF 5M, revenu annuel CHF 200k
    Quand demande de retrait CHF 100k (≤ revenu)
    Alors autorisé (revenu seul) ; refusé si retrait > revenu — principal immuable (R218)

  Scénario: IS-13 Takaful Premium Tracking
    Étant donné Takaful prime CHF 500/mois
    Alors prime au pool mutualisé (pas l'assureur), partage de surplus trimestriel (R219)

  Scénario: IS-14 Sukuk Maturity Refinancing
    Étant donné Sukuk arrivant à maturité dans 3 mois
    Alors alerte de maturité + options de refinancement islamiques (R220)

  Scénario: IS-15 ESG Islamic Certification
    Étant donné fonds ESG certifié mais sans certification islamique
    Alors Alert MISSING_ISLAMIC_CERT (Niveau 1, R221)
