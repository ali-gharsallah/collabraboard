# -*- coding: utf-8 -*-
"""CPSI bloc 1 — R63..R67 : PS-01..05 · SG-01..03 · BD-01..02."""
import pytest
from datetime import datetime, timedelta
from olive_cpsi.engine import OliveCpsiEngine, CpsiError

T0 = datetime(2026, 1, 1)
def t(days=0): return T0 + timedelta(days=days)

STATIQUE_BAS  = {"pays_risque": 0, "structure_risque": 1, "pep": False, "secteur_risque": 0}
STATIQUE_HAUT = {"pays_risque": 3, "structure_risque": 3, "pep": True,  "secteur_risque": 2}

@pytest.fixture
def eng():
    return OliveCpsiEngine()

# --- PS-01 : un signal recalcule le score — événement append-only avec drivers (R63/R67)
def test_PS01_signal_recalcule_avec_drivers(eng):
    eng.enregistrer_client("C1", STATIQUE_BAS, T0)
    score, bande, drivers = eng.ingester_signal("C1", "alerte_fondee", 2, t(10))
    evs = [e for e in eng.events if e["type"] == "score_recalcule" and e["client"] == "C1"]
    assert len(evs) == 2                       # enregistrement + signal
    assert evs[-1]["drivers"], "R67 : drivers obligatoires"
    assert score > evs[0]["score"]

# --- PS-02 : décroissance temporelle — le même signal vieilli pèse moitié à une half-life (R64)
def test_PS02_half_life(eng):
    eng.enregistrer_client("C1", STATIQUE_BAS, T0)
    eng.ingester_signal("C1", "alerte_fondee", 2, T0)
    s_frais, _ = eng.score_a_date("C1", T0)
    s_demi, _ = eng.score_a_date("C1", t(eng.half_life_jours))
    base, _ = eng.score_statique("C1")
    assert abs((s_demi - base) - (s_frais - base) / 2) < 0.2

# --- PS-03 : rejeu à date — le score historique se reconstruit, le futur n'existe pas (R48)
def test_PS03_rejeu_a_date(eng):
    eng.enregistrer_client("C1", STATIQUE_BAS, T0)
    eng.ingester_signal("C1", "alerte_fondee", 2, t(100))
    s_avant, _ = eng.score_a_date("C1", t(50))
    base, _ = eng.score_statique("C1")
    assert s_avant == base                     # à J50, l'alerte de J100 n'existe pas

# --- PS-04 : explicabilité — la somme des drivers reconstitue le score (R67)
def test_PS04_drivers_somment(eng):
    eng.enregistrer_client("C1", STATIQUE_HAUT, T0)
    eng.ingester_signal("C1", "hit_screening", 3, t(5))
    eng.ingester_signal("C1", "velocite_tx", 1, t(6))
    score, drivers = eng.score_a_date("C1", t(6))
    assert abs(score - min(100.0, sum(d[1] for d in drivers))) < 0.05

# --- PS-05 : aucun effet de bord — le CPSI émet, il ne modifie rien d'autre (R66/R39)
def test_PS05_aucun_effet_de_bord(eng):
    eng.enregistrer_client("C1", STATIQUE_BAS, T0)
    types_avant = {"client_enregistre", "score_recalcule", "signal_ingere"}
    eng.ingester_signal("C1", "alerte_non_fondee", 1, t(1))
    assert set(e["type"] for e in eng.events) <= types_avant
    with pytest.raises(CpsiError):
        eng.ingester_signal("C1", "signal_inconnu", 1, t(2))   # default-deny

# --- SG-01 : segmentation en k groupes, appartenance tracée (R65)
def _population(eng):
    for i in range(8):
        eng.enregistrer_client(f"B{i}", STATIQUE_BAS, T0)
    for i in range(4):
        cid = f"H{i}"
        eng.enregistrer_client(cid, STATIQUE_HAUT, T0)
        eng.ingester_signal(cid, "alerte_fondee", 2, t(10))

def test_SG01_segments_traces(eng):
    _population(eng)
    segs = eng.segmenter(t(30))
    assert len(set(segs.values())) >= 2
    assert sum(1 for e in eng.events if e["type"] == "segment_affecte") == 12
    # les profils bas partagent un segment, distinct des profils hauts
    assert len({segs[f"B{i}"] for i in range(8)}) == 1
    assert segs["B0"] != segs["H0"]

# --- SG-02 : anomalie vs pairs SIGNALÉE, sans altérer le score (mesure, pas coercition — R39)
def test_SG02_anomalie_signalee_sans_alterer(eng):
    _population(eng)
    for _ in range(4):                          # B7 devient très anormal parmi les bas
        eng.ingester_signal("B7", "velocite_tx", 3, t(20))
    s_avant, _ = eng.score_a_date("B7", t(30))
    eng.segmenter(t(30))
    s_apres, _ = eng.score_a_date("B7", t(30))
    anos = [e for e in eng.events if e["type"] == "anomalie_pairs_signalee"]
    assert anos and anos[0]["client"] == "B7" and anos[0]["z"] > 2
    assert s_apres == s_avant                  # le signalement n'auto-amplifie pas le score
    assert ("revue_anomalie", "B7", anos[0]["segment"]) in eng.taches

# --- SG-03 : un changement de segment est un événement (R65)
def test_SG03_segment_change(eng):
    _population(eng)
    eng.segmenter(t(30))
    for _ in range(5):
        eng.ingester_signal("B0", "alerte_fondee", 3, t(40))
    eng.segmenter(t(45))
    assert any(e["type"] == "segment_change" and e["client"] == "B0" for e in eng.events)

# --- BD-01 : franchissement de bande → tâche + PROPOSITION d'aiguillage, rien d'imposé (R66/R44)
def test_BD01_franchissement_propose(eng):
    eng.enregistrer_client("C1", STATIQUE_BAS, T0)
    for i in range(6):
        eng.ingester_signal("C1", "alerte_fondee", 3, t(i + 1))
    assert any(e["type"] == "bande_franchie" and e["apres"] == "HIGH" for e in eng.events)
    prop = [e for e in eng.events if e["type"] == "aiguillage_propose"]
    assert prop and prop[-1]["workflow"] == "EDD" and "R44" in prop[-1]["motif"]
    assert ("proposition_aiguillage", "C1", "EDD") in eng.taches

# --- BD-02 : les paramètres tenant s'appliquent (bandes, half-life, k) — R-Q
def test_BD02_parametres_tenant():
    e = OliveCpsiEngine({"bandes": (10, 20), "half_life_jours": 30, "k_segments": 2})
    e.enregistrer_client("C1", STATIQUE_BAS, T0)
    score, _ = e.score_a_date("C1", T0)
    assert e.bande(score) in ("LOW", "MEDIUM", "HIGH") and e.bandes == (10, 20)
    e.ingester_signal("C1", "alerte_fondee", 2, T0)
    s_demi, _ = e.score_a_date("C1", t(30))
    base, _ = e.score_statique("C1")
    s0, _ = e.score_a_date("C1", T0)
    assert abs((s_demi - base) - (s0 - base) / 2) < 0.2   # half-life 30j respectée
