# Catalogue O-Live — Amendement PROPOSÉ (R105 → R108) · Bloc 17 « PMS — mandats & adéquation »

**Statut : RATIFIÉ le 19.07.2026 par Ali Gharsallah.**
Numérotation continue après **R104**. Famille de scénarios : **PF** (portefeuille — `PM` est prise
par le post-marché CPSI). **Le catalogue précède le code** — ordre normal.

## Le problème

La démo expose un PMS (mandats, positions, allocation vs cible, breaches, profil LSFin) **sans
aucune règle au catalogue** : les comportements ne sont ni numérotés, ni testables, ni rattachés
aux invariants. Et le lien réglementaire le plus important — *le profil de risque KYC borne le
mandat* — n'existe nulle part, alors que R104 rend justement `riskLevel` disponible au golden
record. Quatre règles ferment ce trou.

---

## R105 — Le portefeuille reflète le mandat, l'écart se constate

Chaque portefeuille est adossé à un **mandat** : stratégie d'allocation cible par classe d'actifs
(bornes min/max), profil de risque du mandat, restrictions. L'écart entre allocation réelle et
cible est **calculé et tracé** à chaque valorisation ; un dépassement de borne crée un événement
`pms.drift.detecte` et une **tâche de régularisation** — jamais un rééquilibrage automatique :
l'arbitrage est un acte de gestion humain (même doctrine que R44).
*Paramètre tenant (R-Q)* : `Tenant.settings.pmsDriftToleranceBp` (int, défaut 200 bp) — tolérance
avant qu'un écart devienne un drift.

> **Scénario PF-01 — L'écart se constate, il ne se corrige pas tout seul**
> **Étant donné** un mandat Équilibré (actions 40-60 %) et un portefeuille monté à 68 % d'actions
> **Quand** la valorisation est enregistrée
> **Alors** un événement `pms.drift.detecte` est émis (classe, réel, borne, écart)
> **Et** une tâche de régularisation est créée pour le gérant
> **Et** aucune position n'est modifiée par le système

## R106 — Contrôle pre-trade : les restrictions du mandat bloquent

Avant tout ordre, l'intention est confrontée aux **restrictions du mandat** : instruments interdits
(exclusions ESG, mandat islamique, listes internes), **concentration maximale par position**
(`maxPositionPct`), classes hors stratégie. Une violation **bloque l'ordre** avec motif explicite
(même statut qu'un blocage R13 : contrainte réglementaire, pas un SLA R39) et trace l'événement
`pms.pretrade.bloque`. Un passage est tracé aussi (`pms.pretrade.ok`) — l'absence de blocage doit
se prouver (même esprit que R103).

> **Scénario PF-02 — L'instrument exclu ne passe pas**
> **Étant donné** un mandat excluant le secteur « armement »
> **Quand** un ordre d'achat sur un titre de ce secteur est soumis au contrôle
> **Alors** le verdict est BLOQUÉ avec le motif « exclusion mandat : armement »
> **Et** l'événement `pms.pretrade.bloque` porte l'instrument, la règle et le mandat

> **Scénario PF-03 — La concentration se contrôle avant, pas après**
> **Étant donné** `maxPositionPct = 10 %` et une position qui atteindrait 14 % après l'ordre
> **Quand** l'ordre est contrôlé
> **Alors** il est BLOQUÉ avec le calcul (position résultante vs plafond)
> **Et** un ordre ramenant la position sous le plafond PASSE, avec trace `pms.pretrade.ok`

## R107 — Adéquation LSFin : le profil KYC borne le mandat

Le profil de risque du **client** (golden record — alimenté par KYC validé, R104) **borne** le
profil du mandat : un client `LOW` ne peut porter un mandat agressif. À chaque changement de
`riskLevel` client (donc à chaque consommation `kyc.validated`) ou de mandat, l'adéquation est
réévaluée : une inadéquation émet `pms.suitability.alerte` + une tâche de revue — **le mandat
n'est jamais rétrogradé automatiquement** (décision humaine tracée, cohérence R33/R44).

> **Scénario PF-04 — Le KYC validé resserre le mandat, l'humain décide**
> **Étant donné** un client MEDIUM porteur d'un mandat Croissance (exige ≥ MEDIUM)
> **Quand** un KYC validé fait passer le client à LOW (propagation R104)
> **Alors** `pms.suitability.alerte` est émise et une tâche de revue du mandat est créée
> **Et** le mandat reste Croissance tant qu'aucune décision humaine tracée n'est prise

> **Scénario PF-05 — L'adéquation à la souscription**
> **Étant donné** un client LOW
> **Quand** on tente de lui attacher un mandat exigeant ≥ HIGH
> **Alors** l'attachement est refusé avec motif d'inadéquation LSFin

## R108 — Breach post-trade : mesuré, tracé, régularisé sous délai paramétrable

Tout breach passif (drift R105 non résolu, position devenue non conforme par variation de marché,
downgrade d'un émetteur) ouvre un **registre de breaches** append-only : détection, cause,
régularisation attendue sous `Tenant.settings.pmsBreachDelaiJours` (int, défaut 30). Le délai
échu **alerte et escalade** (gérant → responsable des mandats), il ne liquide jamais (R39 : le
système mesure et notifie). La clôture d'un breach exige un motif (R7) et un auteur nommé (jeton).

> **Scénario PF-06 — Le breach vit dans un registre, pas dans une boucle silencieuse**
> **Étant donné** un drift détecté (PF-01) non résolu
> **Quand** le délai paramétré est écoulé (tick)
> **Alors** une alerte d'escalade est émise UNE fois, le breach reste OUVERT
> **Et** la clôture exige motif + auteur, et s'inscrit au registre (append-only, R48)

---

## Ce que ces règles impliquent, techniquement

| Point | Conséquence |
|---|---|
| Modèles | `Mandate` (stratégie JSON bornes/exclusions/maxPositionPct/profilRequis), `Position`, `PmsBreach` (registre append-only) |
| Service | `PmsService` : `valoriser` (R105), `preTrade` (R106), `verifierAdequation` (R107), `tickBreaches`/`cloreBreach` (R108) |
| Lien R104 | le projector golden-record déclenche `verifierAdequation` à chaque `kyc.validated` consommé |
| Paramètres R-Q | `pmsDriftToleranceBp` (200) · `pmsBreachDelaiJours` (30) — `Tenant.settings` |
| Événements | `pms.drift.detecte` · `pms.pretrade.ok/bloque` · `pms.suitability.alerte` · `pms.breach.escalade` · `pms.breach.clos` |

Tests exécutables : `PF-01..06` (`pms.wiring.spec.ts`, faux-Prisma, style maison). Écrits **avant**
l'implémentation.

`RATIFIÉ le 19.07.2026 par Ali Gharsallah`
