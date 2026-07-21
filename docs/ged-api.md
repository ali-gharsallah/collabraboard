# O-Live GED — API d'intégration (REST)

Base : `/api/v1/ged` · Auth : jeton (JWT) portant banque/utilisateur/rôle — **les droits
sont évalués aux services** (par type de document, au résultat) : deux jetons différents
reçoivent deux réponses différentes des MÊMES endpoints. Toute écriture est un événement
journalisé ; les actes sensibles exigent un motif.

| Méthode & chemin | Rôle | Corps / Query |
|---|---|---|
| `POST /documents` | Déposer (canal autorisé du registre) | `{ canal, clientId, nomFichier, contenuBase64 }` → id + empreinte |
| `POST /documents/:id/classement` | Classer (déclenche indexation + échéance de conservation) | `{ typeCode }` |
| `GET /documents?clientId=` | Lister (filtré aux droits) | — |
| `GET /documents/:id` | Fiche (métadonnées, versions, statut, gel) | — |
| `GET /documents/:id/contenu/:versionId` | Contenu — relecture vérifiée par empreinte | — |
| `GET /recherche?q=` | Recherche (résultats filtrés aux droits) | — |
| `GET /vues/:code` | Dossier-vue évalué à l'état vivant | — |
| `POST /documents/:id/gel` | Gel juridique | `{ motif }` (obligatoire) |

Erreurs : `403` (droit absent — l'existence même peut être masquée), `422` (motif
manquant / canal hors registre / type inconnu), `409` (état incompatible, ex. document
sous gel). Intégration entrante core banking : port dédié (lots signés lecture seule —
voir référence technique §6). Webhooks sortants (événements) : lot planifié.
