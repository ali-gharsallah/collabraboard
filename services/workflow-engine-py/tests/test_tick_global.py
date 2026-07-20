"""R54 — Déclencheur du temps (K-01..K-05). Tests écrits avant le code."""
import pytest
from datetime import datetime, timedelta
from olive_engine.domain import Engine

T0 = datetime(2026, 7, 1, 9, 0)
def t(d): return T0 + timedelta(days=d)

@pytest.fixture
def eng():
    e = Engine(); e.actifs |= {"V1", "VF", "RM1"}
    d = e.creer_dossier("K-T", [("Identification", "V1")], T0)
    e.definir_validation_finale(d, "VF", T0)
    e.modifier_donnee(d, "Identification", "RM1", "x", "1", T0)   # activité à J0
    return e

def _metier(e):
    """Événements métier = tout sauf le pilotage du scheduler lui-même."""
    return [ev for ev in e.journal.all()
            if ev.type not in ("tick_execute", "tick_refuse_horloge")]

def test_K01_un_appel_couvre_les_familles(eng):
    eng.creer_tache("visa", eng.dossiers["K-T"], "CO", t(0), sla=timedelta(days=5))
    bilan = eng.tick_global(t(31))
    types = {ev.type for ev in eng.journal.all()}
    assert "rappel_abandon" in types, "R19 couvert"
    assert "sla_depasse" in types, "R39 couvert"
    assert "screening_batch" in types, "R42 couvert"
    assert bilan["emis"] > 0

def test_K02_idempotence_meme_date(eng):
    eng.tick_global(t(31))
    avant = len(_metier(eng))
    bilan2 = eng.tick_global(t(31))
    assert len(_metier(eng)) == avant, "rejouer au même now n'émet rien"
    assert bilan2["emis"] == 0

def test_K03_rattrapage_en_une_passe_puis_rien(eng):
    eng.tick_global(t(10))                       # rien d'échu à J10
    bilan = eng.tick_global(t(95))               # rattrape J30/J60/J90 d'un coup
    types = [ev.type for ev in eng.journal.all()]
    assert types.count("rappel_abandon") <= 2 and "dossier_abandonne" in types, \
        "le rattrapage aboutit à l'état final sans sur-émission"
    assert eng.tick_global(t(95))["emis"] == 0

def test_K04_horloge_qui_recule_refusee_et_tracee(eng):
    eng.tick_global(t(31))
    avant = len(_metier(eng))
    bilan = eng.tick_global(t(20))               # NTP recule
    assert bilan.get("refuse") is True
    assert len(_metier(eng)) == avant, "aucun effet"
    assert eng.journal.of_type("tick_refuse_horloge"), "tentative tracée"

def test_K05_bilan_journalise_a_chaque_execution(eng):
    eng.tick_global(t(31)); eng.tick_global(t(32))
    exes = eng.journal.of_type("tick_execute")
    assert len(exes) == 2
    assert all("emis" in ev.payload for ev in exes)
    assert exes[0].payload["emis"] >= 0 and "now" in exes[0].payload
