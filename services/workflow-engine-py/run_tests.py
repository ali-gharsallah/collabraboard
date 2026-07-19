import sys; sys.path.insert(0, ".")
import pytest
from tests import (test_bloc1_visa as b1, test_bloc2_dossier as b2,
                   test_bloc3_matrice as b3, test_bloc4_personnes as b4,
                   test_bloc5_taches as b5, test_bloc6_screening as b6,
                   test_bloc7_audit as b7, test_shadow as sh, test_replay as rp, test_cross as xc, test_proprietes as pr,
                   test_bloc_concurrence as cc, test_config_tenant as ct, test_bloc8_tenant as b8, test_bloc9_r57_r62 as b9, test_bloc10_r58_r61 as b10,
                   test_tick_global as tk, test_snapshots as sn, test_ui_api as ui)
codes = []
for titre, mod in [("BLOC 1 — Visa 4-yeux (V-01..V-17)", b1),
                   ("BLOC 2 — Cycle de vie du dossier (D-01..D-09)", b2),
                   ("BLOC 3 — Section & matrice (S-01..S-10)", b3),
                   ("BLOC 4 — Personnes liées (P-01..P-08)", b4),
                   ("BLOC 5 — Tâches & rôles (T-01..T-07)", b5),
                   ("BLOC 6 — Screening AML (A-01..A-07)", b6),
                   ("BLOC 7 — Audit trail (X-01..X-05)", b7),
                   ("BLOC 8 — R56 règles tenant (RT-01..RT-08)", b8),
                   ("BLOC 9 — R57 récusation & R62 export scellé (RC-01..05 · EX-01..04)", b9),
                   ("BLOC 10 — R58 habilitation · R59 double visa · R60 fraîcheur · R61 anti-goulot", b10),
                   ("PARALLEL RUN — ShadowRunner (SH-01..SH-06)", sh),
                   ("CORPUS DE REJEU — capture/replay (RP-01..RP-04)", rp),
                   ("CROISEMENT BI-MOTEUR — JS ⇄ Python (XC-01..XC-03)", xc),
                   ("PROPRIÉTÉS — invariants sous séquences aléatoires (PR-00..PR-05)", pr),
                   ("R53 — Concurrence optimiste (C-01..C-05)", cc),
                   ("CONFIG TENANT versionnée S-09 (CT-01..CT-05)", ct),
                   ("R54 — Déclencheur du temps (K-01..K-05)", tk),
                   ("R55 — Snapshots de reprise (SN-01..SN-05)", sn),
                   ("UI — API du serveur pilote (UI-01..UI-06)", ui)]:
    print(f"=== {titre} ===")
    codes.append(pytest.main(mod))
    print()
total = sum(1 for c in codes if c == 0)
print(f"### {total}/{len(codes)} suites vertes ###")
sys.exit(max(codes))
