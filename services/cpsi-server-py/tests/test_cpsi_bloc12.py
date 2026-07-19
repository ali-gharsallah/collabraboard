# -*- coding: utf-8 -*-
"""CPSI bloc 12 — R80 (alerte = signal scoré franchissant X) + R81 (dédup/corrélation).
SCO-01..03, COR-01. Une alerte n'est pas un hit : c'est impact+fréquence scorés vs seuil X."""
import pytest
from datetime import datetime, timedelta
from olive_cpsi.engine import OliveCpsiEngine

T0 = datetime(2026, 1, 1)
def t(d=0): return T0 + timedelta(days=d)
BAS = {"pays_risque": 0, "structure_risque": 1, "pep": False, "secteur_risque": 0}

@pytest.fixture
def eng():
    e = OliveCpsiEngine()  # X=55, marge=10, w_impact=.6, w_freq=.4 (défauts)
    e.enregistrer_client("A", BAS, T0, attributs={"aum_band":"HNWI","vip":True,"tx_par_mois":100,"ratio_cash":0.9})
    e.enregistrer_client("B", BAS, T0, attributs={"aum_band":"HNWI","vip":False,"tx_par_mois":60,"ratio_cash":0.1})
    e.enregistrer_client("C", BAS, T0, attributs={"aum_band":"HNWI","vip":False,"tx_par_mois":80,"ratio_cash":0.1})
    e.enregistrer_client("D", BAS, T0, attributs={"aum_band":"HNWI","vip":False,"tx_par_mois":20,"ratio_cash":0.1})
    e.definir_groupe("G-ALL","Tous HNWI",{"logique":"ET","conditions":[{"champ":"aum_band","op":"eq","val":"HNWI"}]}, T0)
    e.definir_groupe("G-VIP","VIP",{"logique":"ET","conditions":[{"champ":"vip","op":"eq","val":True}]}, T0)
    # SCN-VELO cible A via DEUX groupes (G-ALL et G-VIP) -> test de dédup
    e.definir_scenario_aml("SCN-VELO","Vélocité","tx_par_mois",{"G-ALL":50,"G-VIP":50}, t(1))
    e.definir_scenario_aml("SCN-CASH","Cash","ratio_cash",{"G-ALL":0.25}, t(1))
    return e

# --- SCO-01 : la porte de seuil classe ALERTE / NEAR_MISS / ANALYSE
def test_SCO01_porte_de_seuil(eng):
    st = {s["client"]: s["statut"] for s in eng.signaux(t(1)) if s["scenario"]=="SCN-VELO"}
    assert st["A"] == "ALERTE"       # impact 100, score 70 >= 55
    assert st["C"] == "NEAR_MISS"    # impact 60, score 46 dans [45,55) : a frôlé l'alerte
    assert st["B"] == "ANALYSE"      # impact 20, score 22 : analyse non aboutie
    assert "D" not in st             # sous le seuil du scénario : jamais évalué en signal

# --- SCO-02 : une analyse non aboutie n'est PAS une alerte ; alertes() les exclut
def test_SCO02_analyse_non_alerte(eng):
    al = {(s["client"],s["scenario"]) for s in eng.alertes(t(1))}
    an = {(s["client"],s["scenario"]) for s in eng.analyses(t(1))}
    assert ("B","SCN-VELO") in an and ("C","SCN-VELO") in an   # near-miss + analyse
    assert ("B","SCN-VELO") not in al and ("C","SCN-VELO") not in al

# --- SCO-03 (R81) : dédup — A touché par SCN-VELO via 2 groupes => UN seul signal
def test_SCO03_dedup_client_scenario(eng):
    velo_A = [s for s in eng.signaux(t(1)) if s["client"]=="A" and s["scenario"]=="SCN-VELO"]
    assert len(velo_A) == 1

# --- COR-01 (R81) : corrélation — A touché par 2 scénarios distincts => groupe corrélé
def test_COR01_correlation_multi_scenario(eng):
    cor = eng.correlations(t(1))
    assert cor.get("A") == ["SCN-CASH","SCN-VELO"]   # deux scénarios sur le même client
    assert "B" not in cor and "C" not in cor          # un seul scénario => pas de corrélation
