# L5 · P-L5-2 — Catalogue d'événements au write (C6) : reste à migrer

Le catalogue (`docs/contracts/events-catalog.ts`, ré-export du canonique `apps/api/src/contracts/events-catalog.ts` où zod se résout) régit l'ÉCRITURE via `emitEvent`
(`apps/api/src/common/domain-event.ts`) : schéma zod strict = validé + `eventVersion` posé ;
type « en attente » = passe sans validation (migration douce) ; type absent des deux = **refusé**.
R49 : les événements stockés ne sont jamais touchés — la lecture reste aux upcasters.

## État (2026-08-06)

- **9 types SCHÉMATISÉS (v1, strict)** : noyau KYC (`kyc.lock.acquired/released`,
  `kyc.handoff.next/back/validated/rejected`) + screening/PEP (`screening.escalade.proposee`,
  `pep.proposition.creee`, `pep.proposition.rejetee`).
- **568 types EN ATTENTE** : inventaire GÉNÉRÉ par scan large des littéraux émis (appels précis
  `.emit(`/`emitEvent(` + littéraux pointés + UPPER_SNAKE dans les fichiers émetteurs). La
  SUR-capture est assumée (un littéral non-événement dans la liste est inoffensif) ; la
  SOUS-capture serait une bombe à refus — c'est pourquoi le scan est large. À réduire au fil
  des migrations de schémas.

## Reste à faire (par priorité)

1. **Schématiser par vagues** les familles les plus émises : `kyc.*` restants (created/validated/
   dossier.*/visa.*), `mros.*` (gel/communication), `trip.*`/`training.*` (vague L2),
   `aml.*`/`cpsi.*`. Chaque schéma ajouté SORT le type de TYPES_EN_ATTENTE (version 1 → n
   avec upcaster de lecture si le payload évolue).
2. **Creates directs restants** : des services écrivent encore `domainEvent.create` sans passer
   par `emitEvent` — hors catalogue (liste par grep, 2026-08-06) : `pms`, `readiness`,
   `coffre/storage-resolver`, `transaction-gate` (événements de verdict), `auth/*`, `crossborder/xb`,
   `personnes` (via son wrapper local → **déjà** sur emitEvent), `txflux/fx`, `kyc.service`
   (4 creates directs restants : `kyc.created`, `prospect.retour.refuse.detecte`, `kyc.validated`,
   `kyc.access.modifie` — son wrapper `emit` est migré). Basculer ces sites vers `emitEvent`
   au fil des lots ; le catalogue ne gouverne que ce qui passe par lui.
3. **Types dynamiques bornés** : `olivia` (3 littéraux `tache.*` résolus par ternaire) et
   `prerevue` (`ia.point.traite|ecarte`) sont couverts par l'inventaire. Toute NOUVELLE émission
   à type calculé doit résoudre vers des littéraux inventoriés — sinon refus au write (voulu).
4. **Garde d'inventaire** : envisager un script `--generer` (comme le registre des règles C5)
   qui régénère TYPES_EN_ATTENTE et échoue si un littéral émis manque — pour l'instant la
   sanction est le refus au write en spec/e2e.
