# O-Live — Console Éditeur (app VENDOR SÉPARÉE)

Canon **R319** : la console de l'ÉDITEUR est une INSTANCE SÉPARÉE — déploiement, base et
IAM PROPRES. Le rôle **EDITOR n'existe QUE sur cette instance** (jamais au RBAC tenant :
test négatif permanent VE-01, prouvé côté tenant dans `apps/api/.../fat-degel-v8` et côté
vendor ici). Aucune connexion entrante console → données tenant.

Elle porte :
- le **registre des instances clientes** (`src/instances.mjs`) : version, modules,
  échéances, canal ;
- l'**émission de licences SIGNÉES** (`src/licence.mjs`, canon **R320**) : la clé privée
  vendor signe ; la licence descend et l'instance tenant la VÉRIFIE avec la clé publique
  (`OLIVE_LICENSE_PUBKEY`) — le tenant ne fait jamais confiance sans vérifier (VE-02).

C'est une app volontairement AUTONOME (Node ESM natif, crypto natif) : elle n'IMPORTE
aucun code de `apps/api` — la séparation est structurelle, pas conventionnelle. Le test
prouve la vérifiabilité croisée en rejouant l'ALGORITHME de vérification du tenant
(même body + SHA256), sans coupler les deux bases de code.

Test : `pnpm --filter @olive/editor-console test` (ou `node test/vendor.test.mjs`).
