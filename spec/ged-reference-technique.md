# O-Live GED — Référence technique
*Le document de vérité : ce qui existe, où, et ce qui reste. États : ✅ opérationnel & testé · 🔶 câblé, activation infra requise · 🔜 lot planifié.*

## 1. Stockage des documents
✅ **Architecture coffre** (`modules/coffre/coffre.service.ts`) : le contenu ne vit JAMAIS en
base — il vit au coffre objet, par un **port de stockage** (`StoragePort` : ecrire/lire/
supprimer/lister). Clé préfixée par banque (`{tenant}/{documentId}/{versionId}`), écriture
suivie d'une **relecture qui re-vérifie l'empreinte**, réconciliation périodique qui MESURE
la dérive coffre↔index (écart = fait d'audit, jamais silencieux).
🔶 **Adaptateur de production** (`coffre/s3-storage.adapter.ts`) : Exoscale SOS (S3
suisse, ch-gva-2), code de production écrit et revu — activation = 3 variables
d'environnement (RUNBOOK §Coffre). Sans configuration : refus explicite, pas de dépôt fantôme.
**Écran** : Paramétrage → GED — Paramètres → « Stockage » (lecture : région, chiffrement —
réglés au contrat).

## 2. Capacité
✅ Le coffre objet est **élastique par nature** (S3 : capacité non plafonnée, coût au Go).
🔜 **Lot Quotas & télémétrie** : volumétrie par banque/type au tableau de bord, seuils
d'alerte (qui signalent sans bloquer), facturation au stockage.

## 3. Base de données — tables
✅ 12 modèles Prisma dédiés, RLS PostgreSQL par banque sur chacun :
`Document` (identité, type, client, statut, legalHold, retentionUntil) ·
`DocumentVersion` (empreinte SHA-256, cléCoffre, taille) · `AnchorBatch` (ancrage
Merkle + horodatage qualifié) · `GedIngestEntry` (journal d'arrivée) · `SearchEntry`
(index dérivé) · `Annotation` · `CaviardageDerive` · `IaProduction` · `GedVue` ·
`TenantParamChange` (réglages, vérité append-only) · + `DomainEvent` / `AuditLog`
(chaîne HMAC, trigger d'immuabilité SQL).

## 4. Chiffrement
✅ En transit : TLS. Au repos : chiffrement du coffre avec **référence de clé par banque**
(`chiffrementRef` porté à chaque écriture) ; intégrité prouvée par empreinte à la naissance
+ ancrage horodaté ; journal d'audit chaîné HMAC, non modifiable (trigger SQL).
🔶 KMS/HSM dédié par banque : à l'activation Exoscale (clé gérée, rotation).

## 5. Métadonnées
✅ Par document : type (plan de classement), client, dates (arrivée/classement/échéance),
statut du cycle, gel juridique, auteurcanal. Par version : empreinte, taille, clé coffre,
moteur d'extraction. Par acte : auteur, motif, horodatage — tout événement, rien d'implicite.

## 6. API — relier la GED à un autre système
✅ **Surface REST** (`modules/ged/ged.controller.ts`, doc `docs/ged-api.md`) : ingestion,
classement, consultation, contenu, recherche, vues, gel/retrait — mêmes gardes que l'écran
(les droits vivent aux services, l'API n'est qu'une porte). Auth : contexte banque/
utilisateur/rôle (JWT en production).
✅ **Entrée depuis le core banking** : port déclaré, lots signés en lecture seule,
inconnu en quarantaine (`modules/corebanking/`).

## 7. La banque a déjà sa GED — coexistence
🔜 **Lot « GED externe est un port »** (même doctrine que le core banking) : un
`DocumentSourcePort` déclaré (SharePoint/FileNet/Docuware/GED maison), synchronisation
signée en lecture seule, mapping des types versionné, inconnu en quarantaine — O-Live
apporte alors la **couche de preuve et de gouvernance** au-dessus du dépôt existant, sans
migration forcée. Design prêt (pattern éprouvé deux fois), chiffrage : 1 lot.

## 8. Cycle de vie d'un document
✅ Neuf étages, chacun testé : Arrivée (canaux du registre, journal, délai qui signale) →
Preuve (empreinte à la naissance, ancrage horodaté) → Extraction (dérivé, original intact) →
Classement (doublement habilité, déclenche l'indexation, pose l'échéance de conservation) →
Coffre → Consultation (filtrée au résultat) → Dossiers-vues (requêtes, jamais des copies) →
Annotations/caviardage (calques et dérivés chaînés) → Sortie & oubli (divulgation prouvée,
destruction certifiée dont la trace survit). Gel juridique à tout moment.
**Écran** : GED → onglet Workflow.

## 9. Restauration
✅ **Par construction** : contenu immuable au coffre (versions, jamais d'écrasement),
relecture vérifiée par empreinte, état reconstructible par rejeu des événements
(append-only), réconciliation qui détecte toute dérive.
🔶 Sauvegarde croisée du coffre (réplication multi-zone Exoscale) : option d'activation.
🔜 **Lot PITR** : restauration base à l'instant T (WAL archiving) + procédure d'exercice
de restauration annuelle (exigence bancaire) au RUNBOOK.

## 10. Volumétrie — des millions de documents
✅ Prêt par conception : contenu hors base (la base ne porte que métadonnées et index),
append-only (pas de contention d'update), index dérivés séparés du contenu, RLS par banque.
🔜 **Lot Échelle** : recherche `contains` → index plein-texte PostgreSQL (tsvector),
partitionnement des tables d'événements par mois, banc de charge reproductible à 1M+
documents (script + chiffres au dossier de vente).

## 11. Contrats de banque
🔜 **Annexe technique contractuelle** (à rédiger sur cette référence) : SLA (disponibilité,
RTO/RPO), résidence des données, réversibilité (export intégral : contenus + métadonnées +
journaux), audit annuel, sous-traitants (Exoscale), suppression en fin de contrat.

## 12. Où tout se voit
Écrans : GED (Vivante · Workflow · Connexions · Puissance · **Fonctionnalités** · Documents ·
Plan · API) · Paramétrage → GED — Paramètres (gouvernance réelle) · Tâches (signaux).
Vérité d'ingénierie : ce document + la spécification + 298 tests automatiques exécutés à
chaque build.
