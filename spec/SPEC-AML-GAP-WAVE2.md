# SPEC — AML Gap Wave 2 : blocs 57–61 (R378–R403 provisoires)

Statut : ratifié PO (04.08.2026). Numérotation provisoire — step-0 par Claude Code (avec la wave 1, en un seul passage : R340–R403).
Périmètre (P3 de GAP-ANALYSIS-AML.md) : TBML (bloc 57), Correspondent banking (bloc 58), Prolifération (bloc 59), Immobilier & Art (bloc 60), Analytique 2G (bloc 61). 26 règles, 52 cas GT (26 TP / 26 FP).

**Architecture, API, modèle de données, RBAC, DoD : identiques à SPEC-AML-GAP-WAVE1.md (§0–§5) — un seul dispositif, pas deux.** Points spécifiques wave 2 :

- **Bloc 57 TBML** : nouvelles sources de données requises — référentiel de prix par code HS (R380, paramètre tenant), API de tracking conteneurs/navires (R383/R384, intégration optionnelle par tenant : sans intégration, les règles restent définies mais inactives, jamais silencieusement dégradées — statut visible via R376 DQ).
- **Bloc 58 CBK** : périmètre = tenants avec activité de correspondance (activation par tenant, questionnaire R-Q) ; R390 shell bank est BLOQUANT sans dérogation (interdiction légale).
- **Bloc 59 Prolifération** : R393 BLOQUANT ; réutilise le screening navires R346 (bloc 50) — pas de doublon.
- **Bloc 61 Analytique 2G** : détecteurs statistiques (z-score robuste, changepoint) — exécutés dans le service Python CPSI derrière le contrat shell-out versionné existant (JAMAIS réécrits en Nest — invariant). Chaque signal embarque son explication (attribut, valeur, distribution) : l'IA éclaire, l'humain décide (R44). R401 first-time = friction douce, pas de blocage (R39).
- Dataset GT combiné : `aml-gap-dataset-gt.json` couvre les deux waves (130 cas).

---
# ANNEXE — RÈGLES DÉTAILLÉES (générées depuis gen_aml_gap.py)

## Bloc 57 — TBML (R378–R385)

### R378 (TB-01) — Surfacturation (over-invoicing) — Niveau 2
Factures systématiquement payées au-dessus de la valeur de marché des biens — miroir sortant de R201 : la survaleur transfère du blanchiment sous couvert commercial.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — 8 paiements de factures d'import présentent un écart constant de +22% vs le prix de référence des biens (code HS).
- When — Écart récurrent ≥ seuil entre montant payé et valeur de référence, sur ≥ N factures / 90j.
- Then — Signal OVER_INVOICING (Niveau 2) — analyse trade finance, justificatifs contractuels et incoterms demandés.

**Paramètres tenant (registre R-Q)** : `ecart_prix_seuil` (écart au prix de référence, défaut 15 %) ; `nb_factures_min` (factures concernées / 90j, défaut 3)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00130 — Import de composants payés +22% vs benchmark sur 8 factures du même fournisseur lié — transfert de valeur confirmé.
- [FP] CLI-00101 — Surcoût de +18% documenté par une clause d'urgence logistique (fret aérien vs maritime, contrat fourni) — FP.

### R379 (TB-02) — Facturation multiple — Niveau 2
Le même bien ou la même expédition est facturé et payé plusieurs fois, via un ou plusieurs financeurs.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Deux paiements de CHF 140k référencent le même connaissement (B/L) à 3 semaines d'écart.
- When — Déduplication des références documentaires (B/L, facture, conteneur) sur les paiements trade / 180j.
- Then — Signal MULTIPLE_INVOICING (Niveau 2) — documents originaux exigés, vérification auprès du transporteur.

**Paramètres tenant (registre R-Q)** : `fenetre_dedup` (fenêtre de déduplication, défaut 180 jours)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00130 — Même connaissement financé deux fois via deux banques — double financement frauduleux confirmé.
- [FP] CLI-00193 — Facture d'acompte puis facture de solde portant la même référence commande (schéma 30/70 contractuel) — FP.

### R380 (TB-03) — Prix hors benchmark (unit price) — Niveau 2
Analyse du prix unitaire par code HS contre des référentiels de prix de marché — les écarts extrêmes signent la mis-invoicing.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Des « composants électroniques » sont facturés CHF 2 pièce alors que le référentiel HS donne 40-60.
- When — Prix unitaire vs distribution de référence du code HS ; écart au-delà des percentiles paramétrés.
- Then — Signal UNIT_PRICE_ANOMALY (Niveau 2) — nature réelle des biens à corroborer.

**Paramètres tenant (registre R-Q)** : `percentile_bas` (percentile bas, défaut 5 %) ; `percentile_haut` (percentile haut, défaut 95 %) ; `referentiel_hs` (référentiel de prix HS, défaut tenant)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00130 — Biens sous-facturés à 5% du prix de marché pour exfiltrer de la valeur au pays d'origine — TP.
- [FP] CLI-00037 — Lot déclassé vendu à prix cassé avec certificat de non-conformité joint — décote documentée, FP.

### R381 (TB-04) — Biens à double usage — Niveau 1
Paiements liés à des biens à double usage (annexes du contrôle des exportations) vers des destinations sensibles.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Un paiement finance des machines-outils de précision classées double usage vers un intermédiaire au pays tiers.
- When — Classification des biens (HS + libellés) croisée avec les listes de contrôle des exportations et la destination finale.
- Then — Signal DUAL_USE (Niveau 1) — licence d'exportation SECO à exiger avant exécution, escalade sanctions.

**Paramètres tenant (registre R-Q)** : `listes_controle` (listes de contrôle actives, défaut SECO,EU)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00039 — Machines classées double usage routées via un intermédiaire vers une destination sous embargo — licence absente, TP.
- [FP] CLI-00142 — Bien listé mais licence d'exportation SECO valide fournie et destinataire final vérifié — conforme, FP.

### R382 (TB-05) — LC back-to-back / crédits doc HRJ — Niveau 2
Lettres de crédit adossées (back-to-back) ou crédits documentaires dont la chaîne implique des juridictions à risque sans logique commerciale.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Une LC est adossée à une seconde LC émise pour un intermédiaire offshore qui ne touche jamais la marchandise.
- When — Détection de LC adossées × intermédiaires sans rôle logistique × juridictions de la chaîne.
- Then — Signal BACK_TO_BACK_LC (Niveau 2) — substance de l'intermédiaire à démontrer.

**Paramètres tenant (registre R-Q)** : `hrj_trade` (liste juridictions trade à risque, défaut tenant)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00043 — Intermédiaire des Caïmans intercalé entre acheteur et vendeur réels, marge de 12% sans fonction — écran, TP.
- [FP] CLI-00150 — Maison de négoce établie jouant un rôle réel de contrepartie centrale (contrats et assurances au dossier) — FP.

### R383 (TB-06) — Phantom shipping — Niveau 1
Paiement sans mouvement de marchandise vérifiable : documents absents, navires inexistants, conteneurs fantômes.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Un paiement de CHF 380k référence un conteneur dont le tracking ne montre aucun mouvement.
- When — Vérification d'existence du voyage (API tracking conteneurs/navires) pour les paiements trade ≥ seuil.
- Then — Signal PHANTOM_SHIPMENT (Niveau 1) — fonds gelés en attente de preuve d'expédition, EDD.

**Paramètres tenant (registre R-Q)** : `seuil_verif_tracking` (seuil de vérification, défaut 100000 CHF)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00130 — Trois « expéditions » payées 1.1M au total, aucun conteneur n'a jamais quitté le port déclaré — TP.
- [FP] CLI-00193 — Retard de mise à jour du tracking d'un transporteur secondaire (mouvement confirmé à J+4 par le B/L) — FP.

### R384 (TB-07) — Routes & transbordements atypiques — Niveau 2
Routes maritimes incohérentes avec la géographie commerciale : détours, transbordements multiples, pavillons changés en cours de voyage.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Une cargaison Rotterdam→Genève transite par 3 ports hors route avec 2 transbordements.
- When — Score d'anomalie de route (détour, transbordements, arrêts en zones sensibles) sur les documents de transport.
- Then — Signal ROUTE_ANOMALY (Niveau 2) — justification logistique demandée.

**Paramètres tenant (registre R-Q)** : `transbordements_max` (transbordements tolérés, défaut 1)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00039 — Détour par un port connu pour le maquillage d'origine (certificats réémis) — contournement d'embargo, TP.
- [FP] CLI-00150 — Réacheminement dû à une congestion portuaire majeure documentée par l'armateur (avis publié) — FP.

### R385 (TB-08) — Carrousel documentaire — Niveau 2
Les mêmes contreparties échangent des rôles acheteur/vendeur sur des biens similaires en boucle — chiffre d'affaires artificiel.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — A vend à B, B revend à C, C revend à A des lots similaires à valeur croissante sur 4 mois.
- When — Détection de cycles sur le graphe des contreparties trade × similarité des biens × inflation des montants.
- Then — Signal TRADE_CAROUSEL (Niveau 2) — logique économique de la chaîne à démontrer.

**Paramètres tenant (registre R-Q)** : `duree_cycle_trade` (fenêtre de détection, défaut 180 jours)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00101 — Boucle de revente à valeur +15% par tour entre trois entités liées au même bénéficiaire — carrousel confirmé.
- [FP] CLI-00037 — Négoce légitime de matières premières où les rôles s'inversent selon les cours (positions documentées) — FP.


## Bloc 58 — Correspondent Banking (R386–R392)

### R386 (CB-03) — Wire stripping / transparence — Niveau 1
Champs ordonnateur/bénéficiaire (50/59) incomplets, tronqués ou altérés dans la chaîne — GAFI R.16, Wolfsberg Payment Transparency.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Une série de MT103 d'un correspondant arrive avec le champ 50 réduit à des initiales.
- When — Contrôle de complétude et de cohérence des champs de transparence par message et par correspondant (taux agrégé).
- Then — Signal WIRE_STRIPPING (Niveau 1) — messages retenus, demande de complément au correspondant, taux suivi par répondant.

**Paramètres tenant (registre R-Q)** : `taux_incomplet_max` (taux d'incomplétude toléré par correspondant, défaut 2 %)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00130 — Correspondant supprimant systématiquement le nom d'ordonnateurs iraniens (initiales seules) — stripping confirmé, relation revue.
- [FP] CLI-00018 — Troncature technique de caractères non-latins par un système legacy (données complètes en pièce jointe MT199) — FP, correctif demandé.

### R387 (CB-04) — U-turn payments — Niveau 2
Fonds sortant vers un correspondant tiers et revenant à la même partie via une autre chaîne — contournement de restrictions.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — CHF 500k partent vers une banque du Golfe et reviennent 9 jours après via un correspondant européen, même bénéficiaire final.
- When — Appariement sortie/entrée (montant, parties finales, fenêtre) à travers des chaînes de correspondance distinctes.
- Then — Signal U_TURN (Niveau 2) — finalité du détour à justifier, analyse sanctions.

**Paramètres tenant (registre R-Q)** : `fenetre_uturn` (fenêtre d'appariement, défaut 30 jours)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00070 — Détour par deux correspondants pour masquer une contrepartie russe restreinte — contournement confirmé.
- [FP] CLI-00164 — Paiement rejeté par la banque bénéficiaire (IBAN erroné) et retourné par une autre route — retour technique documenté, FP.

### R388 (CB-05) — Payable-through accounts — Niveau 1
Clients du répondant accédant directement au compte de correspondance (payable-through) — diligence impossible sur l'utilisateur final.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Des ordres au format client final (références retail) transitent par le compte nostro d'un répondant.
- When — Détection de patterns d'usage direct (volumétrie retail, références client final) sur comptes de correspondance.
- Then — Signal PAYABLE_THROUGH (Niveau 1) — clarification contractuelle avec le répondant, restriction possible après décision.

**Paramètres tenant (registre R-Q)** : `indicateurs_pta` (indicateurs d'usage direct, défaut tenant)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00130 — Répondant offrant à ses clients un accès quasi direct au nostro (milliers de micro-ordres) — PTA confirmé, convention résiliée.
- [FP] CLI-00018 — Pic de petits ordres dû à une migration de paie groupée du répondant (préavisée par MT199) — usage propre, FP.

### R389 (CB-06) — Volumétrie répondant vs profil (KYCC) — Niveau 2
Volumes et corridors d'un répondant incohérents avec son profil déclaré (questionnaire Wolfsberg CBDDQ).

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Un répondant déclaré « domestique retail » envoie 40% de ses flux vers des corridors HRJ.
- When — Comparaison flux réels (corridors, volumes, devises) vs profil CBDDQ déclaré, par période.
- Then — Signal RESPONDENT_PROFILE_DRIFT (Niveau 2) — mise à jour du questionnaire exigée, revue de la relation.

**Paramètres tenant (registre R-Q)** : `derive_max` (dérive tolérée vs profil, défaut 20 %)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00130 — Répondant « retail domestique » devenu hub régional de flux vers zones grises sans mise à jour CBDDQ — dérive confirmée.
- [FP] CLI-00150 — Croissance de corridor liée à l'acquisition documentée d'une banque voisine (communiqué + CBDDQ mis à jour) — FP.

### R390 (CB-07) — Shell bank — Niveau 1 · **BLOQUANT** (contrainte type R13, pas SLA)
Détection de banques fictives (sans présence physique ni groupe régulé) dans les chaînes — interdiction LBA.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Un BIC de la chaîne appartient à un établissement sans adresse physique vérifiable ni superviseur identifiable.
- When — Croisement BIC × registres de supervision × indicateurs de présence physique (référentiel tenant).
- Then — TRANSACTION BLOQUÉE (Niveau 1) — interdiction légale, aucune dérogation, dossier sanctions/MROS selon le cas.

**Paramètres tenant (registre R-Q)** : `registres_supervision` (registres de superviseurs consultés, défaut tenant)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00043 — Établissement caribéen sans licence vérifiable ni locaux (adresse = boîte postale d'un agent) — shell bank, blocage.
- [FP] CLI-00164 — Banque digitale licenciée sans agences mais dûment supervisée (registre du régulateur consulté) — présence légale établie, FP.

### R391 (CB-08) — RMA sans flux ni justification — Niveau 1
Autorisations d'échange SWIFT (RMA) actives sans flux ni besoin documenté — surface d'attaque et de contournement inutile.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Un RMA bilatéral est actif depuis 3 ans avec zéro message échangé.
- When — Revue périodique des RMA : flux sur la période × justification métier enregistrée.
- Then — Signal RMA_DORMANT (Niveau 1, ops) — proposition de résiliation, décision tracée.

**Paramètres tenant (registre R-Q)** : `periode_revue_rma` (période de revue, défaut 12 mois)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00130 — RMA dormant réactivé soudainement pour une série de MT202 vers une zone grise — le canal oublié servait de porte dérobée.
- [FP] CLI-00018 — RMA maintenu par exigence contractuelle d'un schéma de garantie multilatéral (convention au dossier) — justifié, FP.

### R392 (CB-09) — Screening des répondantes (CBDDQ) — Niveau 2
Screening périodique des banques répondantes elles-mêmes : sanctions, adverse media, rating pays, actionnariat.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — L'actionnaire majoritaire d'un répondant est placé sous sanctions.
- When — Re-screening périodique du répondant + UBO bancaires + dirigeants ; delta → revue.
- Then — Signal RESPONDENT_HIT (Niveau 2) — comité correspondance, suspension possible après décision humaine.

**Paramètres tenant (registre R-Q)** : `frequence_screen_respondants` (fréquence, défaut 30 jours)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00130 — Nouvel actionnaire de contrôle d'un répondant apparu sur liste de sanctions — relation suspendue après comité.
- [FP] CLI-00150 — Adverse media visant l'homonyme d'une autre banque du même groupe de presse — établissement distinct, FP.


## Bloc 59 — Prolifération (R393–R395)

### R393 (PF-01) — Sanctions sectorielles & plafonds — Niveau 1 · **BLOQUANT** (contrainte type R13, pas SLA)
Contournement des sanctions sectorielles : plafonds de prix (pétrole), embargos or/luxe, services interdits (assurance, shipping) vers RU/BY/IR/KP.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Un paiement pétrole affiche un prix au baril supérieur au plafond, assuré par un assureur non autorisé.
- When — Contrôle sectoriel : produit × origine × prix vs plafond × services associés autorisés.
- Then — TRANSACTION BLOQUÉE (Niveau 1) — violation sectorielle, escalade sanctions, décision humaine tracée.

**Paramètres tenant (registre R-Q)** : `plafonds_sectoriels` (référentiel plafonds/embargos, défaut tenant)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00039 — Cargaison d'origine russe payée au-dessus du price cap via un négociant intermédiaire — violation confirmée, blocage.
- [FP] CLI-00037 — Pétrole d'origine certifiée kazakhe transitant par un port russe (certificat d'origine et pipeline documentés) — hors périmètre du plafond, FP.

### R394 (PF-02) — Chaînes d'écrans corridors KP/IR — Niveau 1
Patterns d'intermédiation typiques du financement de la prolifération : sociétés jeunes, capital minimal, secteurs génériques, en chaîne vers corridors sensibles.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Trois sociétés de trading créées < 12 mois s'intercalent entre un exportateur européen et un acheteur final opaque.
- When — Score de chaîne : âge des entités × substance × secteur générique × corridor final.
- Then — Signal PROLIF_CHAIN (Niveau 1) — identification du destinataire final exigée, escalade.

**Paramètres tenant (registre R-Q)** : `age_entite_min` (âge minimal sans surrisque, défaut 24 mois)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00043 — Chaîne de trois écrans hongkongais récents aboutissant à une entité liée à un programme sous sanctions — TP.
- [FP] CLI-00045 — Jeunes filiales de distribution d'un groupe industriel établi (organigramme et comptes consolidés fournis) — substance démontrée, FP.

### R395 (PF-03) — Biens de luxe vers zones embargo — Niveau 2
Exportation de biens de luxe (montres, joaillerie, véhicules) vers des juridictions sous embargo de luxe, souvent via pays relais.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Des paiements de montres de haute horlogerie partent vers un relais d'Asie centrale, volume ×6 depuis l'embargo.
- When — Volume par corridor relais × catégorie de biens embargo × croissance anormale post-sanctions.
- Then — Signal LUXURY_EMBARGO (Niveau 2) — destinataire final et usage à corroborer.

**Paramètres tenant (registre R-Q)** : `categories_luxe` (catégories surveillées, défaut tenant)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00080 — Négociant horloger multipliant par 6 ses exports vers un relais notoire de réexportation — contournement confirmé.
- [FP] CLI-00063 — Croissance liée à l'ouverture documentée d'une boutique franchisée locale (bail et licence fournis) — marché réel, FP.


## Bloc 60 — Immobilier & Art (R396–R398)

### R396 (IA-01) — Immobilier via structure + prix hors marché — Niveau 2
Acquisition immobilière via structure (SCI, trust, offshore) à un prix significativement hors marché.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Un bien estimé CHF 2.1M est acquis 3.4M via une société des BVI financée depuis le compte.
- When — Écart au prix de référence (m², registre) × acquisition via structure × origine du financement.
- Then — Signal REAL_ESTATE_ANOMALY (Niveau 2) — expertise indépendante et SOW exigées.

**Paramètres tenant (registre R-Q)** : `ecart_marche_max` (écart au marché toléré, défaut 25 %)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00005 — Surpaiement de 60% via structure BVI : la survaleur revenait au vendeur complice — intégration confirmée.
- [FP] CLI-00152 — Prime de 30% pour un bien de prestige off-market avec deux expertises concordantes au dossier — marché de niche, FP.

### R397 (IA-02) — Art & ports francs — Niveau 2
Achat d'œuvres, dépôt en port franc, revente rapide — valeur mobile, opaque et transfrontalière.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Une œuvre achetée CHF 900k est déposée en port franc puis revendue 15 mois après à une partie liée, +40%.
- When — Cycle achat→port franc→revente × délai × lien entre parties × écart de prix.
- Then — Signal ART_FREEPORT (Niveau 2) — provenance de l'œuvre et indépendance de l'acheteur à établir.

**Paramètres tenant (registre R-Q)** : `delai_revente_min` (revente considérée rapide si <, défaut 36 mois)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00034 — Aller-retour d'une œuvre entre deux entités du même bénéficiaire avec +40% — transfert de valeur habillé, TP.
- [FP] CLI-00016 — Collectionneur établi cédant une pièce via une maison de vente publique (adjudication tierce, catalogue) — vente de marché, FP.

### R398 (IA-03) — Véhicules de valeur (luxe, NFT) — Niveau 2
Biens de luxe et actifs numériques de collection utilisés comme véhicules de transfert de valeur.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Trois véhicules de collection achetés et réexpédiés à l'étranger en 4 mois, revendus à des parties inconnues.
- When — Fréquence d'achat/revente de biens de valeur × export × contreparties.
- Then — Signal VALUE_VEHICLE (Niveau 2) — finalité patrimoniale vs circulation de valeur à clarifier.

**Paramètres tenant (registre R-Q)** : `seuil_biens_valeur` (équivalent CHF / 180j, défaut 200000 CHF)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00080 — Rotation de véhicules de collection exportés vers un marchand relais, marges incohérentes — circulation de valeur, TP.
- [FP] CLI-00063 — Passionné documenté (assurances, expertises, participation à des concours d'élégance) constituant sa collection — FP.


## Bloc 61 — Analytique 2G (R399–R403)

### R399 (AN-01) — Déviation au groupe de pairs — Niveau 2
Écart statistique du client à son groupe de pairs CPSI (z-score sur les attributs surveillés), au-delà des seuils fixes de 1re génération.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Un client du groupe « Affluent CH » présente un volume cash à 4.2 écarts-types de la médiane de son groupe.
- When — Z-score robuste (médiane/MAD) par attribut et par groupe, recalculé au fil de l'eau.
- Then — Signal PEER_DEVIATION (Niveau 2) — explicable par construction : attribut, valeur, distribution du groupe joints (R44 : l'IA éclaire).

**Paramètres tenant (registre R-Q)** : `zscore_seuil` (z-score de déclenchement, défaut 3.5 σ)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00072 — Cash à 4.2σ du groupe sans changement déclaré de situation — activité non expliquée, TP.
- [FP] CLI-00104 — Pic à 3.8σ expliqué par la vente documentée d'une entreprise (CoC ouvert en amont) — événement de vie, FP.

### R400 (AN-02) — Rupture de comportement (baseline propre) — Niveau 2
Changement soudain vs la baseline historique du client lui-même (pas du groupe) : régime transactionnel qui bascule.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Un compte stable depuis 4 ans triple sa volumétrie et change de corridors en 3 semaines.
- When — Détection de rupture (changepoint) sur volume, fréquence, corridors, contreparties vs baseline 12 mois.
- Then — Signal BEHAVIOR_SHIFT (Niveau 2) — comparatif avant/après joint au signal.

**Paramètres tenant (registre R-Q)** : `sensibilite_rupture` (sensibilité du détecteur, défaut tenant)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00099 — Bascule complète du profil (nouveaux corridors, volumes ×3) après un changement de mandataire — compte repris en main par un tiers, TP.
- [FP] CLI-00016 — Montée en charge annoncée d'un mandat de gestion élargi (avenant signé) — changement contractualisé, FP.

### R401 (AN-03) — First-time patterns — Niveau 1
Premières occurrences sensibles : premier virement international, premier cash, première contrepartie HRJ, premier produit à risque.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Un client 100% domestique depuis 6 ans émet son premier virement vers une juridiction à risque, montant élevé.
- When — Détection de première occurrence par dimension sensible × matérialité du montant.
- Then — Signal FIRST_TIME (Niveau 1) — friction douce : revue rapide, pas de blocage (R39 : mesurer, pas coercer).

**Paramètres tenant (registre R-Q)** : `dimensions_ft` (dimensions surveillées, défaut international,cash,HRJ,produit_risque) ; `materialite_ft` (matérialité minimale, défaut 25000 CHF)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00069 — Premier international du compte : 180k vers une fiduciaire offshore inconnue, dossier à 2% de complétude — TP.
- [FP] CLI-00121 — Premier virement France→UK pour l'inscription universitaire d'un enfant (attestation jointe) — vie courante, FP.

### R402 (AN-04) — Dormance partielle par segment — Niveau 2
Réactivation d'un segment d'activité dormant (ex. le cash après 3 ans d'inactivité cash) même si le compte global reste actif — complète la règle « compte dormant » existante.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Un compte actif en titres n'a fait aucun cash depuis 3 ans ; 3 dépôts espèces surviennent en 2 semaines.
- When — Dormance mesurée par segment (cash, international, produit) ; réactivation = première activité du segment après N mois.
- Then — Signal SEGMENT_REACTIVATION (Niveau 2) — contexte de réactivation demandé.

**Paramètres tenant (registre R-Q)** : `dormance_segment` (dormance du segment, défaut 24 mois)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00156 — Segment cash réactivé par des dépôts fractionnés après 3 ans — le canal oublié sert au placement, TP.
- [FP] CLI-00053 — Retraits cash réactivés pour des travaux payés en espèces à des artisans (devis et factures fournis) — usage ponctuel expliqué, FP.

### R403 (AN-05) — Revenus entrants incohérents (mismatch) — Niveau 2
Entrées récurrentes libellées « salaire/honoraires » incohérentes avec l'employeur et la rémunération déclarés au KYC — pendant entrant de R201/AML-WC-01.

**Gherkin (scénario nominal, à décliner en tests rouges avant code)**
- Given — Un « salaire » mensuel de CHF 45k est crédité alors que le KYC déclare 12k et un autre employeur.
- When — Croisement libellé/ordonnateur des entrées récurrentes × rémunération et employeur déclarés.
- Then — Signal INCOME_MISMATCH (Niveau 2) — mise à jour KYC ou justification exigée (CoC).

**Paramètres tenant (registre R-Q)** : `ecart_revenu_max` (écart toléré vs déclaré, défaut 50 %)

**Cas GT plantés** : 1 TP · 1 FP
- [TP] CLI-00080 — « Salaires » de 45k versés par une société sans lien avec l'employeur déclaré — canal de distribution occulte, TP.
- [FP] CLI-00035 — Bonus exceptionnel documenté par le certificat de salaire annuel (élément variable déclaré) — rémunération réelle, FP.

