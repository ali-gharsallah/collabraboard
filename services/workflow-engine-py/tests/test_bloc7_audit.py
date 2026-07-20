"""Bloc 7 — Scénarios X-01 à X-05 du catalogue O-Live (R47-R51)."""
import dataclasses
import pytest
from datetime import datetime, timedelta
from olive_engine.domain import Engine

T0 = datetime(2026, 6, 1, 9, 0)
def t(days=0, hours=0): return T0 + timedelta(days=days, hours=hours)

MATRICE_V1 = {"exigences": {"Trust": {"entite": ["trust_deed"],
                                      "personne_liee": [], "compte": []}}}
MATRICE_V2 = {"exigences": {"Trust": {"entite": ["trust_deed", "registre_trustees"],
                                      "personne_liee": [], "compte": []}}}

@pytest.fixture
def eng():
    e = Engine()
    e.actifs |= {"V1", "V2", "VF"}
    e.referentiel.publier("matrice_documentaire", MATRICE_V1, T0)
    return e

def dossier_complet(eng, did, at):
    d = eng.creer_dossier(did, [("Identification", "V1"), ("Fiscalite", "V2")],
                          at, titulaire=f"TIT-{did[-4:]}", rm="RM1",
                          type_entite="Trust", juridiction="CH")
    for nom, val in (("Identification", "V1"), ("Fiscalite", "V2")):
        eng.modifier_donnee(d, nom, "U1", "champ", "v", at + timedelta(hours=1))
        eng.soumettre_au_visa(d, nom, "U1", at + timedelta(hours=2))
        eng.accorder_visa(d, nom, val, at + timedelta(hours=5))
    return d


# --- X-01 : Journalisation des lectures activable (R47)
def test_X01_journalisation_lectures(eng):
    d = dossier_complet(eng, "KYC-2026-CH-0701-R0", t(1))
    eng.config["journaliser_lectures"] = True
    eng.consulter_dossier(d, "EMP-CURIEUX", t(2))
    ev = eng.journal.of_type("dossier_consulte")
    assert ev and ev[0].actor == "EMP-CURIEUX" and ev[0].payload["dossier"] == d.id
    eng.config["journaliser_lectures"] = False
    eng.consulter_dossier(d, "EMP-2", t(3))
    assert len(eng.journal.of_type("dossier_consulte")) == 1   # écritures seules

# --- X-02 : Rejeu d'un cas à date antérieure (R48)
def test_X02_rejeu_a_date(eng):
    d = dossier_complet(eng, "KYC-2026-CH-0702-R0", t(1))
    eng.referentiel.publier("matrice_documentaire", MATRICE_V2, t(90))
    eng.modifier_donnee(d, "Fiscalite", "U2", "revenu", "2M", t(100))
    etat = eng.etat_a_date(d.id, t(45))
    assert etat["versions"]["matrice_documentaire"] == "v1"    # version du jour J
    types = [e.type for e in etat["evenements"]]
    assert "visa_accorde" in types
    assert "donnee_modifiee" in types
    assert not any(e.at > t(45) for e in etat["evenements"])   # rien du futur
    etat2 = eng.etat_a_date(d.id, t(120))
    assert etat2["versions"]["matrice_documentaire"] == "v2"

# --- X-03 : Correction sans effacement, immutabilité (R49)
def test_X03_immutabilite(eng):
    d = dossier_complet(eng, "KYC-2026-CH-0703-R0", t(1))
    eng.changement_circonstances(d, ["Fiscalite"], "correction", False, t(10))
    eng.modifier_donnee(d, "Fiscalite", "U1", "domicile", "GE", t(10, 1))   # erreur
    eng.modifier_donnee(d, "Fiscalite", "U1", "domicile", "VD", t(10, 2))   # correction
    modifs = [e for e in eng.journal.of_type("donnee_modifiee")
              if e.payload.get("champ") == "domicile"]
    assert len(modifs) == 2                                    # les deux subsistent
    ev = eng.journal.all()[0]
    with pytest.raises(dataclasses.FrozenInstanceError):       # événement immuable
        ev.type = "falsifie"
    assert not hasattr(eng.journal, "delete")                  # aucun droit d'effacement
    assert not hasattr(eng.journal, "remove")

# --- X-04 : Exports réglementaires standard (R50)
def test_X04_exports_standard(eng):
    d = dossier_complet(eng, "KYC-2026-CH-0704-R0", t(1))
    # une dérogation (R4)
    eng.absences.add("V1")
    eng.changement_circonstances(d, ["Identification"], "maj", False, t(5))
    eng.modifier_donnee(d, "Identification", "U1", "champ", "v2", t(5, 1))
    eng.soumettre_au_visa(d, "Identification", "U1", t(5, 2))
    eng.accorder_visa(d, "Identification", "V9", t(6),
                      derogation={"decideur": "PO1", "fiche_de_poste": "FP-1"})
    # un PEP, un hit
    eng.creer_personne("P-PEP", "Politicien", t(0))
    eng.lier_personne(d, "P-PEP", role="BE", at=t(6))
    eng.declarer_pep("P-PEP", source="coc", at=t(7))
    h = eng.creer_hit("P-PEP", profil="WC-1", domaine="pep", at=t(8))
    eng.qualifier_hit(h, "faux_positif", lod1="CO1", at=t(8, 1), justification="homonyme")
    # une recertification en retard
    eng.activer_dossier(d, t(9))
    eng.ouvrir_process(d, "recertification", t(10))
    assert eng.rapport_derogations()[0]["dossier"] == d.id
    assert "P-PEP" in [p["personne"] for p in eng.rapport_pep()]
    assert eng.rapport_hits()[0]["etat"] == "QUALIFIE_LOD1"
    retards = eng.rapport_retards_recertification(t(10 + 95), delai=timedelta(days=90))
    assert d.id in [r["dossier"] for r in retards]

# --- X-05 : Preuve du 4-yeux sur un lot de dossiers (R51)
def test_X05_preuve_quatre_yeux_sur_lot(eng):
    ids = []
    for i in (5, 6):
        d = dossier_complet(eng, f"KYC-2026-CH-070{i}-R0", t(i))
        ids.append(d.id)
    preuve = eng.preuve_quatre_yeux(ids)
    assert set(preuve.keys()) == set(ids)
    for did in ids:
        assert len(preuve[did]["chronologie"]) > 0             # extraction, pas reconstruction
        for section, detail in preuve[did]["visas"].items():
            assert detail["validateur"] not in detail["preparateurs"]  # 4-yeux démontré
            assert detail["conforme_4yeux"]
