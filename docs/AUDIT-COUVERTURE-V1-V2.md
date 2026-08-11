# Audit de couverture v1 → v2

> Lot **V2-M17** (11.08.2026). Établi capacité par capacité, **vérifié dans le code de la v2**
> — pas déduit de la cartographie ni du registre. Le registre `apps/web/src/ui2/capacites.ts`
> a été corrigé par cet audit : il déclarait « livrées » 14 capacités qui ne le sont qu'à moitié.

## Le résultat

| Verdict | Capacités | Ce que cela veut dire |
|---|---:|---|
| **Livré** | 60 | l'objet métier ET ses actes sont rendus en v2 |
| **Partiel** | 10 | l'objet est rendu mais amputé — consultation là où la v1 agissait, ou fraction du périmètre |
| **Absent** | 16 | ni écran ni onglet ne porte l'objet |
| | **86** | les écrans du ROUTEUR v1 (pas les 82 du menu : 4 écrans n'ont aucune entrée) |

### La méthode, et sa limite

Le critère : une capacité est **livrée** si l'écran v2 rend son objet métier et ses actes ;
**partielle** si elle est servie en consultation alors que la v1 permettait d'agir, ou si seule
une fraction du périmètre est là ; **absente** sinon.

La limite est réelle et il faut la connaître : « l'onglet existe » ne prouve pas « la capacité
est livrée ». Un premier passage automatique donnait 72 capacités atteignables ; en vérifiant le
CONTENU, quatre d'entre elles se sont révélées vides de leur objet — l'onglet Règles porte des
clés gouvernées et non le référentiel des 128 règles, l'onglet IA porte le curseur et les budgets
et non le journal des runs, l'onglet Workflow porte les définitions et non les instances en
cours. Le chiffre honnête est donc 56, pas 72.

## Ce qui manque — 16 capacités absentes

| Capacité | Groupe v1 | Destination arrêtée | Ce qui manque |
|---|---|---|---|
| **AML Gap** | Compliance & Risque | `surveillance/AML Gap` | onglet de destination non construit |
| **Checklist exigences** | Compliance & Risque | `kyc/Exigences` | onglet de destination non construit |
| **Legal — Contrats** | Compliance & Risque | `legal` | écran vertical non construit |
| **Octopulse OpRisk** | Compliance & Risque | `oprisk` | écran vertical non construit |
| **Pré-revue IA** | Compliance & Risque | `kyc/Pré-revue IA` | onglet de destination non construit |
| **Référentiel AML** | Compliance & Risque | `param/Règles` | l'onglet Règles porte des clés gouvernées, pas le référentiel des 128 règles |
| **Olivia · Runs** | Data & Intelligence | `param/IA` | l'onglet IA porte le curseur et les budgets, pas le journal des runs |
| **Cross-Border** | Front & Croissance | `crossborder` | écran vertical non construit |
| **CPSI · Risk cases** | Profilage CPSI | `cpsi/Risk cases` | écran vertical non construit |
| **CPSI · Segmentation** | Profilage CPSI | `cpsi/Segmentation` | écran vertical non construit |
| **Custody & TA** | Transactions & Marchés | `custody` | écran vertical non construit |
| **Finance Islamique** | Transactions & Marchés | `islamic` | écran vertical non construit |
| **Mobile Banking** | Transactions & Marchés | `mobile` | écran vertical non construit |
| **Multi-devise & FX** | Transactions & Marchés | `fx` | écran vertical non construit |
| **PMS** | Transactions & Marchés | `pms` | écran vertical non construit |
| **Workflow Instances** | Workflow | `param/Workflow` | l'onglet Workflow porte les définitions, pas les instances en cours |

### Lecture

Dix des seize sont des **écrans verticaux entiers** : Cross-Border, Custody & TA, Finance
Islamique, PMS, Multi-devise & FX, Mobile Banking, Octopulse OpRisk, Legal — Contrats, et les
deux écrans CPSI opérationnels (Segmentation, Risk cases). Leur destination est arrêtée dans le
registre ; il reste à les bâtir.

Les six autres sont des **onglets** dont la destination existe mais pas le contenu : AML Gap,
Référentiel AML, Checklist exigences, Pré-revue IA, Olivia · Runs, Workflow Instances.

## Ce qui est amputé — 10 capacités partielles

> **Mis à jour au lot V2-M18.** Les quatre capacités servies en consultation seule — MROS,
> Formations, Veille réglementaire, Registre LBA — ont reçu leurs actes et passent à « livré ».
> Le tableau ci-dessous liste ce qui reste.

| Capacité | Ce qui est servi, ce qui ne l'est pas |
|---|---|
| **Analyseur SWIFT/SEPA** | onglet Transactions commun — pas d'analyseur SWIFT/SEPA |
| **CPSI · Barèmes** | barèmes visibles en clé gouvernée ; l'éditeur de barème CPSI n'est pas repris |
| **CPSI · Guide** | le guide CPSI est replié en doctrine, pas en écran |
| **File d'alertes** | la file d'alertes est rendue, le tri et les filtres avancés v1 non repris |
| **GED / coffre** | onglet Pièces sert la GED ; le coffre n'a pas de surface |
| **Guide IAM** | le guide IAM est replié en doctrine, pas en écran |
| **Ports** | ports visibles dans Général ; la console de ports n'est pas reprise |
| **Screening avancé** | le screening avancé (paramètres de rapprochement) n'est pas exposé |
| **Settlement** | onglet Transactions commun — pas de vue settlement dédiée |
| **Transactions Risk Monitoring** | onglet Transactions commun — pas de vue risque transactionnel dédiée |

### Trois familles de partiel

**~~La consultation sans l'acte~~ — RÉSOLU (V2-M18).** MROS, Formations, Veille et Registre LBA
ont reçu leurs actes : décider d'une communication, générer le brouillon goAML, poser un gel,
assigner une formation, viser une complétion, lancer une collecte, proposer une application,
exporter le registre. Chaque bouton énonce sa garde et la route du moteur qui la porte.

**La fusion qui écrase le détail** (Transactions Risk Monitoring, Settlement, Analyseur
SWIFT/SEPA) : trois écrans v1 distincts partagent l'onglet Transactions de Surveillance. La
fusion se défend pour la vue d'ensemble, pas pour l'analyse fine d'un message SWIFT.

**Le repli en doctrine** (Guide IAM, Guide CPSI) : ces écrans sont devenus des phrases dans les
écrans qu'ils documentaient. C'est un choix assumé et je le maintiens — un guide séparé que
personne n'ouvre vaut moins qu'une phrase lue au bon moment.

## Par groupe de la navigation v1

| Groupe v1 | Livré | Partiel | Absent |
|---|---:|---:|---:|
| (sans entrée de menu) | 4 | 0 | 0 |
| Audit | 3 | 0 | 0 |
| Bacs à sable | 7 | 0 | 0 |
| Clients & Relations | 7 | 0 | 0 |
| Compliance & Risque | 7 | 6 | 6 |
| Data & Intelligence | 5 | 2 | 1 |
| Front & Croissance | 7 | 0 | 1 |
| Paramétrage | 12 | 1 | 0 |
| Profilage CPSI | 1 | 2 | 2 |
| Transactions & Marchés | 1 | 3 | 5 |
| Workflow | 2 | 0 | 1 |

## Ce que l'audit ne dit pas

- **La profondeur fonctionnelle à l'intérieur d'une capacité livrée.** « Livré » signifie que
  l'objet et ses actes sont là, pas que chaque champ et chaque filtre de la v1 y sont. Un audit
  champ à champ est un autre chantier.
- **La justesse des données servies.** L'audit porte sur les surfaces, pas sur le branchement
  API — plusieurs écrans v2 tournent encore sur des données de maquette, ce que chaque écran
  signale lui-même (« données maquette »).
- **Les capacités du MOTEUR sans surface ni en v1 ni en v2** — R84 (la main sur un dossier),
  les campagnes de gouvernance AML, les 16 routes Cross-Border. Elles sont consignées
  séparément dans `docs/ECARTS-FRONT.md` (E-V2-1, E-V2-2) et `docs/REFERENTIEL-DETECTION.md`.

## Suite proposée

L'ordre que je recommande, du plus coûteux en usage réel au moins coûteux :

1. ~~Rendre les actes aux quatre capacités en consultation seule~~ — **FAIT (V2-M18)**.
2. **Cross-Border en écran de plein droit** — 17 routes au moteur, une seule exposée ; c'est le
   plus gros écart fonctionnel du produit.
3. **Les six onglets sans contenu** — AML Gap, Référentiel AML, Runs, Instances, Checklist,
   Pré-revue IA : la destination existe déjà, il n'y a qu'à la remplir.
4. **Les écrans verticaux licenciés** (PMS d'abord, seul module facturable des dix) puis les
   sept autres, sous réserve de la ratification R320 (écart E-V2-4).

Chaque étape est un lot, vérifiable, avec sa garde de test.
