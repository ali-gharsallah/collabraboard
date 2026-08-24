# CLAUDE.md — O-Live

Contexte permanent pour Claude Code. Maigre par design : les détails vivent dans
`/docs` et `/spec`, et **le repo fait foi** en cas de divergence avec tout document.

## Ce qu'est ce système (réalité, pas la légende)

- **Moteur workflow KYC** : TypeScript / NestJS, `apps/api/src/modules/*` (~50 modules).
  **CRUD-primaire** : l'état vit dans les tables Prisma ; le journal `domain_events`
  est **append-only, en parallèle** — témoin immuable, PAS la source de l'état.
  Ne jamais décrire ce système comme « event-sourcé ».
- **Moteur CPSI** : Python, `services/cpsi-server-py/olive_cpsi/` — scoring de risque
  perpétuel, pur et rejouable. Couplé au workflow **uniquement par propositions/tâches**
  (R39/R44), jamais par effet de bord direct.
- **Moteur de screening fin** : `packages/screening-engine` (JW + IDF + blocking
  trigramme + Double Metaphone), branché dans `screening.service.ts`. Golden set
  127 cas asserté en CI (`services/screening/gate.test.mjs`).
- Règles : namespace **R1→R417** (plat, réparti par blocs). R1–R51 = noyau
  workflow-visa (catalogue normatif : `spec/wf-v2.md`).
- Décisions actées : **ADR-TM-001** (Surveillance = contexte borné logique
  in-monolith, Option C) · **ADR-PEP-001** (autorité PEP = `personnes.statutPep`
  décidé par un humain ; les listes proposent, Option C). Voir `docs/adr/`.

## Invariants non négociables (toute violation = STOP + question)

1. **R49** — le journal est append-only. Aucun UPDATE/DELETE sur `domain_events`,
   jamais. L'évolution de schéma passe par upcasters purs **à la lecture**
   (`modules/events/upcasters.ts`), enregistrés une fois, immuables.
2. **R44** — l'IA/le moteur propose, l'humain décide. Aucun chemin de code ne doit
   exécuter automatiquement une sanction, une PEPisation, une clôture de hit,
   une déclaration. Sortie autorisée : événement/tâche/proposition.
3. **Précédence des gardes** — l'ordre des refus dans `kyc.service.ts:validate()`
   et les gardes throw-first est un comportement contractuel. Ne jamais réordonner,
   fusionner ou « nettoyer » ces séquences.
4. **R1–R51 restent actives et inchangées** pendant toute la construction du module
   d'inférence. Le ledger est une vue ; toute divergence de verdict est consignée
   dans `MIGRATION_DIVERGENCES.md`, **jamais corrigée silencieusement**.
5. **RLS** — toute nouvelle table tenantée reçoit ENABLE + FORCE ROW LEVEL SECURITY
   + policy `tenant_isolation` (modèle : `prisma/post-deploy-v2.sql`).
6. **Config gouvernée par date** — un dossier garde la version de sa création
   (R29). Ne jamais résoudre une config « courante » là où une config « en vigueur
   à date » est attendue.
7. **Pas d'état module-global nouveau** (leçon C8/IDF). Tout service de calcul
   s'instancie par requête/run.
8. **Aucun `eval`/`exec`** — le DSL d'activation du module d'inférence est un AST
   restreint, expressions invalides rejetées au chargement.

## Interdits de langage (démo, docs, commits)

- « event sourcing », « event-sourcé », « CQRS complet », « rejeu total de l'état ».
  Formulation véridique : **journal immuable + état à date (R48) + référentiels
  versionnés par date d'effet**.
- Ne jamais présenter `apps/web/src/parity/*` comme le moteur : l'écran screening
  y fabrique une confiance par hachage. Tout branchement démo passe par le vrai
  moteur (`packages/screening-engine`).

## Discipline d'exécution

- **Un prompt = une session = un commit.** Périmètre du prompt uniquement ;
  toute découverte hors périmètre → note dans `docs/notes/`, pas de correction
  opportuniste.
- La **gate du lot** (voir `docs/PLAYBOOK.md`) est vérifiée avant le lot suivant.
- Tests d'abord quand le prompt le demande ; un test qui passe avec une sémantique
  réglementaire fausse est pire qu'un test rouge — en cas de doute sur une règle
  ou une base légale (CDB 20, LBA, OBA-FINMA), **consigner la question pour
  revue humaine**, ne pas trancher.
- Aucune suite de tests hors CI. Un runner qui masque un échec est un incident.
- Nommage des documents : « la spec v2 » = `docs/OLive-Specification-Produit-v2-PostAudit.docx` ;
  « le catalogue » = `spec/wf-v2.md` ; « l'audit » = `docs/audit/AUDIT.md`.
  Toujours citer le document par son chemin.

## Commandes utiles

- API : `cd apps/api && npm test` (Jest, specs `*.spec.ts`)
- Screening : `node services/screening/gate.test.mjs` (gate golden — bloquant)
- CPSI : `cd services/cpsi-server-py && pytest` (le runner doit propager le code
  de sortie — cf. lot L1)
