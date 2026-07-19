# -*- coding: utf-8 -*-
"""CPSI bloc 8 — nouveaux domaines de la bibliothèque : cash & espèces, capital markets / CIB.
CASH-01..02 · CIB-01..02. (application R73 — extension bibliothèque, pas de nouvelle règle)."""
import pytest
from datetime import datetime, timedelta
from olive_cpsi.engine import OliveCpsiEngine, CpsiError

T0 = datetime(2026, 1, 1)
def t(d=0): return T0 + timedelta(days=d)
BAS = {"pays_risque": 0, "structure_risque": 1, "pep": False, "secteur_risque": 0}

@pytest.fixture
def eng():
    e = OliveCpsiEngine()
    e.enregistrer_client("C-CASH", BAS, T0, attributs={"aum_band": "Mass Affluent",
        "cash_deposits": 9, "cash_withdrawals": 7})
    e.enregistrer_client("C-PE", BAS, T0, attributs={"secteur": "Private equity",
        "capital_calls": 8, "private_placements": 5})
    e.enregistrer_client("C-CLEAN", BAS, T0, attributs={"aum_band": "Mass Affluent",
        "cash_deposits": 1, "capital_calls": 0})
    e.definir_groupe("G-MASS", "Mass Affluent", {"logique": "ET",
        "conditions": [{"champ": "aum_band", "op": "eq", "val": "Mass Affluent"}]}, T0)
    e.definir_groupe("G-PE", "Private equity", {"logique": "ET",
        "conditions": [{"champ": "secteur", "op": "eq", "val": "Private equity"}]}, T0)
    return e

# --- CASH-01 : dépôts espèces importants, ciblé Mass Affluent (placement) (R73)
def test_CASH01_depots(eng):
    eng.definir_scenario_aml("SCN-CASHDEP", "Dépôts espèces importants", "cash_deposits",
                             {"G-MASS": 5}, t(1))
    r = eng.evaluer_scenario("SCN-CASHDEP", t(1))
    assert set(h["client"] for h in r["hits"]) == {"C-CASH"}   # C-CLEAN (1) sous le seuil

# --- CASH-02 : retraits espèces (intégration), seuil propre
def test_CASH02_retraits(eng):
    eng.definir_scenario_aml("SCN-CASHWD", "Retraits espèces", "cash_withdrawals",
                             {"G-MASS": 5}, t(1))
    r = eng.evaluer_scenario("SCN-CASHWD", t(1))
    assert set(h["client"] for h in r["hits"]) == {"C-CASH"}

# --- CIB-01 : appels de capitaux PE/VC atypiques (capital markets / CIB) (R73)
def test_CIB01_capital_calls(eng):
    eng.definir_scenario_aml("SCN-CAPCALL", "Appels de capitaux atypiques", "capital_calls",
                             {"G-PE": 5}, t(1))
    r = eng.evaluer_scenario("SCN-CAPCALL", t(1))
    assert set(h["client"] for h in r["hits"]) == {"C-PE"} and r["evalues"] == 1

# --- CIB-02 : placements privés non cotés, génèrent une case (R76)
def test_CIB02_private_placements_case(eng):
    eng.definir_scenario_aml("SCN-PRIVPLACE", "Placements privés non cotés", "private_placements",
                             {"G-PE": 3}, t(1))
    cases = eng.generer_cases(t(1), scenarios=["SCN-PRIVPLACE"])
    assert len(cases) == 1 and cases[0]["client"] == "C-PE"
