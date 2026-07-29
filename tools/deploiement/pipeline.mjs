// Pipeline de déploiement O-Live (guide C.1, phases 0-5) — DÉFINITION source unique. Le guide
// docs/DEPLOIEMENT.md est GÉNÉRÉ d'ici (generer-guide.mjs) : la doc ne peut pas dériver du
// pipeline réel. Chaque phase référence des scripts/endpoints RÉELS du dépôt (infra/scripts/*,
// /readyz). Doctrine : tag signé → staging auto → répétition de restauration → FAT staging →
// prod déclenchée par un HUMAIN → contract différé (N+1). Rien de destructif automatique.

export const pipeline = [
  {
    n: 0, nom: "Tag signé (déclencheur)", mode: "humain",
    but: "Un déploiement part d'un tag Git SIGNÉ (git tag -s vX.Y.Z) — origine tracée, non répudiable.",
    etapes: [
      "git tag -s vX.Y.Z -m \"<notes>\" && git push origin vX.Y.Z",
      "La CI vérifie la signature et que la frontière verte du RUNBOOK §2 est passée sur ce SHA.",
    ],
    garde: "Tag non signé OU frontière rouge ⇒ le pipeline ne démarre pas.",
  },
  {
    n: 1, nom: "Staging automatique", mode: "automatique",
    but: "Le tag déploie AUTOMATIQUEMENT sur un staging iso-prod (mêmes images, mêmes migrations).",
    etapes: [
      "infra/scripts/deploy.sh staging vX.Y.Z   # compose 2 instances + Redis AOF + Caddy TLS",
      "prisma migrate deploy + prisma:post (RLS FORCE + immuabilité) sur staging.",
    ],
    garde: "Migration non expand-only (porte « 3m », R334) ⇒ refus AVANT staging.",
  },
  {
    n: 2, nom: "Répétition de restauration", mode: "automatique",
    but: "Prouver, chronométré, que le backup se RESTAURE (le RTO est mesuré, pas supposé).",
    etapes: [
      "infra/scripts/restore-test.sh   # restaure le dernier backup WAL-G sur une base jetable",
      "Le temps de restauration est relevé (critère d'acceptation infra).",
    ],
    garde: "Restauration échouée OU au-delà du RTO cible ⇒ prod BLOQUÉE (le backup non restaurable ne vaut rien).",
  },
  {
    n: 3, nom: "Fumée + FAT sur staging", mode: "automatique",
    but: "Le staging répond et rejoue les parcours métier avant tout accès prod.",
    etapes: [
      "infra/scripts/smoke.sh staging   # /healthz, /readyz (200), en-têtes de sécurité",
      "node tools/fat/test.mjs   # traçabilité parcours→scénario adossée (FB-02)",
    ],
    garde: "/readyz ≠ 200 (db_migree, jwks, outbox lag, moteur CPSI…) OU FAT rouge ⇒ prod bloquée.",
  },
  {
    n: 4, nom: "Prod déclenchée par un HUMAIN", mode: "humain",
    but: "La prod n'est JAMAIS automatique : un humain déclenche, readiness en garde.",
    etapes: [
      "Déclenchement manuel (workflow_dispatch) après revue du staging vert.",
      "infra/scripts/deploy.sh prod vX.Y.Z ; POST /v1/deploiements (journal append-only).",
      "infra/scripts/smoke.sh prod   # /readyz 200 en prod, sinon rollback immédiat.",
    ],
    garde: "Aucune main humaine ⇒ pas de prod. /readyz ≠ 200 en prod ⇒ rollback (image N-1).",
  },
  {
    n: 5, nom: "Contract différé (N+1)", mode: "humain",
    but: "La suppression (DROP/rétrécissement) attend que plus AUCUN code ne lise l'ancien schéma.",
    etapes: [
      "Une fois vN stable et le code ne lisant plus l'ancien : migration de contract (phase N+1).",
      "Elle passe la même porte expand/contract ; le plan porte ses vérifs (R334/MG-02).",
    ],
    garde: "Contract lancé alors qu'un lecteur de l'ancien schéma tourne encore ⇒ interdit.",
  },
];
