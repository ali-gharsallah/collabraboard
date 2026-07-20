# Catalogue O-Live — Amendement PROPOSÉ (R104)

**Statut : RATIFIÉ le 19.07.2026 par Ali Gharsallah.**
Numérotation continue après **R103** (plus haute règle ratifiée). Famille de scénarios : **GR**
(golden record). **Le catalogue précède le code** — ordre normal.

---

## Le problème

La règle métier existe depuis les specs produit v2 (« les données saisies dans le KYC ne mettent à
jour la fiche client QUE si le KYC est validé ») et le modèle de données MOD-01 — mais **sans numéro
de règle ni scénario**. R30-R36 couvrent la propagation *personnes/CoC*, pas KYC→fiche client.

Conséquence dans le code : `KycService.validate` émet `kyc.validated` dans l'outbox, et **rien ne
l'applique**. L'événement est marqué livré sans qu'aucune donnée n'atteigne le golden record. La règle
est émise, jamais appliquée. Un audit R1-R15 l'avait noté : « propagation golden record non
implémentée ».

---

## R104 — Propagation contrôlée au golden record

**Règle.** Les données d'un KYC ne mettent à jour la fiche client (golden record, MOD-70) **que par
consommation de l'événement `kyc.validated`** — jamais par effet de bord de la validation elle-même,
jamais avant validation. La propagation :

- applique un **mapping explicite** (liste fermée de champs KYC → champs client) — jamais de synchro
  silencieuse d'un champ hors liste. La composition du mapping est un **paramètre tenant** (candidat
  R-Q) ; le socle MVP propage `riskLevel`.
- est **idempotente par construction** : rejouer l'événement produit le même état ; aucune écriture ni
  entrée d'audit si aucune valeur ne change (compatible rejeu à date, R48/R49).
- est **tracée** : chaque application effective écrit `CLIENT_UPDATED_FROM_KYC` à l'audit, portant le
  code KYC et les champs modifiés.
- est **scopée tenant** sur chaque lecture et chaque écriture.
- un KYC **rejeté ou non validé ne propage rien** : la fiche client reste inchangée (réversibilité).

*Pourquoi par événement :* invariant n°1 du moteur — rien ne change d'état par effet de bord. La
validation constate ; la projection applique. C'est aussi ce qui rend la propagation rejouable,
observable et découplée (le jour où le Client Master devient un service séparé, seul l'adaptateur
change).

> **Scénario GR-01 — La validation propage, par événement**
> **Étant donné** un KYC validé portant `riskLevel = HIGH` pour un client en `MEDIUM`
> **Quand** l'événement `kyc.validated` est consommé
> **Alors** la fiche client passe à `HIGH`
> **Et** une entrée d'audit `CLIENT_UPDATED_FROM_KYC` est écrite (code KYC + champs modifiés)

> **Scénario GR-02 — Un KYC non validé ne touche pas la fiche**
> **Étant donné** un KYC en cours ou rejeté
> **Quand** un événement `kyc.validated` est consommé pour ce dossier (rejeu erroné, statut retombé)
> **Alors** la fiche client reste inchangée
> **Et** aucune entrée d'audit de propagation n'est écrite

> **Scénario GR-03 — Le rejeu est neutre (idempotence)**
> **Étant donné** un événement `kyc.validated` déjà appliqué
> **Quand** le même événement est consommé une seconde fois
> **Alors** la fiche client est identique à l'état d'après la première application
> **Et** aucune entrée d'audit supplémentaire n'est écrite (R48/R49)

> **Scénario GR-04 — Le mapping est une liste fermée**
> **Étant donné** un KYC validé dont des champs hors mapping diffèrent de la fiche client
> **Quand** l'événement est consommé
> **Alors** seuls les champs du mapping sont propagés
> **Et** les champs hors mapping de la fiche restent strictement inchangés (pas de synchro silencieuse)

---

## Ce que la règle implique, techniquement

| Point | Conséquence |
|---|---|
| Consommateur | `GoldenRecordProjector.handle(ev)` appelé par l'`OutboxWorker` **dans la transaction** du drain, avant `published_at` (at-least-once + handler idempotent = sûr) |
| Mapping | constante `GOLDEN_RECORD_MAPPING` (MVP : `riskLevel`) → à externaliser en paramètre tenant (R-Q) |
| Audit | `CLIENT_UPDATED_FROM_KYC` seulement si diff effectif |
| Isolation | `tenantId` de l'événement filtré sur `kycFile` ET `client` |

Tests exécutables : `GR-01..04` (`golden-record.projector.spec.ts`, harnais faux-Prisma, même style
que `kyc-service.spec.ts`). Écrits **avant** l'implémentation.

---

## Décision

`RATIFIÉ le 19.07.2026 par Ali Gharsallah`
