# Découverte hors périmètre (V2-M61) — des 500 là où un refus typé est dû

Constat du `verifier-actes-api.mjs` pendant le lot V2-M61 (screening avancé), sur l'API
vivante semée GWB. **Aucun de ces défauts n'appartient au périmètre du lot** (le lot ne
touche que screening/Surveillance) — consignés ici, pas corrigés (discipline : un prompt,
un périmètre).

## Le fait

Quand le vérificateur pose un acte avec un objet INVENTÉ (client/mandat inexistant),
plusieurs routes répondent **500 Internal server error** (erreur Prisma nue dans la
transaction) au lieu d'un refus TYPÉ (404/400 motivé) :

- `POST /v1/islamic/zakat` — 500 sur client inexistant (avec un client réel : 201, vérifié
  au même moment — le calcul lui-même est sain) ;
- `POST /v1/islamic/mudaraba` — même famille ;
- `POST /v1/islamic/sukuk/maturite` — même famille ;
- `POST /v1/pms/mandats` — même famille (la stack montre `pms.service.js:122`, création
  dans la transaction sans garde d'existence préalable) ;
- `POST /v1/islamic/evaluer` — 404 « clientId requis » : le CODE HTTP est discutable
  (un champ requis manquant est un 400), le message, lui, est typé ;
- `GET /v1/cpsi/clients/:id/score` — 404 dont le message est l'ID BRUT
  (`'c16609f5-…'`) : réponse honnête mais illisible — un message nommé serait dû
  (pattern R169 : refus motivé, jamais crypté).

## Pourquoi c'est un vrai sujet (et pas du polissage)

Le pattern maison est constant : « message non parsable = refus TYPÉ (jamais deviné,
pattern R169) ». Un 500 sur objet inexistant est indiscernable d'une panne — un écran qui
le reçoit affiche « erreur interne » là où le moteur SAIT que l'objet n'existe pas. Même
famille que le refus franc FE-04 : la garde doit parler.

## Ce que ça n'est pas

Pas une régression du lot : ces routes datent de V2-M56/M59 et le comportement avec des
objets RÉELS est correct (vérifié au passage). Le golden path démo n'est pas affecté.

À reprendre dans un lot dédié « refus typés sur objets absents » (islamic + pms + cpsi).
