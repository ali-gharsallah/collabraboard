# -*- coding: utf-8 -*-
"""CPSI bloc 11 — catalogue de conformité (R79) : paramètres exacts par scénario
+ registre du calcul des attributs. CAT-01..03. Lecture seule (aucune mutation)."""
import pytest
from datetime import datetime, timedelta
from olive_cpsi.engine import OliveCpsiEngine

T0 = datetime(2026, 1, 1)
def t(d=0): return T0 + timedelta(days=d)
BAS = {"pays_risque": 0, "structure_risque": 1, "pep": False, "secteur_risque": 0}

@pytest.fixture
def eng():
    e = OliveCpsiEngine()
    for i, v in enumerate([90, 60, 20]):
        e.enregistrer_client(f"C{i}", BAS, T0, attributs={"aum_band": "HNWI", "tx_par_mois": v, "ratio_cash": 0.1*i})
    e.definir_groupe("G-HNWI", "HNWI", {"logique": "ET",
        "conditions": [{"champ": "aum_band", "op": "eq", "val": "HNWI"}]}, T0)
    e.definir_scenario_aml("SCN-VELO", "Vélocité", "tx_par_mois", {"G-HNWI": 50}, t(1))
    e.definir_scenario_aml("SCN-CASH", "Cash", "ratio_cash", {"G-HNWI": 0.25}, t(1), sens="gte")
    return e

# --- CAT-01 : une entrée par scénario, avec paramètres EXACTS (opérateur, seuils par groupe)
def test_CAT01_parametres_exacts(eng):
    cat = eng.catalogue_conformite(t(1))
    assert len(cat) == 2
    velo = next(c for c in cat if c["id"] == "SCN-VELO")
    assert velo["champ"] == "tx_par_mois" and velo["operateur"] == "≥"
    assert velo["seuils"] == {"G-HNWI": 50} and velo["groupes"] == ["G-HNWI"]

# --- CAT-02 : chaque scénario expose le MODE DE CALCUL documenté de son attribut
def test_CAT02_attribut_documente(eng):
    cat = eng.catalogue_conformite(t(1))
    for c in cat:
        assert c["champ_formule"] != "(attribut non documenté)"    # tout attribut surveillé est documenté
        assert c["champ_label"] and c["domaine"] and c["champ_nature"] in ("structurel", "calculé")

# --- CAT-03 : le catalogue est en LECTURE SEULE — aucune mutation d'état (cases, seuils)
def test_CAT03_lecture_seule(eng):
    before_cases = len(eng.cases)
    before_seuil = eng.scenarios["SCN-VELO"]["groupes_seuils"]["G-HNWI"]
    eng.catalogue_conformite(t(1)); eng.catalogue_conformite(t(2))
    assert len(eng.cases) == before_cases
    assert eng.scenarios["SCN-VELO"]["groupes_seuils"]["G-HNWI"] == before_seuil
