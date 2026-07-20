# Catalogue O-Live — Amendement PROPOSÉ (R140 → R143) · Bloc 25 « Le portail transactionnel — prévenir, pas constater »

**Statut : RATIFIÉ le 20.07.2026 par Ali Gharsallah.**
Numérotation continue après R139. Famille de scénarios : **TX** (vérifiée libre — Word + spec).
**Le catalogue précède le code.**

## Origine réglementaire (vérifiée à la source)

- **FATF, 7e Targeted Update on Virtual Assets (juillet 2026)** : le régulateur attend des
  capacités de *blocage et de gel* — pas des outils qui alertent quand les avoirs ont déjà
  bougé. La direction est la **prévention**, non l'investigation rétrospective. La vitesse et
  les motifs de mouvement (transferts rapides, conversions fiat-crypto) sont eux-mêmes des
  indicateurs — et la classification d'onboarding ne suffit pas quand le comportement
  transactionnel s'en écarte.
- **FINMA Guidance 02/2026 « Digital fraud risks » (09.04.2026)** : constat d'enquête — les
  données KYC ne servent qu'à des contrôles de plausibilité, pas à la surveillance des
  transactions ; les seuils fixes (100-200 kCHF pour des clients « low risk ») remplacent les
  scénarios analytiques et **facilitent fraude et money mules**. Attente : détection
  *proactive, rapide, systématique* — l'identification tardive empêche le blocage effectif.

## Le problème O-Live — la dernière brique manquante de la chaîne AML

Tout existe SAUF le point de passage : le gel art. 10 (R131) expose `verifierTransaction` que
**personne n'appelle** ; le pré-trade (R106) ne couvre que le PMS ; les signaux (R80-82)
constatent APRÈS. Quatre règles créent **LE portail** — un point de passage unique,
pré-exécution, où le golden record et le KYC nourrissent enfin la décision transactionnelle
(l'inverse exact du constat FINMA).

---

## R140 — Aucune transaction ne s'exécute sans verdict du portail

Toute transaction (virement, ordre, conversion) passe par **le portail** AVANT exécution —
contrainte structurelle (pattern R13), pas convention d'appel. Le portail consulte les gardes
enregistrées et rend UN verdict : `PASSE` | `BLOQUE` | `SUSPEND` (revue humaine) — **tracé
avec le détail de chaque garde consultée** (R48/R49 : le verdict se rejoue). Rien ne bouge
avant le verdict : prévention, pas constat.

> **Scénario TX-01 — Le portail décide avant, et motive**
> **Quand** une transaction ordinaire passe **Alors** verdict PASSE, tracé avec les gardes consultées
> **Quand** le gel art. 10 est actif sur le client **Alors** verdict BLOQUE, motif légal porté,
> la garde MROS (R131) identifiée dans la trace — le gel a ENFIN son appelant

## R141 — Les gardes sont un registre — et l'inconnu suspend (fail-secure)

Chaque garde est un **module déclaré au registre** (code, règle liée, sévérité paramétrable
tenant : `BLOQUANT` | `SUSPENSIF` | `INFORMATIF` — R-Q `txGardes`). Le portail les exécute
toutes ; le verdict global = le pire. **Une garde en erreur ou inconnue → SUSPEND** : le
portail échoue vers la sécurité, jamais vers le passage (default-deny transactionnel).

> **Scénario TX-02 — Le pire l'emporte, l'erreur suspend**
> **Quand** deux gardes rendent INFORMATIF et SUSPENSIF **Alors** verdict SUSPEND
> **Quand** une garde LÈVE une exception **Alors** SUSPEND (jamais PASSE), l'erreur tracée

> **Scénario TX-03 — La sévérité est un paramètre tenant**
> **Étant donné** un tenant qui déclasse la garde vélocité en INFORMATIF
> **Quand** elle se déclenche seule **Alors** PASSE + signal informatif tracé (R-Q fait foi)

## R142 — L'écart de comportement est une garde — le KYC nourrit la transaction

La garde **comportement** confronte le profil ONBOARDÉ (golden record : riskLevel, activité
déclarée, volumétrie attendue) au comportement CONSTATÉ : vélocité (n transactions / fenêtre),
montant vs profil (seuils **par profil de risque**, pas un seuil fixe — la réponse au constat
FINMA), motifs virtuels (conversion fiat-crypto rapide, aller-retour). Déclenchement →
`SUSPEND` + **signal AML** (chaîne R80-82) + **tâche de requalification** (R44 : l'humain
décide de reclasser, jamais le système).

> **Scénario TX-04 — Le retail « low risk » qui bouge comme un VASP**
> **Étant donné** un client LOW (volumétrie déclarée 20 kCHF/mois)
> **Quand** 4 conversions crypto de 9 500 CHF passent en 48 h
> **Alors** SUSPEND (vélocité + écart de profil), signal AML émis, tâche de requalification —
> le seuil vient du PROFIL, pas d'un chiffre fixe

## R143 — La suspension est une décision en attente — jamais un purgatoire

Une transaction `SUSPEND` entre en **file de revue** (rôles habilités R-Q `txRevueRoles`,
default-deny mécanique R112). La décision est humaine et motivée (R7) : `LIBERER` | `BLOQUER`
— tracée, rejouable. SLA de revue (`txRevueSlaHeures`) : **alerte une fois** (R39), jamais de
libération automatique. Le motif AML n'est **jamais exposé côté client** (cohérence art. 10a,
R132) — le client voit « en traitement », pas « soupçon ».

> **Scénario TX-05 — La file se décide, motivée, sans fuite**
> **Quand** un rôle non habilité tente la file **Alors** refus tracé
> **Quand** le réviseur LIBÈRE motivé **Alors** exécution possible, décision tracée
> **Et** la vue client ne porte AUCUN motif AML

> **Scénario TX-06 — Le SLA de revue alerte, ne libère pas**
> **Étant donné** une suspension vieille de 30 h (SLA 24)
> **Quand** le tick passe **Alors** alerte UNE fois — la transaction RESTE suspendue

---

## Implications techniques

| Point | Conséquence |
|---|---|
| Modèle | `TxVerdict` (append-only : tenantId, clientId, txRef, payload Json, verdict, gardes Json [{code, severite, resultat, detail}], decidePar/At pour la revue, revueMotif, slaSignale) |
| Service | `TransactionGateService(prisma, audit, gardes[])` : `evaluer` (R140/R141 — exécute le registre, pire verdict, fail-secure), gardes livrées : `gel-mros` (**appelle `MrosService.verifierTransaction` — la boucle R131 se ferme**), `comportement` (R142), `listerRevue`/`decider` (R143), `tickRevue` (R39) |
| Paramètres R-Q | **au registre (R125)** : `txGardes` (json : sévérité par code) · `txRevueRoles` (["CO","MLRO"]) · `txRevueSlaHeures` (24) · `txComportement` (json : fenêtres/multiplicateurs PAR profil) |
| Événements | `tx.verdict` · `tx.suspend` · `tx.revue.decision` · `tx.revue.acces.refuse` · `tx.revue.sla` · `signal.aml.comportement` · `tache.kyc.requalification` |
| RLS / append-only | `tx_verdicts` : RLS **et** append-only (le verdict ne se réécrit pas — la revue est une ligne de décision, pas une édition) |

Tests : TX-01..06 (`transaction-gate.wiring.spec.ts`), écrits **avant** l'implémentation, avec
le VRAI `MrosService` branché comme garde (la chaîne signal → cas → escalade → décision → gel
→ **blocage au portail** prouvée de bout en bout).

`RATIFIÉ le 20.07.2026 par Ali Gharsallah`
