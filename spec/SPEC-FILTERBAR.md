<!-- VERSÉ AU REPO le 2026-08-04 depuis le drop PO (SESSION-2026-08-04). Contenu de la spec repris
     TEL QUEL (visa PO au merge). NUMÉRO DÉFINITIF : R-FB → R404 (step-0 révisé, voir
     spec/mapping-session-repo.md §4). Toute évolution du numéro passe par le mapping, jamais ici. -->

# SPEC — FilterBar uniforme (filtres rétractables + combobox)

Statut : ratifié PO (conversation du 04.08.2026) — numéro de règle **provisoire R-FB**, à mapper au catalogue par Claude Code au step-0 (numérotation continue, table session→repo).
Périmètre : démo `olive-demo.html` (référence UI) puis front Vite/React (portage TSX ultérieur, même contrat).
Référence implémentée et testée : `olive-demo-patched.html` (3 écrans migrés, 3/3 e2e PASS).

---

## 1 · Règle R-FB — Barre de filtres uniforme

**R-FB.1** Toute liste filtrable utilise le composant unique `FilterBar`. Interdit d'introduire de nouvelles rangées de chips ad hoc.

**R-FB.2** Contrat (thin component — le composant relaie, il ne décide pas ; l'état reste dans l'écran hôte) :

```
FilterBar({
  search?:  { value, onChange, placeholder },
  filters:  [{ id, label, value, onChange, options: [[valeur, libellé]], allValue? /* défaut "ALL" */ }],
  shown?:   number,   // résultats après filtre
  total?:   number,   // total avant filtre
  onReset:  fn,       // remet chaque filtre à son allValue
  style?:   object    // passthrough (intégration en rangée flex)
})
```

**R-FB.3** Comportement :
- Panneau **fermé par défaut** ; bouton `▸ Filtres` avec badge `· n` (n = filtres actifs, `value !== allValue`).
- Panneau ouvert : grille de **combobox** (une par dimension), bordure/typo accentuées si filtre actif.
- **Chips actifs** supprimables (×) visibles **même panneau fermé** — un clic remet le filtre à `allValue`.
- Bouton `✕ Réinitialiser` visible ssi ≥ 1 filtre actif.
- Compteur `shown / total résultat(s)`.
- Tout changement de filtre remet la pagination à 0 (responsabilité de l'écran hôte, dans le `onChange`).

**R-FB.4 — Invariant clés (non-régression du bug corrigé)** : dans toute liste rendue, la clé React de chaque item est **unique**. Tout référentiel affiché déduplique défensivement (suffixe déterministe `#n` + `console.warn` pointant la source) — le système notifie, il ne masque pas (esprit R39). La source de données doit être corrigée ; le warn est un écart à consigner.

**R-FB.5** Filtres booléens (ex. « Revues en retard ») : combobox binaire `[["ALL","Indifférent"],["ON","Oui"]]`, jamais un bouton toggle isolé hors FilterBar.

Code de référence du composant : dans `olive-demo-patched.html`, bloc `// ══ FILTERBAR UNIFORME ══` (inséré juste avant `// ══ RÈGLES AML — RÉFÉRENTIEL UNIFIÉ ══`). À reprendre tel quel.

---

## 2 · Scénarios Gherkin (rouges avant code — bloc terminé à 100 % vert)

**FB-01 — Rétraction par défaut**
Given un écran liste avec FilterBar et aucun filtre actif
When l'écran s'affiche
Then le panneau de filtres est fermé, le bouton affiche « ▸ Filtres » sans badge, et la liste est complète.

**FB-02 — Filtrage par combobox**
Given le panneau ouvert sur Règles AML
When je sélectionne « Islamic Finance » dans la combobox Thème bancaire
Then la liste affiche exactement 15 cartes, toutes de thème Islamic Finance, et le compteur affiche « 15 / 118 résultat(s) ».

**FB-03 — Chip actif supprimable**
Given le filtre Thème = Islamic Finance actif et le panneau fermé
When je clique le chip « Thème bancaire : Islamic Finance × »
Then le filtre revient à « Tous » et la liste complète réapparaît.

**FB-04 — Réinitialiser**
Given l'écran KYC avec Workflow=SOW, Statut=REJECTED, RM=<un RM> actifs
When je clique « ✕ Réinitialiser »
Then les trois filtres reviennent à ALL, la pagination revient à 0, le badge disparaît.

**FB-05 — Compteur cohérent**
Given un filtre actif quelconque
Then le nombre de cartes/lignes réellement rendues dans le DOM est **strictement égal** au compteur `shown`.
(Note : c'est ce scénario qui aurait attrapé le bug AML-10/11/12 — l'assertion porte sur le DOM, pas sur le texte.)

**FB-06 — Unicité des clés / réconciliation (non-régression)**
Given le référentiel Règles AML construit
When j'applique successivement Thème=Private Banking puis Thème=Islamic Finance
Then aucune carte d'un autre thème ne subsiste à l'écran, et aucun `console.warn` de code dupliqué n'est émis.

**FB-07 — Filtre booléen**
Given le Registre LBA
When je sélectionne « Revues en retard : Oui » dans la combobox
Then seules les relations `reviewLate` sont listées et un chip « Revues en retard : Oui × » apparaît.

Tests : Playwright (suite B-0x existante), assertions DOM par comptage d'éléments (pattern `borderLeft: 4px` pour les cartes, `tbody tr` pour les tables).

---

## 3 · Plan d'intégration écran par écran

Convention pour chaque écran : **(a)** supprimer les rangées de chips / selects ad hoc, **(b)** insérer un appel `FilterBar` unique, **(c)** chaque `onChange` fait `setX(v); setPage(0);` si pagination.

### 3.1 Déjà migrés (référence dans olive-demo-patched.html)
| Écran | États | Combobox |
|---|---|---|
| `AmlEncyclopediaScreen` (Règles AML + onglet Compliance Center) | `theme`, `q` | Thème bancaire (allValue "Tous") + search intégrée |
| `KycsScreen` (~l. 13313) | `filterWf`, `filterStatus`, `filterRm` | Workflow, Statut, RM (source `rmList`) |
| `ClientsScreen` (~l. 13646) | `filterSeg`, `filterRisk`, `filterType` | Segment, Risque, Structure (source `structTypes`) |

### 3.2 À migrer
| Écran (ligne source) | États existants | Combobox FilterBar | À supprimer |
|---|---|---|---|
| `AmlWorkspaceScreen` (14822) | `fStatus` ("all"), `fType` ("all") | Statut alerte [all/NEW/CLEARED/ESCALATED], Type [all/SANCTIONS/PEP/ADVERSE_MEDIA] — `allValue: "all"` | 2 rangées de chips (~l. 15048-15051) |
| `TasksScreen` (42503) | `stFilter` ("OPEN"), `priFilter` ("ALL"), `view` (all/mine) | Statut [OPEN/ALL/DONE — `allValue:"OPEN"` car défaut métier ≠ ALL], Priorité [ALL/CRITICAL/HIGH/MEDIUM/LOW] | 2 rangées de chips (~l. 42575-42578). `view` all/mine reste un segmented control (c'est un scope, pas un filtre) |
| `TransactionsRiskScreen` (43589) | `riskFilter` | Risque [ALL/HIGH/MEDIUM/LOW] | Segmented chips (~l. 43650) |
| `RegistreLbaScreen` (29252) | `riskF`, `lateOnly` (bool) | Risque [ALL/HIGH/MEDIUM/LOW], Revues en retard [ALL/ON] (R-FB.5 : `lateOnly` devient string ou wrapper `onChange: v => setLateOnly(v==="ON")`, `value: lateOnly?"ON":"ALL"`) | Chips risque + bouton toggle « ⏰ Revues en retard » |
| `AccountReviewScreen` (42173) | `filterStatus` (42198), `filterTrigger` (42199), `search` | Statut, Déclencheur + search intégrée | Chips/selects correspondants |
| `CrmScreen` (30105) | `chF` | Canal [ALL + valeurs existantes — relever les options exactes dans le rendu avant migration] | Chips `chF` |
| `LegalScreen` (31953) | `fSt` | Statut contrat [ALL + valeurs existantes] | Chips `fSt` |

**Règle d'audit préalable (rappel)** : avant chaque migration, lire intégralement le bloc de rendu de l'écran (pas d'invention d'options — reprendre les paires valeur/libellé existantes à l'identique).

### 3.3 Hors périmètre FilterBar (ne pas toucher)
- Onglets de navigation interne (`tab`, `view`, segmented all/mine) : ce sont des scopes, pas des filtres.
- Sélecteurs de formulaire (création KYC, MROS, Business Trip).
- `Compliance48Screen` : le sélecteur AML/ISLAMIC est un switch de famille de simulation, pas un filtre de liste.

---

## 4 · Écarts consignés (docs/ECARTS-FRONT.md)

1. **E-FB-1 (corrigé dans la démo patchée)** — Collision de codes `AML-10/11/12` dans `AML_SCENARIOS` : série CBK/White collar (l. 18105-18107) vs série Retail (l. 18119-18121). Renommés `AML-CB-01`, `AML-CB-02`, `AML-WC-01`. **Action** : vérifier que le seed GWB backend ne porte pas la même collision ; ajouter un test corpus d'unicité des codes de scénario.
2. **E-FB-2 (non corrigé, hors périmètre)** — `AmlCatalogueScreen` : `return;` orphelin dans le `.map()` des KPI → les 3 cartes KPI (Scénarios/Attributs/Domaines) ne se rendent jamais. Fix trivial : supprimer le `return;` et le `;` avant `React.createElement`.
3. **E-FB-3 (constat)** — Les barres « Déclenchements par catégorie » (onglet Dashboard du Compliance Center) sont non cliquables. Décision PO à prendre : soit les rendre cliquables (drill-down → FilterBar pré-remplie), soit les laisser en affichage seul. Non bloquant.

---

## 5 · Definition of Done

- FB-01…FB-07 automatisés (Playwright) et 100 % verts sur chaque écran migré.
- Aucun `console.warn` de doublon en parcours nominal.
- Zéro rangée de chips ad hoc résiduelle sur les écrans du §3.2 (grep `borderRadius: 20` + `map(([v, l])` comme heuristique de détection).
- Capture avant/après par écran dans la PR ; merge GitHub = visa PO.
