# Catalogue O-Live — Patch v4.8 → v4.9 (RATIFICATION du 20.07.2026, matin)

**Décision : Ali Gharsallah ratifie, le 20.07.2026, les règles R140 → R143** (Bloc 25 ·
Portail transactionnel — prévenir, pas constater). Page de garde Word : v4.9.

| Bloc | Règles | Corpus | Verts |
|---|---|---|---|
| 25 · Portail transactionnel | **R140 R141 R142 R143** | TX-01..06 | 7/7 |

- **Scénarios catalogue** : 211 (v4.8) + TX 6 = **217 IDs**.
- **Corpus backend** : 231 + 7 = **238** — vérifié sur l'arbre réel le jour même.
- **Origine réglementaire, vérifiée à la source** : FATF 7e Targeted Update on Virtual Assets
  (juillet 2026 — blocage et gel AVANT le mouvement, comportement vs classification) ; FINMA
  Guidance 02/2026 du 09.04.2026 (le KYC doit nourrir la surveillance transactionnelle ;
  seuils fixes 100-200 kCHF = money mules → seuils PAR PROFIL).
- **La boucle R131 est fermée** : la garde `gel-mros` branche le vrai `MrosService` — le gel
  art. 10 a son appelant. La chaîne signal → cas → escalade → décision → gel → **blocage au
  portail** est prouvée de bout en bout (TX-01, rejouable en démo).
- **Fail-secure** : une garde en erreur SUSPEND — le portail n'échoue jamais vers le passage.
- **Paramètres R-Q** (au registre, discipline R125) : `txGardes` · `txRevueRoles`
  (["CO","MLRO"]) · `txRevueSlaHeures` (24) · `txComportement` (fenêtres/multiplicateurs par
  profil).
- Catalogue : **R1 → R143, aucune règle proposée.**
