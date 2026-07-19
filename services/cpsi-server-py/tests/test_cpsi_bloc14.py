# -*- coding: utf-8 -*-
"""CPSI bloc 14 — R83 : risk case animé par workflow (rattacher alerte, documenter, décider).
RC-01..05. Transitions à motif (R7), documentation append-only (R48/R49), corrélation (R81)."""
import pytest
from datetime import datetime, timedelta
from olive_cpsi.engine import OliveCpsiEngine, CpsiError

T0 = datetime(2026, 1, 1)
def t(d=0): return T0 + timedelta(days=d)

@pytest.fixture
def eng():
    return OliveCpsiEngine()

# --- RC-01 : ouvrir un case depuis des alertes → état NOUVELLE, scénarios rattachés
def test_RC01_ouverture(eng):
    c = eng.ouvrir_risk_case([{"client":"C1","scenario":"SCN-VELO"}], "CO_Vernet", t(1))
    assert c["id"]=="RC-0001" and c["etat"]=="NOUVELLE" and c["client"]=="C1"
    assert c["scenarios"]==["SCN-VELO"] and c["owner"]=="CO_Vernet"

# --- RC-02 : workflow — prise en charge, clôture EXIGE un motif (R7)
def test_RC02_workflow_motif(eng):
    c = eng.ouvrir_risk_case([{"client":"C1","scenario":"SCN-VELO"}], "CO", t(1))
    eng.transition_risk_case(c["id"], "prendre_en_charge", "CO", t(2))
    assert eng.risk_cases[c["id"]]["etat"]=="EN_ANALYSE"
    with pytest.raises(CpsiError):                              # clore sans motif -> refus (R7)
        eng.transition_risk_case(c["id"], "clore", "CO_SR", t(3))
    eng.transition_risk_case(c["id"], "clore", "CO_SR", t(4), motif="Justifié : activité cohérente avec le profil")
    assert eng.risk_cases[c["id"]]["etat"]=="CLOTUREE"

# --- RC-03 : transition impossible depuis l'état courant → refus
def test_RC03_transition_invalide(eng):
    c = eng.ouvrir_risk_case([{"client":"C1","scenario":"SCN-VELO"}], "CO", t(1))
    with pytest.raises(CpsiError):                              # on ne peut pas escalader depuis NOUVELLE
        eng.transition_risk_case(c["id"], "escalader", "CO_SR", t(2), motif="x")

# --- RC-04 : documentation de l'analyse — APPEND ONLY
def test_RC04_documentation_append_only(eng):
    c = eng.ouvrir_risk_case([{"client":"C1","scenario":"SCN-VELO"}], "CO", t(1))
    eng.documenter_risk_case(c["id"], "CO", "Première hypothèse : structuring possible", t(2))
    eng.documenter_risk_case(c["id"], "CO", "Contreparties tierces récurrentes", t(3))
    notes = eng.risk_cases[c["id"]]["notes"]
    assert len(notes)==2 and notes[0]["acteur"]=="CO" and notes[1]["note"].startswith("Contreparties")
    with pytest.raises(CpsiError):
        eng.documenter_risk_case(c["id"], "CO", "   ", t(4))    # note vide refusée

# --- RC-05 : corrélation — un case regroupe plusieurs scénarios d'un même client (R81/R83)
def test_RC05_correlation_bundle(eng):
    c = eng.ouvrir_risk_case([{"client":"C1","scenario":"SCN-DORM"},
                              {"client":"C1","scenario":"SCN-VELO"}], "CO", t(1))
    assert c["scenarios"]==["SCN-DORM","SCN-VELO"]
    with pytest.raises(CpsiError):                              # clients différents -> refus
        eng.ouvrir_risk_case([{"client":"C1","scenario":"A"},{"client":"C2","scenario":"B"}], "CO", t(2))
