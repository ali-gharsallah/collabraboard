"""API HTTP du moteur (FastAPI) — couche adaptateur, zéro logique métier.

Lancement : uvicorn olive_engine.api:app
Chaque endpoint appelle une commande du domaine ; les erreurs métier
(FourEyesViolation, MotivationRequired...) deviennent des 422 portant le
numéro de règle, directement affichable dans l'UI.
"""
from datetime import datetime

try:
    from fastapi import FastAPI, HTTPException
    from pydantic import BaseModel
except ImportError:                      # environnement sans dépendances
    FastAPI = None

from .domain import Engine
from .storage import SqlJournal
from .errors import OliveRuleError

engine = Engine(journal=SqlJournal("olive.db"))


def _run(commande, *args, **kwargs):
    try:
        return commande(*args, **kwargs)
    except OliveRuleError as e:
        raise HTTPException(status_code=422,
                            detail={"regle": e.rule, "message": str(e)})


if FastAPI:
    app = FastAPI(title="O-Live Engine", version="0.1.0")

    class VisaCmd(BaseModel):
        dossier_id: str
        section: str
        acteur: str
        engagement: bool = False

    class RefusCmd(VisaCmd):
        motivation: str | None = None

    @app.post("/dossiers/{dossier_id}/sections/{section}/visa")
    def accorder_visa(dossier_id: str, section: str, cmd: VisaCmd):
        d = engine.dossiers[dossier_id]
        _run(engine.accorder_visa, d, section, cmd.acteur,
             datetime.utcnow(), engagement=cmd.engagement)
        return {"etat": d.sections[section].visa.etat.value}

    @app.post("/dossiers/{dossier_id}/sections/{section}/refus")
    def refuser_visa(dossier_id: str, section: str, cmd: RefusCmd):
        d = engine.dossiers[dossier_id]
        _run(engine.refuser_visa, d, section, cmd.acteur,
             datetime.utcnow(), motivation=cmd.motivation)
        return {"etat": "refuse"}

    @app.get("/dossiers/{dossier_id}/audit")
    def audit(dossier_id: str):
        return [{"seq": e.seq, "at": e.at.isoformat(), "type": e.type,
                 "actor": e.actor, "payload": dict(e.payload)}
                for e in engine.journal.for_dossier(dossier_id)]

    @app.get("/audit/preuve-4yeux")
    def preuve(ids: str):
        p = engine.preuve_quatre_yeux(ids.split(","))
        return {did: {s: {"validateur": v["validateur"],
                          "preparateurs": sorted(v["preparateurs"]),
                          "conforme": v["conforme_4yeux"]}
                      for s, v in det["visas"].items()}
                for did, det in p.items()}

    @app.get("/dossiers/{dossier_id}/etat-a-date")
    def etat_a_date(dossier_id: str, date: str):
        etat = engine.etat_a_date(dossier_id, datetime.fromisoformat(date))
        return {"versions": etat["versions"],
                "evenements": [e.type for e in etat["evenements"]]}
