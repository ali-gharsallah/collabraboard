# Catalogue Complet des Règles O-Live — R1..R206

> ## État réel vérifié au 2026-07-22
> Ce catalogue s'arrête à **R206**, mais le **code va désormais jusqu'à R221** : la **couche
> Shariah / Islamic (R207→R221)** est implémentée et mergée (module `apps/api/src/modules/islamic/`,
> 41 tests verts, PR #22/#23). Le titre « R1..R206 » est donc **incomplet**. Référentiel Islamic :
> `spec/islamic-scenarios-shariah/`. Vérification complète : `docs/ETAT-REEL-VERIFIE.md`.


**État :** Ratifié R1→R188 (existant), Nouveau R189→R206 (AML Private Banking).  
**Statut :** ✅ Spec validée, attendu implémentation Bloc 48.

---

## Règles R1..R50 (Existantes — Bloc Foundation, KYC, Workflow)

### Bloc R1..R10 : KYC Core
- **R1** : Un client = plusieurs KYC successifs (R1, R2...Rn)
- **R2** : Visa lié au rôle, pas personne nommée
- **R3** : Change tracker append-only (question → history)
- **R4** : Four-eyes section level (R13 surcharge)
- **R5** : Droits EDIT/VIEW/REQUIRED/HIDDEN par rôle
- **R6** : Risk scoring automatique (SDD/CDD/EDD)
- **R7** : Motifs obligatoires transitions sensibles
- **R8** : Propagation contrôlée → Client Master (validation uniquement)
- **R9** : Date-effective versioning (grandfathering R29)
- **R10** : Audit trail immuable (R48/R49)

### Bloc R11..R30 : Screening, Comptes, Monitoring
- **R11** : Screening lancé AVANT KYC approbation
- **R12** : Hits qualification motivée (false positive, accept, escalate)
- **R13** : Four-eyes exclusion au niveau section (createur ≠ approbateur)
- **R14** : Compte courant ouverture post-KYC validation
- **R15** : Visa object uniforme (pays, type, status, dates)
- **R16** : Account Review annuel déclencheur
- **R17** : Change of Circumstances workflow simplifié
- **R18** : AML Monitoring en temps réel (streaming)
- **R19** : MROS (Mutual Review of Standards) tracé
- **R20** : Scoring AML (0-100, dynamic thresholds)
- **R21→R30** : Réservées (futures évaluations, scoring, benchmarking)

### Bloc R31..R50 : Gouvernance, Paramétrage, IA
- **R31** : Paramètres tenant = banque profile (tenant Q)
- **R32** : Multi-tenant isolation (RLS + app filtering)
- **R33** : Confidentialité par rôle (masquage sections/questions)
- **R34** : Audit trail persistante (5 ans retention)
- **R35** : Export compliance (FINMA, SECO, OBA)
- **R36** : Chiffrement données sensibles (PII, UBO)
- **R37** : Immutabilité événements domain (append-only outbox)
- **R38** : Événements tracés (KYC_CREATED, KYC_APPROVED, SCREENING_HIT, etc.)
- **R39** : Mesure sans coercion (système suggère, humain décide)
- **R40** : AI pre-review assistant (Claude, R44)
- **R41..R50** : Réservées

---

## Règles R51..R100 (Existantes — Transaction, GED, Workflow Moteur)

### Bloc R51..R70 : Transactions, Screening Continu
- **R51** : Transactions filtrées par patterns AML
- **R52** : Risque transaction scored in-flight
- **R53** : Blocage MROS (autorisation 4-eyes pour déblocage)
- **R54** : Ledger déterministe (replay-able)
- **R55** : Rejection motivation obligatoire (audit trail)
- **R56..R70** : Réservées

### Bloc R71..R85 : GED, OCR, Document Management
- **R71** : Document versioning (date-effective)
- **R72** : OCR validation (manual confirmation sensitive docs)
- **R73** : Document linking (KYC ↔ comptes ↔ transactions)
- **R74** : PII masking in audit logs (excepté authorized roles)
- **R75..R85** : Réservées

### Bloc R86..R100 : Workflow Moteur, Tâches
- **R86** : Tâche = event payload typed (task-discriminated.ts)
- **R87** : TaskType enum (VERIFIER_KYC, QUALIFIER_HIT, DECIDER_MROS, etc.)
- **R88** : Tâche urgence = SLA (4h, 8h, 24h, custom)
- **R89** : Assignation = rôle-based routing
- **R90** : Escalade automatique post-SLA
- **R91..R100** : Réservées

---

## Règles R101..R150 (Existantes — Conformité, Réglementaire, Advanced)

### Bloc R101..R120 : Conformité & Regulatory
- **R101** : CDB 20 formulaire A/K/S/T applicabilité
- **R102** : FATCA/CRS certification (résidence fiscale)
- **R103** : PEP screening (tous clients > seuil)
- **R104** : Sanction lists (OFAC, EU, UN, SECO) sync daily
- **R105** : Beneficial Owner chain (UBO detection)
- **R106** : SOF/SOW justification (origin funds/wealth)
- **R107** : Cross-border restrictions (jurisdiction licensing)
- **R108** : ESG screening (sectors, climate, controversies)
- **R109..R120** : Réservées

### Bloc R121..R140 : Core Banking, Adaptateurs, Ports
- **R121** : CoreBankingPort optional (sans secret = graceful refusal)
- **R122** : Avaloq adapter REST Basic Auth
- **R123** : Temenos adapter REST Bearer Token
- **R124** : Olympic adapter (ERI) REST Basic Auth
- **R125** : Adapter injection (first available wins)
- **R126** : Paramétrage via .env (perimetre, instance, version)
- **R127** : Motivs acte (all writes require reason) = R7 application
- **R128** : PreReview Claude IA (R44 non-bloquant)
- **R129..R140** : Réservées

### Bloc R141..R150 : Deployment, Operations
- **R141** : Secrets management (env, vault, K8s secrets)
- **R142** : Health checks (DB, Redis, mail, core banking)
- **R143** : Smoke tests (8 checks minimum)
- **R144** : Audit log export (SFTP, S3, syslog)
- **R145** : Backup strategy (daily, 30-day retention)
- **R146** : PITR capability (restore to date)
- **R147..R150** : Réservées

---

## Règles R151..R188 (Existantes — À vérifier dans session antérieure)

**Note :** R151..R188 sont livrées dans la session antérieure. Consulter:
- Transcript compaction (§90+) pour contexte détails
- Word "OLive-Specifications-Moteur-Workflow-v2" pour contenu exact
- Bloc 41-47 prompts pour implémentation

---

## **NOUVEAU — Règles R189..R206 (AML Private Banking)**

### Bloc R189..R199 : Structuring, Cross-Border, Velocity, Sanctions
- **R189** : Structuring detection (N≥5 virements, Σ > seuil, pattern novo) → Signal Nivel 2
  - Params: `structuring_alert_count` (défaut 5), `structuring_amount_threshold_chf` (défaut 100k)
- **R190** : Cross-border circular (≥2 pays, même UBO, ≤48h) → Signal Nivel 2
  - Params: `cross_border_window_hours` (48), `cross_border_min_countries` (2)
- **R191** : Unusual velocity (dormant 18m+ → 5× moyenne) → Signal Nivel 2
  - Params: `velocity_dormant_months` (18), `velocity_multiplier` (5)
- **R192** : Regulatory list matching (OFAC/EU/UN/SECO) → **BLOQUER IMMÉDIAT** (Nivel 1, non-révocable)
  - Params: listes sync daily, matching tolerance (nom, IBAN, etc.)
- **R193** : UBO mismatch (déclaré ≠ détecté) → Signal Nivel 2
  - Params: auto-detection patterns, PEP cascading
- **R194** : In-Out same day (entrée + sortie ≈montant, ≤6h) → Signal Nivel 2
- **R195** : Third-party payer (titulaire 0% paiements directs, 100% tiers) → Signal Nivel 1
- **R196** : Circular flow (A→B→C→A, même UBO, ≤10j) → Signal Nivel 2
- **R197** : HRI jurisdiction (Iran, Syria, DPRK, Cuba, etc.) → Signal Nivel 2, blocage CO approval
  - Params: HRI country list (tenant config)
- **R198** : Round amounts (70%+ montants ronds, var<5%) → Signal Nivel 1
- **R199** : Cash deposit + wire out (dépôt espèces → virement >80%, ≤24h) → Signal Nivel 2

### Bloc R200..R206 : PEP, Invoice, Counterparty, CRS, Fiduciary, Tax, Concentration
- **R200** : PEP adjacent (client paie tiers = PEP/Near-PEP) → Signal Nivel 2
- **R201** : Invoice underpay (paiement < facture, pattern systématique) → Signal Nivel 1
- **R202** : Counterparty velocity (montant > 150% mean+σ) → Signal Nivel 2
- **R203** : CRS/FATCA non-compliance (UE/USA, >CHF 1M, pas d'auto-cert) → Signal Nivel 2 **BLOCK**
- **R204** : Fiduciary abuse (compte notaire/avocat, retrait >10% dépôts clients) → Signal Nivel 2
- **R205** : Tax minimization circuit (Suisse→tax havens, pattern optimization) → Signal Nivel 1
- **R206** : Concentration risk (>80% portfolio 1-2 comptes courants) → Signal Nivel 1

---

## Récap & État

| Bloc | Règles | Statut | Implémentation |
|---|---|---|---|
| R1–R50 | Foundation KYC | ✅ Ratifié | Blocs 1-15 (complété) |
| R51–R100 | Transaction/GED/Workflow | ✅ Ratifié | Blocs 16-30 |
| R101–R150 | Compliance/Core/Deployment | ✅ Ratifié | Blocs 31-45 |
| R151–R188 | (Vérifier antériorité) | ✅ Ratifié | Blocs 41-47 |
| **R189–R206** | **AML Private Banking** | 📋 Validé | **Bloc 48 (attendu)** |

---

## Prochaines étapes

1. ✅ **R189–R206 validée** — attente code Bloc 48
2. ⏳ **Islamic Layer (IS-01..IS-15)** — spec en cours, validation avant Bloc 49
3. ⏳ **Paramétrages AML UI** — Bloc 48 livrera screens
4. ⏳ **Islamic UI** — Bloc 49 livrera screens

