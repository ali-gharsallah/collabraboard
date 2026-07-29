# O-Live — Canon des DEUX DERNIERS ÉCARTS
# Rôle SO — Security Officer (R284) · Transport asynchrone : outbox, file, SSE (R285–R287)

**Statut : RATIFIÉ le 2026-07-28 (Ali) — mapping famille AU→SO (SO-01..06) ratifié ·
canon ratifié tel quel avec le périmètre réel de l'étape 0 · livrable : branche unique
PR #46 (précédent ratifié), deux séquences de commits (transport R285-R287, puis SO R284).**

## VERDICT ÉTAPE 0 (exécutée sur le repo réel)

- **0a Numérotation R284–R287 : LIBRE** ✓ (aucune occurrence dans spec/, src/, moteurs).
- **0b Familles** : **AS libre** ✓ · **AU EN COLLISION** ✗ — AU-01..09 pris par l'IAM
  (`auth.spec.ts`, R89/R90, catalogues d'amendements). **Mapping RATIFIÉ : AU → SO**
  (SO-01..06, famille vérifiée libre).
- **0c Inventaire (périmètre réel de mise en conformité)** :
  - **Relais d'outbox : EXISTE et est UNIQUE** (`events/outbox.worker.ts` — poll
    `published_at IS NULL`, FOR UPDATE SKIP LOCKED, projections internes dans la
    transaction du drain, R104). Aucun module n'émet hors outbox (les « notifications »
    personnes/tâches sont déjà des domain events ; `mros.notification` est un champ
    métier art. 9 LBA ; les fetch sortants sont les ports IA/JWKS — hors transport).
    **Rabattement R285 : rien à rabattre.** DEUX violations latentes :
    (1) le corps webhook embarque `data: ev.payload` — payload métier COMPLET (interdit
    R285) ; (2) `tick().catch(() => {})` — échec SILENCIEUX (anti-pattern R286) ; ni
    watermark par consommateur, ni compteur de tentatives, ni dead-letter.
  - **SSE : INEXISTANT** (aucun text/event-stream). Olivia v1 synchrone — OL-31 prouve
    les invariants de journal ; R287 CRÉE le hub, il ne rebranche pas un existant.
  - **Rôle SO : ABSENT de l'enum** (`RM ARM CO CO_SR MLRO CF BRM DIR ADMIN`) — l'écart
    consigné de longue date (« SO → rôle à ratifier », spec Home codée ADMIN,
    `roles_motif_sensible` défaut sans SO). R284 RATIFIE le rôle : ajout à l'enum
    (migration additive) + surfaces d'audit — création propre, pas mise en conformité.
- **0d** : canon enregistré ici ; les 2 entrées ECARTS (rôle SO · transport asynchrone)
  pointent vers ce canon — SOLDE à la fin de chaque partie, pas avant.

---

# PARTIE 1 (livrée en second) — LE RÔLE SO EST UN RÔLE D'AUDIT (R284)

### R284 — SO voit les JOURNAUX, jamais les dossiers — et l'auditeur est audité

La tension HO-06 ↔ R270 se résout par une distinction canonique entre deux surfaces :

**Surface OPÉRATIONNELLE** (écrans métier : clients, KYC, comptes, AML workspace,
CoC, reviews) → SO n'y a **aucun accès** — HO-06 confirmé tel quel : à l'accueil, SO
ne voit que T3 (ses tâches) et T9 (santé technique). SO ne travaille pas les dossiers.

**Surface d'AUDIT** (écrans et endpoints dédiés, lecture seule stricte) → SO y a accès
**intégral**, y compris ce qui est cloisonné ailleurs : le trail (rejeu à date, tous
modules — R48/R49) ; les conversations Olivia + replay + empreintes de contexte ; les
runs agentiques + replay + STOP (R266/R267 swarm) ; le journal CPSI et la santé de la
porte ; les motifs sensibles et références MROS (R270 — auditer l'art. 10a exige de
voir ce qui est cloisonné) ; le journal des accès.

Interdictions absolues, structurelles (pas des conventions) :
- **Aucune écriture métier** : aucun endpoint non-GET hors deux exceptions fermées —
  STOP d'un run (R267) et l'export d'audit (génération de document, tracée).
- **Jamais décideur** : aucun visa (R15), aucune adoption/rejet (R255), aucun
  traitement de CoC, aucune décision de porte de run. SO est structurellement exclu du
  four-eyes (R13) : ni premier ni second regard.
- **SO ≠ ADMIN, les deux aveugles au métier** : ADMIN paramètre sans voir les dossiers ;
  SO surveille sans rien paramétrer. Cumul SO+ADMIN refusé par le backend
  (`cumul_so_admin_interdit`, paramètre tenant, défaut vrai — assouplissable, tracé).

**L'auditeur est audité** : chaque consultation SO d'une surface sensible (motif
sensible, conversation Olivia, replay) est ELLE-MÊME un événement append-only
(`AUDIT_ACCESS` : qui, quoi, quand), consultable par la Direction et par SO lui-même.

### Scénarios SO-01..SO-06 (famille AU du canon proposé, mappée)

> **SO-01 — SO ne voit pas l'opérationnel** : endpoint métier → 403 ; accueil SO =
> T3/T9 seulement (HO-06 re-passé tel quel).
> **SO-02 — SO voit tout en audit, en lecture** : replay dossier/conversation/run →
> contenu intégral, y compris motif sensible R270 ; tout non-GET hors STOP/export → 403.
> **SO-03 — SO n'est jamais un regard du four-eyes** : visa, adoption de proposition,
> traitement CoC, décision de porte → 403 structurel (un test par type de décision).
> **SO-04 — L'auditeur est audité** : consultation d'un motif sensible → AUDIT_ACCESS
> (qui/quoi/quand) ; la Direction le voit ; suppression impossible (append-only).
> **SO-05 — Le cumul est refusé** : SO sur un utilisateur déjà ADMIN → refus typé
> (défaut) ; paramètre assoupli → accepté ET tracé.
> **SO-06 — Le cloisonnement R270 reste étanche autour de SO** : le CO (non CO_SR)
> voit le motif générique — identique avant/après consultation SO (aucune voie latérale).

---

# PARTIE 2 (livrée en premier) — TRANSPORT ASYNCHRONE : L'OUTBOX EST LA SOURCE (R285–R287)

Invariant directeur : **le transport ne porte jamais la vérité — il transporte des
références vers des journaux.**

### R285 — Rien ne part qui ne soit d'abord ÉCRIT — l'outbox précède tout message
Aucun message (file, notification, SSE) n'est émis directement depuis la logique
métier. Séquence : (1) transaction métier + événement outbox (`domain_events`, même
transaction — pattern en place) ; (2) le relais lit et publie. Un message ne peut pas
exister sans son événement persisté ; un crash entre (1) et (2) ne perd rien ; le
contenu transporté est minimal — **identifiants et références, jamais le payload métier
complet** (le consommateur relit la source, qui applique RBAC/RLS).

### R286 — Livraison AT-LEAST-ONCE, consommateur IDEMPOTENT, échec VISIBLE
- chaque consommateur porte un **watermark** persisté (dernier seq traité par flux) ;
  la redélivrance est normale ;
- tout effet de consommation est **idempotent** (R76, PC-10, UC-01 — clé = référence
  d'événement) ;
- l'échec suit retry + backoff borné (`retry_max`, `backoff_base_s` — paramètres
  tenant), puis **dead-letter TRACÉE** visible (T9 : « N en souffrance, le plus
  ancien : X ») — jamais un log silencieux ; rejeu manuel tracé (qui, quand), toujours
  sûr (idempotence) ;
- l'ordre est garanti PAR FLUX (par agrégat), jamais globalement.

### R287 — SSE est une PROJECTION éphémère — le flux descend, la commande monte en HTTP
- jamais d'état de vérité : « quelque chose a changé, référence X » ; OL-31 : seul le
  message complet est au journal ;
- reconnexion par le journal (Last-Event-ID = watermark) — une coupure ne perd rien,
  ne double rien (idempotence client par référence) ;
- **aucune commande ne monte par le flux** — toute action est un POST HTTP audité ;
  pas de WebSocket bidirectionnel ;
- le scope s'applique au flux : abonnement ouvert avec (user, role, tenant) courant —
  la notification d'un objet interdit ne part jamais (pattern OL-34).

### Modèle (delta minimal)
`event_consumers` (consumer, stream, last_seq, + tête bloquée/tentatives/backoff) ·
`event_dead_letters` (tenant, consumer, event_id réf domain_events, erreur, tentatives,
rejoue_par/at). Paramètres R-Q : `retry_max` (5) / `backoff_base_s` (10) /
`dead_letter_alerte_seuil` (1) — R286 ; `cumul_so_admin_interdit` (vrai) — R284.

### Scénarios AS-01..AS-08

> **AS-01 — Pas d'événement, pas de message** : aucune émission hors relais d'outbox ;
> crash entre transaction et relais → publié au redémarrage, rien de perdu.
> **AS-02 — Références, pas des payloads** : messages émis = identifiants/références ;
> le consommateur relit la source (scope insuffisant → relecture refusée).
> **AS-03 — La redélivrance est inoffensive** : deux livraisons du même événement au
> worker case_proposal → UN riskcase (UC-01/PC-10 à travers le transport).
> **AS-04 — L'échec finit en dead-letter visible, le rejeu est tracé** : 5 échecs →
> dead-letter + compteur T9, jamais de blocage ; rejeu manuel → traité, rejoue_par/at.
> **AS-05 — L'ordre tient par agrégat** : même agrégat → ordre des seq ; inter-agrégats
> mélangé → le consommateur passe (aucune supposition d'ordre croisé).
> **AS-06 — La reconnexion SSE ne perd ni ne double** : coupure pendant 3 événements →
> Last-Event-ID, les 3 arrivent une seule fois ; stream Olivia interrompu suit OL-31.
> **AS-07 — Rien ne monte par le flux** : rien d'entrant au-delà du handshake/watermark ;
> toute action reste un POST HTTP audité.
> **AS-08 — Le flux respecte le scope** : l'événement d'un client hors scope RM n'est
> jamais poussé au RM (même la référence) ; le CO le reçoit.

# ORDRE DE LIVRAISON : 1) R285 (AS-01,02) · 2) R286 (AS-03..05) · 3) R287 (AS-06..08,
# OL-31 re-passé, pilote compteurs Home) · 4) R284 (SO-01..06, HO-06/OF-07/OF-08 re-passés).
# INTERDITS : émission directe hors relais ; payload complet dans un message ;
# exactly-once prétendu ; commande entrante par SSE/WebSocket ; endpoint non-GET pour SO
# hors STOP/export ; SO dans un circuit de visa ; code avant test.
