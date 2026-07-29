# Fiche de parité — `login` (écran de connexion)

Source de vérité : `docs/reference/olive-demo.html`, lignes **44539–44578** (App, `if (!currentUser)`).
Port : `apps/web/src/parity/LoginScreen.tsx` (entrée DEV-ONLY `parity-login.html`).

## Textes (verbatim)
- Logo `OliveLogo` + tagline « CLIENT LIFECYCLE INTELLIGENCE »
- H1 « Connexion » (22 / 800) · sous-titre « Banque Olive Suisse — Plateforme O-Live » (12, inkSoft)
- Labels « EMAIL » / « MOT DE PASSE » (10, uppercase, letterSpacing 1)
- Bouton « Se connecter → » · footer « 🔐 MFA activé · Audit trail FINMA · Sessions sécurisées » (10)
- Droite : « COMPTES DE DÉMONSTRATION » · « Cliquez pour pré-remplir. Mot de passe universel : `olive2026` »
- Erreur : « ⚠ Identifiants incorrects. »

## Structure / styles clés
- Conteneur `height:100vh`, `display:flex`, `overflow:hidden`, fond `T.cream`, police Plus Jakarta Sans.
- Panneau gauche **420px**, `padding 36px 44px`, `borderRight 1px T.line`, `flexShrink:0`.
- Inputs `padding 10px 12px`, `radius 8`, `border 1.5px T.line`, focus → `T.olive600`, fond `T.cream`.
- Bouton olive `T.olive600` (hover `T.olive700`), `padding 12`, `radius 9`, `fontSize 13/700`.
- Droite `padding 28px 32px`. Groupes par `dept` (séparateur ligne—texte—ligne, 9/700).
- Grille comptes `repeat(auto-fill,minmax(190px,1fr))` gap **7** ; carte `padding 9px 12px` radius 9 ;
  avatar **26px** dégradé `linear-gradient(135deg, u.color, T.leaf)` ; nom 11/700 ; rôle 9/700 couleur `u.color` ;
  email 8 ; badge visibilité 8/700 fond `u.color+"15"`.
- Badges : `👤 Clients propres` · `👥 Tous clients` · `👁 Lecture seule` · `⚙ Admin` · sinon `📋 {visibility}`.
- Sélection/hover carte : bordure + fond teintés `u.color` (`+"12"` sélection, `+"10"` hover).

## Données
`USERS` = fixture extraite `apps/web/src/fixtures/USERS.json` (27 comptes, 10 depts). Jamais retapée (§5).

## Parité — statut
- [x] Panneau login (2 colonnes) : **conforme** (capture démo vs app, 1280×800).
- [ ] **Écart connu** : la démo affiche au-dessus une barre de navigation supérieure `OliveNavV2`
      (Annexe A, ligne 43989) — élément de coquille distinct de l'écran login, à porter au socle
      « coquille » (§2). Non inclus dans cette fiche (concerne le shell, pas le login).
- [ ] Diff automatisé pixelmatch (§8) : harnais à ajouter (dépendances `pixelmatch`/`pngjs` à proposer).
