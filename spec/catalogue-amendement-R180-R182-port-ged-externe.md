# Catalogue O-Live — Amendement PROPOSÉ (R180 → R182) · Bloc 38 « L'hébergeur est un choix, la preuve n'en est pas un »

**Statut : RATIFIÉ le 21.07.2026 par Ali Gharsallah.**
Numérotation continue après R179. Famille : **GX** (vérifiée libre). **Le catalogue précède
le code.** Contexte mesuré : le coffre (R144→R146, CV-01..06) prouve DÉJÀ l'essentiel —
empreinte calculée par O-Live avant remise, relecture re-vérifiée à chaque lecture,
isolation par préfixe tenant, purge seulement certifiée, réconciliation. L'objection n°1 en
rendez-vous (« nous avons déjà notre GED ») ne demande pas de nouvelles preuves : elle
demande que ces preuves soient **portables** vers l'hébergeur de la banque.

## R180 — L'hébergeur documentaire est un paramètre tenant DÉCLARÉ — le changer est un acte

Le choix de l'hébergeur (coffre interne, stockage objet suisse, GED de l'établissement) vit
au registre des paramètres (`docStorage` : adaptateur + options), lisible à l'écran en
langage clair. Le service résout le port **par tenant, à chaque opération**. Changer
d'hébergeur = `parametres.ecrire` — motivé, daté, jamais rétroactif ; les écritures déjà
faites restent où elles sont (la migration du stock est un chantier gouverné, pas un effet
de bord).

> **GX-01** clé au registre + résolution par tenant + défaut = coffre interne · **GX-02**
> bascule motivée → les NOUVELLES écritures vont au nouvel hébergeur, l'acte est tracé

## R181 — Tout adaptateur passe LES MÊMES preuves que le coffre interne

Un hébergeur externe n'allège aucun invariant : l'empreinte est calculée **par O-Live**
avant remise, la relecture est **re-vérifiée** à chaque lecture (un contenu altéré chez le
tiers = refus + alerte, comme au coffre interne), l'isolation par préfixe tient, la
restitution réglementaire fonctionne à l'identique. Le contrat se prouve : la suite de
conformité s'exécute **contre l'adaptateur**, pas contre sa documentation. La confiance ne
se délègue pas — elle se vérifie chez le tiers comme chez soi.

> **GX-03** adaptateur externe branché au coffre : altération chez le tiers → refus + alerte
> (mêmes règles, autre hébergeur) · **GX-05** restitution complète via l'externe, identique

## R182 — L'indisponibilité du tiers est un REFUS EXPLICITE et un SIGNAL — jamais une dégradation

Tiers en panne : l'opération échoue **explicitement** (l'erreur dit quoi et chez qui), un
événement signale (tâche d'exploitation), et RIEN ne s'écrit ailleurs « en attendant » —
pas de file cachée, pas de copie de secours hors du port, pas de lecture non vérifiée. La
disponibilité se traite au contrat de service, pas en silence dans le moteur.

> **GX-04** port en panne → erreur explicite + événement `ged.externe.indisponible`,
> aucune écriture de contournement

## Implications techniques
| Point | Conséquence |
|---|---|
| Service | `coffre/storage-resolver.service.ts` : registre d'adaptateurs injecté + `resolve(ctx)` lit `docStorage` du tenant — le coffre ratifié reste INTACT (les preuves GX l'instancient avec le port résolu) |
| Adaptateur | `coffre/ged-externe.adapter.ts` : `StoragePort` au-dessus d'un client tiers déclaré (dépôt PAR CLÉ — contrat d'intégration) ; panne = erreur explicite typée |
| Paramètres | +clé registre `docStorage` (défaut `{ adaptateur: "COFFRE_INTERNE" }`) — questionnaire R-Q |
| Événements | `ged.externe.indisponible` |
| Aucun modèle nouveau | la correspondance clé→document tiers est portée par la clé elle-même (contrat par clé) |

Tests : GX-01..05 (`ged-externe.wiring.spec.ts`), écrits **avant** l'implémentation.

`RATIFIÉ le 21.07.2026 par Ali Gharsallah`
