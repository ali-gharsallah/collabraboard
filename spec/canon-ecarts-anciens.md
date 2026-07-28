# O-Live — Canon des ÉCARTS ANCIENS
# Réconciliation R83↔R133–R136 (R280) · Timeline & SLA hit→MROS via la porte (R281) ·
# Versionnage de la matrice de droits (R282) · Questionnaires de review (R283)

**Statut : RATIFIÉ le 2026-07-28 (Ali) — mapping RS→RW + PC-16..19 ratifié · mapping R280
ratifié (resserrement CLARIFICATION→CLOTUREE côté produit, extension ESCALADEE→CLOTUREE
consignée hors modèle de référence) · contrat 1.1 par ALIAS ratifié (PC-12 v1 amendé, son
invariant conservé : aucune écriture riskcases via la porte).**

## VERDICT ÉTAPE 0 (exécutée sur le repo réel)

- **0a Numérotation R280–R283 : LIBRE** ✓ (aucune occurrence dans spec/, src/, moteurs).
- **0b Familles** : **UC libre ✓ · VD libre ✓ · RS EN COLLISION** ✗ — RS-01..06 sont pris
  par la Recherche (R148–R151, `recherche.service.ts`). **Mapping proposé : RS → RW**
  (review), RW-01..05 — famille RW vérifiée libre. **PC-11..14 EN COLLISION** ✗ —
  PC-01..15 sont TOUS pris (PC-11 : routes risk-case directes absentes ; PC-12 :
  reporting SLA hors porte ; PC-13 volumétrie ; PC-14 timeline ; PC-15 vigueur —
  extension R248-R252 ratifiée le 2026-07-27). **Mapping proposé : les 4 scénarios
  porte deviennent PC-16..PC-19.**
- **0b-bis RECOUVREMENT partie 2 (signalé)** : le contrat v1 livré porte DÉJÀ
  `timeline` (≈ timeline_client, PC-14 vert) et `volumetrie` (≈ reporting_volumetrie,
  PC-13 vert). Seuls `reporting_sla` et le versionnage d'enveloppe « 1.1 » sont
  nouveaux. Proposition : la 1.1 déclare les NOMS CANON (timeline_client,
  reporting_volumetrie) comme alias des commandes livrées — zéro duplication.
  **Conséquence à ratifier** : le test PC-12 v1 (« reporting SLA hors porte, chez
  riskcases ») est PARTIELLEMENT SUPERSÉDÉ par R281 (reporting_sla entre au contrat
  de porte) — son invariant conservé : aucune route d'ÉCRITURE riskcases via la porte.
- **0c Mapping R280 (dressé sur le code réel) — ÉTATS 1:1, DEUX TRANSITIONS NON
  BIJECTIVES → STOP ratification** :

  États (identiques des deux côtés — mapping trivial ratifiable tel quel) :
  | R83 (moteur `olive_cpsi/engine.py` l.656) | Canonique R133–R136 (`risk-case.service.ts` l.18) |
  |---|---|
  | NOUVELLE | NOUVELLE (état d'entrée — création, y c. depuis case_proposal) |
  | EN_ANALYSE | EN_ANALYSE (instruction) |
  | CLARIFICATION | CLARIFICATION (attente d'information, ↔ EN_ANALYSE) |
  | CLOTUREE | CLOTUREE (terminal motivé R7, cohérence dossier R136) |
  | ESCALADEE | ESCALADEE (terminal motivé → voie MROS R129–R132) |

  Transitions — les DEUX écarts à arbitrer :
  | Transition | Moteur R83 | Produit R133–R136 | Proposition |
  |---|---|---|---|
  | CLARIFICATION → CLOTUREE | ✓ (`clore` direct) | ✗ (impose CLARIFICATION→EN_ANALYSE→CLOTUREE) | Ratifier le RESSERREMENT produit : la clôture exige la reprise d'analyse tracée ; consigné au mapping comme « transition de référence non exposée » — le moteur reste intouché |
  | ESCALADEE → CLOTUREE | ✗ (ESCALADEE terminal) | ✓ (clôture post-escalade, gardée R136) | Ratifier l'EXTENSION produit : clôture administrative APRÈS communication MROS, hors modèle de référence — consignée au mapping |

- **0d** : canon enregistré ici ; index mis à jour ; les 4 entrées ECARTS pointent vers
  ce canon (SOLDE à la fin de chaque partie, pas avant).
- **Pré-conditions signalées** : la « PR CoC R276 » n'existe pas comme PR séparée —
  R276-R278 sont LIVRÉS sur la branche unique #46 (arbitrage branche unique, ratifié
  2×) : la dépendance de la partie 4 est satisfaite EN SUBSTANCE. « Livrable : 4 PRs »
  → même arbitrage : branche unique #46, sauf contre-ordre explicite.

## RATIFICATION POST-LIVRAISON (2026-07-28, Ali — après livraison des 4 parties)

- **Dépendance partie 4 → R276 : lecture « satisfaite en substance » RATIFIÉE.** Le canon
  exigeait « PR CoC R276 mergée sinon STOP » ; R276-R278 vivent sur la branche unique #46
  (arbitrage branche unique) et la chaîne réelle est PROUVÉE par RW-02 : « Signaler un
  changement » ouvre un CoC OUVERT (CC-01) qui suit son cycle. Aucun STOP requis.
- **Mapping R280 : VISA HUMAIN d'Ali — consigné comme LA décision non délégable.** Les deux
  transitions non bijectives (resserrement CLARIFICATION→CLOTUREE côté produit ; extension
  ESCALADEE→CLOTUREE hors modèle de référence) ont été ratifiées par Ali en séance
  (AskUserQuestion « Ratifier les 2 », 2026-07-28) et le visa est CONFIRMÉ ce jour. Point
  d'attention permanent : toute évolution future de ce mapping (nouvel état, nouvelle
  transition, divergence moteur↔produit) REMONTE pour visa humain — Claude Code ne tranche
  jamais seul une réconciliation de machines à états ; il dresse le mapping, STOP, et
  attend la ratification (précédent : ce document, section 0c).

---

# TEXTE DU CANON (tel que proposé — les numéros de scénarios porte se lisent PC-16..19,
# la famille RS se lit RW, sous réserve de ratification du mapping ci-dessus)

# PARTIE 1 — RÉCONCILIATION R83 ↔ R133–R136 (R280)

### R280 — UNE machine à états canonique pour les risk cases — le produit fait foi, le moteur s'y mappe
La machine de R133–R136 (produit Nest) est LA machine canonique. La machine R83 du
moteur Python devient un modèle de référence de test qui doit se mapper bijectivement
sur la canonique (table ratifiée ci-dessus, section 0c). Conséquences :
- Un case_proposal (R252) consommé crée un riskcase dans l'état d'entrée canonique
  (NOUVELLE) — jamais dans un état intermédiaire.
- Les transitions exigent les motifs/rôles de R133–R136 (existants) — R280 n'ajoute
  aucune transition, il interdit d'en avoir deux jeux.
- Les suites Python (bloc 14, RC-01..05) restent vertes TELLES QUELLES ; le moteur
  reste intouchable.
> UC-01 — La proposition entre par la porte d'entrée (état NOUVELLE, idempotence PC-10).
> UC-02 — Le mapping est total (test de conformité côté Nest ; état orphelin = échec).
> UC-03 — Un seul jeu de transitions (transition hors R133-R136 → refus typé).

# PARTIE 2 — TIMELINE & SLA HIT→MROS VIA LA PORTE (R281 + PC-16..PC-19)

Contrat d'enveloppe 1.1 (1.0 servie en compatibilité) : `timeline_client` (alias de
`timeline` livrée), `reporting_volumetrie` (alias de `volumetrie` livrée),
`reporting_sla` (NOUVELLE — chaîne t0→t1→t2).

### R281 — Le délai hit→MROS est une CHAÎNE de références — mesurée par rejeu, jamais bloquante
t0 = signal scoré devenu alerte (journal CPSI R249) ; t1 = transition ESCALADEE du
riskcase issu du signal (chaîne signal → case_proposal → riskcase, références R252/
UC-01 PORTÉES dans les événements) ; t2 = communication MROS référencée au riskcase.
Calcul PAR REJEU des journaux (aucune table SLA matérialisée — pattern EN_RETARD/R274).
Seuils tenant `sla_hit_escalade_jours` (30) / `sla_escalade_mros_jours` (5) : le
dépassement NOTIFIE (R39), l'absence de maillon EST une donnée visible.
> PC-16 — La timeline traverse la porte (as_of strict, ordre seq, meta R250, default-deny).
> PC-17 — Le contrat 1.1 coexiste avec 1.0 (commandes 1.1 en enveloppe 1.0 → erreur
> typée « version » ; PC-01..03 re-passent en 1.1).
> PC-18 — La chaîne t0→t1→t2 se remonte par rejeu ; maillons append-only.
> PC-19 — Le dépassement notifie ; « en attente MROS : N jours » visible au reporting.

# PARTIE 3 — VERSIONNAGE DE LA MATRICE DE DROITS (R282)

### R282 — L'ACCÈS suit la matrice COURANTE, la COMPLÉTUDE suit la matrice du dossier
Matrice versionnée à date (effective_from/effective_to, append-only des versions
closes, trigger). Double règle de lecture :
- Face sécurité (HIDDEN/VIEW/EDIT) : matrice EN VIGUEUR au moment de l'accès — la
  sécurité ne se grandfathère pas.
- Face complétude (REQUIRED) : matrice en vigueur À LA CRÉATION du dossier (R29) ;
  sbkyc/SB-03 reste le garde-fou avant application.
Résolution par dates (aucun champ version recopié sur les dossiers). Événement
ACCESS_MATRIX_CHANGED (auteur, avant/après, date d'effet). SD-04 est LEVÉ, précisé
par la présente règle.
> VD-01 — La sécurité est immédiate (VIEW→HIDDEN vaut aussi pour les dossiers anciens ;
> SD-03 re-vérifié). VD-02 — La complétude est grandfathérée (REQUIRED à effet J :
> J-10 se valide sans, J+1 l'exige). VD-03 — L'historique se rejoue (matrice du 15.03 ;
> UPDATE d'une version close → exception). VD-04 — Le changement est un événement visé
> (change tracker sdkyc, SD-01 étendu).

# PARTIE 4 — QUESTIONNAIRES DE REVIEW : UN SEUL MODÈLE (R283)

### R283 — La review N'A PAS son propre questionnaire — elle SÉLECTIONNE dans le KYC
Une review (AR périodique, GAR grande review) est un KYC Rn+1 (R275) filtré par un
profil de review versionné à date : review_profiles[{AR|GAR} × {SDD|CDD|EDD}] =
{ sections actives, questions REQUIRED ajoutées, sections en re-confirmation simple }.
Re-confirmation : « Confirmer » = visa tracé ; « Signaler un changement » ouvre un CoC
(R276) qui suit son cycle. Droits = matrice R282 (aucune matrice parallèle) ; visas =
R15. sdar/sdgar = écrans de SÉLECTION sur le composant de grille commun de sdkyc
(un composant, trois configurations) ; projection de charge via sbkyc (SB-03). GAR =
profil plus large, sans particularité de modèle.
> RW-01 — Le profil sélectionne, le modèle est unique (aucune table parallèle).
> RW-02 — La re-confirmation ouvre le bon circuit (CoC OUVERT / visa tracé).
> RW-03 — Le profil est versionné et grandfathéré (R29).
> RW-04 — sdar/sdgar rendent, ne dupliquent pas (composant commun ; écrivent seulement
> review_profiles). RW-05 — La validation de review referme la boucle (RV-07 : chaîne
> R283→R275→R272 de bout en bout).

# ORDRE DE LIVRAISON (après ratification) : 1) R280 (UC-01..03) · 2) R281 (PC-16..19,
# point d'entrée Python NOUVEAU important olive_cpsi sans le modifier ; rebranche AW
# zone 2 + Reporting ; re-passe AW-04) · 3) R282 (VD-01..04 ; lève SD-04) · 4) R283
# (RW-01..05 dont RW-05 en chaîne avec RV-07).
# INTERDITS : second jeu de transitions ; table SLA matérialisée ; version de matrice
# recopiée ; table de questionnaire parallèle ; toucher olive_cpsi/* ; code avant test.
