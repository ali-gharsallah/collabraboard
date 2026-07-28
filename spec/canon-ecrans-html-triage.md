# O-Live — Canon & TRIAGE des ÉCRANS HTML restants
# Command Center (R289 après mapping) · Écrans IAM/SSO (rendu MOD-30) · Mapping Investigation & Olivia/BI
# Gel confirmé : SWIFT · Legal · BI · Octopulse

**Statut : RATIFIÉ le 2026-07-28 (Ali) — Command Center = R289 · v1 = 7 tuiles vérifiées
(« Charge compliance » retirée, dead-letters DIR consignés comme extensions à ratifier) ·
volet IAM = paramnav + iamguide (ssoparam DIFFÉRÉ jusqu'à ratification de l'extension
MOD-30) · livrable : branche unique PR #46, séquences de commits distinctes.**

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
- **0e Mapping Investigation / Olivia-BI : VÉRIFIÉ SUR PIÈCE (2026-07-28)** — la maquette
  a été FOURNIE par Ali et commitée (`demo/olive-demo.html`, 3,4 Mo, 81 items de nav).
  Verdict du diff élément-par-élément :
  · **AML Investigation (`aml`) ⊆ AW-01..08 : CONFIRMÉ** — onglets maquette inbox/
    scenarios/dashboard + Screening Intelligence Layer ↔ nos AW signaux/cases/screening/
    reporting + écrans alertes/amlref ; la sémantique CLEARED/ESCALATED vit dans la
    qualification screening + risk cases. Sous-ensemble tenu.
  · **Investigation financière (`invest`) : ÉCRAN DISTINCT, PARTIELLEMENT couvert** — le
    cœur (« un cas = ≥2 alertes reliées au même client ») EST notre corrélation CPSI
    case_proposal (R252) + risk cases (R133-136). TROIS ÉLÉMENTS NON COUVERTS, listés,
    jamais implémentés en silence : (1) vue 360 agrégée PAR CAS (AUM par segment,
    corridors transactionnels, millésimes KYC) ; (2) « Synthèse IA du cas » (serait une
    proposition Olivia R255 câblée aux risk cases — non câblée) ; (3) export CSV du
    portefeuille de cas. = extensions à canon si souhaitées.
  · **Olivia (AI Core) (`olivia`) ⊆ R253-R258 : CONFIRMÉ** — console Q&A par client +
    question générale + charte système visible ↔ conversation R253-257, scope R256,
    agents versionnés R259 (lecture) ; les 8 questions pré-formatées = UX, pas une règle.
  · **Dashboard Exécutif (`execdash`) ↔ R289 Command Center : MAPPÉ** (livré ce jour).
  · **Octopulse (`opprisk`) : DÉFINITION TROUVÉE SUR PIÈCE** — connecteur vers une
    plateforme EXTERNE de risque opérationnel « Octopulse OppRisk » (config url + apiKey,
    état de connexion, synchronisation manuelle des incidents, audit du paramétrage).
    C'est un PORT (pattern R167/R177). **Triage RATIFIÉ (Ali, 2026-07-28) : catégorie C**
    — gelé, déclencheur « connecteur réel signé + bloc spec » (même famille que SWIFT).
  · **Inventaire complet** : la nav maquette porte aussi des items HORS périmètre de ce
    canon (prospection, crossborder, txrisk, fx, mobile, custody, compliance-center,
    regwatch, apidoc, integrations, wfdesigner/wfengine, sbowner, wfaudit, auditit,
    editorconsole…) — consignés au DECALAGE, à trier dans un canon ultérieur si souhaité.
- **0f Gel (catégorie C) mis à jour** dans DECALAGE-FRONT-DEMO.md ; **Octopulse TRIÉ
  (2026-07-28, sur pièce + ratification Ali)** — catégorie C, voir 0e.
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
spec. BI : demande client — ne JAMAIS re-créer en BI ce que R289 sert. **Octopulse OppRisk :
TRIÉ (2026-07-28) — connecteur externe de risque opérationnel (port), catégorie C : gelé,
déclencheur connecteur réel signé + bloc spec.**

# INTERDITS : nouvelle règle hors R289 ; endpoint créé sans signalement ; secret en
# clair ; action depuis le Command Center ; élément de maquette non mappé implémenté ;
# tout code SWIFT/Legal/BI/Octopulse ; code avant test.
