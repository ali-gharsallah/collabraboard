# GAP ANALYSIS — Règles AML absentes d'O-Live (tous contextes)

Base d'inventaire : audit exhaustif du référentiel actuel (36 règles de scoring S1-S36, 36 scénarios AML_SCENARIOS, 18 scénarios PB R189-R206, 15 Islamic R207-R221, ~30 scénarios CPSI dont abus de marché, screening OFAC/SECO/PEP/adverse).
Référentiels de comparaison : indices de blanchiment annexe OBA-FINMA, typologies GAFI, Wolfsberg (CBDDQ, Trade Finance, Payment Transparency), bibliothèques standard du marché (Actimize/Siron/Napier), CDB 20, LBA/OBA.

Légende : ⬤ absent · ◐ partiellement couvert (règle existante citée).

---

## 1 · Trade-Based Money Laundering (TBML) — quasi absent
Couverture actuelle : ◐ « Factures sous-payées » (R201) uniquement.
- ⬤ Surfacturation (over-invoicing) — miroir de R201, non couvert
- ⬤ Facturation multiple du même bien / de la même expédition
- ⬤ Écart prix facturé vs benchmark marché (unit price analysis par code HS)
- ⬤ Marchandises à double usage (dual-use, contrôle exportations)
- ⬤ Lettres de crédit back-to-back / crédits documentaires vers juridictions à risque
- ⬤ Phantom shipping (paiement sans mouvement de marchandise vérifiable)
- ⬤ Transbordements atypiques / routes maritimes incohérentes
- ⬤ Carrousel documentaire (mêmes contreparties, rôles inversés)

## 2 · Correspondent banking — embryonnaire
Couverture actuelle : ◐ Nested relationships (AML-CB-01), Downstream HRJ (AML-CB-02).
- ⬤ Wire stripping / transparence des paiements : champs ordonnateur/bénéficiaire (50/59) incomplets ou altérés — GAFI R.16, Wolfsberg Payment Transparency
- ⬤ U-turn payments (fonds sortant et revenant via un correspondant tiers)
- ⬤ Payable-through accounts (accès direct de clients du répondant)
- ⬤ Volumétrie par banque répondante vs profil déclaré (KYCC)
- ⬤ Détection shell bank (interdiction LBA)
- ⬤ RMA (Relationship Management Application) actifs sans flux ni justification
- ⬤ Screening des répondantes elles-mêmes (Wolfsberg CBDDQ, rating pays + réputation)

## 3 · Crypto / actifs numériques — une seule règle, désactivée par défaut
Couverture actuelle : ◐ « Crypto on/off-ramp » (AML-11 retail, on:false) + secteur crypto dans le scoring.
- ⬤ Travel rule VASP (comm. FINMA 02/2019 : identification ordonnateur/bénéficiaire sur transferts DLT)
- ⬤ Exposition on-chain : mixers/tumblers, adresses SDN OFAC, clusters darknet/ransomware
- ⬤ Chain-hopping / peel chains (analytique si intégration Chainalysis/Elliptic — paramètre tenant)
- ⬤ Wallets auto-hébergés sans preuve de contrôle (satoshi test / signature)
- ⬤ Fréquence on/off-ramp incohérente avec le profil déclaré (au-delà du simple seuil CHF)

## 4 · Financement du terrorisme (CFT) — absent en tant que famille distincte
Le screening sanctions existe, mais aucune typologie CFT comportementale :
- ⬤ Micro-transactions répétées vers corridors sensibles (petits montants, haute fréquence)
- ⬤ Dons / ONG et associations à risque (approche GAFI R.8 NPO) — collectes atypiques, crowdfunding
- ⬤ Cartes prépayées : rechargements multiples multi-sources, retraits en zone frontalière
- ⬤ Cohérence voyage (Business Trip existe côté RM) ↔ flux du client vers zones de conflit
- ⬤ Listes terroristes distinctes (ordonnances spécifiques CH) traitées séparément des sanctions économiques

## 5 · Financement de la prolifération (GAFI R.7) — absent
- ⬤ Screening navires/IMO et pavillons sanctionnés (shipping)
- ⬤ Contournement de sanctions sectorielles (plafonds pétrole/or, biens de luxe vers RU/BY)
- ⬤ Chaînes de sociétés écrans sur corridors KP/IR (patterns d'intermédiation)

## 6 · Fraude & money mules — absent (frontière AML/fraude, mais exigé en pratique)
- ⬤ Money mule : compte récent recevant de multiples ordonnateurs inconnus puis vidage rapide (◐ partiellement approchable via funnel + pass-through, non spécifique)
- ⬤ APP fraud / ingénierie sociale : nouveau bénéficiaire + montant atypique + urgence
- ⬤ Account takeover : signaux device/canal (nouveau device, IP, heure) + nouveau bénéficiaire — nécessite données e-banking (paramètre tenant / intégration)
- ⬤ Fraude au président / BEC sur comptes corporate
- ⬤ Elder financial abuse (client âgé + procuration récente + flux sortants atypiques) — ◐ « Abus de procuration » (R204) couvre le mandataire, pas le pattern vulnérabilité

## 7 · Instruments spécifiques banque privée — angle mort notable pour le beachhead GFI/EAM
- ⬤ Crédit lombard : remboursement anticipé par un tiers, nantissement d'actifs d'origine non corroborée, back-to-back loans (dépôt garantissant un prêt à une entité liée)
- ⬤ Assurance-vie (insurance wrappers) : prime unique élevée, rachat précoce, changement de bénéficiaire post-souscription
- ⬤ Coffres-forts : fréquence d'accès corrélée à des dépôts/retraits cash
- ⬤ Métaux précieux physiques : achats/livraisons hors profil (négoce OR — OBA art. 17ss)
- ⬤ Garanties bancaires / SBLC atypiques sans sous-jacent commercial
- ⬤ Vision groupe : agrégation multi-comptes / multi-entités du même UBO (les scénarios actuels raisonnent par compte/client, pas par périmètre UBO consolidé)
- ⬤ Agrégation cross-produits (cash + titres + FX + crédit dans un même pattern)

## 8 · Immobilier, art & valeurs de luxe
Couverture actuelle : ◐ scoring sectoriel « Immobilier » uniquement (statique).
- ⬤ Achat immobilier via structure + prix hors marché
- ⬤ Œuvres d'art / ports francs (achat, dépôt, revente rapide)
- ⬤ NFT et biens de luxe comme véhicules de valeur

## 9 · Analytique comportementale avancée (2e génération)
Couverture actuelle : CPSI = seuils fixes différenciés par groupe (1re génération, robuste et explicable).
- ⬤ Déviation au groupe de pairs (peer-group deviation statistique, pas seuil fixe)
- ⬤ Rupture de comportement (sudden change vs baseline propre du client)
- ⬤ First-time patterns (premier virement international, premier cash, première contrepartie HRJ)
- ⬤ Dormance partielle (segment d'activité dormant réactivé, pas seulement le compte entier) — ◐ réactivation compte dormant existe
- ⬤ Salary/revenue mismatch récurrent en entrée (le R201/WC-01 couvre des cas voisins en sortie)
- Note : cohérent avec « AI-assisted, human-decided » (R44) — ces scénarios restent des détecteurs qui émettent des signaux tracés, jamais des décideurs.

## 10 · Screening — profondeur
Couverture actuelle : OFAC/SECO/PEP/adverse à l'onboarding + sanctions transactionnelles (R192).
- ⬤ Screening PEP et adverse media EN FLUX (sur contreparties de transactions, pas seulement le client) — ◐ R200 approche le PEP par graphe, pas par screening de la contrepartie
- ⬤ Adverse media continu (re-screening périodique automatique, perpetual KYC — le cadre CoC existe, le déclencheur presse n'est pas un scénario)
- ⬤ Screening BIC/banques intermédiaires dans les chaînes de paiement
- ⬤ Navires (IMO), aéronefs, ports (cf. §5)
- ⬤ Translittération multi-scripts (arabe, cyrillique, chinois) — le moteur baseline IDF+trigram est latin-centrique ; à valider/étendre
- ⬤ Screening des adresses (pas seulement des noms) — sanctions par localisation (Crimée, régions occupées)

## 11 · Indices qualitatifs OBA-FINMA (annexe) non systématisés
Le moteur couvre bien les indices quantitatifs ; manquent les indices déclaratifs/qualitatifs comme scénarios formels :
- ⬤ Refus du client de fournir les informations usuelles (workflow de signal RM → CO structuré)
- ⬤ Compte utilisé comme compte de passage pour de nombreuses personnes (transit account) — ◐ pass-through couvre le temporel, pas le multi-titulaires
- ⬤ Opérations sans justification économique constatées par le conseiller (red flag déclaratif RM, tracé)
- ⬤ Domiciliation c/o ou adresse partagée par de nombreux clients sans lien

## 12 · Gouvernance du dispositif (exigences de tuning, pas des typologies)
Couverture actuelle : Intelligence Studio (propositions IA, versioning, simulation, réversibilité) — bon socle.
- ⬤ Below-the-line testing (échantillonnage systématique sous les seuils pour valider leur calibrage)
- ⬤ Backtesting périodique documenté par scénario (taux TP/FP historisé par version — les stats existent, la campagne formelle non)
- ⬤ Data quality checks amont comme pré-condition des scénarios (complétude des champs SWIFT, dates, devises)

---

## Priorisation proposée (beachhead GFI/EAM suisses, LBA/FINMA)

**P1 — exigible en audit court terme** : §10 screening en flux + adverse media continu ; §11 indices qualitatifs OBA-FINMA ; §7 vision groupe UBO ; §12 below-the-line.
**P2 — différenciant banque privée** : §7 lombard/insurance wrappers/coffres ; §3 crypto (la clientèle EAM y est exposée) ; §4 CFT famille distincte.
**P3 — selon segments clients** : §1 TBML et §2 correspondent banking (pertinents si clientèle corporate/négoce ou activité de correspondance) ; §5 prolifération ; §8 art/immobilier ; §9 analytique 2e génération.

Méthode : chaque famille retenue = bloc de règles numéroté au catalogue (step-0) + scénarios Gherkin rouges avant code + paramètres tenant au registre R-Q + signaux append-only (R48). Aucun scénario ne décide : signal → alerte → humain (R44).
