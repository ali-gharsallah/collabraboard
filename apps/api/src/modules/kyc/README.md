# Module KYC — implémentation P0-2
Portage production des garanties v0.2.0, implémentées dans ce module :
- code atomique `pg_advisory_xact_lock` par (tenant, année, pays) → zéro doublon multi-instances
- scoring TRACÉ (risk-engine.ts) : chaque décision est rejouable — la trace part dans l'outbox
- gabarits SDD/CDD/EDD (kyc.templates.ts) avec droits **default-deny** — sortiront vers le Rule Engine en P2 sans changer l'interface
- change tracker HMAC-SHA256 **chaîné** par question, append-only (trigger SQL)
- visas de section par rôle requis strict + validation finale **four-eyes** (validateur ≠ créateur)
- événements kyc.created / kyc.validated dans l'outbox
- projection par rôle : une question HIDDEN ne quitte jamais le serveur
Tests de référence : suites unit + e2e de olive-consolidated (mêmes invariants).
