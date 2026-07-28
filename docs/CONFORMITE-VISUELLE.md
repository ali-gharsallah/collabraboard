# CONFORMITÉ VISUELLE — grille sur pièce (canon triage final, séquence 6 — 2026-07-28)

Méthode ratifiée : chaque écran DÉJÀ livré est passé contre la maquette `demo/olive-demo.html`
sur CINQ colonnes. **Hiérarchie : canon > maquette > goût.** Chaque écart est UNE ligne ;
**AUCUNE correction sans ligne de grille** (les corrections appliquées sont marquées `corrigé`,
les autres `consigné` — jamais une retouche silencieuse). La maquette reste une RÉFÉRENCE
visuelle : aucune donnée de maquette n'est migrée (interdit du canon, tenu partout).

Les cinq colonnes :
1. **Nav & libellés** — intitulés d'onglets/titres vs le dictionnaire I18N de la maquette
   (4 langues : FR source + EN/DE/IT, 52 clés).
2. **Structure** — blocs, ordre, hiérarchie de l'écran.
3. **Tokens** — palette olive (`theme/tokens.ts` : olive900/700/600, gold #C9A227,
   cream #FAFBF7, ink #1A2410 — le cœur de palette de la maquette) ; statuts sémantiques
   (ok/warn/danger), jamais décoratifs.
4. **États** — projection par rôle (HO-04), licence servie (LC-01/HO-02), bandeau démo,
   refus backend rendus tels quels (FE-04).
5. **Données** — tout est SERVI (API/registre) ; jamais un chiffre calculé au front,
   jamais une donnée de maquette.

## Écarts GLOBAUX (shell)

| # | Colonne | Écart | Verdict |
|---|---------|-------|---------|
| G1 | Nav | La maquette groupe la nav en sections latérales (Clients & Relations, Front & Croissance, Compliance & Risque, Wealth & Marchés, Data & Intelligence, Configuration) ; le shell React est un tab-switcher plat de démonstration. | consigné — le shell définitif (sidebar groupée + portail de login R296) est un chantier d'assemblage, pas un écran ; gelé jusqu'à canon shell |
| G2 | Nav/libellés | Dictionnaire I18N 4 langues (FR/EN/DE/IT) dans la maquette ; le front React est FR uniquement. | consigné — AUCUNE règle R ne ratifie la localisation ; l'i18n est un canon à écrire (les libellés FR = clés du dictionnaire, la bascule viendra sans re-écriture) |
| G3 | Tokens | Cœur de palette IDENTIQUE (#5A7D3A, #C9A227, #FAFBF7, #1A2410) ; la maquette ajoute des accents PAR MODULE (terracotta #8C4A3C compliance, violet #7A5AF8 data/IA) absents des tokens. | consigné — accents par module = évolution de `tokens.ts` (une clé par famille), pas une retouche écran par écran |
| G4 | États | La maquette affiche un sélecteur de rôle/persona global ; le React porte `OLIVE_SESSION` (jeton) et rend les REFUS par écran. | conforme au canon (R89 : le rôle vient du jeton, jamais d'un sélecteur) — la maquette cède |

## Grille PAR ÉCRAN (12 écrans livrés)

| Écran | 1. Nav & libellés | 2. Structure | 3. Tokens | 4. États | 5. Données |
|-------|-------------------|--------------|-----------|----------|------------|
| Home | « Accueil » = clé I18N ✓ | Tuiles par rôle comme la maquette ✓ | tokens.ts ✓ | HO-04 rôle + HO-02 licence + bandeau démo ✓ | servies (compteurs backend) ✓ |
| Command Center | « Command Center » — la maquette dit « Dashboard Exécutif » : le CANON R289 nomme Command Center → canon > maquette, consigné | 9 groupes de tuiles, drill vers écrans ✓ | ✓ (alerte = warn/danger sémantiques) | DIR-only rendu, LC-01, seuils `command_seuils` ✓ | agrégats servis (DC-01..07) ✓ |
| Compliance Center | « Compliance Center » = clé I18N ✓ | MÊME patron Projection (DC-09) ✓ | ✓ | CO/CO_SR/DIR ✓ | ✓ |
| AML Investigation Workspace | onglet React disait « AML Workspace » — la maquette et le canon P1 disent « AML Investigation » → **corrigé** (ligne AW-L1) | 4 onglets internes ✓ | ✓ | rôle CO + bandeau ✓ | AW-01..03 servis ✓ |
| CPSI · Barèmes (cpsiparam) | ✓ (« CPSI · Barèmes », hors dictionnaire maquette — écran canon R250+) | historique + application à date ✓ | ✓ | ADMIN/CO, refus rendus ✓ | journal servi (PA-01..06) ✓ |
| CPSI · Guide | ✓ | règles servies ✓ | ✓ | lecture seule ✓ | GET /v1/cpsi/rules ✓ |
| Bacs à sable (sandboxes) | ✓ | projection backend, AUCUN « Appliquer » ✓ (BS-02/06) | ✓ | indisponible SANS repli ✓ | dry-run servi ✓ |
| Sections & droits (sdkyc) | ✓ | matrice sections×rôles ✓ | ✓ | ADMIN ✓ | SD-01..05 servis ✓ |
| Offboarding | « Offboarding » = clé I18N ✓ | workflow + obstacles + bannières R267 ✓ | ✓ | cloisonnement R270 rendu ✓ | ✓ |
| Olivia (+ Runs) | « Olivia (AI Core) » en maquette, onglets « Olivia » / « Olivia · Runs » — consigné (le suffixe maquette est marketing, le canon B.x ne nomme pas) | badge sourcé, proposer verrouillé sans source ✓ | ✓ | interrupteur v2 servi (SW-18) ✓ | runs/journal servis ✓ |
| IAM (paramnav, iamguide, ssoparam) | « Utilisateurs & rôles » / « Guide IAM » / « SSO / Fédération » — la maquette dit « Administration » (groupe) : libellés React plus précis, consigné | liste + garde dernier ADMIN ✓ | ✓ | IM-01..05 : refus rendus tels quels ✓ | ✓ |
| Audit & transport (+ Audit IT) | hors dictionnaire maquette (écran canon R284) ✓ | journaux + santé transport + rejeu ✓ | ✓ | SO/ADMIN/DIR selon route ✓ | SO-01..08 servis ✓ |
| Transactions Risk Monitoring (txrisk) | « Transactions Risk Monitoring » = clé I18N ✓ | flux + live SSE + tendances + drill AML ✓ | ✓ | refus gracieux sans port (R167) rendu ✓ | journal/tendances servis, agrégats poussés AU moteur — zéro verdict front ✓ |
| Multi-devise & FX (fx) | « Multi-devise & FX » = clé I18N ✓ | table d'exposition par devise ✓ | ✓ (franchissement = danger sémantique) | mention « jamais un taux inventé » rendue (R167) ✓ | exposition servie, seuil notifié SERVEUR — zéro calcul front ✓ |
| Analyseur SWIFT/SEPA (swiftlab) | « Analyseur SWIFT/SEPA » = clé I18N ✓ | textarea → extraction + historique + quarantaine ✓ | ✓ (quarantaine = warn sémantique) | motifs de quarantaine rendus TELS QUELS (FE-04) ✓ | extraction SERVIE, champs sensibles surlignés — zéro parsing front ✓ |
| Custody & TA (custodyta) | hors dictionnaire maquette (écran canon dégel V2) — consigné | positions port + registre rejoué à date + écarts avec voie ✓ | ✓ (négatif = danger) | refus gracieux sans port rendu (R167) ✓ | positions/registre/rapprochement SERVIS — zéro calcul front ✓ |
| Workflow Builder (builder) | « Workflow Builder » = clé I18N ✓ | brouillon → simuler → publier, brouillons/versions ✓ | ✓ (refus = danger) | refus R306 rendus EN LISTE tels quels (FE-04) ✓ | rapport d'impact SERVI, cohérence backend — zéro précalcul front ✓ |
| Veille réglementaire (veille) | « Veille réglementaire » = clé I18N ✓ | sources → items → qualification, proposition IA distincte (violet data/IA maquette) ✓ | ✓ | port éteint AFFICHÉ (R167), NON_TRAITE tant que l'humain n'a pas décidé ✓ | items/propositions SERVIS, citations Rn validées serveur ✓ |
| Legal — Contrats (legalreg) | « Legal — Contrats » = clé I18N ✓ | échéances + ouverture par référence (boucle R293) ✓ | ✓ (retard = danger, préavis = warn) | statuts CALCULÉS rendus, refus R312 tel quel ✓ | échéances/pièces SERVIES, version résolue à date — zéro calcul front ✓ |
| BI — Reporting sur mesure (bi) | « BI — Reporting sur mesure » = clé I18N ✓ | annuaire → dimensions cochées → table ✓ | ✓ | refus R314 rendus tels quels ✓ | annuaire/résultats SERVIS, scope BACKEND (mention rendue) — zéro agrégation front ✓ |
| Octopulse OpRisk (oprisk) | « Octopulse OpRisk » = clé I18N ✓ | déclaration → incidents → heatmap → plan d'action ✓ | ✓ (sévérité ≥ 4 = danger sémantique) | refus R321 (classification) rendu tel quel (FE-04) ✓ | incidents/heatmap/actions SERVIS — la heatmap est RENDUE, jamais peinte ni calculée au front (OP-03) ✓ |
| Mobile Banking (mobileadmin) | « Mobile Banking » = clé I18N (la maquette nomme le module client ; l'écran livré est la FACE BANQUE — l'app cliente est un rendu, consigné) | activation RM → code hors bande → marquage partagé → messagerie/CoC ✓ | ✓ | refus rendus tels quels (FE-04), 404 neutre du canal inactif affiché ✓ | activation/messages SERVIS ; code hors bande affiché UNE fois, jamais re-servi ; mention « rien par défaut » (R318) ✓ |

## Lignes de LIBELLÉS nav (corrections appliquées — chacune EST sa ligne)

| Ligne | Onglet | Avant | Après (clé I18N maquette) | Verdict |
|-------|--------|-------|---------------------------|---------|
| AW-L1 | amlws | AML Workspace | AML Investigation | corrigé (canon P1 + maquette concordent) |
| NV-L2 | dashboard | Dashboard | Dashboard central | corrigé |
| NV-L3 | nba | Next Best Action | Prochaines actions | corrigé (le FR est la clé du dictionnaire) |
| NV-L4 | corroboration | Corroboration | Corroboration KYC | corrigé |
| NV-L5 | crossborder | Cross-border | Cross-Border | corrigé (casse du dictionnaire) |
| NV-L6 | ged | Pièces (GED) | GED — Documents | consigné — « Pièces (GED) » distingue l'écran pièces de l'écran coffre (gedcoffre) que la maquette ne sépare pas ; fusionner serait un choix d'écran, pas de libellé |

## Ce que la grille NE couvre PAS (périmètre)

- Dégel PO 2026-07-28 : les domaines ex-catégorie C ont désormais leur canon
  (spec/canon-degel-complet-vagues-1-9.md) — chaque écran livré par vague ajoute SA ligne
  ici (SWIFT/SEPA, Multi-devise & FX livrés en vague 1 ; Legal, BI, Mobile, Octopulse
  OpRisk suivront leur vague). Un écran encore sans livraison n'a pas de ligne.
- La passe est REJOUABLE : tout nouvel écran livré ajoute SA ligne aux deux tableaux ;
  le template PR (.github/pull_request_template.md) en fait un critère d'acceptation.
