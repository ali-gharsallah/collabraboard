# Fiche de parité — `persons` (PersonsScreen) — v1

Source : `docs/reference/olive-demo.html` **17657–17752** (vue Liste détaillée) + PEP_STYLE 17541,
LEGAL_STRUCTURES 17516. Port : `apps/web/src/parity/PersonsScreen.tsx`. Données : PERSONS_DATA (120).

## Porté (v1) — verbatim
- KPI (StatsToggle → null, B.6) : Personnes référencées · Rôles multiples · PEP/Near-PEP · Rôles documentés.
- Bascule « Liste détaillée » / « Vue graphe ».
- Liste : en-tête « Personnes & rôles (N) » + « ＋ Lier une personne » + recherche (Nom/pays/PEP) ;
  lignes dépliables (avatar rond=PP / carré=structure, nom, drapeau, badge LEGAL_STRUCTURES, pilule
  PEP/Near-PEP) ; déplié = « Rôles officiels » (entité, part %, rôle, structure) + « Relations (non
  officielles) » + encart PEP (« ne se propage qu'après validation du KYC », bouton 🔒 Dé-PEP réservé).
  Pagination 30/page.

## CONSIGNÉ — prochaine session
- **Vue graphe** (17753+) : graphe nœuds personnes↔comptes, rebond de proximité — placeholder.
- **LierPersonnePopup** (17550) : recherche live + création + attribution de rôles cumulables —
  modale allégée (référentiel + habilitation R152/R155) à porter.
- Champs `relations` / `pepNote` absents de la fixture PERSONS_DATA (→ « Aucune relation »).
