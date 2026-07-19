"""Bloc 5 — Scénarios T-01 à T-07 du catalogue O-Live (R37-R41)."""
import pytest
from datetime import datetime, timedelta
from olive_engine.domain import Engine, Document
from olive_engine.errors import NotAuthorized

T0 = datetime(2026, 7, 1, 9, 0)
def t(days=0, hours=0): return T0 + timedelta(days=days, hours=hours)

@pytest.fixture
def eng():
    e = Engine()
    e.actifs |= {"V1", "RM1", "RM2", "ARM1", "CF1", "CO1", "CO2"}
    e.role_membres = {"rm": {"RM1", "RM2"}, "central_file": {"CF1"},
                      "compliance": {"CO1", "CO2"}}
    e.scopes = {"RM1": {"KYC-A"}, "RM2": {"KYC-B"},
                "CO1": {"KYC-A", "KYC-B"}, "CO2": {"KYC-A", "KYC-B"},
                "CF1": {"KYC-A", "KYC-B"}}
    return e

@pytest.fixture
def dA(eng):
    return eng.creer_dossier("KYC-A", [("Identification", "V1")], t(0),
                             titulaire="TIT-A", rm="RM1")


# --- T-01 : Contrôle qualité documentaire par le Central File (R37)
def test_T01_controle_qualite_central_file(eng, dA):
    doc = Document("source_of_wealth", t(1), True, porteur="TIT-A")
    eng.deposer_document_central_file(dA, "Identification", doc, "RM1", t(1))
    qc = [x for x in eng.gestion_taches if x.type == "controle_qualite"]
    assert qc and qc[0].role == "central_file"
    assert not doc.controle_cf                    # pas encore réputé valide
    eng.controler_document(dA, doc, "CF1", t(2))
    assert doc.controle_cf
    assert eng.journal.of_type("document_controle_cf")

# --- T-02 : Assignation rôle puis personne (R38)
def test_T02_assignation_role_puis_personne(eng, dA):
    tache = eng.creer_tache("collecter_passeport", dA, role="rm", at=t(1))
    assert tache.role == "rm"
    assert tache.titulaire == "RM1"               # C est dans le scope de RM1
    assert tache.titulaire != "RM2"               # jamais vers un RM qui ignore C
    # ciblage explicite hors scope : refusé
    with pytest.raises(NotAuthorized):
        eng.creer_tache("collecter_facture", dA, role="rm", at=t(1), cible="RM2")

# --- T-03 : Délégation RM vers ARM, native (R38)
def test_T03_delegation_rm_arm(eng, dA):
    tache = eng.creer_tache("collecter_passeport", dA, role="rm", at=t(1))
    eng.deleguer_tache(tache, de="RM1", vers="ARM1", at=t(1, 2))
    assert tache.titulaire == "ARM1"
    ev = eng.journal.of_type("tache_deleguee")[0]
    assert ev.payload["de"] == "RM1" and ev.payload["vers"] == "ARM1"

# --- T-04 : SLA — mesure et notification, pas de coercition (R39)
def test_T04_sla_mesure_pas_coercition(eng, dA):
    tache = eng.creer_tache("traiter_alerte", dA, role="compliance", at=t(0),
                            sla=timedelta(hours=48))
    eng.tick_taches(t(3))                          # 72h : SLA dépassé
    assert tache.sla_depasse
    assert tache.etat == "OUVERTE"                 # rien n'est forcé
    assert eng.journal.of_type("sla_depasse")
    assert any(dest == "hierarchie" for dest, _ in eng.notifications)
    assert eng.compteurs_sla["compliance"] == 1    # alimente les tableaux

# --- T-05 : Vue de charge et réaffectation (R40)
def test_T05_vue_de_charge_et_reaffectation(eng, dA):
    t1 = eng.creer_tache("traiter_alerte", dA, role="compliance", at=t(0),
                         cible="CO1", sla=timedelta(hours=24))
    eng.creer_tache("revue_dossier", dA, role="compliance", at=t(0), cible="CO1")
    eng.tick_taches(t(2))
    charge = eng.vue_de_charge("compliance")
    assert charge["CO1"]["ouvertes"] == 2 and charge["CO1"]["en_retard"] == 1
    assert charge["CO2"]["ouvertes"] == 0
    eng.reaffecter_tache(t1, vers="CO2", manager="ChefCompliance", at=t(2, 1))
    assert t1.titulaire == "CO2"
    assert eng.journal.of_type("tache_reaffectee")[0].actor == "ChefCompliance"

# --- T-06 : Chaîne d'escalade de déblocage (R41)
def test_T06_chaine_escalade_deblocage(eng, dA):
    tache = eng.creer_tache("visa_urgent", dA, role="compliance", at=t(0), cible="CO1")
    eng.escalader_deblocage(tache, etape="application_manager", par="AM1", at=t(1))
    eng.escalader_deblocage(tache, etape="manager_fonction", par="ChefCompliance", at=t(1, 2))
    eng.escalader_deblocage(tache, etape="coo", par="COO", at=t(1, 4),
                            decision="reassigner:CO2")
    etapes = [e.payload["etape"] for e in eng.journal.of_type("escalade_deblocage")]
    assert etapes == ["application_manager", "manager_fonction", "coo"]
    assert eng.journal.of_type("decision_deblocage")[0].payload["decision"] == "reassigner:CO2"

# --- T-07 : Détection du risque homme-clé (R41)
def test_T07_risque_homme_cle(eng):
    eng.role_membres["validation_trust"] = {"V9"}   # V9 n'est pas actif
    eng.suppleants = {}
    eng.detecter_vacances(t(1))
    ev = eng.journal.of_type("risque_homme_cle")
    assert ev and ev[0].payload["role"] == "validation_trust"
    assert any(dest == "process_owner" for dest, _ in eng.notifications)
    assert "validation_trust" in [r["role"] for r in eng.rapport_risques_operationnels()]
