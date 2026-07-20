# -*- coding: utf-8 -*-
"""CPSI bloc 4 — bibliothèque étendue : scénarios AML fine-tunés par seuil-groupe sur
trois domaines. Activité transactionnelle (TX), transfer-agent/custody (CU), abus de marché (MA).
TX-01..02 · CU-01..02 · MA-01..02 · SPEC-01."""
import pytest
from datetime import datetime, timedelta
from olive_cpsi.engine import OliveCpsiEngine, CpsiError

T0 = datetime(2026, 1, 1)
def t(d=0): return T0 + timedelta(days=d)
BAS = {"pays_risque": 0, "structure_risque": 1, "pep": False, "secteur_risque": 0}

def _pop(e):
    specs = [
        ("C-VELO",   {"type":"PP","aum_band":"HNWI","secteur":"Finance & Asset management",
                      "tx_par_mois":90,"ratio_cash":0.1,"fop_deliveries":1,"reglements_tiers":1,
                      "trades_pre_annonce":0,"ratio_annulation_ordres":0.1,"rotation_titres":0.5}),
        ("C-MASS",   {"type":"PP","aum_band":"Mass Affluent","secteur":"Santé",
                      "tx_par_mois":35,"ratio_cash":0.5,"fop_deliveries":0,"reglements_tiers":1,
                      "trades_pre_annonce":0,"ratio_annulation_ordres":0.05,"rotation_titres":0.2}),
        ("C-FO",     {"type":"FO","aum_band":"UHNWI","secteur":"Industrie",
                      "tx_par_mois":10,"ratio_cash":0.05,"fop_deliveries":10,"reglements_tiers":9,
                      "trades_pre_annonce":0,"ratio_annulation_ordres":0.1,"rotation_titres":2.8}),
        ("C-INSIDER",{"type":"PP","aum_band":"Affluent","secteur":"Technologie",
                      "tx_par_mois":20,"ratio_cash":0.1,"fop_deliveries":0,"reglements_tiers":0,
                      "trades_pre_annonce":5,"ratio_annulation_ordres":0.7,"rotation_titres":1.0}),
    ]
    for cid, attr in specs:
        e.enregistrer_client(cid, BAS, T0, attributs=attr)
    e.definir_groupe("G-VELO", "Vélocité élevée", {"logique":"ET",
        "conditions":[{"champ":"tx_par_mois","op":"gte","val":45}]}, T0, priorite=40)
    e.definir_groupe("G-MASS", "Mass Affluent", {"logique":"ET",
        "conditions":[{"champ":"aum_band","op":"eq","val":"Mass Affluent"}]}, T0, priorite=85)
    e.definir_groupe("G-CUSTODY", "Custody lourd", {"logique":"ET",
        "conditions":[{"champ":"rotation_titres","op":"gte","val":2}]}, T0, priorite=40)
    e.definir_groupe("G-MA", "Signaux abus de marché", {"logique":"OU",
        "conditions":[{"champ":"trades_pre_annonce","op":"gte","val":3},
                      {"champ":"ratio_annulation_ordres","op":"gte","val":0.6}]}, T0, priorite=20)
    return e

@pytest.fixture
def eng():
    return _pop(OliveCpsiEngine())

# ── TX : activité transactionnelle (after-market) ──
def test_TX01_velocite_ciblee(eng):
    eng.definir_scenario_aml("SCN-VELO","Vélocité transactionnelle anormale","tx_par_mois",
                             {"G-VELO":80,"G-MASS":30}, t(1))
    r = eng.evaluer_scenario("SCN-VELO", t(1))
    ids = set(h["client"] for h in r["hits"])
    assert ids == {"C-VELO","C-MASS"}                    # chacun franchit LE seuil de son groupe
    assert r["evalues"] == 2                              # C-FO, C-INSIDER hors périmètre
    par = {h["client"]:h["seuil"] for h in r["hits"]}
    assert par["C-VELO"]==80 and par["C-MASS"]==30        # seuils par groupe

def test_TX02_seuil_par_groupe_resserre(eng):
    eng.definir_scenario_aml("SCN-VELO2","Vélocité","tx_par_mois",{"G-MASS":40}, t(1))
    r = eng.evaluer_scenario("SCN-VELO2", t(1))
    assert all(h["client"]!="C-MASS" for h in r["hits"])  # 35 < 40 : ne franchit plus

# ── CU : transfer agent / custody ──
def test_CU01_fop_cible_custody(eng):
    eng.definir_scenario_aml("SCN-FOP","Livraisons franco de paiement","fop_deliveries",
                             {"G-CUSTODY":8}, t(1))
    r = eng.evaluer_scenario("SCN-FOP", t(1))
    assert set(h["client"] for h in r["hits"]) == {"C-FO"}
    assert r["evalues"] == 1                              # seul le custody est dans le périmètre

def test_CU02_reglements_tiers(eng):
    eng.definir_scenario_aml("SCN-TIERS","Règlements de tiers","reglements_tiers",
                             {"G-CUSTODY":5}, t(1))
    r = eng.evaluer_scenario("SCN-TIERS", t(1))
    assert set(h["client"] for h in r["hits"]) == {"C-FO"}

# ── MA : abus de marché (MAR) ──
def test_MA01_pre_news_insider(eng):
    eng.definir_scenario_aml("SCN-PRENEWS","Trades avant annonce (insider)","trades_pre_annonce",
                             {"G-MA":3}, t(1))
    r = eng.evaluer_scenario("SCN-PRENEWS", t(1))
    assert set(h["client"] for h in r["hits"]) == {"C-INSIDER"}
    assert r["evalues"] == 1

def test_MA02_spoofing(eng):
    eng.definir_scenario_aml("SCN-SPOOF","Spoofing / layering","ratio_annulation_ordres",
                             {"G-MA":0.6}, t(1))
    r = eng.evaluer_scenario("SCN-SPOOF", t(1))
    assert set(h["client"] for h in r["hits"]) == {"C-INSIDER"}

# ── périmètre : hors des groupes ciblés, jamais évalué (moins de faux positifs) ──
def test_SPEC01_perimetre(eng):
    eng.definir_scenario_aml("SCN-VELO","v","tx_par_mois",{"G-VELO":80,"G-MASS":30}, t(1))
    r = eng.evaluer_scenario("SCN-VELO", t(1))
    assert r["evalues"] == 2 and len(eng.clients) == 4    # 2 hors périmètre, jamais évalués
