# Tests de la démo

Deux suites : le **corpus des scénarios ratifiés** (B-01→B-07) et un **smoke test de non-régression**.

```bash
npm run test:demo     # corpus B-01..B-07
node tests/demo/smoke-screens.spec.mjs   # smoke : les 73 écrans
```

---

## Smoke test — `smoke-screens.spec.mjs`

Visite **les 73 écrans** atteignables par la navigation et vérifie, pour chacun : aucune erreur JS,
et un rendu non vide (un écran blanc est un crash silencieux).

**Pourquoi il existe.** Deux écrans ont planté en démo à cause d'une constante déclarée *dans* un composant
et consommée ailleurs (`SECTIONS_STATIC`, `ONB_COUNTRIES`). L'application rendait du blanc, sans bruit.
Trois secondes de smoke test suffisent à l'attraper.

**Il a été prouvé capable d'échouer.** En injectant délibérément ce bug exact dans un écran :

```
Écrans sains : 72/73
  ✗ 📄Central File — matrice documentaire — SECTIONS_STATIC is not defined
```

**Isolation.** Un écran qui plante démonte tout l'arbre React (pas d'error boundary). Sans isolation, un seul
vrai coupable produit 70 « item introuvable » en cascade. Le test se **relève** (relogin) après chaque casse :
un défaut = une ligne, nommée.

---

## Corpus exécutable — scénarios de paramétrage (B-01 → B-07)

Rejoue contre la démo réelle les scénarios Gherkin des amendements **R93 → R99**
(`spec/catalogue-amendements-R89-R99-proposes.md`).

```bash
npm run test:demo
# ou, sur une autre démo :
DEMO_URL=file:///chemin/olive-demo.html node tests/demo/sandbox-scenarios.spec.mjs
```

| Scénario | Règle | Ce qu'il prouve |
|---|---|---|
| **B-01** | R93 | Aucune valeur de référentiel n'est neutre par oubli : plus aucune activité sans score, chacune porte un score explicite et éditable. |
| **B-02** | R94 | Dry-run annoncé · abaisser un seuil produit des alertes **nommées** (client · valeur vs seuil) · aucune écriture avant décision. |
| **B-03** | R95 | Le stress test rend un diagnostic de robustesse (progressive / point de rupture) et une tension. |
| **B-04** | R96 | Proposer n'écrit rien · la recommandation porte son impact · **un refus sans motif est bloqué (R7)**. |
| **B-05** | R97 | Le cumul calcule une tension combinée **et n'empêche aucune acceptation** (R39). |
| **B-06** | R98 | Le conflit porteur / contrôleur est signalé avec rappel du four-eyes. |
| **B-07** | R99 | Un suppléant identique au validateur est signalé comme relais fictif, avec citation de R4. |

## Pièges encodés dans `helpers.mjs`

Chacun a coûté un test rouge trompeur — ils sont documentés pour ne pas être repayés :

1. **Le chevron `▾` est statique.** Il fait partie du libellé du groupe de nav et n'indique **pas** l'état.
   → `goto()` détecte l'ouverture par la **présence de l'item**, pas par le chevron ; il ne referme donc
   jamais un groupe déjà ouvert (un second clic le repliait, et tous les tests suivants échouaient).
2. **`text-transform: uppercase` change `innerText`.** Toute recherche de texte doit être insensible à la casse.
3. **Les libellés existent en double.** « Compliance & Risque » est à la fois un groupe de la sidebar et un
   onglet du KYC : cibler par texte exact, sinon on quitte l'écran testé sans s'en apercevoir.
4. **React ne valide pas l'état si saisie et clic sont dans la même tâche.** `fill()` puis attente, puis clic —
   sinon le handler lit l'ancien état et ne fait rien.
