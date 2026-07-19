# -*- coding: utf-8 -*-
"""CPSI bloc 17 — R85 : passage de main entre validateurs (Next step / Revenir). HM-01..06."""
import pytest
from datetime import datetime, timedelta
from olive_cpsi.kyc_handoff import KycHandoff, HandoffError

T0 = datetime(2026, 1, 1)
def t(d=0): return T0 + timedelta(hours=d)
PHASES = ["ARM", "RM", "BRM", "Compliance", "Validation"]

@pytest.fixture
def wf():
    return KycHandoff(PHASES)

# HM-01 : next_step avance d'une phase ET exige un message
def test_HM01_next_step(wf):
    with pytest.raises(HandoffError):
        wf.next_step("ARM_Alice", "", t(1))          # message vide → refus
    assert wf.phase_courante() == "ARM"
    nxt = wf.next_step("ARM_Alice", "Sections Identité/Relation complétées, à toi RM.", t(1))
    assert nxt == "RM" and wf.phase_courante() == "RM"

# HM-02 : revenir recule d'une phase ET exige un message ; refus à la 1re étape
def test_HM02_revenir(wf):
    wf.next_step("ARM_Alice", "à toi", t(1))          # → RM
    with pytest.raises(HandoffError):
        wf.revenir("RM_Bob", "", t(2))                # message vide → refus
    wf.revenir("RM_Bob", "Il manque le justificatif SOF, je te rends la main.", t(2))
    assert wf.phase_courante() == "ARM"
    with pytest.raises(HandoffError):
        wf.revenir("ARM_Alice", "rien avant", t(3))   # déjà à la première étape

# HM-03 : chemin complet jusqu'à la section validation puis valider (message obligatoire)
def test_HM03_chemin_complet_validation(wf):
    for u in ["ARM", "RM", "BRM", "Compliance"]:
        wf.next_step(u, "passage " + u, t(1))
    assert wf.phase_courante() == "Validation" and wf.est_derniere()
    with pytest.raises(HandoffError):
        wf.valider("HoPB", "", t(2))                  # message obligatoire
    assert wf.valider("HoPB", "Dossier conforme, j'approuve.", t(3)) == "valide"

# HM-04 : valider n'est possible qu'à la dernière section ; rejet possible avec motif
def test_HM04_validation_seulement_a_la_fin(wf):
    with pytest.raises(HandoffError):
        wf.valider("RM_Bob", "trop tôt", t(1))        # pas à la section validation
    assert wf.rejeter("RM_Bob", "Incohérence patrimoine/activité — rejet motivé.", t(2)) == "rejete"

# HM-05 : après terminal, plus aucune transition
def test_HM05_terminal(wf):
    wf.rejeter("RM_Bob", "motif", t(1))
    for act in [lambda: wf.next_step("x", "m", t(2)),
                lambda: wf.revenir("x", "m", t(2)),
                lambda: wf.valider("x", "m", t(2))]:
        with pytest.raises(HandoffError):
            act()

# HM-06 : chaque passage est tracé (qui, message, de→à)
def test_HM06_trace(wf):
    wf.next_step("ARM_Alice", "à toi RM", t(1))
    wf.revenir("RM_Bob", "complète le SOF", t(2))
    assert wf.log[0]["action"] == "next_step" and wf.log[0]["de"] == "ARM" and wf.log[0]["a"] == "RM"
    assert wf.log[0]["user"] == "ARM_Alice" and wf.log[0]["message"] == "à toi RM"
    assert wf.log[1]["action"] == "revenir" and wf.log[1]["message"] == "complète le SOF"
