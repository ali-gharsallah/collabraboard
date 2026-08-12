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
