"""Bloc 1 — Scénarios V-01 à V-17 du catalogue O-Live (R1-R15).
Chaque test porte l'ID de son scénario Gherkin. Contrat d'implémentation :
le moteur est conforme quand 100% passent."""
import pytest
from datetime import datetime, timedelta
from olive_engine.domain import (Engine, Document, VisaState, SectionState,
                                 FINAL_STEP)
from olive_engine.errors import (FourEyesViolation, MotivationRequired,
                                 RevocationNotAllowed, NotAuthorized,
                                 EngagementRequired)

T0 = datetime(2026, 7, 1, 9, 0)
def t(days=0, hours=0): return T0 + timedelta(days=days, hours=hours)

@pytest.fixture
def eng():
    e = Engine()
    e.actifs |= {"V1", "V2", "V3", "VF"}
    return e

@pytest.fixture
def dossier(eng):
    d = eng.creer_dossier("KYC-2026-CH-0001-R0",
                          [("Identification", "V1"), ("Fiscalite", "V2")], T0)
    eng.definir_validation_finale(d, "VF", T0)
    return d

def prepare_et_soumets(eng, d, section, preparateur="U1", at=None):
    at = at or t(0, 1)
    eng.modifier_donnee(d, section, preparateur, "champ", "valeur", at)
    eng.soumettre_au_visa(d, section, preparateur, at)


# --- V-01 : Visas parallèles sur sections distinctes (R1, R2)
def test_V01_visas_paralleles(eng, dossier):
    prepare_et_soumets(eng, dossier, "Identification")
    prepare_et_soumets(eng, dossier, "Fiscalite")
    eng.accorder_visa(dossier, "Identification", "V1", t(1))
    assert dossier.sections["Identification"].visa.etat == VisaState.ACCORDE
    assert dossier.sections["Fiscalite"].visa.etat == VisaState.EN_ATTENTE

# --- V-02 : Exclusion 4-yeux au niveau section, tentative tracée (R13)
def test_V02_exclusion_4yeux(eng, dossier):
    prepare_et_soumets(eng, dossier, "Identification", preparateur="V1")
    with pytest.raises(FourEyesViolation):
        eng.accorder_visa(dossier, "Identification", "V1", t(1))
    assert eng.journal.of_type("tentative_visa_refusee_4yeux")

# --- V-03 : Exclusion limitée à la section préparée (R3, R13)
def test_V03_exclusion_limitee_a_la_section(eng, dossier):
    eng.modifier_donnee(dossier, "Identification", "V2", "nom", "Dupont", t(0, 1))
    prepare_et_soumets(eng, dossier, "Fiscalite", preparateur="U1")
    eng.accorder_visa(dossier, "Fiscalite", "V2", t(1))  # V2 validateur de Fiscalite
    assert dossier.sections["Fiscalite"].visa.etat == VisaState.ACCORDE

# --- V-04 : Relais en cas d'absence du validateur (R4)
def test_V04_relais(eng, dossier):
    eng.absences.add("V1"); eng.relais["V1"] = "V3"
    prepare_et_soumets(eng, dossier, "Identification")
    assert dossier.sections["Identification"].visa.validateur == "V3"
    assert eng.journal.of_type("visa_route_vers_relais")
    eng.accorder_visa(dossier, "Identification", "V3", t(1))
    assert dossier.sections["Identification"].visa.etat == VisaState.ACCORDE

# --- V-05 : Dérogation tracée sans relais (R4)
def test_V05_derogation_tracee(eng, dossier):
    eng.absences.add("V1")  # pas de relais configuré
    prepare_et_soumets(eng, dossier, "Identification")
    eng.accorder_visa(dossier, "Identification", "V3", t(1),
                      derogation={"decideur": "process_owner_PO1",
                                  "fiche_de_poste": "FP-CO-12"})
    v = dossier.sections["Identification"].visa
    assert v.etat == VisaState.ACCORDE and v.sous_derogation
    ev = eng.journal.of_type("derogation_prononcee")[0]
    assert ev.actor == "process_owner_PO1"
    assert ev.payload["fiche_de_poste"] == "FP-CO-12"

# --- V-06 : Deux rappels puis escalade (R5)
def test_V06_rappels_puis_escalade(eng, dossier):
    prepare_et_soumets(eng, dossier, "Identification", at=T0)
    eng.tick(dossier, t(5));  assert dossier.sections["Identification"].visa.rappels == 1
    eng.tick(dossier, t(10)); assert dossier.sections["Identification"].visa.rappels == 2
    eng.tick(dossier, t(15))
    assert dossier.sections["Identification"].visa.escalade
    assert [e.payload.get("n") for e in eng.journal.of_type("visa_rappel")] == [1, 2]
    assert eng.journal.of_type("visa_escalade")

# --- V-07 : Document expirant pendant l'attente du visa (R5, R28)
def test_V07_document_expire_pendant_attente(eng, dossier):
    eng.ajouter_document(dossier, "Identification",
                         Document("passeport", recu_le=T0, valide_a_reception=True,
                                  expire_le=t(3)), "U1", T0)
    prepare_et_soumets(eng, dossier, "Identification", at=T0)
    eng.tick(dossier, t(4))
    assert dossier.sections["Identification"].visa.etat == VisaState.EN_ATTENTE
    assert ("collecte", dossier.id, "passeport") in eng.taches
    eng.accorder_visa(dossier, "Identification", "V1", t(4, 1))
    assert dossier.sections["Identification"].visa.etat == VisaState.ACCORDE

# --- V-08 : Invalidation du visa en attente sur modification (R6)
def test_V08_invalidation_sur_modification(eng, dossier):
    prepare_et_soumets(eng, dossier, "Fiscalite")
    eng.modifier_donnee(dossier, "Fiscalite", "U2", "domicile_fiscal", "FR", t(1))
    s = dossier.sections["Fiscalite"]
    assert s.visa.etat == VisaState.INVALIDE
    assert s.etat == SectionState.EN_PREPARATION
    assert any("V2" == dest for dest, _ in eng.notifications)

# --- V-09 : Invalidation ciblée — les autres visas survivent (R10)
def test_V09_invalidation_ciblee(eng, dossier):
    prepare_et_soumets(eng, dossier, "Identification")
    prepare_et_soumets(eng, dossier, "Fiscalite")
    eng.accorder_visa(dossier, "Identification", "V1", t(1))
    eng.accorder_visa(dossier, "Fiscalite", "V2", t(1))
    eng.modifier_donnee(dossier, "Fiscalite", "U2", "revenu", "1M", t(2))
    assert dossier.sections["Fiscalite"].visa.etat == VisaState.INVALIDE
    assert dossier.sections["Identification"].visa.etat == VisaState.ACCORDE

# --- V-10 : Refus motivé obligatoire (R7)
def test_V10_refus_motive_obligatoire(eng, dossier):
    prepare_et_soumets(eng, dossier, "Identification")
    with pytest.raises(MotivationRequired):
        eng.refuser_visa(dossier, "Identification", "V1", t(1))
    assert dossier.sections["Identification"].visa.etat == VisaState.EN_ATTENTE

# --- V-11 : Re-soumission au même validateur (R7)
def test_V11_resoumission_meme_validateur(eng, dossier):
    prepare_et_soumets(eng, dossier, "Identification")
    eng.refuser_visa(dossier, "Identification", "V1", t(1), motivation="Adresse incomplète")
    eng.modifier_donnee(dossier, "Identification", "U1", "adresse", "Versoix", t(2))
    eng.resoumettre(dossier, "Identification", "U1", t(2, 1))
    assert dossier.sections["Identification"].visa.validateur == "V1"

# --- V-12 : Refus puis départ du validateur (R7, R11)
def test_V12_depart_du_validateur(eng, dossier):
    prepare_et_soumets(eng, dossier, "Identification")
    eng.refuser_visa(dossier, "Identification", "V1", t(1), motivation="Pièce illisible")
    eng.actifs.discard("V1")  # V1 quitte la banque
    with pytest.raises(NotAuthorized):
        eng.resoumettre(dossier, "Identification", "U1", t(2))
    eng.reassigner_validateur(dossier, "Identification", "V3",
                              "PO1", "process_owner", t(2, 1), escalade_coo=False)
    eng.resoumettre(dossier, "Identification", "U1", t(2, 2))
    assert dossier.sections["Identification"].visa.validateur == "V3"
    assert eng.journal.of_type("validateur_reassigne")

# --- V-13 : Pas d'expiration calendaire du visa accordé (R8)
def test_V13_pas_expiration_calendaire(eng, dossier):
    prepare_et_soumets(eng, dossier, "Identification")
    eng.accorder_visa(dossier, "Identification", "V1", t(1))
    eng.tick(dossier, t(1 + 425))  # 14 mois plus tard, aucune modification
    assert dossier.sections["Identification"].visa.etat == VisaState.ACCORDE

# --- V-14 : Pas de révocation discrétionnaire (R9)
def test_V14_pas_de_revocation(eng, dossier):
    prepare_et_soumets(eng, dossier, "Fiscalite")
    eng.accorder_visa(dossier, "Fiscalite", "V2", t(1))
    with pytest.raises(RevocationNotAllowed):
        eng.tenter_revocation(dossier, "Fiscalite", "V2", t(2))
    assert dossier.sections["Fiscalite"].visa.etat == VisaState.ACCORDE
    assert eng.journal.of_type("tentative_revocation_refusee")

# --- V-15 : Annulation pour vice de process (R12, R14)
def test_V15_annulation_pour_vice(eng, dossier):
    prepare_et_soumets(eng, dossier, "Identification")
    eng.accorder_visa(dossier, "Identification", "V1", t(1))
    eng.annuler_pour_vice(dossier, "Identification", "délégation expirée",
                          "PO1", "VF", t(3))
    assert dossier.sections["Identification"].visa.etat == VisaState.ANNULE
    assert eng.journal.of_type("incident_risque_operationnel")
    ev = eng.journal.of_type("visa_annule_vice_process")[0]
    assert ev.actor == "PO1" and ev.payload["co_decideur"] == "VF"
    assert ev.payload["motif"] == "délégation expirée"

# --- V-16 : Validation finale globale = visa d'étape (R14, R15)
def test_V16_validation_finale_est_un_visa(eng, dossier):
    prepare_et_soumets(eng, dossier, "Identification")
    prepare_et_soumets(eng, dossier, "Fiscalite")
    eng.accorder_visa(dossier, "Identification", "V1", t(1))
    eng.accorder_visa(dossier, "Fiscalite", "V2", t(1))
    fin = dossier.sections[FINAL_STEP]
    assert fin.visa is not None and fin.visa.etat == VisaState.EN_ATTENTE
    assert ("visa_final", dossier.id, "VF") in eng.taches
    # R14 : pop-up d'engagement de responsabilité obligatoire
    with pytest.raises(EngagementRequired):
        eng.accorder_visa(dossier, FINAL_STEP, "VF", t(2))
    eng.accorder_visa(dossier, FINAL_STEP, "VF", t(2), engagement=True)
    assert fin.visa.etat == VisaState.ACCORDE
    assert eng.journal.of_type("engagement_responsabilite_confirme")

# --- V-17 : Invalidation de la validation finale sur modification (R6, R15)
def test_V17_invalidation_de_la_finale(eng, dossier):
    prepare_et_soumets(eng, dossier, "Identification")
    prepare_et_soumets(eng, dossier, "Fiscalite")
    eng.accorder_visa(dossier, "Identification", "V1", t(1))
    eng.accorder_visa(dossier, "Fiscalite", "V2", t(1))
    assert dossier.sections[FINAL_STEP].visa.etat == VisaState.EN_ATTENTE
    eng.modifier_donnee(dossier, "Fiscalite", "U2", "revenu", "2M", t(2))
    assert dossier.sections["Fiscalite"].visa.etat == VisaState.INVALIDE
    assert dossier.sections[FINAL_STEP].visa.etat == VisaState.INVALIDE
    assert dossier.sections[FINAL_STEP].etat == SectionState.EN_PREPARATION

# --- V-18 : Exclusion du contributeur au visa de validation finale (R52, ratifié 2026-07-12)
def test_V18_contributeur_exclu_de_la_finale(eng, dossier):
    # U1 contribue à une section quelconque du dossier…
    eng.modifier_donnee(dossier, "Identification", "U1", "domicile", "GE", t(0, 1))
    # …et se trouve être le validateur nommé de l'étape finale (via l'API : rejouable)
    eng.definir_validation_finale(dossier, "U1", t(0, 2))
    eng.soumettre_au_visa(dossier, "Identification", "U1", t(0, 3))
    eng.accorder_visa(dossier, "Identification", "V1", t(1))
    prepare_et_soumets(eng, dossier, "Fiscalite", preparateur="U2")
    eng.accorder_visa(dossier, "Fiscalite", "V2", t(1))
    with pytest.raises(FourEyesViolation):
        eng.accorder_visa(dossier, FINAL_STEP, "U1", t(2), engagement=True)
    # la tentative est tracée (même exigence que V-02)
    assert eng.journal.of_type("tentative_visa_refusee_4yeux")
    # et un non-contributeur peut, lui, signer
    eng.accorder_visa(dossier, FINAL_STEP, "VF", t(2), engagement=True,
                      derogation={"decideur": "PO1", "fiche_de_poste": "FP-CO"})
    assert dossier.sections[FINAL_STEP].visa.etat == VisaState.ACCORDE
