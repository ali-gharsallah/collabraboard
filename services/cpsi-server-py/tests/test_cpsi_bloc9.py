# -*- coding: utf-8 -*-
"""CPSI bloc 9 — bac à sable AML : simulation dry-run (application R70).
SIM-01..03. La simulation projette les alertes SANS créer de cases ni muter l'état."""
import pytest
from datetime import datetime, timedelta
from olive_cpsi.engine import OliveCpsiEngine

T0 = datetime(2026, 1, 1)
def t(d=0): return T0 + timedelta(days=d)
BAS = {"pays_risque": 0, "structure_risque": 1, "pep": False, "secteur_risque": 0}

@pytest.fixture
def eng():
    e = OliveCpsiEngine()
    for i, v in enumerate([90, 60, 40, 20]):
        e.enregistrer_client(f"C{i}", BAS, T0, attributs={"aum_band": "HNWI", "tx_par_mois": v})
    e.definir_groupe("G-HNWI", "HNWI", {"logique": "ET",
        "conditions": [{"champ": "aum_band", "op": "eq", "val": "HNWI"}]}, T0)
    e.definir_scenario_aml("SCN-VELO", "Vélocité", "tx_par_mois", {"G-HNWI": 50}, t(1))
    return e

# --- SIM-01 : la simulation projette des hits mais NE crée PAS de cases (dry-run)
def test_SIM01_dry_run(eng):
    r = eng.simuler_scenarios(t(1))
    assert r["total"] == 2                    # 90, 60 ≥ 50
    assert len(eng.cases) == 0                 # aucune case créée

# --- SIM-02 : facteur < 1 abaisse les seuils → plus d'alertes projetées
def test_SIM02_facteur(eng):
    base = eng.simuler_scenarios(t(1))["total"]
    sensible = eng.simuler_scenarios(t(1), facteur=0.4)["total"]   # seuil 50 → 20
    assert sensible > base and sensible == 4   # tous franchissent à 20
    assert len(eng.cases) == 0                  # toujours aucune case

# --- SIM-03 : le vrai generer_cases crée, la simulation ne mute pas les scénarios
def test_SIM03_pas_de_mutation(eng):
    seuil_avant = eng.scenarios["SCN-VELO"]["groupes_seuils"]["G-HNWI"]
    eng.simuler_scenarios(t(1), facteur=0.2)
    assert eng.scenarios["SCN-VELO"]["groupes_seuils"]["G-HNWI"] == seuil_avant  # restauré
    eng.generer_cases(t(1))
    assert len(eng.cases) == 2                  # le vrai run crée bien
