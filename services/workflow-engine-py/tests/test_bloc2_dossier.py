"""Bloc 2 — Scénarios D-01 à D-09 du catalogue O-Live (R16-R23)."""
import pytest
from datetime import datetime, timedelta
from olive_engine.domain import (Engine, DossierState, SectionState, VisaState)
from olive_engine.errors import InvalidTransition

T0 = datetime(2026, 7, 1, 9, 0)
def t(days=0, hours=0): return T0 + timedelta(days=days, hours=hours)

@pytest.fixture
def eng():
    e = Engine()
    e.actifs |= {"V1", "V2", "VF"}
    # Paramétrage tenant (R17) : régime MROS par défaut pour les tests
    e.config["restrictions_suspendu"] = {"entrees": True, "sorties": False}
    e.config["notifier_client_suspension"] = False
    return e

@pytest.fixture
def dossier(eng):
    d = eng.creer_dossier("KYC-2026-CH-0002-R0",
                          [("Identification", "V1"), ("Fiscalite", "V2")],
                          T0, titulaire="P-DUPONT", rm="RM1")
    return d

def activer(eng, d):
    for nom in ("Identification", "Fiscalite"):
        eng.modifier_donnee(d, nom, "U1", "champ", "v", t(0, 1))
        eng.soumettre_au_visa(d, nom, "U1", t(0, 2))
    eng.accorder_visa(d, "Identification", "V1", t(0, 3))
    eng.accorder_visa(d, "Fiscalite", "V2", t(0, 3))
    eng.activer_dossier(d, t(0, 4))
    return d


# --- D-01 : Passage en Suspendu sur alerte (R16, R17)
def test_D01_suspension_sur_alerte(eng, dossier):
    activer(eng, dossier)
    eng.rattacher_alerte(dossier, "hit-screening-non-resolu", t(1))
    assert dossier.etat == DossierState.SUSPENDU
    assert eng.journal.of_type("dossier_suspendu")

# --- D-02 : Suspension discrète type MROS (R17)
def test_D02_suspension_discrete_mros(eng, dossier):
    activer(eng, dossier)
    eng.suspendre(dossier, cause="communication MROS", at=t(1))
    assert eng.operation_autorisee(dossier, "entree") is True
    assert eng.operation_autorisee(dossier, "sortie") is False
    assert not any(dest == "P-DUPONT" for dest, _ in eng.notifications)  # art. 9a LBA

# --- D-03 : Rejet et détection de retour du prospect (R18)
def test_D03_rejet_et_retour_prospect(eng, dossier):
    eng.rejeter(dossier, motif="source of wealth non corroborée", at=t(1))
    assert dossier.etat == DossierState.REJETE
    d2 = eng.creer_dossier("KYC-2026-CH-0099-R0", [("Identification", "V1")],
                           t(180), titulaire="P-DUPONT", rm="RM2")
    ev = eng.journal.of_type("prospect_refuse_detecte")
    assert ev and ev[-1].payload["motif_initial"] == "source of wealth non corroborée"
    assert ev[-1].payload["dossier"] == "KYC-2026-CH-0099-R0"

# --- D-04 : Abandon progressif (R19)
def test_D04_abandon_progressif(eng, dossier):
    eng.modifier_donnee(dossier, "Identification", "U1", "nom", "Dupont", t(0, 1))
    eng.tick(dossier, t(30, 1)); assert dossier.rappels_abandon == 1
    assert ("RM1", f"Rappel 1 : dossier {dossier.id} inactif") in eng.notifications
    eng.tick(dossier, t(60, 1)); assert dossier.rappels_abandon == 2
    eng.tick(dossier, t(90, 1))
    assert dossier.etat == DossierState.ABANDONNE
    eng.reactiver(dossier, t(120))
    assert dossier.etat == DossierState.EN_PREPARATION

# --- D-05 : Conservation LBA prime sur effacement (R20)
def test_D05_conservation_lba(eng, dossier):
    eng.modifier_donnee(dossier, "Identification", "U1", "nom", "Dupont", t(0, 1))
    eng.tick(dossier, t(30, 1)); eng.tick(dossier, t(60, 1)); eng.tick(dossier, t(90, 1))
    assert dossier.etat == DossierState.ABANDONNE
    eng.demande_effacement_lpd(dossier, demandeur="P-DUPONT", at=t(100))
    assert eng.journal.of_type("effacement_refuse_conservation_lba")
    assert dossier.lecture_seule
    with pytest.raises(InvalidTransition):
        eng.modifier_donnee(dossier, "Identification", "U1", "nom", "X", t(101))
    assert len(eng.journal.for_dossier(dossier.id)) > 0  # consultable

# --- D-06 : Réouverture ciblée, client opérationnel (R21)
def test_D06_reouverture_ciblee(eng, dossier):
    activer(eng, dossier)
    eng.changement_circonstances(dossier, sections=["Fiscalite"],
                                 description="changement domicile fiscal",
                                 risque_majeur=False, at=t(10))
    assert dossier.sections["Fiscalite"].etat == SectionState.EN_PREPARATION
    assert dossier.sections["Identification"].etat == SectionState.VISEE
    assert dossier.etat == DossierState.EN_MISE_A_JOUR
    assert eng.client_operationnel(dossier)

# --- D-07 : Changement à risque majeur (R21, R22)
def test_D07_risque_majeur(eng, dossier):
    activer(eng, dossier)
    eng.changement_circonstances(dossier, sections=["Identification"],
                                 description="nouveau BE pays sous sanctions",
                                 risque_majeur=True, at=t(10))
    assert dossier.etat == DossierState.SUSPENDU
    assert dossier.sections["Identification"].etat == SectionState.EN_PREPARATION
    assert any(dest == "MLRO" for dest, _ in eng.notifications)

# --- D-08 : Collision recertification / événement (R23)
def test_D08_collision_process(eng, dossier):
    activer(eng, dossier)
    recert = eng.ouvrir_process(dossier, "recertification", t(30))
    evt = eng.ouvrir_process(dossier, "evenement", t(35))
    assert recert.etat == "EN_PAUSE"
    assert evt.etat == "EN_COURS"
    assert eng.journal.of_type("process_mis_en_pause")
    assert set(e.payload["process"] for e in eng.journal.all()
               if "process" in e.payload) >= {recert.id, evt.id}  # audit trails propres

# --- D-09 : Absorption des sections revalidées (R23)
def test_D09_absorption(eng, dossier):
    activer(eng, dossier)
    recert = eng.ouvrir_process(dossier, "recertification", t(30))
    evt = eng.ouvrir_process(dossier, "evenement", t(35))
    # L'événement revalide Identification
    eng.modifier_donnee(dossier, "Identification", "U1", "nationalite", "CH",
                        t(35, 1), process=evt)
    eng.soumettre_au_visa(dossier, "Identification", "U1", t(35, 2), process=evt)
    eng.accorder_visa(dossier, "Identification", "V1", t(38), process=evt)
    eng.cloturer_process(dossier, evt, t(38, 1))
    plan = eng.reprendre_recertification(dossier, recert, t(38, 2))
    assert recert.etat == "EN_COURS"
    assert plan["Identification"] == f"absorbe:{evt.id}"
    assert plan["Fiscalite"] == "a_revalider"
    ev = eng.journal.of_type("section_absorbee")[0]
    assert ev.payload["section"] == "Identification"
    assert ev.payload["source"] == evt.id
