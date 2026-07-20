# Catalogue O-Live — Patch v4.7 → v4.8 (RATIFICATION du 20.07.2026)

**Décision : Ali Gharsallah ratifie, le 20.07.2026, les règles R137 → R139** (Bloc 24 ·
Capture & ingestion GED). Page de garde Word : v4.8.

| Bloc | Règles | Corpus | Verts |
|---|---|---|---|
| 24 · Capture & ingestion GED | **R137 R138 R139** | IG-01..06 | 7/7 |

- **Scénarios catalogue** : 205 (v4.7) + IG 6 = **211 IDs**.
- **Corpus backend** : 224 + 7 = **231** — vérifié sur l'arbre réel le jour même.
- **Paramètres R-Q** (au registre, discipline R125) : `gedCanauxIngestion`
  (["SCAN","EMAIL","UPLOAD","API"]) · `gedInboxRoles` (["CO","CF"]) · `gedInboxSlaJours` (2).
- **Origine produit** : analyse d'écart Therefore — manque n° 1 (capture) comblé avec les
  invariants maison : l'origine est une pièce du dossier (R137), l'OCR est un dérivé versionné
  jamais l'original (R138), la quarantaine se classe par un humain doublement habilité (R139).
- **Écart signalé** (chantier dédié) : modèle `Document` du schéma repo = historique v0.2, à
  aligner sur le contrat GED R109→R116.
- Catalogue : **R1 → R139, aucune règle proposée.**
