# Catalogue O-Live — Patch v4.9 → v4.10 (RATIFICATION du 20.07.2026)

**Décision : Ali Gharsallah ratifie, le 20.07.2026, les règles R144 → R147** (Bloc 26 ·
Le coffre — stockage gouverné). Page de garde Word : v4.10.

| Bloc | Règles | Corpus | Verts |
|---|---|---|---|
| 26 · Le coffre — stockage gouverné | **R144 R145 R146 R147** | CV-01..06 | 6/6 |

- **Scénarios catalogue** : 217 (v4.9) + CV 6 = **223 IDs**.
- **Corpus backend** : 238 + 6 = **244** — vérifié sur l'arbre réel le jour même.
- **Adaptateur de production LIVRÉ** : `s3-storage.adapter.ts` — Exoscale SOS (S3-compatible),
  résidence suisse (`ch-gva-2`), SSE, fail-fast sans credentials. Recette d'activation au
  RUNBOOK (lot Claude Code).
- **Paramètres R-Q** (au registre, discipline R125) : `storageRegion` (ch-gva-2) ·
  `storageChiffrement` (enveloppe par tenant).
- **Famille de scénarios** : CV — incident évité par la vérification systématique (ST- semblait
  libre au Word v4.0 mais PRISE par les stress tests du catalogue R1-R56).
- La GED est vraie de bout en bout : **ingestion (R137) → preuve (R109-R113) → coffre (R144) →
  destruction certifiée (R115/R146)** — plus aucune promesse sans acte.
- **Décisions UX du même jour, au registre des invariants** : DB-01 (Command Center clair) ·
  DB-02 (Branche de vie — cycle + timeline fusionnés en branche verticale).
- Catalogue : **R1 → R147, aucune règle proposée.**
