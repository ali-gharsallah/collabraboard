# O-Live — Canon : TRIAGE FINAL DE LA NAV · OIDC PER-TENANT AU LOGIN · PASSE DE CONFORMITÉ VISUELLE

**Statut : PROPOSÉ — étape 0 EXÉCUTÉE (2026-07-28), STOP en cours : ratification des
mappings et verdicts ci-dessous par Ali.**

## VERDICT ÉTAPE 0 (exécutée sur le repo réel)

- **0a Numérotation : R289, R290, R291 EN COLLISION** ✗ — pris LE JOUR MÊME (R289
  Command Center · R290 extension MOD-30/ssoparam · R291 compléments Command Center,
  tous ratifiés et livrés). **Prochain libre : R292. Mapping proposé** :
  | Canon proposé | Se lit | Objet |
  |---|---|---|
  | R289 | **R292** | Généralisation du patron de projection (Compliance Center) |
  | R290 | **R293** | Country manual versionné |
  | R291 | **R294** | Check cross-border évalué/tracé, dérogation à visa |
  | R292 | **R295** | Reverse solicitation documentée |
  | R293 | **R296** | Login deux temps (résolution tenant) |
  **Familles** : XB LIBRE ✓ · LG LIBRE ✓ · **DC-06/07 EN COLLISION** ✗ (pris ce jour
  par R291 : charge compliance + dead-letters DIR) → les scénarios Compliance Center
  se lisent **DC-08/DC-09** (libres ✓) · **AU-07/08 EN COLLISION** ✗ (AU-01..09 = IAM
  R89/R90, `auth.spec.ts` — collision déjà arbitrée une fois : famille R284 = SO) →
  les scénarios audit IT se lisent **SO-07/SO-08** (libres ✓).
- **0b Vérifications de triage (sur pièce et sur code)** :
  1. **Prospect : R117 LE MODÉLISE DÉJÀ** — `onboardings.etape` commence à `PROSPECT`
     (PROSPECT|COLLECTE|KYC_EN_COURS|DECISION|OUVERT|REFUSE|ABANDONNE, `prospectNom`,
     funnel servi). **Verdict : `prospection` = RENDU LÉGER** (écran sur
     `GET /v1/onboarding` filtré par étape — aucun modèle nouveau), pas un gel.
  2. **sbowner ↔ existant** : la maquette montre « Comité de paramétrage — owner »
     (arbitrage accepter/refuser motivé R7 + stress test cumulé). Le PATTERN existe
     DEUX FOIS au produit : propositions Olivia (R255, adopt/reject motivé) et
     propositions de barème CPSI (R69/CP-10). **Verdict : couvert EN SUBSTANCE ;
     reliquat en ÉCART consigné** — comité UNIFIÉ multi-sources + « stress test
     cumulé » n'existent pas (extension à canon si souhaitée, jamais implémentée en
     silence).
  3. **Rôle EDITOR : CONFIRMÉ ABSENT du RBAC tenant** (enum = RM ARM CO CO_SR MLRO CF
     BRM DIR ADMIN SO). **INTERDICTION CONSIGNÉE** : EDITOR est l'outillage d'O-Live
     ÉDITEUR (console vendor, hors produit tenant) et ne doit JAMAIS entrer dans
     l'enum tenant — séparation instance/éditeur structurelle.
- **0c** : canon enregistré ici ; note de gel mise à jour (Octopulse = OpRisk MOD-50,
  gelé — confirmé) ; DECALAGE tenu.
- **Livrable « 6 PRs »** → précédent ratifié : branche unique PR #46, six séquences
  de commits — sauf contre-ordre.

---

# TEXTE DU CANON (les numéros se lisent selon le mapping 0a : R292..R296, DC-08/09, SO-07/08)

## PARTIE 1 — TRIAGE FINAL DES ITEMS DE NAV

### R292 — Le patron de projection se GÉNÉRALISE : une projection de pilotage par rôle
Command Center (Direction) et **Compliance Center** (CO/CO_SR) = deux instances du
MÊME patron : lecture seule, sources ratifiées, drill vers l'opérationnel, seuils qui
colorent (R39), aucune action. Compliance Center compose : stats règles AML
(volumétrie PC-13), propositions en attente (Olivia R255 + aiguillages CPSI CP-10),
accès MROS (liste R129-R132 — l'ACTION reste dans l'écran MROS), SLA (PC-18),
CoC/reviews en souffrance. Toute projection de rôle future = déclaration de tuiles
sous ce patron, pas une règle.
> **DC-08** — Le Compliance Center est le Command Center du CO : DC-01..05 re-passés
> avec le rôle CO (accès CO/CO_SR ; Direction en lecture ; RM → 403).
> **DC-09** — Un seul patron de code : les deux écrans importent le MÊME composant de
> projection (vérifié à l'import, pattern RW-04).

### Extension R284 — écran `auditit` (SO-07/SO-08, aucune règle nouvelle)
Vérification d'INTÉGRITÉ à la demande (chaînage des journaux : kyc_question_history,
cpsi_events, olivia_messages, olivia_run_events, versions R282 — seq monotones,
premier maillon rompu localisé) + journal des paramétrages TRANSVERSAL (événements de
config R68 de tous les modules). Accès SO (+ Direction lecture) ; la vérification est
une LECTURE tracée (AUDIT_ACCESS).
> **SO-07** — La vérification de chaîne est un acte tracé : fixture corrompue
> détectée et localisée ; AUDIT_ACCESS émis.
> **SO-08** — Le journal des paramétrages est transversal : même source
> (domain_events), aucun agrégat parallèle.

### Application (pas de règle) — `apidoc`, `integrations`, `prospection`
`apidoc` : doc GÉNÉRÉE (OpenAPI des décorateurs + contrat d'enveloppe de porte CPSI) —
jamais rédigée à la main ; endpoint non décoré = écart à combler. `integrations` :
état des PORTS déclarés en lecture (core R167-169, porte CPSI R250, port IA, modules
actifs R279) — « configurer » RENVOIE (pattern SD-05). `prospection` : rendu du funnel
R117 filtré PROSPECT (verdict 0b.1).

## PARTIE 2 — CROSS-BORDER (R293-R295, famille XB)

### R293 — Le COUNTRY MANUAL est un paramètre tenant versionné — jamais un savoir implicite
Par juridiction : statut de sollicitation (interdite / passive / sous licence /
libre), activités couvertes, licence éventuelle, source/date de la position (référence
du mémo juridique — O-Live STRUCTURE la position de la banque, il ne fournit JAMAIS
l'avis juridique). Versionné à date (R68). Juridiction ABSENTE = « non déterminé —
analyse Legal requise » (default-deny, pattern R169).

### R294 — Le check cross-border ÉVALUE et TRACE — la dérogation existe mais se paie en visa
DEUX points d'évaluation, UN moteur : check pré-voyage (Business Trip) et check à la
relation (section KYC 10). Résultat = événement (entrée, version du manual, verdict).
Un verdict restrictif ne bloque pas (R39) mais exige la voie prévue : dérogation
motivée + visa Legal (`visa_derogation_xb`, défaut LEGAL... mappé DIR au produit si le
rôle LEGAL n'existe pas — vérifié à la livraison), initiateur exclu (R13). Sans visa :
« non conforme » — visible, reporté, jamais silencieux.

### R295 — La RÉCEPTION D'ORDRES suit la reverse solicitation — documentée ou refusée
Pays restreint → ordre enregistrable UNIQUEMENT avec qualification « à l'initiative du
client » tracée (+ preuve GED exigible en EDD — `preuve_reverse_solicitation`).
Reporting du volume par pays : mesuré, notifié (R39), jamais bloquant.

> **XB-01** — L'absent est non déterminé (jamais « autorisé » par défaut, version du
> manual tracée). **XB-02** — Le manual se rejoue (R68/R48). **XB-03** — La dérogation
> se paie en visa (initiateur exclu ; sans visa : non conforme, visible, non bloqué).
> **XB-04** — La reverse solicitation se documente (refus typé sans qualification ;
> preuve GED obligatoire en EDD). **XB-05** — Un moteur, deux surfaces (même verdict
> pré-voyage et relation, 3 juridictions de fixtures).

## PARTIE 3 — R296 : LE LOGIN RÉSOUT LE TENANT D'ABORD (famille LG)
Deux temps : (1) identifiant seul → méthode (LOCAL affiche le mot de passe ; SSO
redirige vers l'IdP du tenant, config IM en vigueur) — réponse INDISTINGUABLE entre
domaine inconnu et domaine LOCAL (énumération impossible, pattern OL-34, timing
compris) ; (2) authentification selon la méthode (LOCAL = MOD-30 ; SSO = code flow +
mapping claims→rôles). IdP injoignable → erreur typée SANS repli silencieux
(`sso_fallback_local`, défaut faux, changement four-eyes). Break-glass : locaux,
nominatifs, MFA obligatoire, chaque usage notifié SO/Direction (AUDIT_ACCESS).
> **LG-01..05** — deux temps un flux · rien ne s'énumère (timing testé) · bascule à
> date appliquée au portail (IM-04 re-passé bout en bout) · pas de repli silencieux ·
> break-glass tracé impossible à manquer.

## PARTIE 4 — PASSE DE CONFORMITÉ VISUELLE (méthode)
`docs/CONFORMITE-VISUELLE.md` : une grille par écran (nav & libellés 4 langues ·
structure — tout absent/ajouté = ligne d'écart · tokens palette olive · états HO-04/
LC-01 — le canon prime sur la maquette pour les états, la maquette pour la structure ·
données : AUCUNE donnée de maquette ne migre). Hiérarchie : canon ratifié > maquette >
goût ; conflit canon↔maquette = arbitrage Ali. Écrans livrés d'abord, puis critère
d'acceptation permanent des PRs d'écran.

## PARTIE 5 — GEL confirmé (déclencheurs)
`txrisk` (flux réel) · `fx` (port core) · `mobile` (phase 5) · `custody` (bloc dédié) ·
`regwatch` (sources + pilote) · **Octopulse OpRisk = MOD-50 AMA, gelé (trié)** —
l'audit IT SO-07/08 couvre l'intégrité technique, ne pas confondre · Workflow/
Questionnaire/Section BUILDER : gel partiel motivé (le paramétrage ratifié couvre le
pilote ; CRÉER = bloc dédié avec bac + grandfathering) · `editorconsole` : HORS
produit tenant (rôle EDITOR jamais au RBAC tenant — interdiction consignée 0b.3).

# INTERDITS : donnée de maquette migrée ; élément implémenté/omis sans ligne de
# grille ; « autorisé » par défaut pour une juridiction absente ; repli SSO→LOCAL
# silencieux ; rôle EDITOR au RBAC tenant ; avis juridique généré ; code avant test.
