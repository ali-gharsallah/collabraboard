# Catalogue O-Live — Patch v4.17 → v4.18 (RATIFICATION du 21.07.2026)

**Décision d'Ali Gharsallah, 21.07.2026 :** ratification des règles **R174 → R176**
(Bloc 36 · L'extraction comprend le document). Page de garde Word : v4.18.

| Bloc | Règles | Corpus | Verts |
|---|---|---|---|
| 36 · L'extraction comprend le document | **R174 R175 R176** | OC-01..06 | 6/6 |

- **Scénarios catalogue** : 264 (v4.17) + OC 6 = **270 IDs**.
- **Corpus backend** : 298 + 6 = **304** (harnais canon ET miroir, identiques).
- L'OCR devient un moteur qui COMPREND : gabarit d'extraction par type (versionné, gouverné
  par le chemin des paramètres — aucune clé nouvelle), champs candidats en dérivé signé
  gardant à vie leur version de gabarit (R174) ; authenticité en RAPPORT de contrôles —
  l'échec signale, ne bloque jamais, l'humain qualifie ; idempotence stricte, la voie du
  scalable (R175) ; digitalisation qui PROPOSE — acte humain d'acceptation par port de
  formulaire, provenance complète : l'audit remonte du formulaire au pixel (R176).
- Modèles : `OcrExtraction` (unique version+gabarit) · `OcrProposition` — RLS ×2.
- À suivre (lots dédiés) : écran de vérification OCR ; injection FormPort→KYC (déploiement) ;
  moteur industriel par port.
- Catalogue : **R1 → R176, aucune règle proposée · 36 blocs.**
