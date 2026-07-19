# Catalogue O-Live — Amendements RATIFIÉS (R89 → R99)

**Statut : RATIFIÉ.** Ratification : Ali Gharsallah, 2026-07-15. Rédigé le 15.07.2026.
Numérotation continue à partir de R88 (plus haute règle existante). Format conforme aux
amendements ratifiés du 12.07.2026. Texte prêt à intégrer au document normatif (v2.2).

---

## ⚠ Écart code ↔ catalogue — à régulariser

La méthode impose que toute règle découverte soit ajoutée au catalogue **avant** implémentation.
Cet ordre n'a pas été tenu sur deux blocs, construits sous instruction directe :

| Bloc | État du code | État du catalogue |
|---|---|---|
| **IAM (MOD-30)** — auth, MFA, RBAC, SSO, JWKS, admin users | implémenté, **47 tests verts** | **absent** (0 mention) |
| **Bacs à sable & comité de paramétrage** | 6 bacs + comité, implémentés et testés | **absent** |
| Attributs standard du référentiel | implémenté (actif/inactif, date d'effet, usage) | **couvert par S-09** (extension R29) ✔ |

Les règles ci-dessous formalisent l'existant. Elles sont écrites telles qu'elles auraient dû l'être avant
le code : chacune porte son scénario exécutable, et chacune est **déjà couverte par des tests verts** —
la référence du test est indiquée pour permettre la vérification immédiate.

---

# A. IAM — Identité & accès (MOD-30)

## R89 — Rôle non falsifiable
**Règle.** Le rôle porté par le jeton d'accès provient **exclusivement** du compte utilisateur en base.
Aucun paramètre fourni par l'appelant — corps de requête, en-tête, revendication d'un jeton tiers — ne peut
déterminer ou élever le rôle. L'échec d'authentification renvoie un message unique, sans révéler l'existence
du compte.

> **Scénario I-01 — Le rôle ne se réclame pas**
> **Étant donné** un utilisateur U1 dont le rôle en base est RM
> **Quand** U1 s'authentifie en demandant le rôle ADMIN
> **Alors** le jeton émis porte le rôle RM
> **Et** aucune vérification ultérieure ne consulte le rôle demandé
> **Étant donné** un email inconnu
> **Quand** une authentification est tentée
> **Alors** le refus est indiscernable d'un mot de passe erroné (message et durée)

*Couvert par : AU-02, AU-04, AU-06 (`auth.spec.ts`).*

## R90 — Second facteur & enrôlement prouvé
**Règle.** Si la MFA est activée pour un utilisateur, un code TOTP (RFC 6238) valide est exigé **en plus**
du mot de passe. L'enrôlement se fait en deux temps : génération du secret, puis **activation seulement
après un premier code valide** — un secret posé ne protège rien tant qu'il n'est pas prouvé côté client.
La réinitialisation est une action d'administration tracée.

> **Scénario I-02 — L'enrôlement ne s'auto-proclame pas**
> **Étant donné** un utilisateur sans MFA
> **Quand** l'enrôlement est démarré
> **Alors** un secret et une URI `otpauth://` sont produits
> **Et** la MFA reste **inactive**
> **Quand** un code invalide est présenté
> **Alors** l'activation est refusée et la MFA reste inactive
> **Quand** un code valide est présenté
> **Alors** la MFA devient active

> **Scénario I-03 — Le mot de passe seul ne suffit plus**
> **Étant donné** un utilisateur dont la MFA est active
> **Quand** il s'authentifie avec le bon mot de passe et sans code
> **Alors** l'accès est refusé

*Couvert par : MF-01..06, AU-07..09, TP-01..04 (vecteurs officiels RFC 6238).*

## R91 — Fédération d'identité : l'IdP est source de vérité
**Règle.** En SSO (OIDC ou SAML), l'émetteur et l'audience sont vérifiés, le jeton expiré est rejeté, et le
rôle O-Live est **dérivé des groupes de l'IdP à chaque connexion** — jamais figé au provisioning. Le compte
est créé à la volée (JIT) s'il n'existe pas. Le **mapping groupes → rôles** et le **rôle par défaut** sont des
paramètres tenants (R-Q) ; le défaut recommandé est *aucun rôle → accès refusé*.

> **Scénario I-04 — Le rôle suit l'annuaire**
> **Étant donné** un utilisateur fédéré dont le compte local porte le rôle RM
> **Et** un jeton IdP valide dont les groupes mappent vers CO_SR
> **Quand** il se connecte
> **Alors** le compte est resynchronisé sur CO_SR
> **Et** aucun compte en double n'est créé
> **Étant donné** un jeton dont aucun groupe n'est mappé et sans rôle par défaut
> **Quand** il se connecte
> **Alors** l'accès est refusé

*Couvert par : OI-01..06 (`oidc.spec.ts`).*

## R92 — Rotation des clés sans coupure
**Règle.** Les jetons sont signés par la clé **active** du trousseau, identifiée par son `kid`. Le vérificateur
résout la clé publique par `kid` : une rotation n'invalide **pas** les sessions en cours pendant la période de
grâce. Les clés publiques sont exposées au standard JWKS. Une clé purgée rend ses jetons invalides.

> **Scénario I-05 — Tourner sans casser**
> **Étant donné** un jeton signé avec la clé K1
> **Quand** le trousseau tourne vers K2
> **Alors** le jeton K1 reste vérifiable tant que K1 est en grâce
> **Et** les nouveaux jetons portent le kid K2
> **Quand** K1 est purgée du trousseau
> **Alors** le jeton K1 est rejeté

*Couvert par : KS-01..05, TM-01..07.*

---

# B. Paramétrage instruit — bacs à sable & comité

## R93 — Aucun score implicite
**Règle.** Toute valeur d'un référentiel entrant dans un calcul de risque porte un score **explicite**. Une
valeur sans score ne vaut pas « neutre » : elle est **signalée** comme non scorée, et le référentiel affiche
le décompte des valeurs concernées. Une valeur nouvelle apparue dans les données (activité, structure, pays)
est traitée comme non scorée jusqu'à décision.

> **Scénario B-01 — Le zéro doit être un choix**
> **Étant donné** un référentiel d'activités dont N valeurs n'ont pas de score
> **Quand** l'écran de paramétrage est ouvert
> **Alors** il affiche « N valeurs sans score → 0 implicite »
> **Et** chaque valeur non scorée est distinguée visuellement
> **Quand** un score est attribué à l'une d'elles
> **Alors** le décompte passe à N−1 et le changement est journalisé

*Motivation.* Découvert à l'exécution : 10 activités sensibles au sens GAFI (négoce d'art, crypto-actifs,
casinos, pierres précieuses, antiquités, yachts, aviation privée…) valaient **0** au moteur de score, faute
d'entrée au référentiel.

## R94 — Paramétrage instruit : dry-run obligatoire
**Règle.** Tout changement de paramètre affectant le risque, la charge ou l'aiguillage doit pouvoir être
**simulé sans écriture**, sur les données réelles, avec un **impact nominatif** : non seulement les volumes
avant/après, mais l'identité des dossiers ou clients qui entrent et sortent. La simulation ne crée ni tâche,
ni alerte, ni case (R70).

> **Scénario B-02 — Voir avant d'écrire**
> **Étant donné** un scénario AML paramétré avec un seuil par groupe
> **Quand** un seuil simulé est modifié
> **Alors** le système affiche les alertes avant, après, les nouvelles et les disparues
> **Et** chaque alerte nouvelle est nommée (client, valeur, seuil franchi)
> **Et** aucune écriture n'est effectuée
> **Quand** l'utilisateur applique
> **Alors** le changement est écrit avec sa date de mise en vigueur (R29) et journalisé

*Couvert par : bacs à sable AML, KYC, BRM, Onboarding, Central File, Workflow.*

## R95 — Robustesse du réglage (stress test)
**Règle.** Le système présente la **courbe de réponse** autour du réglage simulé (balayage du paramètre) et
signale une **discontinuité disproportionnée** — une hausse au moins double du saut médian. Une croissance
régulière n'est pas une discontinuité : c'est un coût linéaire assumé. Le système **signale, il ne bloque pas** (R39).

> **Scénario B-03 — La falaise se voit avant la chute**
> **Étant donné** un paramètre simulé
> **Quand** le système balaie ce paramètre autour de la valeur choisie
> **Alors** il affiche la métrique obtenue à chaque cran
> **Et** si un cran produit une hausse au moins double du saut médian, il le signale comme point de rupture
> **Et** si la réponse est régulière, il l'indique comme progressive
> **Et** dans les deux cas l'utilisateur peut appliquer

*Motivation.* Une première heuristique signalait une « falaise » sur une droite. Corrigée et rejouée sur six
courbes types (linéaire, falaise, explosion, plate, décroissante, bruitée).

## R96 — Séparation de la proposition et de l'arbitrage
**Règle.** Les bacs à sable **proposent** ; l'owner de l'application **arbitre**. Une recommandation porte son
auteur nommé, sa source, sa date de mise en vigueur demandée et son **impact mesuré**. L'acceptation applique
le changement et le journalise. Le **refus exige un motif** (R7) ; un refus sans motif est bloqué. Le refus
motivé a la même valeur probante que l'acceptation : il prouve que la question a été posée et arbitrée.

> **Scénario B-04 — Proposer n'est pas appliquer**
> **Étant donné** un réglage simulé par un métier
> **Quand** il est soumis au comité
> **Alors** aucune écriture n'a lieu
> **Et** la recommandation porte auteur, source, date d'effet et impacts mesurés
> **Quand** l'owner refuse sans motif
> **Alors** le refus est bloqué avec le motif « R7 : un refus exige un motif »
> **Quand** l'owner refuse avec motif
> **Alors** le refus et son motif sont journalisés
> **Quand** l'owner accepte
> **Alors** le changement est appliqué et journalisé avec l'impact annoncé

## R97 — Cumul des changements
**Règle.** Le comité présente l'**effet combiné** des recommandations retenues, et non seulement leur effet
individuel. Une tension globale est calculée à partir des impacts qui coûtent réellement (dossiers passant en
diligence renforcée, réponses à collecter, alertes nouvelles). Au-delà d'un seuil, le système **conseille
d'étaler les dates de mise en vigueur** — il ne bloque pas (R39).

> **Scénario B-05 — Dix réglages raisonnables font une crise**
> **Étant donné** plusieurs recommandations en attente, chacune d'impact modéré
> **Quand** l'owner en retient plusieurs
> **Alors** le système additionne leurs impacts par nature
> **Et** affiche une tension combinée (maîtrisée / élevée / critique)
> **Et** au-delà du seuil élevé, conseille l'étalement des dates d'effet
> **Et** n'empêche aucune acceptation

## R98 — Conflit porteur / contrôleur
**Règle.** Un gestionnaire qui porte un portefeuille client **et** détient un rôle de contrôle (validation
finale, visa de risque) est signalé comme conflit structurel : il ne pourra pas viser ses propres dossiers
(R13/R52). Le référentiel expose ce conflit ; l'arbitrage — réattribuer le portefeuille ou nommer un
validateur tiers (R2) — revient à la banque.

> **Scénario B-06 — Le contrôleur qui vend**
> **Étant donné** un gestionnaire détenant un rôle de contrôle et portant N clients
> **Quand** le référentiel des gestionnaires est ouvert
> **Alors** le conflit est signalé avec le rôle en cause et le nombre de clients
> **Et** le message rappelle qu'il ne pourra pas viser ses propres dossiers

*Motivation.* Découvert à l'exécution : deux gestionnaires portaient un portefeuille avec un rôle de contrôle
(Head of Private Banking, Business Risk Manager).

## R99 — Relais réel (extension R4)
**Règle.** Le suppléant d'un validateur doit **différer** du validateur lui-même. Un suppléant identique au
validateur est un **relais fictif** : en cas d'absence, il n'existe aucun relais, et le dossier attend ou passe
par une dérogation tracée. Le système signale les relais fictifs ; il ne les interdit pas (R39).

> **Scénario B-07 — Un relais qui n'en est pas un**
> **Étant donné** une section dont le validateur et le suppléant sont le même rôle
> **Quand** la chaîne de visas est affichée
> **Alors** le relais fictif est signalé
> **Et** le compteur de relais fictifs est incrémenté

---

## État de conformité — à ratifier

| Règle | Implémentée | Tests verts | Explainer |
|---|---|---|---|
| R89 rôle non falsifiable | backend | AU-02/04/06 | IAM — Sécurité & accès |
| R90 MFA & enrôlement prouvé | backend | MF-01..06, TP-01..04, AU-07..09 | IAM |
| R91 fédération / IdP source de vérité | backend | OI-01..06 | IAM · SSO (écran param.) |
| R92 rotation sans coupure | backend | KS-01..05, TM-01..07 | IAM |
| R93 aucun score implicite | démo | vérifié à l'exécution (10 activités GAFI à 0) | CPSI · ④ Matières premières |
| R94 dry-run obligatoire | démo (6 bacs à sable) | vérifié à l'exécution | ⚖ Bacs à sable & comité |
| R95 stress test & falaise | démo | rejoué sur 6 courbes types | ⚖ Bacs à sable & comité |
| R96 proposition / arbitrage | démo (comité) | vérifié : refus sans motif bloqué | ⚖ Bacs à sable & comité |
| R97 cumul | démo (comité) | vérifié | ⚖ Bacs à sable & comité |
| R98 conflit porteur / contrôleur | démo (référentiel RM) | vérifié : 2 cas réels détectés | — |
| R99 relais réel | démo (bac à sable Workflow) | vérifié | — |

**Décision rendue.** RATIFIÉ le 15.07.2026 par Ali Gharsallah — sans amendement. R89 → R99 rejoignent le
document normatif ; leurs scénarios I-01..I-05 et B-01..B-07 rejoignent le corpus exécutable.

**Note de méthode.** L'ordre normal — catalogue puis code — n'a pas été respecté sur ces deux blocs. Le
présent document rétablit la traçabilité mais ne corrige pas la séquence : les règles ci-dessus décrivent ce
qui existe, ce qui est une position moins confortable que de décrire ce qui doit exister.
