# ═══ VERDICT ÉTAPE 0 (Claude Code, 2026-07-27) — canon reçu d'Ali, enregistré tel quel ci-dessous ═══

**a) Numérotation : R272–R279 LIBRES** (grep exhaustif après le bloc Offboarding R267–R271,
ratifié 2026-07-27). ⚠ Voir (c) : **R279 se requalifie en APPLICATION → le numéro R279 n'est
PAS consommé** par ce canon ; le bloc effectif est **R272–R278**. Prochain numéro libre : R279.

**b) Familles : RV et CC LIBRES — ⚠ COLLISION sur LC.**
`LC-01..05` est **déjà pris** par le corpus du module licence vendor
(`apps/api/src/modules/license/vendor-license.service.ts` + `vendor-license.wiring.spec.ts`,
R177→R179 — précisément le bloc que la partie 3 applique). **Renommage proposé : `LC` → `LS`
(Licence Servie), LS-01..03, vérifié libre.** STOP — validation du renommage requise avant
d'exécuter la partie 3 (le fond de la partie 3 n'est pas bloqué, voir (c)).

**c) R177–R179 : l'enforcement runtime N'EXISTE PAS — mais les primitives OUI, DEUX fois.**
Le repo contient **deux services de licence codés et spécifiés, AUCUN branché** :
1. `LicenseService` (`license.service.ts`) — licence par tenant, fichier signé **Ed25519**
   vérifiable hors ligne, `assertModule(tenantId, module)` prêt à l'emploi, cache mémoire.
   Aucun consommateur hors module, aucun guard, aucune route.
2. `VendorLicenseService` (`vendor-license.service.ts`) — licence par INSTANCE, stockée en
   base (`vendorLicense`, historique append-only R179, non-rétroactivité, signature vérifiée
   à chaque lecture, `perimetre()`/`verifier()`), corpus LC-01..05. **Non enregistré dans
   aucun module Nest** — mort-né côté runtime.
Aucune route HTTP ne sert le périmètre ; `MODULE_INACTIF` n'apparaît nulle part ; aucune garde
sur les contrôleurs. **Conséquence (prévue par le canon) : R279 SE REQUALIFIE EN APPLICATION**
de R177–R179 — endpoint `GET /v1/modules/actifs` + garde serveur branchée + événement
d'activation à date (déjà couvert par l'append-only R179 côté vendor). Aucune règle nouvelle.
**Point d'arbitrage résiduel** : lequel des deux services est LA source (vendor/instance vs
tenant/Ed25519) — ils ne sont pas superposables (granularité instance vs tenant). Proposition :
`VendorLicenseService` (DB, append-only, testé 9/9) comme source, l'autre consigné en écart.

**d) Divergence repo vs canon — partie 2 (CoC) : le store `COC_CONFIG` N'EXISTE PAS.**
Le canon l'affirme existant (« ~40 types, matérialité, action, rôle, sévérité CPSI ») — or
(déjà consigné au verdict de `canon-vague-ecrans-pilote.md`) : le CoC est un ÉVÉNEMENT brut
(`POST /v1/personnes/:id/coc {champ, valeur, document}` → events + rescreening R42), sans
typologie, sans matérialité, sans store versionné. `coc_sensible` n'existe que comme **poids
de signal dans le moteur CPSI Python** (`engine.py`) — aucune émission câblée depuis le CoC
réel. **R276 (« copiées depuis COC_CONFIG EN VIGUEUR ») est INEXÉCUTABLE sans créer d'abord le
store → STOP partie 2** : soit le canon CoC intègre la création de COC_CONFIG (extension de
R276), soit un canon COC_CONFIG séparé est fourni. La partie 1 (reviews) et la partie 3
(licence) ne dépendent pas de ce point — SAUF RV-04/CC-04 (anticipation par CoC Haute), qui
resteront à prouver quand la partie 2 ouvrira (même patron que l'écart OL-07).

**Dépendances partie 1 vérifiées** : ✅ approbation KYC = événement existant (hook, pas de
cron) · ✅ `KycFile.previousKycId` (chaînage Rn+1) · ✅ four-eyes visa (R13, pattern existant) ·
✅ paramètres R-Q versionnés à date. 🟡 « franchissement de bande CPSI à la hausse » (R273) :
la proposition R66 adoptée existe côté CPSI (`params/proposals`), le déclencheur automatique
d'anticipation sera un consommateur d'événement à câbler — signalé, pas inventé.

**Écarts T7/T8/HO-02 (ECARTS-FRONT)** : référence croisée posée vers ce canon — ils seront
SOLDÉS à la livraison de chaque partie (T7 ← partie 1, T8 ← partie 2, HO-02 ← partie 3).

═══ FIN DU VERDICT ÉTAPE 0 — CANON REÇU CI-DESSOUS, VERBATIM ═══

# O-Live — Canon des DÉBLOQUANTS HOME
# Échéances de review (R272–R275) · Cycle de vie CoC (R276–R278) · Licence servie (R279)

**Statut : PROPOSÉ — en attente de ratification par Ali Gharsallah.**
Origine : écarts consignés par Claude Code (spec + ECARTS) — T7 et T8 de l'écran Home
sont bloqués par les DONNÉES (aucun modèle d'échéance, aucun cycle de vie CoC), et
HO-02 est partiel (licence non surfacée au front). Ce canon les débloque.
Numérotation R272–R279 **sous réserve** (étape 0 : prochain numéro libre après le bloc
Offboarding R267–R271 ; collision → mapping + STOP).
Familles de scénarios : **RV** (reviews), **CC** (CoC), **LC** (licence) — à vérifier
libres.
Conventions héritées : événements append-only (R48/R49) · versionné à date avec
grandfathering (R29/R68) · le système mesure et notifie, ne coerce pas (R39) · motif
obligatoire (R7) · paramètres tenant au questionnaire R-Q.

---
---

# PARTIE 1 — ÉCHÉANCES DE REVIEW (R272–R275)

Enjeu : la revue périodique est une obligation (CDB 20 / pratique FINMA : cadence selon
le risque). Aujourd'hui le module Account Review existe mais AUCUNE échéance n'est
modélisée — T7 n'a rien à afficher, et surtout la banque n'a aucune preuve de sa
discipline de revue. C'est le « Perpetual KYC » de Fenergo, version O-Live : calculé,
versionné, rejouable.

## 1.1 Les règles

### R272 — L'échéance est CALCULÉE — jamais saisie, toujours versionnée
Chaque client actif porte UNE échéance de review courante, calculée :
`due_date = date d'approbation du dernier KYC/review + cadence(ddl_level)`.
La cadence est un **paramètre tenant par niveau de diligence** (`cadence_review_mois` :
EDD 12 / CDD 36 / SDD 60 par défaut), **versionné à date** (R68) : changer la cadence
ne réécrit pas les échéances passées — les échéances déjà émises sous l'ancienne
cadence restent valables (grandfathering R29), les prochaines utilisent la nouvelle.
Le changement de `ddl_level` d'un client (KYC Rn+1 approuvé, aiguillage adopté) est un
ÉVÉNEMENT qui recalcule l'échéance — jamais un recalcul silencieux en tâche de fond
sans trace.

### R273 — L'anticipation est un ÉVÉNEMENT motivé — le recul exige un visa
L'échéance peut être **avancée** par : un CoC de matérialité Haute (R277), un
franchissement de bande CPSI à la hausse (la proposition R66 adoptée), ou une décision
humaine motivée (R7). Chaque anticipation = événement (déclencheur, ancienne date,
nouvelle date, auteur). L'échéance ne peut être **reculée** que par un rôle habilité
(`roles_report_echeance`, défaut CO_SR) avec motif ET visa four-eyes (R13) — reporter
une revue est un acte de risque, pas une commodité.

### R274 — La review due NOTIFIE — elle ne bloque jamais (R39)
À `due_date − preavis_review_jours` (défaut 30) : tâche créée pour le RM + notification.
À `due_date` dépassée : le dossier est marqué EN_RETARD (fait mesuré, visible T7 et
reporting — nombre de jours de retard), notification d'escalade paramétrable
(`escalade_retard_jours` → CO puis Direction). AUCUNE opération n'est bloquée par le
retard : le retard est une donnée d'audit et de pilotage, pas une coercition.

### R275 — La review RÉALISÉE = un KYC Rn+1 chaîné — et l'échéance suivante repart
Réaliser la review réutilise le modèle EXISTANT : un nouveau KYC (révision Rn+1,
`previous_kyc_id` chaîné) sur le workflow correspondant au risque courant. L'approbation
de ce KYC (four-eyes existant) clôt l'échéance (RÉALISÉE, avec référence au KYC) et en
calcule la suivante (R272). Aucun modèle de « review light » parallèle : une seule
mécanique de dossier, le workflow SDD/CDD/EDD module déjà la profondeur.

## 1.2 Modèle de données

```sql
CREATE TABLE review_deadlines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    client_id UUID NOT NULL REFERENCES clients(id),
    source_kyc_id UUID NOT NULL REFERENCES kyc_files(id), -- le KYC dont part le calcul
    ddl_level VARCHAR(10) NOT NULL,          -- niveau au moment du calcul (figé)
    cadence_mois INTEGER NOT NULL,           -- valeur EN VIGUEUR au calcul (figée — R272)
    due_date DATE NOT NULL,
    statut VARCHAR(12) NOT NULL DEFAULT 'PLANIFIEE'
      CHECK (statut IN ('PLANIFIEE','REALISEE','REMPLACEE')),
      -- REMPLACEE = recalcul (anticipation, changement ddl) : l'ancienne ligne reste,
      -- la nouvelle la référence — l'historique des échéances est complet.
    remplace_par UUID REFERENCES review_deadlines(id),
    realisee_kyc_id UUID REFERENCES kyc_files(id),        -- R275
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- EN_RETARD n'est PAS un statut stocké : c'est due_date < today AND statut='PLANIFIEE'
-- — un fait calculé à la lecture, jamais un état à synchroniser.
-- Événements outbox : REVIEW_DEADLINE_SET / _ANTICIPEE / _REPORTEE / _REALISEE.
-- Contrainte : au plus UNE ligne PLANIFIEE par client (index partiel unique).
```

Endpoint T7 : `GET /api/v1/reviews/deadlines?horizon_jours=30&scope=rôle` — sert la
tuile ET l'écran Account Review (même source, cohérence garantie).

## 1.3 Paramètres tenant (questionnaire R-Q)

| Paramètre | Défaut | Règle |
|---|---|---|
| `cadence_review_mois` {EDD, CDD, SDD} | 12 / 36 / 60 | R272 |
| `preavis_review_jours` | 30 | R274 |
| `escalade_retard_jours` {CO, Direction} | 30 / 90 | R274 |
| `roles_report_echeance` | {CO_SR} | R273 |

## 1.4 Scénarios RV-01..RV-08

> **RV-01 — L'échéance naît de l'approbation** : KYC R1 approuvé le 10.01, client CDD,
> cadence 36 → une ligne PLANIFIEE au 10.01+36 mois ; événement REVIEW_DEADLINE_SET.
> **RV-02 — La cadence change, le passé tient** : cadence CDD 36→24 en vigueur au
> jour J → les échéances PLANIFIEE émises avant J sont INCHANGÉES ; un KYC approuvé
> après J produit une échéance à 24 mois (grandfathering R272).
> **RV-03 — Le changement de niveau recalcule, tracé** : client CDD passe EDD (KYC Rn+1
> approuvé) → l'ancienne échéance passe REMPLACEE (chaînée), une nouvelle PLANIFIEE à
> 12 mois existe ; les deux lignes sont au journal.
> **RV-04 — Le CoC Haute anticipe** : CoC matérialité Haute ouvert → événement
> REVIEW_DEADLINE_ANTICIPEE, nouvelle due_date selon l'action (R277) ; l'ancienne ligne
> REMPLACEE.
> **RV-05 — Le recul est un acte à visa** : CO tente de reporter → refus (rôle) ;
> CO_SR reporte avec motif → exige le visa d'un second (four-eyes R13) ; sans motif →
> refus typé.
> **RV-06 — Le retard mesure, ne bloque pas** : échéance dépassée de 40 j → le client
> apparaît EN_RETARD (calculé) en T7 et au reporting avec « 40 j » ; l'escalade CO est
> partie à J+30 ; TOUTES les opérations du dossier restent possibles (R39).
> **RV-07 — La review réalisée referme la boucle** : KYC Rn+1 approuvé → l'échéance
> passe REALISEE (référence au KYC), la suivante est PLANIFIEE ; T7 ne montre plus le
> client.
> **RV-08 — Une seule échéance vivante** : tentative d'insertion d'une seconde ligne
> PLANIFIEE pour le même client → contrainte violée (index partiel), refus.

---
---

# PARTIE 2 — CYCLE DE VIE DU CoC (R276–R278)

Enjeu : le paramétrage CoC existe (COC_CONFIG : ~40 types, matérialité, action, rôle,
sévérité CPSI) et le signal `coc_sensible` alimente le CPSI — mais un CoC individuel
n'est qu'un événement sans état. Impossible de savoir ce qui est TRAITÉ. T8 n'a rien à
compter, et l'« engagement de mise à jour spontanée » (CDB 20) n'a pas de preuve de
traitement. Ce bloc donne au CoC un dossier.

## 2.1 Les règles

### R276 — Le CoC est un DOSSIER à cycle de vie — la matérialité est FIGÉE à l'ouverture
```
OUVERT → EN_TRAITEMENT → { TRAITE | NON_RETENU }
```
Chaque CoC déclaré crée un dossier : client, type (référence COC_CONFIG), description,
déclarant, pièces. La **matérialité et l'action requise sont copiées depuis COC_CONFIG
EN VIGUEUR à l'ouverture et FIGÉES** (grandfathering R29 : reconfigurer un type ne
requalifie pas les CoC ouverts — le CoC d'hier se juge aux règles d'hier). Le signal
CPSI `coc_sensible` (sévérité du type) est émis à l'ouverture — mécanisme existant,
désormais rattaché au dossier. NON_RETENU (le changement déclaré s'avère sans objet)
exige un motif (R7) — jamais une disparition silencieuse.

### R277 — L'action imposée par la matérialité est VÉRIFIÉE à la clôture
La transition vers TRAITE est refusée tant que l'action requise (figée à l'ouverture)
n'est pas accomplie et référencée :
- **Haute** → une révision KYC est CRÉÉE (KYC Rn+1, R275) et référencée — la contrainte
  « matérialité Haute force la révision » (annexe C) devient vérifiable, pas
  déclarative. L'échéance de review est anticipée (R273/RV-04).
- **Moyenne** → mise à jour ciblée tracée (les questions KYC touchées, via le change
  tracker existant) OU décision motivée qu'aucune mise à jour n'est requise (visée).
- **Basse** → prise de connaissance visée suffit.
Le refus liste ce qui manque (pattern R269). Le traitement est réservé au rôle du type
(COC_CONFIG) ; four-eyes optionnel par matérialité (`coc_four_eyes` : Haute=vrai).

### R278 — Le CoC clôturé PROUVE — chaîne complète rejouable
Un CoC TRAITE porte la chaîne : déclaration → matérialité/action figées → signal CPSI →
actions accomplies (réf. KYC Rn+1, questions modifiées, visas) → clôture. Cette chaîne
se rejoue à date (R48/R49) — c'est la preuve CDB 20 de l'engagement de mise à jour :
« montrez-moi comment ce changement déclaré a été traité » se répond en un clic.
Le reporting expose le délai ouverture→traitement par matérialité (SLA R39 : mesuré,
notifié, jamais bloquant).

## 2.2 Modèle de données

```sql
CREATE TABLE coc_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    client_id UUID NOT NULL REFERENCES clients(id),
    type_code VARCHAR(40) NOT NULL,          -- réf COC_CONFIG
    -- ── Figé à l'ouverture (R276) ──
    materialite VARCHAR(10) NOT NULL CHECK (materialite IN ('HAUTE','MOYENNE','BASSE')),
    action_requise VARCHAR(30) NOT NULL,     -- 'REVISION_KYC','MAJ_CIBLEE','PRISE_CONNAISSANCE'
    role_traitant VARCHAR(20) NOT NULL,
    severite_cpsi NUMERIC,                   -- sévérité du signal émis
    config_version_at TIMESTAMPTZ NOT NULL,  -- version COC_CONFIG appliquée (preuve)
    -- ── Cycle de vie ──
    statut VARCHAR(14) NOT NULL DEFAULT 'OUVERT'
      CHECK (statut IN ('OUVERT','EN_TRAITEMENT','TRAITE','NON_RETENU')),
    description TEXT NOT NULL,
    declarant UUID NOT NULL REFERENCES users(id),
    -- ── Preuves de traitement (R277) ──
    revision_kyc_id UUID REFERENCES kyc_files(id),
    maj_refs JSONB,                          -- questions/objets modifiés référencés
    traite_par UUID REFERENCES users(id),
    traite_at TIMESTAMPTZ,
    motif_cloture TEXT,                      -- obligatoire si NON_RETENU (contrainte)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT motif_si_non_retenu CHECK (statut <> 'NON_RETENU' OR motif_cloture IS NOT NULL)
);
-- Événements outbox : COC_OUVERT / _EN_TRAITEMENT / _TRAITE / _NON_RETENU.
-- Le signal CPSI coc_sensible émis à l'ouverture référence coc_file_id (rattachement).
```

Endpoint T8 : `GET /api/v1/coc?statut=OUVERT,EN_TRAITEMENT&scope=rôle` (compteur +
répartition par matérialité) — sert la tuile ET l'écran CoC opérationnel.

## 2.3 Paramètres tenant (questionnaire R-Q)

| Paramètre | Défaut | Règle |
|---|---|---|
| `coc_four_eyes` {HAUTE, MOYENNE, BASSE} | vrai / faux / faux | R277 |
| `coc_sla_jours` {HAUTE, MOYENNE, BASSE} | 10 / 30 / 90 (notification, jamais blocage) | R278 |

## 2.4 Scénarios CC-01..CC-08

> **CC-01 — L'ouverture fige et signale** : CoC « changement d'UBO » (Haute) ouvert →
> dossier OUVERT avec matérialité/action/rôle figés + config_version_at ; le signal
> CPSI coc_sensible est émis avec référence au dossier.
> **CC-02 — Reconfigurer ne requalifie pas** : le type passe Haute→Moyenne au jour J →
> le CoC ouvert avant J reste HAUTE avec action REVISION_KYC ; un CoC ouvert après J
> est MOYENNE (grandfathering).
> **CC-03 — Haute sans révision ne se clôt pas** : transition TRAITE sans
> revision_kyc_id → refus listant « révision KYC manquante » ; créer le KYC Rn+1 puis
> clore → TRAITE avec la référence.
> **CC-04 — Le Haute anticipe la review** : ouverture d'un CoC Haute → événement
> REVIEW_DEADLINE_ANTICIPEE (RV-04 déclenché depuis CC).
> **CC-05 — Moyenne : mise à jour référencée ou décision motivée** : TRAITE avec
> maj_refs listant les questions modifiées → accepté ; TRAITE sans maj_refs ni décision
> motivée visée → refus.
> **CC-06 — Le rôle du type traite, four-eyes en Haute** : un RM tente de traiter un
> CoC dont role_traitant=CO → refus ; le CO traite un Haute → le visa d'un second est
> exigé (paramètre) ; l'initiateur ne peut pas être le second (R13).
> **CC-07 — NON_RETENU exige un motif** : sans motif → contrainte SQL violée, refus
> typé ; avec motif → NON_RETENU, la chaîne reste au journal.
> **CC-08 — La chaîne se rejoue** : replay d'un CoC TRAITE → déclaration, valeurs
> figées, signal, KYC référencé, visas, clôture — dans l'ordre ; le délai
> ouverture→traitement apparaît au reporting ; dépassement SLA = notifié, rien bloqué.

---
---

# PARTIE 3 — LA LICENCE EST SERVIE (R279)

Enjeu : R177–R179 (module & licence) sont ratifiés côté modèle, mais rien ne les SERT
au front — HO-02 est invérifiable et, pire, l'activation n'est peut-être appliquée
nulle part en runtime. ⚠️ **Étape 0 spécifique** : si l'enforcement runtime existe déjà
sous R177–R179, R279 se requalifie en APPLICATION (endpoint seul, pas de nouvelle
règle) — Claude Code vérifie et signale avant de coder.

### R279 — La licence est SERVIE et APPLIQUÉE — jamais supposée
Un endpoint lecture seule `GET /api/v1/modules/actifs` sert la liste des modules actifs
du tenant (code, libellé, actif_depuis) — LA source du front pour menus, tuiles (HO-02)
et routes. Côté backend, chaque route d'un module vérifie l'activation : module inactif
→ refus typé `MODULE_INACTIF` 403 (l'enforcement est SERVEUR ; masquer au front ne
suffit jamais). L'activation/désactivation d'un module est un événement versionné à
date (R68/R177) — « depuis quand ce tenant a-t-il l'AML ? » se répond au journal.

### Scénarios LC-01..LC-03
> **LC-01 — Le front lit, le backend applique** : tenant sans CPSI → /modules/actifs ne
> liste pas CPSI, la tuile T4 est absente (HO-02 complet), ET un appel direct à une
> route CPSI (curl) → 403 MODULE_INACTIF.
> **LC-02 — L'activation est un événement à date** : activer l'AML au jour J →
> l'endpoint le liste avec actif_depuis=J ; le journal porte l'événement (auteur, date).
> **LC-03 — La désactivation n'ampute pas l'audit** : module désactivé → ses routes
> refusent, mais les données et le trail restent consultables par les rôles d'audit
> (lecture seule — pattern R271 : couper l'accès n'efface jamais la preuve).

---

# PROMPT POUR CLAUDE CODE (copier tel quel)

```
Contexte : débloquants Home consignés en ECARTS (T7, T8, HO-02 partiel). Fichier
fourni : canon-debloquants-home.md — 3 parties : reviews R272-R275, CoC R276-R278,
licence R279 (SOUS RÉSERVE).

Étape 0 :
a) Prochain numéro libre après le bloc Offboarding. Collision → mapping + STOP.
b) Familles RV, CC, LC libres ? Collision → renommage proposé + STOP.
c) Vérifie si R177-R179 comportent DÉJÀ un enforcement runtime de la licence. Si oui :
   R279 se requalifie en APPLICATION (endpoint + branchement, pas de nouvelle règle)
   — signale et ajuste le canon avant de coder.
d) Enregistre dans spec/, indexe, et SOLDE les 3 écarts correspondants dans ECARTS
   (référence croisée vers ce canon).

Ordre (un commit par règle, suite verte à chaque frontière) :

1. Partie 3 d'abord (petite, débloque HO-02) : endpoint /modules/actifs + garde
   MODULE_INACTIF sur les routes de module + événement d'activation à date.
   LC-01..03. Rebranche la tuile Home concernée et re-passe HO-02 en entier.
2. Partie 1 : R272 (table review_deadlines, calcul à l'approbation KYC — hook sur
   l'événement d'approbation EXISTANT, pas un cron ; index partiel unique, RV-01,
   RV-02, RV-08) → R273 (anticipation/report, RV-03..05) → R274 (préavis, retard
   calculé à la lecture, escalade notifiée, RV-06) → R275 (réalisation = KYC Rn+1
   chaîné, RV-07). Endpoint T7 + branchement tuile Home.
3. Partie 2 : R276 (coc_files, valeurs figées + config_version_at, signal CPSI
   rattaché, CC-01, CC-02, CC-07) → R277 (vérification d'action à la clôture, refus
   listés, four-eyes, CC-03, CC-05, CC-06 ; déclenchement RV-04 depuis CC → CC-04) →
   R278 (replay + reporting délais, CC-08). Endpoint T8 + branchement tuile Home +
   l'écran CoC opérationnel consomme coc_files (plus seulement des événements).

Interdits : statut EN_RETARD stocké (calculé à la lecture uniquement) ; recalcul
d'échéance silencieux (tout recalcul = événement + ligne REMPLACEE chaînée) ;
requalification d'un CoC ouvert lors d'un changement de COC_CONFIG ; enforcement de
licence uniquement côté front ; cron inventé là où un hook d'événement existant
suffit ; code avant test. Tout écart repo vs canon : STOP et signale.

Livrable : 3 PRs (licence, reviews, CoC), critères = tous scénarios verts + HO-02
re-passé + écarts ECARTS soldés avec référence.
```
