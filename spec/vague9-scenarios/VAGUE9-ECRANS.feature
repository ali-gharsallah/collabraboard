# language: fr
Fonctionnalité: Vague 9 — Bac à sable AML : dry-run d'un seuil (spec-first)
  Statut: Vague 9
  Écran: Sandbox AML — « voir avant d'écrire » (R94, scénario B-02)
  Doctrine: projection du canon ratifié (R94). Zéro invention.
  Le moteur PUR ratifié (R189→R206) est rejoué sur des contextes réels avec les seuils
  ACTUELS puis SIMULÉS. La simulation ne crée NI signal, NI tâche, NI case (R70/R94) :
  la lecture seule prouve le dry-run. L'application reste un acte gouverné au registre R-Q.

  # ── B-02 : voir avant d'écrire ──
  Scénario: V9-DRYRUN — un seuil simulé montre l'impact nominatif, sans aucune écriture
    Étant donné un scénario AML paramétré (structuring, seuil par défaut)
    Et un client dont les virements ne franchissent PAS le seuil actuel
    Quand un seuil simulé est modifié (amlStructuringSeuilChf relevé)
    Alors le système affiche les alertes avant, après, les nouvelles et les disparues
    Et chaque alerte nouvelle est nommée (client, fait, règle franchie)
    Et aucune écriture n'est effectuée (ni signal, ni tâche, ni case — R70)

  # ── Proposer n'est pas appliquer ──
  Scénario: V9-APPLY — la simulation ne matérialise rien ; l'application passe par le registre
    Étant donné un seuil simulé au bac à sable
    Quand je consulte la valeur effective du seuil après la simulation
    Alors elle est INCHANGÉE (la simulation n'écrit pas — R94)
    Quand j'applique le changement via le registre R-Q (motivé, R126)
    Alors la valeur effective est écrite avec sa date de mise en vigueur (R29) et journalisée
