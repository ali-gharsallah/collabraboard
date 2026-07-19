"""Exécute les 7 suites avec le journal SQL injecté à la place de l'in-memory.
Preuve d'architecture hexagonale : ni le domaine ni les tests ne changent."""
import sys; sys.path.insert(0, ".")
from olive_engine import domain
from olive_engine.storage import SqlJournal
domain.EventJournal = lambda: SqlJournal(":memory:")   # injection globale

import pytest
from tests import (test_bloc1_visa as b1, test_bloc2_dossier as b2,
                   test_bloc3_matrice as b3, test_bloc4_personnes as b4,
                   test_bloc5_taches as b5, test_bloc6_screening as b6,
                   test_bloc7_audit as b7, test_persistance as tp,
                   test_bloc_concurrence as cc, test_tick_global as tk, test_snapshots as sn)
codes = [pytest.main(m) for m in (b1, b2, b3, b4, b5, b6, b7, tp, cc, tk, sn)]
print(f"### journal SQL : {sum(1 for c in codes if c == 0)}/{len(codes)} suites vertes ###")
sys.exit(max(codes))
