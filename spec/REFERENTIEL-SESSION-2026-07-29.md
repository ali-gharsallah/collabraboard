<!-- ARTEFACT D'ENTRÉE — NON RATIFIÉ. Statut : RÉFÉRENCE DE SESSION (baseline de divergence).
     Le REPO FAIT FOI sur les numéros. Ce fichier est la source « session » que le générateur
     docs/CANON-MASTER.md compare au repo pour produire le rapport de divergences (jamais absorbé
     en silence). Fourni par Ali le 2026-07-29, reproduit fidèlement (copie unique dédupliquée). -->

# O-LIVE — RÉFÉRENTIEL MAÎTRE CONSOLIDÉ (RÉFÉRENCE DE SESSION)
## Architecture · Invariants · Inventaire intégral des blocs ratifiés · Écrans · Ops
### Version session 2026-07-29 — AVERTISSEMENT DE NUMÉROTATION EN TÊTE

⚠️ **Le repo fait foi sur les numéros.** Plusieurs renumérotations ont eu lieu en
étape 0 (collisions résolues par Claude Code : ex. porte CPSI R222→R248, Olivia
R253–R266, mapping R70→R95 signalé). Ce document consolide TOUT le contenu par
domaine avec les numéros de session ; le document FAISANT FOI (`CANON-MASTER.md`)
doit être GÉNÉRÉ depuis le repo — le prompt en fin de fichier le produit
automatiquement, et le registrar R331 le maintiendra à jour à chaque ratification.

---
# 1. IDENTITÉ & POSITIONNEMENT

O-Live 🌿 — Client Lifecycle Intelligence. Plateforme CLM/KYC/AML multi-tenant
pour banques privées suisses (CDB 20, LBA/OBA, LSFin/LEFin, FINMA), SaaS Exoscale
Zurich ET on-premise signé hors-ligne. Beachhead : GFI/EAM sous LEFin.
Différenciation : pas « Swiss-native » (table stakes) mais l'ARCHITECTURE —
audit trail append-only, rejeu à date, grandfathering daté, spécification
exécutable, « AI-assisted, human-decided, replayable by design ».
Concurrents : SpeciTec (le plus direct), Fenergo, Temenos, Avaloq.
Juridique : avis avocat favorable + lettre de libération SpeciTec (archivés
DILIGENCE/) ; marque à déposer (antériorité Olive eKYC Inde à vérifier).

# 2. STACK RÉELLE (pas la vision AEVUM, archivée)

Backend **TypeScript/NestJS + Prisma + PostgreSQL** (RLS, triggers
d'immuabilité) · Front **React/TS (Vite)** · Moteur CPSI **Python pur isolé**
derrière une porte à contrat versionné · Redis (BullMQ + rate limit partagé) ·
SSE descendant · Exoscale (Terraform, WAL-G, SOS) · JWT RS256 + OIDC per-tenant.
K8s/Kafka : différés Phase 3 sur déclencheurs CHIFFRÉS (≥25 tenants / ≥3
deploys/sem / autoscaling démontré ; lag outbox >60s p95 / >1M évts/j / ≥5
consommateurs) — refus par défaut en dessous.

# 3. LES INVARIANTS (s'appliquent à TOUT bloc, sans re-déclaration)

1. Rien ne change d'état par effet de bord — tout passe par un événement tracé.
2. Journaux append-only chaînés (hash), rejeu à date nominal (R48/R49).
3. Versionné par date de mise en vigueur + grandfathering (R29/R68) — nuance
   ratifiée : la SÉCURITÉ suit la config courante, la COMPLÉTUDE est
   grandfathérée.
4. Visa objet uniforme (R15) ; four-eyes au niveau section, initiateur exclu (R13).
5. Motif obligatoire sur tout acte sensible (R7).
6. IA propose, humain décide (R44) — partout, y compris agents.
7. Le système mesure et notifie, ne coerce jamais (R39) — retards/SLA = faits
   calculés, jamais des statuts stockés ni des blocages.
8. Ports optionnels : pas de secret/connecteur = refus gracieux typé ; ZÉRO
   donnée simulée en prod (fixtures = test uniquement).
9. Default-deny : l'inconnu (signal, juridiction, commande, rôle) est refusé ou
   « non déterminé », jamais deviné.
10. RBAC+RLS côté backend exclusivement — le front ne filtre jamais ; la
    non-révélation d'existence s'applique (refus indistinguables).
11. Tout « ça dépend de la banque » = paramètre tenant au questionnaire R-Q,
    affiché en clair, versionné.
12. Spec-first : Gherkin ratifié avant code ; un bloc est fini à 100 % de
    scénarios verts ; tout écart repo↔canon est consigné, jamais tranché en
    silence.

# 4. INVENTAIRE INTÉGRAL DES BLOCS (par domaine ; n° session, repo fait foi)

**Socle & moteur** — Moteur workflow R1–R51 (68 scénarios V/A) · Visas/4-yeux
R13/R15 · Audit/rejeu R48/R49.
**KYC** — MOD-01 complet : kyc_files/sections/questions/history chaîné,
codes atomiques, révisions Rn chaînées, propagation outbox au golden record,
workflow SDD/CDD/EDD, droits H/V/E/R.
**IAM** — MOD-30 R89–R99 : RS256, TOTP MFA, RBAC 7 rôles, OIDC/SSO, JWKS
rotation, 47 tests · + OIDC per-tenant au login R293 (LG-01..05 :
résolution tenant, indistinguabilité + timing, break-glass notifié).
**Screening** R100–R103 (dataset synthétique, IDF, trigrammes, qualification) —
séparé de l'AML par R77.
**Onboarding** R117–R120 · **Pré-revue IA** R121–R124 · **MROS** R129–R132 ·
**Riskcases** R133–R136 (machine canonique — réconciliation R280/UC : le moteur
Python s'y mappe bijectivement).
**AML scénarios** A-69..A-86 / R189–R206 (structuring, circulaires, vélocité,
sanctions, UBO mismatch, layering, tiers payeurs, PEP-adjacents…).
**Core banking ports** R167–R169 : Avaloq/Temenos/Olympic, mocks, fallback,
CORE-BANKING-INTEGRATION.md.
**CPSI** R63–R86 (Python 19/19) : score perpétuel/half-life/segmentation/
explicabilité R63–R67 · gouvernance R68–R70 (bac à sable verrou) · groupes &
ciblage R71–R74 · insider/cases/séparation R75–R77 · pipeline signaux scorés
R79–R83 (X, near-miss, dédup, FP apprenant) · KYC lock/handoff/visa R84–R86 ·
⚠ R78 = numéro réservé (gap documenté).
**Porte CPSI** R248–R252 (PC-01..14) : shell-out contrat versionné 1.0/1.1,
journal cpsi_events, rejeu mesuré, 503 gracieux, case_proposal idempotent,
timeline/volumétrie/SLA t0→t1→t2 par rejeu (R281).
**Olivia v1/v1.1** R253–R258 (OL-01..34) : port IA, propositions, ContextBuilder
borné + empreintes, citations obligatoires, journal rejouable, persona/4
langues/multi-tour/SSE/anti-injection/non-révélation.
**Olivia v2 swarm** R259–R266 (SW-01..18) : registre agents/outils GET|PROPOSE
liste blanche, runs write-ahead, scope commanditaire, budgets durs, portes
humaines, replay intégral, supervision — missions PREREVUE_DOSSIER &
ANALYSE_CORRELATION.
**Écrans-projections** — Home R253* (HO-01..08) · Command Center R288 +
généralisation par rôle R289/Compliance Center (DC-01..07).
**Vague pilote** — AML workspace (AW-01..08) · cpsiparam/cpsiguide (PA-01..06,
verrou simulation structurel) · 6 bacs à sable (SB-01..06) · sections & droits
sdkyc/sdar/sdgar/paramfields/cocparam (SD-01..06).
**Offboarding** R267–R271 (OF-01..12) : workflow jamais-suppression, rétention
10 ans, 5 types/visas, blocages listés, art. 10a cloisonné (SQL + Olivia),
retour = Rn+1 chaîné, ex-exit → EDD.
**Reviews** R272–R275 (RV-01..08) : échéance calculée, cadences EDD12/CDD36/
SDD60, anticipation événementielle, recul à visa, EN_RETARD calculé.
**CoC** R276–R278 (CC-01..08) : dossier à cycle de vie, matérialité figée,
action vérifiée à la clôture, chaîne prouvable CDB 20.
**Licence** R279 (LC-01..03) : servie ET appliquée serveur, audit préservé.
**Versionnage droits** R282 (VD-01..04) · **Review profiles** R283 (RS-01..05).
**SO** R284 (AU-01..08) : surfaces d'audit vs opérationnel, l'auditeur audité,
jamais un regard du 4-yeux, cumul ADMIN refusé, écran auditit (chaînes vérifiées).
**Transport** R285–R287 (AS-01..08) : outbox d'abord, références seulement,
at-least-once + watermarks + dead-letters visibles, SSE descendant scopé.
**IAM écrans** paramnav/ssoparam/iamguide (IM-01..05 : secret jamais servi,
bascule SSO 4-yeux à date).
**Cross-Border** R290–R292 (XB-01..05) : country manual versionné default-deny,
un moteur deux surfaces (voyage + KYC §10), dérogation visa Legal, reverse
solicitation documentée.
**Dégel V1–V9** R294–R320 : flux transactionnel canonique + txrisk (surface du
CPSI, jamais un 2ᵉ moteur) + fx lecture + SWIFT sans émission (TF-01..12) ·
custody/TA registre-journal + rapprochement (CY-01..06) · Builder 5 verrous,
zéro runtime propre (BD-01..10) · regwatch (RW-01..05) · legal sur GED +
échéances calculées (LE-01..04) · BI liste blanche lecture (BL-01..04) ·
mobile v1 population IAM distincte + exclusions normatives 404 (MB-01..05) ·
console éditeur vendor séparée + licence signée (VE-01..03) · Octopulse OpRisk
(OP-01..05).
**Rejeu optimisé** R321–R322 (PC-15..20 : équivalence octet, snapshots
jetables, chemins déclarés) · **i18n** R323–R324 (LN-01..06 : dictionnaire
source, données jamais traduites, langue_correspondance).
**Clôture** R325–R327 : JWT partout, en-têtes supprimés, harnais en jetons
réels (JW-01..06) · tenant démo GWB scripté via APIs, zéro if-demo (DM-01..06)
· readiness + pipeline à bascule conditionnelle (RZ-01..04).
**Industrialisation** R328–R331 : registrar inbox→PR de ratification
(SY-01..05) · FAT dérivée du catalogue, gate absolue (FB-01..04) · BAT cahier
généré + signature visa (FB-05..07) · migrations expand/contract, triggers
actifs pendant migration, répétition hebdo (MG-01..05).
**On-premise** R332–R334 (PK-01..06) : paquet signé autosuffisant, installation
= le pipeline, réseau sortant nul contractuel.
*(\*Home renuméroté au repo — le générateur tranchera.)*

# 5. ÉCRANS — 72/72 couverts
67+4 bacs = 71 au front tenant + 1 app vendor. Comptage gravé : « absent par
canon » ≠ « absent par retard ». Conformité visuelle : grille 5 colonnes,
hiérarchie canon > maquette > goût, i18n 4 langues, tokens olive.

# 6. OPS & QUALITÉ
Pipeline phases 0–5 (tag signé → staging+FAT → répétition restore → prod humaine
rolling → contract N+1) · FAT/BAT/migrations (§4) · ASVS L2 + suite d'attaque IA
+ golden set Olivia en CI · observabilité (jauge R250, dead-letters, backups) ·
runbook Exoscale 10 étapes (critère : restauration chronométrée) · DR cross-zone.
Roadmap IA priorisée : mesurer → RAG GED → few-shot décisions → attaque →
routage → missions ; fine-tuning en dernier.

# 7. RESTE (exhaustif)
Actes Ali : terraform apply + restore testé · canal d'alerte · 4 écarts ASVS ·
pentest (cabinet CH, retest, mobile exclu→dédié) · marque · premier pilote.
Décisions d'opportunité : cache moteur (jauge), options coupées (tokenisation,
AMA, paiements mobile) sur demande client.

---
# PROMPT SOURCE — GÉNÉRER LE DOCUMENT FAISANT FOI (conservé pour traçabilité)

Objectif : produire `docs/CANON-MASTER.md` — LE document unique faisant foi,
GÉNÉRÉ depuis le repo (jamais rédigé à la main), et le maintenir à jour.
(1) Générateur parcourant `spec/`, catalogues, `PROJECT-INDEX.md`,
`questionnaire-R-Q.md` et le code → mapping session↔repo, inventaire intégral,
paramètres R-Q, écrans, gels/options, invariants, en-tête daté+hash.
(2) Vérifications : numéro manquant/doublon, règle sans scénario, scénario sans
suite → rapport d'anomalie en tête (jamais corrigé en silence).
(3) CI : régénération à chaque merge ; édition manuelle → build rouge.
(4) Comparaison référentiel de session ↔ généré → rapport de divergences à
signaler, pas à absorber.
