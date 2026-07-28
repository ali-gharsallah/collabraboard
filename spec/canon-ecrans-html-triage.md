# O-Live — Canon & TRIAGE des ÉCRANS HTML restants
# Command Center (R289 après mapping) · Écrans IAM/SSO (rendu MOD-30) · Mapping Investigation & Olivia/BI
# Gel confirmé : SWIFT · Legal · BI · Octopulse

**Statut : PROPOSÉ — étape 0 EXÉCUTÉE (2026-07-28), STOP en cours : ratification des
mappings et arbitrages ci-dessous par Ali.**

## VERDICT ÉTAPE 0 (exécutée sur le repo réel)

- **0a Numérotation : R288 EN COLLISION** ✗ — R288 a été pris LE JOUR MÊME (barèmes de
  scoring gouvernés, ratifié « tel quel » et livré, BS-07..09 verts). **Mapping proposé :
  Command Center = R289** (vérifié libre).
- **0b Familles : DC libre ✓ · IM libre ✓.** Nota : le canon cite « AU-05 » (cumul
  SO/ADMIN) — la famille AU est mappée SO depuis le canon SO+transport (ratifié) :
  se lit **SO-05**.
- **0c Sources des tuiles Command Center (vérifiées route par route)** :
  | Tuile | Verdict | Source réelle |
  |---|---|---|
  | Pipeline onboarding | ✓ | `GET /v1/onboarding` (« stock du pipeline pour le dashboard exécutif ») + funnel |
  | Charge compliance | ✗ **RETIRÉE v1** | `GET /v1/kyc/visas/pending` ne sert que LE rôle de l'appelant (HO-05) — aucun agrégat « visas par rôle » ratifié ; `/v1/tasks` : DIR hors `taskVisibiliteRoles` par défaut (périmètre propre). Agrégat backend = EXTENSION à ratifier |
  | Risque | ✓ | `GET /v1/cpsi/segmentation` (bandes) · `volumetrie` (PC-13) · `alerts` (CP-12) · `case-proposals` (lecture PC-09) |
  | AML & cases | ✓ | `GET /v1/cpsi/alerts` (scorées) · `GET /v1/riskcases` (états + etatDepuis — l'« âge » est un TRI d'affichage sur donnée servie, pas un chiffre front) |
  | SLA réglementaires | ✓ | `GET /v1/reviews/deadlines` (enRetard SERVI, DIR voit-tout) · `GET /v1/coc/reporting` · `GET /v1/cpsi/reporting/sla` (PC-18) |
  | Clôtures | ✓ | `GET /v1/offboarding` (+ obstacles au détail R269) |
  | Santé plateforme | ⚠ **AMPUTÉE v1** | `GET /v1/cpsi/health` ✓ · `GET /v1/olivia/runs/agregat` ✓ (R266) — MAIS `GET /v1/events/sante` (dead-letters) est T9 = ADMIN/SO : servir DIR = modifier la matrice T9 ratifiée → EXTENSION à ratifier ; composant dead-letters RETIRÉ v1 |
  | Olivia | ✓ | `GET /v1/olivia/proposals` (PENDING par type ; ADMIN refusé, DIR servi) · `runs/agregat` (taux) |
  Lecture **DC-03 proposée** : `command_seuils` (clé R-Q) COLORE côté écran ; la
  NOTIFICATION s'appuie sur les notifications DÉJÀ ratifiées des modules
  (transport.deadletter R286, tache.review.escalade R274, cpsi.sla.depassement R281) —
  aucun mécanisme de notification nouveau.
- **0d Endpoints MOD-30 (paramnav / ssoparam / iamguide)** :
  - `paramnav` : **COUVERT** — `/v1/admin/users` (list, create, :id/active, :id/role,
    :id/reset-mfa, garde ADMIN) + garde cumul SO/ADMIN (SO-05, R284) + refus « dernier
    ADMIN » (à vérifier au build : sinon garde-fou backend à ajouter = signalé).
  - `ssoparam` : **4 MANQUANTS** = extension MOD-30 à ratifier — (1) config OIDC en
    ÉCRITURE (issuer/audience vivent en config service, pas en paramètre tenant),
    (2) test de connexion dry-run tracé, (3) rotation JWKS COMMANDÉE (le trousseau
    tourne, aucune route ne déclenche), (4) bascule de mode d'auth tenant (versionnée à
    date R68, four-eyes R13, `sso_bascule_coupe_sessions`). Pas de création silencieuse.
  - `iamguide` : aucune route « règles IAM + matrice effective » — route LECTURE SEULE
    à créer (pattern `GET /v1/cpsi/rules`) = signalée ici.
- **0e Mapping Investigation / Olivia-BI : LA MAQUETTE N'EST PAS DANS LE REPO.**
  `demo/olive-demo.html` n'a JAMAIS été commitée (le DECALAGE du 27.07 la lisait en
  local). Le diff élément-par-élément est IMPOSSIBLE sur pièce ; seul l'inventaire
  secondaire (DECALAGE-FRONT-DEMO.md, ~73 écrans) est disponible. **Écart : fournir le
  fichier pour la vérification fine** — d'ici là, le mapping « Investigation ⊆ AW-01..08 »
  et « Olivia/BI ⊆ R253-R258 + R267-agrégat » est ACTÉ SUR L'INVENTAIRE, pas sur pièce.
- **0f Gel (catégorie C) mis à jour** dans DECALAGE-FRONT-DEMO.md ; **Octopulse NON
  TRIÉ** — objet inconnu de toute spec ratifiée : définition d'une ligne requise d'Ali.
- **Livrable « 3 PRs »** → précédent ratifié 2× : branche unique PR #46, trois
  séquences de commits — sauf contre-ordre.

---

# TEXTE DU CANON (tel que proposé — R288 se lit R289, AU-05 se lit SO-05)

## R289 — Le Command Center est une PROJECTION de pilotage — lecture seule, sources ratifiées, drill vers l'opérationnel
Même nature que Home : une PROJECTION, aucun module. Home = poste du contributeur ;
Command Center = poste de pilotage Direction/CEO/Head PB (« où en est LA BANQUE » —
rôle DIR, lecture tenant entier). Aucun état propre, aucun endpoint de calcul dédié,
aucun chiffre front. Chaque indicateur est cliquable vers l'écran opérationnel qui le
justifie — le Command Center ORIENTE, il n'agit jamais (aucune action, pas même un
STOP). Composition héritée de R253 : module inactif = tuile absente (LC-01) ; panne =
« indisponible », jamais zéro (HO-04) ; aucun non-GET (HO-08) ; squelettes
indépendants. `command_seuils` (R-Q) colore ambre/rouge — ne bloque jamais (R39).

> **DC-01** — Direction-only : un CO ouvre /command → 403 ; aucun endpoint nouveau.
> **DC-02** — Chaque chiffre a sa preuve : le drill liste EXACTEMENT le compte affiché.
> **DC-03** — Le seuil colore (command_seuils) ; les notifications sont celles des
> modules ratifiés — rien ne bloque.
> **DC-04** — Panne ≠ zéro, inactif ≠ vide (HO-04/LC-01 re-passés ici).
> **DC-05** — Le Command Center n'agit pas : aucune requête non-GET sur une session
> complète (HO-08 étendu).

## Écrans IAM/SSO — RENDU de MOD-30 (aucune nouvelle règle)
`paramnav` (utilisateurs & rôles — garde-fous RENDUS : cumul SO/ADMIN SO-05, dernier
ADMIN), `ssoparam` (fournisseur d'identité — SOUS RÉSERVE de l'extension MOD-30 0d),
`iamguide` (lecture seule + export, pattern cpsiguide). Toute modification IAM = trail
+ motif R7 ; bascule de mode versionnée à date (R68) + four-eyes (R13).

> **IM-01** — Le secret ne descend jamais (« configuré », jamais la valeur).
> **IM-02** — Les garde-fous sont rendus, pas inventés (refus backend affichés tels quels).
> **IM-03** — Le test de connexion est un dry-run tracé.
> **IM-04** — La bascule de mode est à deux regards et à date (sessions grandfathérées,
> `sso_bascule_coupe_sessions` défaut faux).
> **IM-05** — iamguide est l'export d'audit : lecture seule stricte, matrice datée.

## Catégorie B — mapping (voir 0e : acté sur inventaire, vérification fine sur pièce dès la maquette fournie)
Investigation → AML Workspace (AW-01..08). Olivia/BI (part Olivia) → R253-R258 +
R267-agrégat ; la part analytics au-delà = BI général → catégorie C.

## Catégorie C — GEL confirmé
SWIFT (`swiftlab`) : connecteur réel signé + bloc spec. Legal : client pilote + bloc
spec. BI : demande client — ne JAMAIS re-créer en BI ce que R289 sert. **Octopulse :
non trié — définition d'Ali requise.**

# INTERDITS : nouvelle règle hors R289 ; endpoint créé sans signalement ; secret en
# clair ; action depuis le Command Center ; élément de maquette non mappé implémenté ;
# tout code SWIFT/Legal/BI/Octopulse ; code avant test.
