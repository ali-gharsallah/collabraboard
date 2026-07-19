# Catalogue O-Live — Erratum & note de version **v4.0 → v4.1**

**Statut : PROPOSÉ** — en attente de ratification (Ali Gharsallah).
Rédigé le 19.07.2026. Ne crée aucune règle nouvelle : consolide un scénario **déjà ratifié**,
rebase le comptage et enterre un chiffre fantôme. Famille touchée : **SC**.

> Portée : ce document est un **erratum de version** du normatif
> `spec/OLive-Specifications-Moteur-Workflow-v4.0.docx`. Il se fold au prochain re-cut du Word.
> Aucune sémantique de règle n'est modifiée — on aligne le papier sur l'exécutable déjà vert.

---

## 1. Objet — trois corrections

1. **Intégrer SC-04** dans le bloc Screening de v4.0 (le Word en est resté à `SC-01..03`).
2. **Rebaser le comptage** des scénarios sur des chiffres énumérés et vérifiés — et **retirer « 68 »**.
3. **Acter la nomenclature à deux couches** (scénarios catalogue vs tests backend), pour que le
   décompte normatif ne soit plus gonflé par des IDs de test.

---

## 2. SC-04 — intégration (écart de chronologie, pas de fond)

**Cause de l'écart.** Le Word v4.0 est daté du **14.07.2026**. Les règles screening **R100→R103**
ont été **ratifiées le 15.07.2026** (`catalogue-amendements-R100-R103-ratifies.md`) — soit *le
lendemain*. v4.0 a donc figé `SC-01, SC-02, SC-03` et **manqué `SC-04`** (R103, preuve de fraîcheur),
alors que la règle, le scénario et le code (`apps/api/src/modules/screening/`, 4/4 verts) existent et
sont ratifiés. Ce n'est pas une divergence de fond : c'est un train de retard d'une journée.

**Correctif.** Ajouter au bloc Screening de v4.0 le scénario suivant, **repris verbatim** de la source
ratifiée du 15.07 (aucune reformulation autorisée — le texte fait foi) :

> **Scénario SC-04 — L'absence de hit doit se prouver**
> **Étant donné** une liste en version V et un portefeuille de N clients
> **Quand** le screening s'exécute et ne produit aucun hit
> **Alors** une trace de passage est enregistrée : périmètre, version de liste, horodatage, seuil,
>   réglage du pré-filtre
> **Et** cette trace est rejouable à date (R49)
> **Quand** l'inspecteur demande « cette inscription a-t-elle été confrontée à votre base, et quand ? »
> **Alors** la réponse est lisible sans reconstruction

Règle de rattachement : **R103** — preuve de fraîcheur. Test exécutable de référence : `SC-04`
(`screening/` — 4/4 verts). Invariants mobilisés : événement tracé, rejeu à date (R48/R49), aucune
coercition (R39).

---

## 3. Rebasage du comptage — le « 68 » enterré

Le comptage n'a de sens que **scopé**. Chiffres énumérés, pas annoncés :

| Nombre | Ce que c'est | Verdict |
|---|---|---|
| **68** | Chiffre du **préambule projet**. Jamais énuméré (ADR-14, §Écart de comptage). | **Retiré.** Nombre annoncé, sans catalogue en regard. |
| **61** | Catalogue **v2** : `17 V + 9 D + 8 S + 8 P + 7 T + 7 A + 5 X`. | Obsolète (avant amendements du 12.07). |
| **64** | Moteur de référence, **IDs primaires** = 61 + S-09 + S-10 + V-18. | Correct, mais S-10b non comptée. |
| **65** | **Core moteur v2.1**, S-10b comptée. | **Certifié** : le Word v2.1 contient exactement 65 IDs ; la suite Python a 65 fonctions ; mêmes IDs — égalité papier = exécutable prouvée dans les deux sens. |
| **150 → 151** | **Catalogue complet v4.0**, 33 familles (150 IDs, dont `SC-01..03`). Après fold de SC-04 : **151**. | **Couverture certifiée** : 150/150 IDs v4.0 ont un exécutable de même ID (audit du 19.07, §3bis). 0 orpheline. Avec SC-04 → 151/151. |

**Harmonisation d'ADR-14.** ADR-14 oscille en interne entre « 65 scénarios » (table de contexte) et
« 64 » (§Écart). Les deux sont vrais sous des conventions différentes : **64 = IDs primaires**,
**65 = avec la variante S-10b**. v4.1 fixe la convention : **on compte S-10b** → le core normatif
est **65**. ADR-14 est mis à jour en conséquence.

**Chiffres normatifs v4.1 :**
- **Core moteur workflow (V/D/S/P/T/A/X)** : **65** — certifié, papier = exécutable.
- **Catalogue complet v4.1** : **151 IDs** sur 33 familles — **couverture certifiée** (audit du
  19.07, §3bis). Ni annoncé, ni extrapolé : chaque ID a un exécutable.

---

## 3bis. Certification de couverture (audit du 19.07.2026)

Croisement des **150 IDs déclarés au Word v4.0** contre **tous** les tests du dépôt, sur trois couches
exécutables (comparaison normalisée, insensible au tiret : `C-02` du papier = `test_C02` du code).

| Résultat | Valeur |
|---|---|
| IDs v4.0 déclarés | 150 |
| IDs avec ≥1 exécutable de même ID | **150** |
| **Orphelins réels** | **0** |
| Après fold de SC-04 | **151 / 151** |

**Les 3 couches** (une même famille peut vivre dans plusieurs — nomenclature à deux niveaux, §4) :
- `services/workflow-engine-py/` — moteur de référence : `V/D/S/P/T/A/X`, gouvernance `RT/RC/EX`,
  concurrence/temps/reprise `C/K/SN`, bloc R58-R61 `H/DV/F/G`, méta `SH/RP/XC/PR/UI/CT`. **145 tests.**
- `services/cpsi-server-py/` — profilage & paramétrage : `IN/PS/GP/ST/SG/PT/BG/IA/BD/TR/PM/PD` +
  `SC/RC/RP/CK/HM/VQ/…`. **97 tests.** *(C'est cette couche qui couvre les familles qu'un scan partiel
  du seul moteur aurait crues orphelines.)*
- `apps/api/` — backend NestJS : `FE/SV/NV`, `CK/LK/HM/HF/VQ`, IAM `AU/TP/RG/OI/KS/MF/AD/TM`,
  `I/B`, `SC` + e2e. **~128 tests.**

**Portée exacte de la certification.** Ceci certifie la **couverture nominale** (chaque scénario du
catalogue a un test du même ID) et **enterre définitivement le « 151 annoncé »**. Ce n'est PAS une
certification de vert-en-un-run (non exécutable ici : `node_modules` absent, réseau coupé) ni une
preuve que chaque assertion encode fidèlement son Gherkin — cela relève de la CI et de la matrice §2-5,
qui exécute déjà `workflow-engine-py`. **Reste à faire pour un vert-en-un-run complet** : brancher
`test:rules` (103) et `cpsi-server-py` (97) à la CI, et ajouter `prisma:post` avant les e2e (aujourd'hui
la CI lance le moteur de référence + les e2e, mais pas ces ~200 tests-là).

---

## 4. Nomenclature — deux couches, un seul système normatif

Il coexiste **deux systèmes d'ID** ; ils ne s'additionnent pas.

1. **Scénarios de comportement** (le normatif, agnostique d'implémentation) :
   `V / D / S / P / T / A / X` + gouvernance (`RT / RC / EX`) + concurrence/temps/reprise (`C / K / SN`).
2. **Tests de conformité backend** (couche implémentation NestJS, matrice §2-3) :
   `FE / SV / NV` (miroirs de règles moteur), `CK / LK / HM / HF / VQ` (R84-R86),
   `AU / TP / RG / OI / KS / MF / AD / TM` (IAM), `I / B` (IAM/démo), `SC` (screening).

**Règle v4.1 :** seul le système (1) compte comme **scénario normatif**. Les IDs backend (2) sont une
**couche de preuve** : chaque test cite `(règle Rxx, scénario catalogue)` qu'il prouve. Le décompte de
scénarios n'inclut donc **jamais** les IDs de test — sinon on gonfle artificiellement.

**Crosswalk de référence** (à porter en colonne de la matrice de traçabilité) :

| Règle | Scénario(s) catalogue | Tests backend | e2e |
|---|---|---|---|
| R13 | V-02, V-03 | FE-01..06, SV-R13 | « R13 » |
| R52 | V-18 | FE-04, VAL-R52 | « R52 » |
| R2/R4 | V-04, V-05 | NV-01..06, SV-R2 | « R2 » |
| R84 | *(règle tardive, hors V-)* | CK-01..05, LK-01..06 | « R84 » |
| R85 | *(hors V-)* | HM-01..06, HF-01..06 | « R85 » |
| R86 | *(hors V-)* | VQ-01..06, SV-R86 | « R86 » |
| R100-R103 | SC-01..**04** | SC-01..04 | — |

v4.0 avait commencé à importer `CK / HM / VQ / SC` dans le papier mais pas `FE / SV / NV / LK / HF`.
v4.1 tranche : ces familles restent **couche test** ; le papier ne les liste pas comme scénarios,
il les référence via le crosswalk.

---

## 5. Conséquences documentaires (au re-cut du Word v4.1)

1. Bloc Screening : **ajouter SC-04** (texte §2 ci-dessus).
2. Ligne de comptage : remplacer toute occurrence de **« 68 scénarios »** par
   **« 65 scénarios core (moteur, certifié) · 151 IDs catalogue complet (couverture certifiée) »**.
3. Ajouter une **note de version v4.1** en tête, renvoyant à ce document.
4. Aligner **ADR-14** : convention S-10b comptée → core = 65 ; supprimer l'ambiguïté 64/65.
5. Inscrire la **certification de couverture** (§3bis) : 151/151, 0 orpheline, 3 couches exécutables.
   Ajouter le **gap CI** identifié : `test:rules` (103) et `cpsi-server-py` (97) ne sont pas branchés à
   la CI, et `prisma:post` ne tourne pas avant les e2e — à corriger pour un vert-en-un-run de bout en bout.

---

## 6. Décision

**PROPOSÉ le 19.07.2026.** À ratifier par Ali Gharsallah. Une fois ratifié :
SC-04 rejoint formellement v4.0 ; le comptage normatif devient **65 (core) / 151 (complet)** ;
le « 68 » est retiré du préambule et de tout document dérivé.

`RATIFIÉ le __________ par __________________`
