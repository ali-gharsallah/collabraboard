# Câblage back→front complet (2026-08-07)

Demande PO : « tout le back câblé au front avec de belles interfaces ». Passe exhaustive
mesurée : chaque famille de routes du snapshot (`tools/api-contract/api-surface.snapshot.txt`)
confrontée aux sources front — 7 familles sans AUCUN consommateur, plus les sous-routes
goAML/gouvernance O, plus le module surveillance-es qui n'avait pas d'API.

## Câblé dans cette passe

| Backend | Écran | Notes |
|---|---|---|
| `/v1/rapports/*` (KPI P-L8-2 + 4 registres R50) | **Rapports conformité** (nouvel écran, g_comp) | définitions servies affichées avec les chiffres ; CSV trimestriel téléchargé tel que servi |
| `/v1/mros/:id/goaml*` + `chrono/tick` (P-L8-1) | section goAML dans **Reporting MROS** | brouillon XML servi (XSD-subset), soumission MANUELLE tracée (référence obligatoire), chrono J+5 idempotent |
| `/v1/olivia/gouvernance/*` (P-L8-3) | **Gouvernance O** (nouvel écran, g_data) | curseur = acte confirmé (événement catalogué serveur), rapport de valeur avec définitions |
| `/v1/ia/prerevue/*` (R121–R124) | **Pré-revue IA** (nouvel écran, g_comp) | chaque point se traite/écarte par un humain, motif via la porte (R123) |
| `/v1/workload/*` (R183–R185) | **Capacité équipe** (nouvel écran, g_front) | jauges de charge servies, signal SANS déplacement (R184), réassignation motivée (R7) |
| `/v1/surveillance-es/*` (NOUVELLE API lecture seule) | **Surveillance ES** (nouvel écran, g_audit) | vues par rejeu (alertes ES-2, hits ES-6, PEP ES-7) + état souscripteur ; bandeau shadow permanent — l'état du monolithe fait foi |
| `GET /v1/deploiements` (R330/RZ-04) | panneau dans **Config & Go-live** | lecture seule : le POST appartient au pipeline, jamais à un écran |

Doctrine appliquée : `apiGetSourced`/`apiPost` (un seul point de sortie réseau),
`DemoModeBanner` obligatoire, portes de confirmation sur tout acte, tokens de thème,
t() partout (les 5 nouveaux écrans NAISSENT dans la liste CONVERTIS du cliquet R326),
libellés nav traduits EN/DE/IT + pack AR. Budget bundle relevé 225→240 (commit motivé,
~10 kB gz de chunks lazy — le chargement initial ne bouge pas). Snapshot RB-07 régénéré
(384→390 routes).

## Volontairement SANS écran (justifié)

- `GET /v1/healthz` / `readyz` / `apidoc` : sondes techniques (R330) et documentation
  d'API — consommées par le pipeline et les outils, pas par un utilisateur.
- `POST /v1/deploiements` : acte du pipeline de déploiement (RZ-02), pas d'un écran.
- `POST /v1/ia/prerevue/prompt` (R124 versionner le prompt) : acte de gouvernance éditeur,
  pas exposé dans l'écran tenant — à câbler dans la console éditeur si demandé.

## Maquette démo (2026-08-07, suite : « le html démo doit suivre cette évolution »)

`demo/olive-demo.html` reflète désormais les 5 écrans : entrées NAV dans les mêmes groupes
de domaine que le front, libellés I18N EN/DE/IT (mêmes traductions que le dict du front),
et 5 écrans de démo STATIQUES dans le style de la maquette (createElement + thème T).
Les données y sont ILLUSTRATIVES (tenant GWB) — c'est la nature de la maquette ; le vrai
front, lui, n'affiche que ce que l'API sert. Le discours y reste conforme : bandeau shadow
ES (« l'état du monolithe fait foi »), R44/R123/R184 rappelés dans les titres.
Smoke Playwright : 78/78 écrans sains (73→78). `docs/reference/olive-demo.html` reste
la référence FIGÉE d'origine du portage parité — volontairement non modifiée.

## Découverte HORS PÉRIMÈTRE (pas de correction opportuniste)

`apps/web/package.json` a un script `typecheck: tsc --noEmit` mais AUCUN `tsconfig.json`
dans apps/web : le script imprime l'aide de tsc et sort en erreur. La CI ne type-vérifie
que apps/api (étape 1) — les gates web réels sont vitest + vite build (qui compile le TS).
À trancher : ajouter un tsconfig web (et assumer la vague d'erreurs strict à purger) ou
retirer le script menteur. Décision hors de cette session.
