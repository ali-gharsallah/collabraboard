# O-Live — GUIDE DE DÉPLOIEMENT (généré de tools/deploiement/pipeline.mjs — ne pas éditer à la main)

Pipeline C.1 en 6 phases (0-5). Doctrine : **tag signé → staging automatique → répétition
de restauration → FAT sur staging → prod déclenchée par un HUMAIN → contract différé (N+1)**.
Aucun ordre destructif automatique ; la prod n'est jamais déclenchée sans main humaine.

## Phase 0 — Tag signé (déclencheur)  _(humain)_

Un déploiement part d'un tag Git SIGNÉ (git tag -s vX.Y.Z) — origine tracée, non répudiable.

Étapes :
- `git tag -s vX.Y.Z -m "<notes>" && git push origin vX.Y.Z`
- `La CI vérifie la signature et que la frontière verte du RUNBOOK §2 est passée sur ce SHA.`

**Garde :** Tag non signé OU frontière rouge ⇒ le pipeline ne démarre pas.

## Phase 1 — Staging automatique  _(automatique)_

Le tag déploie AUTOMATIQUEMENT sur un staging iso-prod (mêmes images, mêmes migrations).

Étapes :
- `infra/scripts/deploy.sh staging vX.Y.Z   # compose 2 instances + Redis AOF + Caddy TLS`
- `prisma migrate deploy + prisma:post (RLS FORCE + immuabilité) sur staging.`

**Garde :** Migration non expand-only (porte « 3m », R334) ⇒ refus AVANT staging.

## Phase 2 — Répétition de restauration  _(automatique)_

Prouver, chronométré, que le backup se RESTAURE (le RTO est mesuré, pas supposé).

Étapes :
- `infra/scripts/restore-test.sh   # restaure le dernier backup WAL-G sur une base jetable`
- `Le temps de restauration est relevé (critère d'acceptation infra).`

**Garde :** Restauration échouée OU au-delà du RTO cible ⇒ prod BLOQUÉE (le backup non restaurable ne vaut rien).

## Phase 3 — Fumée + FAT sur staging  _(automatique)_

Le staging répond et rejoue les parcours métier avant tout accès prod.

Étapes :
- `infra/scripts/smoke.sh staging   # /healthz, /readyz (200), en-têtes de sécurité`
- `node tools/fat/test.mjs   # traçabilité parcours→scénario adossée (FB-02)`

**Garde :** /readyz ≠ 200 (db_migree, jwks, outbox lag, moteur CPSI…) OU FAT rouge ⇒ prod bloquée.

## Phase 4 — Prod déclenchée par un HUMAIN  _(humain)_

La prod n'est JAMAIS automatique : un humain déclenche, readiness en garde.

Étapes :
- `Déclenchement manuel (workflow_dispatch) après revue du staging vert.`
- `infra/scripts/deploy.sh prod vX.Y.Z ; POST /v1/deploiements (journal append-only).`
- `infra/scripts/smoke.sh prod   # /readyz 200 en prod, sinon rollback immédiat.`

**Garde :** Aucune main humaine ⇒ pas de prod. /readyz ≠ 200 en prod ⇒ rollback (image N-1).

## Phase 5 — Contract différé (N+1)  _(humain)_

La suppression (DROP/rétrécissement) attend que plus AUCUN code ne lise l'ancien schéma.

Étapes :
- `Une fois vN stable et le code ne lisant plus l'ancien : migration de contract (phase N+1).`
- `Elle passe la même porte expand/contract ; le plan porte ses vérifs (R334/MG-02).`

**Garde :** Contract lancé alors qu'un lecteur de l'ancien schéma tourne encore ⇒ interdit.

---

Phases à déclenchement HUMAIN : 0, 4, 5 (dont la phase 4 — la prod). Phases automatiques : 1, 2, 3.
