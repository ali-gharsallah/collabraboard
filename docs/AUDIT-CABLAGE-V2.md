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
