# Catalogue O-Live — Patch v4.3 → v4.4 (RATIFICATION du 19.07.2026, nuit)

**Décision : Ali Gharsallah ratifie, le 19.07.2026, les règles R121 → R124** (Bloc 20 · Agent
de pré-revue IA). Ce patch **fold aussi l'erratum R119** (`APPROVED` → `VALIDATED`, décision B
du même jour). À reporter dans le Word (page de garde v4.4).

| Bloc | Règles | Corpus | Verts |
|---|---|---|---|
| 20 · Agent de pré-revue IA | **R121 R122 R123 R124** | AG-01..06 | 9/9 |

- **Scénarios catalogue** : 181 (v4.3) + AG 6 = **187 IDs**.
- **Corpus backend** : 193 + 9 = **202** — vérifié sur l'arbre réel le jour même.
- **Erratum R119 foldé** : le statut terminal favorable est `VALIDATED` (enum implémentée v0.2) ;
  la rédaction `APPROVED` (vocabulaire du doc MOD-01) est historique. Détecté au premier run
  réel — le corpus passait sur un faux ; réflexe acté : les états d'un faux inter-domaines se
  copient depuis l'enum du schéma.
- **Paramètres R-Q ajoutés** : `iaPrerevueTraitementRequis` (false) · `iaPseudonymise` (true).
- **Invariants** (avec leur pourquoi) : R121 l'IA n'écrit jamais sur le dossier (ligne rouge
  FINMA : sinon elle est dans le circuit de décision) · R122 rejouabilité (une IA non rejouable
  est indéfendable en inspection) · R124 le prompt est une règle (modifié en silence = règle
  modifiée en silence) ; la pseudonymisation par défaut protège le client ET la banque.
- Le catalogue ne compte **aucune règle proposée** : R1 → R124, toutes ratifiées.
