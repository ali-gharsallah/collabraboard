# Catalogue O-Live — Amendement PROPOSÉ (R121 → R124) · Bloc 20 « Agent de pré-revue IA »

**Statut : RATIFIÉ le 19.07.2026 par Ali Gharsallah.**
Numérotation continue après R120. Famille de scénarios : **AG** (vérifiée libre — Word + spec).
**Le catalogue précède le code.** Le prestataire IA est un **port** (doctrine R116/GD-14) :
sans port configuré, la fonction est absente et le dit — jamais simulée.

## Le problème — et pourquoi c'est LE différenciant

R44 pose la doctrine (« l'IA analyse, l'humain décide ») et R116 l'applique à un cas étroit
(classification GED). Mais la promesse commerciale d'O-Live — *un pré-lecteur IA qui prépare
chaque revue KYC* — n'a **aucune règle** : que voit l'IA, que produit-elle, qu'en fait l'humain,
qu'en reste-t-il pour l'inspecteur ? Sans ces quatre réponses, l'agent serait précisément ce que
la FINMA reprocherait : une boîte noire dans le circuit de décision. Quatre règles la mettent
sous discipline — et transforment l'argument marketing en argument d'audit.

---

## R121 — L'agent est un pré-lecteur, jamais un décideur

Sur demande (ou consommation d'un événement de passage en revue), l'agent produit une
**pré-revue structurée** du dossier KYC : points de cohérence, éléments manquants,
contradictions détectées, questions suggérées au réviseur — chaque point typé et rattaché à sa
section. La pré-revue est un **événement** (`ia.prerevue.produite`) : **aucune écriture sur le
dossier**, aucun statut modifié, aucun visa touché (R44, R15). Sans port IA : refus explicite.

> **Scénario AG-01 — L'IA lit, le dossier ne bouge pas**
> **Étant donné** un dossier KYC en revue et un port IA configuré
> **Quand** la pré-revue est demandée
> **Alors** le port reçoit un instantané du dossier et `ia.prerevue.produite` porte des points
> typés (MANQUANT / CONTRADICTION / QUESTION) rattachés aux sections
> **Et** le dossier est STRICTEMENT intact (statut, sections, visas)

> **Scénario AG-02 — Pas de port, pas de fonction**
> **Étant donné** aucun port IA configuré
> **Quand** une pré-revue est demandée
> **Alors** le refus est explicite et AUCUNE trace de pré-revue n'existe

## R122 — La pré-revue est rejouable : qu'a vu l'IA, qu'a-t-elle dit

Chaque pré-revue conserve, **append-only** (R48) : l'empreinte de l'instantané transmis
(sha256), le **modèle et sa version**, la **version du prompt système**, l'horodatage, la sortie
complète, la latence. L'inspecteur rejoue « qu'a vu l'IA, qu'a-t-elle dit, avec quel prompt »
sans reconstruction (R49) — la même exigence que pour un screening (R103).

> **Scénario AG-03 — La trace se relit telle quelle**
> **Étant donné** une pré-revue produite
> **Quand** l'inspecteur la relit
> **Alors** il obtient : empreinte de l'entrée, modèle, version du prompt, sortie intégrale,
> latence — identiques à la production, sans appel au port

## R123 — L'humain dispose : chaque point se traite ou s'écarte

Le réviseur marque chaque point **TRAITÉ** ou **ÉCARTÉ** — l'écart exige un motif (R7 : écarter
sans dire pourquoi, c'est décider en silence). Ces traitements sont tracés (jeton). Le visa
reste dans son circuit inchangé (R13/R15) ; **par défaut la pré-revue n'est jamais bloquante**
(R39). *Paramètre tenant (R-Q)* : `iaPrerevueTraitementRequis` (bool, défaut **false**) — la
banque qui le souhaite peut exiger que tous les points soient traités avant visa : le service
**constate** (points non traités), le moteur KYC appelant **bloque** (même mécanique que la
complétude GED R110).

> **Scénario AG-04 — Écarter se motive**
> **Quand** un point est écarté sans motif **Alors** refus (R7)
> **Quand** il est écarté motivé, ou traité **Alors** le traitement est tracé (jeton, horodatage)

> **Scénario AG-05 — Bloquant seulement si la banque le veut**
> **Étant donné** le défaut (`iaPrerevueTraitementRequis = false`)
> **Alors** `verifierTraitement` répond « rien n'empêche le visa » même avec des points ouverts
> **Étant donné** le paramètre à true et un point non traité
> **Alors** `verifierTraitement` liste les points ouverts — le moteur appelant bloque

## R124 — L'agent ne voit que le nécessaire, le prompt est versionné

L'instantané transmis au port est **minimisé** : le dossier concerné seulement, et les
identifiants nominatifs **pseudonymisés** par défaut (*paramètre tenant* : `iaPseudonymise`,
défaut **true** — le nom réel ne quitte pas O-Live). Le **prompt système** vit dans un registre
versionné append-only : tout changement est un événement — un prompt modifié en silence est une
règle modifiée en silence.

> **Scénario AG-06 — Le nom ne sort pas, le prompt ne change pas en silence**
> **Étant donné** `iaPseudonymise = true` (défaut)
> **Quand** la pré-revue part au port
> **Alors** l'instantané transmis ne contient PAS le nom réel du client (alias stable)
> **Et** tout changement du prompt système crée une version + un événement `ia.prompt.versionne`

---

## Implications techniques

| Point | Conséquence |
|---|---|
| Modèles | `IaPrerevue` (append-only : kycFileId, snapshotSha256, modele, promptVersion, points Json, latenceMs) · `IaPrerevuePoint`-traitements (dans points ou table) · `IaPromptVersion` (numero, texte, par, at — append-only) |
| Service | `PreRevueService(prisma, audit, ports {ia})` : `demander` (R121/R122/R124), `relire` (R122), `traiterPoint` (R123), `verifierTraitement` (R123), `versionnerPrompt` (R124) |
| Port IA | contrat : `prerevue(snapshot, prompt) → { points[], modele }` — adaptateur réel = API Claude **côté serveur** (leçon MVP : la clé ne vit jamais au client) |
| Paramètres R-Q | `iaPrerevueTraitementRequis` (false) · `iaPseudonymise` (true) |
| Événements | `ia.prerevue.produite` · `ia.point.traite` · `ia.point.ecarte` · `ia.prompt.versionne` |
| RLS / append-only | `ia_prerevues` + `ia_prompt_versions` : RLS **et** append-only |
| Liens | déclenchement possible à la consommation de l'événement de passage en revue KYC ; `verifierTraitement` appelé par le moteur KYC avant visa si le tenant l'exige (pattern R110) |

Tests : AG-01..06 (`prerevue.wiring.spec.ts`, faux port IA qui CAPTURE son entrée — c'est lui qui
prouve la pseudonymisation). Écrits **avant** l'implémentation. Réflexe R119 appliqué : les
statuts KYC du faux se copient depuis l'enum réelle (`IN_PROGRESS | UNDER_REVIEW | VALIDATED |
REJECTED`).

`RATIFIÉ le 19.07.2026 par Ali Gharsallah`
