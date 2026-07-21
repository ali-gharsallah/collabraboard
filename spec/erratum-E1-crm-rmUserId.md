# Erratum E1 — 21.07.2026 · Nommage du RM dans le module CRM (R186)

**Nature : erratum de nommage, comportement STRICTEMENT inchangé.** Signalé par le poste
d'intégration (revue lot 40) : le corpus CR et `crm.service.ts` lisaient `client.rmId`
alors que le modèle `Client` canon porte `rmUserId` (`rm_user_id`) — `rmId` existe par
ailleurs sur `KycFile`. Arbitrage : le service s'aligne sur le modèle lu (`rmUserId`) ;
CR-01..05 re-exécutés 5/5 après correction. Fichiers touchés : `crm.service.ts`,
`crm.wiring.spec.ts` (+ reflet démo). Aucun changement de règle : R186 inchangée.

Au même lot de conformité (n° 41) : le modèle s'aligne sur les services ratifiés —
`DomainEvent.at` (horodatage écrit par tous les services), `DomainEvent.aggregateId`
sans contrainte UUID (codes métier prouvés par les corpus), `Document.expireAt`
(la date de validité qui active le geste R187 « pièce expirante », jusqu'ici dormant).
