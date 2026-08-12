# Audit de câblage de l'UI v2 — le chiffre honnête

> Lot **V2-M34** (11.08.2026). Établi après un désaccord du PO : « la v2 n'a que le client
> centric de bon, tout le reste est loin de la v1 ». Vérification faite : **il a raison**, et
> l'audit de couverture `AUDIT-COUVERTURE-V1-V2.md` annonçait mieux que la réalité. Ce
> document-ci corrige, il ne complète pas.

## Le fait qui décide de tout

| Mesure | UI v1 (`features/` + `parity/`) | UI v2 (`ui2/`) |
|---|---:|---:|
| Appels d'**écriture** au moteur (POST/PUT/PATCH/DELETE) | **149** | **0** |
| Routes de **lecture** distinctes | 113 | 25 |
| Fichiers d'écran | 173 | 29 |

**L'UI v2 n'écrit rien.** Aucun de ses écrans n'a jamais envoyé quoi que ce soit au moteur.
Elle lit vingt-cinq routes, en affiche le résultat, et **décrit** vingt et un actes — chacun
nomme sa garde et sa route, aucun ne l'appelle.

## Pourquoi l'audit précédent disait 63 / 10 / 13

Son critère était : « l'objet métier ET ses actes sont RENDUS ». Rendus. Un écran qui affiche
l'objet et montre un bouton nommant l'acte satisfaisait ce critère. C'est un critère de
maquette, pas de produit : il mesure ce qu'un lecteur voit, pas ce qu'un utilisateur peut
faire. Appliqué à la v1, il l'aurait déclarée livrée aussi — sauf que la v1, elle, envoie
149 écritures.

Le critère honnête est binaire : **une capacité est livrée quand l'utilisateur peut poser
l'acte depuis l'écran et que le moteur l'enregistre.** Sous ce critère, le nombre de capacités
livrées en v2 est **0 sur 86**, et la v2 est une **vitrine navigable** posée sur un moteur
réel — pas une application.

## Ce que la v2 a vraiment de bon, et qu'il faut garder

- **Le parcours client** : la colonne vertébrale (entrée → connaissance → surveillance →
  revue & sortie) est juste, et la v1 ne l'avait pas.
- **La discipline d'énonciation** : chaque écran DIT sa source, son âge, sa version, sa garde.
  C'est ce qui a permis de mesurer cet écart plutôt que de le découvrir en production.
- **25 lectures réelles** et le registre des capacités, qui rendent le câblage mécanique.

## Ce qu'il faut faire, dans cet ordre

1. **Un client d'écriture** (`apiPost`/`apiPut` avec en-têtes, erreurs du moteur rendues à
   l'écran — un refus R7/R13/R445 doit s'AFFICHER, pas disparaître).
2. **Câbler les 21 actes déjà décrits** : ils nomment déjà leur route et leur garde ; le
   travail est de remplacer l'explication par l'appel, en gardant l'explication.
3. **Remplacer les seeds par les lectures** là où la route existe et n'est pas branchée.
4. **Puis seulement** les écrans manquants (verticaux licenciés, onglets vides).

Tant que le point 1 n'est pas fait, tout écran neuf ajoute de la vitrine.

## Journal du câblage

| Lot | Ce qui a été câblé | Écritures réelles de `src/ui2` |
|---|---|---:|
| V2-M34 | *(constat)* | 0 |
| V2-M35 | `acte-moteur.tsx` + les deux décisions de Surveillance — qualification d'un hit (`POST /v1/screening/hits/:id/qualify`, R101/R7) et transition d'un cas de risque (`POST /v1/riskcases/:id/transition`, R133/R136) | 1 chemin · 1 écran |
| V2-M40 | contrat des **lectures** : `/v1/bi/annuaire` n'existait qu'en POST — l'écran le lisait en GET et retombait sur son seed en silence. GET ajouté au moteur ; garde AC-04 sur les 29 lectures | 1 chemin · 3 écrans |
| V2-M39 | **relecture des gardes** : 6 déclarations de champs sur 21 étaient fausses — corrigées, et une garde de contrat (`actes-contrat.test.ts`, AC-01/02/03) confronte désormais chaque acte au contrôleur réel | 1 chemin · 3 écrans |
| V2-M38 | durcissement moteur des trois actes MROS (valeur de notification validée, levée sans gel refusée, dépôt goAML impossible hors DECLARER et non retraçable) | — |
| V2-M37 | les **onze** actes des Rapports — MROS (décider R129/R130, brouillon goAML, gel et **levée de gel** R131, notification reçue, dépôt goAML tracé), habilitations (assigner R236, viser R235/R13), veille (collecter VR-01, proposer VR-04), registre (exporter R49). Barre d'actes **mutualisée** : un seul formulaire pour tous les écrans | 1 chemin · **3 écrans** |
| V2-M36 | les **treize** actes de Cross-Border : 10 écritures (sync R453, demande et visa de dérogation R7/R294/R13, acte distant R454, pré-acte R455, preuve RS et son visa R456, localisation R457, ordre XB-04, paramètre §CrossBorder R462/R445) et 3 lectures d'acte (matrice à date, conformité d'un voyage, rejeu R48) | 1 chemin · **2 écrans** |

**Ce que V2-M35 change vraiment, et ce n'est pas le succès.** Le sujet est le REFUS. Le message
du moteur est rendu tel quel (FE-04), la liste de refus voyage entière (R269/R306), le pop-up
R445 est porté à l'écran. Et en mode démonstration, l'écran affiche **AUCUNE ÉCRITURE** au lieu
d'un faux succès : avant ce lot, la Surveillance annonçait « Qualification enregistrée » alors
que rien n'était parti. C'est ce mensonge-là qui est corrigé.

## Règle tirée de cet épisode

Un audit qui compte des SURFACES produit un chiffre flatteur et faux. On compte désormais des
**actes exécutables** : la garde U2-56 mesure, à chaque exécution des tests, le nombre
d'écritures réelles de `src/ui2` — elle passe de 0 à quelque chose au premier acte câblé, et
le chiffre est affiché plutôt que raconté.

## V2-M41 — l'API vivante, enfin (12.08.2026)

Les quatre lots précédents ont vérifié le contrat d'APPEL par lecture statique du code. Aucun
n'avait tourné contre un moteur qui répond. Ce lot l'a fait : Postgres démarré, tenant de
démonstration semé par les vraies routes (`OLIVE_SEED_DEMO=1 npm run seed:demo`), jeton obtenu
sur `/v1/auth/token` avec un vrai mot de passe, puis **34 lectures interrogées une par une**.

### Ce que l'API vivante a dit, et que la lecture du code ne pouvait pas dire

| Route | Ce que l'écran lisait | Ce que le moteur rend | Effet à l'écran |
|---|---|---|---|
| `/v1/clients` | un tableau | `{ data, next_cursor }` (R281) | **zéro client affiché, sans bandeau maquette** — la requête avait réussi |
| `/v1/onboarding` | `nom`, `depuis`, `apporteur` | `prospectNom`, `etapeDepuis`, *(pas d'apporteur)* | trois colonnes vides |
| `/v1/offboarding` | `reference`, `motif`, `etape` | `id`, `type`, `statut` | colonnes vides **et** « CLOS » affiché pour un dossier `CLOTURE_DEMANDEE` — l'inverse de son état |
| `/v1/bi/annuaire` | `vue`, `domaine`, `colonnes` | `code`, `source`, `dimensions[]`, `mesures[]` | tableau vide |
| `/v1/aml/referentiel` | un tableau de règles | `{ scenarios[], seuils{} }` | tableau vide |
| `/v1/doc-matrix/en-vigueur` | exigences plates + `etat` | `contenu.exigences[structure][porteur].parJuridiction` | **l'écart d'AXE que le PO soupçonnait** — confirmé sur données réelles |
| `/v1/rapports/kpi` | des obligations réglementaires | des indicateurs de conformité (400 sans période) | fausse source (E-V2-7) |
| `/v1/revues/kyc/KYC-2026-00447/delta` | une référence écrite en dur | 404 : ce dossier n'existe pas | seed éternel (E-V2-6) |

Aucune de ces huit lignes n'était visible en mode démonstration : le seed a toujours la forme
que l'écran attend, puisque c'est l'écran qui l'a écrit.

### Ce qui a été livré

- `scripts/verifier-formes-api.mjs` — le vérificateur. Il empaquète les VRAIS seeds des écrans
  par esbuild (export injecté, aucune recopie), appelle le moteur, compare les formes en
  profondeur, et distingue quatre verdicts : conforme · écart assumé par un adaptateur ·
  **réponse vide donc invérifiable** · erreur. Il n'est pas en CI et ne doit pas y aller : il
  exige une API et une base.
- `src/ui2/fixtures-moteur.json` — 16 réponses réelles, capturées par ce script (`--capturer`),
  écrêtées à 3 éléments par tableau pour rester relisibles.
- `src/ui2/moteur-formes.ts` — les adaptateurs, gouvernés par une règle : **le moteur nomme,
  l'écran suit**. Ils traduisent, ils n'inventent pas : là où le moteur n'a pas l'information
  (apporteur d'affaires, état de complétude d'une exigence), le champ reste vide.
- `src/ui2/moteur-formes.test.ts` — FM-00 à FM-06, sur les payloads capturés. Les six
  adaptateurs ont été cassés un par un pour vérifier que les gardes rougissent.

### Les deux choses que ce lot ne prouve toujours pas

1. **Aucune ÉCRITURE n'a été posée contre le moteur vivant.** Les 21 actes câblés aux lots M35
   à M38 ont été vérifiés statiquement (route, verbe, champs), jamais exécutés. Le lot qui
   poserait un acte réel et lirait son événement au journal reste à faire.
2. **Sept familles de données restent invérifiées** parce que le tenant de démonstration ne les
   peuple pas (E-V2-8). Une réponse `[]` ne dit rien de la forme de ses éléments, et le rapport
   le dit ainsi plutôt que de compter un succès.

| Lot | Ce qui a été câblé | Écritures réelles de `src/ui2` |
|---|---|---:|
| V2-M41 | contrat de **RETOUR** : 6 formes de réponse adaptées, 2 fausses sources corrigées, vérificateur + fixtures capturées sur API vivante | *(inchangé)* |

## V2-M42 — la matrice documentaire gagne son axe RÔLE (12.08.2026)

L'arbitrage rendu au lot précédent est **enrichir le contrat**, pas aligner l'écran sur un
moteur incomplet. Le mot « rôle » était déjà dans R26 et dans le scénario S-03 de la spec ; il
n'était nulle part dans le code. Ce lot le met dans le code.

**Ce que le moteur savait, et ce qu'il ne savait pas.** Il croisait type d'entité × juridiction
× *porteur* (entité titulaire / personne liée / compte). Il ne distinguait pas les personnes
entre elles : un bénéficiaire effectif et un simple signataire recevaient la même liste de
pièces. La CDB 20 dit le contraire — formulaire A pour l'ayant droit économique (art. 27),
formulaire K pour le détenteur du contrôle (art. 20), et rien de tout cela pour un signataire,
à qui l'on demande une procuration que l'on ne demande pas à l'UBO.

**Le contrat** — `exigences[typeEntite]` reçoit `parRole: { <role>: [exigences] }`. Les rôles
vivent DANS le bloc du type d'entité : un « Settlor » n'existe que pour un trust, un
« Administrateur » que pour une société — c'est exactement la structure de la v1
(`DOC_STRUCTURES[].roles`), sans en recopier une ligne.

**Ce qui ne bouge pas, et c'est le plus important.** Une version publiée sans `parRole` évalue
au document près comme avant, même si le dossier porte désormais des rôles. C'est R29 : un
dossier validé sous une matrice ne devient pas incomplet parce que le contrat s'est enrichi.
La garde ne compare pas à une valeur écrite à la main — elle compare **les deux évaluations**,
avec et sans rôles, et exige qu'elles soient identiques.

**Un défaut trouvé en chemin, qui n'a rien à voir avec les rôles.** Publier une correction le
jour même de la prise d'effet crée deux versions à la même date — le seed de démonstration
vient d'en produire une. Le tri ne portait que sur la date : « en vigueur » dépendait donc de
l'ordre que la base voulait bien rendre. Un rejeu qui ne rend pas deux fois le même verdict
n'est pas un rejeu (R48). Tri désormais sur `(enVigueurLe desc, version desc)`.

| Vérification | Résultat |
|---|---|
| `docmatrix.spec.ts` | **23/23** (13 avant) — les 10 nouveaux cassés un par un pour vérifier qu'ils rougissent |
| `npm run test:rules` | 144 tests verts, code de sortie 0 |
| e2e (base propre + migrations) | **521/521**, 75 suites |
| front (`vitest run`) | **218/218**, dont FM-07 sur fixture capturée d'une API vivante |
| budget bundle | 306,4 kB gz sous 310 |

**Ce que ce lot ne fait pas.** `evaluerCompletude` n'est appelé que par son propre contrôleur :
le calcul de complétude du dossier KYC ne passe **pas** encore par la matrice. L'axe rôle est
donc juste, disponible et gardé — mais le workflow ne s'en sert pas. C'est le branchement
suivant, et il vaut mieux le dire que le laisser croire.

## V2-M43 — le calendrier réglementaire existe (12.08.2026)

E-V2-7 disait : *« aucune route ne porte ce calendrier — c'est une config gouvernée qui
n'existe pas encore au moteur »*. Elle existe maintenant : R490→R492,
`spec/CALENDRIER-REGLEMENTAIRE-R490-R492.md`.

**Où il vit, et pourquoi pas ailleurs.** Le calendrier est une clé du registre R-Q
(`calendrierReglementaire`), pas une table. Il hérite ainsi, sans une ligne de code, de tout ce
que R125–R128 garantissent déjà : un changement motivé (R7), daté, append-only, jamais
rétroactif, rejouable à date. Une table d'obligations à côté du registre aurait été une seconde
vérité — exactement ce que R125 interdit.

**Ce que le moteur calcule, et ce qu'il refuse de calculer.** Cinq statuts, tous recalculés à
chaque lecture depuis la config à date et le journal : `DEPOSEE`, `SANS_ECHEANCE`, `EN_RETARD`,
`DUE`, `A_VENIR`. Aucun n'est stocké — deux lectures à la même date rendent le même verdict,
c'est ce qui rend l'écran opposable (R48).

Et une chose qu'il ne fait pas : **une obligation sans échéance n'est jamais en retard.** La
communication au MROS est due « sans délai » (LBA art. 9) — il n'y a pas de date. Fabriquer une
échéance pour pouvoir afficher un retard aurait été un jugement juridique que personne n'a
demandé au moteur. L'écran écrit « sans délai » dans la colonne Échéance et pose une pastille
neutre.

**Le dépôt est un acte humain.** Motivé (R7) et **référencé** — l'accusé de dépôt EST la preuve ;
sans lui on consignerait une affirmation. Deux refus, vérifiés contre l'API vivante :

```
POST /v1/reglementaire/obligations/PAS-DECLAREE/depot
  → [R490] obligation « PAS-DECLAREE » absente du calendrier en vigueur
POST /v1/reglementaire/obligations/AEOI-2025/depot   (le second)
  → [R492] dépôt déjà consigné pour AEOI-2025 / 2025 — référence AFC-ACK-88214 (…).
    Un second dépôt est un incident, pas une opération neutre.
```

**Le premier acte d'ÉCRITURE de cette campagne posé contre un moteur vivant.** Les lots M35 à
M42 ont câblé 21 actes et ne les ont jamais exécutés ; l'audit le disait en toutes lettres.
Ce lot pose un dépôt réel et lit son événement au journal :

```
 type                         | aggregate_id | ref           | base
 reglementaire.depot.consigne | RAP-LBA-2025 | DIR-2026-0031 | OBA-FINMA
 reglementaire.depot.consigne | AEOI-2025    | AFC-ACK-88214 | LEAR
```

et la relecture du calendrier bascule `AEOI-2025` de `EN_RETARD` à `DEPOSEE` — la projection
suit le journal, sans qu'aucun statut n'ait été écrit nulle part.

| Vérification | Résultat |
|---|---|
| `reglementaire.wiring.spec.ts` | **12/12** (CR-01..10), dont la garde « le moteur n'a consigné AUCUN dépôt de sa propre initiative » |
| `npm run test:rules` | sortie 0 |
| registre des règles / catalogue d'événements | verts — R490–R492 enregistrés, 2 types schématisés |
| e2e (base propre + migrations) | **521/521** |
| front (`vitest run`) | **218/218** |
| forme écran ↔ moteur (API vivante) | `/v1/reglementaire/calendrier` **conforme** |
| budget bundle | 306,4 kB gz sous 310 |

**Ce qui reste dû, et ne doit pas se perdre.** Le CONTENU du calendrier de démonstration
(quatre obligations, leurs bases, leurs dates) vient de la maquette v1 et **n'a pas été validé
juridiquement** — question Q-CR-1, consignée dans la spec. Trois autres questions y attendent
un arbitrage : la reconduction d'un exercice à l'autre (Q-CR-2, recommandation : pas de
reconduction automatique), le statut du préavis (Q-CR-3), et le rapprochement avec le module
MROS (Q-CR-4, non fait).

## V2-M44 — les 24 actes, exécutés (12.08.2026)

Le lot précédent a posé UN acte réel. Celui-ci les pose TOUS : `verifier-actes-api.mjs` lit les
actes déclarés par les écrans, résout les paramètres de route sur des données vivantes, envoie
le corps construit à partir des `exemple` déclarés, et classe la réponse. Contre une base
JETABLE — jamais la démonstration.

### Le premier passage : cinq 500

Cinq actes sur vingt-quatre ont rendu **500 Internal server error**. Pas un refus : un
plantage. Une cause unique, quatre fois sur cinq :

```
Inconsistent column data: Error creating UUID, invalid character … found `L` at 2
  at XbService.juridictionClient (xb.module.ts:292)
```

Un identifiant venu de la requête — `CLI-00001`, `u-004`, les `exemple` mêmes que les écrans
déclarent — atteint un `where` Prisma sur une colonne UUID, et le driver lève une erreur brute.
La cinquième : `lireCle(obj, undefined)` → `undefined.split(".")`, quand l'appel ne dit pas
quel paramètre modifier.

**Pourquoi c'est un vrai défaut.** L'écran rend le message du moteur VERBATIM (FE-04) : sur un
500 il affiche « Internal server error » — le contraire d'un refus opposable. Et n'importe quel
appelant le déclenche : il suffit de coller une référence d'écran là où le moteur attend une
clé technique.

**La correction, et ce qu'elle ne touche pas.** Un helper minuscule (`common/identifiant.ts`)
qui refuse en NOMMANT l'objet et la valeur reçue. Appelé au point de LECTURE de l'identifiant,
jamais en tête d'acte : la précédence des refus est un comportement contractuel, et une
validation posée trop tôt transformerait « R7 : motif requis » en « identifiant invalide ».
Vérifié : `Demander une dérogation` rend toujours « R7 : une dérogation cross-border exige un
motif », inchangé.

### Ce que l'exécution a trouvé et qu'aucune garde statique ne pouvait voir

L'acte « Modifier un paramètre §CrossBorder » **ne déclarait aucun champ**. Le bouton existait,
le formulaire était vide, le moteur refusait « cle attendue ». AC-03 ne pouvait pas le voir :
elle vérifie que les champs DÉCLARÉS sont lus, jamais que ce que le moteur EXIGE est déclaré.
Les quatre champs du contrat sont désormais déclarés, et **AC-05** garde le cas : un acte POST
dont le contrôleur lit un corps doit déclarer au moins un champ. Une fois câblé, cet acte va
jusqu'au bout de sa garde — il rend `409 R445_CONFIRMATION_REQUISE` avec le pop-up
d'engagement, ancien et nouveau compris. C'est la garde R445 qui fonctionne, prouvée en
l'exécutant.

### Le second passage

| classe | n | lecture |
|---|--:|---|
| ✓ acceptés | 6 | l'acte s'exécute de bout en bout |
| ⊘ refus typés | 2 | R7 motif · R445 engagement — **la garde du moteur fonctionne** |
| ⚠ habilitation | 8 | MROS (R129/R132), visa XB (R294), audit (R284) — comportement, pas défaut |
| ∅ objet absent | 4 | le tenant de démonstration n'a pas de preuve XB, d'assignation, d'item de veille (E-V2-8) |
| ▸ refus de contrat | 4 | 400 typé et lisible sur un identifiant de maquette — c'était les 500 |
| ✗ **défauts** | **0** | |

**Ce que ce balayage ne prouve pas.** Il vérifie que l'acte ARRIVE au moteur et que le moteur
répond quelque chose de sensé — pas que l'effet MÉTIER est le bon. Qu'un hit qualifié se
retrouve dans le bon état, qu'un gel gèle : cela demande un scénario par acte, avec ses
préconditions. C'est la marche suivante, et elle est plus longue que celle-ci.

| Vérification | Résultat |
|---|---|
| balayage d'exécution (API vivante, base jetable) | **0 défaut** sur 24 actes |
| `identifiant.spec.ts` | 5/5 (ID-01..05), négativement testé |
| `actes-contrat.test.ts` | 5/5 — **AC-05** ajoutée, négativement testée |
| `npm run test:rules` | sortie 0 |
| e2e (base propre) | 521/521 |
| front | **219/219** |
| budget bundle | 306,4 kB gz sous 310 |

## V2-M45 — la démonstration raconte enfin les chapitres manquants (12.08.2026)

Deux lots de suite ont buté sur le même mur : sept familles de données que le tenant de
démonstration ne peuple pas. Une réponse `[]` ne prouve rien de la forme de ses éléments
(V2-M41), et un acte sur un objet inexistant ne prouve rien du tout (V2-M44). Ce lot sème ces
chapitres — **par les vraies routes**, jamais d'INSERT direct sur une table de moteur.

Dix chapitres : liste de sanctions et run de screening · signal AML · cas de risque · déplacement
(BT) · catalogue et assignation de formation · source et collecte de veille · pièce GED ingérée.
Idempotence prouvée sur base neuve : le second semis n'écrit rien.

### La leçon de méthode, payée comptant

**Supertest ne lève pas sur un 4xx.** Mes chapitres, enveloppés dans un `try/catch`,
« réussissaient » en n'écrivant rien — le silence exact que ce projet refuse partout ailleurs, et
que j'ai reproduit dans mon propre code. Un helper de trois lignes qui regarde le statut et le
DIT a tout changé :

```
✗ signal AML → 404 "[R340] scénario inconnu : R189"
✗ déplacement → 400 "dateStart et dateEnd requis"
✗ pièce GED → 400 "R137 : canal « undefined » hors registre R-Q"
✗ cas de risque → 400 "R133 : un risk case naît d'au moins un signal"
```

Quatre contrats que j'avais appelés de travers, dont un vrai malentendu : « R189 » est la règle
CITÉE par un scénario AML, pas son identifiant (`SF-01`). Le seed lit désormais le référentiel
plutôt que de coder un identifiant en dur.

### Un troisième 500 de la même famille que V2-M44

`POST /v1/screening/run` **sans `seuil`** : `score >= undefined` est toujours faux — donc ZÉRO
hit, en silence — puis `screeningRun.create` tombait en 500 sur une colonne non nulle. Le seuil
effectif retombe maintenant sur le paramètre **gouverné** `screeningSeuil` (R100, défaut 85) :
celui-là même que l'écran de paramétrage édite. Rien n'est inventé. Garde **SC-00**, et le faux
Prisma de la suite listes modélise désormais la lecture du tenant — un faux qui ne modèle pas ce
que le moteur lit prouve un comportement que la production n'a pas.

### Ce que ce lot NE résout pas, et qu'il faut regarder ensuite

Le screening de démonstration ne produit **aucun hit**, même avec une entrée de liste au nom
exact du client, périmètre de 3 clients, seuil abaissé à 50 (E-V2-12). Pour un moteur de
screening, « 0 hit » est le résultat le plus dangereux qui soit : il ressemble à un dossier
propre. La cause n'est pas identifiée et **ne doit pas être devinée** — elle mérite son propre
lot. J'aurais pu fabriquer un hit en abaissant un seuil : ç'aurait été une démonstration qui
ment.

| Vérification | Résultat |
|---|---|
| seed démo, base neuve | 10 chapitres ✓ · second passage : rien écrit (DM-02) |
| `npm run test:rules` | sortie 0, aucun ✗ |
| e2e (base propre) | **521/521** |
| front | 219/219 |

*(Note d'exécution : un premier passage e2e a montré 1 échec XB-13 — base non recréée, des
connexions ouvertes ayant fait échouer le DROP. Sur base réellement neuve : 521/521. Le
diagnostic est consigné parce qu'un « 520/521 » sans explication vaut moins que rien.)*
