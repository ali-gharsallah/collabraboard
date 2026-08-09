# Handoff : O-Live UI v2 — refonte complète de l'interface

## Overview

O-Live est une plateforme de cycle de vie client pour la banque privée suisse
(onboarding, KYC, screening, AML, revue périodique, changement de circonstances,
offboarding, audit, paramétrage). Le produit existe en démo React fonctionnelle :
~60 écrans, un moteur de workflow événementiel, un modèle canonique
d'intégration core banking, une couche IA gouvernée (« Olivia »), un modèle de
licence on-premise par module.

Le problème n'est pas fonctionnel, il est structurel : la richesse du produit est
présentée à plat. 60+ entrées de menu au même niveau, chaque écran avec sa propre
densité et ses propres conventions, la conformité vécue comme une série de
formulaires à remplir plutôt que comme un parcours.

**Ce handoff propose une refonte complète de l'interface** : une architecture
d'information à 3 blocs au lieu d'un menu plat, un système de composants unique,
et un principe de conception appliqué à tous les écrans — *l'écran répond à une
question, pas à dix*.

Dix écrans sont maquettés en haute fidélité. Les ~50 autres sont couverts par une
table de correspondance et par les patterns réutilisables décrits ici, qui
suffisent à les produire sans nouvelle décision de design.

---

## About the design files

Les fichiers HTML de ce dossier sont des **références de design**, pas du code de
production. Ce sont des maquettes statiques qui montrent l'apparence et le
comportement attendus.

La tâche n'est pas de copier ce HTML. Elle est de **recréer ces écrans dans la
base de code existante d'O-Live** (React 19, composants fonctionnels, styles
inline dans la démo actuelle) en utilisant ses patterns établis — ou, si la
refonte s'accompagne d'une remise à plat technique, de choisir la stack
appropriée et d'y implémenter le système décrit ci-dessous.

Les maquettes utilisent des styles inline uniquement. **Ne reproduisez pas ce
choix** : la section « Design tokens » ci-dessous donne les valeurs à sortir en
variables CSS / thème avant toute implémentation.

Contrainte forte de l'existant à préserver : l'application est **multilingue
(FR / EN / DE / IT)**. Tous les libellés doivent passer par la couche i18n
existante. Les copies exactes données ici sont les chaînes françaises.

## Fidelity

**Haute fidélité (hifi).** Couleurs, typographie, espacements, tailles et copies
sont définitifs. Les écrans sont dessinés à 1440 × 900 px, densité desktop
(l'application est un poste de travail, pas un site). Recréez-les au pixel près
avec les composants de la base de code.

Deux exceptions explicitement basse fidélité :
- Les ~50 écrans non maquettés : la table de correspondance donne l'intention et
  le pattern à appliquer, pas un dessin.
- Le globe de flux de transactions (`globe-flux.html`) est un prototype
  fonctionnel autonome, à intégrer tel quel ou à porter en composant React.

---

## Le rethink — 5 principes

Ces principes sont la partie non négociable du handoff. Chaque écran, y compris
ceux non maquettés, doit pouvoir être justifié par eux.

### 1. Un écran répond à une question

Aujourd'hui, l'écran d'accueil affiche tout ce que le système sait. En v2 il
répond à « qu'est-ce que je dois faire maintenant » : une file de travail triée
par échéance et par risque. Les indicateurs de contexte sont réduits à quatre et
tous cliquables jusqu'aux dossiers qui les composent.

Corollaire : **l'action attendue est écrite en toutes lettres**, jamais encodée
dans un statut à décoder. « Qualifier un hit sanctions », pas « SCREENING_HIT ».

### 2. La navigation suit le parcours client, pas l'organigramme

60+ entrées à plat deviennent 10 entrées visibles réparties en 3 blocs :

- **Mon espace** — Ma journée · Mes dossiers · Mes clients
- **Parcours client** — Entrée en relation · Connaissance client · Surveillance ·
  Revue & sortie
- **Pilotage** — Rapports · Paramétrage

Tout le reste est atteignable par la **palette de commandes ⌘K** (recherche
unifiée client / dossier / personne / écran) et par navigation contextuelle
depuis un dossier. Un écran rarement utilisé n'a pas besoin d'une entrée de menu
permanente ; il a besoin d'être trouvable en deux frappes.

### 3. L'événement est visible avant d'être émis

Le moteur est événementiel : rien ne change d'état par effet de bord. L'interface
doit rendre cela perceptible. Avant toute action à effet large, l'écran montre ce
que l'événement produira — quels dossiers touchés, quelles tâches créées, ce qui
reste sans effet (voir écran 07, Changement de circonstances).

Corollaire : **un bouton d'action n'est jamais grisé sans explication**. Il reste
actif et, au clic, énonce ce qui manque.

### 4. L'IA propose, l'humain déploie — et ça se voit

Les suggestions d'Olivia vivent en colonne latérale, jamais dans le flux
principal, toujours dans un conteneur violet distinct, toujours accompagnées de
la mention que la décision reste humaine et sera tracée. Sur une alerte critique,
l'IA fournit du contexte mais **ne propose aucune décision**.

### 5. La couleur porte du sens réglementaire, jamais de la décoration

Neutres gris ardoise pour la structure. Olive réservé aux actions et à
l'identité. Rouge / ambre / vert **uniquement** pour risque, échéance et statut de
contrôle. Aucun dégradé décoratif hors logo. C'est ce qui sépare un « outil
interne » d'un produit vendable.

---

## Information architecture — correspondance complète

Tous les écrans de la démo actuelle. Colonne « v2 » = où le contenu atterrit.
Colonne « Pattern » = quel gabarit décrit plus bas s'applique.

### Bloc « Mon espace »

| Écran actuel | v2 | Pattern |
|---|---|---|
| Accueil | fusionné dans **Ma journée** | Work Queue |
| Command Center | fusionné dans **Ma journée** | Work Queue |
| Dashboard central | fusionné dans **Ma journée** (bandeau KPI) | Stat Tiles |
| Tâches | onglet de **Ma journée** | Work Queue |
| Prochaines actions | colonne latérale de **Ma journée** (suggestions) | AI Panel |
| Capacité de l'équipe (live) | encart bas de colonne latérale + écran 08 | Bar Meter |
| Capacité équipe | fusionné avec le précédent (doublon actuel) | — |
| Clients | **Mes clients** | Entity List |
| Personnes | **Mes clients**, onglet Personnes | Entity List |

### Bloc « Parcours client »

| Écran actuel | v2 | Pattern |
|---|---|---|
| Prospect à contacter | **Entrée en relation**, colonne 1 du pipeline | Pipeline |
| Prospect en contact | **Entrée en relation**, colonne 2 | Pipeline |
| Prospect à onboarder | **Entrée en relation**, colonne 3 | Pipeline |
| Pré-prospection | **Entrée en relation**, onglet Sourcing | Entity List |
| Onboarding | **Entrée en relation** → dossier (écran 04) | Stepper + Record |
| KYC | **Connaissance client** → dossier (écran 02) | Record |
| Corroboration KYC | onglet du dossier KYC | Record |
| Change of Circumstances | **Connaissance client** → écran 07 | Impact Preview |
| Screening | **Surveillance** → écran 05 | Comparison + Decision |
| Compliance Center | **Surveillance**, vue d'ensemble | Stat Tiles + Work Queue |
| AML Investigation | **Surveillance** → écran 03 | Evidence + Decision |
| Règles AML | **Paramétrage** → écran 10 | Sandbox |
| Investigation financière | onglet de l'écran 03 | Evidence |
| Transactions Risk Monitoring | **Surveillance**, onglet Transactions | Entity List + Globe |
| Transferts & ordres | **Surveillance**, onglet Transactions | Entity List |
| Exécution & Settlement | **Surveillance**, onglet Transactions | Entity List |
| Analyseur SWIFT/SEPA | outil contextuel depuis une transaction | Detail Drawer |
| Registre LBA | **Rapports**, onglet Registre | Entity List |
| Account Review | **Revue & sortie** → écran 06 | Diff Review |
| Offboarding | **Revue & sortie**, onglet Sorties | Stepper + Record |
| Cross-Border | onglet du dossier KYC | Record |
| Business Trip | **Entrée en relation**, onglet Déplacements | Entity List |
| CRM Banque | fusionné dans la fiche client | Record |
| Relation — timeline & entretiens | onglet Chronologie de la fiche client | Timeline |
| Contact Reports | onglet Chronologie de la fiche client | Timeline |
| Profilage CPSI | encart « profil » de la fiche client | Stat Tiles |

### Bloc « Pilotage »

| Écran actuel | v2 | Pattern |
|---|---|---|
| Dashboard Exécutif | **Rapports** → écran 08 | Stat Tiles + Bar Meter |
| Reporting réglementaire | **Rapports**, onglet Réglementaire | Entity List |
| Rapports conformité | **Rapports**, onglet Conformité | Entity List |
| BI — Reporting sur mesure | **Rapports**, onglet Sur mesure | Entity List |
| Veille réglementaire | **Rapports**, onglet Veille | Timeline |
| Formations & habilitations | **Rapports**, onglet Habilitations | Entity List |
| Audit FINMA — rejeu & preuves | **Rapports** → écran 09 (rôle Audit) | Time Travel |
| Audit IT — intégrité | écran 09, onglet Intégrité | Time Travel |
| Surveillance ES | écran 09, onglet Supervision | Entity List |
| Sections — KYC / AR / Grouped AR | **Paramétrage**, section Questionnaires | Sandbox |
| Champs & droits par section | **Paramétrage**, section Questionnaires | Sandbox |
| CPSI — règles / guide | **Paramétrage**, section Règles | Sandbox |
| CoC — types & sensibilité | **Paramétrage**, section Règles | Sandbox |
| Scénarios AML & groupes | **Paramétrage**, section Règles | Sandbox |
| Workflow Designer / Rules / Instances | **Paramétrage**, section Workflow | Sandbox |
| Les 8 « Bacs à sable » | **supprimés en tant qu'écrans** — la simulation devient un onglet de chaque écran de paramétrage (écran 10) | Sandbox |
| Menus par rôle · IAM · SSO | **Paramétrage**, section Accès | Entity List |
| Administration | **Paramétrage**, section Général | Entity List |
| Administration Éditeur | espace séparé, rôle EDITOR uniquement | Entity List |
| Intégrations / API & doc | **Paramétrage**, section Général | Entity List |
| GED — Documents | accessible depuis chaque dossier + recherche ⌘K | Entity List |
| Olivia (AI Core) / Gouvernance O | **Paramétrage**, section IA | Sandbox |

### Décisions de suppression / fusion à valider avec le métier

1. **Les 8 bacs à sable disparaissent comme destination de menu.** La simulation
   devient un onglet à l'intérieur de l'écran de paramétrage concerné. Un
   contrôleur ne va pas « au bac à sable » : il modifie un seuil et voit l'effet.
2. **« Capacité équipe » et « Capacité de l'équipe (live) »** sont un doublon
   dans la démo. Un seul écran.
3. **« Compliance Center », « Dashboard central » et « Command Center »** se
   recouvrent largement. Fusionnés en deux vues : Ma journée (opérationnel) et
   Rapports (pilotage).
4. **Les modules verticaux** (PMS, FX, Custody, Mobile Banking, OIL, Legal,
   Octopulse) ne relèvent pas du cycle de vie client. Ils sortent de la
   navigation principale et deviennent un bloc « Métiers » optionnel, affiché
   uniquement si le module est licencié.

---

## Design tokens

À sortir en variables CSS / thème avant toute implémentation. Aucune couleur en
dur dans un composant.

### Couleurs — structure (neutres ardoise)

| Token | Hex | Usage |
|---|---|---|
| `--bg-app` | `#F6F7F3` | fond de la zone de contenu |
| `--bg-surface` | `#FFFFFF` | cartes, panneaux, tableaux |
| `--bg-subtle` | `#FBFCF9` | colonnes secondaires, en-têtes de tableau |
| `--bg-muted` | `#F0F3EB` | puces neutres, onglet actif discret |
| `--border` | `#E2E6DD` | bordure standard |
| `--border-soft` | `#EDF0E9` | séparateurs internes |
| `--border-row` | `#F2F4EE` | séparateur de ligne de tableau |
| `--border-input` | `#DCE1D6` | bordure de champ et de bouton secondaire |
| `--text` | `#171C22` | texte principal |
| `--text-secondary` | `#3F4A38` | libellés de champ, texte de bouton secondaire |
| `--text-body` | `#4A5740` | corps de texte explicatif |
| `--text-muted` | `#646E5E` | métadonnées (contraste AA vérifié) |
| `--text-label` | `#5C6655` | micro-libellés capitales 9,5 px |

### Couleurs — navigation (sombre)

| Token | Hex | Usage |
|---|---|---|
| `--nav-bg` | `#181D23` | fond de la barre latérale |
| `--nav-field` | `#232A32` | champ de recherche |
| `--nav-field-border` | `#2E3741` | bordure du champ |
| `--nav-text` | `#C7CED7` | entrées inactives |
| `--nav-text-strong` | `#FFFFFF` | entrée active, nom d'utilisateur |
| `--nav-icon` | `#6E7885` | icônes inactives |
| `--nav-label` | `#8A939E` | libellés de bloc en capitales |
| `--nav-active-bg` | `#2C3A20` | fond de l'entrée active |
| `--nav-active-icon` | `#A4C56B` | icône de l'entrée active |
| `--nav-divider` | `#2A323B` | séparateur du pied |

### Couleurs — marque

| Token | Hex | Usage |
|---|---|---|
| `--brand` | `#4A6B28` | boutons primaires, liens, accent actif |
| `--brand-hover` | `#5A7D3A` | survol du primaire |
| `--brand-light` | `#7BA042` | jauges, barres de progression, points de timeline |
| `--brand-pale` | `#A4C56B` | icône active en navigation |
| `--brand-surface` | `#F5F8EF` | fond d'option sélectionnée |
| `--brand-border` | `#D6E0C6` | bordure de carte sélectionnée |
| `--gold` | `#E3C75A` | olive du logo uniquement |

### Couleurs — sémantique réglementaire

Ces quatre familles ne servent **jamais** à autre chose qu'au risque, à
l'échéance et au statut de contrôle.

| Sens | Bordure / trait | Texte | Fond de puce |
|---|---|---|---|
| Validé, faible risque, dans les temps | `#7BA042` / `#3D9970` | `#3C6B2E` | `#EDF3E4` |
| Attention, en cours, risque élevé | `#D99A2B` | `#8A6212` | `#FBF3E2` |
| Alerte, bloqué, risque critique | `#C44536` | `#A63A2D` | `#FAE9E6` |
| Information neutre, lecture seule | `#3E6B8A` | `#2E5A80` | `#E7F0F7` |
| IA / suggestion | `#6C58A8` | `#2E2842` | `#F0ECF9` |

Fonds de carte associés : ambre `#FDFAF3` (bordure `#E3C07A`), rouge `#FDF7F5`,
IA `#FAF8FE` (bordure `#E7E2F2`).

Échelle de risque pays (cartographie) : faible `#333B46` · modéré `#4A5361` ·
élevé `#7A5730` · critique `#8E3B33`.

### Typographie

- **UI et corps** : `IBM Plex Sans` — 400 / 500 / 600 / 700
- **Chiffres, identifiants, horodatages, micro-libellés** : `IBM Plex Mono` — 400 / 500 / 600
- Aucune police serif dans l'application. (La serif `Newsreader` n'apparaît que
  dans le deck et la plaquette commerciale, hors périmètre applicatif.)

| Rôle | Taille | Graisse | Interlignage | Autres |
|---|---|---|---|---|
| Titre d'écran | 16–17 px | 600 | 1.2 | |
| Titre de section / carte | 13,5–14 px | 600 | 1.3 | |
| Corps | 12,5–13,5 px | 400 | 1.55–1.65 | |
| Libellé de champ | 11,5–12,5 px | 600 | 1.3 | |
| Métadonnée | 11–11,5 px | 400 | 1.45 | `--text-muted` |
| Micro-libellé capitales | 9,5–10 px | 500 | 1.2 | Mono, `letter-spacing: 1.5–2 px`, `text-transform: uppercase` |
| Chiffre de KPI | 28–31 px | 600 | 1 | Mono |
| Puce de statut | 10,5–11 px | 600 | 1 | `letter-spacing: 0.2 px` |

Règle : tout nombre, identifiant, date ou pourcentage est en Mono. Cela rend les
tableaux lisibles en diagonale et aligne les colonnes numériques.

### Espacement, rayons, ombres

- Échelle d'espacement : **4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 22 / 24 / 26 / 28 px**
- Rayons : puce `4–5 px` · bouton et champ `8–9 px` · carte `10–12 px` ·
  fenêtre `14 px` · pilule `20 px` · rond `50 %`
- Ombre de carte sélectionnée : `0 1px 2px rgba(0,0,0,0.04)`
- Ombre de carte IA en avant-plan : `0 2px 8px rgba(217,154,43,0.10)`
- Ombre de fenêtre (planche de maquettes uniquement) : `0 18px 50px rgba(23,28,34,0.14)`
- Bordure d'accent sémantique sur carte : `border-left: 3px solid <couleur>`

### Accessibilité

Tous les couples texte / fond de ce document ont été vérifiés à **4,5:1
minimum** (WCAG AA). Deux pièges rencontrés pendant le design, à ne pas
réintroduire :

- `#79837A` et `#8A937F` sur blanc plafonnent à ~3,2–3,9:1. Utilisez
  `--text-muted` (`#646E5E`) et `--text-label` (`#5C6655`).
- Sur la navigation sombre, les libellés de bloc doivent être `#8A939E`
  minimum. `#5E6773` tombe à 2,96:1.

Toute puce de statut doit rester lisible sans sa couleur : le libellé en toutes
lettres (`CRITIQUE`, `À CONFIRMER`) porte l'information, la couleur la renforce.

---

## Le shell applicatif

Grille fixe, identique sur tous les écrans.

```
┌────────────┬──────────────────────────────────────────────┐
│            │  Header  60 px (liste) ou 92 px (dossier)    │
│  Nav       ├──────────────────────────────────────────────┤
│  248 px    │  Stepper 78 px  (parcours uniquement)        │
│  fixe      ├──────────────────────────────────────────────┤
│            │  Contenu        │  Colonne latérale          │
│            │  1fr            │  320 / 340 / 380 / 400 px  │
└────────────┴──────────────────────────────────────────────┘
```

- Largeur de conception : **1440 px**. Sous 1280 px, la colonne latérale se
  replie en tiroir accessible par bouton.
- Le contenu principal est en `minmax(0, 1fr)` — indispensable pour que les
  tableaux ne débordent pas.
- Le shell ne défile jamais. Seuls les panneaux internes défilent.

### Composant `Nav` (barre latérale, 248 px)

Fichier de référence : `Nav.dc.html`. Une seule propriété pilote l'état actif.

```ts
type NavProps = {
  active: 'journee' | 'entree' | 'kyc' | 'surveillance'
        | 'revue' | 'rapports' | 'param';
  user: string;   // "Camille Morel"
  role: string;   // "Relationship Manager"
};
```

Structure verticale : logo (30 px, rayon 9, dégradé `#4A6B28 → #7BA042`, olive
`#E3C75A` de 9 × 12 px) → champ de recherche avec raccourci `⌘K` → 3 blocs
d'entrées → pied avec avatar, nom, rôle et chevron.

Entrée de menu : hauteur ~36 px, `padding: 9px 10px`, `border-radius: 8px`,
`gap: 11px`, icône dans une gouttière fixe de 16 px, libellé en 13,5 px, badge
optionnel poussé à droite par `margin-left: auto`.

**Chaque libellé et chaque badge doivent porter `white-space: nowrap` et
`min-width: 0` + `text-overflow: ellipsis`.** Le retour à la ligne d'une entrée
active est le défaut visuel le plus visible de cette barre — il est apparu deux
fois pendant le design.

État actif : fond `--nav-active-bg`, texte blanc, graisse 500, icône
`--nav-active-icon`, badge sur fond `--brand`. Badge d'alerte sur fond `#7A3129`,
texte `#F7DBD6`.

### Header

Deux variantes seulement.

- **Liste (60 px)** : titre 16 px 600 · sous-titre contextuel en Mono 11,5 px ·
  `flex: 1` · filtres à droite (boutons secondaires 7 × 13 px) · action primaire.
- **Dossier (92 px)** : avatar carré 44 px (rayon 11) ou rond pour une personne ·
  nom 17 px 600 + puces de statut · ligne d'identifiants en Mono 12 px ·
  `flex: 1` · 2–3 actions à droite.

---

## Bibliothèque de composants

Onze composants couvrent les dix écrans maquettés et suffisent aux ~50 autres.

### 1. `StatusChip`

Puce de statut. `font-size: 10,5–11 px`, `font-weight: 600`, `padding: 3px 8px`,
`border-radius: 5px`, texte et fond pris dans la table sémantique.
Variantes : `ok` · `warn` · `alert` · `info` · `neutral` · `ai`.
Libellés en capitales : `CRITIQUE`, `ÉLEVÉ`, `FAIBLE`, `RENSEIGNÉ`, `MANQUANT`,
`À CONFIRMER`, `LECTURE SEULE`, `SIMULATION`.

### 2. `StatTile`

Carte d'indicateur. Fond `--bg-surface`, bordure `--border`, rayon 12,
`padding: 16–18px 18–20px`. Libellé 11,5 px `--text-muted`, valeur en Mono
28–31 px 600, note de contexte 11–11,5 px. Accent sémantique optionnel en
`border-left: 3px`. **Toute tuile est cliquable et mène à la liste des dossiers
qui la composent.**

### 3. `WorkQueueRow`

Ligne de file de travail.
Grille : `5px 1.6fr 1fr 1fr 0.9fr 100px` — barre de priorité, client, action
attendue, étape, échéance, risque. `padding: 14px 20px`, séparateur
`--border-row`. Barre de priorité : 5 × 34 px, rayon 3, couleur sémantique. Le
fond de ligne prend la teinte pâle d'alerte (`#FDF7F5`) au niveau critique.

L'en-tête de colonne partage exactement la même `grid-template-columns` **et les
mêmes paddings de cellule** que les lignes de données. Un décalage de 14 px entre
l'en-tête et la première colonne est apparu au premier jet ; c'est le piège
classique de ce composant.

### 4. `SectionChecklist`

Colonne de sections d'un dossier (262–300 px). Jauge de progression 5 px en
haut, puis une ligne par section : pastille d'état (`✓` vert, `◐` ambre,
`○` gris), libellé, compteur d'éléments manquants poussé à droite. La section
courante est une carte blanche avec bordure `--brand-border` et ombre légère.

### 5. `FieldCard`

Carte de champ de formulaire. En-tête : libellé 12,5 px 600 + `StatusChip`
`RENSEIGNÉ` / `MANQUANT`. Corps : valeur saisie, ou champ vide. Pied : **provenance
de la donnée** — document source, empreinte vérifiée, auteur de la saisie.
Un champ manquant prend la bordure ambre `#E3C07A` et l'ombre ambre.

Le pied de provenance est ce qui distingue O-Live d'un formulaire ordinaire. Il
ne doit jamais être optionnel.

### 6. `AiSuggestion`

Encart de suggestion. Fond `#FAF8FE`, bordure `#E7E2F2`, rayon 11, badge `IA`
en Mono 9,5–10 px sur `#F0ECF9`. Texte 12,5 px, interlignage 1,5–1,6.
Deux actions maximum : une primaire violette `#6C58A8`, une secondaire bordée.
**Ligne de pied obligatoire** : « Proposition — la décision reste vôtre et sera
tracée. »

Sur un contexte critique, le composant passe en mode contexte : aucune action,
mention « Éléments de contexte — aucune décision n'est proposée. »

### 7. `DecisionPanel`

Panneau de décision en colonne latérale. Suite d'options en boutons radio
cartes (bordure 1 px inactive, `1.5px --brand` + fond `--brand-surface`
active), puis champ **Motif** obligatoire marqué d'un astérisque rouge, puis
encart « Effets de cette décision » listant ce qui sera créé, puis bouton
primaire pleine largeur et mention du second regard requis.

Règle : **aucune décision sans motif**, et le motif est présenté comme repris
tel quel dans le registre réglementaire.

### 8. `ImpactPreview`

Prévisualisation de propagation. Liste de dossiers touchés, chacun avec son
`StatusChip` d'effet (`REVUE ANTICIPÉE`, `ONBOARDING IMPACTÉ`, `SANS EFFET`) et
une ligne décrivant précisément ce qui sera rouvert ou créé. Les dossiers sans
effet sont affichés en `opacity: 0.7` — leur présence est une information.

### 9. `EventTimeline`

Chronologie verticale. Colonne de 9 px : pastille + trait `--border-soft` de
2 px. Titre 12,5 px, méta en Mono 11 px `--text-muted`. Le marqueur « vous êtes
ici » est un anneau de 15 px, bordure 3 px `--brand`, fond blanc, titre en
graisse 700.

### 10. `DiffRow`

Comparaison avant / après. Deux colonnes égales : « Au dossier — <année> » en
`--text-body`, « Constaté — <année> » en `#8A6212` graisse 500. Utilisé en revue
périodique, en changement de circonstances et en screening (où la grille passe
à `180px 1fr 1fr 92px` avec une colonne de concordance).

### 11. `SandboxSlider`

Curseur de paramètre. Rail 4 px `--border-soft`, remplissage `--brand` ou
`#6C58A8` selon qu'il s'agit d'une valeur humaine ou d'une proposition IA,
poignée 16 px bordure 3 px, **repère de la valeur en production** matérialisé
par un trait vertical gris de 2 × 12 px avec son libellé sous le rail.

---

## Écrans maquettés

Fichiers : `O-Live UI v2 - Command Center.dc.html` (écran 01),
`O-Live UI v2 - Écrans.dc.html` (02 à 04),
`O-Live UI v2 - Ecrans 05-10.dc.html` (05 à 10).

### 01 — Ma journée

*Nav `journee` · header liste · contenu `1fr / 340px`.*

Quatre `StatTile` (À traiter aujourd'hui 12 · En attente de mon visa 4 · SLA sous
48 h 7, accent ambre · Alertes ouvertes 3, accent rouge), puis la file de travail
en carte pleine hauteur avec onglets pilules (Tout · Bloqués · Délégués) et
5 lignes visibles + lien « Voir les 7 dossiers restants → ».

Colonne latérale : deux `AiSuggestion`, puis « Activité récente » (4 entrées avec
pastille colorée), puis en pied une jauge de capacité d'équipe.

### 02 — Dossier KYC

*Nav `kyc` · header dossier · contenu `262px / 1fr / 320px`.*

Le dossier **s'ouvre sur la première section incomplète et sur les champs
manquants**, jamais sur le premier onglet. Bandeau ambre expliquant ce choix.
Quatre `FieldCard` dont deux manquantes. Colonne latérale : « Qui doit agir »
(timeline à 3 nœuds : saisie → visa Compliance → décision MLRO), encart « Ce qui
bloque la transmission », journal du dossier.

Le bouton « Transmettre pour visa » reste actif ; au clic il énonce les
3 éléments manquants.

### 03 — AML Investigation

*Nav `surveillance` · header dossier · contenu `1fr / 400px`.*

Carte de règle déclenchée en tête, accent rouge, citant la règle en clair
(`AML-R17 — écart au profil de flux déclaré`) suivie de quatre chiffres :
attendu au dossier · constaté · écart · pays de la contrepartie. Puis le tableau
des transactions concernées (`110px 1fr 130px 150px 110px`), puis un
`AiSuggestion` en mode contexte.

Colonne latérale : `DecisionPanel` à trois options (faux positif · investigation
approfondie · communication MROS).

### 04 — Entrée en relation

*Nav `entree` · header dossier · stepper 78 px · contenu `1fr / 380px`.*

Stepper à 5 étapes, la dernière portant explicitement « bloquée tant que
KYC ≠ validé ». Carte d'aiguillage montrant **les trois critères qui ont porté le
dossier en EDD**, puis la structure de détention en arbre indenté de 28 px.

Colonne latérale : « Ce qui manque pour ouvrir » (5 lignes, 3 en cours,
2 validées), délai estimé calculé sur les dossiers comparables réels, rappel que
la règle d'ouverture n'est pas paramétrable.

### 05 — Screening, qualification d'un hit

*Nav `surveillance` · header dossier · contenu `1fr / 380px`.*

Tableau de comparaison champ à champ (`180px 1fr 1fr 92px`) : nom, date de
naissance, nationalité, lieu de naissance, pièce d'identité — avec colonne de
concordance (`92 %`, `DIVERGE`, `EXACT`, `N/A`) et fond rouge pâle sur les lignes
divergentes. Puis la mesure listée avec sa version de liste et le résultat sur
les autres listes. Puis « Où cette personne intervient » — la qualification vaut
pour la personne et se propage.

### 06 — Revue périodique

*Nav `revue` · header dossier · contenu `300px / 1fr`.*

Colonne des dossiers du groupe (4 cartes avec compteur d'écarts). Contenu : **ce
qui a changé depuis la dernière revue**, 4 cartes à accent sémantique, dont une
déjà traitée par un événement de changement de circonstances. Pied : « Reporter
les 28 sections inchangées ».

### 07 — Changement de circonstances

*Nav `kyc` · header personne · contenu `1fr / 400px`.*

`DiffRow` du changement constaté avec évaluation de matérialité, puis
`ImpactPreview` sur 3 dossiers. Colonne latérale : date d'effet (antérieure au
constat — le rejeu distinguera les deux dates), source du constat, « Ce qui sera
créé », avertissement sur le dossier en cours d'ouverture, et deux actions :
« Émettre l'événement » / « Enregistrer sans propager ».

### 08 — Pilotage

*Nav `rapports` · header liste · pleine largeur.*

Quatre `StatTile`, puis grille `1.35fr / 1fr`. À gauche « Où le travail est
bloqué » : temps d'attente médian par étape en `Bar Meter`, avec une conclusion
écrite sous les barres nommant le seul goulot interne. À droite : charge par
contrôleur avec proposition de rééquilibrage, et exposition par risque pays
renvoyant vers le globe.

### 09 — Audit, rejeu et preuves

*Nav `rapports`, rôle Audit · header dossier · bandeau curseur 74 px ·
contenu `1fr / 420px`.*

Curseur de date sur toute la largeur, avec les événements marquants matérialisés
par des pastilles colorées. Sous le curseur, l'état du dossier **à cette date**,
le paramétrage alors en vigueur (4 cartes de version), et l'intégrité
documentaire avec date d'ancrage RFC 3161 / ZertES.

Colonne latérale : journal d'événements avec marqueur « Vous êtes ici », et
encart bleu rappelant que la consultation de l'auditeur est elle-même tracée.

### 10 — Paramétrage, bac à sable

*Nav `param` · header dossier · contenu `380px / 1fr`.*

Colonne de paramètres à gauche (deux `SandboxSlider`, cases de population,
encart de proposition Olivia). À droite, l'effet simulé sur 24 mois réels :
trois `StatTile` (alertes générées · faux positifs évités · **alertes fondées
perdues**), puis la liste nominative des 13 alertes qui n'auraient pas été
levées, dont 2 communications MROS.

Le coût est affiché aussi crûment que le gain. C'est le point de crédibilité de
tout l'écran.

---

## Patterns pour les écrans non maquettés

| Pattern | Composition | Écrans concernés |
|---|---|---|
| **Entity List** | Header liste + barre de filtres + tableau dense + tiroir de détail à droite | Clients, Personnes, GED, Registre LBA, Transferts, Habilitations, IAM, Administration |
| **Pipeline** | Colonnes kanban de cartes client, une par étape, compteur en tête de colonne | Entrée en relation (vue d'ensemble) |
| **Timeline** | `EventTimeline` pleine largeur + filtres par type d'événement | Chronologie client, Contact Reports, Veille réglementaire |
| **Detail Drawer** | Panneau 480 px glissant depuis la droite, sans quitter la liste | Analyseur SWIFT, détail de transaction, aperçu de document |
| **Sandbox** | Écran 10 | Tout écran de paramétrage |
| **Time Travel** | Écran 09 | Audit FINMA, Audit IT |

Règle de décision : si l'écran demande **une décision**, il prend une colonne
latérale avec `DecisionPanel`. S'il sert à **trouver**, il prend un tiroir de
détail. S'il sert à **piloter**, il est pleine largeur.

---

## Interactions & comportement

### Palette de commandes (⌘K / Ctrl+K)

Le pivot de l'architecture à 10 entrées. Ouvre une recherche unifiée sur :
clients, personnes, dossiers KYC, alertes, documents, et **écrans**. Résultats
groupés par type, 5 par groupe, navigation au clavier, `Entrée` pour ouvrir.
Recherche floue sur le nom et l'identifiant. C'est le seul chemin d'accès aux
écrans rares — il doit être rapide et toujours disponible.

### États de survol

- Ligne de tableau : fond `--bg-subtle`, curseur pointeur.
- Entrée de navigation : fond `#232A32`.
- Bouton primaire : `--brand` → `--brand-hover`.
- Bouton secondaire : bordure `--border-input` → `--brand-border`.
- `StatTile` : élévation `0 2px 8px rgba(23,28,34,0.06)`.

Transitions : `120 ms ease-out` sur `background` et `border-color`. Aucune
animation sur la disposition.

### Actions bloquées

Un bouton n'est jamais `disabled` sans explication. Deux cas :
1. **Prérequis manquants** — le bouton reste actif ; au clic, un panneau liste
   les éléments manquants avec un lien vers chacun.
2. **Interdiction de règle** (ouverture sans KYC validé) — le bouton est absent,
   remplacé par une phrase expliquant la règle et son caractère non paramétrable.

### Validation de formulaire

- Le motif de décision est obligatoire ; le bouton de validation reste actif et
  met le champ en évidence au clic.
- Les champs KYC obligatoires manquants prennent la bordure ambre en permanence,
  pas seulement après tentative de soumission.
- Le brouillon s'enregistre automatiquement ; l'horodatage s'affiche en pied de
  la zone d'édition (« Brouillon enregistré · 14:02 »).

### Chargement

Squelettes gris (`--bg-muted`) respectant la géométrie finale, jamais de
`spinner` plein écran. Une file de travail affiche 5 lignes squelettes.

### Responsive

L'application vise 1440 px et plus. Entre 1280 et 1440 px, la colonne latérale
passe en tiroir. Sous 1280 px, la navigation se réduit aux icônes (64 px). Il n'y
a pas de version mobile de l'application de contrôle ; le module Mobile Banking
est un produit distinct.

---

## State management

État minimal par écran ; la vérité vient du serveur (projections du journal
d'événements).

| État | Portée | Déclencheurs |
|---|---|---|
| `activeNav` | application | navigation, palette ⌘K |
| `commandPaletteOpen` | application | `⌘K`, `Échap`, sélection d'un résultat |
| `currentUser` (nom, rôle, permissions) | application | authentification, changement de rôle |
| `queueFilter` (`tout` / `bloqués` / `délégués`) | Ma journée | onglets |
| `queueSort` (échéance, risque) | Ma journée | en-têtes de colonne |
| `activeSection` | dossier KYC | ouverture (= première section incomplète), clic |
| `draft` (réponses en cours) | dossier KYC | saisie, sauvegarde auto |
| `decision` + `motif` | AML, screening | `DecisionPanel` |
| `replayDate` | audit | curseur |
| `sandboxParams` | paramétrage | curseurs, cases |
| `simulationResult` | paramétrage | recalcul déclenché par `sandboxParams` (debounce 400 ms) |

Données à charger : la file de travail (paginée), les projections de dossier, le
journal d'événements par dossier, les résultats de simulation (asynchrone, coût
serveur — d'où le debounce et l'état de chargement dédié).

**Aucun état ne modifie une donnée métier directement.** Toute action émet un
événement au serveur ; l'interface se remet à jour depuis la projection
retournée. C'est le principe fondateur du produit et il doit se refléter dans le
code client.

---

## Assets

- **Polices** : IBM Plex Sans et IBM Plex Mono (Google Fonts, licence SIL OFL).
  À héberger localement pour un déploiement on-premise sans appel sortant.
- **Logo** : carré 30 px, rayon 9 px, dégradé `135deg, #4A6B28 → #7BA042`,
  olive `#E3C75A` de 9 × 12 px centrée. Reproductible en CSS, aucun fichier
  image requis.
- **Icônes** : caractères Unicode dans les maquettes (`◉ ☰ ☺ ◔ ◎ ⛨ ↻ ▤ ⚙ ⌕ ✓ ◐ ○`).
  **À remplacer par un jeu d'icônes vectoriel** en implémentation — le rendu des
  glyphes Unicode varie selon les systèmes et les plateformes.
- **Fond de carte** : `world-atlas@2.0.2` `countries-110m.json` (Natural Earth,
  domaine public). Rendu via `d3-geo` en projection orthographique.
  À vendoriser pour un déploiement hors ligne.

## Files

| Fichier | Contenu |
|---|---|
| `Nav.dc.html` | Barre latérale, composant partagé avec propriété `active` |
| `O-Live UI v2 - Command Center.dc.html` | Écran 01 — Ma journée |
| `O-Live UI v2 - Écrans.dc.html` | Écrans 02 à 04 — KYC, AML, entrée en relation |
| `O-Live UI v2 - Ecrans 05-10.dc.html` | Écrans 05 à 10 — screening, revue, CoC, pilotage, audit, paramétrage |
| `globe-flux.html` | Globe des flux de transactions, prototype d3-geo autonome |
| `screenshots/` | Une capture par écran, 1440 × 900, dans l'ordre du document |

### Captures

| Fichier | Écran |
|---|---|
| `screenshots/01-ma-journee.png` | 01 — Ma journée |
| `screenshots/02-dossier-kyc.png` | 02 — Dossier KYC |
| `screenshots/03-aml-investigation.png` | 03 — AML Investigation |
| `screenshots/04-entree-en-relation.png` | 04 — Entrée en relation |
| `screenshots/05-screening.png` | 05 — Screening |
| `screenshots/06-revue-periodique.png` | 06 — Revue périodique |
| `screenshots/07-changement-de-circonstances.png` | 07 — Changement de circonstances |
| `screenshots/08-pilotage.png` | 08 — Pilotage |
| `screenshots/09-audit-rejeu.png` | 09 — Audit, rejeu et preuves |
| `screenshots/10-parametrage-bac-a-sable.png` | 10 — Paramétrage, bac à sable |

Les captures servent de référence visuelle rapide. **Les valeurs exactes de
couleur, taille et espacement se lisent dans les fichiers `.dc.html` et dans la
section « Design tokens », pas dans les captures** (rendues à 60 % puis
rééchantillonnées).

Les fichiers `.dc.html` s'ouvrent directement dans un navigateur. Les planches
02-04 et 05-10 empilent plusieurs écrans verticalement, chacun précédé de son
numéro et d'une note d'intention.

---

## Ordre d'implémentation suggéré

1. **Tokens et shell** — variables de thème, `Nav`, les deux headers, la grille.
   Rien d'autre ne peut être fait proprement avant.
2. **Composants transverses** — `StatusChip`, `StatTile`, `WorkQueueRow`,
   `EventTimeline`. Ils apparaissent sur presque tous les écrans.
3. **Ma journée** — c'est l'écran de démonstration et il valide le shell.
4. **Palette ⌘K** — sans elle, l'architecture à 10 entrées n'est pas utilisable.
5. **Dossier KYC** — le plus structurant, il introduit `FieldCard`,
   `SectionChecklist` et le panneau « qui doit agir ».
6. **AML et screening** — ils partagent `DecisionPanel`.
7. **Revue, changement de circonstances** — ils partagent `DiffRow` et
   `ImpactPreview`.
8. **Pilotage, audit, paramétrage** — moins fréquents, mais ce sont les trois
   écrans qui emportent la décision d'achat en démonstration.
9. **Les ~50 écrans restants** par application des patterns.
