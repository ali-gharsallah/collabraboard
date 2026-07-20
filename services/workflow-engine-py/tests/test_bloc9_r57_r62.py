"""Bloc 9 — R57 (récusation) & R62 (export d'audit scellé), RC-01..05 · EX-01..04.
Ajoutés au catalogue avant implémentation (méthode : spécification exécutable)."""
import pytest
from datetime import datetime, timedelta
from olive_engine.domain import (Engine, VisaState, FINAL_STEP)
from olive_engine.errors import (NotAuthorized, MotivationRequired, InvalidTransition)

T0 = datetime(2026, 7, 1, 9, 0)
def t(days=0, hours=0): return T0 + timedelta(days=days, hours=hours)

@pytest.fixture
def eng():
    e = Engine()
    e.actifs |= {"V1", "V2", "V3", "VF", "U1"}
    return e

@pytest.fixture
def dossier(eng):
    d = eng.creer_dossier("KYC-2026-CH-0910-R0",
                          [("Identification", "V1"), ("Fiscalite", "V2")], T0)
    eng.definir_validation_finale(d, "VF", T0)
    return d

def prepare_et_soumets(eng, d, section, preparateur="U1", at=None):
    at = at or t(0, 1)
    eng.modifier_donnee(d, section, preparateur, "champ", "valeur", at)
    eng.soumettre_au_visa(d, section, preparateur, at)


# ═══ R57 — Récusation ═══

# --- RC-01 : le validateur assigné se récuse avec motif → événement tracé, visa toujours en attente
def test_RC01_recusation_tracee(eng, dossier):
    prepare_et_soumets(eng, dossier, "Identification")
    eng.recuser_visa(dossier, "Identification", "V1", t(1),
                     motivation="Conflit d'intérêts : lien familial avec l'UBO")
    evs = [e for e in eng.journal.all() if e.type == "recusation_prononcee"]
    assert len(evs) == 1 and evs[0].actor == "V1"
    assert dossier.sections["Identification"].visa.etat == VisaState.EN_ATTENTE

# --- RC-02 : récusation sans motivation → refusée (même exigence que R7)
def test_RC02_motivation_obligatoire(eng, dossier):
    prepare_et_soumets(eng, dossier, "Identification")
    with pytest.raises(MotivationRequired):
        eng.recuser_visa(dossier, "Identification", "V1", t(1), motivation=None)

# --- RC-03 : après réassignation, le récusé ne peut plus JAMAIS viser cette section
def test_RC03_recuse_definitivement_exclu(eng, dossier):
    prepare_et_soumets(eng, dossier, "Identification")
    eng.recuser_visa(dossier, "Identification", "V1", t(1), motivation="Conflit d'intérêts")
    eng.reassigner_validateur(dossier, "Identification", "V3", "PO",
                              "process_owner", t(1, 1))
    with pytest.raises(NotAuthorized):
        eng.accorder_visa(dossier, "Identification", "V1", t(2))
    assert any(e.type == "tentative_visa_refusee_recusation" for e in eng.journal.all())
    # le nouveau validateur, lui, vise normalement
    eng.accorder_visa(dossier, "Identification", "V3", t(2, 1))
    assert dossier.sections["Identification"].visa.etat == VisaState.ACCORDE

# --- RC-04 : un tiers non assigné ne peut pas « se récuser »
def test_RC04_seul_l_assigne_se_recuse(eng, dossier):
    prepare_et_soumets(eng, dossier, "Identification")
    with pytest.raises(NotAuthorized):
        eng.recuser_visa(dossier, "Identification", "V2", t(1), motivation="—")
    with pytest.raises(InvalidTransition):
        eng.recuser_visa(dossier, "Fiscalite", "V2", t(1), motivation="—")  # pas de visa en attente

# --- RC-05 : récusation sur la validation finale → escalade au process owner
def test_RC05_escalade_finale(eng, dossier):
    for sec, val in [("Identification", "V1"), ("Fiscalite", "V2")]:
        prepare_et_soumets(eng, dossier, sec)
        eng.accorder_visa(dossier, sec, val, t(1))
    # R15 a soumis la finale à VF
    eng.recuser_visa(dossier, FINAL_STEP, "VF", t(2),
                     motivation="Conflit : ancien employeur du client")
    assert ("escalade_recusation_finale", dossier.id, "process_owner") in eng.taches
    assert any(e.type == "escalade_emise" for e in eng.journal.all())


# ═══ R62 — Export d'audit scellé ═══

# --- EX-01 : l'export contient la plage + un scellé, et il est LUI-MÊME journalisé
def test_EX01_export_journalise(eng, dossier):
    prepare_et_soumets(eng, dossier, "Identification")
    n = len(eng.journal.all())
    exp = eng.exporter_audit_scelle("Auditeur", t(3))
    assert len(exp["evenements"]) == n and len(exp["scelle"]) == 64
    evs = [e for e in eng.journal.all() if e.type == "export_scelle_emis"]
    assert len(evs) == 1 and evs[0].payload["scelle"] == exp["scelle"]

# --- EX-02 : un export intact se vérifie
def test_EX02_verification_ok(eng, dossier):
    prepare_et_soumets(eng, dossier, "Identification")
    exp = eng.exporter_audit_scelle("Auditeur", t(3))
    assert Engine.verifier_export_scelle(exp) is True

# --- EX-03 : toute altération casse le scellé
def test_EX03_alteration_detectee(eng, dossier):
    prepare_et_soumets(eng, dossier, "Identification")
    exp = eng.exporter_audit_scelle("Auditeur", t(3))
    exp["evenements"][0] = exp["evenements"][0].replace('"seq":1', '"seq":9', 1)
    assert Engine.verifier_export_scelle(exp) is False

# --- EX-04 : déterminisme — deux exports de la même plage portent le même scellé
def test_EX04_determinisme(eng, dossier):
    prepare_et_soumets(eng, dossier, "Identification")
    fin = len(eng.journal.all())
    e1 = eng.exporter_audit_scelle("Auditeur", t(3), 1, fin)
    e2 = eng.exporter_audit_scelle("Auditeur", t(4), 1, fin)
    assert e1["scelle"] == e2["scelle"]
