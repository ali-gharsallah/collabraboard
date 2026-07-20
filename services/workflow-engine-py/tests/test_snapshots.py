"""R55 — Snapshots de reprise (SN-01..SN-05). Tests écrits avant le code."""
import pytest
from datetime import datetime, timedelta
from olive_engine.domain import Engine
from olive_engine.snapshots import SnapshotStore, prendre_snapshot, restaurer_dossier

T0 = datetime(2026, 7, 1, 9, 0)
def t(h): return T0 + timedelta(hours=h)

def dossier_riche(e):
    d = e.creer_dossier("K-SN", [("Identification", "V1"), ("Fiscalite", "V2")], T0,
                        titulaire="P-1", rm="RM1")
    e.definir_validation_finale(d, "VF", T0)
    e.modifier_donnee(d, "Identification", "U1", "domicile", "GE", t(1))
    e.soumettre_au_visa(d, "Identification", "U1", t(1))
    e.accorder_visa(d, "Identification", "V1", t(2))
    e.modifier_donnee(d, "Fiscalite", "U2", "tin", "756.123", t(3))
    return d

@pytest.fixture
def env():
    e = Engine(); e.actifs |= {"V1", "V2", "VF"}
    return e, dossier_riche(e), SnapshotStore(":memory:")

def canon(e, d):
    return {nom: (str(s.etat), str(s.visa.etat) if s.visa else None,
                  sorted(s.preparateurs), dict(s.donnees))
            for nom, s in d.sections.items()}

def test_SN01_round_trip_identique_et_version_conservee(env):
    e, d, store = env
    v = prendre_snapshot(e, d, store)
    assert v == e.version(d)
    e2 = Engine(); e2.actifs |= {"V1", "V2", "VF"}
    d2, v2, retard = restaurer_dossier(e2, store, e.journal, "K-SN")
    assert v2 == v and retard == 0
    assert canon(e, d) == canon(e2, d2), "état canonique identique"

def test_SN02_le_dossier_restaure_est_vivant(env):
    e, d, store = env
    prendre_snapshot(e, d, store)
    e2 = Engine(); e2.actifs |= {"V1", "V2", "VF"}
    d2, _, _ = restaurer_dossier(e2, store, e.journal, "K-SN")
    # même commande sur les deux → même résultat ET même refus de règle
    e.soumettre_au_visa(d, "Fiscalite", "U2", t(4))
    e2.soumettre_au_visa(d2, "Fiscalite", "U2", t(4))
    from olive_engine.errors import FourEyesViolation
    with pytest.raises(FourEyesViolation): e.accorder_visa(d, "Fiscalite", "U2", t(5))
    with pytest.raises(FourEyesViolation): e2.accorder_visa(d2, "Fiscalite", "U2", t(5))
    e.accorder_visa(d, "Fiscalite", "V2", t(6))
    e2.accorder_visa(d2, "Fiscalite", "V2", t(6))
    assert canon(e, d) == canon(e2, d2), "comportement identique après restauration"

def test_SN03_restauration_O_recent(env):
    e, d, store = env
    prendre_snapshot(e, d, store)
    # 500 événements d'AUTRES dossiers après le snapshot : ne doivent pas être lus
    for i in range(500):
        e.journal.append(t(10), "bruit", "system", dossier=f"AUTRE-{i}")
    e2 = Engine(); e2.actifs |= {"V1", "V2", "VF"}
    d2, _, retard = restaurer_dossier(e2, store, e.journal, "K-SN", compter_lectures=True)
    assert retard == 0
    assert restaurer_dossier.derniere_lecture <= 5, \
        f"O(récent) violé : {restaurer_dossier.derniere_lecture} événements lus"

def test_SN04_retard_signale(env):
    e, d, store = env
    prendre_snapshot(e, d, store)
    e.soumettre_au_visa(d, "Fiscalite", "U2", t(4))     # 1 événement APRÈS snapshot
    e2 = Engine(); e2.actifs |= {"V1", "V2", "VF"}
    d2, _, retard = restaurer_dossier(e2, store, e.journal, "K-SN")
    assert retard == 1, "l'exploitant sait qu'une commande manque"

def test_SN05_snapshot_immuable(env):
    e, d, store = env
    v = prendre_snapshot(e, d, store)
    with pytest.raises(Exception):
        store.ecrire("K-SN", v, {"etat": "falsifié"}, t(9))   # même version : refusé
    d2, v2, _ = restaurer_dossier(Engine(), store, e.journal, "K-SN")
    assert v2 == v and d2.sections["Identification"].donnees["domicile"] == "GE"
