"""Bloc 6 — Scénarios A-01 à A-07 du catalogue O-Live (R42-R46)."""
import pytest
from datetime import datetime, timedelta
from olive_engine.domain import Engine, DossierState, VisaState
from olive_engine.errors import MotivationRequired

T0 = datetime(2026, 7, 1, 9, 0)
def t(days=0, hours=0): return T0 + timedelta(days=days, hours=hours)

@pytest.fixture
def eng():
    e = Engine()
    e.actifs |= {"V1", "V2", "VF"}
    return e

@pytest.fixture
def dup_2_dossiers(eng):
    eng.creer_personne("P-DUP", "M. Dupont", t(0),
                       naissance="12.03.1965", nationalite="FR")
    ds = []
    for i in (1, 2):
        d = eng.creer_dossier(f"KYC-2026-CH-060{i}-R0", [("Identification", "V1")],
                              t(0), titulaire=f"TIT-{i}", rm=f"RM{i}")
        eng.lier_personne(d, "P-DUP", role="BE", at=t(0))
        eng.activer_dossier(d, t(0, 1))
        ds.append(d)
    return ds


# --- A-01 : Screening perpétuel multi-fréquences (R42)
def test_A01_screening_perpetuel(eng, dup_2_dossiers):
    assert eng.config["screening_freq"]["positions"] == timedelta(days=1)
    assert eng.config["screening_freq"]["pep"] == timedelta(days=7)
    for j in range(1, 8):
        eng.tick_screening(t(j))
    batches = eng.journal.of_type("screening_batch")
    assert sum(1 for b in batches if b.payload["domaine"] == "positions") == 7
    assert sum(1 for b in batches if b.payload["domaine"] == "pep") == 1
    eng.config["screening_freq"]["pep"] = timedelta(days=2)   # paramétrable
    eng.tick_screening(t(9))
    assert sum(1 for b in eng.journal.of_type("screening_batch")
               if b.payload["domaine"] == "pep") == 2

# --- A-02 : Rescreening sur modification d'identité (R42)
def test_A02_rescreening_identite(eng, dup_2_dossiers):
    eng.changement_circonstances_personne("P-DUP", "nationalite", "TN", t(5))
    ev = eng.journal.of_type("rescreening_declenche")
    assert ev and ev[0].payload["personne"] == "P-DUP"
    assert ev[0].payload["cause"] == "coc:nationalite"

# --- A-03 : Cycle du hit en deux lignes de défense (R43)
def test_A03_hit_deux_lignes_defense(eng, dup_2_dossiers):
    hit = eng.creer_hit("P-DUP", profil="WC-889123", domaine="sanctions", at=t(1))
    assert hit.etat == "NOUVEAU"
    with pytest.raises(MotivationRequired):                    # justification obligatoire
        eng.qualifier_hit(hit, "faux_positif", lod1="CO1", at=t(1, 2))
    eng.qualifier_hit(hit, "faux_positif", lod1="CO1", at=t(1, 2),
                      justification="homonyme, date de naissance différente")
    assert hit.etat == "QUALIFIE_LOD1"
    eng.confirmer_cloture_hit(hit, lod2="MLRO", at=t(1, 4))
    assert hit.etat == "CLOTURE_FAUX_POSITIF"
    assert eng.journal.of_type("hit_clos_lod2")[0].actor == "MLRO"

# --- A-04 : Whitelist justifiée par la récurrence (R44)
def test_A04_whitelist_recurrence(eng, dup_2_dossiers):
    for i in range(5):                                         # 5 faux positifs identiques
        h = eng.creer_hit("P-DUP", profil="WC-889123", domaine="sanctions", at=t(i))
        eng.qualifier_hit(h, "faux_positif", lod1="CO1", at=t(i, 1),
                          justification="homonyme")
        eng.confirmer_cloture_hit(h, lod2="MLRO", at=t(i, 2))
    with pytest.raises(MotivationRequired):
        eng.ajouter_whitelist("P-DUP", "WC-889123", responsable="CO1", at=t(6))
    eng.ajouter_whitelist("P-DUP", "WC-889123", responsable="CO1", at=t(6),
                          justification="faux positif récurrent : 5 clôtures homonyme")
    h6 = eng.creer_hit("P-DUP", profil="WC-889123", domaine="sanctions", at=t(7))
    assert h6 is None                                          # plus régénéré
    assert eng.journal.of_type("hit_ignore_whitelist")

# --- A-05 : Sortie de whitelist — IA analyse, humain décide (R44)
def test_A05_whitelist_ia_humain(eng, dup_2_dossiers):
    eng.ajouter_whitelist("P-DUP", "WC-889123", responsable="CO1", at=t(1),
                          justification="récurrence")
    eng.changement_circonstances_personne("P-DUP", "naissance", "21.03.1965", t(5))
    ia = eng.journal.of_type("analyse_ia_whitelist")
    assert ia and "naissance" in ia[0].payload["impact"]
    assert ("P-DUP", "WC-889123") in eng.whitelist               # rien d'automatique
    eng.decider_whitelist("P-DUP", "WC-889123", decision="sortie",
                          decideur="CO1", at=t(5, 2))
    assert ("P-DUP", "WC-889123") not in eng.whitelist
    ev = eng.journal.of_type("decision_whitelist")[0]
    assert ev.actor == "CO1" and ev.payload["decision"] == "sortie"

# --- A-06 : Hit sanctions confirmé (R45, R17)
def test_A06_hit_sanctions_confirme(eng, dup_2_dossiers):
    d1, d2 = dup_2_dossiers
    hit = eng.creer_hit("P-DUP", profil="WC-IRAN-77", domaine="sanctions", at=t(1))
    eng.confirmer_hit(hit, decideurs=["Compliance", "RM1", "RM2"], at=t(2))
    assert d1.etat == DossierState.SUSPENDU and d2.etat == DossierState.SUSPENDU
    offb = [p for d in (d1, d2) for p in d.processes
            if p.type == "offboarding_distressed"]
    assert len(offb) == 2
    ev = eng.journal.of_type("hit_confirme")[0]
    assert "Compliance" in ev.payload["decideurs"]

# --- A-07 : Hit pendant la validation — gel et comité (R46)
def test_A07_hit_pendant_validation(eng):
    d = eng.creer_dossier("KYC-2026-CH-0699-R0",
                          [("Identification", "V1"), ("Fiscalite", "V2")],
                          t(0), titulaire="TIT-9", rm="RM1")
    eng.creer_personne("P-X", "X", t(0))
    eng.lier_personne(d, "P-X", role="BE", at=t(0))
    for nom in ("Identification", "Fiscalite"):
        eng.modifier_donnee(d, nom, "U1", "champ", "v", t(0, 1))
        eng.soumettre_au_visa(d, nom, "U1", t(0, 2))
    hit = eng.creer_hit("P-X", profil="WC-555", domaine="sanctions", at=t(1))
    eng.geler_pour_hit(d, hit, delai_analyse=timedelta(days=10), at=t(1))
    assert d.sections["Identification"].visa.etat == VisaState.GELE
    assert d.sections["Fiscalite"].visa.etat == VisaState.GELE
    assert eng.journal.of_type("visas_geles")
    eng.decider_comite(d, hit, decision="poursuite",
                       membres=["BRM", "COO", "Compliance"], at=t(8))
    assert d.sections["Identification"].visa.etat == VisaState.EN_ATTENTE
    ev = eng.journal.of_type("decision_comite_risk_compliance")[0]
    assert ev.payload["decision"] == "poursuite" and "COO" in ev.payload["membres"]
