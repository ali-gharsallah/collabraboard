# Catalogue O-Live — Amendement PROPOSÉ (R183 → R185) · Bloc 39 « La charge se voit, la reconnaissance se décide »

**Statut : RATIFIÉ le 21.07.2026 par Ali Gharsallah.**
Numérotation continue après R182. Famille : **WK** (vérifiée libre). **Le catalogue précède
le code.** Exigence d'Ali : chaque responsable (Compliance qui chapeaute des CO, chef RM,
BRM, Central File) voit à tout moment la capacité de son équipe — qui fait quoi, en %, en
combien de temps — avec des points de bonification alimentant le bonus de fin d'année
(module RH). Cadre d'expert : en droit suisse (art. 26 OLT 3), mesurer la performance est
licite si c'est transparent, proportionné et non coercitif — c'est l'ADN du moteur (R39) :
**le système mesure et signale ; l'humain répartit et décide.**

## R183 — La charge DÉRIVE des événements — transparente pour celui qui est mesuré

La capacité d'équipe se calcule uniquement depuis ce qui existe déjà (tâches, visas,
dossiers) : compteurs par personne et par état, pourcentage de charge (pondération par type
× capacité standard), délai moyen de traitement des tâches accomplies. **Aucun pointage,
aucune saisie supplémentaire.** Transparence structurelle : chaque collaborateur lit SES
propres mesures à tout moment ; lire celles d'un autre exige d'être son responsable déclaré
(paramètre `workloadResponsables` : quel rôle chapeaute quel rôle) — sinon refus tracé.

> **WK-01** compteurs, %, délai moyen — dérivés des tâches, rien de saisi · **WK-02** je
> lis MES mesures ; le responsable déclaré lit son équipe ; un tiers est refusé et tracé

## R184 — La répartition est un ACTE du responsable — le système suggère, il ne déplace pas

Une surcharge détectée (seuil paramétrable) est un **signal** (événement + suggestion de
rééquilibrage), jamais un déplacement automatique. Réassigner une tâche = acte du
responsable habilité, **motivé** (R7), tracé — la tâche ne change de main que par l'acte.

> **WK-03** surcharge → signal, rien ne bouge ; réassignation motivée par le responsable →
> la tâche change de main, l'acte est au journal ; sans motif, rien

## R185 — Les points se calculent au barème du jour de l'accomplissement — le bonus reste humain

Le barème de bonification (points par type de tâche accomplie) est un paramètre tenant
**versionné par date d'effet** (pattern R29) : une tâche accomplie garde À VIE les points
du barème en vigueur à son accomplissement — changer le barème n'est jamais rétroactif.
Chacun voit SES points en continu (équité). L'export vers le module RH est un **événement
de photographie** (`rh.bonification.snapshot`) : le moteur fournit la matière, **il ne
calcule pas le bonus** — la décision de fin d'année appartient à l'humain.

> **WK-04** points au barème, visibles par l'intéressé, snapshot RH = événement ·
> **WK-05** barème v2 daté → les accomplissements antérieurs gardent leurs points v1

## Implications techniques
| Point | Conséquence |
|---|---|
| Service | `workload/workload.service.ts` : `chargeEquipe` (R183), `mesuresDe` (R183), `signalerSurcharges` + `reassigner` (R184), `points` + `snapshotRh` (R185) — calcul pur sur `task`/`user`/settings |
| Paramètres | +`workloadResponsables` (qui chapeaute qui) · +`workloadBareme` (liste versionnée `{depuisLe, points{TYPE}}`) · +`workloadCapacite` (charge standard, seuil de surcharge) — questionnaire R-Q |
| Contrat tâche | `assigneeId, type, statut OUVERTE|EN_COURS|FAITE, createdAt, doneAt` — déclaré par le corpus |
| Événements | `workload.surcharge.signalee` · `workload.tache.reassignee` · `rh.bonification.snapshot` |
| Écran | « Capacité de l'équipe » (espace Mon travail) : barres % par personne, qui-fait-quoi, délais, points, réassignation motivée, note de transparence |
| CRM | axes d'amélioration traités en réponse conseil — bloc dédié sur validation |

Tests : WK-01..05 (`workload.wiring.spec.ts`), écrits **avant** l'implémentation.

`RATIFIÉ le 21.07.2026 par Ali Gharsallah`
