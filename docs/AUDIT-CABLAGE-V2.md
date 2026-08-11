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

## Règle tirée de cet épisode

Un audit qui compte des SURFACES produit un chiffre flatteur et faux. On compte désormais des
**actes exécutables** : la garde U2-56 mesure, à chaque exécution des tests, le nombre
d'écritures réelles de `src/ui2` — elle passe de 0 à quelque chose au premier acte câblé, et
le chiffre est affiché plutôt que raconté.
