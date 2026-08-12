# Calendrier réglementaire — R490→R492 (V2-M43, 12.08.2026)

**Origine.** Écart E-V2-7, trouvé contre une API vivante au lot V2-M41 : l'onglet
« Réglementaire » du Pilotage lisait `/v1/rapports/kpi`, qui rend des *indicateurs de
conformité* (screening, risk cases, MROS, charge) et non un calendrier d'obligations. L'écran
retombait toujours sur son seed. Aucune route ne portait ce calendrier — il n'existait pas.

**Ce que ce bloc construit, et ce qu'il refuse de construire.** Il construit le MÉCANISME :
une liste d'obligations gouvernée par la banque, versionnée par date d'effet, dont le statut se
CALCULE à la lecture. Il ne construit PAS le contenu : quelles obligations, quelles bases
légales, quelles échéances — cela relève de l'arbitrage de l'établissement (voie ⚙ R-Q), comme
la matrice documentaire (R26) et le barème de risque. **Le moteur ne décide d'aucune base
légale et n'en invente aucune.**

---

## R490 — Le calendrier est une CONFIG gouvernée, versionnée par date d'effet

La liste des obligations vit dans le registre R-Q, clé `calendrierReglementaire` — donc
motivée (R7), datée, append-only, jamais rétroactive (R126), et rejouable à date (R127/R29).
Elle n'est **pas** une table du moteur : ce serait une seconde vérité à côté du registre, et
c'est précisément ce que R125 interdit.

Une obligation déclare :

| champ | sens | obligatoire |
|---|---|---|
| `code` | identifiant stable dans le tenant (`LBA-9`, `FATCA-2025`) | oui |
| `obligation` | intitulé lisible | oui |
| `periode` | l'exercice couvert (`2025`, `T2-2026`) — le calendrier est publié POUR une période | oui |
| `echeance` | date ISO, **ou `null`** quand la loi ne fixe pas de date | oui (la clé, pas la valeur) |
| `base` | base légale citée par la banque (`LBA art. 9`, `OBA-FINMA`, `LEAR`) | oui |
| `responsable` | rôle ou fonction qui répond de l'obligation | non |

**`echeance: null` n'est pas un oubli, c'est un cas de droit.** La communication au MROS
(LBA art. 9) est due « sans délai » : aucune date n'existe. Un moteur qui fabriquerait une date
pour pouvoir afficher un retard porterait un jugement juridique que personne ne lui a demandé.

## R491 — Le statut se CALCULE à la lecture, il ne se stocke pas

Pour une date d'observation `at`, chaque obligation reçoit exactement un statut :

| statut | condition |
|---|---|
| `DEPOSEE` | un dépôt est consigné au journal pour ce `(code, periode)` |
| `SANS_ECHEANCE` | `echeance == null` — le moteur ne dit JAMAIS qu'une telle obligation est en retard |
| `EN_RETARD` | `at > echeance` et aucun dépôt |
| `DUE` | `echeance - at ≤ preavisJours` (préavis gouverné, défaut 30) |
| `A_VENIR` | sinon |

Aucun de ces statuts n'est écrit en base : ils sont recalculés à chaque lecture, depuis la
config en vigueur à `at` et le journal. Deux lectures à la même date rendent le même verdict —
c'est ce qui rend l'écran opposable (R48).

## R492 — Le dépôt est un ACTE HUMAIN motivé ; le moteur signale, il ne dépose pas

Consigner un dépôt exige un `motif` (R7) et une `reference` (l'accusé du dépôt : numéro goAML,
quittance AEOI…). L'acte produit un événement append-only (R49) ; il n'existe aucun chemin de
code qui dépose, déclare ou régularise automatiquement (R44). Le retard est **mesuré et
signalé**, jamais corrigé par le système (R39).

Deux refus explicites :
1. un `code` absent du calendrier en vigueur — on ne consigne pas le dépôt d'une obligation que
   la banque n'a pas déclarée ;
2. un second dépôt pour le même `(code, periode)` — le refus **nomme la première référence**,
   parce qu'un doublon de déclaration est un incident, pas une opération neutre.

---

## Questions consignées pour revue humaine (NON tranchées ici)

Conformément à la discipline d'exécution (« en cas de doute sur une règle ou une base légale
— CDB 20, LBA, OBA-FINMA —, consigner la question pour revue humaine, ne pas trancher ») :

- **Q-CR-1 — Le contenu du calendrier de démonstration.** Le seed GWB publie quatre obligations
  (communication MROS *sans délai* LBA art. 9 ; rapport annuel LBA à la direction ;
  auto-déclaration AEOI/CRS ; déclaration FATCA). Les intitulés et les dates viennent de la
  maquette v1, **pas d'une vérification juridique**. Elles sont marquées comme contenu de
  démonstration. Un juriste doit valider, pour l'établissement, la liste, les bases citées et
  les échéances — avant tout usage autre que la démonstration.
- **Q-CR-2 — Périodicité et reconduction.** Le calendrier est publié POUR une période ; il ne
  se reconduit pas tout seul. Faut-il un mécanisme de reconduction annuelle (et alors, qui le
  ratifie chaque année), ou la publication d'un nouveau calendrier par exercice est-elle
  précisément l'acte de gouvernance qu'on veut rendre visible ? **Recommandation : la seconde**
  — une obligation qui se reconduit sans que personne ne la relise est une obligation qu'on
  oublie. Arbitrage requis.
- **Q-CR-3 — Le préavis.** `preavisJours` (défaut 30) est un paramètre de confort d'affichage,
  pas une règle de droit. À confirmer comme tel.
- **Q-CR-4 — Lien avec le module MROS.** Une communication MROS déposée par le module `mros`
  (goAML) ne consigne PAS automatiquement le dépôt de l'obligation LBA art. 9 : le
  rapprochement des deux serait une réconciliation (patron R280), et il n'est pas fait ici. Le
  faire ou non est une décision produit.
