"""Config tenant = artefact versionné du référentiel (application de S-09).

Le questionnaire R-Q signé par la banque devient un document TYPÉ et VALIDÉ,
publié dans le référentiel avec sa date de mise en vigueur. Le moteur lit la
config À DATE : le grandfathering (une réforme ne réécrit pas le passé) est
obtenu par le mécanisme R29/S-09 existant, sans code supplémentaire."""
from datetime import timedelta


class ConfigInvalide(Exception):
    """La publication est refusée AVANT tout effet : questionnaire incomplet,
    type incorrect ou valeur hors bornes."""


# Schéma des 16 réponses R-Q (types + contraintes). Une entrée par question
# du questionnaire de paramétrage — la référence contractuelle.
def _jours_croissants(v):
    return (isinstance(v, list) and len(v) == 3
            and all(isinstance(x, int) and x > 0 for x in v)
            and v[0] < v[1] < v[2])

SCHEMA_RQ = {
    "R4_relais":                        (dict,  lambda v: all(isinstance(k, str) and isinstance(x, str) for k, x in v.items())),
    "R5_rappels_visa_jours":            (list,  lambda v: len(v) == 2 and all(isinstance(x, int) and x > 0 for x in v)),
    "R17_restrictions_suspendu":        (dict,  lambda v: set(v) == {"entrees", "sorties"} and all(isinstance(x, bool) for x in v.values())),
    "R17_notifier_client":              (bool,  None),
    "R19_abandon_jours":                (list,  _jours_croissants),
    "R25_delai_visa_conditionnel_jours": (int,  lambda v: 1 <= v <= 365),
    "R26_matrice_documentaire_ref":     (str,   None),
    "R31_cumul_roles_autorise":         (bool,  None),
    "R33_depep_delai_jours":            (int,   lambda v: v >= 0),
    "R37_perimetre_central_file":       (list,  lambda v: all(isinstance(x, str) for x in v)),
    "R39_sla_jours_par_tache":          (dict,  lambda v: all(isinstance(x, int) and x > 0 for x in v.values())),
    "R41_chaine_escalade":              (list,  lambda v: len(v) >= 1),
    "R42_screening_freq_jours":         (dict,  lambda v: {"positions", "transactions", "pep", "sanctions"} <= set(v)),
    "R43_role_lod2":                    (str,   None),
    "R45_severite_hit_confirme":        (str,   lambda v: v in ("SUSPENSION_IMMEDIATE", "GEL_AVEC_ANALYSE", "COMITE")),
    "R47_journaliser_lectures":         (bool,  None),
}


def valider_config(reponses):
    """Validation stricte : toute question du schéma doit être présente, typée
    et dans ses bornes. Retourne le dict validé (copie)."""
    erreurs = []
    for cle, (typ, contrainte) in SCHEMA_RQ.items():
        if cle not in reponses:
            erreurs.append(f"réponse manquante : {cle}")
            continue
        v = reponses[cle]
        if not isinstance(v, typ) or (typ is not bool and isinstance(v, bool)):
            erreurs.append(f"type incorrect : {cle} attend {typ.__name__}")
        elif contrainte and not contrainte(v):
            erreurs.append(f"valeur hors bornes : {cle}")
    inconnues = set(reponses) - set(SCHEMA_RQ)
    if inconnues:
        erreurs.append(f"questions inconnues : {sorted(inconnues)}")
    if erreurs:
        raise ConfigInvalide(" ; ".join(erreurs))
    return dict(reponses)


def onboarder_tenant(engine, reponses, at):
    """Prérequis R-Q : publication de la config validée dans le référentiel,
    par date de vigueur (S-09). Trace l'événement. Rejet AVANT tout effet."""
    config = valider_config(reponses)
    engine.referentiel.publier("config_tenant", config, at)
    engine.journal.append(at, "config_tenant_publiee", "system",
                          questions=len(config), vigueur=at.isoformat())
    return config


def config_a(engine, at):
    """La config en vigueur à une date : artefact publié sinon défauts moteur."""
    try:
        publiee = engine.referentiel.en_vigueur("config_tenant", at).contenu
    except KeyError:
        return dict(engine.config)                    # CT-05 : défauts
    fusion = dict(engine.config)
    r = publiee
    fusion["restrictions_suspendu"] = dict(r["R17_restrictions_suspendu"])
    fusion["notifier_client_suspension"] = r["R17_notifier_client"]
    fusion["abandon_rappel_1"] = timedelta(days=r["R19_abandon_jours"][0])
    fusion["abandon_rappel_2"] = timedelta(days=r["R19_abandon_jours"][1])
    fusion["abandon_cloture"] = timedelta(days=r["R19_abandon_jours"][2])
    fusion["cumul_roles_autorise"] = r["R31_cumul_roles_autorise"]
    fusion["depep_delai"] = timedelta(days=r["R33_depep_delai_jours"])
    fusion["screening_freq"] = {k: timedelta(days=v)
                                for k, v in r["R42_screening_freq_jours"].items()}
    fusion["journaliser_lectures"] = r["R47_journaliser_lectures"]
    return fusion
