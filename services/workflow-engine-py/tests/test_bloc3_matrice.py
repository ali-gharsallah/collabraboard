"""Bloc 3 — Scénarios S-01 à S-10 (R24-R29 + versioning généralisé).
S-09 et S-10 : ajoutés au catalogue en session (versioning de tout artefact
de configuration, pas seulement la matrice ; délai du visa conditionnel R25)."""
import pytest
from datetime import datetime, timedelta
from olive_engine.domain import (Engine, Document, VisaState, SectionState,
                                 DossierState)

T0 = datetime(2026, 6, 1, 9, 0)
def t(days=0, hours=0): return T0 + timedelta(days=days, hours=hours)
D_150726 = datetime(2026, 7, 15, 10, 0)   # validation dossier A (avant réforme)
D_200826 = datetime(2026, 8, 20, 10, 0)   # initiation dossier B
D_010926 = datetime(2026, 9, 1, 0, 0)     # mise en vigueur matrice v2
D_150926 = datetime(2026, 9, 15, 10, 0)   # après réforme

MATRICE_V1 = {"exigences": {
    "Trust": {
        "entite": [{"groupe": "preuve_existence",
                    "par_juridiction": {"CH": "extrait_rc",
                                        "KY": "certificate_of_incorporation",
                                        "*": "certificate_of_incorporation"}},
                   "trust_deed"],
        "personne_liee": ["passeport"],
        "compte": ["formulaire_ouverture"]},
    "Domiciliary Company": {
        "entite": ["extrait_rc"],
        "personne_liee": ["passeport"],
        "compte": ["formulaire_ouverture"]},
}}
MATRICE_V2 = {"exigences": {
    "Trust": {
        "entite": [{"groupe": "preuve_existence",
                    "par_juridiction": {"CH": "extrait_rc",
                                        "KY": "certificate_of_incorporation",
                                        "*": "certificate_of_incorporation"}},
                   "trust_deed", "registre_trustees"],   # nouvelle exigence CDB
        "personne_liee": ["passeport"],
        "compte": ["formulaire_ouverture"]},
    "Domiciliary Company": MATRICE_V1["exigences"]["Domiciliary Company"],
}}
SECTIONS_DEF = {
    "Trust":      {"Identification": ["settlor", "trustees"], "Fiscalite": ["regime"]},
    "Individual": {"Identification": ["nom", "naissance"],    "Fiscalite": ["domicile_fiscal"]},
}

@pytest.fixture
def eng():
    e = Engine()
    e.actifs |= {"V1", "V2", "VF"}
    e.referentiel.publier("matrice_documentaire", MATRICE_V1, T0)
    e.referentiel.publier("definition_sections", SECTIONS_DEF, T0)
    e.referentiel.publier("questionnaire_kyc", {"questions": ["q1", "q2"]}, T0)
    return e

def dossier_trust(eng, did="KYC-2026-CH-0003-R0", at=None, juridiction="CH"):
    return eng.creer_dossier(did, [("Identification", "V1"), ("Fiscalite", "V2")],
                             at or t(1), titulaire="TRUST-X", rm="RM1",
                             type_entite="Trust", juridiction=juridiction)

def valider_dossier(eng, d, at):
    for nom in ("Identification", "Fiscalite"):
        eng.modifier_donnee(d, nom, "U1", "champ", "v", at)
        eng.soumettre_au_visa(d, nom, "U1", at)
    eng.definir_validation_finale(d, "VF", at)
    eng.accorder_visa(d, "Identification", "V1", at)
    eng.accorder_visa(d, "Fiscalite", "V2", at)
    eng.accorder_visa(d, "VALIDATION_FINALE", "VF", at, engagement=True)


# --- S-01 : Structure fixe, contenu variable (R24)
def test_S01_sections_fixes_contenu_variable(eng):
    defs = eng.referentiel.en_vigueur("definition_sections", t(1)).contenu
    assert set(defs["Trust"].keys()) == set(defs["Individual"].keys())
    assert defs["Trust"]["Identification"] != defs["Individual"]["Identification"]

# --- S-02 : Visa conditionnel (R25)
def test_S02_visa_conditionnel(eng):
    d = dossier_trust(eng)
    eng.modifier_donnee(d, "Identification", "U1", "settlor", "X", t(1, 1))
    eng.soumettre_au_visa(d, "Identification", "U1", t(1, 2), conditionnel=True,
                          attente={"document": "trust_deed", "obligatoire": True})
    assert d.sections["Identification"].visa.conditionnel
    assert ("collecte", d.id, "trust_deed") in eng.taches
    # les autres sections ne sont pas bloquées
    eng.modifier_donnee(d, "Fiscalite", "U1", "regime", "std", t(1, 3))
    eng.soumettre_au_visa(d, "Fiscalite", "U1", t(1, 4))
    eng.accorder_visa(d, "Fiscalite", "V2", t(2))
    assert d.sections["Fiscalite"].visa.etat == VisaState.ACCORDE

# --- S-10 (nouveau) : délai du visa conditionnel — doc obligatoire (R25)
def test_S10_visa_conditionnel_obligatoire_saute_a_30j(eng):
    d = dossier_trust(eng)
    eng.modifier_donnee(d, "Identification", "U1", "settlor", "X", t(1, 1))
    eng.soumettre_au_visa(d, "Identification", "U1", t(1, 2), conditionnel=True,
                          attente={"document": "trust_deed", "obligatoire": True})
    eng.accorder_visa(d, "Identification", "V1", t(2))
    eng.tick(d, t(32))   # 30 jours après soumission, document jamais reçu
    assert d.sections["Identification"].visa.etat == VisaState.INVALIDE
    assert eng.journal.of_type("visa_conditionnel_expire")
    assert any(dest == "hierarchie" for dest, _ in eng.notifications)

def test_S10b_visa_conditionnel_optionnel_escalade_sans_invalidation(eng):
    d = dossier_trust(eng)
    eng.modifier_donnee(d, "Identification", "U1", "settlor", "X", t(1, 1))
    eng.soumettre_au_visa(d, "Identification", "U1", t(1, 2), conditionnel=True,
                          attente={"document": "annexe_facultative", "obligatoire": False})
    eng.accorder_visa(d, "Identification", "V1", t(2))
    eng.tick(d, t(32))
    assert d.sections["Identification"].visa.etat == VisaState.ACCORDE
    assert eng.journal.of_type("visa_conditionnel_escalade")

# --- S-03 : Complétude par union des matrices (R26)
def test_S03_completude_union(eng):
    d = eng.creer_dossier("KYC-2026-CH-0004-R0", [("Identification", "V1")],
                          t(1), titulaire="DOMCO-Y", rm="RM1",
                          type_entite="Domiciliary Company", juridiction="CH",
                          personnes_liees=[{"id": "P-BE", "role": "BE"},
                                           {"id": "P-SIG", "role": "signataire"}],
                          comptes=["CPT-1"])
    eng.ajouter_document(d, "Identification",
                         Document("extrait_rc", t(1), True, porteur="DOMCO-Y"), "U1", t(1))
    eng.ajouter_document(d, "Identification",
                         Document("passeport", t(1), True, porteur="P-SIG"), "U1", t(1))
    eng.ajouter_document(d, "Identification",
                         Document("formulaire_ouverture", t(1), True, porteur="CPT-1"), "U1", t(1))
    manquants = eng.evaluer_completude(d, at=t(2))
    assert ("P-BE", "passeport") in manquants          # le passeport du BE manque
    assert ("DOMCO-Y", "extrait_rc") not in manquants  # entité complète

# --- S-04 : La juridiction détermine le document (R27)
def test_S04_juridiction_determine_document(eng):
    d_ch = dossier_trust(eng, "KYC-2026-CH-0005-R0", juridiction="CH")
    d_ky = dossier_trust(eng, "KYC-2026-KY-0006-R0", juridiction="KY")
    m_ch = dict.fromkeys(eng.evaluer_completude(d_ch, at=t(2)))
    m_ky = dict.fromkeys(eng.evaluer_completude(d_ky, at=t(2)))
    assert ("TRUST-X", "extrait_rc") in m_ch
    assert ("TRUST-X", "certificate_of_incorporation") in m_ky

# --- S-05 : Péremption sans invalidation de visa (R28)
def test_S05_peremption_sans_invalidation(eng):
    d = dossier_trust(eng)
    eng.ajouter_document(d, "Identification",
                         Document("passeport", t(1), True, expire_le=t(40),
                                  porteur="TRUST-X"), "U1", t(1))
    valider_dossier(eng, d, t(2))
    eng.activer_dossier(d, t(2, 1))
    eng.tick(d, t(41))
    assert d.sections["Identification"].visa.etat == VisaState.ACCORDE
    assert ("collecte", d.id, "passeport") in eng.taches
    assert d.etat == DossierState.ACTIF

# --- S-06 : Grandfathering à la mise en vigueur (R29)
def test_S06_grandfathering(eng):
    dA = dossier_trust(eng, "KYC-2026-CH-0007-R0", at=datetime(2026, 7, 1, 9, 0))
    for doc in ("extrait_rc", "trust_deed"):
        eng.ajouter_document(dA, "Identification",
                             Document(doc, D_150726, True, porteur="TRUST-X"),
                             "U1", D_150726)
    valider_dossier(eng, dA, D_150726)          # validé sous v1, estampillé
    eng.referentiel.publier("matrice_documentaire", MATRICE_V2, D_010926)
    manquants = eng.evaluer_completude(dA, at=D_150926)
    assert ("TRUST-X", "registre_trustees") not in manquants   # jamais rétroactif
    assert dA.referentiel["matrice_documentaire"] == "v1"

# --- S-07 : Nouvelle matrice pour les dossiers en cours (R29)
def test_S07_dossier_en_cours_bascule(eng):
    eng.referentiel.publier("matrice_documentaire", MATRICE_V2, D_010926)
    dB = dossier_trust(eng, "KYC-2026-CH-0008-R0", at=D_200826)   # initié avant vigueur
    manquants = eng.evaluer_completude(dB, at=D_150926)           # toujours en préparation
    assert ("TRUST-X", "registre_trustees") in manquants          # v2 s'applique

# --- S-08 : Estampillage de version, immuable (R29)
def test_S08_estampillage_immuable(eng):
    dA = dossier_trust(eng, "KYC-2026-CH-0009-R0")
    valider_dossier(eng, dA, D_150726)
    ref = dict(dA.referentiel)
    eng.referentiel.publier("matrice_documentaire", MATRICE_V2, D_010926)
    assert dA.referentiel == ref                     # la photo ne bouge pas
    assert eng.journal.of_type("dossier_estampille")
    assert dA.referentiel["questionnaire_kyc"] == "v1"

# --- S-09 (nouveau) : versioning généralisé + rebasage à la recertification
def test_S09_versioning_generalise_et_rebasage(eng):
    dA = dossier_trust(eng, "KYC-2026-CH-0010-R0")
    valider_dossier(eng, dA, D_150726)
    eng.activer_dossier(dA, D_150726)
    # réforme : questionnaire v2 ET matrice v2 en vigueur au 01.09
    eng.referentiel.publier("questionnaire_kyc", {"questions": ["q1", "q2", "q3"]}, D_010926)
    eng.referentiel.publier("matrice_documentaire", MATRICE_V2, D_010926)
    assert dA.referentiel["questionnaire_kyc"] == "v1"   # grandfathering total
    # R29 : la recertification rebase obligatoirement sur les versions en vigueur
    eng.ouvrir_process(dA, "recertification", D_150926)
    assert dA.referentiel["questionnaire_kyc"] == "v2"
    assert dA.referentiel["matrice_documentaire"] == "v2"
    assert eng.journal.of_type("dossier_rebase")
