# COMPARAISON FRONT REACT ↔ MAQUETTE `demo/olive-demo.html` (2026-07-29)

Comparaison MESURÉE (pas affirmée) du front React livré contre la maquette de référence.
Hiérarchie du canon : **canon > maquette > goût**. Ce document complète la grille
`CONFORMITE-VISUELLE.md` par des faits extraits automatiquement — rejouables (test FE-CMP
+ `scripts/rapport-i18n.js`), donc opposables.

## 1. Tokens — CONCORDANCE PROUVÉE (test FE-CMP, CI)

| Rôle | Maquette | tokens.ts React | Verdict |
|------|----------|-----------------|---------|
| Vert cœur | `#5A7D3A` | `olive600 #5A7D3A` | ✅ identique |
| Or | `#C9A227` | `gold #C9A227` | ✅ identique |
| Crème (surface) | `#FAFBF7` | `cream #FAFBF7` | ✅ identique |
| Encre | `#1A2410` | `ink #1A2410` | ✅ identique |
| **Accent Compliance & Risque** | `#8C4A3C` (terracotta, 38 usages) + fond `#FBEDEA` | **AJOUTÉ** `accentCompliance` / `accentComplianceBg` | ✅ **écart G3 LEVÉ** |
| **Accent Data & Intelligence** | `#7A5AF8` (violet, 14 usages) + fond `#F0E9FB` | **AJOUTÉ** `accentData` / `accentDataBg` | ✅ **écart G3 LEVÉ** |

Le test FE-CMP charge la maquette et VÉRIFIE que chaque couleur de `tokens.ts` issue de la
maquette y est réellement présente — la concordance ne peut plus dériver en silence.

## 2. Navigation — le décalage MESURÉ (écarts G1/G2, structurels)

- **29 / 72** libellés d'onglets React sont VERBATIM des clés du dictionnaire I18N de la
  maquette (concordance de libellé exacte).
- **43 / 72** sont des écrans **CANON POST-MAQUETTE** : ils n'existent pas comme items de nav
  dans la maquette (Custody & TA, Octopulse OpRisk, SWIFT/SEPA, Veille, Mobile Banking, les
  5 écrans CPSI, Sections & droits, Audit & transport…). La plupart sont pourtant PRÉSENTS
  dans le corps de la maquette (Octopulse : 11 mentions, Custody : 10, SWIFT : 45, Veille :
  12, Mobile : 5) — la maquette les décrit sans leur donner d'onglet dédié.
- **Structure de nav** : la maquette groupe en **7 sections de sidebar** (Clients &
  Relations · Front & Croissance · Compliance & Risque · Wealth & Marchés · Data &
  Intelligence · Configuration · Administration) ; le React est un **tab-switcher plat**
  (écart **G1**, consigné — le shell définitif à sidebar groupée est un chantier
  d'assemblage, pas un écran). L'i18n 4 langues est en **cliquet** (G2) : nav à 72/72 clés,
  contenus d'écrans convertis en continu.

## 3. États & données — conformité de fond (grille CONFORMITE-VISUELLE.md)

Vérifié écran par écran dans la grille (72/72 passés) : le rôle vient du JETON (R89/R328,
jamais un sélecteur — la maquette cède, G4) ; les refus backend sont rendus TELS QUELS
(FE-04) ; aucune donnée n'est calculée au front ; aucune donnée de maquette n'est migrée
(interdit tenu partout).

## 4. Ce que la comparaison NE trouve PAS (et c'est voulu)
- Aucun conflit canon↔maquette NOUVEAU nécessitant l'arbitrage d'Ali : les seuls écarts
  sont les globaux G1 (shell), G2 (i18n en cliquet), G3 (accents — désormais LEVÉ).
- Aucune couleur décorative hors palette dans le code React (les statuts restent
  sémantiques ok/warn/danger).

## Rejouabilité
- `apps/web` : test **FE-CMP** (palette maquette ↔ tokens.ts) + `scripts/rapport-i18n.js`
  (0 clé nav manquante) + `scripts/verifier-i18n-cliquet.js` (cliquet zéro-dur).
- Toute dérive de palette ou toute clé de nav manquante rend la CI rouge.
