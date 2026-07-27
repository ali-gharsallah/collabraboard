# language: fr
@propose @CPSI @porte-mince @R63-R83
Fonctionnalité: Porte HTTP mince CPSI (Nest → moteur Python) — PROPOSÉ, aucun code

  Statut: RATIFIÉ « OK pour la porte CPSI ». Implémenté (e2e `test/e2e/fat-cpsi.e2e-spec.ts`,
  contre le moteur Python réel en shell-out) :
    • Vague CPSI-1 (squelette) : CP-01 score+drivers, CP-02 rejeu à date, CP-11 ingestion
      default-deny, CP-18 isolation.
    • Vague CPSI-2 (lectures, zéro écriture) : CP-03 segmentation, CP-07 catalogue conformité,
      CP-08 règles en clair.
    • Vague CPSI-3 (groupes, ciblage, alertes) : CP-04/05 groupes & appartenance & registre,
      CP-06 scénario ciblé (+ default-deny groupe inconnu), CP-12 signaux scorés / alertes /
      near-miss / corrélations. Écritures gouvernées `definir_groupe` / `definir_scenario_aml`
      VALIDÉES par rejeu avant persistance (opérateur/sens/groupe invalide → 4xx).
    • Vague CPSI-4 (gouvernance & investigations) : CP-09 bac à sable (dry-run, 0 mutation +
      default-deny), CP-10 IA propose / humain adopte / rejet à motivation obligatoire,
      CP-13 faux-positif, CP-14 insider MAR (habilitation par le rôle du jeton, motif obligatoire),
      CP-15/16/17 risk cases (ouverture, transitions, reporting) — ⚠ SUPERSEDED par R252 (voir
      amendement `catalogue-amendement-R248-R252-porte-cpsi.md`) : à débrancher vers émission `case_proposal`.
  → PORTE COMPLÈTE : CP-01..18 câblés et verts (e2e 18 tests) ; CP-19 (la porte ne calcule rien)
    = invariant tenu par construction (toute valeur vient d'un appel au moteur ratifié).
  Décisions actées : Q1/Q2 = journal append-only Postgres (`cpsi_events`, RLS) rejoué vers le
  moteur ; Q3 = complète (frontière avec riskcases R133-136 documentée, aucune route existante
  touchée) ; Q4 = shell-out `services/cpsi-server-py/bridge.py`.

  Doctrine de la porte (pattern PT-01, comme workflow-instances / ports) :
    • La porte RELAIE / PROJETTE / CALCULE via le moteur ratifié `services/cpsi-server-py`
      (R63→R83). Elle ne DÉCIDE rien de neuf et n'ajoute AUCUNE règle au canon.
    • Source de vérité = le moteur Python. La porte NE réimplémente PAS les règles.
    • Tenant-scopée : chaque appel porte le tenant du jeton ; isolation stricte (RLS-équivalent).
    • Auteur = `ctx.userId` (jeton), JAMAIS le corps, sur toute écriture tracée.
    • Rejeu à date `?asOf=` (R48/R49) sur les surfaces de lecture (score, segmentation,
      groupes, catalogue, alertes) — la config en vigueur ce jour-là (R68).
    • Default-deny préservé : type de signal / opérateur de groupe / paramètre inconnu → erreur
      (le moteur lève `CpsiError`, la porte la traduit en 4xx, ne l'avale jamais).
    • Habilitations relayées : `roles_insider` (R75), R44 humain pour décisions de case,
      R69 humain pour adoption de proposition.
    • AUCUN nouveau numéro de règle : la porte est une SURFACE d'exposition, pas du canon.
      Toute divergence exigée en implémentation ⇒ nouvelle R-number ratifiée d'ABORD.

  # ─────────────────────────────────────────────────────────────────────────────
  # QUESTIONS DE CONCEPTION À TRANCHER À LA RATIFICATION (impactent le comportement)
  #
  #  Q1 — Modèle d'état. Le moteur est EN MÉMOIRE (pas de DB). Comment la porte obtient
  #       l'état CPSI d'un tenant à chaque requête ?
  #         (a) rejeu depuis un journal append-only persisté (R49) à la demande ;
  #         (b) instance moteur persistée / mise en cache par tenant ;
  #         (c) store d'état délégué (Postgres RLS) que la porte hydrate.
  #       → impacte directement le rejeu à date et l'isolation.
  #  Q2 — Persistance des écritures (ingestion de signaux, groupes, scénarios, insider,
  #       cases). Où ? Postgres tenant-scopé (RLS) rejoué vers le moteur, ou store propre
  #       au process Python ? Le canon exige append-only + trace tenant (R48/R49).
  #  Q3 — Frontière avec l'AML déjà en Nest (modules/aml, riskcases R133–R136). La porte
  #       CPSI complète-t-elle ou recouvre-t-elle ces risk cases ? Éviter le double canon.
  #  Q4 — Transport Nest↔Python (tranché séparément) : serveur HTTP Python vs shell-out.
  #       N'affecte pas le CONTRAT ci-dessous, seulement le câblage.
  # ─────────────────────────────────────────────────────────────────────────────

  Contexte:
    Étant donné un tenant T avec sa configuration CPSI (poids, half-life, bandes — R68)
    Et un jeton portant tenant=T, userId=U, role=R
    Et le moteur de référence CPSI comme unique source de vérité des règles R63–R83

  # ── Lecture : score, drivers, bande (R63/R64/R67/R66) ──
  Scénario: CP-01 Score perpétuel avec drivers explicables (R63/R67)
    Quand la porte GET /v1/cpsi/clients/{cid}/score est appelée
    Alors elle relaie `score_a_date(cid, now)` du moteur
    Et la réponse porte le score, sa bande (R66) et les drivers dont la somme reconstitue le score
    Et aucune donnée n'est mutée (lecture pure)

  Scénario: CP-02 Rejeu du score à une date antérieure (R48/R64/R68)
    Étant donné des signaux ingérés à des dates distinctes
    Quand la porte GET /v1/cpsi/clients/{cid}/score?asOf=2026-03-01 est appelée
    Alors elle relaie `score_a_date(cid, 2026-03-01)` avec la config en vigueur ce jour-là
    Et la décroissance temporelle (R64) s'applique aux signaux ≤ asOf uniquement

  # ── Segmentation en groupes de pairs (R65) ──
  Scénario: CP-03 Segmentation déterministe et explicable (R65)
    Quand la porte GET /v1/cpsi/segmentation?asOf= est appelée
    Alors elle relaie `segmenter(asOf)` (grille quantile statique B/M/H × CALME/ACTIF/INTENSE)
    Et chaque client porte un segment stable + son anomalie z-score au sein du groupe de pairs
    Et aucun label n'est permuté d'un appel à l'autre (déterminisme)

  # ── Groupes de population & barèmes & ciblage (R71/R72/R73) ──
  Scénario: CP-04 Groupes d'un client et groupe primaire (R71/R72)
    Quand la porte GET /v1/cpsi/clients/{cid}/groups?asOf= est appelée
    Alors elle relaie `groupes_de(cid, asOf)` et `groupe_primaire(cid, asOf)`
    Et le barème effectif exposé est celui du groupe primaire (héritage global à défaut)

  Scénario: CP-05 Registre des groupes et effectifs (R71/R74)
    Quand la porte GET /v1/cpsi/groups?asOf= est appelée
    Alors elle relaie `decrire_groupes(asOf)` (prédicats, priorités, barèmes, effectifs) en clair

  Scénario: CP-06 Évaluation d'un scénario AML ciblé par groupe (R73)
    Quand la porte GET /v1/cpsi/scenarios/{sid}/evaluate?asOf= est appelée
    Alors elle relaie `evaluer_scenario(sid, asOf)`
    Et SEULS les membres des groupes visés sont évalués (les hors-périmètre jamais)

  # ── Catalogue de conformité, lecture seule (R79) ──
  Scénario: CP-07 Catalogue de conformité en lecture seule (R79)
    Quand la porte GET /v1/cpsi/compliance-catalogue?asOf= est appelée
    Alors elle relaie `catalogue_conformite(asOf)` (ATTR_DEFS + paramètres exacts des scénarios)
    Et la porte n'expose aucune route d'écriture sur ce catalogue

  # ── Gouvernance des paramètres de calcul (R68 / R69 / R70) ──
  Scénario: CP-08 Description des règles de calcul en clair (R68)
    Quand la porte GET /v1/cpsi/rules?asOf= est appelée
    Alors elle relaie `decrire_regles(asOf)` (formules en français, valeurs courantes)

  Scénario: CP-09 Bac à sable — simulation d'impact sans mutation (R70)
    Quand la porte POST /v1/cpsi/sandbox/simulate {changements} est appelée
    Alors elle relaie `simuler_impact(changements, now, acteur=U)`
    Et la réponse porte Δ scores, franchissements nominatifs, nouveaux HIGH, charge de revues
    Et AUCUN paramètre n'est muté (dry-run, 0 écriture)

  Scénario: CP-10 IA propose, humain décide — proposition puis adoption tracée (R69)
    Quand la porte POST /v1/cpsi/params/proposals {chemin, valeur, justification} est appelée
    Alors elle relaie `proposer_parametre(auteur=U, …)` sans aucun effet immédiat
    Et POST /v1/cpsi/params/proposals/{pid}/adopt relaie `adopter_proposition(pid, humain=U, now)`
    Et le rejet POST …/reject EXIGE une motivation (R69), sinon 4xx (CpsiError relayée)

  # ── Signaux scorés, alertes, near-miss, corrélations (R80/R81/R82) ──
  Scénario: CP-11 Ingestion d'un signal — default-deny sur type inconnu (R63)
    Quand la porte POST /v1/cpsi/clients/{cid}/signals {type, severite, at} est appelée
    Alors elle relaie `ingester_signal(cid, type, severite, at, meta)` avec auteur=U tracé
    Et un type de signal inconnu est REFUSÉ (default-deny) — la porte renvoie 4xx, n'avale rien

  Scénario: CP-12 Signaux scorés dédupliqués et alertes au seuil X (R80/R81)
    Quand la porte GET /v1/cpsi/alerts?asOf=&seuil= est appelée
    Alors elle relaie `signaux/alertes/analyses/correlations(asOf, seuil)`
    Et il y a UN signal scoré par (client, scénario) (dédup R81)
    Et une alerte = score ≥ X ; sous X = near-miss ou analyse (vocabulaire R80)

  Scénario: CP-13 Rétroaction faux-positif — pénalité escaladante tracée (R82)
    Quand la porte POST /v1/cpsi/false-positives {client, scenario} est appelée
    Alors elle relaie `declarer_faux_positif(client, scenario, acteur=U, now)`
    Et la pénalité escaladante s'applique tant que `fp_suppression_active` (paramètre tenant)

  # ── Insider / MAR (R75) ──
  Scénario: CP-14 Marquage insider réservé aux rôles habilités (R75)
    Étant donné que le role R n'est pas dans `roles_insider`
    Quand la porte POST /v1/cpsi/clients/{cid}/insider {motif} est appelée
    Alors la porte relaie `taguer_insider(cid, acteur=U, role=R, motif, now)`
    Et le moteur REFUSE (habilitation) — la porte renvoie 403, motif obligatoire préservé
    Et la levée POST …/insider/lift exige elle aussi une motivation

  # ── Risk cases (R83) — SUPERSEDED par R252 (2026-07-27) ────────────────────────────────
  # ⚠ SUPERSEDED (2026-07-27, amendement R248-R252 · R252). Motif : la frontière avec riskcases
  # R133-R136 est DIRECTIONNELLE — le CPSI ÉMET des `case_proposal`, il n'expose plus de surface
  # produit risk-case (ouverture/transitions/reporting relèvent de riskcases). Conservés pour
  # traçabilité, JAMAIS supprimés. Intention retravaillée → PC-09/PC-10 (émission, idempotence) et
  # couverture déplacée → PC-11 (aucune surface produit risk-case sur la porte) / PC-12 (reporting
  # SLA chez riskcases). Le code CP-15/16/17 sera débranché à l'étape R252 (impact signalé d'abord).
  @superseded @by-R252
  Scénario: CP-15 [SUPERSEDED R252] Ouverture d'un risk case depuis des alertes corrélées (R83/R81)
    Quand la porte POST /v1/cpsi/risk-cases {alertes} est appelée
    Alors elle relaie `ouvrir_risk_case(alertes, acteur=U, now)` (statut NOUVELLE)
    Et le regroupement suit la corrélation (≥1 alerte d'un même client)

  @superseded @by-R252
  Scénario: CP-16 [SUPERSEDED R252] Transitions de risk case — motif obligatoire, humain décide (R83/R7/R44)
    Étant donné un risk case en EN_ANALYSE
    Quand la porte POST /v1/cpsi/risk-cases/{id}/transition {action, motif} est appelée
    Alors elle relaie `transition_risk_case(id, action, acteur=U, now, motif)`
    Et clore / escalader / clarifier EXIGE un motif (R7), sinon 4xx
    Et ESCALADEE oriente vers la voie MROS/SAR (terminal), append-only (R48/R49)

  @superseded @by-R252
  Scénario: CP-17 [SUPERSEDED R252] Reporting SLA des cases — mesure, jamais coercition (R39)
    Quand la porte GET /v1/cpsi/risk-cases/reporting?slaJours=30 est appelée
    Alors elle relaie `reporting_cases(30)` (délais, dépassements)
    Et le rapport MESURE et NOTIFIE sans rien bloquer (R39)

  # ── Isolation & non-régression ──
  Scénario: CP-18 Isolation tenant stricte
    Étant donné deux tenants T1 et T2 avec des clients homonymes
    Quand la porte est appelée avec le jeton de T1
    Alors seules les données CPSI de T1 sont visibles ; T2 reste invisible

  Scénario: CP-19 La porte ne décide ni ne recalcule hors moteur (PT-01)
    Quand n'importe quelle surface de la porte est appelée
    Alors aucun score, segment, alerte ou case n'est calculé par la porte elle-même
    Et toute valeur provient d'un appel au moteur ratifié (source de vérité unique)
