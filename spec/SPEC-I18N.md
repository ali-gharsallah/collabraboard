# SPEC — I18N quadrilingue FR/EN/DE/AR (R323–R324, périmètre révisé)

Statut : ratifié PO (04.08.2026). Révision du périmètre langue : **FR / EN / DE / AR** pour l'UI (l'italien reste une langue de correspondance client — donnée métier, intouchée). Numérotation au step-0.
Exigence PO : « traduit jusqu'au petit détail » — tous les écrans, HTML démo et front React.

## 1 · Ce qui est livré (démo HTML — implémenté et testé)

- **Runtime i18n v2** injecté dans `demo/olive-demo.html` : traducteur DOM par dictionnaire (TreeWalker + MutationObserver), 172 clés exactes + 7 règles regex pour les chaînes dynamiques (compteurs, « ▸ Filtres · n », « X / Y résultat(s) », en-têtes cas GT…), traduction des attributs `placeholder`/`title`, **RTL automatique** (`dir=rtl`, `lang`) en arabe, restauration FR sans perte (`__frSrc`), fallback FR pour toute chaîne non couverte — jamais cassé.
- **Sélecteur d'UI** : FR/EN/DE/**AR** (remplacement d'IT dans le sélecteur d'interface uniquement — les 3 occurrences FR/EN/DE/IT restantes sont des langues de correspondance/documents client : ne pas toucher).
- **Clés en casse SOURCE** : les libellés MAJUSCULES visibles viennent de `text-transform` CSS ; les clés du dictionnaire matchent le DOM (« Seuil », pas « SEUIL »). Piège documenté, attrapé par les tests.
- Tests Playwright 11/11 : EN (nav, écran, FilterBar), DE, AR (RTL + nav + labels + **filtrage fonctionnel sous RTL**), retour FR.

## 2 · Longue traîne (démo) — pipeline pour Claude Code

- `tools/extract_i18n_catalog.py` extrait le catalogue complet : **2 766 chaînes uniques** (couverture cœur actuelle 3.1 % en exact + regex ; le chrome de tous les écrans est couvert, le contenu métier des cartes/textes longs reste FR).
- Boucle : extraire → compléter en/de/ar dans `data/i18n-catalog.json` (passe de traduction Claude Code + relecture humaine pour DE bancaire suisse et AR) → réinjecter dans `I18N_CORE` du runtime (script d'injection à ajouter au générateur) → re-tester.
- Les 64 règles gap : ajouter les champs `nom_en/de/ar`, `desc_*`, `given_*`, `when_*`, `then_*` dans `tools/gen_aml_gap.py` (source de vérité) — jamais traduire les artefacts à la main. Idem cas GT (`txt_*`).
- Chaînes avec segments dynamiques : ajouter une règle regex, pas une clé par valeur.

## 3 · Front React (le vrai i18n — pas de traducteur DOM)

Le runtime DOM est un rétrofit de démo. Le front Vite/React fait de l'i18n propre :
- **react-i18next** + ICU (pluriels, genres), **clés sémantiques** (`aml.rules.title`), jamais le FR comme clé. Namespaces par écran (`kyc.json`, `amlRules.json`, `common.json`) × 4 locales.
- **RTL** : `dir` sur `<html>`, propriétés CSS logiques (`margin-inline-start`…), audit des composants à géométrie codée en dur (graphes SVG, sparklines : axe inchangé, labels traduits).
- **Locales de formatage** : `fr-CH`, `en-GB`, `de-CH`, `ar` — dates, nombres, CHF (`Intl.NumberFormat`), chiffres arabes occidentaux par défaut (paramètre tenant `chiffres_arabes_orientaux` si une banque le veut).
- **Contenu réglementaire** : les définitions de règles/scénarios viennent de l'API (backend `AmlScenario` gagne un champ `i18n Json` versionné avec la règle — une traduction de règle est un changement versionné par date de vigueur, R29). Le front ne traduit pas le contenu métier, il l'affiche.
- **Terminologie** : glossaire bancaire verrouillé par langue (LBA→AMLA/GwG, visa 4-yeux→four-eyes/Vier-Augen/مبدأ العيون الأربع, MROS invariant) — fichier `spec/glossaire-i18n.md` à créer et faire relire par un locuteur pro par langue avant BAT.
- **Tests** : pseudo-locale (détection des chaînes en dur), Playwright par langue (chrome + un parcours métier), snapshot RTL, CI qui échoue si une clé manque dans une locale.

## 4 · DoD
1. Démo : catalogue complété ≥ 95 % des chaînes visibles par écran, 4 langues, e2e verts par langue.
2. React : zéro chaîne en dur (lint i18next), 4 locales complètes, RTL audité écran par écran, formats fr-CH/de-CH/en-GB/ar corrects.
3. Backend : `i18n` versionné sur les scénarios, servi par l'API.
4. Relecture humaine DE (bancaire CH) et AR avant BAT. Merge = visa PO.
