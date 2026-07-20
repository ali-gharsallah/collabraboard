"""UI-01..UI-05 — l'API du serveur UI expose fidèlement le moteur.
Serveur stdlib lancé en thread ; assertions via urllib (zéro dépendance)."""
import json, threading, urllib.request, urllib.error
import pytest
from olive_engine.ui_server import creer_serveur

PORT = 8791
BASE = f"http://127.0.0.1:{PORT}"

def _get(p):
    with urllib.request.urlopen(BASE + p) as r:
        return json.loads(r.read())

def _post(p, corps):
    req = urllib.request.Request(BASE + p, json.dumps(corps).encode(),
                                 {"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

# serveur unique pour le module (le mini-runner ne gère pas les fixtures yield)
_HTTPD, _ENG = creer_serveur(PORT)
threading.Thread(target=_HTTPD.serve_forever, daemon=True).start()

@pytest.fixture
def serveur():
    return _ENG

def test_UI01_corbeille_par_role(serveur):
    r = _get("/api/corbeille?role=CO")
    assert r["taches"], "la corbeille CO contient les tâches semées"
    assert all(t["role"] == "CO" for t in r["taches"])
    assert "charge" in r

def test_UI02_finale_sans_engagement_refusee_R14(serveur):
    code, r = _post("/api/commande", {"action": "accorder", "dossier": "D-2026-003",
        "section": "VALIDATION_FINALE", "acteur": "VF", "engagement": False})
    assert code == 409 and r["regle"] == "R14", "le pop-up d'engagement est obligatoire"

def test_UI03_refus_sans_motivation_refuse_R7(serveur):
    code, r = _post("/api/commande", {"action": "refuser", "dossier": "D-2026-002",
        "section": "Origine des fonds", "acteur": "V2", "motivation": ""})
    assert code == 409 and r["regle"] == "R7"

def test_UI04_rejeu_a_date_montre_moins_d_evenements(serveur):
    tot = _get("/api/rejeu?dossier=D-2026-001&at=2026-07-12T09:00:00")
    mi  = _get("/api/rejeu?dossier=D-2026-001&at=2026-06-10T09:00:00")
    assert 0 < mi["n"] < tot["n"], "le rejeu à date est une vraie coupe temporelle"
    assert all(e["at"] <= "2026-06-10T09:00:00" for e in mi["evenements"])

def test_UI05_version_perimee_rejetee_R53(serveur):
    d = _get("/api/dossier?id=D-2026-002")
    v = d["version"]
    code, _ = _post("/api/commande", {"action": "modifier", "dossier": "D-2026-002",
        "section": "Identification", "acteur": "RM1", "champ": "note", "valeur": "a",
        "expected_version": v})
    assert code == 200
    code, r = _post("/api/commande", {"action": "modifier", "dossier": "D-2026-002",
        "section": "Identification", "acteur": "CO1", "champ": "note", "valeur": "b",
        "expected_version": v})                      # périmée
    assert code == 409 and r["regle"] == "R53"
    assert "rechargez" in r["msg"].lower() or "version" in r["msg"].lower()

def test_UI06_preuve_quatre_yeux_extraite(serveur):
    r = _get("/api/preuve?ids=D-2026-001")
    p = r["preuve"]["D-2026-001"]
    assert p, "au moins une section visée prouvée"
    for sec, v in p.items():
        assert v["validateur"] not in v["preparateurs"], "4-yeux démontré"
