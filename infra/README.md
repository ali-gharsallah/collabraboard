# Infra Exoscale — PRÉPARÉE, à APPLIQUER par un humain (canon « solde 4 écarts » partie 3)

Ordre d'exécution = le runbook du canon (§1→§10), critère ✔ par étape. Cette arborescence
rend l'acte humain « appliquer », pas « bricoler » :
- `exoscale/` : Terraform (réseau/SG §2, VMs §3, buckets SOS §6 + DR §10). `terraform apply`
  avec des clés PAR ENVIRONNEMENT (§1 — la clé racine reste hors CI, 2FA sur le compte).
- `scripts/` : `backup-walg.sh` (WAL continu + rétention 30 j) et `restore-test.sh` — LE
  critère §4 : restauration TESTÉE, documentée, CHRONOMÉTRÉE. Un backup non restauré
  n'existe pas.
- `compose/` : prod à DEUX instances app + Redis AOF (§5 — store PARTAGÉ du rate limit
  R296 : saturer via app1, constater 429 via app2 = la recette §3.5) + Caddy TLS/HSTS (§8).
- `observabilite/` : règles d'alerte §9 (dead-letters AS-04, jauge R250, backups, disque) —
  à brancher sur un canal RÉEL et prouver par UNE alerte de test reçue.
Secrets (§7) : coffre (SOPS+age acceptable en premier temps) — le grep CI refuse tout
secret en clair. DR (§10) : bucket cross-zone créé par le Terraform ; la procédure de
bascule s'écrit et SE RÉPÈTE une fois — RTO/RPO mesurés et notés.
