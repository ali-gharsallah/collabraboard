# -*- coding: utf-8 -*-
"""CPSI bloc 2 — R68 transparence/versionnage · R69 propositions IA · R70 bac à sable.
PT-01..03 · IA-01..02 · ST-01..03."""
import pytest
from datetime import datetime, timedelta
from olive_cpsi.engine import OliveCpsiEngine, CpsiError

T0 = datetime(2026, 1, 1)
def t(days=0): return T0 + timedelta(days=days)
BAS  = {"pays_risque": 0, "structure_risque": 1, "pep": False, "secteur_risque": 0}
HAUT = {"pays_risque": 3, "structure_risque": 3, "pep": True,  "secteur_risque": 2}

@pytest.fixture
def eng():
    e = OliveCpsiEngine()
    e.enregistrer_client("C1", BAS, T0)
    e.enregistrer_client("C2", HAUT, T0)
    e.ingester_signal("C2", "alerte_fondee", 2, t(1))
    # C3 : profil MEDIUM — celui que les durcissements font franchir
    e.enregistrer_client("C3", {"pays_risque": 2, "structure_risque": 1,
                                "pep": False, "secteur_risque": 1}, T0)
    e.ingester_signal("C3", "alerte_fondee", 2, t(1))
    return e

# --- PT-01 : modifier un paramètre = événement + version datée ; le rejeu AVANT
#             la mise en vigueur utilise l'ancienne config (grandfathering des règles)
def test_PT01_parametre_versionne(eng):
    s_avant, _ = eng.score_a_date("C2", t(5))
    eng.modifier_parametre("poids_signaux.alerte_fondee", 24.0, "Admin", t(10), note="durcissement")
    assert any(e["type"] == "parametre_modifie" and e["chemin"] == "poids_signaux.alerte_fondee"
               for e in eng.events)
    s_apres, _ = eng.score_a_date("C2", t(11))
    assert s_apres > s_avant
    s_rejoue, _ = eng.score_a_date("C2", t(5))       # AVANT la mise en vigueur
    assert s_rejoue == s_avant                        # l'ancienne règle s'applique

# --- PT-02 : les règles sont affichées EN CLAIR avec leurs valeurs courantes
def test_PT02_regles_en_clair(eng):
    regles = eng.decrire_regles()
    txt = "\n".join(regles)
    assert "half-life" in txt.lower() and "Bandes : LOW < 40" in txt
    assert any("alerte_fondee : poids 12.0" in l for l in regles)
    eng.modifier_parametre("bandes", (35, 65), "Admin", t(2))
    assert "LOW < 35" in "\n".join(eng.decrire_regles())

# --- PT-03 : paramètre inconnu refusé AVANT tout effet (default-deny)
def test_PT03_default_deny(eng):
    n = len(eng._config_versions)
    with pytest.raises(CpsiError):
        eng.modifier_parametre("poids_signaux.inexistant", 5, "Admin", t(2))
    with pytest.raises(CpsiError):
        eng.modifier_parametre("backdoor", 1, "Admin", t(2))
    assert len(eng._config_versions) == n

# --- IA-01 : la proposition IA embarque son impact et n'a AUCUN effet tant que non adoptée
def test_IA01_proposition_sans_effet(eng):
    s0, _ = eng.score_a_date("C2", t(5))
    prop = eng.proposer_parametre("Olivia", "poids_signaux.alerte_fondee", 24.0,
                                  "Les alertes fondées sous-pèsent vs faux positifs observés", t(5))
    assert prop["statut"] == "EN_ATTENTE" and prop["impact"]["clients_evalues"] == 3
    assert any(e["type"] == "proposition_emise" and e["acteur"] == "Olivia" for e in eng.events)
    s1, _ = eng.score_a_date("C2", t(5))
    assert s1 == s0                                   # R44 : rien ne change sans humain

# --- IA-02 : adoption humaine tracée avec référence + rejet motivé obligatoire
def test_IA02_adoption_humaine(eng):
    p1 = eng.proposer_parametre("Olivia", "poids_signaux.alerte_fondee", 24.0, "just.", t(5))
    p2 = eng.proposer_parametre("Olivia", "half_life_jours", 90, "signaux récents prioritaires", t(5))
    eng.adopter_proposition(p1["id"], "Isabelle Vernet", t(6))
    ev = [e for e in eng.events if e["type"] == "parametre_modifie"][-1]
    assert ev["acteur"] == "Isabelle Vernet" and ev.get("proposition") == p1["id"]
    with pytest.raises(CpsiError):
        eng.rejeter_proposition(p2["id"], "Isabelle Vernet", None, t(6))   # motivation requise
    eng.rejeter_proposition(p2["id"], "Isabelle Vernet", "Half-life 90 j trop agressif pour la revue", t(6))
    assert p2["statut"] == "REJETEE"
    with pytest.raises(CpsiError):
        eng.adopter_proposition(p2["id"], "X", t(7))                        # déjà décidée

# --- ST-01 : le sandbox rapporte Δ et franchissements attendus
def test_ST01_impact_rapporte(eng):
    r = eng.simuler_impact({"poids_signaux.alerte_fondee": 40.0}, t(5))
    assert r["clients_evalues"] == 3 and r["delta_moyen"] > 0
    assert any(f["client"] == "C3" and f["apres"] == "HIGH" for f in r["franchissements"])
    assert r["nouveaux_high"] >= 1 and r["charge_revues_induite"] == len(r["franchissements"])

# --- ST-02 : la simulation est journalisée mais ne mute RIEN (ni bande, ni tâche, ni score)
def test_ST02_simulation_sans_mutation(eng):
    bandes_avant = dict(eng._derniere_bande); taches_avant = list(eng.taches)
    s0, _ = eng.score_a_date("C2", t(5))
    eng.simuler_impact({"poids_signaux.alerte_fondee": 40.0}, t(5))
    assert any(e["type"] == "impact_simule" for e in eng.events)
    assert not any(e["type"] == "bande_franchie" and e["at"] == t(5).isoformat() for e in eng.events)
    assert eng._derniere_bande == bandes_avant and eng.taches == taches_avant
    s1, _ = eng.score_a_date("C2", t(5))
    assert s1 == s0

# --- ST-03 : l'adoption référence l'impact simulé (le rapport accompagne la décision)
def test_ST03_impact_joint_a_l_adoption(eng):
    p = eng.proposer_parametre("Olivia", "poids_signaux.alerte_fondee", 40.0, "just.", t(5))
    eng.adopter_proposition(p["id"], "Isabelle Vernet", t(6))
    ev = [e for e in eng.events if e["type"] == "proposition_adoptee"][-1]
    assert ev["proposition"] == p["id"] and ev["impact_franchissements"] == len(p["impact"]["franchissements"])
