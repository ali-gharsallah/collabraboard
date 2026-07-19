# -*- coding: utf-8 -*-
"""CPSI bloc 18 — R86 : visa qualifié (verdict OK/CONDITIONAL/NOK + message). VQ-01..06."""
import pytest
from datetime import datetime, timedelta
from olive_cpsi.kyc_visa import QualifiedVisa, VisaError

T0 = datetime(2026, 1, 1)
def t(d=0): return T0 + timedelta(hours=d)

@pytest.fixture
def vs():
    return QualifiedVisa()

# VQ-01 : visa OK sans message autorisé
def test_VQ01_ok_sans_message(vs):
    v = vs.apposer("aml/Compliance", "S. Marchand", "Compliance", "OK", "", t(1))
    assert v["verdict"] == "OK" and vs.verdict("aml/Compliance") == "OK"
    assert not vs.bloquant("aml/Compliance")

# VQ-02 : visa NOK EXIGE un message ; il est bloquant
def test_VQ02_nok_message_obligatoire(vs):
    with pytest.raises(VisaError):
        vs.apposer("aml/Compliance", "S. Marchand", "Compliance", "NOK", "", t(1))
    vs.apposer("aml/Compliance", "S. Marchand", "Compliance", "NOK", "SOF incohérent, refus.", t(1))
    assert vs.bloquant("aml/Compliance")

# VQ-03 : visa sous condition EXIGE un message
def test_VQ03_conditional_message_obligatoire(vs):
    with pytest.raises(VisaError):
        vs.apposer("sofsow/CO", "L. Morel", "CO", "CONDITIONAL", "  ", t(1))
    v = vs.apposer("sofsow/CO", "L. Morel", "CO", "CONDITIONAL", "OK si justificatif reçu sous 30j.", t(1))
    assert v["verdict"] == "CONDITIONAL" and v["message"].startswith("OK si")

# VQ-04 : seul le signataire peut retirer son visa
def test_VQ04_retrait_par_signataire(vs):
    vs.apposer("aml/Compliance", "S. Marchand", "Compliance", "OK", "", t(1))
    with pytest.raises(VisaError):
        vs.retirer("aml/Compliance", "Autre", t(2))
    vs.retirer("aml/Compliance", "S. Marchand", t(3))
    assert vs.verdict("aml/Compliance") is None

# VQ-05 : verdict invalide refusé
def test_VQ05_verdict_invalide(vs):
    with pytest.raises(VisaError):
        vs.apposer("aml/Compliance", "S. Marchand", "Compliance", "PEUT_ETRE", "", t(1))

# VQ-06 : chaque apposition est tracée (verdict + message)
def test_VQ06_trace(vs):
    vs.apposer("aml/Compliance", "S. Marchand", "Compliance", "CONDITIONAL", "sous réserve doc", t(1))
    e = vs.log[-1]
    assert e["action"] == "visa" and e["verdict"] == "CONDITIONAL" and e["message"] == "sous réserve doc"
