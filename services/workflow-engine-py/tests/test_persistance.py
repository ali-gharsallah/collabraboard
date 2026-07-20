"""Persistance — le journal SQL offre les mêmes garanties que l'in-memory :
immutabilité au niveau base (R49), rejeu à date (R48), extraction (R51)."""
import sqlite3
import pytest
from datetime import datetime, timedelta
from olive_engine.storage import SqlJournal
from olive_engine.domain import Engine

T0 = datetime(2026, 7, 1, 9, 0)
def t(days=0): return T0 + timedelta(days=days)

@pytest.fixture
def jrn():
    return SqlJournal(":memory:")

def test_append_et_relecture(jrn):
    jrn.append(t(0), "dossier_cree", "system", dossier="KYC-1")
    jrn.append(t(1), "visa_accorde", "V1", dossier="KYC-1", section="Identification")
    evs = jrn.all()
    assert len(evs) == 2 and evs[1].payload["section"] == "Identification"
    assert evs[0].at == t(0)

def test_R49_update_interdit_au_niveau_base(jrn):
    jrn.append(t(0), "visa_accorde", "V1", dossier="KYC-1")
    with pytest.raises(sqlite3.IntegrityError):
        jrn._db.execute("UPDATE events SET actor='falsifie' WHERE seq=1")

def test_R49_delete_interdit_au_niveau_base(jrn):
    jrn.append(t(0), "visa_accorde", "V1", dossier="KYC-1")
    with pytest.raises(sqlite3.IntegrityError):
        jrn._db.execute("DELETE FROM events")

def test_R48_as_of(jrn):
    jrn.append(t(0), "a", "s", dossier="K"); jrn.append(t(10), "b", "s", dossier="K")
    assert [e.type for e in jrn.as_of(t(5))] == ["a"]

def test_R51_for_dossier(jrn):
    jrn.append(t(0), "a", "s", dossier="KYC-1")
    jrn.append(t(0), "a", "s", dossier="KYC-2")
    assert len(jrn.for_dossier("KYC-1")) == 1

def test_engine_sur_journal_sql():
    """Le domaine tourne inchangé sur le store SQL (injection)."""
    eng = Engine(journal=SqlJournal(":memory:"))
    eng.actifs.add("V1")
    d = eng.creer_dossier("KYC-SQL-1", [("Identification", "V1")], t(0),
                          titulaire="TIT", rm="RM1")
    eng.modifier_donnee(d, "Identification", "U1", "nom", "Dupont", t(0))
    eng.soumettre_au_visa(d, "Identification", "U1", t(0))
    eng.accorder_visa(d, "Identification", "V1", t(1))
    preuve = eng.preuve_quatre_yeux(["KYC-SQL-1"])
    assert preuve["KYC-SQL-1"]["visas"]["Identification"]["conforme_4yeux"]
