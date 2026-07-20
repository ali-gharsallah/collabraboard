# -*- coding: utf-8 -*-
"""CPSI bloc 6 — R76 cases d'investigation + nouvelles familles de scénarios
(transferts TR, post-marché/trading PM). CASE-01..04 · TR-01 · PM-01."""
import pytest
from datetime import datetime, timedelta
from olive_cpsi.engine import OliveCpsiEngine, CpsiError

T0 = datetime(2026, 1, 1)
def t(d=0): return T0 + timedelta(days=d)
BAS = {"pays_risque": 0, "structure_risque": 1, "pep": False, "secteur_risque": 0}

@pytest.fixture
def eng():
    e = OliveCpsiEngine()
    e.enregistrer_client("C1", BAS, T0, attributs={
        "type": "PP", "wires_same_day_inout": 9, "wires_high_risk_jur": 6,
        "illiquid_ratio": 0.8, "churn_ratio": 7})
    e.enregistrer_client("C2", BAS, T0, attributs={
        "type": "PP", "wires_same_day_inout": 0, "wires_high_risk_jur": 0,
        "illiquid_ratio": 0.1, "churn_ratio": 1})
    e.definir_groupe("G-PASSTHRU", "Pass-through", {"logique": "ET",
        "conditions": [{"champ": "wires_same_day_inout", "op": "gte", "val": 5}]}, T0)
    e.definir_groupe("G-ILLIQ", "Titres illiquides", {"logique": "ET",
        "conditions": [{"champ": "illiquid_ratio", "op": "gte", "val": 0.5}]}, T0)
    return e

# --- TR-01 : scénario transfert pass-through, ciblé et seuillé par groupe (R73)
def test_TR01_transfert_passthrough(eng):
    eng.definir_scenario_aml("SCN-PASSTHRU", "Pass-through même jour", "wires_same_day_inout",
                             {"G-PASSTHRU": 5}, t(1))
    r = eng.evaluer_scenario("SCN-PASSTHRU", t(1))
    assert set(h["client"] for h in r["hits"]) == {"C1"} and r["evalues"] == 1

# --- PM-01 : scénario post-marché titres illiquides, ciblé par groupe (R73)
def test_PM01_illiquides(eng):
    eng.definir_scenario_aml("SCN-ILLIQ", "Trading titres illiquides", "illiquid_ratio",
                             {"G-ILLIQ": 0.5}, t(1))
    r = eng.evaluer_scenario("SCN-ILLIQ", t(1))
    assert set(h["client"] for h in r["hits"]) == {"C1"}

# --- CASE-01 : un hit génère une case tracée, statut NOUVELLE, sévérité calculée (R76)
def test_CASE01_generation(eng):
    eng.definir_scenario_aml("SCN-PASSTHRU", "Pass-through", "wires_same_day_inout",
                             {"G-PASSTHRU": 5}, t(1))
    cases = eng.generer_cases(t(1))
    assert len(cases) == 1 and cases[0]["statut"] == "NOUVELLE" and cases[0]["client"] == "C1"
    assert cases[0]["severite"] in ("MEDIUM", "HIGH")
    assert any(e["type"] == "case_ouverte" for e in eng.events)

# --- CASE-02 : idempotence — regénérer ne crée pas de doublon (R76)
def test_CASE02_idempotent(eng):
    eng.definir_scenario_aml("SCN-PASSTHRU", "Pass-through", "wires_same_day_inout",
                             {"G-PASSTHRU": 5}, t(1))
    eng.generer_cases(t(1))
    n = len(eng.cases)
    eng.generer_cases(t(2))
    assert len(eng.cases) == n                        # pas de doublon

# --- CASE-03 : clôture exige motif ; escalade et révision KYC alimentent le workflow (R76/R44)
def test_CASE03_decisions(eng):
    eng.definir_scenario_aml("SCN-PASSTHRU", "Pass-through", "wires_same_day_inout",
                             {"G-PASSTHRU": 5}, t(1))
    cid = eng.generer_cases(t(1))[0]["id"]
    with pytest.raises(CpsiError):
        eng.decider_case(cid, "CLOTURER", "IV", t(2))          # motif requis
    eng.decider_case(cid, "ESCALADER", "IV", t(2))
    assert eng.cases[cid]["statut"] == "ESCALADEE"
    eng.decider_case(cid, "REVISION_KYC", "IV", t(3))
    assert eng.cases[cid]["statut"] == "KYC_DECLENCHE"          # alimente le workflow
    with pytest.raises(CpsiError):
        eng.decider_case(cid, "ACTION_INCONNUE", "IV", t(3))    # default-deny

# --- CASE-04 : append-only — ouverture + décisions conservées (R49)
def test_CASE04_append_only(eng):
    eng.definir_scenario_aml("SCN-PASSTHRU", "Pass-through", "wires_same_day_inout",
                             {"G-PASSTHRU": 5}, t(1))
    cid = eng.generer_cases(t(1))[0]["id"]
    eng.decider_case(cid, "CLOTURER", "IV", t(2), motif="Flux justifié — trésorerie groupe")
    types = [e["type"] for e in eng.events if e["type"] in ("case_ouverte", "case_decidee")]
    assert types == ["case_ouverte", "case_decidee"]
    assert eng.cases[cid]["statut"] == "CLOTUREE" and len(eng.cases[cid]["decisions"]) == 1
