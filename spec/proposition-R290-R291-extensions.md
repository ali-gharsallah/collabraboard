# O-Live — PROPOSITION R290-R291 : les deux extensions consignées du canon triage
# R290 : extension MOD-30 → `ssoparam` débloqué (IM-01/03/04) · R291 : compléments
# Command Center (DC-06/07 — charge compliance + dead-letters Direction)

**Statut : PROPOSÉ — en attente de ratification par Ali Gharsallah.**

## VERDICT ÉTAPE 0 (exécutée sur le repo réel, 2026-07-28)

- **0a Numérotation R290, R291 : LIBRES** ✓. Scénarios : IM-01/03/04 (déjà au canon
  triage, en attente) · **DC-06, DC-07 : libres** ✓ (extension de la famille DC ratifiée).
- **0b Existant vérifié** : `KeyStore.rotate()` EXISTE (trousseau RS256 en mémoire,
  période de grâce — la route ne fait que COMMANDER et TRACER, rien à inventer) ·
  config OIDC actuelle = environnement (`OIDC_ISSUER`/`OIDC_AUDIENCE`/`OIDC_ROLE_MAPPING`),
  AUCUN secret dans `OidcConfig` (le client_secret éventuel reste env/coffre) · la garde
  T9 de `GET /v1/events/sante` est `["ADMIN","SO"]` (une ligne à étendre) · le patron
  Tuile partagé est en place (R289).

## R290 (PROPOSÉ) — Extension MOD-30 : la porte d'entrée de la banque se pilote, tracée

1. **Clé R-Q `ssoOidc`** (json, sans AUCUN secret) : {issuer, audience, roleMapping,
   defaultRole} — la config DÉCLARÉE du tenant, écrite par LE registre (motivé, versionné
   à date R68 — gratuit). Le client_secret vit au coffre/env : l'état le dit
   « configuré/absent », JAMAIS la valeur (IM-01). **Écart consigné** : le login OIDC
   effectif lit encore l'environnement (résolution per-tenant au login = extension
   future signalée, pas silencieuse).
2. **`GET /v1/admin/sso/etat`** (ADMIN) : {oidc: {issuer, audience, secretConfigure:
   bool}, jwks: {kidCourant, derniereRotation}, mode, basculeEnAttente?} — lecture seule.
3. **`POST /v1/admin/sso/test`** (ADMIN) : DRY-RUN tracé — valide la forme de la config
   déclarée + l'état du trousseau, ne change RIEN ; événement `sso.test` {par, resultat,
   at} (IM-03 : qui a testé quoi, quand).
4. **`POST /v1/admin/sso/jwks/rotation`** (ADMIN, motif R7) : commande `KeyStore.rotate()`
   — événement `sso.jwks.rotation` {par, kidAvant, kidApres, motif} ; les jetons signés
   avant rotation restent vérifiables (grâce — déjà structurel).
5. **Bascule de mode (IM-04, R13/R68)** : `POST /v1/admin/sso/mode` {vers, effetAt, motif}
   → demande EN ATTENTE (l'initiateur ne l'applique pas) ; `POST /v1/admin/sso/mode/visa`
   par un SECOND ADMIN → la bascule s'applique à sa date d'effet (clé `sso_mode`
   matérialisée au registre). Sessions du jour GRANDFATHÉRÉES : `sso_bascule_coupe_sessions`
   (bool, défaut faux) — structurel : la vérification par kid ne coupe rien.
6. **Écran `ssoparam`** (57e onglet) : état rendu, test, rotation motivée, bascule à deux
   regards — les refus backend affichés tels quels (pattern IM-02).

> Scénarios : **IM-01** (le secret ne descend jamais — inspection réseau e2e),
> **IM-03** (dry-run tracé, config inchangée), **IM-04** (bascule four-eyes + effet à
> date + sessions grandfathérées).

## R291 (PROPOSÉ) — Compléments Command Center : les deux tuiles amputées reviennent

1. **`GET /v1/kyc/visas/charge`** (DIR, CO_SR) : agrégat SERVI — visas PENDING par
   requiredRole (tenant entier) + le plus ancien par rôle. AUCUN chiffre front : le
   backend agrège (l'endpoint signalé à l'étape 0.c du triage, ici ratifié).
   → Tuile « Charge compliance » ajoutée au Command Center (drill vers l'écran KYC).
2. **Matrice T9 étendue à DIR** : `GET /v1/events/sante` passe à `["ADMIN","SO","DIR"]`
   — la Direction VOIT la santé du transport (lecture seule, aucune donnée client dans
   les dead-letters : consumer/seq/erreur). Le rejeu reste ADMIN/SO (écrire n'est pas
   piloter). → Composant dead-letters ajouté à la tuile « Santé plateforme ».

> Scénarios : **DC-06** (la tuile Charge affiche l'agrégat servi par rôle ; un RM
> n'obtient pas l'agrégat — 403), **DC-07** (DIR lit /v1/events/sante ; le REJEU d'une
> dead-letter par DIR reste refusé — piloter n'est pas opérer).

### Interdits (hérités)
Secret en clair dans une réponse ; bascule sans second regard ; rotation sans motif ;
chiffre front ; action depuis le Command Center ; code avant test.

**Livrable proposé** : 2 séquences de commits sur la branche unique PR #46 (R290 puis R291).
