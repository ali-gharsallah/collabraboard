# Fiche de parité — coquille applicative (§2)

Source : `docs/reference/olive-demo.html` **44459–44800**. Port : `apps/web/src/parity/Shell.tsx`
(entrée DEV-ONLY `parity-app.html`). Fixtures : NAV, SCREEN_LABEL, NAV_MODULE_MAP, I18N, DS_STATS.

## Éléments portés (verbatim)
- **Login → shell** : `if (!currentUser)` → LoginScreen ; sinon sidebar + header + contenu.
- **Sidebar** : sélecteur langue FR/EN/DE/IT, bouton repli («/»), OliveLogo, `nav` = NAV.map
  (items + groupes accordéon + intertitres `head` + filtrage `rolesOnly` / module licencié),
  **décor « branche »** des sous-menus ouverts (ligne sage left:21 + pastilles or/feuille),
  point actif en mode replié ; **pied** : carte utilisateur, Déconnexion, « ● Systèmes
  opérationnels », tags monospace FINMA · CDB 20 · LBA · LSFin.
- **Header sticky** : titre `SCREEN_LABEL[screen]` (ou « Fiche client »/« Dossier KYC »), date
  fr-CH, bouton « 📊 Stats » (popover DS_STATS, rouge si overdueReviews>0), cloche notifications,
  bloc utilisateur (avatar dégradé + nom + rôle).
- **Routing** par état `screen` ; `goTo(id)` ; ouverture client (`openMode` client/kyc).
- **i18n** `tr(label)` (FR défaut, I18N EN/DE/IT).

## Écrans branchés
- `clients` → ClientsScreen ✅ · `kyc` → KycListScreen ✅ · `selectedClient` → KycDetailScreen
  (Annexe D — **prochaine étape**, placeholder pour l'instant) · autres → Placeholder.

## Écarts CONSIGNÉS — désormais RÉSOLUS
- **Compteurs 84 clients / 105 KYC** : la boucle déterministe de génération (+24 clients, +24 KYC,
  +12 reviews, olive-demo.html 13774–13795) est désormais portée dans `extract_demo_data.mjs`
  → fixtures complètes (CLIENTS 84, KYCS_DATA 105, ACCOUNT_REVIEWS 113). **Écart levé.**
- `isModuleLicensed` → true (tenant standard, tous modules licenciés).
- `buildNotifs` (notifs par rôle) non porté → bandeau « Aucune tâche en attente » (consigné).
- Barre supérieure `OliveNavV2` (mount séparé) : élément de shell distinct, à porter ultérieurement.
