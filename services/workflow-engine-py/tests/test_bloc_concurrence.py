"""R53 — Concurrence optimiste (C-01..C-05). Tests écrits avant le code."""
import pytest
from datetime import datetime, timedelta
from olive_engine.domain import Engine
from olive_engine.errors import ConcurrencyConflict

T0 = datetime(2026, 7, 1, 9, 0)
def t(h): return T0 + timedelta(hours=h)

@pytest.fixture
def eng():
    e = Engine(); e.actifs |= {"V1", "VF"}; return e

@pytest.fixture
def dossier(eng):
    d = eng.creer_dossier("KYC-C-1", [("Identification", "V1")], T0)
    eng.definir_validation_finale(d, "VF", T0)
    return d

def test_C01_second_intervenant_perime_rejete_sans_effet(eng, dossier):
    v = eng.version(dossier)                       # CO1 et CO2 chargent v
    eng.modifier_donnee(dossier, "Identification", "CO1", "domicile", "GE", t(1),
                        expected_version=v)        # CO1 passe → v+1
    with pytest.raises(ConcurrencyConflict):
        eng.modifier_donnee(dossier, "Identification", "CO2", "domicile", "ZH", t(2),
                            expected_version=v)    # CO2 est périmé
    assert dossier.sections["Identification"].donnees["domicile"] == "GE", \
        "aucun effet de la commande périmée"
    assert eng.journal.of_type("conflit_concurrence"), "tentative tracée"

def test_C02_le_rejet_porte_la_version_courante(eng, dossier):
    v = eng.version(dossier)
    eng.modifier_donnee(dossier, "Identification", "CO1", "x", "1", t(1), expected_version=v)
    with pytest.raises(ConcurrencyConflict) as exc:
        eng.soumettre_au_visa(dossier, "Identification", "CO2", t(2), expected_version=v)
    assert str(eng.version(dossier)) in str(exc.value), "la version courante guide le rechargement"

def test_C03_commande_sans_version_reste_valide(eng, dossier):
    eng.modifier_donnee(dossier, "Identification", "CO1", "x", "1", t(1))
    eng.soumettre_au_visa(dossier, "Identification", "CO1", t(2))
    eng.accorder_visa(dossier, "Identification", "V1", t(3))

def test_C04_le_conflit_ne_consomme_pas_de_version(eng, dossier):
    v = eng.version(dossier)
    eng.modifier_donnee(dossier, "Identification", "CO1", "x", "1", t(1), expected_version=v)
    v_apres = eng.version(dossier)
    with pytest.raises(ConcurrencyConflict):
        eng.modifier_donnee(dossier, "Identification", "CO2", "x", "2", t(2), expected_version=v)
    assert eng.version(dossier) == v_apres, "le conflit n'incrémente pas la version"
    eng.modifier_donnee(dossier, "Identification", "CO2", "x", "2", t(3),
                        expected_version=eng.version(dossier))   # rechargé → passe

def test_C05_version_monotone_jamais_sur_lecture(eng, dossier):
    eng.config["journaliser_lectures"] = True
    v0 = eng.version(dossier)
    eng.consulter_dossier(dossier, "AUDITEUR", t(1))             # lecture R47
    assert eng.version(dossier) == v0, "une lecture n'incrémente pas la version"
    eng.modifier_donnee(dossier, "Identification", "CO1", "x", "1", t(2))
    assert eng.version(dossier) == v0 + 1
    eng.soumettre_au_visa(dossier, "Identification", "CO1", t(3))
    assert eng.version(dossier) == v0 + 2
