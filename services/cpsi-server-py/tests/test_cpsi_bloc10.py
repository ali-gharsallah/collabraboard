# -*- coding: utf-8 -*-
"""CPSI bloc 10 — référentiel : alertes générées PAR scénario. REF-01..02.
Une ligne par scénario, avec total et ventilation HIGH/MEDIUM ; cohérent avec generer_cases."""
import pytest
from datetime import datetime, timedelta
from olive_cpsi.engine import OliveCpsiEngine

T0 = datetime(2026, 1, 1)
def t(d=0): return T0 + timedelta(days=d)
BAS = {"pays_risque": 0, "structure_risque": 1, "pep": False, "secteur_risque": 0}

@pytest.fixture
def eng():
    e = OliveCpsiEngine()
    for i, v in enumerate([90, 60, 55, 20]):
        e.enregistrer_client(f"C{i}", BAS, T0, attributs={"aum_band": "HNWI", "tx_par_mois": v, "ratio_cash": 0.1*i})
    e.definir_groupe("G-HNWI", "HNWI", {"logique": "ET",
        "conditions": [{"champ": "aum_band", "op": "eq", "val": "HNWI"}]}, T0)
    e.definir_scenario_aml("SCN-VELO", "Vélocité", "tx_par_mois", {"G-HNWI": 50}, t(1))
    e.definir_scenario_aml("SCN-CASH", "Cash", "ratio_cash", {"G-HNWI": 0.25}, t(1))
    return e

# --- REF-01 : une ligne par scénario, total + ventilation HIGH/MEDIUM
def test_REF01_une_ligne_par_scenario(eng):
    ref = eng.alertes_par_scenario(t(1))
    assert set(ref.keys()) == {"SCN-VELO", "SCN-CASH"}
    assert ref["SCN-VELO"]["total"] == 3               # 90,60,55 ≥ 50
    assert ref["SCN-VELO"]["high"] + ref["SCN-VELO"]["medium"] == 3
    assert ref["SCN-VELO"]["champ"] == "tx_par_mois" and ref["SCN-VELO"]["groupes"] == ["G-HNWI"]

# --- REF-02 : le total du référentiel = nombre de cases créées par le vrai run
def test_REF02_coherent_avec_cases(eng):
    ref = eng.alertes_par_scenario(t(1))
    somme = sum(v["total"] for v in ref.values())
    cases = eng.generer_cases(t(1))
    assert len(cases) == somme                          # référentiel ≡ cases générées
    assert len(eng.cases) == somme
