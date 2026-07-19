"""Bloc 4 — Scénarios P-01 à P-08 du catalogue O-Live (R30-R36)."""
import pytest
from datetime import datetime, timedelta
from olive_engine.domain import Engine, PersonneState
from olive_engine.errors import NotAuthorized, InvalidTransition

T0 = datetime(2026, 7, 1, 9, 0)
def t(days=0, hours=0): return T0 + timedelta(days=days, hours=hours)

@pytest.fixture
def eng():
    e = Engine()
    e.actifs |= {"V1"}
    e.config["cumul_roles_autorise"] = False
    e.config["depep_delai"] = timedelta(days=365)
    return e

@pytest.fixture
def cinq_dossiers(eng):
    eng.creer_personne("P-DUP", "M. Dupont", t(0), naissance="12.03.1965")
    ds = []
    for i in range(1, 6):
        d = eng.creer_dossier(f"KYC-2026-CH-010{i}-R0", [("Identification", "V1")],
                              t(0), titulaire=f"TIT-{i}", rm=f"RM{i}")
        eng.lier_personne(d, "P-DUP", role="signataire", at=t(0))
        ds.append(d)
    return ds


# --- P-01 : Propagation par événement CoC (R30)
def test_P01_propagation_par_coc(eng, cinq_dossiers):
    eng.notifications.clear()
    n_modifs_avant = len(eng.journal.of_type("donnee_modifiee"))
    eng.changement_circonstances_personne("P-DUP", "passeport", "X9988776", t(10),
                                          document="passeport")
    assert eng.journal.of_type("coc_personne_cree")
    assert ("maj_ged", "P-DUP", "passeport") in eng.taches
    dests = {dest for dest, _ in eng.notifications}
    assert {f"RM{i}" for i in range(1, 6)} <= dests            # les 5 RM alertés
    props = eng.journal.of_type("coc_propage")
    assert len(props) == 5                                      # propagé aux 5 dossiers
    # rien ne se modifie silencieusement dans les dossiers
    assert len(eng.journal.of_type("donnee_modifiee")) == n_modifs_avant

# --- P-02 : Cumul de rôles selon politique banque (R31)
def test_P02_cumul_selon_politique(eng):
    eng.creer_personne("P-SET", "Settlor S", t(0))
    d = eng.creer_dossier("KYC-2026-CH-0201-R0", [("Identification", "V1")],
                          t(0), titulaire="TRUST-Z", rm="RM1")
    eng.lier_personne(d, "P-SET", role="settlor", at=t(0))
    # politique : cumul interdit
    with pytest.raises(NotAuthorized):
        eng.lier_personne(d, "P-SET", role="beneficiaire", at=t(1))
    # politique : cumul autorisé -> flag de conflit obligatoire
    eng.config["cumul_roles_autorise"] = True
    eng.lier_personne(d, "P-SET", role="beneficiaire", at=t(1))
    assert "insider" in eng.personnes["P-SET"].flags

# --- P-03 : Flag insider exposé aux scénarios AML (R31)
def test_P03_flag_insider_expose_aml(eng):
    eng.config["cumul_roles_autorise"] = True
    eng.creer_personne("P-JP", "Juge et Partie", t(0))
    d = eng.creer_dossier("KYC-2026-CH-0301-R0", [("Identification", "V1")],
                          t(0), titulaire="OPCO", rm="RM1")
    eng.lier_personne(d, "P-JP", role="signataire", at=t(0))
    eng.lier_personne(d, "P-JP", role="beneficiaire", at=t(1))
    assert "insider" in eng.flags_aml("P-JP")
    assert eng.journal.of_type("flag_pose")

# --- P-04 : PEPisation contagieuse (R32)
def test_P04_pepisation_contagieuse(eng, cinq_dossiers):
    eng.notifications.clear()
    eng.declarer_pep("P-DUP", source="coc", at=t(20))
    assert eng.personnes["P-DUP"].statut_pep
    props = eng.journal.of_type("pep_propage")
    assert len(props) == 5
    reevals = [x for x in eng.taches if x[0] == "reevaluation_pep"]
    assert len(reevals) == 5                     # une tâche par dossier
    # aucune bascule silencieuse de risque : les dossiers ne changent pas d'état
    for d in cinq_dossiers:
        assert not eng.journal.of_type("dossier_suspendu")

# --- P-05 : Dé-PEPisation humaine, jamais automatique (R33)
def test_P05_depepisation_humaine(eng, cinq_dossiers):
    eng.declarer_pep("P-DUP", source="coc", at=t(20))
    eng.fin_mandat_pep("P-DUP", at=t(30))
    eng.tick_personnes(t(30 + 366))              # délai banque écoulé
    assert eng.personnes["P-DUP"].statut_pep     # toujours PEP : pas d'automatisme
    assert eng.journal.of_type("alerte_depep")   # alerte CoC émise
    assert any(dest in ("central_file", "RM1") for dest, _ in eng.notifications)
    eng.lever_pep("P-DUP", decideur="CF-Officer", at=t(30 + 370))
    assert not eng.personnes["P-DUP"].statut_pep
    ev = eng.journal.of_type("pep_leve")[0]
    assert ev.actor == "CF-Officer"

# --- P-06 : Bijectivité des relations informelles (R34)
def test_P06_bijectivite(eng):
    eng.creer_personne("P-DUP", "Dupont", t(0))
    eng.creer_personne("P-ALI", "Ali", t(0))
    eng.declarer_relation("P-DUP", "P-ALI", type_ab="pere", type_ba="fils", at=t(1))
    assert ("P-ALI", "pere") in eng.relations_de("P-DUP")
    assert ("P-DUP", "fils") in eng.relations_de("P-ALI")
    eng.supprimer_relation("P-DUP", "P-ALI", at=t(2))
    assert eng.relations_de("P-DUP") == []
    assert eng.relations_de("P-ALI") == []

# --- P-07 : Archivage d'une personne sans rôle (R35)
def test_P07_archivage(eng):
    eng.creer_personne("P-SOLO", "Solo", t(0), naissance="01.01.1980")
    d = eng.creer_dossier("KYC-2026-CH-0401-R0", [("Identification", "V1")],
                          t(0), titulaire="TIT", rm="RM1")
    eng.lier_personne(d, "P-SOLO", role="signataire", at=t(0))
    eng.retirer_role(d, "P-SOLO", role="signataire", at=t(5))
    p = eng.personnes["P-SOLO"]
    assert p.etat == PersonneState.ARCHIVEE      # plus aucun rôle nulle part
    assert p.donnees                              # données conservées (LBA)
    eng.lier_personne(d, "P-SOLO", role="trustee", at=t(10))  # réactivable
    assert p.etat == PersonneState.ACTIVE

# --- P-08 : Divergence d'identité arbitrée par le Central File (R36)
def test_P08_divergence_central_file(eng):
    eng.creer_personne("P-DUP", "Dupont", t(0), naissance="12.03.1965")
    dA = eng.creer_dossier("KYC-2026-CH-0501-R0", [("Identification", "V1")],
                           t(0), titulaire="A", rm="RM1")
    dB = eng.creer_dossier("KYC-2026-CH-0502-R0", [("Identification", "V1")],
                           t(0), titulaire="B", rm="RM2")
    eng.lier_personne(dA, "P-DUP", role="BE", at=t(0))
    eng.lier_personne(dB, "P-DUP", role="signataire", at=t(0))
    eng.signaler_divergence("P-DUP", champ="naissance",
                            constats={dA.id: "12.03.1965", dB.id: "21.03.1965"},
                            at=t(5))
    assert eng.journal.of_type("dossier_central_file_ouvert")
    assert ("corroboration", "P-DUP", "RM1") in eng.taches
    assert ("corroboration", "P-DUP", "RM2") in eng.taches
    assert eng.personnes["P-DUP"].donnees["naissance"] == "12.03.1965"  # pas de merge auto
    eng.resoudre_divergence("P-DUP", champ="naissance", valeur="21.03.1965",
                            document="acte_naissance", decideur="CF-Officer", at=t(9))
    assert eng.personnes["P-DUP"].donnees["naissance"] == "21.03.1965"
    ev = eng.journal.of_type("divergence_resolue")[0]
    assert ev.actor == "CF-Officer" and ev.payload["document"] == "acte_naissance"
