<!-- ÉDITION AU VERSEMENT (A1, 2026-08-08 — session Blocs 63/64) :
  1. NUMÉROTATION : corps renuméroté session→repo (R439–R445+R458 → R446–R452+R465 ;
     R446–R457 → R453–R464 ; « R438 » (pop-up Bloc 62) → R445 repo). Mécanisme
     mapping-session-repo.md §3 : l'implémenté prend le créneau contigu, PK glisse à R466+.
  2. DOCTRINE DELTA (arbitrage PO 2026-08-08, E-6364-0) : implémentation en EXTENSION des
     modules existants — MOD-75 Business Trip (R222–R230), Cross-Border R293–R295 (jamais un
     second référentiel), MOD-43 Formations (R231–R238). Aucun nouveau moteur, aucune règle
     dupliquée : quand l'existant couvre, la règle repo le référence.
  Le document original du drop fait foi pour l'intention ; cette copie fait foi pour les numéros. -->

# Bloc 63 · Business Trip (Déplacements RM & certificat de voyage)
**Règles R446–R452 + R465 · Scénarios BT-01…BT-16 · v2 post-audit · Statut : RATIFIÉ 08.08.2026 (visa PO) — implémentation autorisée, tests rouges d'abord**
**Écart source : E-BT-1** — le module Business Trip démo porte une chaîne d'approbation en constante (`approvals[].state` muté à la main, `ROLE_GATE`, `DEST_QUOTAS_SEED` non tenant) et **aucun certificat de retour** : le voyage approuvé n'est jamais clôturé ni rapproché des activités réellement exercées. Ce bloc câble la demande ET le retour au moteur certifié.

---

## 1. Les deux workflows

**Workflow 1 — Demande d'approbation (aller)** : le RM soumet destination, dates, motif, activités prévues, clients visés, budget → le moteur résout la chaîne de visas depuis le paramétrage tenant (risque cross-border + budget) → guards pré-départ recalculés à chaque transition → APPROVED ou REJECTED.

**Workflow 2 — Certificat de trip (retour)** : au retour, le RM certifie ce qui a réellement eu lieu (activités par juridiction, personnes rencontrées, écarts vs autorisation, contact reports liés) → visa de validation → le voyage est CLÔTURÉ. Sans certificat, le voyage reste ouvert et le RM porte un signal sur sa prochaine demande. C'est la boucle de preuve complète : *autorisé avant, certifié après, rapproché toujours*.

---

## 2. Règles

### R446 — La demande de business trip est un workflow du moteur
**Invariant (fixe).**
Toute demande s'exécute comme instance `WF_DEF BUSINESS_TRIP` : la soumission RM émet `WORKFLOW_STARTED` ; la chaîne d'approbation est **résolue à la soumission** depuis les paramètres tenant (niveau de risque cross-border de la destination × motif × budget) et figée pour l'instance (grandfathering R29). Chaque approbation est un visa R15 (validateur nommé, horodaté) ; le RM demandeur est exclu de tout visa de sa propre demande (R13). Aucun champ `state` muté à la main — l'état est la projection des événements.

### R447 — Guards pré-départ, recalculés à chaque transition — sévérités tenant
**Mécanisme invariant — sévérités 100 % tenant.**
Guards évalués à chaque tentative de transition (jamais figés) :
- **Certification cross-border du RM valide à la date du voyage** — pas seulement à la date de demande (une certification qui expire entre les deux échoue).
- **Quota de jours bancables destination** non dépassé (cumul RM, année glissante).
- **Verdict cross-border** : aucune activité prévue en verdict `NON` pour la juridiction.
- **Politique sanctions** : destination hors liste, sinon clearance Compliance requise.
- **Certificat de trip précédent manquant** (R450) : le RM a un voyage antérieur non certifié au-delà du SLA.

Chaque guard porte une sévérité tenant (`BLOQUANT` | `AVERTISSEMENT` | `DÉSACTIVÉ`). `BLOQUANT` échoué → `GUARD_BLOCKED` nommé ; `AVERTISSEMENT` → `GUARD_WARNING`, la transition passe, la trace reste. Un guard en avertissement franchi par un validateur constitue une **dérogation visée** — motivation obligatoire, tracée. Toute modification de sévérité passe par le pop-up d'engagement (mécanisme R445, généralisé par R452).

### R448 — Le check pré-voyage est une preuve, figée avec sa version de matrice
**Invariant (fixe).**
Le check cross-border (juridiction × activités prévues) est exécuté et consigné **avant le premier visa Compliance** : l'événement porte le verdict ligne par ligne ET la version de la matrice pays en vigueur (rejeu à date R48 — l'auditeur revoit le verdict tel qu'il était, pas tel qu'il serait). Tout changement de destination, de dates ou d'activités **invalide le check** : il doit être refait, les visas Compliance déjà apposés tombent (retour à l'étape XB). C'est la preuve que le RM a vérifié AVANT de partir — et qu'on sait sur quelle base.

### R449 — Quotas de jours bancables = registre tenant par destination, avec overrides par RM
**Tenant.**
`bankDays` par destination (plafond banque) **et overrides individuels par RM × destination** (constatés à l'audit : `RM_OVERRIDES_SEED`) — le plafond effectif d'un RM est son override s'il existe, sinon le plafond banque. Cumul par RM sur année glissante calculé depuis les voyages approuvés et effectués (projection, jamais un compteur stocké). Le dépassement est le guard R447 correspondant — défaut `AVERTISSEMENT` + dérogation Compliance visée : le système mesure et notifie, il ne coerce pas (R39). Toute pose/modification d'override passe par le pop-up d'engagement (R452). Destination hors registre → analyse Legal requise (guard dédié, défaut BLOQUANT).

### R450 — Le certificat de trip clôt le voyage — déclaré par le RM, visé, rapproché
**Invariant (fixe) — délais et validateurs tenant.**
Au retour (SLA tenant, défaut 5 jours ouvrés après la date de fin), le RM soumet le **certificat de trip** :
- activités réellement exercées, par juridiction ;
- clients/prospects rencontrés — chaque rencontre liée à un contact report (R188 : le contact client est un acte tracé) ;
- écarts déclarés vs autorisation (activité non prévue, client non listé, dates modifiées) ;
- confirmation qu'aucun document n'a été signé / ordre reçu hors verdict autorisé.

Cycle : `Brouillon → Soumis → Visé → Voyage clôturé` — chaque étape un événement, la validation un visa R15. Le validateur est tenant : défaut **MGR** (responsable d'équipe) sans écart, **routage automatique vers XB (Compliance Cross-Border)** si au moins un écart est déclaré ou si le risque du voyage était HIGH. Un écart déclaré ouvre une **tâche de qualification Compliance** — analyse humaine, jamais de sanction automatique (R39, R44). Le RM qui certifie ne vise jamais son propre certificat (R13).
Certificat manquant à l'échéance : relance RM + notification MGR (tâches tracées) — et le guard « certificat précédent manquant » (R447) s'active sur toute nouvelle demande du même RM.
**Reprise de l'existant (E-BT-2)** : le compte-rendu de voyage en texte libre existe déjà en démo (`report`/`reportDate`) — R450 ne le remplace pas, il le **formalise** : le texte libre devient le corps narratif du certificat, augmenté des champs structurés (activités, rencontres liées, écarts). Migration : comptes rendus existants → certificats en statut Brouillon.

### R451 — Habilitation suspendue = signal croisé formation × activité
**Invariant du croisement — traitement tenant.**
Le module Formations & habilitations fait foi : certification cross-border échue → habilitation suspendue. Le guard R447 « certification valide » lit cet état en direct. Le croisement certification × activité réellement tracée (checks de cohérence existants) répond à la question de l'auditeur : « cette personne avait-elle le droit de faire cet acte ce jour-là ? » — le business trip y injecte ses propres actes (check pré-voyage, visas, certificat).

### R452 — Paramétrage Business Trip = registre tenant, pop-up d'engagement généralisé
**Tenant + invariant R445 étendu.**
Toutes les clés `settings.businessTrip.*` sont versionnées par date de mise en vigueur. Le mécanisme du pop-up d'engagement R445 est **généralisé** à ce registre : toute modification (chaînes, quotas, sévérités de guards, matrice pays, SLA certificat, rôles par étape) affiche ancien/nouveau, portée (voyages futurs — grandfathering R29 sur les demandes en cours), rappel réglementaire si le paramètre touche sanctions ou verdicts cross-border, engagement explicite. Sans confirmation, aucune écriture ; avec : `PARAM_CHANGED` complet, append-only, rejouable à date.

### R465 — Le voyage fait naître le prospect à sa source (ajout d'audit 08.08.2026)
**Invariant (fixe).**
La démo le permet déjà (E-BT-3) : la déclaration d'un nouveau contact rencontré en voyage crée un **prospect tracé** `source=BUSINESS_TRIP`, lié à l'ID du voyage ET au contact report de la rencontre. Le certificat de trip (R450) liste les prospects nés du voyage. Le prospect suit ensuite le circuit d'onboarding standard (aiguillage par score, WR0/R59) — **le voyage n'accorde aucun raccourci de diligence** : la rencontre sur place est une origine tracée, jamais une pré-qualification. Si le verdict PROSP de la juridiction était `NON` ou `COND`, la naissance du prospect porte ce contexte — matière première de la qualification Compliance du certificat (R450, R44).

---

## 3. Paramètres tenant — R-Q §BusinessTrip

| Clé | Type | Défaut | Règle |
|---|---|---|---|
| `settings.businessTrip.chains.LOW` | rôle[] | `["RM","MGR"]` | R446 |
| `settings.businessTrip.chains.MEDIUM` | rôle[] | `["RM","MGR","XB"]` | R446 |
| `settings.businessTrip.chains.HIGH` | rôle[] | `["RM","MGR","XB","HPB"]` | R446 |
| `settings.businessTrip.seuilBudgetHPB` | CHF | `5000` | R446 — au-delà, HPB ajouté quel que soit le risque |
| `settings.businessTrip.quotas` | map destination→bankDays | registre démo (DEST_QUOTAS_SEED) | R449 |
| `settings.businessTrip.quotasOverridesRM` | map RM×destination→jours | registre démo (RM_OVERRIDES_SEED) | R449 — l'override prime le plafond banque, pose via pop-up R452 |
| `settings.businessTrip.guards` | map guard→sévérité | certifValide BLOQUANT · quotaDépassé AVERTISSEMENT · verdictNON BLOQUANT · paysSanctions BLOQUANT · certificatPrécédentManquant BLOQUANT · destinationHorsRegistre BLOQUANT | R447 — 100 % tenant, pop-up R452 |
| `settings.businessTrip.matricePays` | versionnée | CB_RULES (positions FINMA / moteur Indigita) | R448 — chaque version datée, rejeu à date |
| `settings.businessTrip.certificat.slaJoursOuvres` | int | `5` | R450 |
| `settings.businessTrip.certificat.validateurDefaut` | rôle | `MGR` | R450 |
| `settings.businessTrip.certificat.validateurSiEcart` | rôle | `XB` | R450 |
| `settings.businessTrip.rolesParEtape` | map étape→rôle[] | ROLE_GATE démo | R446/R452 |

Écran : **Paramétrage → Business Trip**. Chaque changement : pop-up d'engagement R452/R445 → `PARAM_CHANGED` + PARAM_AUDIT versionné.

---

## 4. Scénarios Gherkin — BT-01…BT-16
*Rouges avant tout code. Bloc terminé à 16/16 verts.*

### BT-01 — Soumission RM : chaîne résolue et figée (R446)
```gherkin
Étant donné une destination de risque cross-border MEDIUM et un budget de CHF 3 000
Quand le RM U1 soumet une demande de business trip
Alors WORKFLOW_STARTED est émis avec actor=U1
Et la chaîne résolue est [RM, MGR, XB] (chains.MEDIUM)
Et la chaîne et son origine (risque MEDIUM, budget < seuil HPB) figurent dans l'événement de création
```

### BT-02 — Budget au-dessus du seuil → HPB ajouté (R446)
```gherkin
Étant donné une destination MEDIUM et un budget de CHF 6 800
Quand le RM soumet la demande
Alors la chaîne résolue est [RM, MGR, XB, HPB]
Et l'origine "budget CHF 6 800 > seuilBudgetHPB CHF 5 000" est tracée
```

### BT-03 — Le RM demandeur ne vise jamais sa demande (R13, R446)
```gherkin
Étant donné une demande soumise par U1 (rôle RM, également habilité MGR par intérim)
Quand U1 tente d'apposer le visa MGR
Alors le visa est refusé avec le motif "Exclusion 4-yeux — demandeur (R13)"
```

### BT-04 — Certification échue à la date du voyage (R447, R451)
```gherkin
Étant donné U1 dont la certification cross-border expire le 10.09
Et une demande de voyage du 15.09 au 18.09
Quand le validateur XB tente d'approuver
Alors GUARD_BLOCKED est émis avec reason="Certification cross-border échue à la date du voyage (expire 10.09)"
Et la demande valide à la date de soumission ne suffit pas
```

### BT-05 — Quota dépassé : avertissement + dérogation visée (R447, R449)
```gherkin
Étant donné U1 ayant cumulé 14 jours bancables sur Singapour (quota 15) sur l'année glissante
Et une demande de 4 jours supplémentaires
Et le guard quotaDépassé paramétré AVERTISSEMENT (défaut)
Quand le validateur XB approuve avec la motivation "Client stratégique — revue annuelle sur place"
Alors GUARD_WARNING est émis avec le dépassement chiffré (18/15)
Et la transition passe avec un visa portant la motivation de dérogation
Et le cumul est une projection des voyages approuvés — aucun compteur stocké
```

### BT-06 — Activité interdite dans la juridiction (R447, R448)
```gherkin
Étant donné une demande "Prospection" vers la France (PROSP=NON au country manual)
Quand la transition vers le visa XB est tentée
Alors GUARD_BLOCKED est émis avec reason="Activité interdite : Prospection active (FR — démarchage réservé aux agréés CMF)"
Quand le RM change le motif en "Visite clientèle" (MEET=OK, ADVICE=COND)
Alors le check pré-voyage est refait et la transition passe
```

### BT-07 — Le check est figé avec sa version de matrice ; modification = invalidation (R448)
```gherkin
Étant donné un check pré-voyage consigné sous la matrice pays v7
Et le visa XB apposé
Quand le RM modifie la destination de Dubaï vers New York
Alors le check est invalidé et le visa XB tombe (retour à l'étape XB)
Et un événement trace l'invalidation avec sa cause
Et le nouveau check est consigné sous la version de matrice en vigueur à sa date
```

### BT-08 — Pays sous sanctions : clearance = dérogation visée (R447)
```gherkin
Étant donné une demande vers la Russie (politique sanctions — guard paysSanctions BLOQUANT par défaut)
Quand le validateur XB tente d'approuver
Alors GUARD_BLOCKED est émis avec reason="Destination sous politique sanctions — clearance Compliance requise"
Et seule une modification tenant du guard (pop-up d'engagement R452, tracée) ou l'abandon de la demande fait évoluer le dossier
```

### BT-09 — Approbation complète (R446)
```gherkin
Étant donné une demande dont tous les guards passent
Quand les visas MGR, XB puis HPB sont apposés dans l'ordre de la chaîne
Alors chaque visa émet TRANSITION_FIRED
Et l'état final de la demande est APPROVED — projection des événements
Et le voyage reste OUVERT jusqu'au certificat de trip (R450)
```

### BT-10 — Certificat sans écart : visa MGR, voyage clôturé (R450)
```gherkin
Étant donné un voyage APPROVED terminé le 11.07
Quand le RM soumet le certificat le 14.07 : activités conformes, 2 rencontres liées à des contact reports, aucun écart
Alors le certificat passe de Brouillon à Soumis (événement)
Et le validateur résolu est MGR (validateurDefaut, aucun écart)
Quand le MGR appose son visa
Alors WORKFLOW_COMPLETED est émis et le voyage est CLÔTURÉ
Et le certificat, ses liens contact reports et le visa sont extractibles par l'ID du voyage (R51)
```

### BT-11 — Certificat avec écart : routage XB + qualification humaine (R450, R44)
```gherkin
Étant donné un certificat déclarant un écart : "Signature d'un mandat sur place" (SIGN=COND pour la juridiction)
Quand le certificat est soumis
Alors le validateur résolu est XB (validateurSiEcart)
Et une tâche de qualification Compliance est créée, liée au certificat
Et aucune sanction ni blocage automatique n'est appliqué au RM — l'analyse est humaine (R39, R44)
Et le RM certifiant ne peut pas viser son propre certificat (R13)
```

### BT-12 — Certificat manquant : relances + guard sur la prochaine demande (R450, R447)
```gherkin
Étant donné un voyage terminé le 11.07 sans certificat au 21.07 (SLA 5 jours ouvrés dépassé)
Alors une tâche de relance RM et une notification MGR sont créées (tracées)
Quand le même RM soumet une nouvelle demande de voyage
Alors le guard certificatPrécédentManquant (BLOQUANT par défaut) émet GUARD_BLOCKED avec l'ID du voyage non certifié
Quand le certificat du voyage précédent est soumis et visé
Alors le guard réévalué passe — sans intervention manuelle sur la nouvelle demande
```

### BT-13 — Modification de paramètre : pop-up d'engagement + grandfathering (R452, R29)
```gherkin
Étant donné une demande D1 soumise le 01.08 sous chains.HIGH = [RM, MGR, XB, HPB]
Quand l'admin change chains.HIGH en [RM, XB, HPB] avec mise en vigueur au 05.08
Alors le pop-up affiche ancien/nouveau, la portée (demandes futures) et exige l'engagement
Et sans confirmation, aucune écriture
Quand l'admin confirme
Alors PARAM_CHANGED versionné est émis (auteur, ancien, nouveau, engagement)
Et D1 conserve [RM, MGR, XB, HPB] ; une demande D2 du 06.08 applique [RM, XB, HPB]
```

### BT-14 — Rejeu à date : le verdict d'époque, pas le verdict d'aujourd'hui (R448, R48)
```gherkin
Étant donné un voyage approuvé le 10.06 sous la matrice pays v7 (ADVICE=COND pour la juridiction)
Et la matrice passée en v8 le 01.07 (ADVICE=NON)
Quand un auditeur rejoue la demande à la date du 10.06
Alors le système restitue le check, le verdict et la matrice v7 tels qu'au 10.06
Et le verdict affiché est COND — jamais recalculé avec v8
```

### BT-15 — L'override RM prime le plafond banque (R449)
```gherkin
Étant donné le plafond banque EAU = 15 jours et un override "Sophie Marchand × AE = 20 jours"
Et Sophie ayant cumulé 17 jours sur les EAU en année glissante
Quand elle soumet une demande de 2 jours (cumul 19 ≤ 20)
Alors le guard quota passe — le plafond effectif est l'override, tracé dans l'évaluation
Et pour un RM sans override, le même cumul déclencherait le guard (plafond banque 15)
Et la pose de l'override est passée par le pop-up d'engagement (PARAM_CHANGED avec auteur et motif)
```

### BT-16 — Prospect né en voyage : origine tracée, zéro raccourci (R465)
```gherkin
Étant donné un voyage approuvé de U1 vers les EAU incluant l'activité PROSP en verdict COND
Quand U1 déclare un nouveau contact "Al-Fayed Family Office" rencontré sur place
Alors un prospect est créé avec source=BUSINESS_TRIP, lié à l'ID du voyage et au contact report de la rencontre
Et le prospect entre dans le circuit d'onboarding standard (aiguillage par score) — aucune étape de diligence sautée
Et le certificat de trip du voyage liste ce prospect avec le verdict PROSP d'origine (COND et sa condition)
```

---

## 5. Ordre d'implémentation proposé
1. Tests BT-01…BT-16 rouges (`business-trip.spec.ts`).
2. `WF_DEF BUSINESS_TRIP` (demande) + objet certificat de trip au moteur existant — aucun fork.
3. Guards R447 branchés : module Formations (certifications), projection quotas, matrice pays versionnée, registre sanctions.
4. Registre R-Q §BusinessTrip + généralisation du mécanisme pop-up R445 → R452.
5. Migration écran démo : `approvals[].state` → projection d'instance ; `DEST_QUOTAS_SEED`, `ROLE_GATE`, `INDIGITA_DB` → registre tenant ; ajout de l'onglet Certificat de trip.
6. 16/16 verts → ratification → CANON-MASTER.md (registrar R331). Migration E-BT-2 : comptes rendus libres existants → certificats Brouillon.

**Écart consigné : E-BT-1** → `docs/ECARTS-FRONT.md` — résolu par ce bloc à ratification.
