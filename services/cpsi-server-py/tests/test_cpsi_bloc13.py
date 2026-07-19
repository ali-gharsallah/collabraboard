# -*- coding: utf-8 -*-
"""CPSI bloc 13 — R82 : rétroaction faux-positif (suppression apprenante).
FP-01..04. Pénalité escaladante -10/-20…, soustraite du score, désactivable, tracée,
avec garde-fou : un signal fort+fréquent recroise X malgré la pénalité (pas d'angle mort)."""
import pytest
from datetime import datetime, timedelta
from olive_cpsi.engine import OliveCpsiEngine

T0 = datetime(2026, 1, 1)
def t(d=0): return T0 + timedelta(days=d)
BAS = {"pays_risque": 0, "structure_risque": 1, "pep": False, "secteur_risque": 0}

def mk():
    e = OliveCpsiEngine()
    e.enregistrer_client("A", BAS, T0, attributs={"aum_band":"HNWI","tx_par_mois":100})
    e.definir_groupe("G-ALL","Tous",{"logique":"ET","conditions":[{"champ":"aum_band","op":"eq","val":"HNWI"}]}, T0)
    e.definir_scenario_aml("SCN-VELO","Vélocité","tx_par_mois",{"G-ALL":50}, t(1))
    return e

def statut_A(e):
    # évaluation à date FIXE t(1) -> fréquence constante, on isole l'effet de la pénalité FP
    return next(s["statut"] for s in e.signaux(t(1)) if s["client"]=="A" and s["scenario"]=="SCN-VELO")

# --- FP-01 : 1er FP = -10 (reste alerte 60>=55) ; 2e FP = -20 (cumul -30 -> 40 : suppression)
def test_FP01_penalite_escaladante(eng=None):
    e = mk()
    assert statut_A(e) == "ALERTE"                       # score brut 70
    r1 = e.declarer_faux_positif("A","SCN-VELO","CO_Vernet", t(2))
    assert r1["increment"] == -10 and r1["penalite_cumulee"] == -10
    assert statut_A(e) == "ALERTE"                       # 70-10=60 >= 55 : encore alerte
    r2 = e.declarer_faux_positif("A","SCN-VELO","CO_Vernet", t(4))
    assert r2["increment"] == -20 and r2["penalite_cumulee"] == -30
    assert statut_A(e) == "ANALYSE"                      # 70-30=40 < 45 : plus d'alerte

# --- FP-02 : mécanisme DÉSACTIVABLE — pénalité ignorée, l'alerte réapparaît
def test_FP02_desactivable(eng=None):
    e = mk()
    e.declarer_faux_positif("A","SCN-VELO","CO", t(2)); e.declarer_faux_positif("A","SCN-VELO","CO", t(3))
    assert statut_A(e) == "ANALYSE"                      # supprimé quand actif
    e.set_fp_suppression(False, t(5))
    assert statut_A(e) == "ALERTE"                       # pénalité non appliquée -> 70

# --- FP-03 : tracé append-only (qui/quand/incrément/cumul)
def test_FP03_trace(eng=None):
    e = mk()
    e.declarer_faux_positif("A","SCN-VELO","CO_Vernet", t(2))
    evs = [ev for ev in e.events if ev["type"]=="faux_positif_declare"]
    assert evs and evs[-1]["acteur"]=="CO_Vernet" and evs[-1]["increment"]==-10 and evs[-1]["client"]=="A"

# --- FP-04 : GARDE-FOU — un signal fort ET fréquent recroise X malgré la pénalité (pas d'angle mort)
def test_FP04_garde_fou_pas_angle_mort(eng=None):
    e = mk()
    for d in (1,3,5,7):                                        # fréquence bâtie -> 100
        e.signaux(t(d))
    e.declarer_faux_positif("A","SCN-VELO","CO", t(8)); e.declarer_faux_positif("A","SCN-VELO","CO", t(9))
    # brut = .6*100 + .4*100 = 100 ; pénalité -30 -> 70 >= 55 : ALERTE malgré 2 FP
    assert statut_A(e) == "ALERTE"
