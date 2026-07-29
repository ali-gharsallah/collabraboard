# O-Live — DOSSIER SÉCURITÉ (initialisé 2026-07-29, partie 4 du canon « solde 4 écarts »)

Base du dossier que toute banque demandera, et matière du pentest (cabinet suisse
accrédité — cadrage du canon : périmètre API + portail + login OIDC + infra exposée ;
mobile V7 = pentest DÉDIÉ séparé, la population change ; retest inclus exigé ;
rapport + retest « clean » versionnés ICI).

**Séquencement (canon)** : le pentest se commande APRÈS (a) JWT partout — FAIT (constat
§1, aucun x-tenant-id dans l'API), (b) login R296 en service — FAIT (deux temps + rate
limit à store partagé), (c) staging Exoscale iso-prod — infra/ prête, acte humain.

## Auto-évaluation OWASP ASVS 4.0 — niveau 2 (contre le code réel)

| ASVS | Domaine | Statut | Preuve (test/mécanisme) |
|------|---------|--------|-------------------------|
| V2 Authentification | mots de passe scrypt + leurre timing, MFA TOTP (interne mfa.service, mobile R316), break-glass audité+notifié | ✔ | LG-01..05, MB-02, harnais SB (chiffrement mfa_secret) |
| V2.2 Anti-automatisation | rate limit fenêtre glissante par identifiant, 429 typé jamais oracle, store PARTAGÉ multi-instances | ✔ | RL-01..04 |
| V3 Sessions | JWT RS256 kid/JWKS, rotation avec grâce, sessions mobiles distinctes (pop=MOBILE, étanchéité 2 sens) | ✔ | JV harnais, IM-04, MB-01/02 |
| V4 Contrôle d'accès | RBAC serveur (@Roles/RolesGuard), périmètre RM/ARM par requête, surface SO fermée (3 exceptions typées), RLS FORCE + tenant GUC | ✔ | matrice A.3, SO-01..08, recette RLS CI 4b (SQL direct) |
| V5 Validation | zod aux frontières (ClientCreate/KycCreate…), default-deny typé partout (422/400), aucun SQL libre (BI liste blanche CI) | ✔ | CP-11, BL-01/04, LN-04 (langues fermées) |
| V7 Erreurs & logs | erreurs typées jamais de stack brute (pont CPSI garde-fou), audit append-only (triggers), AUDIT_ACCESS sur consultations sensibles | ✔ | R284/R286, SO-04, bloc erreurs pont |
| V8 Données | données compliance cloisonnées (R270/OL-34 : l'existence même), IBAN haché (R297), photo byte-à-byte anti-mutation (SW-14) | ✔ | OF-07, MB-03, SW-14 |
| V9 Communications | TLS/HSTS au proxy (Caddyfile §8) ; l'app pose ses en-têtes SANS le proxy | ✔ | SEC-01 ; SSL Labs A = critère §8 (humain) |
| V10 Code malveillant | liste blanche d'outils IA (R264, CI), grep fournisseur navigateur (B.11.4, CI), persona hors code (CI) | ✔ | étapes CI 1b/1c |
| V12 Fichiers | GED typée (R109-115), versions sha256, legal hold ; SOS versioning au Terraform (§6) | ✔ | GED harnais + LE-03/04 |
| V13 API | en-têtes sécurité sur TOUTE réponse (CSP none, nosniff, frame-deny, no-referrer) | ✔ | SEC-01 |
| V14.4 Config | secrets fail-fast au boot (AUDIT_HMAC_SECRET/MFA_ENC_KEY exigés), zéro secret au dépôt (grep CI), coffre §7 (humain) | ✔/⚠ | étape CI secrets ; coffre = acte infra |
| **ÉCARTS OUVERTS** | (1) HSTS servi par le proxy seulement — accepté (API derrière Caddy, consigné) ; (2) rotation des secrets d'ENV = procédure infra §7 (JWKS applicatif déjà rotatif) ; (3) scan ZAP = gated STAGING_URL (pas de cible en session) ; (4) pentest + retest = acte humain, budget 15-30 kCHF (canon) | ⚠ | ce tableau |

## Olivia — résistance des filtres déterministes (A.1/A.5, mesuré en CI, R167)

Harnais `tools/olivia-eval/` — ZÉRO appel modèle (fixtures + logique déterministe). Les filtres
(injection de prompt, hors-périmètre, forçage de reco en prose) sont **une couche de
pré-filtrage** : la décision reste modèle + humain (R44, propositions seulement), défense en
profondeur. Mesuré le **2026-07-29** sur corpus versionné :

- **Golden set (A.1)** : 200 cas légitimes (50 / capacité C1–C4) · justesse de langue **100 %** ·
  **0 faux positif** (aucun filtre défensif ne bloque une vraie question de conformité).
- **Suite d'attaque (A.5)** : 42 cas adverses · **résistance 52.4 %** (22/42). Les formes connues
  du lexique sont neutralisées ; les variantes multilingues et paraphrasées **passent** — angles
  morts ASSUMÉS et publiés. Ce taux est un **plancher cliquet** (`seuils.json`) : il ne peut que
  monter (enrichir le lexique de refus/injection), jamais baisser en douce (toute baisse = édition
  visible du plancher, revue). Verrou CI : step « 3o · Olivia A.1/A.5 ».

## Vérifications ciblées re-prouvées (avant prestataire)
- **Indistinguabilité + timing login (LG-02)** : leurre scrypt sur tous les chemins, message unique — suite fat-login.
- **Rate limit partagé (§3.5)** : RL-04 + recette compose 2 instances (staging).
- **Non-énumération (OL-34/OF-07)** : domaine inconnu = même forme ; offboarding sans oracle ; 404 mobile neutre.
- **RLS en SQL direct** : recette CI 4b (olive_app, 0 ligne sans GUC) — pas seulement via l'API.
- **En-têtes** : SEC-01 (200 ET 401).

## Procédure secrets (§3.7)
Coffre SOPS+age (premier temps) puis Vault : AUDIT_HMAC_SECRET, MFA_ENC_KEY, OIDC
client_secret, clés de licence (R320), clés API Exoscale par environnement. Le grep CI
refuse tout secret en clair ; la clé racine du compte reste hors CI (2FA, §1).
