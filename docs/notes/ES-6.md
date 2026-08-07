# ES-6 — Extension de la série : timeline des hits screening par rejeu

Décision (demande PO : « continuer la série ES là où le rejeu est le produit ») : le contexte
suivant après les alertes est la VIE D'UN HIT screening — détection → qualification (R100–R103),
dont l'auditabilité et le rejeu ont une valeur produit directe (qui a qualifié, quand, pourquoi,
contre quelle version de liste).

## Livré
- **Monolithe (additif, gardes intactes)** : screening.service émet désormais
  `screening.hit.detecte` (à la création du hit) et `screening.hit.qualifie` (CHAQUE verdict,
  VP comme FP) — catalogués C6, validés au write. La table `screening_hits` RESTE l'état du
  monolithe (CRUD-primaire) ; le journal porte la timeline.
- **Sidecar ES** : les 2 types rejoignent DU_CATALOGUE (gardes adossées, zéro duplication) ;
  `EsHits` reconstruit l'état d'un hit et la file des hits PAR REJEU des faits d'entrée
  (`rejouerHit` pur, aucune table, aucun cache — C8).
- **Recette ES6-01..04** : rejeu → DETECTE/QUALIFIE avec timeline, rebuild from scratch
  identique, file reconstructible, et SENS UNIQUE prouvé (ES ne crée aucune ligne
  `screening_hits`).

## Discours (même doctrine que §7 du doc ES)
Après bascule humaine du shadow : « la timeline des hits screening est event-sourcée » —
jamais plus large. Les hits HISTORIQUES (antérieurs à ES-6) n'ont pas d'événement de détection :
leur timeline commence à la première qualification post-ES-6 — assumé, pas de backfill inventé.
