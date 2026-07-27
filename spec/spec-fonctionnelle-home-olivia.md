# O-Live — Spécification fonctionnelle détaillée
# Écran HOME (principe, sans R-number) · Module OLIVIA — AI Core (R253–R256)

**Statut : NUMÉROTATION RATIFIÉE (Ali, 2026-07-27) — v1 = R253–R257 · v1.1 = R258 · v2 = R259–R266.**
Étape 0 exécutée : R253+ vérifié libre ; familles **HO** (HO-01..08) et **OL** (OL-01..22) vérifiées
libres. Décision Ali : l'écran **Home n'a PAS de numéro de règle propre** (pattern écrans vagues 1-9) ;
les 5 règles Olivia ex-R254–R258 deviennent **R253 (port) · R254 (propositions) · R255 (contexte) ·
R256 (citations) · R257 (journal)** — cohérent avec `spec-olivia-v1.1-comportement-v2-agents.md`.
**Compatibilité v2 (B.2 de la spec v1.1/v2) vérifiée** : `olivia_messages` (référencée par
`olivia_runs.livrable_message_id`) et `olivia_proposals` (cible unique de `PROPOSE`) sont définies ici —
mêmes tables, mêmes conventions (tenant_id+RLS, trigger `audit_immutable`, chaînage de hachage). ✅

⚠ **ÉCARTS SIGNALÉS (étape 0, 2026-07-27 — à arbitrer avant de coder les points touchés)** :
1. **Rôles hors enum ratifiée** (`RM ARM CO CO_SR MLRO CF BRM DIR ADMIN`) : la spec cite **SO**
   (audit/santé/T9/mode audit), **Head PB**, **CEO** — inexistants. Mappables sans nouvelle règle :
   Direction/Head PB/CEO → **DIR**, Central File → **CF**. **SO → AUCUN équivalent** : v1 se code
   avec ADMIN là où la spec dit « ADMIN, SO », et **SO reste un rôle à ratifier** (consigné ECARTS).
2. **Tuiles Home sans endpoint réel** — la spec affirme « endpoints existants » + « zéro endpoint
   nouveau », or : T1 (`GET /v1/kyc` liste) **n'existe pas** (seul `GET /v1/kyc/:code`) ; T2
   (`GET /v1/kyc/visas/pending`) **n'existe pas** ; T7 (« endpoint account review ») **n'existe pas**
   en tant que tel ; T8 (`GET` liste CoC) **n'existe pas** (seul `POST /personnes/:id/coc`).
   **ARBITRAGE ALI (2026-07-27) : critère A.7.2 « zéro endpoint nouveau » AMENDÉ ET RATIFIÉ** —
   les portes de LECTURE minces manquantes peuvent être ajoutées. Fait : T1 (`GET /v1/kyc`,
   périmètre serveur via `Client.rmUserId`) et T2 (`GET /v1/kyc/visas/pending`) livrées + e2e
   HO-01/03/05/06. **T7/T8 restent bloquées par les DONNÉES, pas par une route** : aucun modèle
   ratifié d'échéance de review (T7) ni de cycle de vie « ouvert/traité » / matérialité CoC (T8 —
   le CoC vit en événements sans statut). Les débloquer = canon nouveau à ratifier, pas une porte.
   HO-02 (licence R177 par module) : PARTIEL — visibilité v1 par RÔLE ; la licence n'est pas
   surfacée au front (écart consigné).
Conventions héritées : tenant_id UUID + RLS sur toute table · append-only par trigger
`audit_immutable()` (pattern `kyc_question_history`) · événements outbox `domain_events` ·
erreurs typées `{code, http, message}` · tout paramètre « ça dépend de la banque » au
questionnaire R-Q · IA propose / humain décide (R44) · rejeu à date (R48/R49).

---
---

# PARTIE A — ÉCRAN HOME (principe, sans R-number)

## A.1 Règle

**PRINCIPE HOME (sans numéro de règle propre — décision Ali 2026-07-27, pattern écrans vagues 1-9 ; les invariants sont portés par HO-01..08) — L'accueil est une PROJECTION par rôle — jamais un module.**
`home` n'a aucun état propre, aucune table, aucune règle métier, aucun endpoint dédié de
calcul. Il compose en lecture seule des endpoints **existants**, dans le périmètre exact
du rôle (RBAC + RLS). Chaque chiffre affiché est cliquable vers l'écran source qui le
justifie. Module non licencié/inactif pour le tenant (R177–R179) → la tuile n'existe pas
(ni tuile vide, ni zéro simulé — pattern R167).

## A.2 Composition de l'écran — inventaire exhaustif des tuiles

L'écran est une grille de tuiles. Chaque tuile déclare : source (endpoint existant),
visibilité (rôles), condition d'activation (module), cible de clic.

| # | Tuile | Contenu | Endpoint source (existant) | Rôles | Module requis | Clic → |
|---|---|---|---|---|---|---|
| T1 | Mes dossiers KYC | compteurs par statut (DRAFT / IN_PROGRESS / UNDER_REVIEW / PENDING_APPROVAL) | `GET /api/v1/kyc?statut=…` (scopé rôle) | tous | KYC | liste KYC filtrée |
| T2 | Visas en attente de MOI | nb de visas PENDING dont `requiredRole` = rôle courant, sur dossiers visibles | `GET /api/v1/kyc/visas/pending` | tous | KYC | dossier concerné, section ancrée |
| T3 | Tâches ouvertes | nb + 5 plus anciennes (titre, âge, dossier) | endpoint tâches existant | tous | socle | écran Tâches |
| T4 | Alertes AML scorées | nb d'alertes ≥ seuil X (R80) non rattachées, par sévérité | endpoint signaux scorés (porte CPSI) | CO, CO_SR, BRM, Direction | CPSI+AML | AML → Signaux scorés |
| T5 | Risk cases | nb par état (NOUVELLE / EN_ANALYSE / CLARIFICATION) + plus ancien en attente | endpoint riskcases R133–R136 | CO, CO_SR, Direction | AML | Risk case manager |
| T6 | Propositions CPSI en attente | nb d'aiguillages proposés (durcissement EDD / allègement) non décidés | endpoint propositions (R66/R69) | CO_SR, BRM, Direction | CPSI | écran propositions |
| T7 | Reviews à échéance | account reviews dues sous 30 j (paramètre `home_horizon_reviews_jours`) | endpoint account review | RM, ARM, CO | Account Review | écran Review |
| T8 | CoC non traités | changements de circonstances ouverts, dont matérialité Haute en rouge | endpoint CoC | RM, CO | CoC | écran CoC |
| T9 | Santé de la porte CPSI | dernier rejeu (durée, nb événements), version config en vigueur (R68) | endpoint santé porte (R250) | ADMIN, SO | CPSI | écran cpsiparam |
| T10 | Olivia | raccourci conversation + nb propositions Olivia en attente | `GET /api/v1/olivia/proposals?statut=PENDING` | selon §B | Olivia | écran Olivia |

Ordre d'affichage : T2 (action personnelle) toujours en premier, puis par volume
décroissant. Grille figée par rôle (pas de personnalisation en v1 — dégelable post-pilote).

## A.3 Matrice de visibilité (application des règles existantes, aucune nouvelle)

| Rôle | Périmètre des compteurs |
|---|---|
| RM / ARM | ses clients uniquement |
| CO / CO_SR / Central File | tout le tenant |
| BRM | tout le tenant, tuiles risque uniquement (T4, T5, T6) + T2/T3 |
| Direction / Head PB / CEO | tout le tenant, lecture |
| SO / ADMIN | T3, T9 uniquement (pas de données client) |

Le front n'implémente **aucun** filtrage : il appelle les endpoints, qui appliquent
RBAC+RLS. Un compteur du RM et du CO diffèrent parce que le **backend** répond
différemment (HO-01 le prouve).

## A.4 États de l'écran

- **Chargement** : squelettes par tuile, indépendants (une tuile lente ne bloque pas
  les autres).
- **Erreur d'une source** : la tuile affiche « indisponible » typé + bouton réessayer —
  jamais un zéro (un zéro est une donnée, l'indisponibilité est un état). Les autres
  tuiles vivent.
- **Module inactif** : tuile absente du DOM (pas masquée — absente).
- **Vide réel** (0 dossier, 0 tâche) : « Aucun élément » + lien vers l'action de
  création si le rôle y a droit.

## A.5 Paramètres tenant (questionnaire R-Q)

| Paramètre | Défaut | Usage |
|---|---|---|
| `home_horizon_reviews_jours` | 30 | fenêtre T7 |
| `home_seuil_age_tache_jours` | 14 | au-delà, tâche marquée « ancienne » (ambre) dans T3 |

## A.6 Scénarios HO-01..HO-08

> **HO-01 — La projection respecte le rôle**
> **Étant donné** RM1 avec 3 clients, CO1 voyant le tenant, 10 dossiers KYC au total
> dont 3 de RM1 **Quand** chacun ouvre l'accueil
> **Alors** T1 de RM1 compte sur 3 dossiers, T1 de CO1 sur 10
> **Et** aucun appel réseau de RM1 ne retourne un objet hors de ses 3 clients

> **HO-02 — Pas de module, pas de tuile**
> **Étant donné** un tenant sans licence CPSI (R177)
> **Quand** un CO ouvre l'accueil **Alors** T4, T6, T9 sont absentes du DOM
> **Et** aucun appel vers la porte CPSI n'est émis

> **HO-03 — Le chiffre est cliquable et cohérent**
> **Quand** CO1 clique le compteur « UNDER_REVIEW : 4 » de T1
> **Alors** la liste KYC s'ouvre filtrée UNDER_REVIEW **Et** contient exactement 4 lignes

> **HO-04 — Une source en panne n'est pas un zéro**
> **Étant donné** l'endpoint riskcases en erreur 500
> **Quand** CO1 ouvre l'accueil **Alors** T5 affiche « indisponible » (pas 0)
> **Et** T1..T3 affichent leurs valeurs normales

> **HO-05 — Visas : c'est MON rôle qui compte**
> **Étant donné** un dossier avec visa PENDING requiredRole=CO et un visa
> PENDING requiredRole=BRM **Quand** CO1 ouvre l'accueil
> **Alors** T2 compte 1 (le sien), pas 2

> **HO-06 — SO/ADMIN ne voient aucune donnée client**
> **Quand** ADMIN ouvre l'accueil **Alors** seules T3 et T9 existent
> **Et** aucun appel vers les endpoints KYC/AML/clients n'est émis

> **HO-07 — La tuile CoC hiérarchise la matérialité**
> **Étant donné** 2 CoC ouverts dont 1 de matérialité Haute
> **Quand** RM1 ouvre l'accueil **Alors** T8 affiche « 2 dont 1 haute » (haute en rouge)

> **HO-08 — Home n'écrit jamais**
> **Quand** l'accueil est chargé et parcouru **Alors** aucune requête non-GET n'est émise
> (vérifié en e2e par interception réseau)

## A.7 Critères d'acceptation Home

1. HO-01..08 verts (e2e Postgres réel, deux rôles minimum par scénario de visibilité).
2. ~~Zéro endpoint nouveau côté backend~~ **AMENDÉ (Ali, 2026-07-27)** : portes de LECTURE minces autorisées (T1/T2 livrées) ; aucun endpoint d'écriture, aucun agrégat serveur nouveau.
3. Zéro agrégat calculé côté front (les compteurs viennent des réponses API telles quelles).

---
---

# PARTIE B — MODULE OLIVIA (AI Core) — R253 → R257

## B.0 Vue d'ensemble

Olivia est l'assistant IA transversal d'O-Live. Périmètre v1 (pilote) — 4 capacités,
toutes en lecture+proposition, aucune en action :

| Capacité | Entrée | Sortie | Règles |
|---|---|---|---|
| C1 — Question sur un dossier | question libre + dossier courant | réponse sourcée | R255, R256 |
| C2 — Synthèse de dossier KYC | dossier KYC | synthèse structurée sourcée | R255, R256 |
| C3 — Pré-analyse d'alerte/risk case | alerte scorée ou risk case | analyse + proposition de qualification | R254, R256 |
| C4 — Proposition de paramétrage | contexte paramétrage (écart CPSI, seuils) | proposition avec impact simulé | R254, R70 |

Hors périmètre v1 (gelé, note §C de l'amendement) : génération de documents, exécution
d'actions, veille réglementaire, jurisprudence.

Chaîne d'un échange :
```
Utilisateur (rôle, tenant)
  → POST /olivia/conversations/:id/messages {texte, ancrage?}
  → ContextBuilder (R255) : résout l'ancrage, vérifie chaque objet contre RBAC+RLS,
    construit le contexte, calcule l'empreinte
  → Port IA (R253) : appel fournisseur déclaré (modèle/version tracés)
  → Post-traitement (R256) : extraction et vérification des citations
  → Journal (R257) : événements append-only (message_in, contexte, message_out)
  → Réponse à l'écran ; si sortie « proposable » → objet proposition (R254)
```

## B.1 Modèle de données

```sql
-- ── Conversations ──
CREATE TABLE olivia_conversations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    user_id       UUID NOT NULL REFERENCES users(id),
    role_code     VARCHAR(20) NOT NULL,        -- rôle AU MOMENT de la création (figé)
    capacite      VARCHAR(4)  NOT NULL CHECK (capacite IN ('C1','C2','C3','C4')),
    ancrage_type  VARCHAR(20),                 -- 'KYC_FILE','RISK_CASE','ALERTE','PARAM'
    ancrage_id    UUID,                        -- objet ancré (nullable pour C1 général)
    statut        VARCHAR(10) NOT NULL DEFAULT 'OUVERTE'
                  CHECK (statut IN ('OUVERTE','FERMEE')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE olivia_conversations ENABLE ROW LEVEL SECURITY;

-- ── Messages : APPEND-ONLY (R257) ──
CREATE TABLE olivia_messages (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    conversation_id UUID NOT NULL REFERENCES olivia_conversations(id),
    seq           INTEGER NOT NULL,            -- monotone par conversation
    direction     VARCHAR(3) NOT NULL CHECK (direction IN ('IN','OUT')),
    texte         TEXT NOT NULL,
    -- OUT uniquement :
    provider      VARCHAR(30),                 -- R253 : déclaration
    model         VARCHAR(60),
    model_version VARCHAR(60),
    citations     JSONB,                       -- R256 : [{type, ref_id, extrait?}, ...]
    est_source    BOOLEAN,                     -- R256 : false = marqué « non sourcé »
    contexte_empreinte CHAR(64),               -- R255 : HMAC du contexte transmis
    contexte_objets    JSONB,                  -- R255 : [{type, id}] — la LISTE, prouvable
    latence_ms    INTEGER,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    record_hash   CHAR(64) NOT NULL,           -- chaînage (pattern kyc_question_history)
    prev_hash     CHAR(64),
    CONSTRAINT olivia_msg_seq UNIQUE (conversation_id, seq)
);
ALTER TABLE olivia_messages ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER om_immutable BEFORE UPDATE OR DELETE ON olivia_messages
    FOR EACH ROW EXECUTE FUNCTION audit_immutable();

-- ── Propositions (R254) : cycle de vie décidé par l'humain ──
CREATE TABLE olivia_proposals (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    message_id    UUID NOT NULL REFERENCES olivia_messages(id),  -- sortie qui la fonde
    type          VARCHAR(30) NOT NULL,
                  -- 'QUALIF_ALERTE_FONDEE','QUALIF_ALERTE_NON_FONDEE',
                  -- 'AIGUILLAGE_EDD','ALLEGEMENT_EDD','AJUSTEMENT_PARAM'
    cible_type    VARCHAR(20) NOT NULL,        -- 'ALERTE','KYC_FILE','PARAM'
    cible_id      UUID NOT NULL,
    justification TEXT NOT NULL,               -- obligatoire à la création
    impact_estime JSONB,                       -- C4 : sortie du bac à sable R70
    statut        VARCHAR(10) NOT NULL DEFAULT 'PENDING'
                  CHECK (statut IN ('PENDING','ADOPTEE','REJETEE','CADUQUE')),
    decide_par    UUID REFERENCES users(id),
    decide_at     TIMESTAMPTZ,
    motif_rejet   TEXT,                        -- OBLIGATOIRE si REJETEE (R7)
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT motif_si_rejet CHECK (statut <> 'REJETEE' OR motif_rejet IS NOT NULL)
);
ALTER TABLE olivia_proposals ENABLE ROW LEVEL SECURITY;
```

Événements outbox émis (`domain_events`) : `OLIVIA_MESSAGE_IN`, `OLIVIA_MESSAGE_OUT`,
`OLIVIA_CONTEXT_DENIED`, `OLIVIA_PROPOSAL_CREATED`, `OLIVIA_PROPOSAL_ADOPTED`,
`OLIVIA_PROPOSAL_REJECTED` — payload minimal (ids + empreintes), jamais le texte intégral
en double.

## B.2 API

| Méthode | Route | Rôles | Description |
|---|---|---|---|
| POST | `/api/v1/olivia/conversations` | selon capacité (B.3) | crée {capacite, ancrage_type?, ancrage_id?} — vérifie l'accès à l'ancrage AVANT création |
| POST | `/api/v1/olivia/conversations/:id/messages` | propriétaire | envoie un message, reçoit la réponse (synchrone v1) |
| GET | `/api/v1/olivia/conversations/:id` | propriétaire + audit (SO) | historique complet |
| GET | `/api/v1/olivia/conversations/:id/replay?as_of=` | SO, Compliance | rejeu à date (R257/R48) |
| GET | `/api/v1/olivia/proposals?statut=` | rôles décideurs (B.3) | liste des propositions |
| POST | `/api/v1/olivia/proposals/:id/adopt` | rôle décideur du type | adoption → suit la voie workflow normale |
| POST | `/api/v1/olivia/proposals/:id/reject` | rôle décideur | {motif} OBLIGATOIRE |
| GET | `/api/v1/olivia/health` | ADMIN, SO | port configuré ?, provider/model, latence médiane |

### Codes d'erreur typés

| Code | HTTP | Cas |
|---|---|---|
| `OLIVIA_PORT_OFF` | 503 | aucun secret configuré (R253) — message : « Olivia n'est pas activée pour ce tenant » |
| `OLIVIA_PROVIDER_DOWN` | 502 | fournisseur en erreur/timeout — l'échec est journalisé |
| `OLIVIA_SCOPE_DENIED` | 403 | ancrage ou objet de contexte hors RBAC/RLS (R255) — événement `OLIVIA_CONTEXT_DENIED` |
| `OLIVIA_CONTEXT_OVERFLOW` | 422 | contexte > `olivia_scope_max_objets` — l'utilisateur doit restreindre |
| `OLIVIA_UNSOURCED_PROPOSAL` | 422 | tentative de créer une proposition depuis une sortie `est_source=false` (R256) |
| `OLIVIA_MOTIF_REQUIS` | 422 | rejet sans motif (R7) |
| `OLIVIA_PROPOSAL_DECIDEE` | 409 | décision sur une proposition non PENDING |

## B.3 Matrice capacités × rôles

| Capacité | Peut converser | Peut décider les propositions issues |
|---|---|---|
| C1 question dossier | RM, ARM, CO, CO_SR, BRM, Direction | — (pas de proposition) |
| C2 synthèse KYC | RM, ARM, CO, CO_SR | — |
| C3 pré-analyse alerte | CO, CO_SR | qualification : CO_SR · aiguillage EDD : selon workflow existant |
| C4 paramétrage | CO_SR, ADMIN (lecture BRM) | ADMIN + CO_SR (double décision non requise en v1) |

Le décideur ne peut pas être un rôle non listé, même ADMIN (default-deny). SO a accès
lecture/rejeu à toutes les conversations du tenant (fonction d'audit), jamais à l'envoi.

## B.4 R253 — Port IA : comportement détaillé

- Configuration tenant : `olivia_provider` (`anthropic` | `azure-openai` | `on-prem`),
  `olivia_model`, secret en coffre (pattern R144) — **jamais** en clair en base ni au front.
- Sans configuration : toutes les routes Olivia répondent `OLIVIA_PORT_OFF` ; l'entrée de
  menu affiche « Olivia (non activée) » grisée avec l'explication — visible, honnête,
  inactive. Aucune autre route de la plateforme n'est affectée.
- Chaque appel sortant journalise : provider, model, model_version (renvoyée par l'API du
  fournisseur, pas supposée), latence, statut. Changement de `olivia_model` = événement
  de paramétrage versionné à date (R68) — le rejeu d'une conversation ancienne affiche le
  modèle de l'époque.
- Timeout appel : `olivia_timeout_ms` (défaut 30 000) → `OLIVIA_PROVIDER_DOWN`, message
  utilisateur, l'échec reste dans le journal (un OUT d'erreur est aussi un événement).

## B.5 R255 — ContextBuilder : algorithme normatif

Entrées : (user, role, tenant, capacite, ancrage, question).

1. **Résolution de l'ancrage** : charger l'objet ancré VIA les services existants
   (KycService.findOne scopé tenant, etc.) — jamais par requête directe. Échec = 404/403
   du service propagé → `OLIVIA_SCOPE_DENIED`. La porte ne « rattrape » rien.
2. **Expansion bornée** : à partir de l'ancrage, inclure uniquement les objets du graphe
   autorisé par capacité :
   - C2 : dossier KYC → sections+questions **visibles pour le rôle** (droits
     HIDDEN exclus — un RM qui ne voit pas la décision comité, Olivia ne la voit pas
     non plus), visas, change tracker.
   - C3 : alerte → signal scoré, scénario (paramètres R79), score CPSI + drivers,
     risk case lié éventuel.
   - C4 : paramètre visé → valeur en vigueur, historique versions, résultat bac à
     sable si fourni.
   - C1 : ancrage seul + objets explicitement référencés par l'utilisateur (chacun
     re-vérifié individuellement).
3. **Vérification unitaire** : CHAQUE objet passe le contrôle d'accès du service qui le
   possède. Un refus n'est pas silencieux : l'objet est exclu ET l'événement
   `OLIVIA_CONTEXT_DENIED` est journalisé (qui, quoi, pourquoi) — puis la requête échoue
   en `OLIVIA_SCOPE_DENIED` si l'objet refusé était l'ancrage, ou continue sans lui s'il
   était périphérique (avec mention « contexte partiel » dans la réponse).
4. **Borne** : > `olivia_scope_max_objets` (défaut 50) → `OLIVIA_CONTEXT_OVERFLOW`.
5. **Empreinte** : `HMAC-SHA256(secret_audit, canonical_json(liste_objets + versions))`
   → `contexte_empreinte` ; la liste `[{type,id}]` est stockée en clair dans
   `contexte_objets`. Reproductible : rejouer la construction à date redonne la même
   empreinte (c'est le test OL-13).
6. **Assemblage du prompt** : gabarit versionné par capacité (le gabarit est un paramètre
   tenant versionné R68 — le modifier = événement, le rejeu utilise le gabarit de
   l'époque).

## B.6 R256 — Citations : format et vérification

**LIVRÉ (étape 5, 2026-07-27)** — vérification serveur dans `envoyerMessage` : `ref` doit être
dans `contexte_objets` (sauf `REGLE` : format `^R[1-9][0-9]{0,2}$` et ≤ `CATALOGUE_MAX_REGLE`) ;
`valide` par citation + `est_source` calculés et **journalisés** sur le message OUT (dans le
`record_hash`). e2e OL-11/13/14 (fat-olivia). **OL-12 (`OLIVIA_UNSOURCED_PROPOSAL` 422) reporté
à l'étape 6** — il exige la route proposition (R254), non encore ouverte.

Format d'une citation dans `citations` :
```json
{ "type": "KYC_QUESTION" | "EVENEMENT" | "REGLE" | "DOCUMENT" | "SCORE_DRIVER",
  "ref": "uuid ou Rn ou code question",
  "assertion": "l'affirmation couverte (résumé court)" }
```
Vérification à la réception de la sortie du modèle :
- chaque `ref` doit **exister** et être **dans `contexte_objets`** (une citation vers un
  objet hors contexte est invalide — le modèle ne peut pas citer ce qu'on ne lui a pas
  montré) ; `REGLE` doit exister au catalogue.
- ≥ 1 citation valide → `est_source = true` ; sinon `est_source = false`, bandeau
  « Non sourcé — à vérifier » dans l'UI, et le bouton « Proposer » est absent
  (contrainte serveur : `OLIVIA_UNSOURCED_PROPOSAL`, pas seulement UI).
- Les citations s'affichent en pied de réponse, cliquables vers l'objet source (question
  KYC ancrée, événement du trail, règle du référentiel).

## B.7 R254 — Cycle de vie d'une proposition

```
                    adopt (rôle décideur, B.3)
   PENDING ────────────────────────────────► ADOPTEE ──► voie workflow NORMALE
      │                                                   (l'adoption ne fait que
      │ reject {motif obligatoire}                        créer la tâche/l'événement
      ├────────────────────────────► REJETEE              du circuit existant — elle
      │                                                   n'exécute RIEN directement)
      │ la cible change d'état avant décision
      └────────────────────────────► CADUQUE (automatique, tracée : « alerte déjà
                                     qualifiée par X le … » — jamais silencieuse)
```
Invariants : une proposition ADOPTEE de type `AIGUILLAGE_EDD` crée l'événement/la tâche
du circuit R66 existant — le dossier ne change PAS d'état par l'adoption elle-même.
`AJUSTEMENT_PARAM` adopté crée une entrée de bac à sable pré-remplie (R70) : même adopté,
un paramètre ne s'applique jamais sans simulation.

## B.8 Écran Olivia (v1)

- **Panneau latéral contextuel** (ouvrable depuis KYC, alerte, risk case, paramétrage) :
  la conversation naît ANCRÉE — l'objet courant est l'ancrage, affiché en tête avec le
  périmètre (« Contexte : KYC-2026-CH-0044-R2, 13 sections, 4 exclues pour votre rôle »).
- Réponse : texte + pied de citations cliquables + badge « Sourcé ✓ » ou « Non sourcé ⚠ ».
- Si la sortie est proposable (C3/C4) : carte proposition inline (type, cible,
  justification) avec « Proposer » → crée l'objet PENDING ; la décision se prend dans
  l'écran propositions (ou la carte si le rôle courant est décideur).
- **Écran Propositions** : liste filtrable (statut, type, capacité), détail = sortie
  source + citations + boutons Adopter / Rejeter (motif requis) ; historique des décisions.
- **Mode audit (SO)** : lecture d'une conversation avec la vue « ce qu'Olivia a vu » —
  la liste `contexte_objets` rendue, l'empreinte affichée, bouton « rejouer à date ».
- Port éteint : entrée de menu grisée « Olivia (non activée) » + tooltip explicatif.

## B.9 Paramètres tenant (questionnaire R-Q)

| Paramètre | Défaut | Règle |
|---|---|---|
| `olivia_provider` / `olivia_model` / secret (coffre) | non configuré | R253 |
| `olivia_timeout_ms` | 30000 | R253 |
| `olivia_scope_max_objets` | 50 | R255 |
| `olivia_prompt_template.{C1..C4}` | gabarits livrés, versionnés à date | R255/R68 |
| `olivia_retention_conversations_mois` | politique R170 du tenant | R257 |
| `olivia_capacites_actives` | {C1,C2,C3,C4} | activation fine par tenant |

## B.10 Scénarios OL-01..OL-22

**R253 — Port**
> **OL-01 — Pas de secret, refus gracieux** : aucun secret → toute route Olivia répond
> `OLIVIA_PORT_OFF` 503 ; le menu est grisé ; la suite plateforme hors Olivia est verte.
> **OL-02 — L'appel est déclaré** : une réponse OUT porte provider, model, model_version
> (celle renvoyée par le fournisseur) et latence ; l'événement `OLIVIA_MESSAGE_OUT` existe.
> **OL-03 — Le changement de modèle est versionné** : modèle changé au jour J ; le rejeu
> d'une conversation antérieure affiche l'ancien modèle ; une nouvelle conversation le
> nouveau (R68).
> **OL-04 — Le timeout est un événement, pas un trou** : fournisseur muet >
> `olivia_timeout_ms` → `OLIVIA_PROVIDER_DOWN`, message utilisateur, ET un OUT d'échec
> journalisé (seq consommé).

**R255 — Contexte borné**
> **OL-05 — L'ancrage hors scope est refusé à la création** : RM sans accès au client X
> crée une conversation ancrée sur le KYC de X → 403 `OLIVIA_SCOPE_DENIED`, événement
> `OLIVIA_CONTEXT_DENIED`, AUCUNE conversation créée.
> **OL-06 — Les sections HIDDEN n'entrent pas dans le prompt** : dossier dont la section
> « décision comité » est HIDDEN pour RM → la synthèse C2 de RM ne contient aucun contenu
> de cette section ET `contexte_objets` ne la référence pas ; la même synthèse pour CO la
> contient.
> **OL-07 — L'objet périphérique refusé = contexte partiel, tracé** : en C3, le risk case
> lié est hors scope du demandeur → réponse produite SANS lui, mention « contexte
> partiel », événement `OLIVIA_CONTEXT_DENIED` sur cet objet.
> **OL-08 — La borne ferme** : ancrage dont l'expansion dépasse `olivia_scope_max_objets`
> → 422 `OLIVIA_CONTEXT_OVERFLOW`, aucun appel fournisseur émis.
> **OL-09 — L'empreinte est reproductible** : reconstruire le contexte de la même
> conversation à la même date redonne exactement `contexte_empreinte`.
> **OL-10 — Cross-tenant impossible** : un utilisateur du tenant T2 avec l'id d'une
> conversation de T1 → 404 (RLS) ; aucun contenu ne fuit.

**R256 — Citations**
> **OL-11 — La citation doit venir du contexte** : sortie citant un objet absent de
> `contexte_objets` → citation invalidée ; si plus aucune valide, `est_source=false`.
> **OL-12 — Non sourcé = pas de proposition** : sortie `est_source=false` → POST
> proposition refuse en 422 `OLIVIA_UNSOURCED_PROPOSAL` (contrainte serveur, testée
> hors UI).
> **OL-13 — La citation est cliquable et juste** : citation `KYC_QUESTION:AML-Q1` →
> le clic ouvre le dossier ancré sur AML-Q1 ; la ref existe en base.
> **OL-14 — La règle citée existe** : citation `REGLE:R999` inexistante au catalogue →
> invalidée.

**R254 — Propositions**
> **OL-15 — La proposition n'agit pas** : proposition AIGUILLAGE_EDD créée → le dossier
> KYC est inchangé (statut, ddl_level) ; seul un objet PENDING existe.
> **OL-16 — L'adoption emprunte la voie normale** : adoption par CO_SR → l'événement/la
> tâche du circuit R66 existant est créé ; le dossier ne change PAS d'état par l'adoption
> elle-même ; auteur+date tracés.
> **OL-17 — Le rejet exige un motif** : reject sans motif → 422 `OLIVIA_MOTIF_REQUIS` ;
> avec motif → REJETEE, motif consultable.
> **OL-18 — Le mauvais rôle ne décide pas** : RM tente d'adopter une qualification C3 →
> 403 (matrice B.3), la proposition reste PENDING.
> **OL-19 — La caducité est automatique et tracée** : l'alerte cible est qualifiée par un
> humain avant décision → la proposition passe CADUQUE avec la référence de la décision
> humaine ; adopt/reject ultérieur → 409 `OLIVIA_PROPOSAL_DECIDEE`.
> **OL-20 — Un paramètre adopté passe par le bac à sable** : AJUSTEMENT_PARAM adopté →
> une entrée de simulation R70 pré-remplie est créée ; le paramètre en vigueur est
> inchangé tant que la simulation n'est pas passée puis appliquée par la voie R68.

**R257 — Journal**
> **OL-21 — La conversation se rejoue à date** : replay `as_of` → IN, empreinte+liste de
> contexte, OUT, citations, décisions, dans l'ordre des seq ; le chaînage record_hash se
> vérifie de bout en bout ; UPDATE/DELETE sur olivia_messages → exception du trigger.
> **OL-22 — Aucun auto-ajustement** : un utilisateur note une réponse « inutile » →
> aucun paramètre/gabarit ne change ; au plus une proposition AJUSTEMENT_PARAM PENDING
> est créée ; diff de config avant/après : vide.

## B.11 Critères d'acceptation Olivia

1. OL-01..22 verts (e2e Postgres réel ; OL-02/04 avec fournisseur mocké déterministe —
   le mock est un port de test, jamais utilisé en prod : pattern « pas de données
   simulées » côté produit).
2. Suite plateforme verte AVEC et SANS secret IA.
3. Preuve « zéro écriture métier » : test qui inventorie les requêtes SQL du service
   Olivia — seules les tables `olivia_*` et `domain_events` apparaissent en écriture.
4. L'appel `api.anthropic.com` côté navigateur est SUPPRIMÉ du front ; tout chemin IA
   passe par `/api/v1/olivia/*` ; grep CI qui échoue si `api.anthropic.com` réapparaît
   dans `apps/web`.
5. Paramètres B.9 ajoutés à `questionnaire-R-Q.md`.
6. Gabarits de prompt C1..C4 livrés comme paramètres versionnés (pas en dur dans le code).

---

# Ordre de bataille (pour le prompt Claude Code)

1. Étape 0 : numérotation + familles HO/OL + écart IAM (inchangé vs amendement précédent).
2. Home (principe, HO-01..08) — front seul, zéro backend. ⚠ 4 tuiles bloquées par l'écart endpoints (voir en-tête).
3. R253 port + B.1 modèle de données + trigger immuabilité (OL-01..04).
4. R255 ContextBuilder (OL-05..10) — le cœur ; aucune capacité ouverte avant qu'il soit vert.
5. R256 citations (OL-11..14).
6. R254 propositions + capacité C3 puis C4 (OL-15..20).
7. R257 replay + capacités C1/C2 (OL-21..22).
8. Extinction de l'appel navigateur + grep CI (critère B.11.4).
Un commit par règle, tests rouges puis verts, suite complète verte à chaque frontière.
