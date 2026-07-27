# Catalogue O-Live — Amendement (R248 → R252) · Bloc « La porte CPSI est un rejeu »

**Statut : numérotation R248–R252 RATIFIÉE (Ali, 2026-07-27) ; écart 2 tranché (R252 remplace
CP-15/16/17). Scénarios PC PROPOSÉS pour implémentation spec-first.**

Numérotation continue après **R246** (dernier bloc ratifié : MOD Décision NBA R243–R246).
⚠️ **Écart de numérotation signalé & corrigé** : la première rédaction proposait R222–R226 — **déjà
attribués et implémentés** (R222–R230 MOD-75 Business Trip, R231–R238 MOD-43 Formations, R239–R242
Tâches, R243–R246 NBA). Remappé **R222→R248, R223→R249, R224→R250, R225→R251, R226→R252** sans rien
renuméroter d'autre. Famille de scénarios : **PC** (Porte CPSI — vérifiée libre).

**Le catalogue précède le code.** Décisions Q1–Q4 actées (2026-07-27) : journal append-only Postgres +
rejeu (Q1/Q2), frontière documentée avec R133–R136 (Q3), shell-out vers le moteur Python (Q4). Le
moteur `services/cpsi-server-py` (R63–R86, 18/18 suites vertes) reste la **source normative du calcul** ;
la porte NestJS ne réécrit aucune règle.

> **Note d'implémentation** : R249 (journal append-only `cpsi_events`) est **déjà en place** (porte CPSI
> livrée, PR #46). Le présent amendement DURCIT la porte (enveloppe versionnée R248, jauge R250, refus
> gracieux R251) et **corrige la frontière R252** (émission `case_proposal` au lieu d'une surface produit
> risk-case). Voir « Supersession CP-15/16/17 » en fin de document.

---

## R248 — La porte CPSI est une lecture par REJEU — le moteur est une fonction pure invoquée

La porte NestJS n'héberge aucun état CPSI. Chaque lecture (score, drivers, segment, bande, signaux
scorés, catalogue R79) invoque le moteur Python en **sous-processus** avec une enveloppe **versionnée**
sur stdin/stdout : `{contract_version, tenant_id, as_of, commande, payload}` → `{contract_version,
resultat | erreur_typee, meta}`. Le moteur reconstruit l'état par rejeu du journal du tenant **jusqu'à
`as_of`** — le rejeu à date (R48/R49) est le mode NOMINAL. Le default-deny du moteur (type de signal
inconnu) remonte en **422 typé**, jamais un stderr avalé ni un 500 opaque.

> **PC-01 — Chaque lecture est un rejeu à date.** Tenant T1, 3 signaux aux dates d1<d2<d3 ; lecture du
> score `as_of=d2` ⇒ score = signaux ≤ d2, réponse porte `contract_version`, drivers reconstituent le score (R67).
> **PC-02 — Le default-deny traverse la porte, typé.** Ingestion d'un signal de type inconnu ⇒ **422**
> avec code d'erreur explicite du moteur ; AUCUN événement journalisé.
> **PC-03 — Déterminisme du shell-out.** Même (tenant, as_of, commande) invoquée deux fois ⇒ résultats
> identiques octet pour octet (hors meta de mesure).

## R249 — Les écritures vont au JOURNAL, jamais au sous-processus — sens unique

Toute mutation CPSI (signal, groupe, barème, marquage insider, config R68, case_proposal) est un
**événement append-only tenant-scopé (RLS)** écrit par NestJS dans Postgres — table `cpsi_events`
protégée par trigger d'immuabilité (pattern `kyc_question_history`). Le sous-processus Python **calcule
et ne persiste JAMAIS rien** : aucune voie d'écriture n'existe depuis le moteur vers un store (pattern
R168 « le core est intouchable », appliqué à l'inverse). La config de calcul reste versionnée par date
de mise en vigueur (R68) : le rejeu à date utilise la config en vigueur ce jour-là.

> **PC-04 — L'écriture précède la lecture, par le journal seul.** Signal ingéré ⇒ événement append-only
> (tenant, seq, at, type, payload) ; la lecture suivante (rejeu) le reflète ; le sous-processus n'a ouvert
> aucune connexion d'écriture.
> **PC-05 — Isolation tenant au rejeu.** Événements T1 et T2 ; hydrater T1 ⇒ seuls les événements T1
> rejoués ; une lecture T2 sous contexte T1 est refusée (RLS + filtrage applicatif).
> **PC-06 — L'immuabilité du journal est réelle.** UPDATE/DELETE sur `cpsi_events` ⇒ le trigger lève (R49).

## R250 — Le rejeu se MESURE et s'affiche — l'optimisation attend la jauge (R39)

Chaque réponse porte en méta : **nombre d'événements rejoués** et **durée d'hydratation**. L'endpoint
santé expose, par tenant : profondeur du journal, durée du dernier rejeu, `contract_version` et **version
de config en vigueur** (R68). Le dépassement d'un seuil de durée (paramètre tenant) émet une notification —
jamais un blocage (R39). Cache d'instance ou snapshot = **optimisations différées HORS spec**, déclenchées
par la jauge réelle, devront préserver PC-01..PC-06 à l'identique.

> **PC-07 — La jauge est dans la réponse et la santé.** Lecture ⇒ meta {evenements_rejoues, duree_ms} ;
> l'endpoint santé expose ces mesures + la version de config en vigueur.

## R251 — La porte est un PORT optionnel — pas de Python, refus gracieux, harnais inchangé

Python absent, non exécutable, ou timeout du sous-processus = **503 typé** avec cause explicite (pattern
R114/R167 : refus, pas de silence, pas de données simulées). Aucune route existante NestJS n'est dégradée ;
la suite plateforme reste verte sans le moteur Python installé. Le timeout est un paramètre tenant.

> **PC-08 — Pas de moteur, pas de porte — et rien d'autre ne casse.** Interpréteur Python absent ⇒ toute
> route CPSI répond **503 typé** ; les routes non-CPSI répondent normalement ; la suite e2e hors CPSI est verte.

## R252 — Frontière DIRECTIONNELLE : le CPSI propose, R133–R136 instruit

Le CPSI (détection, R79–R83) **émet** des événements `case_proposal` (corrélation R81 incluse : ≥2
scénarios même client) ; le module riskcases existant (R133–R136) les **consomme et instruit** — décisions
humaines (R44), voie MROS (R129–R132). Une SEULE surface d'investigation pour l'utilisateur : celle des
riskcases Nest. Le `risk_cases` interne du moteur Python (bloc 14, RC-01..05) reste le **moteur de
référence des TESTS**, jamais une surface produit. **Aucune route R133–R136 n'est modifiée.**

> **PC-09 — La proposition traverse, l'instruction reste chez riskcases.** Une corrélation R81 émet un
> `case_proposal` ⇒ événement append-only journalisé, consommable par riskcases (R133–R136) ; aucun état de
> riskcase muté par le CPSI lui-même (R66).
> **PC-10 — Idempotence de la proposition.** Même couple (client, corrélation) rejoué ⇒ UNE seule
> proposition (génération idempotente, pattern R76).

### Supersession CP-15/16/17 (spec `spec/cpsi-scenarios/CPSI-PORTE.feature`)

R252 **remplace** la surface produit risk-case exposée par la porte au lot CPSI-4 (livrée dans PR #46) :
`CP-15` (ouverture), `CP-16` (transitions), `CP-17` (reporting SLA). Ces scénarios sont marqués
**SUPERSEDED (2026-07-27, motif : R252 — le CPSI émet des `case_proposal`, l'instruction/transitions/
reporting relèvent de riskcases R133–R136)** — **jamais supprimés** (traçabilité). Leur intention est
retravaillée en scénarios d'ÉMISSION (PC-09/PC-10) + les nouveaux scénarios ci-dessous pour la couverture
déplacée :

> **PC-11 — La porte CPSI n'expose AUCUNE surface produit risk-case.** Les routes directes
> `POST /cpsi/risk-cases`, `/transition`, `/notes`, `GET /risk-cases/:id|reporting` n'existent plus ;
> l'unique voie est l'émission d'un `case_proposal` (invariant négatif — remplace CP-15/16).
> **PC-12 — Le reporting SLA reste chez riskcases.** La mesure de délai hit→SAR/MROS (R39) est produite
> par le module riskcases (R133–R136), à partir des cases qu'il instruit — pas par la porte CPSI
> (remplace CP-17). Le `reporting_cases` du moteur Python demeure un outil de TEST, pas une route produit.

---

## Paramètres tenant (à inscrire au questionnaire R-Q)

| Paramètre | Défaut proposé | Règle |
|---|---|---|
| `cpsi_gate_timeout_ms` | 5000 | R251 |
| `cpsi_replay_warn_ms` | 2000 (notification, jamais blocage) | R250 |
| `cpsi_contract_version` supportées | ["1"] | R248 |

## Critères d'acceptation du bloc

1. PC-01..PC-12 verts (e2e Postgres réel) ; CP-15/16/17 marqués SUPERSEDED (non supprimés).
2. Suite plateforme verte AVEC et SANS Python installé (R251).
3. Zéro diff sous `modules/aml` et `modules/riskcases` existants (R252).
4. Moteur Python inchangé : 18/18 suites vertes, aucun fichier de `services/cpsi-server-py/olive_cpsi/`
   modifié (source normative du calcul).
5. Écart « réconciliation machines à états R83 vs R133–R136 » enregistré dans ECARTS.
6. Paramètres ci-dessus ajoutés au questionnaire R-Q.

## Ordre d'implémentation (spec-first strict, un commit par étape, suite verte à chaque frontière)

1. **R249** — journal `cpsi_events` append-only tenant-scopé (RLS + trigger). **DÉJÀ FAIT** (PR #46).
2. **R248** — enveloppe v1 versionnée (stdin/stdout) + point d'entrée CLI Python `gate_cli.py`
   (importe `olive_cpsi` sans modifier aucun fichier existant) + service Nest de shell-out. PC-01..03.
3. **R250** — meta {evenements_rejoues, duree_ms} + endpoint santé. PC-07.
4. **R251** — refus gracieux 503 typé si Python absent/timeout ; suite plateforme verte sans Python. PC-08.
5. **R252** — émission `case_proposal` (idempotent) consommable par riskcases ; **débranchement**
   CP-15/16/17 (SUPERSEDED) ; ZÉRO modif `modules/riskcases`/`modules/aml`. PC-09..12. ECARTS : réconciliation R83↔R133–R136.
6. Ajout `cpsi_gate_timeout_ms`, `cpsi_replay_warn_ms`, `cpsi_contract_version` au questionnaire R-Q.
