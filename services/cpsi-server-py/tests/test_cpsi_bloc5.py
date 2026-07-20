# -*- coding: utf-8 -*-
"""CPSI bloc 5 — R75 marquage insider (liste d'initiés MAR). IN-01..06."""
import pytest
from datetime import datetime, timedelta
from olive_cpsi.engine import OliveCpsiEngine, CpsiError

T0 = datetime(2026, 1, 1)
def t(d=0): return T0 + timedelta(days=d)
BAS = {"pays_risque": 0, "structure_risque": 1, "pep": False, "secteur_risque": 0}

@pytest.fixture
def eng():
    e = OliveCpsiEngine()
    e.enregistrer_client("C1", BAS, T0, attributs={"type": "PP", "trades_pre_annonce": 5})
    e.enregistrer_client("C2", BAS, T0, attributs={"type": "PP", "trades_pre_annonce": 0})
    return e

# --- IN-01 : taguer insider → attribut porté + événement tracé (qui/motif/instrument) (R75)
def test_IN01_taguer(eng):
    eng.taguer_insider("C1", "Isabelle Vernet", "CO_SR",
                       "Administratrice d'un émetteur coté", t(1), instrument="NESN.SW")
    assert eng.est_insider("C1")
    ev = [e for e in eng.events if e["type"] == "insider_tague"][-1]
    assert ev["client"] == "C1" and ev["acteur"] == "Isabelle Vernet" and ev["instrument"] == "NESN.SW"

# --- IN-02 : réservé aux rôles habilités + motif obligatoire (default-deny, R75)
def test_IN02_reserve_et_motif(eng):
    with pytest.raises(CpsiError):
        eng.taguer_insider("C1", "Sophie Marchand", "ARM", "motif", t(1))   # rôle non habilité
    with pytest.raises(CpsiError):
        eng.taguer_insider("C1", "Isabelle Vernet", "CO_SR", "", t(1))       # motif vide
    assert not eng.est_insider("C1")

# --- IN-03 : réversible avec motivation obligatoire, tracé (R75)
def test_IN03_reversible(eng):
    eng.taguer_insider("C1", "IV", "CO_SR", "motif initial", t(1))
    with pytest.raises(CpsiError):
        eng.lever_insider("C1", "IV", "CO_SR", "", t(2))                     # motivation requise
    eng.lever_insider("C1", "IV", "CO_SR", "Mandat d'administratrice échu", t(3))
    assert not eng.est_insider("C1")
    assert any(e["type"] == "insider_leve" and e["client"] == "C1" for e in eng.events)

# --- IN-04 : le statut insider alimente un groupe (R71 × R75)
def test_IN04_groupe_insider(eng):
    eng.taguer_insider("C1", "IV", "CO_SR", "motif", t(1))
    eng.definir_groupe("G-INS", "Initiés déclarés", {"logique": "ET",
        "conditions": [{"champ": "insider", "op": "eq", "val": True}]}, t(1))
    assert eng.membres("G-INS", t(1)) == ["C1"]

# --- IN-05 : un scénario abus de marché ciblant les initiés ne prend que les insiders (R73 × R75)
def test_IN05_scenario_cible_inities(eng):
    eng.taguer_insider("C1", "IV", "CO_SR", "motif", t(1))
    eng.definir_groupe("G-INS", "Initiés déclarés", {"logique": "ET",
        "conditions": [{"champ": "insider", "op": "eq", "val": True}]}, t(1))
    # seuil serré : tout trade avant annonce d'un initié déclaré est suspect
    eng.definir_scenario_aml("SCN-INS", "Insider dealing", "trades_pre_annonce",
                             {"G-INS": 1}, t(1))
    r = eng.evaluer_scenario("SCN-INS", t(1))
    assert set(h["client"] for h in r["hits"]) == {"C1"}
    assert r["evalues"] == 1                          # C2 non-initié : hors périmètre

# --- IN-06 : append-only — l'historique conserve marquage puis levée (R49)
def test_IN06_append_only(eng):
    eng.taguer_insider("C1", "IV", "CO_SR", "m1", t(1))
    eng.lever_insider("C1", "IV", "CO_SR", "m2", t(2))
    seq = [e["type"] for e in eng.events if e["type"] in ("insider_tague", "insider_leve")]
    assert seq == ["insider_tague", "insider_leve"]   # les deux tracés, rien écrasé
