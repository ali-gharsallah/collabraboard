# L5 · P-L5-2 — Catalogue d'événements au write (C6) : reste à migrer

Le catalogue (`docs/contracts/events-catalog.ts`, ré-export du canonique `apps/api/src/contracts/events-catalog.ts` où zod se résout) régit l'ÉCRITURE via `emitEvent`
(`apps/api/src/common/domain-event.ts`) : schéma zod strict = validé + `eventVersion` posé ;
type « en attente » = passe sans validation (migration douce) ; type absent des deux = **refusé**.
R49 : les événements stockés ne sont jamais touchés — la lecture reste aux upcasters.

## État (2026-08-09, après vague 11 — TOUTES les familles à points sont schématisées)

- **315 types SCHÉMATISÉS** — progression par vagues : 27 (v1 strict,
  noyau KYC verrou + handoff, screening/PEP, ES-8, bloc WD, listes, MROS, gouvernance O),
  +15 vague 1 (mros.*/trip.*/training.*), +8 Bloc 62 (offboarding-moteur WORKFLOW_*/
  TRANSITION_FIRED/VISA_APPOSE/GUARD_*/CHECKLIST_ITEM_CHECKED/PARAM_CHANGED), +3 tranche C6
  (kyc.created, prospect.retour.refuse.detecte, kyc.access.modifie), +18 vague 2 (kyc.*),
  +9 vague 3 (aml.* + cpsi.* emitEvent), +26 vague 4 (ged.*), +28 vague 5 (tache.*/task.*),
  +18 vague 6 (personne.*), +17 Blocs 63/64 (trip.*/MATRIX_SYNCED/xb.*), +25 vague 7
  (ia.* 9 + islamic.* 9 + pms.* 7), +28 vague 8 (2026-08-09 : mobile.* 6 + olivia.* 6 +
  riskcase.* 6 + coffre.* 5 + ocr.* 5), +30 vague 9 (2026-08-09 : offboarding.* 5 +
  onboarding.* 5 + oprisk.* 5 + regwatch.* 5 + ta.* 5 + tx.* 5), +34 vague 10
  (2026-08-09 : annotation.* 3 + core.* 4 + legal.* 3 + licence.* 3 + recherche.* 4 +
  review.* 3 + sso.* 4 + workflow.def.* 3 + workload.* 3 + xb.* reliquat 4), +33 vague 11
  (2026-08-09 : les 1-2 types et singletons — auth/builder/cablage/caviardage/central_file/
  client/crm/deploiement/divulgation/dq/fx/iam/matrice_documentaire/module/nba/param/rh/
  risque/signal/swift/tenant/transport/tuning/vendor).
- **299 types EN ATTENTE** = 284 SANS_POINT (MAJUSCULES, gabarits COC_ compris) + 11 `cpsi.*`
  (journal jumeau, doctrine vague 3) + 4 FAUX POSITIFS du scan consignés (« fake-1.0 » version
  de modèle factice olivia, « gwb.ch »/« gwb-private.ch » exemples loginDomaines, « pacs.008 »
  type de message SWIFT — pas des types d'événement, sur-capture monotone assumée).
  Inventaire GARDÉ EN CI par
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
   **Vague 3 FAITE (2026-08-08)** : `aml.*` intégral (signal.leve, operation.bloquee,
   signal.raised, block.requested, signal.qualified, eval.version_compared, eval.completed)
   + les DEUX `cpsi.*` réellement émis via emitEvent (`cpsi.sla.depassement`,
   `cpsi.case_proposal.emitted` — miroir outbox, `at` corrélé au jumeau). **Constat de
   vague** : les 11 autres littéraux `cpsi.*` du scan (client.registered, signal.ingested,
   param.proposed/adopted/rejected/applied, insider.tagged/lifted, fp.declared,
   group.defined, scenario.defined) vivent dans le journal JUMEAU `cpsi_events` (moteur
   pur rejouable, écrit par `cpsiEvent.create`, jamais par emitEvent) — ils restent en
   attente par SUR-capture assumée du scan, le catalogue ne gouverne que domain_events.
   **Vague 4 FAITE (2026-08-08)** : `ged.*` intégral — 26 schémas (ingestion R137–R139 :
   ingest/classement/ocr.derive/inbox.*, noyau R108–R112 : version.creee/acces/archive/
   completude/expiration/integrite, avancé : ancrage/QES/hold/destruction/classification,
   vues R164, externe.indisponible R167). Payloads réels ; deposeAt/retentionUntil validés
   en instance Date (avant sérialisation JSON), même doctrine que mros.gel.echeance.
   **Vague 5 FAITE (2026-08-08)** : `tache.*` (22 signaux de travail R39/R44 — le système
   mesure et notifie, l'humain agit : aiguillage/allègement EDD, coffre, core, corroboration,
   ged, kyc.requalification, legal.preavis, onboarding.relance, oprisk, personne, pms, PEP,
   regwatch, reviews préavis/escalade, riskcase.relance) + `task.*` (6, module Tâches R38 :
   created/manual/routed/delegated/completed/sla.retard) — 28 schémas stricts.
   **Vague 6 FAITE (2026-08-08)** : `personne.*` intégral (18 schémas — fiche centrale
   R30→R36 : création/minimale/homonymie signal jamais fusion auto, liens R152
   pose/retrait/accès refusé, rôles et archivage base légale LBA, CoC créé/propagé +
   rescreening, PEP propagé + alerte dé-PEPisation ADR-PEP-001, relations).
   **Vague 7 FAITE (2026-08-08)** : `ia.*` intégral (9 — l'IA propose, l'humain décide
   R44/AI-04 : acces.refuse R163, production hachée R160 shaContexte/shaSortie,
   proposition R161 confiance nullable, decision R162 enum ACCEPTEE/REJETEE + ecart mesuré
   jamais coercé R39, prerevue.produite/point.traite/point.ecarte R121, prompt.versionne)
   + `islamic.*` intégral (9 — signaux R207→R221 : signal.leve/operation.bloquee, et les
   7 calculateurs ledger AAOIFI à spread `...rapport` : le wrapper `ledger()` DÉLÈGUE bien
   à emitEvent, les shapes viennent des interfaces Rapport* de
   `islamic-screening.engine.ts` — zakat.calcule, mudaraba.distribue, waqf.distribue
   [motif optionnel : absent quand autorisé], qard.suivi, takaful.suivi, sukuk.maturite,
   audit.shariah) + `pms.*` intégral (7 — R39 le système mesure et alerte, jamais ne
   liquide : mandat.attache, drift.detecte borne z.tuple [min,max], pretrade.bloque/ok,
   suitability.alerte, breach.escalade/clos) — 25 schémas stricts.
   **Vague 8 FAITE (2026-08-09)** : `mobile.*` intégral (6 — R316–R318 : identité hors
   bande [JAMAIS le code ni le secret MFA au payload], session, partage, messagerie —
   `mobile.message` a DEUX émetteurs : banque avec `par`, client sans → `par` optionnel,
   `de` en enum BANQUE/CLIENT) + `olivia.*` (6 — essaim R259–R266 : outil/agent
   déclarés-retirés, saturation, portes humaines ; curseur.change était déjà au v1)
   + `riskcase.*` intégral (6 — `riskcase.ouvert` a DEUX portes : ouverture directe
   {signaux} et consommation d'une proposition CPSI R280 {depuisProposition, scenarios}
   → trois champs optionnels sous strict ; sla.alerte signale, ne clôt jamais R39)
   + `coffre.*` intégral (5 — R144–R147 : écrit, intégrité, purge certifiée avec
   empreinte conservée, réconciliation orphelin/manquant = fait d'audit) + `ocr.*`
   intégral (5 — R174–R176 : gabaritVersion Int? null en mode BRUT, mode enum BRUT/TYPE,
   `cible` = mapping gouverné tenant validé en objet ouvert, propositions
   acceptée/refusée par l'humain R44) — 28 schémas stricts.
   **Vague 9 FAITE (2026-08-09)** : `offboarding.*` intégral (5 — clôture relation
   R267–R270, distinct du moteur Bloc 62 : demande SANS motif sensible R270, transition,
   visa, document, attestation_avoirs motivée R269) + `onboarding.*` intégral (5 —
   `onboarding.ouvert.kycFileId` non-nul GARANTI par la porte R119, sla.alerte) +
   `oprisk.*` intégral (5 — R321–R323 : sévérité entière validée 1..5, `reference` =
   objet libre du déclarant non figé, action jamais bloquée même en retard, escalade
   DIR) + `regwatch.*` intégral (5 — R309–R311 : item par empreinte, fetch tracé,
   proposition/qualification R44, digest parStatut record de compteurs) + `ta.*`
   intégral (5 — R302–R303 : mouvement second regard R13, `ta.contrepassation.mouvement`
   = payload COMPLET du mouvement embarqué [inverse exact tracé], rapprochement,
   écart résolu) + `tx.*` (5 — R140–R143 : verdict/suspend même shape, revue humaine,
   sla signale jamais ne libère R39) — 30 schémas stricts.
   **Vague 10 FAITE (2026-08-09)** : les familles à 3-4 types — `annotation.*` (R157),
   `core.*` (sync R167 : quarantaine = fait, résolution humaine, refus de périmètre
   jamais silencieux), `legal.*` (R312–R313 : la pièce GED d'abord, `rattachements` =
   objet libre non figé), `licence.*` (R320 : J-60/J-30/expirée, MÊME payload, une
   notification par état et par expiresAt), `recherche.*` (R148 : l'index jamais purgé
   en silence, desync = fait d'audit), `review.*` (R283 : `profil` = le profil appliqué
   FIGÉ dans l'événement R29, objet gouverné), `sso.*` (IM-03/04 : bascule
   demandée/visée R13, vers en enum jwt|sso), `workflow.def.*` (R171 : la publication
   porte sa mise en vigueur), `workload.*` (R183 : suggestion — la décision vous
   appartient), `xb.*` reliquat (check tracé, dérogation demandée→visée = payload
   REJOUÉ + visePar R13, ordre RS) — 34 schémas stricts.
   **Vague 11 FAITE (2026-08-09) — clôture des familles à points** : 33 schémas —
   auth.breakglass (notifié SO/DIR), builder.* (simulation/publication R304-R305,
   rapport d'impact JOINT non figé), cablage.caviarde.depose, caviardage.*/divulgation.*
   (R158-R159 : l'original ne sort pas), central_file, `client.coc` = corps webhook
   repris TEL QUEL (z.record ouvert, seul schéma non-strict du catalogue, volontaire),
   crm.*, deploiement.enregistre (RZ-04), dq.degraded (GV-03), fx.seuil.franchi (R39),
   iam.cumul_so_admin, matrice_documentaire.publiee (R282 — la 1re prise de la garde),
   module.licence, nba.decided (enum ACCEPT/ADJUST/REJECT, adjustment libre R244),
   param.change/effet (valeurs gouvernées z.any), rh.bonification (le moteur ne décide
   rien), risque.operationnel.incident (R12), signal.aml.comportement, swift.*
   (extraction par type de message non figée, quarantaine R169), tenant.active,
   transport.deadletter(.rejouee), tuning.* (BTL, calibrage GV-04), vendor.licence.*
   (R177/R179). **INSTRUCTION des 4 littéraux suspects** : « fake-1.0 », « gwb.ch »,
   « gwb-private.ch », « pacs.008 » ne sont PAS des événements (voir État ci-dessus) —
   ils restent en attente par sur-capture monotone.
   RESTE : le bloc SANS_POINT (284 littéraux MAJUSCULES, gabarits COC_ compris).
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
