"""Bloc 10 — R58 habilitation · R59 double visa · R60 fraîcheur · R61 anti-goulot.
Scénarios H-01..03 · DV-01..03 · F-01..03 · G-01..03 (catalogue, ratifiés 2026-07-13)."""
import pytest
from datetime import datetime, timedelta
from olive_engine.domain import (Engine, VisaState, SectionState, FINAL_STEP)
from olive_engine.errors import (NotAuthorized, MotivationRequired, InvalidTransition)

T0 = datetime(2026, 7, 1, 9, 0)
def t(days=0, hours=0): return T0 + timedelta(days=days, hours=hours)

@pytest.fixture
def eng():
    e = Engine()
    e.actifs |= {"V1", "V2", "VF", "M1", "U1", "U2"}
    return e

@pytest.fixture
def dossier(eng):
    d = eng.creer_dossier("KYC-2026-CH-0920-R0",
                          [("Identification", "V1"), ("Fiscalite", "V2")], T0)
    eng.definir_validation_finale(d, "VF", T0)
    return d

def prepare_et_soumets(eng, d, section, preparateur="U1", at=None):
    at = at or t(0, 1)
    eng.modifier_donnee(d, section, preparateur, "champ", "valeur", at)
    eng.soumettre_au_visa(d, section, preparateur, at)

def tout_viser(eng, d, at=None):
    for sec, val in [("Identification", "V1"), ("Fiscalite", "V2")]:
        prepare_et_soumets(eng, d, sec, at=at)
        eng.accorder_visa(d, sec, val, (at or t(0, 1)) + timedelta(hours=1))


# ═══ R58 — Habilitation du signataire ═══

# --- H-01 : habilitation expirée → visa refusé, tâche de renouvellement, événement tracé
def test_H01_habilitation_expiree_bloque(eng, dossier):
    eng.definir_habilitation("V1", t(-10), T0)         # expirée il y a 10 jours
    prepare_et_soumets(eng, dossier, "Identification")
    with pytest.raises(NotAuthorized):
        eng.accorder_visa(dossier, "Identification", "V1", t(1))
    assert ("renouvellement_habilitation", "V1") in eng.taches
    assert any(e.type == "tentative_visa_refusee_habilitation" for e in eng.journal.all())

# --- H-02 : le renouvellement rouvre le droit de viser
def test_H02_renouvellement_rouvre(eng, dossier):
    eng.definir_habilitation("V1", t(-10), T0)
    prepare_et_soumets(eng, dossier, "Identification")
    eng.definir_habilitation("V1", t(365), t(0, 2))    # renouvelée
    eng.accorder_visa(dossier, "Identification", "V1", t(1))
    assert dossier.sections["Identification"].visa.etat == VisaState.ACCORDE

# --- H-03 : dérogation R4 tracée malgré l'habilitation expirée
def test_H03_derogation_tracee(eng, dossier):
    eng.definir_habilitation("V1", t(-10), T0)
    prepare_et_soumets(eng, dossier, "Identification")
    eng.accorder_visa(dossier, "Identification", "V1", t(1),
                      derogation={"decideur": "COO", "fiche_de_poste": "FP-2026-114"})
    assert dossier.sections["Identification"].visa.etat == VisaState.ACCORDE
    evs = [e for e in eng.journal.all() if e.type == "derogation_prononcee"]
    assert evs and evs[-1].payload.get("motif") == "habilitation expirée — R58 via R4"


# ═══ R59 — Double visa au-delà d'un seuil ═══

# --- DV-01 + DV-02 : seuil franchi → 2 signataires distincts requis, chacun avec R14
def test_DV01_DV02_double_visa(eng, dossier):
    eng.config_r59_score_seuil = 67
    eng.definir_score_risque(dossier, 82, T0)
    tout_viser(eng, dossier)
    # 1er signataire (VF, le validateur nommé)
    eng.accorder_visa(dossier, FINAL_STEP, "VF", t(2), engagement=True)
    fin = dossier.sections[FINAL_STEP]
    assert fin.visa.etat == VisaState.EN_ATTENTE          # DV-02 : un seul ne suffit pas
    assert any(e.type == "visa_final_premier_signataire" for e in eng.journal.all())
    # le même re-signe → refusé (distincts obligatoires)
    with pytest.raises(NotAuthorized):
        eng.accorder_visa(dossier, FINAL_STEP, "VF", t(2, 1), engagement=True)
    # le second sans engagement → R14 s'applique à CHACUN
    from olive_engine.errors import EngagementRequired
    with pytest.raises(EngagementRequired):
        eng.accorder_visa(dossier, FINAL_STEP, "M1", t(2, 2))
    # second signataire distinct avec engagement → accordé, cosignataires tracés
    eng.accorder_visa(dossier, FINAL_STEP, "M1", t(2, 3), engagement=True)
    assert fin.visa.etat == VisaState.ACCORDE
    ev = [e for e in eng.journal.all() if e.type == "visa_accorde"][-1]
    assert ev.payload.get("cosignataires") == "VF+M1"

# --- DV-03 : sous le seuil, circuit normal à un signataire
def test_DV03_sous_le_seuil(eng, dossier):
    eng.config_r59_score_seuil = 67
    eng.definir_score_risque(dossier, 30, T0)
    tout_viser(eng, dossier)
    eng.accorder_visa(dossier, FINAL_STEP, "VF", t(2), engagement=True)
    assert dossier.sections[FINAL_STEP].visa.etat == VisaState.ACCORDE


# ═══ R60 — Fraîcheur des sections à la finale ═══

# --- F-01 : sections fraîches → la finale passe
def test_F01_sections_fraiches(eng, dossier):
    eng.config_r60_fraicheur_jours = 180
    tout_viser(eng, dossier)
    eng.accorder_visa(dossier, FINAL_STEP, "VF", t(30), engagement=True)
    assert dossier.sections[FINAL_STEP].visa.etat == VisaState.ACCORDE

# --- F-02 : section ancienne → re-confirmation exigée, puis la finale passe
def test_F02_reconfirmation_exigee(eng, dossier):
    eng.config_r60_fraicheur_jours = 180
    tout_viser(eng, dossier)
    with pytest.raises(InvalidTransition):
        eng.accorder_visa(dossier, FINAL_STEP, "VF", t(300), engagement=True)
    assert any(e.type == "reconfirmation_requise_r60" for e in eng.journal.all())
    assert any(tk[0] == "reconfirmation_section" for tk in eng.taches)
    eng.reconfirmer_section(dossier, "Identification", "V1", t(300, 1))
    eng.reconfirmer_section(dossier, "Fiscalite", "V2", t(300, 1))
    eng.accorder_visa(dossier, FINAL_STEP, "VF", t(300, 2), engagement=True)
    assert dossier.sections[FINAL_STEP].visa.etat == VisaState.ACCORDE

# --- F-03 : refus de re-confirmer → invalidation ciblée (mécanique R10)
def test_F03_refus_invalide(eng, dossier):
    eng.config_r60_fraicheur_jours = 180
    tout_viser(eng, dossier)
    with pytest.raises(MotivationRequired):
        eng.refuser_reconfirmation(dossier, "Identification", "V1", t(300))
    eng.refuser_reconfirmation(dossier, "Identification", "V1", t(300),
                               motivation="Situation UBO à revalider — donnée périmée")
    s = dossier.sections["Identification"]
    assert s.visa.etat == VisaState.INVALIDE and s.etat == SectionState.EN_PREPARATION
    assert any(e.type == "section_invalidee_r60" for e in eng.journal.all())


# ═══ R61 — Anti-goulot mesuré ═══

def _trois_dossiers_sur_V1(eng):
    ds = []
    for i in range(3):
        d = eng.creer_dossier(f"KYC-2026-CH-093{i}-R0", [("Identification", "V1")], T0)
        eng.definir_validation_finale(d, "VF", T0)
        prepare_et_soumets(eng, d, "Identification", at=t(0, i + 1))
        ds.append(d)
    return ds

# --- G-01 : file au-delà du seuil → signal + proposition de routage vers le relais R4
def test_G01_signal_et_proposition(eng):
    eng.config_r61_seuil_file = 2
    eng.relais["V1"] = "V2"
    _trois_dossiers_sur_V1(eng)
    assert any(e.type == "goulot_signale" and e.payload["validateur"] == "V1"
               for e in eng.journal.all())
    assert any(e.type == "routage_relais_propose" and e.payload["relais"] == "V2"
               for e in eng.journal.all())

# --- G-02 : rien n'est forcé — le visa reste assigné au validateur d'origine
def test_G02_rien_n_est_force(eng):
    eng.config_r61_seuil_file = 2
    eng.relais["V1"] = "V2"
    ds = _trois_dossiers_sur_V1(eng)
    assert all(d.sections["Identification"].visa.validateur == "V1" for d in ds)

# --- G-03 : la décision du responsable est tracée et applique le routage
def test_G03_decision_tracee(eng):
    eng.config_r61_seuil_file = 2
    eng.relais["V1"] = "V2"
    ds = _trois_dossiers_sur_V1(eng)
    eng.accepter_routage_relais(ds[2], "Identification", "Resp. Compliance", t(1))
    assert ds[2].sections["Identification"].visa.validateur == "V2"
    ev = [e for e in eng.journal.all() if e.type == "routage_relais_decide"][-1]
    assert ev.actor == "Resp. Compliance" and ev.payload["relais"] == "V2"
    # et le relais peut viser (R2 : il est désormais le validateur du visa)
    eng.accorder_visa(ds[2], "Identification", "V2", t(1, 1))
    assert ds[2].sections["Identification"].visa.etat == VisaState.ACCORDE
