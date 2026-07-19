# -*- coding: utf-8 -*-
"""CPSI bloc 15 — Point 4 : reporting & délai hit → SAR/MROS (RP-01..04).
Délai rejoué depuis l'historique tracé (R48). Mesure et notifie le dépassement SLA sans bloquer (R39)."""
import pytest
from datetime import datetime, timedelta
from olive_cpsi.engine import OliveCpsiEngine, CpsiError

T0 = datetime(2026, 1, 1)
def t(d=0): return T0 + timedelta(days=d)

@pytest.fixture
def eng():
    return OliveCpsiEngine()

def _escalade(eng, jours):
    c = eng.ouvrir_risk_case([{"client":"C1","scenario":"SCN-VELO"}], "CO", t(0))
    eng.transition_risk_case(c["id"], "prendre_en_charge", "CO", t(1))
    eng.transition_risk_case(c["id"], "escalader", "CO_SR", t(jours), motif="seuils MROS atteints")
    return c["id"]

# --- RP-01 : délai = jours entre ouverture et escalade, rejoué de l'historique
def test_RP01_delai_depuis_historique(eng):
    cid = _escalade(eng, 12)
    assert eng.delai_case(cid) == 12

# --- RP-02 : case non terminal → pas de délai
def test_RP02_non_terminal_pas_de_delai(eng):
    c = eng.ouvrir_risk_case([{"client":"C1","scenario":"SCN-VELO"}], "CO", t(0))
    eng.transition_risk_case(c["id"], "prendre_en_charge", "CO", t(1))
    assert eng.delai_case(c["id"]) is None

# --- RP-03 : synthèse par état + délai moyen des escalades
def test_RP03_synthese_par_etat(eng):
    _escalade(eng, 10); _escalade(eng, 20)
    c3 = eng.ouvrir_risk_case([{"client":"C9","scenario":"X"}], "CO", t(0))   # reste NOUVELLE
    r = eng.reporting_cases()
    assert r["par_etat"].get("ESCALADEE") == 2 and r["par_etat"].get("NOUVELLE") == 1
    assert r["delai_moyen"] == 15 and r["delai_max"] == 20

# --- RP-04 : dépassement SLA mesuré et notifié, sans bloquer (R39)
def test_RP04_sla_mesure_sans_bloquer(eng):
    _escalade(eng, 45)   # > 30j
    r = eng.reporting_cases(sla_jours=30)
    assert r["hors_sla"] == 1 and r["escalades"][0]["hors_sla"] is True
    # l'escalade a bien eu lieu malgré le dépassement (mesure, pas coercition)
    assert r["par_etat"].get("ESCALADEE") == 1
