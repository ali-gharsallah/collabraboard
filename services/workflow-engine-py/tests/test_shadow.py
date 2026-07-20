"""Parallel run — tests du ShadowRunner (montage strangler fig).
SH-01 zéro divergence moteurs identiques · SH-02 divergence de DÉCISION avec
règle citée par l'ombre · SH-03 divergence d'ÉTAT · SH-04 l'ombre ne casse
jamais le maître · SH-05 critère de bascule · SH-06 tri → brouillon R53."""
import pytest
from datetime import datetime, timedelta
from olive_engine.domain import Engine
from olive_engine.shadow import ShadowRunner, OliveEngineAdapter

T0 = datetime(2026, 7, 1, 9, 0)
def t(h): return T0 + timedelta(hours=h)

def mk(adapter_cls=OliveEngineAdapter):
    e = Engine(); e.actifs |= {"V1", "V2", "VF"}
    return adapter_cls(e)

PARCOURS_NOMINAL = [
    {"cmd": "creer", "dossier": "D1", "at": T0, "validateur_final": "VF",
     "sections": [("Identification", "V1"), ("Fiscalite", "V2")]},
    {"cmd": "modifier", "dossier": "D1", "section": "Identification",
     "acteur": "U1", "champ": "domicile", "valeur": "GE", "at": t(1)},
    {"cmd": "soumettre", "dossier": "D1", "section": "Identification", "acteur": "U1", "at": t(1)},
    {"cmd": "accorder", "dossier": "D1", "section": "Identification", "acteur": "V1", "at": t(2)},
]

def rejoue(runner, parcours):
    for c in parcours: runner.execute(c)
    runner.fin_de_parcours()

def test_SH01_zero_divergence_moteurs_identiques():
    r = ShadowRunner(maitre=mk(), ombre=mk())
    rejoue(r, PARCOURS_NOMINAL)
    assert r.divergences == []
    assert "Zéro divergence" in r.rapport()

def test_SH02_divergence_de_decision_et_regle_citee():
    class MaitreLaxiste(OliveEngineAdapter):
        # bug du maître : accepte un refus SANS motivation (viole R7)
        def _dispatch(self, c):
            if c["cmd"] == "refuser" and not c.get("motivation"):
                d = self.dossiers[c["dossier"]]
                s = d.sections[c["section"]]
                from olive_engine.domain import VisaState, SectionState
                s.visa.etat = VisaState.REFUSE; s.etat = SectionState.EN_PREPARATION
                return
            super()._dispatch(c)
    r = ShadowRunner(maitre=MaitreLaxiste(Engine()), ombre=mk())
    r.maitre.e.actifs |= {"V1", "V2", "VF"}
    rejoue(r, PARCOURS_NOMINAL[:3] + [
        {"cmd": "refuser", "dossier": "D1", "section": "Identification",
         "acteur": "V1", "at": t(2), "motivation": ""}])
    dec = [d for d in r.divergences if d.type == "DECISION"]
    assert dec, "la décision divergente doit être détectée"
    assert dec[0].ombre["regle"] == "R7", "l'ombre cite sa règle sur refus"

def test_SH03_divergence_d_etat():
    r = ShadowRunner(maitre=mk(), ombre=mk())
    rejoue(r, PARCOURS_NOMINAL)
    # corruption directe de l'état de l'ombre (simule une projection fausse)
    from olive_engine.domain import SectionState
    r.ombre.dossiers["D1"].sections["Fiscalite"].etat = SectionState.VISEE
    r.execute({"cmd": "modifier", "dossier": "D1", "section": "Fiscalite",
               "acteur": "U2", "champ": "tin", "valeur": "X", "at": t(3)})
    assert any(d.type == "ETAT" for d in r.divergences)

def test_SH04_l_ombre_ne_casse_jamais_le_maitre():
    class OmbreQuiCrashe(OliveEngineAdapter):
        def execute(self, cmd): raise RuntimeError("boum interne ombre")
    r = ShadowRunner(maitre=mk(), ombre=OmbreQuiCrashe(Engine()))
    res = r.execute(PARCOURS_NOMINAL[0])
    assert res["ok"] is True, "le maître a répondu normalement"
    assert any(d.type == "CRASH_OMBRE" for d in r.divergences)

def test_SH05_critere_de_bascule():
    r = ShadowRunner(maitre=mk(), ombre=mk())
    rejoue(r, PARCOURS_NOMINAL)
    assert not r.pret_a_basculer(3)
    for i in range(2, 4):
        r2m, r2o = r.maitre, r.ombre    # nouveaux dossiers, mêmes moteurs
        p = [dict(PARCOURS_NOMINAL[0], dossier=f"D{i}")] + [
            dict(c, dossier=f"D{i}") for c in PARCOURS_NOMINAL[1:]]
        rejoue(r, p)
    assert r.pret_a_basculer(3)

def test_SH06_tri_regle_implicite_genere_le_brouillon_R53():
    r = ShadowRunner(maitre=mk(), ombre=mk())
    from olive_engine.shadow import Divergence
    div = Divergence(9, {"cmd": "accorder", "dossier": "D1", "section": "Identification"},
                     "DECISION", {"ok": False, "regle": None}, {"ok": True})
    r.divergences.append(div)
    brouillon = r.classer(div, "REGLE_IMPLICITE",
        "le maître exige au moins un document rattaché avant tout visa")
    assert brouillon.startswith("R53 — [BROUILLON")
    assert "Étant donné" in brouillon and "avant implémentation" in brouillon
    assert "📜" in r.rapport() or "Règles implicites" in r.rapport()
