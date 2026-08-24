<!-- VERSÉ AU REPO le 2026-08-08 depuis le drop PO (session « Bloc 62 · Offboarding »),
     RATIFIÉ 08.08.2026 (visa PO). NOTE D'ÉDITION (ne modifie pas le fond) :

     1. NUMÉROTATION session→repo : le document de session numérote R432–R438, créneau DÉJÀ
        ATTRIBUÉ au repo (bloc WD Workflow Designer, registre C5 — un numéro ne se réattribue
        jamais). Conformément au mécanisme ratifié de `spec/mapping-session-repo.md` (« l'implé-
        menté/ratifié prend le créneau contigu, la réservation glisse »), le Bloc 62 prend
        **R439–R445** au repo ; la réservation PK glisse à R446+. Table : mapping-session-repo.md
        §1. Le corps ci-dessous est RENUMÉROTÉ en numéros REPO (session R432→R439, R433→R440,
        R434→R441, R435→R442, R436→R443, R437→R444, R438→R445) ; le nom de fichier conserve la
        numérotation session pour la traçabilité du drop.

     2. IDs DE SCÉNARIOS : le corpus OF-01..12 existe DÉJÀ au repo (bloc offboarding R267–R271,
        `fat-offboarding.e2e-spec.ts`, contenu DIFFÉRENT). Les scénarios de CE bloc gardent leurs
        IDs OF-01..OF-14 (le document fait foi) mais vivent dans une suite distincte
        (`offboarding-moteur.spec.ts`) avec les références repo [R439–R445]. Collision consignée :
        docs/ECARTS-FRONT.md E-OFF-3.

     3. COHABITATION R267–R271 : la machine à états existante (CLOTURE_DEMANDEE → EN_CLOTURE →
        CLOTUREE, OffboardingService) reste RATIFIÉE et INCHANGÉE pendant la construction ; le
        présent bloc ajoute l'exécution par le MOTEUR (WF_DEF OFFBOARDING, états fins). La
        réconciliation des deux machines est consignée (E-OFF-3), jamais absorbée en silence. -->

# Bloc 62 · Sortie de relation (Offboarding)
**Règles R439–R445 (repo) · session : R432–R438 · Scénarios OF-01…OF-14 · Statut : RATIFIÉ 08.08.2026 (visa PO) — implémentation autorisée, tests rouges d'abord**
**Écart source : E-OFF-1** — l'offboarding existe en démo (écran, checklists, chaînes d'approbation) mais hors moteur certifié : progression par `approvalIdx++`, sans instance WF, sans visa R15, sans exclusion R13, sans événements. Ce bloc réintègre l'offboarding dans le contrat d'implémentation.
---
## 1. Règles
### R439 — L'offboarding est un workflow du moteur, jamais un compteur
**Invariant (fixe).**
Toute sortie de relation s'exécute comme une instance de workflow du moteur certifié : définition versionnée (`WF_DEF OFFBOARDING`), états et transitions explicites, visas conformes R15, exclusion 4-yeux R13, événements append-only (`WORKFLOW_STARTED`, `TRANSITION_FIRED`, `GUARD_BLOCKED`, `WORKFLOW_COMPLETED`). Aucune progression par index, flag ou effet de bord. L'initiation émet un événement ; l'état est une projection.
Hérite intégralement de R1–R15 (visas), R16 (états — la clôture aboutit à l'état `Clôturé`), R29/R48 (versioning + grandfathering), R49 (immutabilité).
### R440 — Le Compliance Health Check est une garde de transition, recalculée — sévérité entièrement tenant
**Mécanisme invariant — sévérités 100 % tenant.**
Les bloqueurs de sortie sont des **guards** évalués à chaque tentative de transition, jamais un statut figé :
- Account Review(s) non clôturée(s)
- Alerte(s) AML en investigation
- Hit(s) screening non levé(s)
- Déclaration MROS en attente de transmission
- Soldes non nuls / engagements ouverts (prêts, mandats, litiges) — via port core banking (R167+)
Un guard `BLOQUANT` qui échoue émet `GUARD_BLOCKED` avec la raison nommée ; un guard `AVERTISSEMENT` émet l'événement et laisse passer ; un guard `DÉSACTIVÉ` n'est pas évalué. Bloqueur levé → la même transition passe au prochain essai, sans intervention manuelle sur l'état.
**Aucun guard n'est figé** : chaque guard porte une sévérité tenant (`BLOQUANT` | `AVERTISSEMENT` | `DÉSACTIVÉ`, défaut BLOQUANT partout). La main est au client — le système mesure et notifie, il ne coerce pas (R39). Toute modification de sévérité passe par le **pop-up d'engagement de responsabilité** (R445) et est tracée.
**Clause tipping-off (art. 10a LBA)** : lorsque le bloqueur est une déclaration MROS, le motif affiché aux rôles non habilités (RM, ARM) est neutre (« vérifications compliance en cours ») — le détail n'est visible que par CO_SR / MLRO / DIR. Aucune notification client générée par le système.
### R441 — La chaîne d'approbation dérive du niveau de risque — paramètre tenant
**Tenant.**
La chaîne de visas (ex. LOW : RM → CO ; HIGH : RM → CO_SR → MLRO → DIR) est un paramètre tenant par niveau de risque (`LOW`/`MEDIUM`/`HIGH`/`PEP`). Chaque maillon est un visa R15 complet : validateur nommé, exclusion R13 (l'initiateur ne vise jamais), traçé. Un **forçage de niveau minimum par motif** est paramétrable (ex. motif « Sanctions » → chaîne HIGH quel que soit le score client) ; le forçage l'emporte sur le niveau calculé, jamais l'inverse.
Toute modification de chaîne est versionnée par date de mise en vigueur ; les dossiers en cours conservent la chaîne en vigueur à leur date d'initiation (grandfathering R29).
### R442 — Motifs et initiateurs sont des paramètres tenant
**Tenant.**
Le référentiel des motifs de sortie (Demande du client, Décision de la banque, Risque AML élevé, Sanctions, Inactivité prolongée, Fusion/acquisition…) et les rôles habilités à initier **par motif** sont des paramètres tenant. Un rôle non habilité pour un motif ne peut pas le sélectionner — refus explicite, pas de motif masqué silencieusement. ADMIN peut toujours initier (invariant, tracé). Ajout/retrait de motif = événement `PARAM_CHANGED` versionné.
### R443 — Les checklists de sortie sont des paramètres tenant, versionnées
**Tenant.**
Checklists distinctes PP / PM (clôture des comptes, désactivation des accès, archivage documentaire, obligations fiscales…), items ajoutables/retirables/renommables par tenant, chaque item portant un flag `obligatoire`. Un item obligatoire non coché bloque la transition de clôture (guard, R440). Toute modification est versionnée ; les dossiers en cours conservent la checklist de leur date d'initiation (R29).
### R444 — Le dossier clôturé reste rejouable — rétention portée par le dossier
**Invariant (fixe) + rétention tenant.**
La clôture émet `WORKFLOW_COMPLETED` et bascule le dossier en état `Clôturé` (R16). Rien n'est supprimé : audit trail, événements, visas, health checks restent extractibles par ID KYC (R51) et rejouables à date (R48). La durée de rétention post-clôture est un paramètre tenant (défaut 10 ans, art. 7 LBA) ; son échéance génère une tâche de revue de destruction — le système notifie, il ne détruit jamais seul (R39, R44).
### R445 — Toute modification du paramétrage offboarding passe par un pop-up d'engagement, tracé
**Invariant (fixe).**
Chaque modification d'un paramètre du §Offboarding (chaînes, motifs, rôles, checklists, sévérités de guards, forçages, SLA, rétention) déclenche un **pop-up de validation** rappelant en clair : l'ancien état, le nouvel état, la portée (dossiers futurs — grandfathering R29 sur les dossiers en cours) et, pour les guards touchant MROS ou sanctions, un rappel des obligations LBA/OBA-FINMA avec **engagement de responsabilité explicite** (mécanisme analogue au pop-up R14). Sans confirmation, aucune écriture. Avec confirmation : `PARAM_CHANGED` versionné par date de mise en vigueur, portant auteur, ancien/nouveau, texte de l'engagement — append-only (R49), rejouable à date (R48). C'est le pop-up qui protège les deux parties : la banque décide, la trace prouve qu'elle a décidé en connaissance.
---
## 2. Paramètres tenant — R-Q §Offboarding
| Clé | Type | Défaut | Règle |
|---|---|---|---|
| `settings.offboardingWorkflow.chains.LOW` | rôle[] | `["RM","CO"]` | R441 |
| `settings.offboardingWorkflow.chains.MEDIUM` | rôle[] | `["RM","CO","CO_SR"]` | R441 |
| `settings.offboardingWorkflow.chains.HIGH` | rôle[] | `["RM","CO_SR","MLRO","DIR"]` | R441 |
| `settings.offboardingWorkflow.chains.PEP` | rôle[] | `["RM","CO_SR","MLRO","DIR"]` | R441 |
| `settings.offboardingWorkflow.forcageParMotif` | map motif→niveau | `{ "Sanctions": "HIGH", "Risque AML élevé": "HIGH" }` | R441 |
| `settings.offboardingWorkflow.motifs` | string[] | référentiel standard (8 motifs) | R442 |
| `settings.offboardingWorkflow.rolesParMotif` | map motif→rôle[] | Compliance pour motifs AML/sanctions, RM sinon | R442 |
| `settings.offboardingWorkflow.checklistPP` | item[] {label, obligatoire} | checklist standard PP | R443 |
| `settings.offboardingWorkflow.checklistPM` | item[] {label, obligatoire} | checklist standard PM | R443 |
| `settings.offboardingWorkflow.guards` | map guard→sévérité (`BLOQUANT`\|`AVERTISSEMENT`\|`DÉSACTIVÉ`) | tous BLOQUANT | R440 — 100 % tenant, modification via pop-up R445 |
| `settings.offboardingWorkflow.retentionAnnees` | int | `10` | R444 |
| `settings.offboardingWorkflow.slaJoursParEtape` | map étape→int | Création 1 · Collecte 3 · Review 3 · Validation 2 | R439 (SLA moteur standard) |
Écran : **Paramétrage → Offboarding Workflow**. Chaque changement : pop-up d'engagement R445 (ancien/nouveau, portée, rappel réglementaire si guard sensible) → `PARAM_CHANGED` + PARAM_AUDIT, versionné par date de mise en vigueur, formule/valeurs affichées en clair (esprit R68).
---
## 3. Scénarios Gherkin — OF-01…OF-14
*Rouges avant tout code. Bloc terminé à 14/14 verts.*
### OF-01 — Initiation par un rôle habilité (R442, R439)
```gherkin
Étant donné un tenant où le motif "Demande du client" autorise les rôles [RM, CO]
Et un utilisateur U1 de rôle RM
Quand U1 initie un offboarding pour le client C1 avec le motif "Demande du client"
Alors une instance de workflow OFFBOARDING est créée
Et un événement WORKFLOW_STARTED est émis avec actor=U1, subjectId=<dossier>
Et l'état initial de l'instance est "Création"
```
### OF-02 — Initiation refusée pour rôle non habilité (R442)
```gherkin
Étant donné un tenant où le motif "Sanctions" autorise uniquement [CO_SR, MLRO]
Et un utilisateur U2 de rôle RM
Quand U2 tente d'initier un offboarding avec le motif "Sanctions"
Alors la commande est refusée avec le motif explicite "Rôle RM non habilité pour ce motif"
Et aucune instance n'est créée
Et aucun événement d'état n'est émis
```
### OF-03 — La progression est une transition, jamais un compteur (R439)
```gherkin
Étant donné une instance OFFBOARDING à l'étape "Review" dont tous les guards passent
Quand le validateur nommé V1 (rôle CO) appose son visa
Alors un événement TRANSITION_FIRED est émis (from="Review", to="Validation")
Et le visa est un objet conforme R15 (validateur nommé, horodaté, tracé)
Et l'état de l'instance est la projection des événements — aucun champ d'index n'existe
```
### OF-04 — Health Check bloque la transition (R440)
```gherkin
Étant donné une instance OFFBOARDING du client C1
Et une Account Review de C1 au statut "OVERDUE"
Quand le validateur tente la transition vers "Validation"
Alors la transition est refusée
Et un événement GUARD_BLOCKED est émis avec reason="Account Review non clôturée (AR-xxxx)"
Et l'état de l'instance est inchangé
```
### OF-05 — Bloqueur levé → même transition passe (R440)
```gherkin
Étant donné le contexte OF-04
Quand l'Account Review AR-xxxx passe au statut "COMPLETED"
Et que le validateur retente la même transition
Alors le guard est réévalué et passe
Et TRANSITION_FIRED est émis
Et aucune intervention manuelle sur l'état de l'instance n'a eu lieu
```
### OF-06 — Exclusion 4-yeux : l'initiateur ne vise pas (R13, R441)
```gherkin
Étant donné une instance OFFBOARDING initiée par U1 (rôle CO)
Et une chaîne d'approbation [RM, CO] pour le niveau LOW
Quand U1 tente d'apposer le visa CO de la chaîne
Alors le visa est refusé avec le motif "Exclusion 4-yeux — initiateur du dossier (R13)"
Et un autre utilisateur de rôle CO peut apposer ce visa
```
### OF-07 — Forçage de niveau par motif (R441)
```gherkin
Étant donné un client C2 de niveau de risque LOW
Et un tenant où forcageParMotif["Sanctions"] = HIGH
Quand un offboarding est initié pour C2 avec le motif "Sanctions"
Alors la chaîne d'approbation appliquée est chains.HIGH ([RM, CO_SR, MLRO, DIR])
Et la chaîne appliquée et son origine ("forçage motif Sanctions") figurent dans l'événement de création
```
### OF-08 — Modification de chaîne : versionnée + grandfathering (R29, R441)
```gherkin
Étant donné un dossier D1 initié le 01.06 sous la chaîne HIGH = [RM, CO_SR, MLRO, DIR]
Quand l'admin modifie chains.HIGH en [RM, CO_SR, DIR] avec mise en vigueur au 01.07
Alors un événement PARAM_CHANGED versionné est émis
Et D1 conserve la chaîne [RM, CO_SR, MLRO, DIR]
Et un dossier D2 initié le 02.07 applique [RM, CO_SR, DIR]
```
### OF-09 — Item de checklist obligatoire manquant → clôture refusée (R443, R440)
```gherkin
Étant donné une instance à l'étape "Validation" dont tous les visas sont apposés
Et l'item obligatoire "Archivage documentaire complet" non coché
Quand la transition de clôture est tentée
Alors GUARD_BLOCKED est émis avec reason="Item obligatoire non validé : Archivage documentaire complet"
Et l'instance reste en "Validation"
```
### OF-10 — Clôture : état Clôturé, append-only (R439, R444, R16, R49)
```gherkin
Étant donné une instance dont tous les visas et guards passent
Quand la transition finale est franchie
Alors WORKFLOW_COMPLETED est émis
Et le dossier passe à l'état "Clôturé" (R16)
Et aucun événement antérieur n'est modifié ni supprimé
Et toute tentative d'écriture sur le dossier clôturé est refusée (hors annotations append-only)
```
### OF-11 — Rejeu à date d'un dossier clôturé (R48, R51, R444)
```gherkin
Étant donné le dossier D1 clôturé le 15.07 sous la chaîne et la checklist en vigueur au 01.06
Quand un auditeur demande le rejeu de D1 à la date du 10.06
Alors le système restitue la chaîne, la checklist, les guards et les seuils en vigueur au 10.06
Et l'extraction complète de l'audit trail s'obtient par l'ID KYC (requête, pas reconstruction)
```
### OF-12 — MROS en attente : blocage + confidentialité (R440, art. 10a LBA)
```gherkin
Étant donné une instance OFFBOARDING du client C3
Et une déclaration MROS de C3 au statut "EN ATTENTE DE TRANSMISSION"
Quand un utilisateur de rôle RM consulte le health check du dossier
Alors le blocage est affiché avec le motif neutre "Vérifications compliance en cours"
Et le détail "Déclaration MROS en attente" n'est visible que pour [CO_SR, MLRO, DIR]
Et le guard MROS étant paramétré BLOQUANT (défaut tenant), toute transition de clôture est refusée (GUARD_BLOCKED)
Et aucune notification client n'est générée par le système
```
### OF-13 — Modification d'un guard : pop-up d'engagement obligatoire, tracé (R445, R440)
```gherkin
Étant donné le guard "Déclaration MROS en attente" paramétré BLOQUANT
Quand l'admin A1 change sa sévérité en AVERTISSEMENT
Alors un pop-up affiche l'ancien état, le nouvel état, la portée (dossiers futurs, R29)
Et le rappel des obligations LBA avec engagement de responsabilité explicite
Et sans confirmation de A1, aucune écriture n'a lieu
Quand A1 confirme
Alors un événement PARAM_CHANGED versionné est émis avec auteur=A1, ancien=BLOQUANT, nouveau=AVERTISSEMENT et le texte de l'engagement
Et la modification est rejouable à date (R48) et inaltérable (R49)
```
### OF-14 — Guard en AVERTISSEMENT : la transition passe, l'événement trace (R440)
```gherkin
Étant donné le contexte OF-13 confirmé
Et une instance OFFBOARDING du client C4 avec une déclaration MROS en attente
Quand le validateur franchit la transition de clôture
Alors un événement GUARD_WARNING est émis avec la raison nommée
Et la transition passe (TRANSITION_FIRED)
Et l'avertissement figure dans l'audit trail du dossier — extractible par ID KYC (R51)
```
---
## 4. Ordre d'implémentation proposé
1. Tests OF-01…OF-14 rouges (Jest, suite `offboarding-moteur.spec.ts`).
2. `WF_DEF OFFBOARDING` dans le moteur (états, transitions, guards R440) — pas de nouveau moteur.
3. Guards health check branchés sur les projections existantes (AR, alertes, screening, MROS, port core banking).
4. Registre R-Q §Offboarding + écran Paramétrage → Offboarding Workflow (PARAM_CHANGED versionné).
5. Migration de l'écran démo : `approvalIdx` remplacé par la projection d'instance ; `OFF_APPROVAL_CHAINS`/`OFF_REASON_FORCE`/checklists relus depuis le registre tenant.
6. 14/14 verts → ratification PO → régénération CANON-MASTER.md (R328).
**Écart consigné : E-OFF-1** → `docs/ECARTS-FRONT.md` — résolu par ce bloc à ratification.
