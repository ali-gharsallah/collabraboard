# Note E2 — 21.07.2026 · `Document.nom` est le champ canonique

Signalé par le poste d'intégration : `nomFichier` apparaît dans des DTO d'entrée
(`ingerer({ nomFichier })`) et dans des lectures tolérantes (`d.nomFichier ?? d.nom`),
mais le modèle `Document` porte `nom` — et l'ingestion écrit `nom: dto.nomFichier`.
**Arbitrage : `nom` est canonique** (le nommage s'aligne sur le modèle lu — même principe
que E1). `nomFichier` reste admis comme nom de paramètre de DTO d'entrée ; les lectures
tolérantes seront resserrées au fil des passages. Aucun changement de comportement.
