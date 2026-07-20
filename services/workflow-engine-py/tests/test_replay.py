"""Corpus de rejeu — capture par handles + rejeu bi-moteur + fidélité.
RP-01 : la capture enregistre appels, issues (ok/règle) et handles.
RP-02 : rejeu du corpus dans deux moteurs neufs → zéro divergence A/B.
RP-03 : un moteur ombre altéré → divergence détectée au rejeu.
RP-04 : mutation directe hors moteur → scénario marqué REJEU_PARTIEL."""
import pytest
from datetime import datetime, timedelta
from olive_engine.domain import Engine, VisaState
from olive_engine.replay import EngineRecorder, CorpusReplayer

T0 = datetime(2026, 7, 1, 9, 0)
def t(h): return T0 + timedelta(hours=h)

def scenario_nominal(e):
    d = e.creer_dossier("D1", [("Identification", "V1"), ("Fiscalite", "V2")], T0)
    e.definir_validation_finale(d, "VF", T0)
    e.modifier_donnee(d, "Identification", "U1", "domicile", "GE", t(1))
    e.soumettre_au_visa(d, "Identification", "U1", t(1))
    e.accorder_visa(d, "Identification", "V1", t(2))
    return d

def test_RP01_capture_appels_issues_handles():
    rec = EngineRecorder(Engine())
    rec.actifs |= {"V1", "V2", "VF"}
    scenario_nominal(rec)
    methodes = [c["m"] for c in rec.corpus]
    assert "creer_dossier" in methodes and "accorder_visa" in methodes
    assert any(c["m"] == "__actifs__" for c in rec.corpus), "actifs capturés"
    cd = next(c for c in rec.corpus if c["m"] == "creer_dossier")
    assert cd["issue"]["ok"] is True and "ret" in cd
    # l'arg dossier des appels suivants est une référence de handle
    mod = next(c for c in rec.corpus if c["m"] == "modifier_donnee")
    assert mod["args"][0] == {"__ref__": cd["ret"]}

def test_RP01b_capture_des_refus_avec_regle():
    rec = EngineRecorder(Engine()); rec.actifs |= {"V1", "V2", "VF"}
    d = rec.creer_dossier("D1", [("Identification", "V1")], T0)
    rec.definir_validation_finale(d, "VF", T0)
    rec.modifier_donnee(d, "Identification", "U1", "x", "y", t(1))
    rec.soumettre_au_visa(d, "Identification", "U1", t(1))
    from olive_engine.errors import MotivationRequired
    with pytest.raises(MotivationRequired):
        rec.refuser_visa(d, "Identification", "V1", t(2), motivation="")
    ref = next(c for c in rec.corpus if c["m"] == "refuser_visa")
    assert ref["issue"] == {"ok": False, "regle": "R7"}

def test_RP02_rejeu_bimoteur_zero_divergence():
    rec = EngineRecorder(Engine()); rec.actifs |= {"V1", "V2", "VF"}
    scenario_nominal(rec)
    rep = CorpusReplayer(lambda: Engine(), lambda: Engine())
    res = rep.rejouer("V-nominal", rec.corpus, rec.snapshots_finales())
    assert res["divergences"] == []
    assert res["fidele"] is True
    assert rep.pret_a_basculer(1)

def test_RP03_ombre_alteree_detectee():
    rec = EngineRecorder(Engine()); rec.actifs |= {"V1", "V2", "VF"}
    scenario_nominal(rec)
    class EngineLaxiste(Engine):
        def accorder_visa(self, dossier, section_nom, acteur, at, **kw):
            s = dossier.sections[section_nom]
            s.preparateurs.discard(acteur)          # neutralise le 4-yeux…
            return super().accorder_visa(dossier, section_nom, acteur, at, **kw)
    # corpus violant R13 : le préparateur signe — le maître refuse, l'ombre laxiste accepte
    rec2 = EngineRecorder(Engine()); rec2.actifs |= {"V1", "VF"}
    d = rec2.creer_dossier("D1", [("Identification", "V1")], T0)
    rec2.definir_validation_finale(d, "VF", T0)
    rec2.modifier_donnee(d, "Identification", "V1", "x", "y", t(1))
    rec2.soumettre_au_visa(d, "Identification", "V1", t(1))
    from olive_engine.errors import FourEyesViolation
    with pytest.raises(FourEyesViolation):
        rec2.accorder_visa(d, "Identification", "V1", t(2))
    rep = CorpusReplayer(lambda: Engine(), lambda: EngineLaxiste())
    res = rep.rejouer("V-02-like", rec2.corpus, rec2.snapshots_finales())
    assert any(dv.type == "DECISION" for dv in res["divergences"])

def test_RP04_mutation_directe_marque_rejeu_partiel():
    rec = EngineRecorder(Engine()); rec.actifs |= {"V1", "V2", "VF"}
    d = scenario_nominal(rec)
    d.sections["Fiscalite"].visa = None            # mutation directe HORS moteur
    from olive_engine.domain import SectionState
    d.sections["Fiscalite"].etat = SectionState.VISEE
    rep = CorpusReplayer(lambda: Engine(), lambda: Engine())
    res = rep.rejouer("V-mutation", rec.corpus, rec.snapshots_finales())
    assert res["fidele"] is False, "le rejeu ne reproduit pas la capture"
    assert res["divergences"] == [], "mais A/B restent identiques entre eux"
    assert not rep.pret_a_basculer(1), "un scénario non fidèle ne compte pas pour la bascule"
