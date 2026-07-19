"""Serveur UI du moteur — stdlib pur (zéro dépendance, pilote on-prem).
Trois écrans (corbeilles, dossier, visa avec pop-up R14/refus motivé R7)
+ les démos FINMA : rejeu à date (X-02) et preuve 4-yeux (X-05).
Toute erreur de règle remonte telle quelle : HTTP 409 {regle, msg}."""
import json, os
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
from .domain import Engine, FINAL_STEP
from .errors import OliveRuleError

T0 = datetime(2026, 6, 1, 9, 0)
UI_DIR = os.path.join(os.path.dirname(__file__), "..", "ui")


def semer(e):
    """Trois dossiers de démonstration + tâches + historique daté (rejeu)."""
    e.actifs |= {"V1", "V2", "V3", "VF", "RM1", "CO1", "CO2"}
    e.role_membres = {"CO": {"CO1", "CO2"}, "RM": {"RM1"}}
    def t(j, h=0): return T0 + timedelta(days=j, hours=h)
    # D-001 : historique riche juin→juillet (rejeu à date)
    d1 = e.creer_dossier("D-2026-001", [("Identification", "V1"),
                                        ("Origine des fonds", "V2"),
                                        ("Fiscalité", "V3")], t(0),
                         titulaire="Famille Keller", rm="RM1")
    e.definir_validation_finale(d1, "VF", t(0))
    e.modifier_donnee(d1, "Identification", "RM1", "domicile", "Genève", t(1))
    e.soumettre_au_visa(d1, "Identification", "RM1", t(2))
    e.accorder_visa(d1, "Identification", "V1", t(4))
    e.modifier_donnee(d1, "Origine des fonds", "RM1", "SOW", "cession PME 2019", t(8))
    e.soumettre_au_visa(d1, "Origine des fonds", "RM1", t(9))
    e.accorder_visa(d1, "Origine des fonds", "V2", t(15))
    e.modifier_donnee(d1, "Fiscalité", "RM1", "TIN", "756.9217.0769.85", t(20))
    e.soumettre_au_visa(d1, "Fiscalité", "RM1", t(21))
    e.refuser_visa(d1, "Fiscalité", "V3", t(25), motivation="auto-certification CRS manquante")
    e.modifier_donnee(d1, "Fiscalité", "RM1", "CRS", "auto-certification reçue", t(32))
    e.soumettre_au_visa(d1, "Fiscalité", "RM1", t(33))
    e.accorder_visa(d1, "Fiscalité", "V3", t(38))
    # D-002 : en cours — corbeille + écran de visa section
    d2 = e.creer_dossier("D-2026-002", [("Identification", "V1"),
                                        ("Origine des fonds", "V2")], t(30),
                         titulaire="Trust Aquila", rm="RM1")
    e.definir_validation_finale(d2, "VF", t(30))
    e.modifier_donnee(d2, "Identification", "RM1", "settlor", "M. Brandt", t(31))
    e.modifier_donnee(d2, "Origine des fonds", "RM1", "SOW", "héritage 2021", t(33))
    e.soumettre_au_visa(d2, "Origine des fonds", "RM1", t(34))
    e.creer_tache("visa", d2, "CO", t(34), sla=timedelta(days=3))
    e.creer_tache("collecte formulaire T", d2, "RM", t(34), sla=timedelta(days=10))
    # D-003 : tout visé — la FINALE attend VF (pop-up R14 en démo)
    d3 = e.creer_dossier("D-2026-003", [("Identification", "V1")], t(35),
                         titulaire="Holding Véga", rm="RM1")
    e.definir_validation_finale(d3, "VF", t(35))
    e.modifier_donnee(d3, "Identification", "RM1", "registre", "CHE-345.678", t(36))
    e.soumettre_au_visa(d3, "Identification", "RM1", t(36))
    e.accorder_visa(d3, "Identification", "V1", t(37))
    e.tick_global(t(41))                        # SLA du visa CO dépassé → corbeille rouge
    e._horloge_ui = t(41, 1)
    return e


def _ser_dossier(e, d):
    return {"id": d.id, "titulaire": d.titulaire, "rm": d.rm,
            "etat": str(d.etat).split(".")[-1] if d.etat else "EN_PREPARATION",
            "version": e.version(d),
            "sections": [{"nom": nom,
                          "finale": nom == FINAL_STEP,
                          "etat": str(s.etat).split(".")[-1],
                          "visa": str(s.visa.etat).split(".")[-1] if s.visa else "AUCUN",
                          "validateur": (s.visa.validateur if s.visa else s.validateur),
                          "preparateurs": sorted(s.preparateurs),
                          "motivation_refus": s.visa.motivation_refus if s.visa else None,
                          "donnees": dict(s.donnees)}
                         for nom, s in d.sections.items()]}


class Handler(BaseHTTPRequestHandler):
    engine = None
    def log_message(self, *a): pass

    def _json(self, code, obj):
        corps = json.dumps(obj, ensure_ascii=False, default=str).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corps)))
        self.end_headers()
        self.wfile.write(corps)

    def do_GET(self):
        e = self.engine
        u = urlparse(self.path); q = {k: v[0] for k, v in parse_qs(u.query).items()}
        if u.path == "/" or u.path == "/index.html":
            with open(os.path.join(UI_DIR, "index.html"), "rb") as f:
                corps = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(corps)))
            self.end_headers(); self.wfile.write(corps); return
        if u.path == "/api/etat":
            return self._json(200, {"horloge": e._horloge_ui.isoformat(),
                "dossiers": [_ser_dossier(e, d) for d in e.dossiers.values()]})
        if u.path == "/api/dossier":
            d = e.dossiers.get(q.get("id"))
            if not d: return self._json(404, {"msg": "dossier inconnu"})
            return self._json(200, _ser_dossier(e, d))
        if u.path == "/api/corbeille":
            role = q.get("role", "CO")
            taches = [{"id": t.id, "type": t.type, "dossier": t.dossier_id,
                       "role": t.role, "titulaire": t.titulaire, "etat": t.etat,
                       "sla_depasse": t.sla_depasse, "cree_le": t.cree_le.isoformat()}
                      for t in e.gestion_taches if t.role == role]
            return self._json(200, {"taches": taches, "charge": e.vue_de_charge(role)})
        if u.path == "/api/rejeu":
            at = datetime.fromisoformat(q["at"])
            etat = e.etat_a_date(q["dossier"], at)
            evs = [{"seq": ev.seq, "at": ev.at.isoformat(), "type": ev.type,
                    "actor": ev.actor,
                    "detail": {k: str(v) for k, v in ev.payload.items() if k != "dossier"}}
                   for ev in etat["evenements"]]
            return self._json(200, {"n": len(evs), "evenements": evs,
                                    "versions": etat["versions"]})
        if u.path == "/api/preuve":
            ids = q.get("ids", "").split(",")
            preuve = e.preuve_quatre_yeux(ids)
            out = {did: {sec: {"preparateurs": sorted(v["preparateurs"]),
                               "validateur": v["validateur"],
                               "conforme": v["conforme_4yeux"]}
                         for sec, v in p["visas"].items()}
                   for did, p in preuve.items()}
            return self._json(200, {"preuve": out})
        return self._json(404, {"msg": "route inconnue"})

    def do_POST(self):
        e = self.engine
        n = int(self.headers.get("Content-Length", 0))
        c = json.loads(self.rfile.read(n) or b"{}")
        u = urlparse(self.path)
        if u.path == "/api/tick":
            e._horloge_ui += timedelta(days=1)
            return self._json(200, e.tick_global(e._horloge_ui))
        if u.path != "/api/commande":
            return self._json(404, {"msg": "route inconnue"})
        d = e.dossiers.get(c.get("dossier"))
        if not d: return self._json(404, {"msg": "dossier inconnu"})
        e._horloge_ui += timedelta(minutes=1)
        at, sec, act = e._horloge_ui, c.get("section"), c.get("acteur")
        ev = c.get("expected_version")
        try:
            a = c["action"]
            if a == "modifier":
                e.modifier_donnee(d, sec, act, c["champ"], c["valeur"], at,
                                  expected_version=ev)
            elif a == "soumettre":
                e.soumettre_au_visa(d, sec, act, at, expected_version=ev)
            elif a == "accorder":
                e.accorder_visa(d, sec, act, at, engagement=c.get("engagement", False),
                                expected_version=ev)
            elif a == "refuser":
                e.refuser_visa(d, sec, act, at, motivation=c.get("motivation"),
                               expected_version=ev)
            else:
                return self._json(400, {"msg": f"action inconnue {a}"})
            return self._json(200, {"ok": True, "version": e.version(d)})
        except OliveRuleError as ex:
            return self._json(409, {"ok": False, "regle": ex.rule, "msg": str(ex),
                                    "version": e.version(d)})


def creer_serveur(port=8700):
    e = semer(Engine())
    Handler.engine = e
    return ThreadingHTTPServer(("127.0.0.1", port), Handler), e
