<!-- ÉDITION AU VERSEMENT (A1, 2026-08-08 — session Blocs 63/64) :
  1. NUMÉROTATION : corps renuméroté session→repo (R439–R445+R458 → R446–R452+R465 ;
     R446–R457 → R453–R464 ; « R438 » (pop-up Bloc 62) → R445 repo). Mécanisme
     mapping-session-repo.md §3 : l'implémenté prend le créneau contigu, PK glisse à R466+.
  2. DOCTRINE DELTA (arbitrage PO 2026-08-08, E-6364-0) : implémentation en EXTENSION des
     modules existants — MOD-75 Business Trip (R222–R230), Cross-Border R293–R295 (jamais un
     second référentiel), MOD-43 Formations (R231–R238). Aucun nouveau moteur, aucune règle
     dupliquée : quand l'existant couvre, la règle repo le référence.
  3. R463/R464 (Olivia, session R456/R457) : GELÉES — numéros réservés au canon, aucune implémentation.
  Le document original du drop fait foi pour l'intention ; cette copie fait foi pour les numéros. -->

# Bloc 64 · Cross-Border étendu (MOD-33 normatif)
**Règles R453–R464 · Scénarios XB-01…XB-14 · Statut : RATIFIÉ 08.08.2026 (visa PO) — implémentation autorisée, tests rouges d'abord · R463–R464 GELÉES (Olivia v2)**
**Périmètre** : consolide en contrat d'implémentation toutes les extensions cross-border identifiées le 08.08.2026 — port fournisseur de règles, actes cross-border distants, checks pré-acte embarqués, registre de reverse solicitation, localisation temporaire du client, certifications par juridiction, analyse d'impact réglementaire, multi-entité, exposition consolidée, et les deux briques Olivia (spécifiées, gelées).
**Dépendances** : Bloc 63 (Business Trip R446–R452) — R448 (`matricePays`) est désormais alimentée par le port R453. Contact reports : R188. Formations : R451.
**Écart source : E-XB-1** — la démo porte la matrice `CB_RULES` en constante (aucune source, aucune version), les restrictions par client en lecture seule, et aucun traitement des actes cross-border distants.

---

## 0. Positionnement (pourquoi ce bloc)

Les concurrents (Indigita/BRP, Apiax) vendent le **savoir** (verdicts par pays, 190+ juridictions) et des **checks ponctuels** via API. O-Live ne concurrence pas ce contenu : il l'**orchestre** — source externe branchée en port, verdicts exécutés comme guards du moteur, chaque acte visé, chaque version rejouable à date. Trois différenciateurs qu'aucun acteur ne couvre : la boucle fermée voyage (Bloc 63), les **actes cross-border sans voyage** (visio, email, téléphone — angle mort déclaré du marché), et le **rejeu à date du verdict d'époque**.

---

## 1. Règles

### R453 — La matrice cross-border est un PORT fournisseur, versionnée, synchronisation tracée
**Invariant (mécanisme) — source tenant.**
La matrice juridiction × activités n'est jamais une constante : elle provient d'un **port fournisseur** déclaré par tenant — `INDIGITA_API` | `APIAX_API` | `IMPORT_BRP` (manuel importé) | `INTERNE` (saisie Compliance). Chaque synchronisation ou saisie produit une **version datée immuable** avec diff lisible (juridictions/activités modifiées) et un événement `MATRIX_SYNCED`. Tous les checks (pré-voyage R448, pré-acte R455, actes distants R454) référencent l'ID de version utilisé — le rejeu à date restitue le verdict d'époque (R48).
Fournisseur indisponible : la dernière version connue reste servie, son âge est affiché sur chaque verdict (« matrice du 12.07 — sync en échec depuis 3 j »), une tâche Compliance est créée — jamais de blocage silencieux, jamais de verdict sans provenance.
**Unification (E-XB-3, constat d'audit)** : la démo porte DEUX référentiels parallèles non synchronisés — `CB_RULES` (matrice 6 activités) et `INDIGITA_DB` (statut/sollicitation/licence/produits par pays, paramétrable). R453 les unifie : la version de matrice est UN objet par juridiction portant les verdicts d'activités ET les champs de synthèse ; les deux écrans deviennent des projections de lecture de la même version. Deux vérités parallèles = interdit.
**Pitch produit** : « O-Live ne remplace pas votre Indigita — il le rend exécutable, visé et rejouable. »

### R454 — Tout acte cross-border DISTANT subit le même check que le voyage
**Invariant (mécanisme) — sévérités tenant.**
Un contact report (R188) dont le canal est distant (Visioconférence, Appel, Email) et dont la personne contactée est rattachée à une juridiction étrangère (domicile, ou localisation temporaire R457) déclenche le check juridiction × activité **au même titre qu'un déplacement physique** : le type d'entretien mappe vers les activités (conseil → ADVICE, envoi documentation → MKT, prise d'ordre → ORDER…), le verdict est calculé sur la version de matrice courante et **consigné dans le contact report**.
Verdict `NON` : comportement selon sévérité tenant — `BLOQUANT` (le compte rendu exige une qualification Compliance avant création) ou `AVERTISSEMENT` (défaut : l'acte se crée, `GUARD_WARNING` tracé + tâche de qualification Compliance). Le système mesure et notifie, il ne coerce pas (R39) — mais rien ne passe sans trace.

### R455 — Check pré-acte embarqué : diffusion documentaire et propositions
**Invariant (mécanisme) — sévérités tenant.**
Les actes « sortants » vers un client sont vérifiés **au moment de l'acte**, pas a posteriori :
- envoi de documentation marketing / research (GED) → activité `MKT` de la juridiction du destinataire ;
- proposition d'investissement / conseil formalisé → `ADVICE` ;
- réception d'ordre hors présence → `ORDER`.

Le verdict (avec version de matrice) est attaché à l'objet de l'acte (document GED, proposition, ordre) — trace opposable. Verdict `COND` : la condition est affichée en clair à l'acteur (« reverse solicitation documentée requise ») et le passage exige que la condition soit satisfaite (R456) ou une dérogation visée. C'est l'« embedded compliance » à la Apiax — mais chaque passage est un événement du moteur, pas un simple appel API.

### R456 — Le registre de reverse solicitation : la preuve est un objet, daté, opposable
**Invariant (fixe) — durées tenant.**
La sollicitation inversée n'est jamais une case cochée : c'est un **objet de preuve** par client — nature (email entrant, courrier, compte rendu d'appel initié par le client), document GED lié, date, périmètre (produit/service concerné), enregistré par un rôle habilité et visé. Les verdicts `COND` conditionnés à la reverse solicitation (ex. France ADVICE) ne passent que si une preuve **valide et dans le périmètre** existe ; sinon le check échoue avec le motif explicite. Validité limitée dans le temps (tenant, défaut 12 mois) et par périmètre — une preuve pour un produit ne couvre pas un autre. Le registre est extractible par client et par juridiction (R51) : c'est la réponse directe à un contrôle FINMA ou d'un régulateur étranger.

### R457 — La localisation temporaire du client PRIME le domicile
**Invariant (mécanisme).**
Un client peut être déclaré « en déplacement » (juridiction + période, saisi par le RM ou détecté par un signal — indicatif d'appel, fuseau de visio, mention au contact report proposée par l'IA et confirmée par l'humain, R44). Pendant la période, tous les checks (R454, R455) évaluent la juridiction de **localisation**, pas le domicile — appeler un client suisse en villégiature aux États-Unis est un acte cross-border US. La déclaration est un événement daté ; son expiration restaure le domicile automatiquement.

### R458 — La certification RM est granulaire PAR JURIDICTION
**Invariant (croisement) — exigences tenant.**
Le modèle Indigita fait foi : la certification cross-border s'obtient **par pays** (e-learning + attestation par juridiction). Le guard « certification valide » (R447) vérifie la certification du RM **pour la destination du voyage** ou **pour la juridiction de l'acte distant** — être certifié Allemagne n'autorise pas les États-Unis. **Implémentation (constat d'audit)** : codes `XB-<pays>` AJOUTÉS au catalogue MOD-43 existant (CERT_CATALOG) — la suspension automatique à échéance et les contrôles de cohérence certification × activité sont hérités du module, pas redéveloppés. La liste des juridictions exigeant certification et le comportement en absence (`BLOQUANT` | `AVERTISSEMENT`) sont tenant. Attestations importables depuis le port fournisseur (Indigita e-learning) ou saisies avec pièce GED.

### R459 — Un changement de matrice déclenche une ANALYSE D'IMPACT, jamais une annulation automatique
**Invariant (fixe).**
À chaque nouvelle version de matrice (R453), le moteur calcule l'impact : voyages approuvés à venir dont un verdict se dégrade, clients dont la juridiction devient plus restrictive, preuves de reverse solicitation devenant insuffisantes. Résultat : **tâches nominatives** (revue du voyage par XB, information du RM concerné) et notification Compliance — aucun voyage annulé, aucun visa révoqué par la machine (R39, R44). Les voyages déjà approuvés restent valides sous leur version d'origine (grandfathering R29) ; c'est la revue humaine qui décide de rouvrir.

### R460 — L'exposition cross-border est une projection consolidée, par juridiction
**Invariant (fixe).**
Dashboard CO/DIR calculé en direct depuis les événements (jamais un rapport figé) : par juridiction — nombre de clients et AUM rattachés, voyages sur la période, actes distants et leurs verdicts, dérogations visées, preuves de reverse solicitation actives, certifications RM couvrantes. Alimente le rapport annuel LBA à la Direction (section Cross-border existante) et l'export réglementaire standard (R50).

### R461 — Le régime s'évalue par ENTITÉ DE BOOKING
**Tenant (multi-entité).**
Les exemptions sont attachées à l'établissement, pas au groupe (ex. exemption BaFin §2 Abs. 5 KWG accordée à une entité précise). Chaque entité de booking du tenant porte son propre jeu de régimes/exemptions par juridiction ; le check résout l'entité de rattachement du client (ou du voyage) avant le verdict. Un même acte peut être `COND` via l'entité couverte et `NON` via une autre — le verdict nomme l'entité et l'exemption invoquée.

### R462 — Paramétrage §CrossBorder = registre tenant, pop-up d'engagement (R445 généralisé)
**Tenant + invariant.**
Toutes les clés `settings.crossBorder.*` versionnées par date de mise en vigueur ; toute modification via le pop-up d'engagement (ancien/nouveau, portée, rappel réglementaire pour les sévérités et exemptions) → `PARAM_CHANGED` complet. Grandfathering R29 sur les checks déjà consignés.

### R463 — [OLIVIA — SPÉCIFIÉE, GELÉE] Briefing pack pré-voyage
À l'approbation d'un voyage, Olivia génère le brief du RM : do's & don'ts de la juridiction limités à **ses** activités autorisées (version de matrice du check), fiches des clients visités (statut KYC, alertes ouvertes, sujets sensibles, restrictions individuelles), documents autorisés à emporter (verdict MKT/SIGN). Proposition marquée origine IA, consultative, jamais décisionnelle (R44). *Implémentation gelée avec Olivia v2 (SW-01..SW-18) — la spécification réserve la règle et son contrat.*

### R464 — [OLIVIA — SPÉCIFIÉE, GELÉE] Rapprochement automatique du certificat de trip
Au retour, Olivia pré-remplit le certificat (R450) depuis les faits tracés : contact reports datés pendant le voyage, clients rencontrés vs déclarés, écarts détectés (acte tracé hors juridiction autorisée = signal nommé). L'IA propose le rapprochement, le RM certifie, le validateur vise — le delta autorisation/réalité est exactement ce que l'auditeur cherche. *Gelée avec Olivia v2.*

---

## 2. Paramètres tenant — R-Q §CrossBorder

| Clé | Type | Défaut | Règle |
|---|---|---|---|
| `settings.crossBorder.fournisseur` | enum INDIGITA_API \| APIAX_API \| IMPORT_BRP \| INTERNE | `INTERNE` | R453 |
| `settings.crossBorder.syncFrequenceHeures` | int | `24` | R453 |
| `settings.crossBorder.syncAlerteEchecJours` | int | `2` | R453 — tâche Compliance au-delà |
| `settings.crossBorder.acteDistant.severiteNON` | enum BLOQUANT \| AVERTISSEMENT | `AVERTISSEMENT` | R454 |
| `settings.crossBorder.acteDistant.mappingEntretienActivites` | map type entretien→activités | conseil→ADVICE · doc→MKT · ordre→ORDER · courtoisie→MEET | R454 |
| `settings.crossBorder.preActe.severites` | map MKT/ADVICE/ORDER→sévérité | tous BLOQUANT | R455 |
| `settings.crossBorder.reverseSolicitation.validiteMois` | int | `12` | R456 |
| `settings.crossBorder.reverseSolicitation.rolesEnregistrement` | rôle[] | `["RM","CO","CO_SR"]` | R456 |
| `settings.crossBorder.localisationTemporaire.dureeMaxJours` | int | `90` | R457 — au-delà, revue de résidence |
| `settings.crossBorder.certifications.juridictionsExigees` | pays[] | juridictions HIGH du registre | R458 |
| `settings.crossBorder.certifications.severiteAbsence` | enum | `BLOQUANT` | R458 |
| `settings.crossBorder.entites` | map entité→{régimes, exemptions par pays} | entité unique = tenant | R461 |

Écran : **Paramétrage → Cross-Border**. Chaque changement : pop-up d'engagement R462/R445 → `PARAM_CHANGED` + PARAM_AUDIT versionné.

---

## 3. Scénarios Gherkin — XB-01…XB-14
*Rouges avant tout code. Bloc terminé à 14/14 verts (hors R463/R464, gelées).*

### XB-01 — Synchronisation du port : version datée, diff, événement (R453)
```gherkin
Étant donné le fournisseur INDIGITA_API configuré
Quand la synchronisation s'exécute et que 2 juridictions ont changé
Alors une version de matrice datée et immuable est créée
Et MATRIX_SYNCED est émis avec le diff lisible (juridictions, activités, ancien→nouveau verdict)
Et la version précédente reste consultable et rejouable
```

### XB-02 — Fournisseur indisponible : dernière version servie, âge affiché, jamais silencieux (R453)
```gherkin
Étant donné une synchronisation en échec depuis 3 jours (seuil alerte : 2)
Quand un RM exécute un check pré-voyage
Alors le verdict est rendu sur la dernière version connue
Et le verdict affiche "matrice du <date> — synchronisation en échec depuis 3 jours"
Et une tâche Compliance "vérifier la source cross-border" existe
Et aucun check n'est bloqué du seul fait de l'échec de sync
```

### XB-03 — Visio avec une personne en France, sujet conseil → check distant (R454, R456)
```gherkin
Étant donné une personne P1 domiciliée en France et la matrice FR : ADVICE=COND "reverse solicitation documentée"
Quand le RM crée un contact report canal Visioconférence, type "Conseil en placement" avec P1
Alors le check ADVICE×FR est exécuté et consigné dans le contact report avec sa version de matrice
Et sans preuve de reverse solicitation valide pour P1, le verdict échoue avec le motif explicite
```

### XB-04 — Acte distant en verdict NON : l'acte se trace, l'humain qualifie (R454, R39)
```gherkin
Étant donné la matrice IT : ADVICE=NON et la sévérité acteDistant.severiteNON=AVERTISSEMENT (défaut)
Quand le RM crée un contact report Appel type "Conseil" avec une personne domiciliée en Italie
Alors le contact report est créé avec GUARD_WARNING consigné (verdict NON nommé)
Et une tâche de qualification Compliance liée au contact report est créée
Et si la sévérité tenant est BLOQUANT, la création exige la qualification Compliance préalable
```

### XB-05 — Envoi de documentation : verdict attaché au document (R455)
```gherkin
Étant donné un client rattaché à l'Italie (MKT=NON) et preActe.severites.MKT=BLOQUANT
Quand le RM tente l'envoi d'une documentation marketing depuis la GED
Alors l'envoi est refusé avec le verdict et sa source ("MKT interdit — IT, matrice v8 du 01.07")
Et le refus est tracé sur le document GED
Quand le même envoi vise un client allemand (MKT=OK)
Alors l'envoi passe et le verdict OK avec version de matrice est attaché au document
```

### XB-06 — Preuve de reverse solicitation : objet daté, périmètre, visa (R456)
```gherkin
Étant donné un email entrant du client C1 (FR) demandant une proposition sur le produit X, classé en GED
Quand le CO enregistre la preuve de reverse solicitation {client C1, périmètre "produit X", document GED, date}
Et qu'un validateur la vise (R15)
Alors le check ADVICE×FR pour C1 sur le produit X passe, en référençant l'ID de la preuve
Et le même check pour le produit Y échoue — la preuve ne couvre pas ce périmètre
```

### XB-07 — Preuve expirée → redemande (R456)
```gherkin
Étant donné une preuve de reverse solicitation de C1 datée d'il y a 13 mois (validité tenant : 12)
Quand un check ADVICE×FR est exécuté pour C1
Alors le check échoue avec "preuve de reverse solicitation expirée (13 mois > 12)"
Et une tâche "renouveler la documentation de sollicitation" est proposée au RM
```

### XB-08 — La localisation temporaire prime le domicile (R457)
```gherkin
Étant donné le client C2 domicilié en Suisse, déclaré "en déplacement" aux États-Unis du 01.08 au 20.08
Quand le RM crée un contact report Appel type "Conseil" avec C2 le 10.08
Alors le check est évalué sur la juridiction US, pas CH
Et le 25.08 (période expirée), le même acte est évalué sur CH — restauration automatique
```

### XB-09 — Certification par juridiction (R458)
```gherkin
Étant donné le RM U1 certifié Allemagne (valide) et non certifié États-Unis
Et les deux juridictions dans certifications.juridictionsExigees, sévérité BLOQUANT
Quand U1 soumet un voyage vers l'Allemagne
Alors le guard certification passe
Quand U1 soumet un voyage vers les États-Unis
Alors GUARD_BLOCKED est émis : "certification cross-border États-Unis absente"
```

### XB-10 — Changement de matrice : analyse d'impact, zéro annulation automatique (R459, R29)
```gherkin
Étant donné la matrice v8 dégradant FR ADVICE de COND à NON
Et 2 voyages approuvés à venir incluant ADVICE en France, et 14 clients rattachés FR
Quand la version v8 entre en vigueur
Alors des tâches nominatives de revue sont créées (XB pour chaque voyage, information des RM)
Et une notification Compliance liste les 14 clients affectés et les preuves de reverse solicitation devenues insuffisantes
Et aucun voyage n'est annulé ni aucun visa révoqué — les voyages restent sous leur version d'origine
```

### XB-11 — Exposition consolidée = projection live (R460)
```gherkin
Étant donné des clients, voyages, actes distants et dérogations rattachés à 6 juridictions
Quand le CO ouvre le dashboard d'exposition cross-border
Alors chaque ligne juridiction (clients, AUM, voyages, actes distants, dérogations, preuves actives, certifications) est recalculée depuis les événements
Et la clôture d'une tâche ou un nouvel acte modifie la projection au rafraîchissement — rien n'est figé
```

### XB-12 — Multi-entité : le verdict nomme l'entité et l'exemption (R461)
```gherkin
Étant donné l'entité E1 couverte par l'exemption BaFin et l'entité E2 non couverte
Quand un check PROSP×Allemagne est exécuté pour un client booké chez E1
Alors le verdict est COND avec la mention "via exemption BaFin — entité E1"
Quand le même check vise un client booké chez E2
Alors le verdict est NON — l'exemption de E1 ne bénéficie jamais à E2
```

### XB-13 — Modification de sévérité : pop-up d'engagement (R462, R445)
```gherkin
Étant donné preActe.severites.MKT=BLOQUANT
Quand l'admin le passe en AVERTISSEMENT
Alors le pop-up affiche ancien/nouveau, la portée et le rappel réglementaire (diffusion transfrontière)
Et sans confirmation, aucune écriture ; avec : PARAM_CHANGED complet (auteur, ancien, nouveau, engagement)
```

### XB-14 — Rejeu à date d'un acte distant (R453, R455, R48)
```gherkin
Étant donné un envoi documentaire du 10.06 vérifié sous la matrice v7 (MKT=COND)
Et la matrice passée en v8 le 01.07 (MKT=NON)
Quand un auditeur rejoue l'acte à la date du 10.06
Alors le verdict restitué est COND, avec la matrice v7 et la condition telle qu'affichée à l'acteur
Et jamais recalculé avec v8
```

---

## 4. Ordre d'implémentation proposé
1. Tests XB-01…XB-14 rouges (`cross-border.spec.ts`).
2. Port matrice R453 (adaptateur INTERNE d'abord ; contrats INDIGITA_API/APIAX_API en interface versionnée, mock en tests — l'intégration réelle est un lot commercial séparé).
3. Versionnement matrice + rejeu à date (XB-01, XB-02, XB-14).
4. Checks distants et pré-acte branchés sur contact reports (R188) et GED (XB-03→XB-05).
5. Registre reverse solicitation + objets de preuve (XB-06, XB-07).
6. Localisation temporaire, certifications par juridiction, multi-entité (XB-08, XB-09, XB-12).
7. Analyse d'impact + dashboard exposition (XB-10, XB-11).
8. Registre R-Q §CrossBorder + pop-up (XB-13).
9. 14/14 verts → ratification → CANON-MASTER.md (registrar R331). R463/R464 restent au canon en statut GELÉ.

**Écart consigné : E-XB-1** → `docs/ECARTS-FRONT.md` — résolu par ce bloc à ratification.
