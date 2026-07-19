# -*- coding: utf-8 -*-
"""CPSI bloc 3 — R71 groupes · R72 barème par groupe · R73 scénarios AML ciblés · R74 transparence.
GP-01..05 · BG-01..03 · SC-01..03."""
import pytest
from datetime import datetime, timedelta
from olive_cpsi.engine import OliveCpsiEngine, CpsiError

T0 = datetime(2026, 1, 1)
def t(d=0): return T0 + timedelta(days=d)
BAS  = {"pays_risque": 0, "structure_risque": 1, "pep": False, "secteur_risque": 0}
HAUT = {"pays_risque": 3, "structure_risque": 3, "pep": True,  "secteur_risque": 2}

def _pop(e):
    # une petite population aux attributs métier variés
    specs = [
        ("C-NEG-HNWI", BAS,  {"secteur": "Négoce matières premières", "type": "PP",   "aum_band": "HNWI"}),
        ("C-ENE-UHNWI",BAS,  {"secteur": "Energie",                   "type": "SA",   "aum_band": "UHNWI"}),
        ("C-SANTE-MA", BAS,  {"secteur": "Santé",                     "type": "PP",   "aum_band": "Mass Affluent"}),
        ("C-PP-AFF",   BAS,  {"secteur": "Industrie",                 "type": "PP",   "aum_band": "Affluent"}),
        ("C-TRUST",    HAUT, {"secteur": "Energie",                   "type": "TRUST","aum_band": "HNWI"}),
    ]
    for cid, st, attr in specs:
        e.enregistrer_client(cid, st, T0, attributs=attr)
    return e

@pytest.fixture
def eng():
    return _pop(OliveCpsiEngine())

# --- GP-01 : groupe par secteur ∈ {x, y} — membres = exactement ces clients (R71)
def test_GP01_groupe_par_secteur(eng):
    eng.definir_groupe("G-NEGENE", "Négoce & Énergie", {
        "logique": "OU", "conditions": [
            {"champ": "secteur", "op": "eq", "val": "Négoce matières premières"},
            {"champ": "secteur", "op": "eq", "val": "Energie"}]}, T0)
    m = set(eng.membres("G-NEGENE", T0))
    assert m == {"C-NEG-HNWI", "C-ENE-UHNWI", "C-TRUST"}
    assert any(e["type"] == "groupe_defini" and e["groupe"] == "G-NEGENE" for e in eng.events)

# --- GP-02 : groupe par type = personne physique (R71)
def test_GP02_groupe_personnes_physiques(eng):
    eng.definir_groupe("G-PP", "Personnes physiques", {
        "logique": "ET", "conditions": [{"champ": "type", "op": "eq", "val": "PP"}]}, T0)
    assert set(eng.membres("G-PP", T0)) == {"C-NEG-HNWI", "C-SANTE-MA", "C-PP-AFF"}

# --- GP-03 : critère COUPLE (secteur × AUM) — composable (R71)
def test_GP03_couple_secteur_aum(eng):
    eng.definir_groupe("G-ENE-RICHE", "Énergie fortunés", {
        "logique": "ET", "conditions": [
            {"champ": "secteur", "op": "eq", "val": "Energie"},
            {"champ": "aum_band", "op": "in", "val": ["HNWI", "UHNWI"]}]}, T0)
    assert set(eng.membres("G-ENE-RICHE", T0)) == {"C-ENE-UHNWI", "C-TRUST"}

# --- GP-04 : chevauchement + priorité → groupe primaire déterministe (R71)
def test_GP04_priorite(eng):
    eng.definir_groupe("G-PP", "PP", {"logique": "ET",
        "conditions": [{"champ": "type", "op": "eq", "val": "PP"}]}, T0, priorite=50)
    eng.definir_groupe("G-NEG", "Négoce", {"logique": "ET",
        "conditions": [{"champ": "secteur", "op": "eq", "val": "Négoce matières premières"}]}, T0, priorite=10)
    # C-NEG-HNWI est PP ET Négoce → primaire = le plus prioritaire (priorite basse)
    assert set(g["id"] for g in eng.groupes_de("C-NEG-HNWI", T0)) == {"G-PP", "G-NEG"}
    assert eng.groupe_primaire("C-NEG-HNWI", T0) == "G-NEG"

# --- GP-05 : les groupes sont affichés EN CLAIR (R74)
def test_GP05_groupes_en_clair(eng):
    eng.definir_groupe("G-ENE-RICHE", "Énergie fortunés", {
        "logique": "ET", "conditions": [
            {"champ": "secteur", "op": "eq", "val": "Energie"},
            {"champ": "aum_band", "op": "in", "val": ["HNWI", "UHNWI"]}]}, T0, bareme={"bandes": (30, 60)})
    d = {g["id"]: g for g in eng.decrire_groupes(T0)}
    assert "secteur = Energie ET aum_band ∈" in d["G-ENE-RICHE"]["regle"]
    assert d["G-ENE-RICHE"]["bareme"] == "surchargé" and d["G-ENE-RICHE"]["effectif"] == 2

# --- BG-01 : un groupe avec son propre barème score ses membres différemment (R72)
def test_BG01_bareme_par_groupe(eng):
    eng.ingester_signal("C-NEG-HNWI", "velocite_tx", 2, t(5))
    s_global, _ = eng.score_a_date("C-NEG-HNWI", t(5))
    # groupe qui SURpondère la vélocité pour ce secteur
    eng.definir_groupe("G-NEG", "Négoce", {"logique": "ET",
        "conditions": [{"champ": "secteur", "op": "eq", "val": "Négoce matières premières"}]},
        t(6), priorite=10, bareme={"poids_signaux": {"velocite_tx": 20}})
    s_groupe, drivers = eng.score_a_date("C-NEG-HNWI", t(6))
    assert s_groupe > s_global                       # même client, barème du groupe
    assert any("velocite_tx" in d[0] for d in drivers)

# --- BG-02 : critère TRIPLE (secteur × AUM × score) avec barème propre (R72)
def test_BG02_triple_secteur_aum_score(eng):
    for _ in range(3):
        eng.ingester_signal("C-ENE-UHNWI", "hit_screening", 3, t(2))
    eng.definir_groupe("G-CRIT", "Énergie fortunés à risque", {
        "logique": "ET", "conditions": [
            {"champ": "secteur", "op": "eq", "val": "Energie"},
            {"champ": "aum_band", "op": "eq", "val": "UHNWI"},
            {"champ": "score", "op": "gte", "val": 30}]}, t(3),
        priorite=5, bareme={"bandes": (20, 40)})
    assert "C-ENE-UHNWI" in eng.membres("G-CRIT", t(3))
    assert eng.groupe_primaire("C-ENE-UHNWI", t(3)) == "G-CRIT"
    s, _ = eng.score_a_date("C-ENE-UHNWI", t(3))
    assert eng.bande(s, cfg=eng._cfg_client("C-ENE-UHNWI", t(3))) == "HIGH"   # bandes resserrées

# --- BG-03 : sans surcharge, un groupe hérite du barème global (R72)
def test_BG03_heritage(eng):
    eng.definir_groupe("G-PP", "PP", {"logique": "ET",
        "conditions": [{"champ": "type", "op": "eq", "val": "PP"}]}, T0)
    eng.ingester_signal("C-SANTE-MA", "alerte_fondee", 2, t(1))
    s_grp, _ = eng.score_a_date("C-SANTE-MA", t(2))
    cfg_glob = eng._cfg(t(2))
    s_glob, _ = eng.score_a_date("C-SANTE-MA", t(2), cfg=cfg_glob)
    assert s_grp == s_glob                            # aucun barème propre → identique

# --- SC-01 : un scénario AML ne prend QUE les membres des groupes ciblés (R73)
def test_SC01_scenario_cible(eng):
    eng.definir_groupe("G-PP", "PP", {"logique": "ET",
        "conditions": [{"champ": "type", "op": "eq", "val": "PP"}]}, T0)
    for _ in range(3):
        eng.ingester_signal("C-NEG-HNWI", "velocite_tx", 3, t(1))   # PP, franchit
        eng.ingester_signal("C-TRUST", "velocite_tx", 3, t(1))       # NON-PP, ignoré
    sc = eng.definir_scenario_aml("SCN-VELO", "Vélocité anormale", "score",
                                  {"G-PP": 20}, t(2))
    r = eng.evaluer_scenario("SCN-VELO", t(2))
    ids = set(h["client"] for h in r["hits"])
    assert "C-NEG-HNWI" in ids and "C-TRUST" not in ids    # hors périmètre = jamais évalué

# --- SC-02 : seuils PAR groupe — même scénario, seuil différent selon le groupe (R73)
def test_SC02_seuils_par_groupe(eng):
    eng.definir_groupe("G-MA", "Mass Affluent", {"logique": "ET",
        "conditions": [{"champ": "aum_band", "op": "eq", "val": "Mass Affluent"}]}, T0)
    eng.definir_groupe("G-UHNWI", "UHNWI", {"logique": "ET",
        "conditions": [{"champ": "aum_band", "op": "eq", "val": "UHNWI"}]}, T0)
    eng.ingester_signal("C-SANTE-MA", "alerte_fondee", 2, t(1))     # petit score
    eng.ingester_signal("C-ENE-UHNWI", "alerte_fondee", 2, t(1))
    # seuil bas pour Mass Affluent (sensible), haut pour UHNWI (tolérant)
    eng.definir_scenario_aml("SCN-ALERTE", "Alerte AML", "score",
                             {"G-MA": 10, "G-UHNWI": 60}, t(2))
    r = eng.evaluer_scenario("SCN-ALERTE", t(2))
    par_grp = {h["client"]: h["seuil"] for h in r["hits"]}
    assert par_grp.get("C-SANTE-MA") == 10             # franchit son seuil bas
    assert "C-ENE-UHNWI" not in par_grp                # ne franchit pas son seuil haut

# --- SC-03 : scénario sur groupe inexistant refusé ; hits tracés (R73/R74)
def test_SC03_default_deny_et_trace(eng):
    with pytest.raises(CpsiError):
        eng.definir_scenario_aml("X", "x", "score", {"G-INEXISTANT": 10}, T0)
    eng.definir_groupe("G-PP", "PP", {"logique": "ET",
        "conditions": [{"champ": "type", "op": "eq", "val": "PP"}]}, T0)
    eng.definir_scenario_aml("SCN", "s", "score", {"G-PP": 0}, t(1))
    eng.evaluer_scenario("SCN", t(1))
    assert any(e["type"] == "scenario_aml_evalue" and e["scenario"] == "SCN" for e in eng.events)
