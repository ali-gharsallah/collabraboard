"""Config tenant versionnée au référentiel — application de S-09 (ratifié).
Le questionnaire R-Q signé devient un artefact daté : schéma typé validé,
publication par date de vigueur, lecture À DATE par le moteur (grandfathering
mécanique), estampille incluse dans le snapshot du dossier validé.

CT-01 validation : réponse manquante ou hors bornes → rejet AVANT publication.
CT-02 vigueur : la restriction appliquée est celle en vigueur à la date de
      l'événement — une réforme ultérieure ne réécrit pas le passé.
CT-03 estampille : le snapshot S-09 du dossier validé inclut config_tenant.
CT-04 onboarding : les réponses R-Q complètes = prérequis (R-Q méta-règle).
CT-05 compat : sans publication, les défauts du moteur s'appliquent."""
import pytest
from datetime import datetime, timedelta
from olive_engine.domain import Engine
from olive_engine.config_tenant import (SCHEMA_RQ, valider_config,
                                        onboarder_tenant, ConfigInvalide)

T0 = datetime(2026, 7, 1, 9, 0)
def t(d): return T0 + timedelta(days=d)

REPONSES_VALIDES = {
    "R4_relais": {"V1": "V3", "V2": "V3"},
    "R5_rappels_visa_jours": [3, 7],
    "R17_restrictions_suspendu": {"entrees": True, "sorties": False},
    "R17_notifier_client": False,
    "R19_abandon_jours": [30, 60, 90],
    "R25_delai_visa_conditionnel_jours": 30,
    "R26_matrice_documentaire_ref": "MATRICE-2026-01",
    "R31_cumul_roles_autorise": False,
    "R33_depep_delai_jours": 365,
    "R37_perimetre_central_file": ["identite", "documents"],
    "R39_sla_jours_par_tache": {"visa": 5, "collecte": 10},
    "R41_chaine_escalade": ["APP_MANAGER", "COO"],
    "R42_screening_freq_jours": {"positions": 1, "transactions": 1, "pep": 7, "sanctions": 7},
    "R43_role_lod2": "MLRO",
    "R45_severite_hit_confirme": "SUSPENSION_IMMEDIATE",
    "R47_journaliser_lectures": False,
}

def test_CT01_validation_rejette_invalide():
    incomplet = dict(REPONSES_VALIDES); incomplet.pop("R43_role_lod2")
    with pytest.raises(ConfigInvalide) as e1:
        valider_config(incomplet)
    assert "R43_role_lod2" in str(e1.value)
    hors_borne = dict(REPONSES_VALIDES, R19_abandon_jours=[90, 60, 30])  # non croissant
    with pytest.raises(ConfigInvalide):
        valider_config(hors_borne)
    mauvais_type = dict(REPONSES_VALIDES, R31_cumul_roles_autorise="oui")
    with pytest.raises(ConfigInvalide):
        valider_config(mauvais_type)

def test_CT02_la_restriction_en_vigueur_a_date_s_applique():
    e = Engine(); e.actifs |= {"V1", "VF"}
    onboarder_tenant(e, REPONSES_VALIDES, at=t(0))
    # réforme au jour 100 : la banque gèle AUSSI les entrées
    reforme = dict(REPONSES_VALIDES,
                   R17_restrictions_suspendu={"entrees": False, "sorties": False})
    onboarder_tenant(e, reforme, at=t(100))
    d1 = e.creer_dossier("K-1", [("Identification", "V1")], t(10))
    e.suspendre(d1, "alerte", t(10))                 # sous config v1
    assert e.operation_autorisee(d1, "entree") is True
    d2 = e.creer_dossier("K-2", [("Identification", "V1")], t(120))
    e.suspendre(d2, "alerte", t(120))                # sous config v2
    assert e.operation_autorisee(d2, "entree") is False
    # grandfathering : d1 suspendu sous v1 garde SES restrictions
    assert e.operation_autorisee(d1, "entree") is True

def test_CT03_estampille_inclut_config_tenant():
    e = Engine(); e.actifs |= {"V1", "VF"}
    onboarder_tenant(e, REPONSES_VALIDES, at=t(0))
    etat = e.etat_a_date("K-X", t(5))
    assert etat["versions"].get("config_tenant") is not None, \
        "la config tenant fait partie du snapshot S-09"

def test_CT04_onboarding_exige_le_questionnaire_complet():
    e = Engine()
    with pytest.raises(ConfigInvalide):
        onboarder_tenant(e, {"R43_role_lod2": "MLRO"}, at=t(0))
    assert not e.journal.of_type("config_tenant_publiee"), "rien publié si invalide"
    onboarder_tenant(e, REPONSES_VALIDES, at=t(0))
    assert e.journal.of_type("config_tenant_publiee"), "publication tracée"

def test_CT05_sans_publication_les_defauts_s_appliquent():
    e = Engine(); e.actifs |= {"V1", "VF"}
    d = e.creer_dossier("K-D", [("Identification", "V1")], t(1))
    e.suspendre(d, "alerte", t(1))                   # défauts du moteur
    assert e.operation_autorisee(d, "entree") is True
    assert e.operation_autorisee(d, "sortie") is False
