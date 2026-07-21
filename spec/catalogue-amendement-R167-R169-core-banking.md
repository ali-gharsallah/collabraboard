# Catalogue O-Live — Amendement PROPOSÉ (R167 → R169) · Bloc 33 « Le core banking est un port »

**Statut : RATIFIÉ le 21.07.2026 par Ali Gharsallah.**
Numérotation continue après R166. Famille : **SY** (synchronisation — vérifiée libre).
**Le catalogue précède le code.** Enjeu : sans connexion au core banking (Avaloq, Temenos,
Finnova, ERI Olympic), pas de shortlist en Suisse. La réponse O-Live n'est pas « nous avons
le connecteur X » mais « **le core banking est un port** » — un contrat que NOUS définissons,
dont chaque système devient une implémentation sous contrat (pattern éprouvé : coffre R144,
IA R163). Phase 1 : **lecture seule** — O-Live ne modifie jamais le core.

## R167 — Le core banking est un PORT déclaré — jamais de données simulées

Pas de connecteur configuré = **refus explicite** (pattern R114). Le port **déclare** :
système, version, périmètre (comptes, positions, transactions). La déclaration est tracée à
la connexion ; le périmètre fait foi — demander ce que le port ne déclare pas est un refus,
pas un silence.

> **Scénario SY-01 — Pas de port, pas d'import ; hors périmètre, refus**
> **Quand** aucun port n'est configuré **Alors** refus R167
> **Quand** on demande les POSITIONS à un port qui ne déclare que COMPTES **Alors** refus explicite

## R168 — La synchronisation est un DÉRIVÉ tracé — et O-Live ne modifie JAMAIS le core

Chaque import est un **lot** : source (système+version), horodatage, nombre de lignes,
**empreinte du lot** — rejouable et prouvable (pattern R161). Les données importées sont des
dérivés : la vérité reste le core. Phase 1 lecture seule — il n'existe **aucune voie**
d'écriture vers le core dans le service. La désynchronisation détectée est un fait d'audit
(pattern R147), jamais une réparation silencieuse.

> **Scénario SY-02 — Le lot est signé, le core est intouchable**
> **Quand** un lot de comptes est importé **Alors** événement (source, nb, empreinte du lot)
> et l'empreinte se recalcule **Et** le service n'expose aucune méthode d'écriture vers le port

## R169 — La correspondance est un référentiel tenant versionné — l'inconnu va en QUARANTAINE

Le mapping comptes-core ↔ clients-O-Live est un **paramètre tenant** à date de mise en
vigueur (pattern R29 — le mapping d'hier reste lisible pour rejouer hier). Une ligne dont la
correspondance est **inconnue** ne se rattache jamais par devinette : elle va en
**quarantaine** — tracée, comptée, avec tâche de résolution. Résoudre la quarantaine est un
acte humain (jeton) qui enrichit le mapping.

> **Scénario SY-03 — L'inconnu ne se devine pas**
> **Quand** le lot contient un compte hors mapping **Alors** ligne en QUARANTAINE + tâche —
> les lignes connues passent, rien n'est bloqué (R39)
> **Quand** l'humain résout (jeton) **Alors** mapping enrichi, la ligne sort de quarantaine

---

## Implications techniques

| Point | Conséquence |
|---|---|
| Port | `CoreBankingPort = { systeme, version, perimetre[], lire(type, depuis?) }` — **lecture seule par construction** (le type n'a pas d'écriture) |
| Modèle | `CoreSyncLot` (tenantId, source, type, nbLignes, shaLot, at, par) · `CoreQuarantaine` (tenantId, lotId, ligne json, motif, statut `EN_ATTENTE\|RESOLUE`, resoluPar?, resoluAt?) — RLS ×2 |
| Service | `CoreSyncService(prisma, audit, ports)` : `importerLot` (R167/R168/R169), `resoudreQuarantaine` (R169, acte jeton), `etatSync` |
| Paramètres R-Q | **au registre (R125)** : `coreMapping` (json versionné `[{compteCore, clientId, depuisLe}]`, défaut []) · `coreSystemeRef` (référence contractuelle, défaut null) |
| Événements | `core.sync.lot` · `core.sync.quarantaine` · `core.sync.resolution` · `core.acces.refuse` |
| Adaptateurs à contracter | Avaloq (AMI/ACP), Temenos (T24/Transact API), Finnova (OpenFinnova), ERI (Olympic) — chacun = UNE implémentation du port, hors périmètre du bloc (comme S3/Exoscale au R144) |

Tests : SY-01..05 (`core-sync.wiring.spec.ts`), écrits **avant** l'implémentation.

`RATIFIÉ le 21.07.2026 par Ali Gharsallah`
