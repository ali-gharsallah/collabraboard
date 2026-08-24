# Audit — Name screening & matching dans O-Live

**Type :** état des lieux technique, factuel, en lecture seule.
**Date :** 2026-08-05.
**Portée :** backend (`services/screening/`), API (`apps/api/src/modules/screening/`), front démo (`apps/web/src/parity/`), CPSI Python, moteur workflow Python, tests.
**Méthode :** lecture de code par trois sondes parallèles (moteur / listes+critères / perf+tests), constats sourcés au `fichier:ligne`. « NON TROUVÉ » = absence vérifiée par recherche, pas une omission.
**Non-objectif :** aucun refactoring, aucune modification de fichier. La colonne « cible » de la matrice décrit des capacités, pas une implémentation à faire.

> ⚠️ Toutes les données de screening du dépôt sont **synthétiques**. Aucune liste de sanctions réelle ni donnée sous licence n'est sur disque (`services/screening/README.md:83` : « Aucune personne réelle. Aucune donnée sous licence. »).

---

## 0. Résumé — trois constats structurants

1. **La production ne fait pas de fuzzy.** Le moteur de rapprochement « fin » (Jaro-Winkler + IDF + blocking trigramme) existe dans `services/screening/`, mais **aucun code d'`apps/` ne l'importe** — seuls ses propres benchs l'exécutent. La voie API réellement exposée fait un **match exact binaire (score 100 ou 0)**. Son en-tête le dit : *« le moteur fin … vit dans services/screening ; brancher ici quand exposé »* (`apps/api/src/modules/screening/screening.service.ts:13-14`).
2. **La confiance de la démo est fabriquée.** La file d'alertes de la maquette n'affiche pas un score de nom réel : elle le dérive d'un hachage déterministe (`apps/web/src/parity/screening-support.ts:157` : `nameSim = 78 + (hN % 22)`, DOB/pays/qualité idem). Le vrai matcher de la démo (`screenSim`) ne sert qu'à la boîte de recherche.
3. **Latin-centrique au sens littéral.** La normalisation supprime tout caractère non-latin (`baseline-engine.mjs:13` : `.replace(/[^a-z0-9\s]/g," ")`) : les noms arabes / cyrilliques / chinois n'ont plus rien à trigrammer ni scorer. Aucune translittération. La règle « multi-scripts » SF-06 n'est pas implémentée (`spec/GAP-ANALYSIS-AML.md:89` : « moteur baseline IDF+trigram latin-centrique ; à valider/étendre »).

**Chiffres-clés :** 3 implémentations distinctes sans code partagé · 0 voie fuzzy branchée en prod · 625 entrées sanctions synthétiques (SECO 229 · UE 199 · ONU 100 · OFAC 97) · 127 cas « golden set » mesurés mais **0 assertion CI**.

---

## 1. Architecture actuelle

Trois chemins de code coexistent, **sans code commun**.

### 1.A — Moteur « fin » (prototype hors-ligne) — `services/screening/*.mjs`
Le seul matcher multi-signal réel. Algorithmes : Jaro-Winkler + pondération IDF + index inversé trigramme (blocking) + discriminants DOB/type. Jugé sur `fixtures/golden-set.json` (127 cas), 2000 clients, 625 sanctions.
**Statut : dark.** Grep sur `apps/` ne trouve **aucun import** de `baseline-engine.mjs` / `blocking.mjs` / `services/screening` ; seuls importeurs = `bench.mjs:13` et `bench-blocking.mjs:11-12`. Exercé uniquement par npm scripts `screening:bench|blocking|portefeuille|data` (`package.json:14-17`), jamais comme test CI. **Injoignable via un endpoint.**

### 1.B — Voie API exposée — `apps/api/src/modules/screening/`
`ScreeningModule` **est** câblé dans l'app (`apps/api/src/app.module.ts:34,57`). Endpoints live (`screening.module.ts:12-19`) : `POST run`, `POST hits/:id/qualify`, `GET hits`, `GET runs`.
**Mais** le rapprochement = **égalité d'ensemble de jetons normalisés triés → 100 ou 0** :
```
// screening.service.ts:26-30
function score(...) { … if (keyOf(c) === q) return 100; return 0; }
```
Idem `rules/screening-qualification.ts:20-27` (`scoreSimple`). Aucun algorithme flou sur la voie persistée.

### 1.C — Maquette front — `apps/web/src/parity/screening-support.ts`
Moteur autonome, distinct des deux autres : Levenshtein + inclusion de jetons + heuristique d'initiales, seuil par défaut **60** (`screening-support.ts:94`). Liste inline `SANCTIONS_DB` = 20 entrées (OFAC/SECO seulement).
**La file d'alertes (`screenHits`, `:157-169`) ne calcule pas de vrai score** — elle le fabrique par hachage (voir §5).

### Hors périmètre matching (vérifié)
- **CPSI Python** : aucun rapprochement de noms. Chaque occurrence `hit_screening` est une **catégorie scalaire** de score de risque (`services/cpsi-server-py/olive_cpsi/engine.py:23` : `"hit_screening": 8.0`). Pas de Levenshtein/Jaro/trigram/translittération.
- `apps/api/src/modules/islamic/islamic-screening.engine.ts` : domaine distinct (charia), pas du name-matching.
- `services/workflow-engine-py/tests/test_bloc6_screening.py` : cycle de vie des hits uniquement, pas de matching.

---

## 2. Algorithmes de matching & seuils

### 2.1 Algorithmes
| Algorithme | Où | Rôle |
|---|---|---|
| **Jaro-Winkler** | `baseline-engine.mjs:20-46` | similarité par jeton (moteur fin) |
| **Pondération IDF** | `baseline-engine.mjs:54-71` (`construireIdf`) | poids par jeton (0 = partout → 1 = unique) |
| **Trigramme (index inversé)** | `blocking.mjs:27-46` | **blocking uniquement**, pas de scoring |
| **Levenshtein** | `screening-support.ts:40-61` (`screenLev`, tronqué 32 car.) | démo front seulement |
| **Exact binaire** | `screening.service.ts:26`, `screening-qualification.ts:20` | voie API live |

**Absents (cités comme *futurs* dans `README.md:131-136`) :** cosine TF-IDF, phonétique (Soundex/Metaphone), n-grammes > 3, `pg_trgm`, fournisseur commercial.

Confirmation du « moteur IDF+trigram latin-centrique » (référentiel AML SF-06) : c'est exactement `baseline-engine.mjs` (IDF `:54-71`) + `blocking.mjs` (trigram `:27-68`), latin-centrique par construction (`baseline-engine.mjs:13`).

### 2.2 Seuils — hardcodés ou configurables ?
Le seuil de décision est un **paramètre d'appel runtime** (`seuil`), fourni par l'appelant. **Ni env, ni base, ni paramètre tenant.**
- API : `screening.service.ts:18` `interface RunDto { … seuil: number }`, comparé `:50` `if (sc < dto.seuil) continue;`, persisté `:65`.
- Règle domaine : `screening-qualification.ts:51,57`.
- Moteur fin : `baseline-engine.mjs:126,132` `rapprocher(requete, entries, seuil)` → `return bestScore >= seuil ? … : null`.

**Valeurs en dur (uniquement dans les benchs / défauts, pas dans un moteur de prod) :**
- `bench.mjs:19` `seuils = [60,65,70,75,80,85,90,95]` (balayage).
- `bench-blocking.mjs:24` `const SEUIL = 85`.
- Coupures du blocking en défaut : `blocking.mjs:54` `{ maxTrigrammes = 12, minPartages = 2, plafond = 400 }`.
- Constantes de pénalité de score : `baseline-engine.mjs:108-119` (type −40 ×2, DOB exact +6, même-année +2, ≤2 ans −12, sinon −45).

**Seule configurabilité effective :** la couche AML-gap SF-01 lit un paramètre tenant **versionné** `seuil_match_pep_flux` (défaut 78) — `src/aml/detectors.ts:68` — mais elle consomme un **score injecté** (`faits.matchScore`), elle n'exécute pas le matcher. Idem les autres paramètres R-Q de « Screening en flux » (`data/registre-rq-aml-gap.json`) : cadence de re-screening, etc. — pas les seuils du rapprochement de noms.

---

## 3. Pipeline de normalisation

### Moteur fin — `normaliser` (`baseline-engine.mjs:6-18`)
```
PARTICULES = /\b(al|el|bin|ibn|van|der|de|la|du|von|ben)\b/g   // ⚠ déclarée, JAMAIS appliquée
SUFFIXES   = /\b(sa|ag|ltd|llc|gmbh|inc|plc|sarl|holding|holdings)\b/g
normaliser(s) = NFD → strip diacritiques (̀-ͯ) → toLowerCase
              → [^a-z0-9\s] → " "   (ponctuation ET tout non-latin supprimés)
              → strip SUFFIXES → collapse espaces → trim
jetonsTries   = normaliser(s).split(" ").sort().join(" ")      // tri alpha des jetons
```

| Élément | Présent ? | Note |
|---|---|---|
| Normalisation Unicode NFD | ✅ | |
| Dé-accentuation | ✅ | |
| Casse | ✅ | minuscules |
| Ponctuation / tirets | ✅ | → espace |
| Formes juridiques (SA/AG/GmbH/Ltd…) | ✅ | supprimées |
| Tri des jetons | ✅ | `:18` — gère l'inversion nom↔prénom |
| **Translittération AR/CY/ZH** | ❌ | non-latin **supprimé** par `[^a-z0-9\s]` |
| **Titres / honorifiques (Dr, Sheikh)** | ❌ | non traités |
| **Particules (Al-, bin, van, von)** | ❌ | `PARTICULES` = **code mort** (`:6`, jamais utilisé) |
| **Initiales** | ❌ (backend) | la démo front a une heuristique d'initiales |

### Voie API — normaliseur réduit dupliqué
`screening.service.ts:23-25` et `screening-qualification.ts:21` : `NFD → strip diacritiques → toLowerCase → [^a-z0-9\s] → collapse → trim`, puis tri des jetons via `keyOf`. Non-latin également supprimé.

### Démo front — `screenNorm` (`screening-support.ts:32-39`)
Majuscules, NFD, **collapse des initiales** (`([A-Z])\.\s*` → `$1`), ponctuation, suffixes légaux (`LTD|LIMITED|SA|AG|GMBH|LLC|INC|CORP|…|CO`), espaces. (Toujours latin only.)

---

## 4. Méthode de matching & agrégation du score

### Moteur fin — jeton par jeton, bidirectionnel, moyenne pondérée IDF
- **Similarité par jeton** — `simPonderee` (`baseline-engine.mjs:74-91`) : pour chaque jeton requête, `best = max jaroWinkler(q, c)` sur les jetons candidats, pondéré IDF ; puis passe symétrique candidat→requête ; `:91` `return ((num/den) + (num2/den2)) / 2` (**moyenne des deux moyennes directionnelles**).
- **Agrégation par candidat** — `scorer` (`:95-103`) : `best = max sur (nom + tous les alias)`, `score = best * 100`.
- **Discriminants additifs** — `:108-121` : type personne/entité (−40), DOB (exact +6 / même-année +2 / ±2 ans −12 / incompatible −45), clampé `0..100`.
- **Sélection d'entrée** — `rapprocher` (`:126-133`) : argmax sur toutes les entrées.

### Voie API live — égalité binaire
`keyOf` trie les jetons puis compare la **chaîne entière** ; `score` = 100 ou 0 (`screening.service.ts:25-30`). Pas de score composite.

### Démo front — composite Levenshtein
`screenSim` (`screening-support.ts:62-78`) : `sim = max(lev, contained?0.93:0, tokenSim*0.9)` où `lev = 1 - screenLev/maxlen` ; `contained` = un ensemble de jetons inclus dans l'autre → 0.93 ; règle d'initiales (`:72-75`). **Pas de pondération IDF** (chaque jeton compte pareil — le défaut que le README backend pointe à `README.md:39`).

---

## 5. Gestion des listes ; alias / DOB / nationalité

### 5.1 Sources & format
| Source | Backend (`sanctions-synth.json`) | Front (`SANCTIONS_DB`) |
|---|---|---|
| **SECO** | 229 (`CH-SECO-RU-2022`, `CH-SECO-IR-2010`) | ✅ (`list:"seco"`) |
| **UE** | 199 (`EU-833/2014`, `EU-2016/44`) | ❌ |
| **ONU** | 100 (`UN-1267`) | ❌ |
| **OFAC** | 97 (`US-OFAC-SDN`) | ✅ (`list:"ofac"`) |
| **Total** | **625** | 20 |

**Format : JSON uniquement** (aucun CSV/XML). Métadonnées : `"source":"SYNTH-SANCTIONS"`, `"structure_inspiree_de":"feeds commerciaux (Dow Jones R&C / World-Check / ComplyAdvantage) — structure seulement"`. Schéma par entrée : `uid, type, categorie, nom_complet, prenom, nom_famille, nom_script_original, genre, alias[{nom,type,qualite}], dates_naissance, lieu_naissance, nationalites, adresses, documents, programme, statut, aire_culturelle`. Fixtures voisines : `pep-synth.json` (PEP 380 / RCA 109 / SIP 60), `clients-synth.json` (2000 clients + `verite_terrain`), `golden-set.json` (127 cas labellisés, `"liste":"sanctions-synth.json@2026-07-15"`).

### 5.2 Chargement & indexation
Tableau plat (`JSON.parse` + spread). Au chargement (`bench-portefeuille.mjs:13-21`), `dates_naissance[0]` est **aplati** en `date_naissance`, et les alias typés sont **réduits à des chaînes de nom** (`a → a.nom`) → **type AKA/FKA et qualité strong/weak perdus**.
Deux index : **map IDF** (token→df, scoring — `baseline-engine.mjs:55-66`) et **index inversé trigramme** (blocking — `blocking.mjs:34-46`, `trigramme → [positions]`). Représentation primaire de scoring = tableau plat.

### 5.3 Blocking / pré-filtrage
Un pré-filtre trigramme **existe** (`blocking.mjs`) : il ne requête que les trigrammes les **plus rares** (`:54-67`, `sorted a.df - b.df`, `minPartages≥2`, `plafond=400`). **Mais il ne tourne que dans `bench-blocking.mjs`.**
Toutes les voies réelles font un **scan complet O(clients × liste)** :
- `bench-portefeuille.mjs:33-38` — boucle sur chaque client × `listes` entier ; sa propre sortie note « approche naïve, sans indexation … ≈2 M d'entrées : … h — impraticable ».
- `rapprocher` (`baseline-engine.mjs:126`) — scan complet.
- Démo `screening-support.ts:85` — `SANCTIONS_DB.forEach` (20 entrées).
- Règles API `screening-qualification.ts:54-56` — double boucle explicite `for clients { for entries }`.

Le README qualifie le pré-filtre de **« prometteur, pas validé »** (`README.md:65-72`) : zéro perte de rappel à 1174 entrées reflète la taille de liste, pas la qualité du filtre.

### 5.4 Alias / AKA
Rapprochés par le même algorithme que le nom principal, dans les 3 moteurs (max sur nom+alias) : `baseline-engine.mjs:97-102`, `screening-support.ts:87-93` (garde `via` = alias qui a matché). **Type AKA/FKA et qualité strong/weak = jetés au chargement**, jamais pondérés.

### 5.5 DOB & nationalité
- **DOB** : discriminant de score **uniquement dans le moteur fin** (`baseline-engine.mjs:108-121`). La voie API l'ignore pour le scoring (seulement dans le hash de whitelist, `screening-qualification.ts:43`).
- **Nationalité** : le champ `nationalites` existe dans les données mais **n'est lu par aucun scorer** (backend ni front). Jamais un critère de rapprochement.
- **Démo front** : la confiance affichée est **fabriquée par hachage** — `screenHits` (`:157-169`) : `nameSim = 78 + hN%22`, `dobState/ctryState/kindState` dérivés de `amlHash(...)`, pondérés **nom 40 · dob 25 · pays 20 · qualité 15**. Le vrai `screenSim` ne sert qu'à la recherche.

---

## 6. Performance & volumétrie

| Métrique | Valeur | Source |
|---|---|---|
| Complexité (naïve) | O(clients × liste × alias × jetons² × longueur²) | nid `rapprocher→scorer→simPonderee→jaroWinkler` |
| Temps / client (force brute) | **~15 ms** (~14 ms vs 1 174 entrées) | `README.md:48,57`, `blocking.mjs:5` |
| Temps / client (pré-filtre) | ~0.59 ms — **« non extrapolable »** | `bench-blocking.mjs:70`, `README.md:67` |
| Extrapolation 50 000 clients × ~2 M | **« ≈ 362 heures — impraticable »** | `bench-portefeuille.mjs`, `README.md:47-60` |
| Table mesurée (blocking) | 31894 ms → 1252 ms (×25.5) ; 2 348 000 → 69 164 entrées comparées ; **0 vrai positif perdu** | `README.md:57-60` |
| Volumétrie testée | 200–2000 clients × 625–1174 entrées — **print-only, 0 assertion** | benchs |
| **Garde perf** | **AUCUNE pour le screening** | grep `assert/expect/throw/exit` sur les benchs = 0 |
| Contraste CPSI | jauge R250 **assertée** (103.7 ms / 10 001 evts, seuil 2000 ms) | `services/cpsi-server-py/tests/test_cpsi_bloc19.py:4-5,86` |
| Batch vs temps réel | batch documenté (positions 1 j, PEP 7 j) ; **aucun temps interactif assertté** | `test_bloc6_screening.py:31-42`, `bloc50.screening-flux.spec.ts:24-31` |

---

## 7. Couverture de tests du matching

**Cadre :** le golden set (127 cas) est le seul actif qui fait varier les orthographes, mais il est jugé par `bench.mjs` (`:29-41`) qui **imprime** rappel/précision et **n'assertte rien**. **Aucun test CI ne fait échouer une régression du matcher.**

### 7.1 Répartition du golden set (`fixtures/golden-set.json`)
| Catégorie | Cas | Doit matcher ? | Exemple |
|---|---|---|---|
| `exact` | 15 | oui | « Muhammad Haddad » |
| `alias_connu` (AKA) | 12 | oui | « Mohammed Haddad » |
| `translitteration_hors_liste` (variante latine) | 20 | oui | « Mohamad Haddad » |
| `ordre_nom` (inversé) | 12 | oui | « Yang Wei » |
| `typo` | 12 | oui | « Aleksand Sokolov » |
| `diacritiques` | 8 | oui | « Katarzyna Muller » |
| `homonyme` (DOB) | 18 | **non** | « Muhammad Haddad » dob 2002 vs 1980 |
| `proche_non_liste` (FP) | 8 | **non** | « Yan Wu » |
| `entite_forme` | 12 | oui | « Volkov Trading SA » |
| `client_ordinaire` | 10 | **non** | « Jean Dupont » |

### 7.2 Checklist de couverture
| Catégorie | Entrées variées ? | Assertée (CI) ? | Où |
|---|---|---|---|
| Typos / fautes | Oui (12) | **Non** — bench | `golden-set typo` ; faiblesse connue « 4 typos ratés/10 à 85 » (`README.md:134`) |
| Translittération (variante latine) | Oui (20) | **Non** | `translitteration_hors_liste` |
| Translittération AR/CY/ZH (script) | **Non** (narratif/flag) | **Non** | SF-06 flag `detectors.ts:73` ; `GAP:89` |
| Ordre inversé (nom↔prénom) | Oui (12) | **Non** | `ordre_nom` ; `baseline:17-18` |
| Initiales | Partiel | **Non** | `screening-scenarios.spec.ts:16` |
| Titres / honorifiques | **Absent** | **Non** | seules les *particules* visées (code mort) |
| Alias / AKA | Oui (12) | **Non** | `alias_connu` |
| FP toponyme (« Crimée » vs région) | Narratif | **Non** (`raised===true` seulement) | `aml-gap.gt.gen.ts:222-224` ; `bloc50…:69-75` |
| Désambiguïsation homonyme (DOB) | Oui (18) | **Non** (logique existe) | `homonyme` ; `baseline:112-120` |
| Désambiguïsation nationalité | **Absent** du matcher | **Non** | nationalité jamais entrée du scorer |

### 7.3 Ce que les specs API/AML testent réellement
- **API** (`screening-scenarios.spec.ts`, `screening.wiring.spec.ts`) : données exactes (« Viktor Volkov »), matcher exact (score 100). La seule assertion « match-adjacente » = ajouter un alias change le hash de l'entrée et fait réapparaître le hit (`screening-scenarios.spec.ts:64-65`) → teste l'**invalidation de whitelist R102**, pas le matching.
- **AML-gap bloc50** : le match est **injecté** — `detectors.ts:66-74` (SF-01 `matchScore=78`, SF-05 `geoMatch`, SF-06 `scriptHit`) ; `aml-gap.wiring.spec.ts:102,114` passent `faits:{ville:"Sébastopol"}` / `{score:91}`. **Aucun moteur ne tourne.** Le FP « Crimée » n'existe que comme fixture GT narrative, et `bloc50…:69-75` assertte `raised===true` (alerte à trier), pas le **rejet** du toponyme.

### 7.4 Déterminisme / config dans les tests
- **Hardcodé (specs API)** : `CFG = { seuil:85, prefiltre:{minPartages:2, maxTrigrammes:12, plafond:400} }` **pinné** par assertion (`screening-scenarios.spec.ts:19,76-77`, `screening.wiring.spec.ts:53,135-136`).
- **Paramétré (benchs, non assertés)** : balayages de seuils (`bench.mjs:19`, `bench-portefeuille.mjs:31`).
- **AML-gap** : paramètres versionnés & datés (`detectors.ts:68` `seuil_match_pep_flux`=78 ; `aml-gap.wiring.spec.ts:137-146` versions effectives).
- **Graine fixe** : `golden-set graine:20260715` → fixtures reproductibles.

---

## 8. Limites identifiées

| # | Sévérité | Limite | Détail |
|---|---|---|---|
| **L1** | 🔴 critique | La prod ne fait pas de fuzzy | API = match exact binaire ; le moteur multi-signal reste dark. Un screening réel manquerait toute faute/variante/alias non exact. |
| **L2** | 🔴 critique | Confiance de démo fabriquée | La file d'alertes dérive nom/DOB/pays/qualité d'un hachage — trompeur si pris pour un comportement moteur. |
| **L3** | 🟠 élevée | Latin-centrique | `[^a-z0-9\s]` supprime les scripts non-latins ; aucune translittération ; SF-06 non implémentée. Noms AR/CY/ZH non-screenables. |
| **L4** | 🟠 élevée | Pas de blocking en voie réelle | Scan complet O(clients×liste) partout ; pré-filtre trigramme ni branché ni validé ; extrapolation « impraticable ». |
| **L5** | 🟠 élevée | Aucune non-régression du matcher | Golden set print-only ; une régression de `baseline-engine.mjs` ne casse pas la CI. Aucune jauge perf. |
| **L6** | 🟡 moyenne | Seuils non configurables | Pas de source env/DB/tenant ; pénalités & coupures en dur ; seuil « réglé à l'aveugle » par l'appelant. |
| **L7** | 🟡 moyenne | Signaux secondaires perdus | Qualité/type d'alias jetés au chargement ; nationalité jamais scorée ; particules non retirées (code mort). |
| **L8** | 🟡 moyenne | Trois matchers divergents | JW+IDF / Levenshtein / exact, sans code partagé — le comportement dépend de la surface. |

---

## 9. Matrice des écarts — vs moteur configurable multi-méthodes

Comparaison factuelle de l'état actuel aux capacités d'un moteur de screening configurable multi-méthodes. **Aucune préconisation d'implémentation** ; « cible » = capacité de référence.

| Dimension | État actuel O-Live | Cible multi-méthodes configurable | Écart |
|---|---|---|---|
| Méthodes de matching | 1 réelle par surface (JW+IDF / Levenshtein / exact), non combinées | Plusieurs algos sélectionnables/combinables (exact, edit-distance, JW, phonétique, n-grammes, embeddings) | élevé |
| Configurabilité des seuils | Paramètre d'appel ; pénalités & coupures en dur ; pas d'env/DB/tenant | Seuils & poids par liste/juridiction/tenant, versionnés, gouvernés | élevé |
| Normalisation / translittération | Latin only ; non-latin supprimé ; titres/particules non gérés | Multi-script (translittération AR/CY/ZH), titres, initiales, particules | **majeur** |
| Blocking / scalabilité | Scan complet en voie réelle ; pré-filtre non branché/validé | Indexation (trigramme / `pg_trgm`) branchée & mesurée, sous-linéaire | élevé |
| Critères secondaires | DOB (moteur dark seulement) ; nationalité jamais utilisée | DOB + nationalité + genre + type, pondérés & explicables | élevé |
| Alias & qualité | Alias matchés ; type/qualité (AKA/strong) jetés | Qualité d'alias & type conservés et pondérés | moyen |
| Câblage production | Moteur fin dark ; API = exact binaire | Moteur unique branché sur l'API & les flux | **majeur** |
| Tests & non-régression | Golden set print-only ; 0 assertion CI | Golden set en gate CI (rappel/précision seuillés) | élevé |
| Garde de performance | Aucune jauge screening | Jauge de latence assertée (comme R250 CPSI) | moyen |
| Listes / sources | Fixtures JSON synthétiques ; SECO/OFAC/UN/EU en structure ; pas de MAJ | Ingestion de feeds réels versionnés, multi-format, rafraîchis | moyen |
| Explicabilité (R44) | Score composite décomposable (moteur dark) ; démo hachée | Score + contributions par signal, traçable & rejouable à date | moyen |

---

## Annexe — fichiers audités

`services/screening/{baseline-engine,blocking,bench,bench-portefeuille,bench-blocking,generate}.mjs` · `services/screening/fixtures/{sanctions-synth,pep-synth,clients-synth,golden-set}.json` · `services/screening/README.md` · `apps/api/src/modules/screening/{screening.service,screening.controller,screening.module}.ts` · `apps/api/src/modules/screening/rules/screening-qualification.ts` · `apps/api/src/modules/screening/*.spec.ts` · `apps/web/src/parity/{screening-support,aml-workspace-support,apidoc-support}.ts` · `src/aml/detectors.ts` · `apps/api/src/modules/aml/{aml-gap.gt.gen,aml-gap.wiring.spec}.ts` · `backend-tests/aml-gap/bloc50.screening-flux.spec.ts` · `services/cpsi-server-py/olive_cpsi/engine.py` · `services/cpsi-server-py/tests/{test_cpsi_bloc3,test_cpsi_bloc19}.py` · `services/workflow-engine-py/tests/test_bloc6_screening.py` · `spec/GAP-ANALYSIS-AML.md`.
