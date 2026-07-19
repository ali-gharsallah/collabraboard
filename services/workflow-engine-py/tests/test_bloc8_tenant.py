"""Bloc 8 — R56 : règles tenant (RT-01 à RT-08).
Parité stricte avec le moteur JS : mêmes types de règles, mêmes gardes,
mêmes événements. Invariant : une règle tenant ne peut QUE durcir."""
import pytest
from datetime import datetime, timedelta
from olive_engine.domain import (Engine, VisaState, FINAL_STEP)
from olive_engine.errors import (RegleTenantInvalide, RegleTenantViolation,
                                 MotivationRequired)

T0 = datetime(2026, 7, 1, 9, 0)
def t(days=0, hours=0): return T0 + timedelta(days=days, hours=hours)

@pytest.fixture
def eng():
    e = Engine()
    e.actifs |= {"V1", "V2", "VF", "U1", "U2"}
    return e

@pytest.fixture
def dossier(eng):
    d = eng.creer_dossier("KYC-2026-CH-0900-R0",
                          [("Identification", "V1"), ("Fiscalite", "V2")], T0)
    eng.definir_validation_finale(d, "VF", T0)
    return d

def prepare_et_soumets(eng, d, section, preparateur="U1", at=None):
    at = at or t(0, 1)
    eng.modifier_donnee(d, section, preparateur, "champ", "valeur", at)
    eng.soumettre_au_visa(d, section, preparateur, at)


# --- RT-01 : default-deny — un type inconnu est refusé AVANT tout effet
def test_RT01_type_inconnu_refuse(eng):
    with pytest.raises(RegleTenantInvalide):
        eng.ajouter_regle_tenant(
            {"id": "RT-X", "type": "assouplirQuatreYeux", "params": {}}, "Admin", T0)
    assert eng.regles_tenant == []
    assert not [e for e in eng.journal.all() if e.type == "regle_tenant_ajoutee"]

# --- RT-02 : l'ajout d'une règle valide est un événement journalisé
def test_RT02_ajout_journalise(eng):
    eng.ajouter_regle_tenant({"id": "RT-MIN2", "type": "minPreparateurs",
                              "params": {"n": 2}, "source": "manuel",
                              "justification": "Exigence banque pilote"}, "Admin", T0)
    evs = [e for e in eng.journal.all() if e.type == "regle_tenant_ajoutee"]
    assert len(evs) == 1 and evs[0].payload["regle"] == "RT-MIN2"

# --- RT-03 : minPreparateurs bloque à 1 contributeur, passe à 2
def test_RT03_min_preparateurs(eng, dossier):
    eng.ajouter_regle_tenant({"id": "RT-MIN2", "type": "minPreparateurs",
                              "params": {"n": 2}}, "Admin", T0)
    prepare_et_soumets(eng, dossier, "Identification", "U1")
    with pytest.raises(RegleTenantViolation):
        eng.accorder_visa(dossier, "Identification", "V1", t(1))
    # deuxième contributeur -> re-soumission -> visa passe
    eng.modifier_donnee(dossier, "Identification", "U2", "champ2", "v", t(1, 1))
    eng.soumettre_au_visa(dossier, "Identification", "U2", t(1, 2))
    eng.accorder_visa(dossier, "Identification", "V1", t(2))
    assert dossier.sections["Identification"].visa.etat == VisaState.ACCORDE

# --- RT-04 : sectionsPrealables impose l'ordre entre sections
def test_RT04_sections_prealables(eng, dossier):
    eng.ajouter_regle_tenant({"id": "RT-ORD", "type": "sectionsPrealables",
                              "params": {"section": "Fiscalite",
                                         "avant": "Identification"}}, "Admin", T0)
    prepare_et_soumets(eng, dossier, "Fiscalite", "U1")
    with pytest.raises(RegleTenantViolation):
        eng.accorder_visa(dossier, "Fiscalite", "V2", t(1))
    prepare_et_soumets(eng, dossier, "Identification", "U2", t(1, 1))
    eng.accorder_visa(dossier, "Identification", "V1", t(1, 2))
    eng.accorder_visa(dossier, "Fiscalite", "V2", t(1, 3))
    assert dossier.sections["Fiscalite"].visa.etat == VisaState.ACCORDE

# --- RT-05 : quatreYeuxRenforce — tout contributeur du dossier est exclu
def test_RT05_quatre_yeux_renforce(eng, dossier):
    eng.ajouter_regle_tenant({"id": "RT-4YR", "type": "quatreYeuxRenforce",
                              "params": {}}, "Admin", T0)
    # V2 contribue à Identification puis tente de viser Fiscalite (autre section)
    eng.modifier_donnee(dossier, "Identification", "V2", "champ", "v", t(0, 1))
    prepare_et_soumets(eng, dossier, "Fiscalite", "U1", t(0, 2))
    with pytest.raises(RegleTenantViolation):
        eng.accorder_visa(dossier, "Fiscalite", "V2", t(1))

# --- RT-06 : engagementSection étend le pop-up R14 à une section donnée
def test_RT06_engagement_section(eng, dossier):
    eng.ajouter_regle_tenant({"id": "RT-ENG", "type": "engagementSection",
                              "params": {"section": "Fiscalite"}}, "Admin", T0)
    prepare_et_soumets(eng, dossier, "Fiscalite", "U1")
    with pytest.raises(RegleTenantViolation):
        eng.accorder_visa(dossier, "Fiscalite", "V2", t(1))
    eng.accorder_visa(dossier, "Fiscalite", "V2", t(1, 1), engagement=True)
    assert dossier.sections["Fiscalite"].visa.etat == VisaState.ACCORDE

# --- RT-07 : motifRefusMin durcit R7 (la motivation vide reste R7)
def test_RT07_motif_refus_min(eng, dossier):
    eng.ajouter_regle_tenant({"id": "RT-M40", "type": "motifRefusMin",
                              "params": {"n": 40}}, "Admin", T0)
    prepare_et_soumets(eng, dossier, "Identification", "U1")
    with pytest.raises(MotivationRequired):
        eng.refuser_visa(dossier, "Identification", "V1", t(1), motivation=None)
    with pytest.raises(RegleTenantViolation):
        eng.refuser_visa(dossier, "Identification", "V1", t(1), motivation="trop court")
    eng.refuser_visa(dossier, "Identification", "V1", t(1),
                     motivation="Justificatif d'origine des fonds manquant pour le trust — pièce requise.")
    assert dossier.sections["Identification"].visa.etat == VisaState.REFUSE

# --- RT-08 : désactivation tracée -> la règle devient inerte, réactivation la restaure
def test_RT08_desactivation_tracee(eng, dossier):
    eng.ajouter_regle_tenant({"id": "RT-MIN2", "type": "minPreparateurs",
                              "params": {"n": 2}}, "Admin", T0)
    eng.activer_regle_tenant("RT-MIN2", False, "Admin", t(0, 1))
    prepare_et_soumets(eng, dossier, "Identification", "U1", t(0, 2))
    eng.accorder_visa(dossier, "Identification", "V1", t(1))   # inerte -> passe
    assert dossier.sections["Identification"].visa.etat == VisaState.ACCORDE
    evs = [e.type for e in eng.journal.all()]
    assert "regle_tenant_desactivee" in evs
    eng.activer_regle_tenant("RT-MIN2", True, "Admin", t(1, 1))
    prepare_et_soumets(eng, dossier, "Fiscalite", "U1", t(1, 2))
    with pytest.raises(RegleTenantViolation):
        eng.accorder_visa(dossier, "Fiscalite", "V2", t(2))
