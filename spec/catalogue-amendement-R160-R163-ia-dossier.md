# Catalogue O-Live — Amendement PROPOSÉ (R160 → R163) · Bloc 31 « L'IA au service du dossier »

**Statut : RATIFIÉ le 20.07.2026 par Ali Gharsallah.**
Numérotation continue après R159. Famille de scénarios : **AI** (vérifiée libre — AG est pris
par la pré-revue, IA porte une occurrence au Word ; la vérification systématique évite sa
troisième collision). **Le catalogue précède le code.** Thèse produit : Fenergo et Appway
*ajoutent* de l'IA à côté de leurs contrôles ; chez O-Live l'IA est **sous** les contrôles —
habilitée comme un employé, tracée comme un acte, désavouable comme une proposition.

## R160 — L'IA n'a pas de droits propres — elle emprunte l'habilitation de qui la convoque

Le contexte servi au modèle passe par le **même filtre** que la recherche (R149/R112/R139) :
documents du type autorisé au rôle du convocateur, `A_CLASSER` réservé aux rôles d'arrivée.
Un CO et un RM qui posent la même question au même dossier **n'obtiennent pas la même
réponse** — parce qu'ils ne voient pas le même dossier. Le tenant est structurel. Ce que le
modèle a reçu est tracé (références et empreinte du contexte — jamais recopié dans la trace).

> **Scénario AI-02 — Deux rôles, deux contextes, deux réponses**
> **Étant donné** un PASSEPORT (RM/CO/CF) et un FISCAL (CF seul) sur le même client
> **Quand** le CF interroge **Alors** le modèle reçoit les DEUX documents
> **Quand** le RM pose la même question **Alors** le modèle ne reçoit QUE le passeport —
> le FISCAL n'existe pas pour son IA non plus **Et** t2 : contexte vide, structurel

## R161 — Toute production IA est un DÉRIVÉ signé — jamais une vérité

Chaque sortie du modèle est enregistrée avec : **modèle, version du modèle, empreinte du
contexte servi, empreinte de la sortie**, auteur-convocateur (jeton), horodatage. C'est un
dérivé (pattern R148) : rejouable, vérifiable, auditable dix ans après — « qu'a dit l'IA,
sur la base de quoi, à qui » — et ça ne fait jamais foi.

> **Scénario AI-03 — La production se vérifie**
> **Quand** l'IA répond **Alors** la production porte (modèle, version, shaContexte,
> shaSortie) et les empreintes se recalculent à l'identique ; même contexte ⇒ même shaContexte

## R162 — L'IA propose, l'humain dispose — et l'écart se mesure sans coercer

Une proposition (classement, extraction, zones de caviardage…) est **tracée avec sa
confiance** et **n'applique rien** : le document ne bouge pas. La décision est un acte
humain (jeton) ; le rejet se motive (R7) et **s'enregistre comme écart mesuré** (R39 : on
apprend de l'IA sans jamais lui obéir). R44 spécialisé au dossier.

> **Scénario AI-04 — La proposition ne touche pas le monde**
> **Quand** l'IA propose un classement (type, confiance) **Alors** proposition tracée, le
> document reste A_CLASSER
> **Scénario AI-05 — La décision est humaine, l'écart est mesuré**
> **Quand** l'humain accepte **Alors** acte tracé (jeton) **Quand** il rejette sans motif
> **Alors** refus (R7) **Quand** motivé **Alors** rejet tracé + écart mesuré UNE fois

## R163 — Le prestataire IA est un PORT au registre — la résidence des données est un paramètre tenant

Pas de port configuré = **refus explicite** (pattern R114 — jamais de réponse simulée). Le
port **déclare sa résidence** ; elle doit correspondre au paramètre tenant `iaResidence`
(défaut `CH`) : un document bancaire suisse ne part pas n'importe où. Le refus de résidence
est tracé — c'est un fait de conformité, pas une erreur technique.

> **Scénario AI-01 — Pas de port, pas de réponse ; mauvaise résidence, refus tracé**
> **Quand** aucun port n'est configuré **Alors** refus R163
> **Quand** le port déclare résidence US et le tenant exige CH **Alors** refus + trace,
> RIEN n'a été servi au modèle

---

## Implications techniques

| Point | Conséquence |
|---|---|
| Modèle | `IaProduction` (tenantId, type `REPONSE\|PROPOSITION`, cible documentId?, question?, modele, versionModele, shaContexte, shaSortie, sortie, confiance?, par, at, decision?, decidePar?, decideAt?, decisionMotif?) — RLS |
| Port | `IaPort = { modele, version, residence, completer(question, contexte[]) }` — injecté, jamais simulé |
| Service | `IaGedService(prisma, audit, ports)` : `interroger` (R160/R161/R163), `proposerClassement` (R162), `decider` (R162), assemblage de contexte par le filtre R112/R139/R149 |
| Paramètres R-Q | **au registre (R125)** : `iaResidence` (string, défaut `CH`) · `iaProviderRef` (référence contractuelle du prestataire, défaut null) |
| Événements | `ia.production` · `ia.proposition` · `ia.decision` · `ia.ecart` · `ia.acces.refuse` (port/résidence) |
| Câblage (documenté, lot dédié) | la pré-revue existante (AG) migrera sur ce port ; suggestions de zones de caviardage (R158) via `proposer*` |

Tests : AI-01..05 + garde tenant (`ia-ged.wiring.spec.ts`), écrits **avant** l'implémentation.

`RATIFIÉ le 20.07.2026 par Ali Gharsallah`
