# -*- coding: utf-8 -*-
"""CPSI bloc 7 — pump & dump toutes classes d'actifs : seuil PAR classe (R73).
PD-01 seuil serré classes illiquides · PD-02 seuil par classe · PD-03 périmètre."""
import pytest
from datetime import datetime, timedelta
from olive_cpsi.engine import OliveCpsiEngine, CpsiError

T0 = datetime(2026, 1, 1)
def t(d=0): return T0 + timedelta(days=d)
BAS = {"pays_risque": 0, "structure_risque": 1, "pep": False, "secteur_risque": 0}

@pytest.fixture
def eng():
    e = OliveCpsiEngine()
    # même score composite pump&dump (50) mais classes d'actifs différentes
    e.enregistrer_client("C-CRYPTO", BAS, T0, attributs={"asset_dominant": "Crypto", "pump_dump_score": 50})
    e.enregistrer_client("C-OBLIG",  BAS, T0, attributs={"asset_dominant": "Obligations", "pump_dump_score": 50})
    e.enregistrer_client("C-PENNY",  BAS, T0, attributs={"asset_dominant": "Penny stocks", "pump_dump_score": 45})
    for cls, gid in [("Crypto", "G-AST-CRYPTO"), ("Obligations", "G-AST-OBLIG"), ("Penny stocks", "G-AST-PENNY")]:
        e.definir_groupe(gid, "Actifs — " + cls, {"logique": "ET",
            "conditions": [{"champ": "asset_dominant", "op": "eq", "val": cls}]}, T0)
    # seuils par classe : illiquides serrés (40), liquides tolérants (80)
    e.definir_scenario_aml("SCN-PUMPDUMP", "Pump & dump toutes classes", "pump_dump_score",
                           {"G-AST-CRYPTO": 40, "G-AST-PENNY": 40, "G-AST-OBLIG": 80}, t(1))
    return e

# --- PD-01 : classes illiquides (crypto/penny) — seuil serré capte ; obligations non
def test_PD01_illiquides_captees(eng):
    r = eng.evaluer_scenario("SCN-PUMPDUMP", t(1))
    ids = set(h["client"] for h in r["hits"])
    assert "C-CRYPTO" in ids and "C-PENNY" in ids       # 50≥40, 45≥40
    assert "C-OBLIG" not in ids                          # 50 < 80 (obligations tolérantes)

# --- PD-02 : seuil PAR classe — le même score franchit ou non selon la classe
def test_PD02_seuil_par_classe(eng):
    r = eng.evaluer_scenario("SCN-PUMPDUMP", t(1))
    par = {h["client"]: h["seuil"] for h in r["hits"]}
    assert par["C-CRYPTO"] == 40                         # crypto : seuil serré propre à la classe

# --- PD-03 : une classe non ciblée n'est jamais évaluée (périmètre)
def test_PD03_perimetre(eng):
    eng.enregistrer_client("C-FX", BAS, T0, attributs={"asset_dominant": "FX / Dérivés", "pump_dump_score": 99})
    r = eng.evaluer_scenario("SCN-PUMPDUMP", t(1))
    assert all(h["client"] != "C-FX" for h in r["hits"])  # FX hors périmètre, jamais évalué
    assert r["evalues"] == 3                               # crypto, penny, oblig seulement
