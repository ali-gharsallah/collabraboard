# Prompt à donner à Claude Code

Copiez le bloc ci-dessous dans Claude Code, à la racine du dépôt O-Live, avec ce
dossier de handoff accessible.

---

Tu vas implémenter la refonte complète de l'interface d'O-Live, une plateforme de
cycle de vie client pour la banque privée suisse (onboarding, KYC, screening,
AML, revue périodique, changement de circonstances, audit, paramétrage).

Le dossier `design_handoff_olive_ui_v2/` contient la spécification complète.
**Lis `design_handoff_olive_ui_v2/README.md` en entier avant d'écrire une seule
ligne de code.** Il contient les principes de conception, la table de
correspondance des ~60 écrans, les design tokens, la bibliothèque de composants,
la spécification des 10 écrans maquettés et les patterns pour les autres.

## Contexte de départ

Commence par explorer le dépôt et me dire ce que tu trouves : stack, structure
des dossiers, gestion d'état, couche i18n, système de styles actuel, et comment
les écrans existants sont organisés. Ne suppose rien — l'application actuelle est
une démo React et la structure de production peut différer.

Contrainte non négociable de l'existant : l'application est multilingue
(FR / EN / DE / IT). Chaque libellé passe par la couche i18n. Les chaînes du
handoff sont les valeurs françaises.

## Ce que je veux que tu fasses, dans cet ordre

**Étape 1 — Tokens et shell.** Sors toutes les valeurs de la section « Design
tokens » en variables de thème. Aucune couleur, taille ou espacement en dur dans
un composant. Puis construis la barre de navigation (`Nav`, 248 px, propriété
`active`), les deux variantes de header (liste 60 px, dossier 92 px) et la grille
d'application. Montre-moi le résultat avant de continuer.

**Étape 2 — Composants transverses.** `StatusChip`, `StatTile`, `WorkQueueRow`,
`EventTimeline`. Ils apparaissent sur presque tous les écrans, donc leur API doit
être stable avant le reste.

**Étape 3 — Écran « Ma journée ».** C'est l'écran de démonstration et il valide
le shell. Recrée-le au pixel près d'après
`screenshots/01-ma-journee.png` et
`O-Live UI v2 - Command Center.dc.html`.

**Étape 4 — Palette de commandes ⌘K.** Sans elle, l'architecture à 10 entrées de
menu n'est pas utilisable — c'est le seul chemin d'accès aux écrans rares.

**Étape 5 et suivantes.** Suis l'ordre d'implémentation en 9 points donné à la
fin du README.

## Règles de travail

- Les fichiers `.dc.html` du handoff sont des **références visuelles**, pas du
  code à copier. Ils utilisent des styles inline ; ne reproduis pas ce choix.
  Recrée les écrans avec les patterns et le système de styles du dépôt réel.
- La fidélité attendue est **haute** : couleurs, tailles, espacements et copies
  du README sont définitifs. Les captures sont un repère rapide ; les valeurs
  exactes se lisent dans le README et dans les fichiers source.
- Remplace les icônes Unicode des maquettes (`◉ ☰ ☺ ◔ ◎ ⛨ ↻ ▤ ⚙ ⌕ ✓ ◐ ○`) par un
  jeu d'icônes vectoriel cohérent. Propose-moi le jeu avant de l'intégrer.
- Respecte les 5 principes de la section « Le rethink ». En particulier : un
  bouton d'action n'est jamais grisé sans explication, aucune décision
  réglementaire ne se prend sans motif obligatoire, et l'IA ne propose jamais de
  décision sur une alerte critique.
- Vérifie les contrastes à 4,5:1 minimum. Le README signale deux valeurs de gris
  à ne pas réintroduire.
- Aucun état client ne modifie une donnée métier directement : toute action émet
  un événement au serveur et l'interface se met à jour depuis la projection
  retournée. C'est le principe fondateur du produit.

## Ce sur quoi tu dois m'interroger plutôt que décider seul

Le README liste 4 décisions de suppression ou de fusion d'écrans qui demandent
un avis métier (les 8 bacs à sable, le doublon de capacité d'équipe, la fusion
des trois tableaux de bord, la sortie des modules verticaux de la navigation
principale). Ne les implémente pas avant que je les aie validées — signale-les
quand tu y arrives.

Si un écran non maquetté ne rentre dans aucun des 6 patterns décrits, arrête-toi
et demande, plutôt que d'inventer un gabarit.

Commence par l'exploration du dépôt et un plan d'attaque. Ne code rien avant que
j'aie validé le plan.
