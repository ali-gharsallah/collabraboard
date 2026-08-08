# L5 · P-L5-2 — Catalogue d'événements au write (C6) : reste à migrer

Le catalogue (`docs/contracts/events-catalog.ts`, ré-export du canonique `apps/api/src/contracts/events-catalog.ts` où zod se résout) régit l'ÉCRITURE via `emitEvent`
(`apps/api/src/common/domain-event.ts`) : schéma zod strict = validé + `eventVersion` posé ;
type « en attente » = passe sans validation (migration douce) ; type absent des deux = **refusé**.
R49 : les événements stockés ne sont jamais touchés — la lecture reste aux upcasters.

## État (2026-08-08, tranche C6)

- **68 types SCHÉMATISÉS (vague 2 kyc.* — 18 schémas, 2026-08-08)** — anciennement : 50
  (Bloc 62 offboarding-moteur : WORKFLOW_STARTED, TRANSITION_FIRED, VISA_APPOSE, GUARD_BLOCKED,
  GUARD_WARNING, WORKFLOW_COMPLETED, CHECKLIST_ITEM_CHECKED, PARAM_CHANGED), 42 (vague 1
  mros.*/trip.*/training.*), 27 (v1, strict)** : noyau KYC (verrou + handoff), screening/PEP,
  ES-8 (`tx.flux.importee`, `kyc.validated`, `personne.pep.declare/leve`), bloc WD
  (`wd.wir.importe/edite/ratifie`), ingestion de listes (`liste.*`), MROS (`mros.goaml.soumis`,
  `mros.chrono.alerte`), gouvernance O (`olivia.curseur.change`), et la tranche C6 :
  `kyc.created`, `prospect.retour.refuse.detecte`, `kyc.access.modifie`.
- **530 types EN ATTENTE** : inventaire désormais GARDÉ EN CI par
  `apps/api/scripts/verifier-catalogue-evenements.mjs` (step « 3-C6 ») — `--generer` le
  régénère de façon MONOTONE ((ancienne ∪ scan) − schématisés) ; le check échoue si un
  littéral émis manque OU si un type est à double statut. La SUR-capture reste assumée.
  Première prise de la garde (2026-08-08) : `matrice_documentaire.publiee` (docmatrix,
  R282) était émis HORS catalogue — refus au write en prod, invisible du harnais
  (fakePrisma ne passe pas par emitEvent). Ajouté à l'inventaire.

## Reste à faire (par priorité)

1. **Schématiser par vagues** — **vague 1 FAITE (2026-08-08)** : `mros.*` (decision,
   notification, gel.pose/leve/echeance, acces, acces.refuse), `trip.*` (submitted,
   visa.signed, approved, revised, contactreports.manquants), `training.*` (completed,
   validated, reminder) — 15 schémas stricts tirés des payloads réels.
   **Vague 2 FAITE (2026-08-08)** : `kyc.*` intégral — 18 schémas (lock.requested/passed,
   visa.invalide/validateur.reassigne/annule.vice, visas.geles, comite.decision,
   offboarding.propose, dossier.suspendu/reactive/abandonne/mise_a_jour/workflow,
   effacement.refuse.lba, process.ouvert/pause/repris/cloture) tirés des payloads réels
   de `kyc.service.ts` + `kyc-workflow.chaine.ts`. Plus AUCUN type `kyc.*` en attente.
   RESTENT : `aml.*`/`cpsi.*`, puis le reste par familles.
   Chaque schéma ajouté SORT le type de TYPES_EN_ATTENTE (version 1 → n avec upcaster
   de lecture si le payload évolue).
2. **Creates directs restants** : **SOLDÉ (tranche C6 n°2, 2026-08-08)** — plus AUCUN
   `domainEvent.create` hors `emitEvent` dans `apps/api/src` (grep vide). ~40 sites sur
   ~30 fichiers basculés : tous les wrappers locaux `emit()` délèguent désormais (pms, xb,
   offboarding, olivia, legal, reviews, custody/ta, swarm, regwatch, builder, coc,
   onboarding, ged, personnes, transaction-gate, mobile, oprisk, auth-sso, event-bus.port)
   et les sites directs (readiness, storage-resolver, users/login auth, fx/swift,
   custody, deadletter events/outbox, license, ged-consultation, clients.controller,
   cpsi, audit, tenant.middleware, docmatrix). `emitEvent` accepte un `at` OPTIONNEL pour
   les deux sites qui corrèlent délibérément leur horodatage (cpsi_events jumeau,
   génération d'export AUDIT_EXPORT) ; le middleware fire-and-forget encapsule le refus
   catalogue synchrone (jamais bloquant, jamais silencieux). Le catalogue gouverne
   désormais TOUTE écriture d'événement.
3. **Types dynamiques bornés** : `olivia` (3 littéraux `tache.*` résolus par ternaire) et
   `prerevue` (`ia.point.traite|ecarte`) sont couverts par l'inventaire. Toute NOUVELLE émission
   à type calculé doit résoudre vers des littéraux inventoriés — sinon refus au write (voulu).
4. **Garde d'inventaire** : **FAIT (tranche C6, 2026-08-08)** —
   `verifier-catalogue-evenements.mjs` (`--generer` monotone + check bloquant en CI,
   step « 3-C6 »). La sanction n'est plus le refus au write : la CI attrape la dérive.
