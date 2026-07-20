**O-LIVE**

Spécifications exécutables du moteur de workflow compliance

*Annexe technique aux Spécifications Produit v2*

Catalogue complet de règles R1--R51 et scénarios d\'acceptance (Gherkin)

Version 2.0 --- 12 juillet 2026 --- Catalogue complet, blocs 1 à 7

1\. Objet et méthodologie

Ce document formalise les règles métier du moteur de workflow d\'O-Live
extraites par sessions structurées de retour d\'expérience (KYC/CLM en
banque privée suisse, CDB 20, LBA), croisées avec les patterns établis
de l\'industrie (BPMN 2.0, moteurs Camunda/Temporal/Flowable). Chaque
règle est numérotée (R1 à R51) et déclinée en scénarios d\'acceptance au
format Gherkin, en français.

Double usage : (1) annexe normative des Spécifications Produit v2 ---
chaque règle est opposable lors des revues fonctionnelles ; (2) base
directe de la suite de tests automatisés du moteur --- chaque scénario
correspond à un test d\'acceptance à implémenter avant le code
correspondant (spécification exécutable).

Principes directeurs transverses issus de l\'extraction :

--- Rien ne change d\'état par effet de bord : toute propagation passe
par un événement qui génère des tâches et des alertes tracées
(architecture event-driven auditable).

--- Le visa est un objet uniforme : la validation finale globale est
elle-même un visa d\'étape, la hiérarchie de validation est de la
configuration, pas du code.

--- Le versioning s\'appuie sur les dates de mise en vigueur avec
grandfathering : un dossier validé n\'est jamais rétroactivement non
conforme.

--- Le système mesure et notifie ; il ne coerce pas : les SLA,
incitations et chaînes d\'escalade humaines relèvent de la politique de
chaque banque.

--- Ne jamais router une tâche vers quelqu\'un qui ne connaît pas la
relation client : assignation hiérarchique rôle puis personne.

--- Méta-règle d\'intégration (R-Q) : chaque point de variabilité
identifié dans ce catalogue est répertorié et posé formellement à la
banque au moment de l\'intégration d\'O-Live. Les réponses signées
constituent un prérequis contractuel de mise en place et couvrent
l\'éditeur comme la banque (voir section Questionnaire de paramétrage).

2\. Frontière moteur / configuration (multi-tenant)

Les sessions d\'extraction ont fait apparaître une ligne de partage
nette entre les invariants du moteur (identiques pour toutes les
banques) et les points de variabilité (paramétrables par tenant). Cette
frontière structure le modèle multi-tenant d\'O-Live.

  ----------------------------------- -----------------------------------
  **Invariants du moteur**            **Configuration par banque
                                      (tenant)**

  Principe 4-yeux : exclusion         Cumul de rôles autorisé ou interdit
  préparateur/validateur au niveau    dans un même dossier (R31)
  section (R13)                       

  Propagation par événements CoC,     Délai post-mandat avant
  jamais de synchro silencieuse (R30, dé-PEPisation (R33)
  R32)                                

  Grandfathering par date de mise en  Contenu de la matrice documentaire,
  vigueur de la matrice (R29)         délais d\'abandon (R19, R26)

  Bijectivité automatique des         Périmètre exact du Central File
  relations (R34)                     (R37)

  Assignation hiérarchique rôle puis  Restrictions d\'opérations en état
  personne (R38)                      Suspendu (R17)

  Refus motivé obligatoire,           Mécanismes d\'incitation SLA :
  re-soumission au même validateur    bonus, classements (R39)
  (R7)                                

  Conservation LBA prime sur          Chaînes d\'escalade et de déblocage
  effacement LPD (R20)                d\'urgence (R41)

  Audit trail intégral : tentatives,  Relais et suppléances par
  dérogations, annulations (R4, R12,  validateur nommé (R4)
  R14)                                

  Immutabilité append-only de         Fréquences du screening perpétuel
  l\'audit trail (R49)                (R42)

  Historisation et rejeu à date de    Journalisation des accès en lecture
  toute règle et matrice (R48)        (R47)

  Whitelist : analyse IA, décision    Sévérité d\'application sur hits
  toujours humaine (R44)              sanctions confirmés (R45)
  ----------------------------------- -----------------------------------

3\. Bloc 1 --- Cycle de vie du visa 4-yeux

*Le visa est l\'objet central de validation d\'O-Live. Il est uniforme :
la validation finale globale elle-même est un visa (R15), ce qui fait de
la hiérarchie de validation une configuration et non du code.*

3.1 Règles

**R1 --- Portée du visa.** Le visa porte sur une section. Un dossier
peut avoir plusieurs visas en parallèle, portés par des validateurs
distincts.

**R2 --- Validateur nommé.** Le validateur d\'un visa est une personne
nommée, et non un rôle générique.

**R3 --- Granularité de l\'exclusion.** Il n\'existe pas d\'exclusion
granulaire au niveau du champ : l\'exclusion préparateur/validateur
s\'applique au niveau de la section entière (cf. R13).

**R4 --- Absence du validateur.** En cas d\'absence du validateur nommé,
un relais nommé prend le relais. À défaut de relais, une dérogation
tracée est prononcée, adossée à la fiche de poste.

**R5 --- Rappels et escalade.** Un visa en attente déclenche des rappels
au validateur. Après le deuxième rappel sans réaction, une escalade est
déclenchée. Un document reçu valide au moment de sa réception reste
valide même s\'il expire pendant l\'attente du visa.

**R6 --- Invalidation sur modification.** Toute modification des données
de la section pendant l\'attente du visa invalide le visa en attente :
le visa aurait été accordé sur des données qui ont changé.

**R7 --- Refus motivé.** Le refus d\'un visa exige une motivation
obligatoire. La section retourne au préparateur. Après correction, la
re-soumission est adressée au même validateur, en sa qualité d\'owner du
client.

**R8 --- Durée de vie du visa accordé.** Un visa accordé vit jusqu\'au
prochain changement de données de sa section. Il n\'a pas d\'expiration
calendaire propre ; la recertification périodique est un process
distinct qui rouvre le dossier.

**R9 --- Pas de révocation discrétionnaire.** Un visa accordé ne peut
pas être révoqué de manière discrétionnaire.

**R10 --- Invalidation ciblée.** La modification d\'une section
n\'invalide que le visa de cette section (en attente ou accordé). Les
visas des autres sections survivent.

**R11 --- Changement de validateur nommé.** Le remplacement d\'un
validateur nommé (départ, réorganisation) relève du process owner /
application manager, avec escalade au COO de la banque si nécessaire.

**R12 --- Visa hors process.** Un visa accordé hors process (délégation
expirée, seuil de risque dépassé) est annulé pour non-respect du process
et qualifié en risque opérationnel.

**R13 --- Exclusion 4-yeux.** Le préparateur d\'une section ne peut
jamais viser cette section, quel que soit le nombre de champs qu\'il a
touchés.

**R14 --- Annulation pour vice de process.** L\'annulation pour vice de
process existe (cas très particulier) et est distincte de la révocation,
qui n\'existe pas. Elle est prononcée conjointement par le process owner
et le validateur final du workflow, après vérification. Le validateur
final engage sa responsabilité sur le respect des process : un pop-up
d\'engagement de responsabilité lui est présenté à son étape de
validation finale.

**R15 --- Validation finale = visa.** La validation finale globale du
dossier est une étape du workflow comme les autres, avec son propre
validateur nommé. Elle hérite de l\'intégralité des règles R1 à R14.

3.2 Scénarios d\'acceptance

> **Scénario V-01 --- Visas parallèles sur sections distinctes**
>
> **Étant donné** un dossier avec les sections \"Identification\" et
> \"Fiscalité\" en attente de visa
>
> **Et** deux validateurs nommés distincts pour ces deux sections
>
> **Quand** le validateur de \"Identification\" accorde son visa
>
> **Alors** le visa de \"Identification\" passe à \"Accordé\"
>
> **Et** le visa de \"Fiscalité\" reste \"En attente\" indépendamment
>
> **Scénario V-02 --- Exclusion 4-yeux au niveau section (R13)**
>
> **Étant donné que** l\'utilisateur U1 a modifié au moins un champ de
> la section \"Identification\"
>
> **Quand** U1 tente d\'accorder le visa de la section
> \"Identification\"
>
> **Alors** le système refuse l\'action avec le motif \"Principe 4-yeux
> : préparateur exclu de la validation de sa section\"
>
> **Et** l\'événement de tentative est tracé dans l\'audit trail
>
> **Scénario V-03 --- Exclusion limitée à la section préparée (R3,
> R13)**
>
> **Étant donné que** U1 a modifié des champs de la section
> \"Identification\" uniquement
>
> **Quand** U1 accorde le visa de la section \"Fiscalité\" dont il est
> le validateur nommé
>
> **Alors** le visa de \"Fiscalité\" est accordé
>
> **Et** aucune violation du principe 4-yeux n\'est levée
>
> **Scénario V-04 --- Relais en cas d\'absence du validateur (R4)**
>
> **Étant donné** un visa en attente dont le validateur nommé V1 est
> déclaré absent
>
> **Et** un relais nommé V2 est configuré pour V1
>
> **Quand** la tâche de visa est activée
>
> **Alors** la tâche est routée vers V2
>
> **Et** l\'audit trail mentionne \"visa accordé par relais V2 pour V1\"
>
> **Scénario V-05 --- Dérogation tracée sans relais (R4)**
>
> **Étant donné** un visa en attente dont le validateur nommé V1 est
> absent sans relais configuré
>
> **Quand** une dérogation est prononcée pour permettre la validation
> par V3
>
> **Alors** la dérogation est enregistrée avec référence à la fiche de
> poste
>
> **Et** l\'identité du décideur de la dérogation est tracée
>
> **Et** le visa accordé porte la mention \"sous dérogation\"
>
> **Scénario V-06 --- Deux rappels puis escalade (R5)**
>
> **Étant donné** un visa en attente depuis J jours ayant déclenché un
> premier rappel
>
> **Quand** le deuxième rappel expire sans réaction du validateur
>
> **Alors** une escalade est déclenchée vers la hiérarchie configurée
>
> **Et** les deux rappels et l\'escalade figurent dans l\'audit trail du
> visa
>
> **Scénario V-07 --- Document expirant pendant l\'attente du visa
> (R5)**
>
> **Étant donné** une section soumise au visa avec un passeport valide à
> la date de réception
>
> **Quand** le passeport expire pendant l\'attente du visa
>
> **Alors** le visa en attente reste valide à accorder
>
> **Et** une tâche de collecte du nouveau passeport est créée sans
> bloquer le visa
>
> **Scénario V-08 --- Invalidation du visa en attente sur modification
> (R6)**
>
> **Étant donné** la section \"Fiscalité\" en attente de visa
>
> **Quand** un utilisateur modifie un champ de données de la section
> \"Fiscalité\"
>
> **Alors** le visa en attente de \"Fiscalité\" passe à \"Invalidé\"
>
> **Et** le validateur nommé est notifié
>
> **Et** la section retourne à l\'état \"En préparation\"
>
> **Scénario V-09 --- Invalidation ciblée --- les autres visas survivent
> (R10)**
>
> **Étant donné** un dossier avec \"Fiscalité\" visée et
> \"Identification\" visée
>
> **Quand** un utilisateur modifie un champ de la section \"Fiscalité\"
>
> **Alors** le visa de \"Fiscalité\" passe à \"Invalidé\"
>
> **Et** le visa de \"Identification\" reste \"Accordé\"
>
> **Scénario V-10 --- Refus motivé obligatoire (R7)**
>
> **Étant donné** un visa en attente sur la section \"Identification\"
>
> **Quand** le validateur refuse le visa sans saisir de motivation
>
> **Alors** le système bloque le refus tant que la motivation n\'est pas
> renseignée
>
> **Scénario V-11 --- Re-soumission au même validateur (R7)**
>
> **Étant donné** une section refusée par le validateur V1 avec
> motivation
>
> **Et** la section corrigée par le préparateur
>
> **Quand** la section est re-soumise au visa
>
> **Alors** la tâche de visa est adressée au même validateur V1, owner
> du client
>
> **Scénario V-12 --- Refus puis départ du validateur (R7, R11)**
>
> **Étant donné** une section refusée par V1, en cours de correction
>
> **Quand** V1 quitte la banque avant la re-soumission
>
> **Alors** le process owner / application manager désigne un nouveau
> validateur nommé
>
> **Et** à défaut, l\'arbitrage est escaladé au COO
>
> **Et** le changement de validateur est tracé sur le dossier
>
> **Scénario V-13 --- Pas d\'expiration calendaire du visa accordé
> (R8)**
>
> **Étant donné** un visa accordé sur la section \"Identification\"
> depuis 14 mois
>
> **Et** aucune modification des données de la section
>
> **Alors** le visa reste \"Accordé\"
>
> **Et** seule l\'ouverture d\'un process de recertification peut
> rouvrir la section
>
> **Scénario V-14 --- Pas de révocation discrétionnaire (R9)**
>
> **Étant donné** un visa accordé sur la section \"Fiscalité\"
>
> **Quand** le validateur tente de retirer son visa sans vice de process
> constaté
>
> **Alors** le système refuse l\'action : la révocation discrétionnaire
> n\'existe pas
>
> **Scénario V-15 --- Annulation pour vice de process (R12, R14)**
>
> **Étant donné** un visa accordé par V1 alors que sa délégation était
> expirée
>
> **Quand** le vice de process est constaté
>
> **Alors** le visa est annulé avec le motif \"process non respecté\"
>
> **Et** un incident de risque opérationnel est enregistré
>
> **Et** l\'annulation, son auteur et sa justification sont tracés
>
> **Scénario V-16 --- Validation finale globale = visa d\'étape (R15)**
>
> **Étant donné** un dossier dont toutes les sections sont visées
>
> **Quand** le dossier atteint l\'étape \"Validation finale\" du
> workflow
>
> **Alors** une tâche de visa est créée pour le validateur nommé de
> cette étape
>
> **Et** ce visa obéit aux règles R1 à R14 (exclusion, relais,
> invalidation, refus motivé)
>
> **Scénario V-17 --- Invalidation de la validation finale sur
> modification (R6, R15)**
>
> **Étant donné** un dossier en attente de validation finale
>
> **Quand** une donnée d\'une section est modifiée
>
> **Alors** le visa de la section concernée est invalidé
>
> **Et** la validation finale en attente est invalidée à son tour
>
> **Et** le dossier redescend à l\'étape correspondante du workflow

4\. Bloc 2 --- Cycle de vie du dossier

*Le dossier est la racine d\'agrégation. Ses états transverses
(Suspendu, En mise à jour, Rejeté) et la gestion des collisions de
process structurent l\'exploitation quotidienne.*

4.1 Règles

**R16 --- États du dossier.** États nominaux : Brouillon, En
préparation, En validation, Actif, Clôturé. États transverses :
Suspendu, En mise à jour, Rejeté, Abandonné.

**R17 --- État Suspendu.** Le dossier Suspendu (investigation, alerte
non résolue, décision MLRO) reste visible mais restreint les opérations.
Les restrictions sont paramétrables --- typiquement entrées autorisées /
sorties gelées en cas de communication MROS (art. 9a LBA), pour ne pas
alerter le client.

**R18 --- État Rejeté.** Le rejet avant activation est distinct de la
clôture : il alimente la liste des prospects refusés et permet la
détection du retour du même prospect ultérieurement.

**R19 --- Abandon.** Un dossier inactif déclenche des rappels au RM (30
et 60 jours), puis une clôture administrative en Abandonné à 90 jours
(délais paramétrables), avec possibilité de réactivation.

**R20 --- Conservation.** Les données d\'un dossier abandonné sont
conservées, non effacées : l\'obligation de conservation LBA (10 ans dès
le début des diligences) prime sur le droit à l\'effacement LPD. Le
dossier abandonné reste consultable en lecture seule.

**R21 --- Réouverture ciblée.** Un changement de circonstances ne rouvre
que les sections impactées. Le dossier passe En mise à jour et le client
reste opérationnel, sauf si le changement touche un critère de risque
majeur, auquel cas le dossier passe en Suspendu.

**R22 --- Le risque décide.** C\'est le niveau de risque du changement
qui détermine les restrictions applicables, pas le changement lui-même.

**R23 --- Collision de process.** Pas de fusion de process : priorité et
absorption. L\'événement de risque (alerte, CoC) est prioritaire sur la
recertification planifiée, qui est mise en pause. À la clôture de
l\'événement, la recertification reprend en réutilisant les sections
déjà revalidées. Chaque process conserve son identité et son audit trail
; le dossier porte la file d\'ordonnancement.

4.2 Scénarios d\'acceptance

> **Scénario D-01 --- Passage en Suspendu sur alerte (R16, R17)**
>
> **Étant donné** un dossier Actif
>
> **Quand** une alerte de screening non résolue est rattachée au dossier
>
> **Alors** le dossier passe à l\'état \"Suspendu\"
>
> **Et** les restrictions d\'opérations configurées par la banque
> s\'appliquent
>
> **Scénario D-02 --- Suspension discrète type MROS (R17)**
>
> **Étant donné** un dossier Suspendu suite à une communication au MROS
>
> **Quand** le paramétrage \"entrées autorisées / sorties gelées\" est
> actif
>
> **Alors** les crédits entrants restent possibles
>
> **Et** les sorties de fonds sont bloquées
>
> **Et** aucune notification n\'est adressée au client (art. 9a LBA)
>
> **Scénario D-03 --- Rejet et détection de retour du prospect (R18)**
>
> **Étant donné** un dossier prospect passé à l\'état \"Rejeté\"
>
> **Quand** un nouveau dossier est initié 6 mois plus tard pour la même
> personne
>
> **Alors** le système signale la correspondance avec la liste des
> prospects refusés
>
> **Et** le motif du rejet initial est présenté au compliance officer
>
> **Scénario D-04 --- Abandon progressif (R19)**
>
> **Étant donné** un dossier \"En préparation\" sans activité depuis 30
> jours
>
> **Alors** un premier rappel est envoyé au RM
>
> **Quand** l\'inactivité atteint 60 jours, un second rappel est envoyé
>
> **Quand** l\'inactivité atteint 90 jours, le dossier passe à
> \"Abandonné\"
>
> **Et** le dossier reste réactivable si le prospect revient
>
> **Scénario D-05 --- Conservation LBA prime sur effacement (R20)**
>
> **Étant donné** un dossier \"Abandonné\" pour lequel des diligences
> avaient commencé
>
> **Quand** une demande d\'effacement LPD est reçue
>
> **Alors** les données sont conservées au titre de l\'obligation LBA
> (10 ans)
>
> **Et** le dossier reste consultable en lecture seule
>
> **Et** la demande et son traitement sont tracés
>
> **Scénario D-06 --- Réouverture ciblée, client opérationnel (R21)**
>
> **Étant donné** un dossier Actif
>
> **Quand** un changement de domicile fiscal est déclaré
>
> **Alors** seule la section \"Fiscalité\" repasse \"En préparation\"
>
> **Et** le dossier passe à \"En mise à jour\"
>
> **Et** le client continue à transiger normalement
>
> **Scénario D-07 --- Changement à risque majeur (R21, R22)**
>
> **Étant donné** un dossier Actif
>
> **Quand** un nouveau bénéficiaire économique domicilié dans un pays
> sous sanctions est déclaré
>
> **Alors** le dossier passe à \"Suspendu\" avec restrictions
>
> **Et** les sections impactées sont rouvertes
>
> **Et** le MLRO est notifié
>
> **Scénario D-08 --- Collision recertification / événement (R23)**
>
> **Étant donné** une recertification périodique en cours sur un dossier
>
> **Quand** un changement de circonstances survient
>
> **Alors** la recertification est mise en pause
>
> **Et** l\'événement est traité en priorité comme mise à jour ciblée
>
> **Et** chaque process conserve son audit trail propre
>
> **Scénario D-09 --- Absorption des sections revalidées (R23)**
>
> **Étant donné** un événement clôturé ayant revalidé la section
> \"Identification\" il y a 3 jours
>
> **Quand** la recertification en pause reprend
>
> **Alors** la section \"Identification\" n\'est pas re-soumise au visa
>
> **Et** la recertification référence le visa issu du process événement

5\. Bloc 3 --- Section et matrice documentaire

*Le cœur CDB 20 d\'O-Live : sections à structure fixe et contenu
variable, matrice documentaire versionnée par date de mise en vigueur
avec grandfathering.*

5.1 Règles

**R24 --- Sections fixes, contenu variable.** La structure des sections
est identique pour tous les dossiers ; les champs et documents exigés
varient selon le type d\'entité (8 types : Operating Company,
Domiciliary Company, Individual, Joint Account, Trust, Foundation, Legal
Entity, EAM).

**R25 --- Visa conditionnel.** Une section peut être soumise au visa
avec un document en statut « en attente de réception », afin de ne pas
bloquer le travail des autres intervenants sur les autres sections. Si
le document attendu est optionnel : escalade sans invalidation. S\'il
est obligatoire : le visa saute sous 30 jours avec escalade. Délais et
comportement paramétrables selon la politique de la banque (cf.
questionnaire de paramétrage).

**R26 --- Structure de la matrice.** La matrice croise les documents
(lignes) avec la structure juridique (colonnes), les personnes liées à
cette structure et les comptes liés. La complétude d\'un dossier est
l\'union des exigences de l\'entité titulaire, de toutes les personnes
liées et des comptes.

**R27 --- Juridiction d\'abord.** La juridiction du cas KYC est fixée en
premier ; elle détermine ensuite quel document du groupe d\'équivalence
est requis (ex. extrait RC suisse vs certificate of incorporation).

**R28 --- Péremption sur dossier actif.** L\'expiration d\'un document
dans un dossier Actif déclenche une simple tâche de collecte, sans
toucher au visa. Cohérent avec R5 : un document reçu valide reste valide
; l\'invalidation R6/R10 ne concerne que les modifications de données.

**R29 --- Versioning par date de vigueur.** La matrice est versionnée
par date de mise en vigueur. Chaque dossier est estampillé avec la
version sous laquelle son KYC a été validé. Un dossier validé avant une
réforme reste conforme à sa version --- jamais rétroactivement faux ou
incomplet. Les nouvelles exigences s\'appliquent aux dossiers initiés ou
en cours après la date. À la prochaine recertification, le dossier
bascule obligatoirement sur la version de matrice en vigueur.

5.2 Scénarios d\'acceptance

> **Scénario S-01 --- Structure fixe, contenu variable (R24)**
>
> **Étant donné** un dossier de type \"Trust\" et un dossier de type
> \"Individual\"
>
> **Alors** les deux dossiers présentent la même structure de sections
>
> **Et** les champs et documents exigés diffèrent selon la configuration
> du type d\'entité
>
> **Scénario S-02 --- Visa conditionnel (R25)**
>
> **Étant donné** une section complète à l\'exception d\'un document au
> statut \"en attente de réception\"
>
> **Quand** le préparateur soumet la section au visa
>
> **Alors** la soumission est acceptée avec l\'indicateur \"visa
> conditionnel\"
>
> **Et** le document manquant génère une tâche de collecte
>
> **Et** les autres sections ne sont pas bloquées
>
> **Scénario S-03 --- Complétude par union des matrices (R26)**
>
> **Étant donné** un dossier \"Domiciliary Company\" avec deux personnes
> liées (BE, signataire) et un compte lié
>
> **Alors** la complétude documentaire exige l\'union des documents
> requis pour la structure, chaque personne liée et le compte
>
> **Et** la disparition d\'un document requis pour le BE rend le dossier
> incomplet même si les documents de la structure sont complets
>
> **Scénario S-04 --- La juridiction détermine le document (R27)**
>
> **Étant donné** un groupe d\'équivalence \"preuve d\'existence
> légale\" contenant \"extrait RC\" et \"certificate of incorporation\"
>
> **Quand** la juridiction du cas KYC est fixée à \"Suisse\"
>
> **Alors** le document requis est l\'extrait du registre du commerce
>
> **Quand** la juridiction est fixée à \"Îles Caïmans\"
>
> **Alors** le document requis est le certificate of incorporation
>
> **Scénario S-05 --- Péremption sans invalidation de visa (R28)**
>
> **Étant donné** un dossier Actif dont le passeport du titulaire expire
> aujourd\'hui
>
> **Alors** une tâche de collecte du nouveau passeport est créée
>
> **Et** le visa de la section \"Identification\" reste \"Accordé\"
>
> **Et** aucune restriction n\'est appliquée au dossier
>
> **Scénario S-06 --- Grandfathering à la mise en vigueur (R29)**
>
> **Étant donné** une matrice v2 exigeant un nouveau document pour les
> Trusts, en vigueur au 01.09
>
> **Et** un dossier Trust dont le KYC a été validé le 15.07 sous la
> matrice v1
>
> **Alors** le dossier validé reste conforme à la matrice v1
>
> **Et** il n\'est jamais marqué incomplet rétroactivement
>
> **Scénario S-07 --- Nouvelle matrice pour les dossiers en cours
> (R29)**
>
> **Étant donné** la matrice v2 en vigueur au 01.09
>
> **Et** un dossier Trust initié le 20.08, encore \"En préparation\" au
> 01.09
>
> **Alors** le dossier est rattaché à la matrice v2
>
> **Et** le nouveau document exigé apparaît dans sa liste de complétude
>
> **Scénario S-08 --- Estampillage de version (R29)**
>
> **Étant donné** un dossier dont le KYC est validé
>
> **Alors** le dossier porte de manière immuable l\'identifiant de la
> version de matrice applicable
>
> **Et** toute consultation ultérieure de la complétude s\'évalue contre
> cette version

6\. Bloc 4 --- Personnes liées

*La personne physique est un objet unique du référentiel, relié aux
dossiers par un graphe de rôles et de relations. Principe directeur :
rien ne se propage par effet de bord --- tout passe par un événement qui
génère des tâches et des alertes.*

6.1 Règles

**R30 --- Personne unique, propagation par événement.** Une personne
physique est unique dans le système et référencée par N dossiers. Un
changement (ex. nouveau passeport) passe par un événement de changement
de circonstances (CoC) : tâche de mise à jour du document en GED et dans
O-Live, propagation à tous les dossiers où la personne apparaît, alerte
aux RM concernés.

**R31 --- Cumul de rôles.** Le cumul de rôles par une même personne dans
un même dossier dépend de la politique de la banque (paramétrable).
S\'il est autorisé en situation de conflit d\'intérêts (juge et partie),
un flag obligatoire (ex. insider) est posé et alimente les scénarios AML
correspondants.

**R32 --- PEPisation contagieuse.** La PEPisation est détectée via CoC,
nouveau KYC, account review ou EDD. L\'événement est contagieux : il se
propage à tous les dossiers où la personne est présente, matérialisé à
la validation du KYC ou par les tâches émanant du CoC / account review.
Jamais de bascule silencieuse de niveau de risque.

**R33 --- Dé-PEPisation humaine.** Le déclassement PEP est toujours une
décision humaine, sur alerte CoC au Central File ou au RM concerné. Le
délai post-mandat avant statut non-PEP est paramétrable selon la
politique de la banque.

**R34 --- Bijectivité étendue.** Toute relation déclarée crée
automatiquement sa réciproque, y compris pour les relations non
officielles (« Dupont père d\'Ali » crée « Ali fils de Dupont »). Le
graphe relationnel couvre les liens familiaux et informels --- essentiel
pour les proches de PEP (art. 2a LBA).

**R35 --- Archivage.** Une personne qui n\'a plus aucun rôle dans aucun
dossier est archivée, non supprimée (conservation LBA).

**R36 --- Divergence d\'identité.** Une divergence d\'identité entre
dossiers (ex. dates de naissance contradictoires) ouvre un dossier
Central File : corroboration auprès des différents RM, établissement de
la donnée correcte, validation par corroboration documentaire et
intégration du bon document. Arbitrage humain tracé, jamais de merge
automatique.

6.2 Scénarios d\'acceptance

> **Scénario P-01 --- Propagation par événement CoC (R30)**
>
> **Étant donné** M. Dupont, personne unique présente dans 5 dossiers
>
> **Quand** un nouveau passeport est enregistré pour M. Dupont
>
> **Alors** un événement de changement de circonstances est créé
>
> **Et** une tâche de mise à jour du document en GED et dans O-Live est
> générée
>
> **Et** les RM des 5 dossiers concernés sont alertés
>
> **Et** aucune donnée n\'est modifiée silencieusement dans les dossiers
>
> **Scénario P-02 --- Cumul de rôles selon politique banque (R31)**
>
> **Étant donné** une banque dont la politique interdit le cumul de
> rôles dans un même dossier
>
> **Quand** le settlor d\'un Trust est déclaré également bénéficiaire
>
> **Alors** le système bloque la déclaration avec le motif configuré
>
> **Étant donné** une banque dont la politique autorise ce cumul
>
> **Alors** la déclaration est acceptée avec un flag de conflit
> d\'intérêts obligatoire
>
> **Scénario P-03 --- Flag insider pour les scénarios AML (R31)**
>
> **Étant donné** une personne en situation de juge et partie dans un
> dossier
>
> **Quand** le cumul est validé conformément à la politique de la banque
>
> **Alors** le flag \"insider\" est posé sur la personne
>
> **Et** ce flag est exposé aux scénarios AML correspondants
>
> **Scénario P-04 --- PEPisation contagieuse (R32)**
>
> **Étant donné** M. Dupont présent dans 5 dossiers
>
> **Quand** sa nomination à une fonction publique est détectée via un
> CoC
>
> **Alors** l\'événement PEP se propage aux 5 dossiers
>
> **Et** des tâches de réévaluation émanent du CoC pour chaque dossier
>
> **Et** aucun niveau de risque ne bascule sans process associé
>
> **Scénario P-05 --- Dé-PEPisation humaine (R33)**
>
> **Étant donné** une personne PEP dont le mandat public a pris fin
>
> **Quand** le délai post-mandat configuré par la banque est écoulé
>
> **Alors** une alerte CoC est adressée au Central File ou au RM
> concerné
>
> **Et** le statut PEP n\'est levé que sur décision humaine tracée
>
> **Et** jamais automatiquement à l\'échéance
>
> **Scénario P-06 --- Bijectivité des relations informelles (R34)**
>
> **Étant donné** la déclaration \"Dupont est père d\'Ali\" dans un
> dossier
>
> **Alors** la relation réciproque \"Ali est fils de Dupont\" est créée
> automatiquement
>
> **Et** les deux profils exposent la relation dans leur graphe
>
> **Et** la suppression de l\'une supprime l\'autre
>
> **Scénario P-07 --- Archivage d\'une personne sans rôle (R35)**
>
> **Étant donné** M. Dupont retiré de son dernier rôle dans son dernier
> dossier
>
> **Alors** la personne passe à l\'état \"Archivée\"
>
> **Et** ses données sont conservées au titre de la LBA
>
> **Et** elle est réactivable si un nouveau rôle lui est attribué
>
> **Scénario P-08 --- Divergence d\'identité arbitrée par le Central
> File (R36)**
>
> **Étant donné** le dossier A indiquant une naissance au 12.03.1965 et
> le dossier B au 21.03.1965 pour la même personne présumée
>
> **Quand** la divergence est détectée
>
> **Alors** un dossier Central File est ouvert
>
> **Et** la corroboration est menée auprès des RM des deux dossiers
>
> **Et** la donnée correcte est établie par corroboration documentaire,
> avec intégration du bon document
>
> **Et** aucune fusion automatique n\'est effectuée

7\. Bloc 5 --- Tâches, corbeilles et rôles

*L\'assignation suit la hiérarchie rôle puis personne, avec un principe
directeur : ne jamais router une tâche vers quelqu\'un qui ne connaît
pas la relation client.*

7.1 Règles

**R37 --- Central File.** Le Central File est le gardien documentaire
transversal : centralisation de tous les documents, contrôle qualité
(pièces d\'identité, factures, source of wealth), corroboration avec RM
et Compliance. Son périmètre exact est paramétrable selon les process de
la banque.

**R38 --- Assignation rôle puis personne.** Une tâche est assignée à un
rôle, avec ciblage optionnel d\'une personne si le client fait partie de
son scope. On ne demande jamais le passeport d\'une personne à un RM
pour qui elle est inconnue. La délégation RM vers ARM est native :
c\'est le fonctionnement normal.

**R39 --- SLA à deux niveaux.** Les SLA existent formellement ; leur
dépassement ne force rien mécaniquement : le dossier reste bloqué et la
hiérarchie est informée. Les mécanismes d\'incitation (bonus,
classement, rigidité d\'application) relèvent de la politique de la
banque. O-Live fournit la mesure (compteurs, tableaux de dépassement) et
la notification, pas la coercition.

**R40 --- Réaffectation managériale.** Le responsable de fonction
dispose d\'une vue de charge de son équipe (tâches par personne,
retards, bande passante) et réaffecte selon sa stratégie.

**R41 --- Déblocage d\'urgence et homme-clé.** Le déblocage d\'une tâche
bloquante sur dossier urgent suit une chaîne d\'escalade humaine :
application manager, manager de la fonction, COO. Le process prévoit en
principe un remplaçant du remplaçant ; si la chaîne est vide, il s\'agit
d\'un risque opérationnel homme-clé que le système doit détecter et
signaler (rôle sans titulaire ni suppléant), pas résoudre.

7.2 Scénarios d\'acceptance

> **Scénario T-01 --- Contrôle qualité documentaire par le Central File
> (R37)**
>
> **Étant donné** un document \"source of wealth\" déposé par un RM
>
> **Quand** le document entre dans la corbeille du Central File
>
> **Alors** une tâche de contrôle qualité est créée
>
> **Et** le document n\'est réputé valide qu\'après contrôle du Central
> File
>
> **Scénario T-02 --- Assignation rôle puis personne (R38)**
>
> **Étant donné** une tâche \"collecter nouveau passeport\" pour le
> client C
>
> **Quand** la tâche est créée
>
> **Alors** elle est assignée au rôle RM
>
> **Et** ciblée sur la personne dont C fait partie du scope
>
> **Et** jamais routée vers un RM pour qui C est inconnu
>
> **Scénario T-03 --- Délégation RM vers ARM (R38)**
>
> **Étant donné** une tâche assignée au RM R1
>
> **Quand** R1 délègue la tâche à son assistant ARM A1
>
> **Alors** A1 devient titulaire de la tâche
>
> **Et** la délégation est tracée sans procédure d\'exception
>
> **Scénario T-04 --- SLA : mesure et notification, pas de coercition
> (R39)**
>
> **Étant donné** une tâche avec un SLA de 48 heures dépassé
>
> **Alors** le dossier reste bloqué en l\'état
>
> **Et** la hiérarchie configurée est informée du dépassement
>
> **Et** le compteur de dépassement alimente les tableaux de suivi
>
> **Et** aucune action n\'est forcée mécaniquement
>
> **Scénario T-05 --- Vue de charge et réaffectation (R40)**
>
> **Étant donné** le responsable Compliance consultant la vue de charge
> de son équipe
>
> **Alors** il voit par personne le nombre de tâches, les retards et la
> bande passante
>
> **Quand** il réaffecte une tâche de U1 vers U2
>
> **Alors** la réaffectation est effective et tracée avec son auteur
>
> **Scénario T-06 --- Chaîne d\'escalade de déblocage (R41)**
>
> **Étant donné** une tâche bloquante sur un dossier urgent dont le
> titulaire est injoignable
>
> **Quand** l\'application manager est saisi
>
> **Alors** il alerte le manager de la fonction concernée
>
> **Et** à défaut de décision, l\'escalade atteint le COO
>
> **Et** chaque étape et la décision finale sont tracées
>
> **Scénario T-07 --- Détection du risque homme-clé (R41)**
>
> **Étant donné** un rôle de validation sans titulaire actif ni
> suppléant configuré
>
> **Alors** le système détecte la vacance
>
> **Et** signale un risque opérationnel homme-clé au process owner
>
> **Et** le signalement figure au reporting des risques opérationnels

8\. Bloc 6 --- Screening et alertes AML

*Le screening est perpétuel et événementiel. Principe cardinal : on ne
joue pas avec les sanctions --- le coût d\'un hit mal géré est la
licence bancaire (précédent d\'une banque zurichoise liquidée par la
FINMA pour des transactions avec l\'Iran, sous pression de la Fed).*

8.1 Règles

**R42 --- Déclencheurs du screening.** Quatre déclencheurs : (1)
création de toute personne ou entité ; (2) screening perpétuel en batch
--- quotidien pour les positions et transactions, hebdomadaire pour PEP
et sanctions (fréquences paramétrables) ; (3) rescreening sur
modification des données d\'identité (nom, date de naissance,
nationalité) ; (4) déclenchement manuel à la section screening du KYC.

**R43 --- Cycle de vie du hit.** Un hit est analysé par le Compliance
sanctions (LoD1) puis confirmé ou écarté par le MLRO ou le rôle LoD2
alloué par la banque. La clôture en faux positif exige une justification
obligatoire, symétrique au refus de visa (R7).

**R44 --- Whitelist des faux positifs récurrents.** Un couple
personne-profil écarté de manière récurrente entre en whitelist, avec
justification obligatoire de l\'entrée fondée sur la récurrence. Si les
données de la personne (ou du profil source) changent : une analyse IA
évalue l\'impact du changement sur le screening, puis le responsable de
la whitelist décide humainement du maintien ou de la sortie. Pattern :
AI-assisted, human-decided.

**R45 --- Hit sanctions confirmé.** Un hit sanctions confirmé entraîne
la suspension du dossier (R17) et un offboarding en distressed asset. La
décision est prise par Compliance et les RM concernés, pour ne pas
exposer la banque aux amendes et conséquences réglementaires. La
sévérité d\'application est paramétrable, la suspension est le
comportement par défaut.

**R46 --- Hit pendant la validation.** Un hit survenant pendant qu\'un
dossier est en validation gèle les visas en cours et ouvre un délai
d\'analyse. À l\'issue : offboarding (fermeture ou annulation) ou
acceptation du risque et poursuite. La décision est prise en comité Risk
& Compliance (BRM, COO, Compliance).

8.2 Scénarios d\'acceptance

> **Scénario A-01 --- Screening perpétuel multi-fréquences (R42)**
>
> **Étant donné** le référentiel des personnes et entités actives
>
> **Alors** le screening des positions et transactions s\'exécute
> quotidiennement
>
> **Et** le screening PEP et sanctions s\'exécute de manière
> hebdomadaire
>
> **Et** les fréquences sont paramétrables par la banque
>
> **Scénario A-02 --- Rescreening sur modification d\'identité (R42)**
>
> **Étant donné** M. Dupont déjà screené sans hit
>
> **Quand** sa nationalité est modifiée via un CoC
>
> **Alors** un rescreening de M. Dupont est déclenché immédiatement
>
> **Et** le résultat est rattaché à l\'événement CoC d\'origine
>
> **Scénario A-03 --- Cycle du hit en deux lignes de défense (R43)**
>
> **Étant donné** un hit World-Check sur M. Dupont à l\'état \"Nouveau\"
>
> **Quand** le Compliance sanctions (LoD1) qualifie le hit en faux
> positif
>
> **Alors** une justification obligatoire est exigée avant la clôture
>
> **Et** la confirmation finale revient au MLRO ou au rôle LoD2
> configuré par la banque
>
> **Scénario A-04 --- Whitelist justifiée par la récurrence (R44)**
>
> **Étant donné** le même hit sur le même homonyme écarté 5 fois par le
> batch quotidien
>
> **Quand** le couple personne-profil est ajouté à la whitelist
>
> **Alors** l\'entrée exige une justification fondée sur la récurrence
> du faux positif
>
> **Et** le hit n\'est plus régénéré par les batchs suivants
>
> **Scénario A-05 --- Sortie de whitelist assistée par IA, décidée
> humainement (R44)**
>
> **Étant donné** M. Dupont en whitelist pour un profil homonyme
>
> **Quand** la date de naissance de M. Dupont est corrigée
>
> **Alors** une analyse IA évalue l\'impact du changement sur la
> pertinence de la whitelist
>
> **Et** le responsable de la whitelist décide humainement du maintien
> ou de la sortie
>
> **Et** sa décision et l\'analyse IA sont tracées ensemble
>
> **Scénario A-06 --- Hit sanctions confirmé (R45, R17)**
>
> **Étant donné** un hit sanctions confirmé sur une personne liée d\'un
> dossier Actif
>
> **Alors** le dossier passe à \"Suspendu\" avec restrictions
>
> **Et** un process d\'offboarding en distressed asset est ouvert
>
> **Et** la décision est portée par Compliance et les RM concernés
>
> **Scénario A-07 --- Hit pendant la validation : gel et comité (R46)**
>
> **Étant donné** un dossier en validation avec deux visas en attente
>
> **Quand** un hit tombe sur le titulaire du dossier
>
> **Alors** les visas en cours sont gelés
>
> **Et** un délai d\'analyse est ouvert
>
> **Et** l\'issue (offboarding ou acceptation du risque et poursuite)
> est décidée en comité Risk & Compliance réunissant BRM, COO et
> Compliance
>
> **Et** la décision du comité est tracée sur le dossier

9\. Bloc 7 --- Audit trail et reporting réglementaire

*Tout est archivé et historisé par construction. Le système doit pouvoir
rejouer n\'importe quel cas aux conditions exactes d\'une date
antérieure --- versions de matrice et de process comprises.*

9.1 Règles

**R47 --- Journalisation des lectures.** La confidentialité est
élémentaire. La journalisation des accès en consultation (lectures) est
disponible nativement et activable selon la demande de la banque ---
certaines l\'exigent, d\'autres non (paramétrable).

**R48 --- Historisation et rejeu à date.** Tout changement de matrice et
de process est historisé. Le système sait restituer les seuils, matrices
et règles en vigueur à toute date antérieure, afin de rejouer un cas aux
mêmes conditions --- drill-down dans le temps. C\'est la généralisation
du grandfathering R29 à l\'ensemble du référentiel de règles.

**R49 --- Immutabilité.** L\'audit trail est append-only : personne ne
peut le modifier, y compris l\'application manager. La correction d\'une
erreur de saisie s\'ajoute par-dessus l\'écriture erronée ; elle
n\'efface jamais.

**R50 --- Exports réglementaires standard.** La banque dispose en
standard : du registre des dérogations, de la liste des dossiers en
retard de recertification, du rapport PEP périodique, et de la liste des
hits avec leur traitement.

**R51 --- Extraction par identifiant KYC.** Toute demande d\'audit (ex.
prouver le respect du 4-yeux sur 50 dossiers) s\'exécute par extraction
de l\'audit trail complet des dossiers identifiés par leur ID KYC. Tout
étant archivé et historisé par construction, l\'extraction est une
requête, pas une reconstruction.

9.2 Scénarios d\'acceptance

> **Scénario X-01 --- Journalisation des lectures activable (R47)**
>
> **Étant donné** une banque ayant activé la journalisation des
> consultations
>
> **Quand** un utilisateur ouvre un dossier en lecture seule
>
> **Alors** l\'accès est journalisé avec l\'utilisateur, la date et le
> dossier
>
> **Étant donné** une banque ne l\'ayant pas activée
>
> **Alors** seules les écritures sont journalisées
>
> **Scénario X-02 --- Rejeu d\'un cas à date antérieure (R48)**
>
> **Étant donné** une inspection demandant l\'état du dossier X au
> 15.03.2024
>
> **Quand** la reconstitution à date est exécutée
>
> **Alors** le système restitue l\'état exact du dossier au 15.03.2024
>
> **Et** la version de la matrice documentaire en vigueur ce jour-là
>
> **Et** la version du process et des règles applicables
>
> **Et** le cas peut être rejoué aux mêmes conditions
>
> **Scénario X-03 --- Correction sans effacement (R49)**
>
> **Étant donné** une date de naissance saisie par erreur puis corrigée
>
> **Alors** l\'audit trail contient l\'écriture erronée puis l\'écriture
> de correction
>
> **Et** aucune entrée n\'a été modifiée ni supprimée
>
> **Et** aucun profil, y compris l\'application manager, ne dispose
> d\'un droit d\'effacement
>
> **Scénario X-04 --- Exports réglementaires standard (R50)**
>
> **Étant donné** une banque en exploitation
>
> **Alors** elle peut produire à la demande : le registre des
> dérogations, la liste des dossiers en retard de recertification, le
> rapport PEP périodique et la liste des hits avec leur traitement
>
> **Scénario X-05 --- Preuve du 4-yeux sur un lot de dossiers (R51)**
>
> **Étant donné** une demande d\'audit portant sur 50 dossiers
> identifiés par leur ID KYC
>
> **Quand** l\'extraction d\'audit trail est lancée sur ces identifiants
>
> **Alors** chaque dossier restitue la chronologie complète :
> préparateurs, validateurs, visas, dérogations
>
> **Et** la distinction préparateur/validateur par section est
> démontrable pour chaque visa
>
> **Et** l\'extraction est une requête sur l\'existant, pas une
> reconstruction

10\. Questionnaire de paramétrage d\'intégration (R-Q)

En application de la méta-règle R-Q, les points de variabilité suivants
sont posés formellement à la banque lors de l\'intégration d\'O-Live.
Les réponses validées et signées par la banque constituent un prérequis
de mise en place de la solution et un élément de couverture
contractuelle.

  ------------- ----------------------------------------- ----------------------
  **Réf.**      **Question à poser à la banque**          **Domaine**

  **R4**        Qui sont les relais nommés de chaque      Visa / organisation
                validateur ? Quelle est la procédure de   
                dérogation et son rattachement aux fiches 
                de poste ?                                

  **R5**        Délais des rappels de visa et             Visa / SLA
                destinataires de l\'escalade après le     
                deuxième rappel ?                         

  **R17**       Restrictions d\'opérations en état        Dossier
                Suspendu (ex. entrées autorisées /        
                sorties gelées en cas de communication    
                MROS) ?                                   

  **R19**       Délais de rappel et de clôture            Dossier
                administrative des dossiers abandonnés ?  

  **R25**       Liste des documents optionnels vs         Matrice documentaire
                obligatoires par section, et délai        
                d\'invalidation du visa conditionnel      
                (défaut : 30 jours) ?                     

  **R26/R29**   Contenu de la matrice documentaire par    Matrice documentaire
                structure juridique, personnes liées et   
                comptes ; calendrier des mises en vigueur 
                ?                                         

  **R31**       Le cumul de rôles dans un même dossier    Personnes
                est-il autorisé ? Si oui, dans quels cas, 
                avec quels flags (insider) ?              

  **R33**       Délai post-mandat avant dé-PEPisation, et Personnes / PEP
                qui décide (Central File, RM, Compliance) 
                ?                                         

  **R37**       Périmètre exact du Central File : quels   Organisation
                contrôles qualité, quels documents,       
                quelle corroboration ?                    

  **R39**       Politique SLA : délais formels par type   Tâches / SLA
                de tâche, destinataires des               
                notifications, mécanismes d\'incitation ? 

  **R41**       Chaînes d\'escalade et de déblocage       Organisation
                d\'urgence : application manager,         
                managers de fonction, COO ; suppléances   
                prévues ?                                 

  **R42**       Fréquences du screening perpétuel         Screening
                (quotidien positions/transactions,        
                hebdomadaire PEP/sanctions, ou autres) ?  

  **R43**       Qui porte la LoD2 de confirmation des     Screening
                hits : MLRO ou autre rôle alloué ?        

  **R45**       Sévérité d\'application sur hit sanctions Screening / sanctions
                confirmé : suspension immédiate par       
                défaut, modalités du distressed asset     
                offboarding ?                             

  **R47**       La journalisation des accès en lecture    Audit trail
                est-elle exigée ?                         
  ------------- ----------------------------------------- ----------------------

11\. Statut du catalogue et contrat d\'implémentation

Le catalogue couvre désormais l\'intégralité du périmètre moteur : visa
4-yeux, cycle de vie du dossier, section et matrice documentaire,
personnes liées, tâches et rôles, screening AML, audit trail et
reporting. Les trois notes ouvertes de la version 1.0 (R14, R25, R29)
sont tranchées et intégrées au corps des règles.

*Ce document constitue le contrat d\'implémentation du moteur O-Live :
chaque scénario correspond à un test d\'acceptance automatisé à écrire
avant le code correspondant. Le moteur est réputé conforme lorsque 100 %
des scénarios passent en suite de tests. Toute nouvelle règle découverte
en exploitation est ajoutée au catalogue selon la même numérotation,
avec ses scénarios, avant implémentation.*
