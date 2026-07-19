"""Moteur O-Live — domaine bloc 1 : cycle de vie du visa 4-yeux (R1-R15).

Architecture : domaine pur (aucune dépendance infra), event-sourced.
L'état courant est une projection ; le journal est la vérité (R48/R49).
Horloge injectée : le temps est un paramètre, jamais un effet de bord.
"""
from dataclasses import dataclass, field
import hashlib, json
from datetime import datetime, timedelta
from enum import Enum
from .errors import (RegleTenantInvalide, RegleTenantViolation,
                     ConcurrencyConflict, FourEyesViolation, MotivationRequired, RevocationNotAllowed,
                     NotAuthorized, EngagementRequired, InvalidTransition)
from .events import EventJournal
from .referentiel import Referentiel

FINAL_STEP = "VALIDATION_FINALE"  # R15 : la validation finale est une étape comme les autres


class VisaState(Enum):
    EN_ATTENTE = "en_attente"
    GELE = "gele"                  # R46 : hit pendant la validation
    ACCORDE = "accorde"
    INVALIDE = "invalide"
    REFUSE = "refuse"
    ANNULE = "annule"


class SectionState(Enum):
    EN_PREPARATION = "en_preparation"
    EN_VALIDATION = "en_validation"
    VISEE = "visee"


class DossierState(Enum):
    BROUILLON = "brouillon"
    EN_PREPARATION = "en_preparation"
    EN_VALIDATION = "en_validation"
    ACTIF = "actif"
    CLOTURE = "cloture"
    SUSPENDU = "suspendu"          # R17
    EN_MISE_A_JOUR = "en_mise_a_jour"  # R21
    REJETE = "rejete"              # R18
    ABANDONNE = "abandonne"        # R19


class PersonneState(Enum):
    ACTIVE = "active"
    ARCHIVEE = "archivee"     # R35 : jamais supprimée (LBA)


ROLES_REASSIGNATION = {"process_owner", "application_manager", "coo"}  # R11


@dataclass
class Document:
    nom: str
    recu_le: datetime
    valide_a_reception: bool
    expire_le: datetime = None
    porteur: str = None      # R26 : entité titulaire, personne liée ou compte
    controle_cf: bool = False  # R37 : réputé valide après contrôle Central File


@dataclass
class Visa:
    validateur: str            # R2 : personne nommée
    etat: VisaState = VisaState.EN_ATTENTE
    soumis_le: datetime = None
    conditionnel: bool = False
    attente: dict = None            # R25 : {"document": nom, "obligatoire": bool}
    conditionnel_traite: bool = False
    sous_derogation: bool = False
    rappels: int = 0
    escalade: bool = False
    motivation_refus: str = None


@dataclass
class Section:
    nom: str
    validateur: str            # R2
    etat: SectionState = SectionState.EN_PREPARATION
    preparateurs: set = field(default_factory=set)   # R13 : exclusion au niveau section
    visa: Visa = None
    donnees: dict = field(default_factory=dict)
    documents: list = field(default_factory=list)


@dataclass
class Dossier:
    id: str
    sections: dict = field(default_factory=dict)
    etat: "DossierState" = None
    titulaire: str = None
    rm: str = None
    derniere_activite: datetime = None
    rappels_abandon: int = 0
    lecture_seule: bool = False
    restrictions: dict = None          # R17 : restrictions en vigueur si Suspendu
    processes: list = field(default_factory=list)  # R23
    type_entite: str = None            # R24/R26 : un des 8 types
    juridiction: str = None            # R27 : fixée d'abord
    personnes_liees: list = field(default_factory=list)  # R26
    comptes: list = field(default_factory=list)          # R26
    referentiel: dict = None           # R29 : snapshot immuable à la validation


@dataclass
class Personne:
    """R30 : objet unique du référentiel, référencé par N dossiers."""
    id: str
    nom: str
    donnees: dict = field(default_factory=dict)
    etat: "PersonneState" = None
    flags: set = field(default_factory=set)       # R31 : insider, ...
    statut_pep: bool = False                      # R32/R33
    fin_mandat_pep: datetime = None
    alerte_depep_emise: bool = False


@dataclass
class Tache:
    """R38 : assignée à un rôle, ciblée sur une personne du scope."""
    id: str
    type: str
    dossier_id: str
    role: str
    titulaire: str = None
    cree_le: datetime = None
    sla: timedelta = None
    etat: str = "OUVERTE"          # OUVERTE | TERMINEE
    sla_depasse: bool = False


@dataclass
class Hit:
    """R43 : cycle en deux lignes de défense."""
    id: str
    personne: str
    profil: str
    domaine: str                   # sanctions | pep | adverse_media
    etat: str = "NOUVEAU"          # NOUVEAU | QUALIFIE_LOD1 | CLOTURE_FAUX_POSITIF | CONFIRME
    justification: str = None


@dataclass
class Process:
    """R23 : chaque process garde son identité et son audit trail propres."""
    id: str
    type: str                     # "recertification" | "evenement"
    etat: str = "EN_COURS"        # EN_COURS | EN_PAUSE | CLOTURE
    ouvert_le: datetime = None
    sections_revalidees: set = field(default_factory=set)


class Engine:
    RAPPEL_1 = timedelta(days=5)
    RAPPEL_2 = timedelta(days=10)
    ESCALADE = timedelta(days=15)

    def __init__(self, journal=None, ia=None):
        self.journal = journal if journal is not None else EventJournal()
        self.ia = ia                 # adaptateur IA optionnel (R44)
        self.notifications = []      # (destinataire, message)
        self.taches = []             # tâches de collecte, etc.
        self.absences = set()        # validateurs déclarés absents (R4)
        self.relais = {}             # validateur -> relais nommé (R4)
        self.actifs = set()          # personnes actives dans la banque (R11/V-12)
        # R56 : règles tenant additionnelles — elles ne peuvent QUE durcir.
        # Parité stricte avec le moteur JS (mêmes types, mêmes événements).
        self.regles_tenant = []
        # R57 : récusations prononcées — (dossier, section) -> {acteurs récusés}
        self.recusations = {}
        # R58 : habilitations/formations — acteur -> date d'expiration
        self.habilitations = {}
        # R59/R60/R61 : paramètres tenant (None = règle inactive)
        self.config_r59_score_seuil = None    # double visa finale au-delà de ce score
        self.config_r60_fraicheur_jours = None  # re-confirmation si visa plus ancien
        self.config_r61_seuil_file = None     # signal goulot au-delà de N visas en attente
        self.config = {              # paramétrage tenant (questionnaire R-Q)
            "restrictions_suspendu": {"entrees": True, "sorties": False},
            "notifier_client_suspension": False,
            "abandon_rappel_1": timedelta(days=30),   # R19
            "abandon_rappel_2": timedelta(days=60),
            "abandon_cloture": timedelta(days=90),
        }
        self.prospects_refuses = {}  # R18 : titulaire -> (dossier_id, motif)
        self.referentiel = Referentiel(journal=self.journal)  # R29/R48
        self.personnes = {}          # R30 : id -> Personne (objet unique)
        self.dossiers = {}           # id -> Dossier
        self.roles = []              # (personne_id, dossier_id, role)
        self.relations = []          # R34 : (a, type_ab, b, type_ba) bijectif
        self.config.update({
            "cumul_roles_autorise": False,        # R31 (paramètre tenant)
            "depep_delai": timedelta(days=365),   # R33 (paramètre tenant)
        })
        self.config["screening_freq"] = {          # R42 (paramètre tenant)
            "positions": timedelta(days=1),
            "transactions": timedelta(days=1),
            "pep": timedelta(days=7),
            "sanctions": timedelta(days=7),
        }
        self._dernier_screening = {}
        self._dernier_tick = None                  # R54 : monotonie de l'horloge
        self.hits = []               # R43
        self.whitelist = {}          # R44 : (personne, profil) -> justification
        self._seq_hit = 0
        self.gestion_taches = []     # bloc 5 : objets Tache (R38-R41)
        self.role_membres = {}       # role -> {personnes}
        self.scopes = {}             # personne -> {dossier ids} (R38)
        self.suppleants = {}         # role -> suppléant (R41)
        self.compteurs_sla = {}      # role -> dépassements (R39 : mesure)
        self._seq_tache = 0
        self._seq_process = 0

    # ---------- helpers ----------
    def _log(self, at, type, actor, **payload):
        return self.journal.append(at, type, actor, **payload)

    def _notify(self, who, msg):
        self.notifications.append((who, msg))

    def creer_dossier(self, dossier_id, sections, at, titulaire=None, rm=None,
                      type_entite=None, juridiction=None,
                      personnes_liees=None, comptes=None):
        """sections : liste de (nom, validateur). Ajoute l'étape finale R15."""
        d = Dossier(id=dossier_id, etat=DossierState.EN_PREPARATION,
                    titulaire=titulaire, rm=rm, derniere_activite=at,
                    type_entite=type_entite, juridiction=juridiction,
                    personnes_liees=personnes_liees or [],
                    comptes=comptes or [])
        for nom, validateur in sections:
            d.sections[nom] = Section(nom=nom, validateur=validateur)
        self.dossiers[dossier_id] = d
        self._log(at, "dossier_cree", "system", dossier=dossier_id)
        # R18 : détection du retour d'un prospect refusé
        if titulaire and titulaire in self.prospects_refuses:
            d0, motif = self.prospects_refuses[titulaire]
            self._log(at, "prospect_refuse_detecte", "system",
                      dossier=dossier_id, titulaire=titulaire,
                      dossier_initial=d0, motif_initial=motif)
            self._notify("compliance",
                         f"Prospect {titulaire} précédemment refusé ({d0}) : {motif}")
        return d

    def definir_validation_finale(self, dossier, validateur, at):
        dossier.sections[FINAL_STEP] = Section(nom=FINAL_STEP, validateur=validateur)
        self._log(at, "etape_finale_definie", "system",
                  dossier=dossier.id, validateur=validateur)

    # ---------- préparation ----------
    # ---------- R53 : concurrence optimiste ----------
    _EVENEMENTS_SANS_VERSION = frozenset({"conflit_concurrence", "dossier_consulte",
                                          "snapshot_pris", "tick_execute", "tick_refuse_horloge"})

    def version(self, dossier):
        """Version = nombre d'événements EFFECTIFS du dossier (ni lectures R47,
        ni conflits R53)."""
        return sum(1 for e in self.journal.all()
                   if e.payload.get("dossier") == dossier.id
                   and e.type not in self._EVENEMENTS_SANS_VERSION)

    def _verifier_version(self, dossier, expected, acteur, at):
        if expected is None:
            return                                  # C-03 : compat processus internes
        courante = self.version(dossier)
        if expected != courante:
            self._log(at, "conflit_concurrence", acteur, dossier=dossier.id,
                      version_attendue=expected, version_courante=courante)
            raise ConcurrencyConflict(
                f"Dossier {dossier.id} modifié entre-temps (version courante "
                f"{courante}, attendue {expected}) — rechargez")

    def modifier_donnee(self, dossier, section_nom, acteur, champ, valeur, at,
                        process=None, expected_version=None):
        self._verifier_version(dossier, expected_version, acteur, at)
        if dossier.lecture_seule:
            raise InvalidTransition(
                f"Dossier {dossier.id} en lecture seule (conservation LBA, R20)")
        dossier.derniere_activite = at
        s = dossier.sections[section_nom]
        s.donnees[champ] = valeur
        s.preparateurs.add(acteur)  # R13 : toucher un champ fait de vous un préparateur
        self._log(at, "donnee_modifiee", acteur,
                  dossier=dossier.id, section=section_nom, champ=champ,
                  **({"process": process.id} if process else {}))
        # R6/R10 : invalidation ciblée du visa de CETTE section (en attente OU accordé)
        if s.visa and s.visa.etat in (VisaState.EN_ATTENTE, VisaState.ACCORDE):
            s.visa.etat = VisaState.INVALIDE
            s.etat = SectionState.EN_PREPARATION
            self._log(at, "visa_invalide", "system", dossier=dossier.id,
                      section=section_nom, cause="donnees_modifiees")
            self._notify(s.visa.validateur,
                         f"Visa {section_nom} invalidé : données modifiées ({dossier.id})")
            # R15/V-17 : une validation finale en attente est invalidée à son tour
            fin = dossier.sections.get(FINAL_STEP)
            if fin and fin is not s and fin.visa and fin.visa.etat == VisaState.EN_ATTENTE:
                fin.visa.etat = VisaState.INVALIDE
                fin.etat = SectionState.EN_PREPARATION
                self._log(at, "visa_invalide", "system", dossier=dossier.id,
                          section=FINAL_STEP, cause="section_modifiee_en_aval")
                self._notify(fin.visa.validateur,
                             f"Validation finale invalidée ({dossier.id})")

    def ajouter_document(self, dossier, section_nom, doc: Document, acteur, at):
        s = dossier.sections[section_nom]
        s.documents.append(doc)
        self._log(at, "document_ajoute", acteur, dossier=dossier.id,
                  section=section_nom, document=doc.nom)

    # ---------- soumission ----------
    def soumettre_au_visa(self, dossier, section_nom, acteur, at,
                          conditionnel=False, attente=None, process=None, expected_version=None):
        self._verifier_version(dossier, expected_version, acteur, at)
        dossier.derniere_activite = at
        s = dossier.sections[section_nom]
        if s.etat == SectionState.VISEE:
            raise InvalidTransition(f"Section {section_nom} déjà visée")
        validateur = self._resoudre_validateur(s, dossier, at)
        s.visa = Visa(validateur=validateur, soumis_le=at,
                      conditionnel=conditionnel, attente=attente)
        s.etat = SectionState.EN_VALIDATION
        if conditionnel and attente:
            self.taches.append(("collecte", dossier.id, attente["document"]))
            self._log(at, "tache_collecte_creee", "system", dossier=dossier.id,
                      section=section_nom, document=attente["document"],
                      obligatoire=attente.get("obligatoire", False))
        # R61 : anti-goulot MESURÉ — signal + proposition, jamais d'imposition (R39/R40)
        if self.config_r61_seuil_file is not None:
            file_n = self._file_visas(validateur)
            if file_n > self.config_r61_seuil_file:
                self._log(at, "goulot_signale", "system", validateur=validateur,
                          file=file_n, seuil=self.config_r61_seuil_file)
                relais = self.relais.get(validateur)
                if relais:
                    self._log(at, "routage_relais_propose", "system",
                              dossier=dossier.id, section=section_nom,
                              validateur=validateur, relais=relais)
        self._log(at, "visa_soumis", acteur, dossier=dossier.id,
                  section=section_nom, validateur=validateur,
                  conditionnel=conditionnel,
                  **({"process": process.id} if process else {}))

    def _resoudre_validateur(self, section, dossier, at):
        """R4 : validateur nommé, sinon relais nommé (la dérogation, elle,
        est explicite au moment d'accorder)."""
        v = section.validateur
        if v in self.absences and v in self.relais:
            r = self.relais[v]
            self._log(at, "visa_route_vers_relais", "system",
                      dossier=dossier.id, section=section.nom,
                      validateur=v, relais=r)
            return r
        return v

    # ---------- R56 : règles tenant (durcir seulement, default-deny) ----------
    TYPES_REGLES_TENANT = {
        "minPreparateurs":    "au moins N contributeurs distincts avant visa",
        "sectionsPrealables": "une section n'est visable qu'après une autre",
        "quatreYeuxRenforce": "le signataire n'a contribué à AUCUNE section du dossier",
        "engagementSection":  "pop-up d'engagement (R14) étendu à une section donnée",
        "motifRefusMin":      "longueur minimale de la motivation de refus (durcit R7)",
    }

    def ajouter_regle_tenant(self, regle, acteur, at):
        if regle.get("type") not in self.TYPES_REGLES_TENANT:
            raise RegleTenantInvalide(
                f"R56 : type de règle inconnu ou interdit « {regle.get('type')} » — "
                "les règles tenant ne peuvent que durcir, jamais assouplir un invariant")
        r = {"actif": True, "source": "manuel", "justification": "", **regle}
        self.regles_tenant.append(r)
        self._log(at, "regle_tenant_ajoutee", acteur, regle=r["id"],
                  regle_type=r["type"], source=r["source"],
                  justification=r["justification"], params=str(r.get("params", {})))
        return r

    def activer_regle_tenant(self, regle_id, actif, acteur, at):
        r = next((x for x in self.regles_tenant if x["id"] == regle_id), None)
        if r is None:
            raise RegleTenantInvalide(f"règle {regle_id} inconnue")
        r["actif"] = actif
        self._log(at, "regle_tenant_activee" if actif else "regle_tenant_desactivee",
                  acteur, regle=regle_id)

    def _regles_actives(self, type_):
        return [r for r in self.regles_tenant if r["actif"] and r["type"] == type_]

    # ---------- décision ----------
    def accorder_visa(self, dossier, section_nom, acteur, at,
                      engagement=False, derogation=None, process=None, expected_version=None):
        self._verifier_version(dossier, expected_version, acteur, at)
        dossier.derniere_activite = at
        s = dossier.sections[section_nom]
        if s.visa is None or s.visa.etat != VisaState.EN_ATTENTE:
            raise InvalidTransition(f"Aucun visa en attente sur {section_nom}")
        # R58 : habilitation/formation du signataire en cours de validité
        exp_hab = self.habilitations.get(acteur)
        if exp_hab is not None and exp_hab < at:
            if derogation is not None:
                self._log(at, "derogation_prononcee", derogation["decideur"],
                          dossier=dossier.id, section=section_nom, beneficiaire=acteur,
                          fiche_de_poste=derogation["fiche_de_poste"],
                          motif="habilitation expirée — R58 via R4")
            else:
                self.taches.append(("renouvellement_habilitation", acteur))
                self._log(at, "tentative_visa_refusee_habilitation", acteur,
                          dossier=dossier.id, section=section_nom,
                          expiree_le=exp_hab.isoformat())
                raise NotAuthorized(
                    f"R58 : habilitation de {acteur} expirée le {exp_hab.date()} — "
                    "visa refusé, tâche de renouvellement créée (dérogation possible via R4)")
        # R57 : un validateur récusé ne peut plus JAMAIS viser cette section
        if acteur in self.recusations.get((dossier.id, section_nom), set()):
            self._log(at, "tentative_visa_refusee_recusation", acteur,
                      dossier=dossier.id, section=section_nom)
            raise NotAuthorized(
                f"R57 : {acteur} s'est récusé sur {section_nom} — visa définitivement interdit")
        # R13 : exclusion 4-yeux au niveau section — tentative tracée
        if acteur in s.preparateurs:
            self._log(at, "tentative_visa_refusee_4yeux", acteur,
                      dossier=dossier.id, section=section_nom)
            raise FourEyesViolation(
                "Principe 4-yeux : préparateur exclu de la validation de sa section")
        # R52 (ratifié 2026-07-12) : tout contributeur du dossier est exclu
        # du visa de validation finale — 4-yeux global sur l'étape finale.
        if section_nom == FINAL_STEP:
            contributeurs = set().union(
                *(sec.preparateurs for sec in dossier.sections.values()))
            if acteur in contributeurs:
                self._log(at, "tentative_visa_refusee_4yeux", acteur,
                          dossier=dossier.id, section=section_nom, regle="R52")
                raise FourEyesViolation(
                    "R52 : contributeur du dossier exclu du visa de validation finale")
        # R59 : au-delà du seuil, la finale exige un SECOND signataire distinct —
        # celui-ci n'est pas le validateur nommé (R2 ne s'applique qu'au premier).
        deuxieme_r59 = (section_nom == FINAL_STEP
                        and self.config_r59_score_seuil is not None
                        and getattr(dossier, "score_risque", None) is not None
                        and dossier.score_risque >= self.config_r59_score_seuil
                        and getattr(s.visa, "premier_signataire", None) is not None)
        # Le bon signataire : validateur du visa, ou tiers sous dérogation tracée (R4)
        if acteur != s.visa.validateur and not deuxieme_r59:
            if derogation is None:
                from .errors import NotNamedValidator
                raise NotNamedValidator(
                    f"{acteur} n'est pas le validateur nommé et aucune dérogation n'est fournie (R2)")
            s.visa.sous_derogation = True
            self._log(at, "derogation_prononcee", derogation["decideur"],
                      dossier=dossier.id, section=section_nom,
                      beneficiaire=acteur,
                      fiche_de_poste=derogation["fiche_de_poste"])
        # R60 : fraîcheur des sections — une section visée il y a trop longtemps
        # exige une re-confirmation légère de SON validateur avant la finale.
        if section_nom == FINAL_STEP and self.config_r60_fraicheur_jours is not None:
            perimees = []
            for nom_s, sx in dossier.sections.items():
                if nom_s == FINAL_STEP or sx.visa is None:
                    continue
                ref = getattr(sx, "reconfirme_le", None) or getattr(sx, "visa_accorde_le", None)
                if ref is not None and (at - ref).days > self.config_r60_fraicheur_jours:
                    perimees.append(nom_s)
            if perimees:
                for nom_s in perimees:
                    self.taches.append(("reconfirmation_section", dossier.id, nom_s))
                self._log(at, "reconfirmation_requise_r60", "system", dossier=dossier.id,
                          sections=",".join(perimees),
                          seuil_jours=self.config_r60_fraicheur_jours)
                raise InvalidTransition(
                    "R60 : sections visées il y a plus de "
                    f"{self.config_r60_fraicheur_jours} jours — re-confirmation requise : "
                    + ", ".join(perimees))
        # R14/R15 : pop-up d'engagement de responsabilité à l'étape finale
        if section_nom == FINAL_STEP:
            if not engagement:
                raise EngagementRequired(
                    "Le validateur final doit confirmer l'engagement de sa responsabilité "
                    "sur le respect des process (pop-up)")
            self._log(at, "engagement_responsabilite_confirme", acteur,
                      dossier=dossier.id)
        # R56 : contrôles additionnels des règles tenant (elles s'AJOUTENT aux invariants)
        for r in self._regles_actives("minPreparateurs"):
            if len(s.preparateurs) < r["params"]["n"]:
                raise RegleTenantViolation(
                    f"{r['id']} (règle tenant) : au moins {r['params']['n']} contributeurs "
                    f"distincts requis — {len(s.preparateurs)} constaté")
        for r in self._regles_actives("sectionsPrealables"):
            if section_nom == r["params"]["section"]:
                av = dossier.sections.get(r["params"]["avant"])
                if av is None or av.visa is None or av.visa.etat != VisaState.ACCORDE:
                    raise RegleTenantViolation(
                        f"{r['id']} (règle tenant) : « {r['params']['section']} » n'est "
                        f"visable qu'après « {r['params']['avant']} » visée")
        for r in self._regles_actives("quatreYeuxRenforce"):
            if any(acteur in sec.preparateurs for sec in dossier.sections.values()):
                raise RegleTenantViolation(
                    f"{r['id']} (règle tenant) : 4-yeux renforcé — {acteur} a contribué au dossier")
        for r in self._regles_actives("engagementSection"):
            if section_nom == r["params"]["section"] and not engagement:
                raise RegleTenantViolation(
                    f"{r['id']} (règle tenant) : engagement de responsabilité étendu à "
                    f"« {r['params']['section']} » (R14)")
        # R59 : au-delà du seuil de risque, la validation finale exige DEUX
        # signataires distincts, chacun avec son engagement R14.
        if (section_nom == FINAL_STEP and self.config_r59_score_seuil is not None
                and getattr(dossier, "score_risque", None) is not None
                and dossier.score_risque >= self.config_r59_score_seuil):
            premier = getattr(s.visa, "premier_signataire", None)
            if premier is None:
                s.visa.premier_signataire = acteur
                self._log(at, "visa_final_premier_signataire", acteur,
                          dossier=dossier.id, score=dossier.score_risque,
                          seuil=self.config_r59_score_seuil)
                return   # le visa RESTE en attente du second signataire
            if acteur == premier:
                raise NotAuthorized(
                    "R59 : la validation finale exige deux signataires DISTINCTS "
                    f"— {acteur} a déjà apposé le premier visa")
        s.visa.etat = VisaState.ACCORDE
        s.etat = SectionState.VISEE
        s.visa_accorde_le = at   # R60 : horodatage de fraîcheur
        self._log(at, "visa_accorde", acteur, dossier=dossier.id,
                  section=section_nom, sous_derogation=s.visa.sous_derogation,
                  **({"cosignataires": getattr(s.visa, "premier_signataire", None) + "+" + acteur}
                     if getattr(s.visa, "premier_signataire", None) else {}),
                  **({"process": process.id} if process else {}))
        if process:
            process.sections_revalidees.add(section_nom)
        if section_nom == FINAL_STEP:
            snap = self.referentiel.snapshot(at)
            if snap:
                dossier.referentiel = snap
                self._log(at, "dossier_estampille", "system",
                          dossier=dossier.id, **snap)
        self._peut_etre_declencher_finale(dossier, at)

    def _peut_etre_declencher_finale(self, dossier, at):
        """R15 : toutes les sections visées -> tâche de visa pour l'étape finale."""
        fin = dossier.sections.get(FINAL_STEP)
        if fin is None or fin.etat != SectionState.EN_PREPARATION or fin.visa is not None:
            return
        autres = [s for n, s in dossier.sections.items() if n != FINAL_STEP]
        if autres and all(s.etat == SectionState.VISEE for s in autres):
            self.soumettre_au_visa(dossier, FINAL_STEP, "system", at)
            self.taches.append(("visa_final", dossier.id, fin.validateur))

    # ---------- R58 : habilitation du signataire ----------
    def definir_habilitation(self, acteur, expire_le, at):
        self.habilitations[acteur] = expire_le
        self._log(at, "habilitation_definie", acteur, expire_le=expire_le.isoformat())

    # ---------- R59 : score de risque du dossier (seuil double visa) ----------
    def definir_score_risque(self, dossier, score, at):
        dossier.score_risque = score
        self._log(at, "score_risque_defini", "system", dossier=dossier.id, score=score)

    # ---------- R60 : re-confirmation légère d'une section ancienne ----------
    def reconfirmer_section(self, dossier, section_nom, acteur, at):
        s = dossier.sections[section_nom]
        if acteur != s.validateur:
            raise NotAuthorized(
                f"R60 : la re-confirmation revient au validateur de la section ({s.validateur})")
        s.reconfirme_le = at
        self._log(at, "section_reconfirmee", acteur, dossier=dossier.id, section=section_nom)

    def refuser_reconfirmation(self, dossier, section_nom, acteur, at, motivation=None):
        """R60 : refus de re-confirmer = invalidation ciblée (mécanique R10)."""
        s = dossier.sections[section_nom]
        if acteur != s.validateur:
            raise NotAuthorized("R60 : seul le validateur de la section peut refuser de re-confirmer")
        if not motivation:
            raise MotivationRequired("R60 : le refus de re-confirmation exige une motivation")
        s.visa.etat = VisaState.INVALIDE
        s.etat = SectionState.EN_PREPARATION
        s.visa_accorde_le = None
        self._log(at, "section_invalidee_r60", acteur, dossier=dossier.id,
                  section=section_nom, motivation=motivation)

    # ---------- R61 : routage vers le relais — DÉCISION humaine (R39/R40) ----------
    def accepter_routage_relais(self, dossier, section_nom, decideur, at):
        s = dossier.sections[section_nom]
        relais = self.relais.get(s.visa.validateur)
        if not relais:
            raise InvalidTransition(f"R61 : aucun relais R4 déclaré pour {s.visa.validateur}")
        ancien = s.visa.validateur
        s.visa.validateur = relais
        self._log(at, "routage_relais_decide", decideur, dossier=dossier.id,
                  section=section_nom, ancien=ancien, relais=relais)

    def _file_visas(self, validateur):
        n = 0
        for dd in self.dossiers.values():
            for sx in dd.sections.values():
                if sx.visa is not None and sx.visa.etat == VisaState.EN_ATTENTE \
                        and sx.visa.validateur == validateur:
                    n += 1
        return n

    def recuser_visa(self, dossier, section_nom, acteur, at, motivation=None):
        """R57 : le validateur assigné peut se récuser (conflit d'intérêts) —
        motivation obligatoire, événement tracé, il ne pourra plus JAMAIS viser
        cette section. Le visa reste en attente d'une réassignation (R11)."""
        s = dossier.sections[section_nom]
        if s.visa is None or s.visa.etat != VisaState.EN_ATTENTE:
            raise InvalidTransition(f"Aucun visa en attente sur {section_nom}")
        if acteur != s.visa.validateur:
            raise NotAuthorized(
                f"R57 : seul le validateur assigné ({s.visa.validateur}) peut se récuser")
        if not motivation:
            raise MotivationRequired("R57 : la récusation exige une motivation obligatoire")
        self.recusations.setdefault((dossier.id, section_nom), set()).add(acteur)
        self._log(at, "recusation_prononcee", acteur, dossier=dossier.id,
                  section=section_nom, motivation=motivation)
        if section_nom == FINAL_STEP:
            self.taches.append(("escalade_recusation_finale", dossier.id, "process_owner"))
            self._log(at, "escalade_emise", "system", dossier=dossier.id,
                      section=section_nom, motif="récusation sur la validation finale")

    # ---------- R62 : export d'audit scellé ----------
    @staticmethod
    def _canon_event(e):
        return json.dumps({"seq": e.seq, "at": e.at.isoformat(), "type": e.type,
                           "actor": e.actor, "payload": dict(e.payload)},
                          sort_keys=True, separators=(",", ":"),
                          ensure_ascii=False, default=str)

    def exporter_audit_scelle(self, acteur, at, de_seq=1, a_seq=None):
        """R62 : export d'une plage du journal avec scellé d'intégrité (hash
        chaîné SHA-256). L'export est LUI-MÊME un événement journalisé — mais
        postérieur au scellé, pour ne pas s'inclure lui-même."""
        evs = [e for e in self.journal.all()
               if e.seq >= de_seq and (a_seq is None or e.seq <= a_seq)]
        canons, h = [], "0" * 64
        for e in evs:
            c = self._canon_event(e)
            canons.append(c)
            h = hashlib.sha256((h + c).encode("utf-8")).hexdigest()
        export = {"de_seq": de_seq, "a_seq": a_seq if a_seq is not None else (evs[-1].seq if evs else 0),
                  "emis_le": at.isoformat(), "par": acteur,
                  "evenements": canons, "scelle": h}
        self._log(at, "export_scelle_emis", acteur, de_seq=export["de_seq"],
                  a_seq=export["a_seq"], scelle=h, nb=len(canons))
        return export

    @staticmethod
    def verifier_export_scelle(export):
        """R62 : toute altération d'un événement exporté casse le scellé."""
        h = "0" * 64
        for c in export["evenements"]:
            h = hashlib.sha256((h + c).encode("utf-8")).hexdigest()
        return h == export["scelle"]

    def refuser_visa(self, dossier, section_nom, acteur, at, motivation=None, expected_version=None):
        self._verifier_version(dossier, expected_version, acteur, at)
        s = dossier.sections[section_nom]
        if s.visa is None or s.visa.etat != VisaState.EN_ATTENTE:
            raise InvalidTransition(f"Aucun visa en attente sur {section_nom}")
        if not motivation:
            raise MotivationRequired("Le refus d'un visa exige une motivation obligatoire")
        # R56 : durcissement tenant de R7 — longueur minimale de la motivation
        for r in self._regles_actives("motifRefusMin"):
            if len(motivation) < r["params"]["n"]:
                raise RegleTenantViolation(
                    f"{r['id']} (règle tenant) : motivation de refus trop courte "
                    f"({len(motivation)} < {r['params']['n']} caractères) — durcit R7")
        s.visa.etat = VisaState.REFUSE
        s.visa.motivation_refus = motivation
        s.etat = SectionState.EN_PREPARATION
        self._log(at, "visa_refuse", acteur, dossier=dossier.id,
                  section=section_nom, motivation=motivation)
        for p in s.preparateurs:
            self._notify(p, f"Visa {section_nom} refusé : {motivation}")

    def resoumettre(self, dossier, section_nom, acteur, at, expected_version=None):
        """R7 : après correction, re-soumission au MÊME validateur (owner du client).
        Si le validateur a quitté la banque, la réassignation R11 est un préalable."""
        self._verifier_version(dossier, expected_version, acteur, at)
        s = dossier.sections[section_nom]
        if s.visa is None or s.visa.etat not in (VisaState.REFUSE, VisaState.INVALIDE):
            raise InvalidTransition("Rien à re-soumettre")
        if s.validateur not in self.actifs:
            raise NotAuthorized(
                f"Validateur {s.validateur} inactif : réassignation par le process owner "
                "/ application manager requise (escalade COO à défaut)")
        self.soumettre_au_visa(dossier, section_nom, acteur, at)

    def tenter_revocation(self, dossier, section_nom, acteur, at):
        """R9 : la révocation discrétionnaire n'existe pas."""
        self._log(at, "tentative_revocation_refusee", acteur,
                  dossier=dossier.id, section=section_nom)
        raise RevocationNotAllowed("La révocation discrétionnaire n'existe pas")

    def annuler_pour_vice(self, dossier, section_nom, motif,
                          process_owner, validateur_final, at):
        """R12/R14 : annulation pour vice de process — conjointe process owner
        + validateur final, incident de risque opérationnel enregistré."""
        s = dossier.sections[section_nom]
        if s.visa is None or s.visa.etat != VisaState.ACCORDE:
            raise InvalidTransition("Seul un visa accordé peut être annulé pour vice")
        s.visa.etat = VisaState.ANNULE
        s.etat = SectionState.EN_PREPARATION
        self._log(at, "visa_annule_vice_process", process_owner,
                  dossier=dossier.id, section=section_nom, motif=motif,
                  co_decideur=validateur_final)
        self._log(at, "incident_risque_operationnel", "system",
                  dossier=dossier.id, section=section_nom, motif=motif)

    def reassigner_validateur(self, dossier, section_nom, nouveau, decideur,
                              role_decideur, at, escalade_coo=False):
        """R11 : décision process owner / application manager, escalade COO."""
        if role_decideur not in ROLES_REASSIGNATION:
            raise NotAuthorized(f"Rôle {role_decideur} non habilité à réassigner")
        s = dossier.sections[section_nom]
        ancien = s.validateur
        s.validateur = nouveau
        if s.visa and s.visa.etat in (VisaState.EN_ATTENTE, VisaState.REFUSE):
            s.visa.validateur = nouveau
        self._log(at, "validateur_reassigne", decideur, dossier=dossier.id,
                  section=section_nom, ancien=ancien, nouveau=nouveau,
                  role=role_decideur, escalade_coo=escalade_coo)

    # ---------- cycle de vie du dossier (bloc 2, R16-R23) ----------
    def activer_dossier(self, dossier, at):
        dossier.etat = DossierState.ACTIF
        dossier.derniere_activite = at
        self._log(at, "dossier_active", "system", dossier=dossier.id)

    def suspendre(self, dossier, cause, at):
        """R17 : suspension avec les restrictions EN VIGUEUR à la date (S-09) —
        une réforme ultérieure ne réécrit pas les restrictions déjà appliquées."""
        from .config_tenant import config_a
        cfg = config_a(self, at)
        dossier.etat = DossierState.SUSPENDU
        dossier.restrictions = dict(cfg["restrictions_suspendu"])
        self._log(at, "dossier_suspendu", "system",
                  dossier=dossier.id, cause=cause,
                  restrictions=str(dossier.restrictions))
        if cfg.get("notifier_client_suspension"):
            self._notify(dossier.titulaire, "Votre relation est suspendue")
        # sinon : silence côté client (art. 9a LBA)

    def rattacher_alerte(self, dossier, alerte, at):
        """R16/R17 : une alerte non résolue suspend le dossier."""
        self._log(at, "alerte_rattachee", "system",
                  dossier=dossier.id, alerte=alerte)
        self.suspendre(dossier, cause=f"alerte:{alerte}", at=at)

    def operation_autorisee(self, dossier, sens):
        """sens : 'entree' | 'sortie'. Hors suspension : tout est permis."""
        if dossier.etat != DossierState.SUSPENDU:
            return True
        return bool(dossier.restrictions.get(
            "entrees" if sens == "entree" else "sorties"))

    def rejeter(self, dossier, motif, at):
        """R18 : rejet distinct de la clôture, alimente la liste des refusés."""
        dossier.etat = DossierState.REJETE
        if dossier.titulaire:
            self.prospects_refuses[dossier.titulaire] = (dossier.id, motif)
        self._log(at, "dossier_rejete", "system",
                  dossier=dossier.id, motif=motif)

    def reactiver(self, dossier, at):
        """R19 : un dossier abandonné est réactivable."""
        if dossier.etat != DossierState.ABANDONNE:
            raise InvalidTransition("Seul un dossier abandonné se réactive")
        dossier.etat = DossierState.EN_PREPARATION
        dossier.rappels_abandon = 0
        dossier.derniere_activite = at
        self._log(at, "dossier_reactive", "system", dossier=dossier.id)

    def demande_effacement_lpd(self, dossier, demandeur, at):
        """R20 : la conservation LBA (10 ans) prime sur l'effacement LPD."""
        self._log(at, "demande_effacement_recue", demandeur, dossier=dossier.id)
        self._log(at, "effacement_refuse_conservation_lba", "system",
                  dossier=dossier.id, base_legale="LBA art. 7 (10 ans)")
        dossier.lecture_seule = True

    def changement_circonstances(self, dossier, sections, description,
                                 risque_majeur, at):
        """R21/R22 : réouverture ciblée ; c'est le risque du changement qui
        décide des restrictions, pas le changement lui-même."""
        self._log(at, "changement_circonstances", "system",
                  dossier=dossier.id, description=description,
                  sections=",".join(sections), risque_majeur=risque_majeur)
        for nom in sections:
            s = dossier.sections[nom]
            s.etat = SectionState.EN_PREPARATION
            if s.visa and s.visa.etat == VisaState.ACCORDE:
                s.visa.etat = VisaState.INVALIDE
                self._log(at, "visa_invalide", "system", dossier=dossier.id,
                          section=nom, cause="changement_circonstances")
        if risque_majeur:
            self.suspendre(dossier, cause=f"coc_risque_majeur:{description}", at=at)
            self._notify("MLRO", f"Risque majeur sur {dossier.id} : {description}")
        else:
            dossier.etat = DossierState.EN_MISE_A_JOUR

    def client_operationnel(self, dossier):
        """R21 : en mise à jour, le client transige ; suspendu, non."""
        return dossier.etat in (DossierState.ACTIF, DossierState.EN_MISE_A_JOUR)

    # ---------- processes concurrents (R23) ----------
    def ouvrir_process(self, dossier, type, at):
        self._seq_process += 1
        p = Process(id=f"PRC-{self._seq_process:04d}", type=type, ouvert_le=at)
        # R23 : l'événement de risque est prioritaire sur la recertification
        if type == "evenement":
            for q in dossier.processes:
                if q.type == "recertification" and q.etat == "EN_COURS":
                    q.etat = "EN_PAUSE"
                    self._log(at, "process_mis_en_pause", "system",
                              dossier=dossier.id, process=q.id,
                              cause=f"priorite:{p.id}")
        dossier.processes.append(p)
        self._log(at, "process_ouvert", "system",
                  dossier=dossier.id, process=p.id, process_type=type)
        if type == "recertification":
            snap = self.referentiel.snapshot(at)
            if snap and dossier.referentiel != snap:
                ancien = dict(dossier.referentiel or {})
                dossier.referentiel = snap
                self._log(at, "dossier_rebase", "system", dossier=dossier.id,
                          ancien=str(ancien), nouveau=str(snap))
        return p

    def cloturer_process(self, dossier, process, at):
        process.etat = "CLOTURE"
        self._log(at, "process_cloture", "system",
                  dossier=dossier.id, process=process.id)

    def reprendre_recertification(self, dossier, recert, at):
        """R23 : reprise avec absorption des sections déjà revalidées par
        les process événement clôturés depuis l'ouverture de la recert."""
        recert.etat = "EN_COURS"
        self._log(at, "process_repris", "system",
                  dossier=dossier.id, process=recert.id)
        plan = {}
        for nom, s in dossier.sections.items():
            if nom == FINAL_STEP:
                continue
            source = next((p for p in dossier.processes
                           if p.type == "evenement" and p.etat == "CLOTURE"
                           and nom in p.sections_revalidees
                           and p.ouvert_le >= recert.ouvert_le), None)
            if source and s.visa and s.visa.etat == VisaState.ACCORDE:
                plan[nom] = f"absorbe:{source.id}"
                self._log(at, "section_absorbee", "system",
                          dossier=dossier.id, process=recert.id,
                          section=nom, source=source.id)
            else:
                plan[nom] = "a_revalider"
        return plan

    # ---------- personnes liées (bloc 4, R30-R36) ----------
    def creer_personne(self, pid, nom, at, **donnees):
        p = Personne(id=pid, nom=nom, donnees=dict(donnees),
                     etat=PersonneState.ACTIVE)
        self.personnes[pid] = p
        self._log(at, "personne_creee", "system", personne=pid)
        return p

    def _dossiers_de(self, pid):
        vus, out = set(), []
        for (p, did, _r) in self.roles:
            if p == pid and did not in vus:
                vus.add(did)
                out.append(self.dossiers[did])
        return out

    def lier_personne(self, dossier, pid, role, at):
        """R31 : cumul selon politique banque ; si autorisé en conflit
        d'intérêts, flag insider obligatoire, posé et tracé."""
        p = self.personnes[pid]
        roles_existants = [r for (q, did, r) in self.roles
                           if q == pid and did == dossier.id]
        if roles_existants:
            if not self.config["cumul_roles_autorise"]:
                raise NotAuthorized(
                    f"Cumul de rôles interdit par la politique banque : "
                    f"{pid} est déjà {roles_existants[0]} sur {dossier.id}")
            p.flags.add("insider")
            self._log(at, "flag_pose", "system", personne=pid,
                      dossier=dossier.id, flag="insider",
                      cause=f"cumul:{roles_existants[0]}+{role}")
        self.roles.append((pid, dossier.id, role))
        dossier.personnes_liees.append({"id": pid, "role": role})
        if p.etat == PersonneState.ARCHIVEE:      # R35 : réactivable
            p.etat = PersonneState.ACTIVE
            self._log(at, "personne_reactivee", "system", personne=pid)
        self._log(at, "personne_liee", "system", personne=pid,
                  dossier=dossier.id, role=role)

    def retirer_role(self, dossier, pid, role, at):
        self.roles.remove((pid, dossier.id, role))
        dossier.personnes_liees = [x for x in dossier.personnes_liees
                                   if not (x["id"] == pid and x["role"] == role)]
        self._log(at, "role_retire", "system", personne=pid,
                  dossier=dossier.id, role=role)
        if not any(q == pid for (q, _d, _r) in self.roles):   # R35
            self.personnes[pid].etat = PersonneState.ARCHIVEE
            self._log(at, "personne_archivee", "system", personne=pid,
                      base_legale="conservation LBA")

    def flags_aml(self, pid):
        """R31 : les flags sont exposés aux scénarios AML."""
        return set(self.personnes[pid].flags)

    def changement_circonstances_personne(self, pid, champ, valeur, at,
                                          document=None):
        """R30 : propagation par événement, jamais de synchro silencieuse.
        La donnée vit sur la personne unique ; les dossiers reçoivent un
        événement de propagation et leurs RM une alerte."""
        p = self.personnes[pid]
        p.donnees[champ] = valeur
        self._log(at, "coc_personne_cree", "system", personne=pid, champ=champ)
        if document:
            self.taches.append(("maj_ged", pid, document))
            self._log(at, "tache_maj_ged_creee", "system",
                      personne=pid, document=document)
        for d in self._dossiers_de(pid):
            self._log(at, "coc_propage", "system", personne=pid,
                      dossier=d.id, champ=champ)
            if d.rm:
                self._notify(d.rm,
                             f"CoC {pid} ({champ}) impacte votre dossier {d.id}")
        # R42 : rescreening immédiat sur modification des données d'identité
        if champ in ("nom", "naissance", "nationalite"):
            self._log(at, "rescreening_declenche", "system",
                      personne=pid, cause=f"coc:{champ}")
            # R44 : impact sur la whitelist -> analyse IA, décision humaine
            for (wp, profil), justif in list(self.whitelist.items()):
                if wp == pid:
                    if self.ia:
                        impact = self.ia.analyser_impact_whitelist(
                            personne=pid, profil=profil,
                            champ=champ, justification_entree=justif)
                    else:
                        impact = (f"changement {champ} : pertinence de la "
                                  f"whitelist à réévaluer (entrée : {justif})")
                    self._log(at, "analyse_ia_whitelist", "ia",
                              personne=pid, profil=profil, impact=impact)
                    self._notify("responsable_whitelist",
                                 f"Décision requise : whitelist {pid}/{profil}")

    # ---------- PEP (R32/R33) ----------
    def declarer_pep(self, pid, source, at):
        """R32 : événement contagieux — tâche de réévaluation par dossier,
        aucune bascule silencieuse de niveau de risque."""
        p = self.personnes[pid]
        p.statut_pep = True
        self._log(at, "pep_declare", "system", personne=pid, source=source)
        for d in self._dossiers_de(pid):
            self.taches.append(("reevaluation_pep", d.id, pid))
            self._log(at, "pep_propage", "system", personne=pid, dossier=d.id)
            if d.rm:
                self._notify(d.rm, f"{pid} déclaré PEP : réévaluation {d.id}")

    def fin_mandat_pep(self, pid, at):
        self.personnes[pid].fin_mandat_pep = at
        self._log(at, "fin_mandat_pep", "system", personne=pid)

    def tick_personnes(self, now):
        """R33 : le délai écoulé ne dé-PEPise jamais — il alerte."""
        for p in self.personnes.values():
            if (p.statut_pep and p.fin_mandat_pep
                    and not p.alerte_depep_emise
                    and now - p.fin_mandat_pep >= self.config["depep_delai"]):
                p.alerte_depep_emise = True
                self._log(now, "alerte_depep", "system", personne=p.id)
                self._notify("central_file",
                             f"Délai post-mandat écoulé pour {p.id} : "
                             "décision de dé-PEPisation attendue")
                for d in self._dossiers_de(p.id):
                    if d.rm:
                        self._notify(d.rm, f"Dé-PEPisation de {p.id} à décider")

    def lever_pep(self, pid, decideur, at):
        """R33 : décision humaine, tracée."""
        self.personnes[pid].statut_pep = False
        self._log(at, "pep_leve", decideur, personne=pid)

    # ---------- relations bijectives (R34) ----------
    def declarer_relation(self, a, b, type_ab, type_ba, at):
        self.relations.append((a, type_ab, b, type_ba))
        self._log(at, "relation_declaree", "system",
                  personne_a=a, type_ab=type_ab, personne_b=b, type_ba=type_ba)

    def relations_de(self, pid):
        out = []
        for (a, tab, b, tba) in self.relations:
            if a == pid:
                out.append((b, tab))
            if b == pid:
                out.append((a, tba))
        return out

    def supprimer_relation(self, a, b, at):
        """R34 : la suppression de l'une supprime l'autre (même arête)."""
        self.relations = [r for r in self.relations
                          if not ((r[0] == a and r[2] == b)
                                  or (r[0] == b and r[2] == a))]
        self._log(at, "relation_supprimee", "system",
                  personne_a=a, personne_b=b)

    # ---------- divergence d'identité (R36) ----------
    def signaler_divergence(self, pid, champ, constats, at):
        """R36 : dossier Central File + corroboration auprès des RM.
        Aucune donnée n'est modifiée avant résolution humaine."""
        self._log(at, "dossier_central_file_ouvert", "system",
                  personne=pid, champ=champ,
                  constats=str(constats))
        for did in constats:
            rm = self.dossiers[did].rm
            if rm:
                self.taches.append(("corroboration", pid, rm))
                self._log(at, "tache_corroboration_creee", "system",
                          personne=pid, dossier=did, rm=rm)

    def resoudre_divergence(self, pid, champ, valeur, document, decideur, at):
        """R36 : arbitrage humain tracé, corroboré par document intégré."""
        self.personnes[pid].donnees[champ] = valeur
        self._log(at, "divergence_resolue", decideur, personne=pid,
                  champ=champ, valeur=valeur, document=document)

    # ---------- tâches, corbeilles et rôles (bloc 5, R37-R41) ----------
    def creer_tache(self, type, dossier, role, at, cible=None, sla=None):
        """R38 : rôle d'abord, personne ensuite — et jamais vers quelqu'un
        qui ne connaît pas la relation client."""
        if cible is not None:
            if dossier.id not in self.scopes.get(cible, set()):
                raise NotAuthorized(
                    f"{cible} ne connaît pas la relation {dossier.id} : "
                    "routage interdit (R38)")
            titulaire = cible
        else:
            titulaire = next((m for m in sorted(self.role_membres.get(role, ()))
                              if dossier.id in self.scopes.get(m, set())), None)
        self._seq_tache += 1
        tache = Tache(id=f"TSK-{self._seq_tache:05d}", type=type,
                      dossier_id=dossier.id, role=role,
                      titulaire=titulaire, cree_le=at, sla=sla)
        self.gestion_taches.append(tache)
        self._log(at, "tache_creee", "system", dossier=dossier.id,
                  tache=tache.id, tache_type=type, role=role,
                  titulaire=titulaire or "")
        return tache

    def deleguer_tache(self, tache, de, vers, at):
        """R38 : la délégation RM -> ARM est le fonctionnement normal."""
        tache.titulaire = vers
        self._log(at, "tache_deleguee", de, tache=tache.id, de=de, vers=vers)

    def reaffecter_tache(self, tache, vers, manager, at):
        """R40 : réaffectation managériale, tracée avec son auteur."""
        ancien = tache.titulaire
        tache.titulaire = vers
        self._log(at, "tache_reaffectee", manager, tache=tache.id,
                  ancien=ancien or "", nouveau=vers)

    def tick_taches(self, now):
        """R39 : le dépassement de SLA mesure et notifie — ne force rien."""
        for tache in self.gestion_taches:
            if (tache.etat == "OUVERTE" and tache.sla
                    and not tache.sla_depasse
                    and now - tache.cree_le >= tache.sla):
                tache.sla_depasse = True
                self.compteurs_sla[tache.role] =                     self.compteurs_sla.get(tache.role, 0) + 1
                self._log(now, "sla_depasse", "system", tache=tache.id,
                          dossier=tache.dossier_id, role=tache.role)
                self._notify("hierarchie",
                             f"SLA dépassé : {tache.type} ({tache.dossier_id})")

    def vue_de_charge(self, role):
        """R40 : charge par personne — ouvertes, en retard."""
        out = {m: {"ouvertes": 0, "en_retard": 0}
               for m in self.role_membres.get(role, ())}
        for tache in self.gestion_taches:
            if tache.role == role and tache.etat == "OUVERTE" and tache.titulaire:
                out.setdefault(tache.titulaire, {"ouvertes": 0, "en_retard": 0})
                out[tache.titulaire]["ouvertes"] += 1
                if tache.sla_depasse:
                    out[tache.titulaire]["en_retard"] += 1
        return out

    def escalader_deblocage(self, tache, etape, par, at, decision=None):
        """R41 : chaîne humaine app manager -> manager fonction -> COO."""
        self._log(at, "escalade_deblocage", par, tache=tache.id, etape=etape)
        if decision:
            self._log(at, "decision_deblocage", par, tache=tache.id,
                      decision=decision)

    def detecter_vacances(self, at):
        """R41 : rôle sans titulaire actif ni suppléant = risque homme-clé.
        Le système détecte et signale ; il ne résout pas."""
        for role, membres in self.role_membres.items():
            if (not (membres & self.actifs)
                    and role not in self.suppleants):
                self._log(at, "risque_homme_cle", "system", role=role)
                self._notify("process_owner",
                             f"Risque homme-clé : rôle {role} sans titulaire actif")

    def rapport_risques_operationnels(self):
        """R41/R12 : reporting des incidents de risque opérationnel."""
        out = []
        for e in self.journal.of_type("risque_homme_cle"):
            out.append({"type": "homme_cle", "role": e.payload["role"], "at": e.at})
        for e in self.journal.of_type("incident_risque_operationnel"):
            out.append({"type": "vice_process", "role": "",
                        "dossier": e.payload.get("dossier"), "at": e.at})
        return out

    # ---------- Central File (R37) ----------
    def deposer_document_central_file(self, dossier, section_nom, doc, rm, at):
        """R37 : tout document transite par le Central File — tâche QC,
        le document n'est réputé valide qu'après contrôle."""
        self.ajouter_document(dossier, section_nom, doc, rm, at)
        self.creer_tache("controle_qualite", dossier, role="central_file", at=at)
        self._log(at, "document_depose_cf", rm, dossier=dossier.id,
                  document=doc.nom)

    def controler_document(self, dossier, doc, cf_officer, at):
        doc.controle_cf = True
        self._log(at, "document_controle_cf", cf_officer,
                  dossier=dossier.id, document=doc.nom)

    # ---------- screening et alertes AML (bloc 6, R42-R46) ----------
    def tick_screening(self, now):
        """R42 : screening perpétuel — fréquences paramétrables par domaine."""
        for domaine, freq in self.config["screening_freq"].items():
            dernier = self._dernier_screening.get(domaine)
            if dernier is None or now - dernier >= freq:
                self._dernier_screening[domaine] = now
                self._log(now, "screening_batch", "system", domaine=domaine)

    def creer_hit(self, pid, profil, domaine, at):
        """R44 : un couple en whitelist ne régénère pas de hit."""
        if (pid, profil) in self.whitelist:
            self._log(at, "hit_ignore_whitelist", "system",
                      personne=pid, profil=profil)
            return None
        self._seq_hit += 1
        h = Hit(id=f"HIT-{self._seq_hit:05d}", personne=pid,
                profil=profil, domaine=domaine)
        self.hits.append(h)
        self._log(at, "hit_cree", "system", hit=h.id,
                  personne=pid, profil=profil, domaine=domaine)
        return h

    def qualifier_hit(self, hit, qualification, lod1, at, justification=None):
        """R43 : LoD1 qualifie ; le faux positif exige une justification."""
        if qualification == "faux_positif" and not justification:
            raise MotivationRequired(
                "La clôture en faux positif exige une justification (R43)")
        hit.etat = "QUALIFIE_LOD1"
        hit.justification = justification
        self._log(at, "hit_qualifie_lod1", lod1, hit=hit.id,
                  qualification=qualification,
                  justification=justification or "")

    def confirmer_cloture_hit(self, hit, lod2, at):
        """R43 : confirmation finale par le MLRO ou le rôle LoD2 alloué."""
        hit.etat = "CLOTURE_FAUX_POSITIF"
        self._log(at, "hit_clos_lod2", lod2, hit=hit.id)

    def ajouter_whitelist(self, pid, profil, responsable, at, justification=None):
        """R44 : entrée justifiée par la récurrence, obligatoirement."""
        if not justification:
            raise MotivationRequired(
                "L'entrée en whitelist exige une justification (R44)")
        self.whitelist[(pid, profil)] = justification
        self._log(at, "whitelist_entree", responsable, personne=pid,
                  profil=profil, justification=justification)

    def decider_whitelist(self, pid, profil, decision, decideur, at):
        """R44 : l'IA analyse, l'humain décide — maintien ou sortie."""
        if decision == "sortie":
            self.whitelist.pop((pid, profil), None)
        self._log(at, "decision_whitelist", decideur, personne=pid,
                  profil=profil, decision=decision)

    def confirmer_hit(self, hit, decideurs, at):
        """R45 : hit sanctions confirmé -> suspension + offboarding
        distressed asset sur tous les dossiers de la personne."""
        hit.etat = "CONFIRME"
        self._log(at, "hit_confirme", "system", hit=hit.id,
                  personne=hit.personne, decideurs=",".join(decideurs))
        if hit.domaine == "sanctions":
            for d in self._dossiers_de(hit.personne):
                self.suspendre(d, cause=f"hit_sanctions:{hit.id}", at=at)
                self.ouvrir_process(d, "offboarding_distressed", at)

    def geler_pour_hit(self, dossier, hit, delai_analyse, at):
        """R46 : hit pendant la validation -> gel des visas en cours."""
        gelees = []
        for s in dossier.sections.values():
            if s.visa and s.visa.etat == VisaState.EN_ATTENTE:
                s.visa.etat = VisaState.GELE
                gelees.append(s.nom)
        self._log(at, "visas_geles", "system", dossier=dossier.id,
                  hit=hit.id, sections=",".join(gelees),
                  delai_analyse_jours=delai_analyse.days)

    def decider_comite(self, dossier, hit, decision, membres, at):
        """R46 : comité Risk & Compliance (BRM, COO, Compliance) —
        poursuite (dégel) ou offboarding."""
        self._log(at, "decision_comite_risk_compliance", "comite",
                  dossier=dossier.id, hit=hit.id, decision=decision,
                  membres=",".join(membres))
        if decision == "poursuite":
            for s in dossier.sections.values():
                if s.visa and s.visa.etat == VisaState.GELE:
                    s.visa.etat = VisaState.EN_ATTENTE
        else:
            self.suspendre(dossier, cause=f"comite:{hit.id}", at=at)
            self.ouvrir_process(dossier, "offboarding_distressed", at)

    # ---------- audit trail et reporting (bloc 7, R47-R51) ----------
    def consulter_dossier(self, dossier, lecteur, at):
        """R47 : journalisation des lectures, activable par la banque."""
        if self.config.get("journaliser_lectures"):
            self._log(at, "dossier_consulte", lecteur, dossier=dossier.id)
        return dossier

    def etat_a_date(self, dossier_id, at):
        """R48 : rejeu à date — événements connus + versions du référentiel
        en vigueur ce jour-là. Une requête, pas une reconstruction."""
        evenements = [e for e in self.journal.as_of(at)
                      if e.payload.get("dossier") == dossier_id]
        versions = {}
        for artefact in list(self.referentiel._versions):
            try:
                versions[artefact] = self.referentiel.en_vigueur(artefact, at).version
            except KeyError:
                pass
        return {"dossier": dossier_id, "date": at,
                "evenements": evenements, "versions": versions}

    def rapport_derogations(self):
        """R50 : registre des dérogations."""
        return [{"dossier": e.payload["dossier"], "section": e.payload["section"],
                 "beneficiaire": e.payload["beneficiaire"],
                 "decideur": e.actor, "at": e.at}
                for e in self.journal.of_type("derogation_prononcee")]

    def rapport_pep(self):
        """R50 : rapport PEP périodique."""
        return [{"personne": p.id, "statut": "PEP",
                 "fin_mandat": p.fin_mandat_pep}
                for p in self.personnes.values() if p.statut_pep]

    def rapport_hits(self):
        """R50 : liste des hits et leur traitement."""
        return [{"hit": h.id, "personne": h.personne, "domaine": h.domaine,
                 "etat": h.etat, "justification": h.justification}
                for h in self.hits]

    def rapport_retards_recertification(self, now, delai):
        """R50 : recertifications ouvertes au-delà du délai."""
        out = []
        for d in self.dossiers.values():
            for p in d.processes:
                if (p.type == "recertification" and p.etat != "CLOTURE"
                        and now - p.ouvert_le >= delai):
                    out.append({"dossier": d.id, "process": p.id,
                                "ouvert_le": p.ouvert_le})
        return out

    def preuve_quatre_yeux(self, dossier_ids):
        """R51 : preuve du 4-yeux par extraction de l'audit trail des
        dossiers identifiés par leur ID KYC. Tout est déjà historisé :
        l'extraction est une requête."""
        preuve = {}
        for did in dossier_ids:
            chrono = self.journal.for_dossier(did)
            visas = {}
            for e in chrono:
                sec = e.payload.get("section")
                if not sec:
                    continue
                v = visas.setdefault(sec, {"preparateurs": set(),
                                           "validateur": None})
                if e.type == "donnee_modifiee":
                    v["preparateurs"].add(e.actor)
                elif e.type == "visa_accorde":
                    v["validateur"] = e.actor
            for sec, v in list(visas.items()):
                if v["validateur"] is None:
                    del visas[sec]
                    continue
                v["conforme_4yeux"] = v["validateur"] not in v["preparateurs"]
            preuve[did] = {"chronologie": chrono, "visas": visas}
        return preuve

    # ---------- complétude documentaire (R26/R27) ----------
    def evaluer_completude(self, dossier, at):
        """Union des exigences : entité titulaire + personnes liées + comptes.
        Version de matrice : celle estampillée sur le dossier (R29), sinon
        celle en vigueur à la date d'évaluation."""
        if dossier.referentiel and "matrice_documentaire" in dossier.referentiel:
            v = self.referentiel.version("matrice_documentaire",
                                         dossier.referentiel["matrice_documentaire"])
        else:
            v = self.referentiel.en_vigueur("matrice_documentaire", at)
        exig = v.contenu["exigences"][dossier.type_entite]
        requis = []
        for e in exig["entite"]:
            requis.append((dossier.titulaire,
                           Referentiel.resoudre_document(e, dossier.juridiction)))
        for p in dossier.personnes_liees:
            for e in exig["personne_liee"]:
                requis.append((p["id"],
                               Referentiel.resoudre_document(e, dossier.juridiction)))
        for c in dossier.comptes:
            for e in exig["compte"]:
                requis.append((c,
                               Referentiel.resoudre_document(e, dossier.juridiction)))
        presents = {(doc.porteur or dossier.titulaire, doc.nom)
                    for s in dossier.sections.values() for doc in s.documents}
        return [r for r in requis if r not in presents]

    # ---------- temps ----------
    def tick_global(self, now):
        """R54 (proposé) : point d'entrée unique du scheduler.
        Idempotent (les échéances portent leurs marqueurs), monotone (une
        horloge qui recule est refusée sans effet et tracée), rattrapant
        (toutes les échéances intermédiaires en une passe), auditable
        (bilan journalisé à chaque exécution)."""
        if self._dernier_tick is not None and now < self._dernier_tick:
            self._log(now, "tick_refuse_horloge", "system",
                      now=now.isoformat(), dernier=self._dernier_tick.isoformat())
            return {"refuse": True, "dernier": self._dernier_tick}
        avant = len(self.journal.all())
        for d in list(self.dossiers.values()):
            self.tick(d, now)
        self.tick_taches(now)
        self.tick_personnes(now)
        self.tick_screening(now)
        emis = len(self.journal.all()) - avant
        self._log(now, "tick_execute", "system", now=now.isoformat(), emis=emis)
        self._dernier_tick = now
        return {"refuse": False, "emis": emis, "now": now}

    def tick(self, dossier, now):
        """R5 : rappels/escalade visa ; R19 : abandon ; R28 : péremption."""
        # R19 : abandon progressif des dossiers en préparation inactifs
        if (dossier.etat == DossierState.EN_PREPARATION
                and dossier.derniere_activite is not None):
            age = now - dossier.derniere_activite
            c = self.config
            if age >= c["abandon_cloture"]:
                dossier.etat = DossierState.ABANDONNE
                self._log(now, "dossier_abandonne", "system", dossier=dossier.id)
            elif age >= c["abandon_rappel_2"] and dossier.rappels_abandon < 2:
                dossier.rappels_abandon = 2
                self._log(now, "rappel_abandon", "system", dossier=dossier.id, n=2)
                self._notify(dossier.rm, f"Rappel 2 : dossier {dossier.id} inactif")
            elif age >= c["abandon_rappel_1"] and dossier.rappels_abandon < 1:
                dossier.rappels_abandon = 1
                self._log(now, "rappel_abandon", "system", dossier=dossier.id, n=1)
                self._notify(dossier.rm, f"Rappel 1 : dossier {dossier.id} inactif")
        for s in dossier.sections.values():
            # R25 : visa conditionnel dont le document n'arrive jamais
            v = s.visa
            if (v and v.conditionnel and v.attente and not v.conditionnel_traite
                    and v.etat in (VisaState.EN_ATTENTE, VisaState.ACCORDE)):
                recu = any(doc.nom == v.attente["document"] for doc in s.documents)
                if recu:
                    v.conditionnel_traite = True
                elif now - v.soumis_le >= timedelta(days=30):
                    v.conditionnel_traite = True
                    if v.attente.get("obligatoire"):
                        v.etat = VisaState.INVALIDE
                        s.etat = SectionState.EN_PREPARATION
                        self._log(now, "visa_conditionnel_expire", "system",
                                  dossier=dossier.id, section=s.nom,
                                  document=v.attente["document"])
                        self._notify("hierarchie",
                                     f"Visa conditionnel {s.nom} invalidé : "
                                     f"{v.attente['document']} jamais reçu ({dossier.id})")
                    else:
                        self._log(now, "visa_conditionnel_escalade", "system",
                                  dossier=dossier.id, section=s.nom,
                                  document=v.attente["document"])
                        self._notify("hierarchie",
                                     f"Document optionnel {v.attente['document']} "
                                     f"toujours attendu ({dossier.id})")
            if s.visa and s.visa.etat == VisaState.EN_ATTENTE:
                age = now - s.visa.soumis_le
                if age >= self.ESCALADE and not s.visa.escalade:
                    s.visa.escalade = True
                    self._log(now, "visa_escalade", "system",
                              dossier=dossier.id, section=s.nom)
                    self._notify("hierarchie", f"Escalade visa {s.nom} ({dossier.id})")
                elif age >= self.RAPPEL_2 and s.visa.rappels < 2:
                    s.visa.rappels = 2
                    self._log(now, "visa_rappel", "system",
                              dossier=dossier.id, section=s.nom, n=2)
                    self._notify(s.visa.validateur, f"Rappel 2 : visa {s.nom}")
                elif age >= self.RAPPEL_1 and s.visa.rappels < 1:
                    s.visa.rappels = 1
                    self._log(now, "visa_rappel", "system",
                              dossier=dossier.id, section=s.nom, n=1)
                    self._notify(s.visa.validateur, f"Rappel 1 : visa {s.nom}")
            for doc in s.documents:
                if (doc.expire_le and doc.expire_le <= now
                        and not any(t == ("collecte", dossier.id, doc.nom)
                                    for t in self.taches)):
                    self.taches.append(("collecte", dossier.id, doc.nom))
                    self._log(now, "tache_collecte_creee", "system",
                              dossier=dossier.id, section=s.nom, document=doc.nom)
