"""Croisement bidirectionnel : workflow ACTUEL (moteur JS, via pont JSON-lines)
contre NOUVEAU moteur (catalogue Python) — mêmes parcours, comparaison pas à
pas des décisions, règles citées et snapshots canoniques, dans les deux sens."""
import json, subprocess, os
from datetime import datetime, timedelta
from .domain import Engine, FINAL_STEP
from .errors import OliveRuleError

T0 = datetime(2026, 7, 1, 9, 0)


# ---------- adaptateur Python (nouveau moteur) ----------
class CanonPyAdapter:
    def __init__(self):
        self.e = Engine()
        self.d = {}
        self._h = 0

    def _at(self):
        self._h += 1
        return T0 + timedelta(hours=self._h)

    def _sec(self, s): return FINAL_STEP if s == "FINAL" else s

    def _snapshot(self, did):
        d = self.d[did]
        out = {}
        for nom, s in d.sections.items():
            cle = "__FINAL__" if nom == FINAL_STEP else nom
            ETATS = {"EN_VALIDATION": "SOUMISE"}      # vocabulaire : Py ≡ JS
            brut = str(s.etat).split(".")[-1]
            visa = str(s.visa.etat).split(".")[-1] if s.visa else "AUCUN"
            if cle == "__FINAL__":                    # étape finale : état ≡ f(visa)
                brut = {"AUCUN": "EN_PREPARATION", "EN_ATTENTE": "SOUMISE",
                        "ACCORDE": "VISEE"}.get(visa, "EN_PREPARATION")
            out[cle] = {"etat": ETATS.get(brut, brut), "visa": visa}
        return {"sections": out}

    def execute(self, c):
        try:
            extra = self._dispatch(c) or {}
            r = {"ok": True, "regle": None, **extra}
        except OliveRuleError as ex:
            r = {"ok": False, "regle": ex.rule, "msg": str(ex)[:120]}
        if c.get("id") and c["cmd"] != "init" and c["id"] in self.d:
            r["snapshot"] = self._snapshot(c["id"])
        return r

    def _dispatch(self, c):
        k = c["cmd"]
        if k == "init": return
        if k == "creer":
            d = self.e.creer_dossier(c["id"], [(s["id"], s["validator"]) for s in c["sections"]],
                                     self._at(), titulaire=c.get("personId"))
            self.e.definir_validation_finale(d, c["final"], self._at())
            for s in c["sections"]:
                if s.get("relay"): self.e.relais[s["validator"]] = s["relay"]
            self.d[c["id"]] = d; return
        d = self.d[c["id"]] if c.get("id") else None
        if k == "modifier": self.e.modifier_donnee(d, self._sec(c["section"]), c["acteur"], c["champ"], c.get("valeur", "v"), self._at())
        elif k == "soumettre": self.e.soumettre_au_visa(d, self._sec(c["section"]), c.get("acteur", "prep"), self._at())
        elif k == "accorder": self.e.accorder_visa(d, self._sec(c["section"]), c["acteur"], self._at(),
                                                   engagement=c.get("engagement", False))
        elif k == "accorder_derogation": self.e.accorder_visa(d, self._sec(c["section"]), c["acteur"], self._at(),
            engagement=c.get("engagement", False),
            derogation={"decideur": c["decideur"], "fiche_de_poste": c["fichePoste"]})
        elif k == "refuser": self.e.refuser_visa(d, self._sec(c["section"]), c["acteur"], self._at(), motivation=c.get("motivation"))
        elif k == "absent": self.e.absences.add(c["validateur"])
        elif k == "revoquer": self.e.tenter_revocation(d, self._sec(c["section"]), c["acteur"], self._at())
        elif k == "annuler_vice": self.e.annuler_pour_vice(d, self._sec(c["section"]), c["motif"],
                                                           c["decideurs"][0], c["decideurs"][1], self._at())
        elif k == "alerte": self.e.rattacher_alerte(d, c["alerte"]["id"], self._at())
        elif k == "mros": self.e.suspendre(d, "communication MROS", self._at())
        elif k == "op": return {"valeur": self.e.operation_autorisee(d, c["sens"])}
        elif k == "rejeter": self.e.rejeter(d, c["motif"], self._at())
        else: raise ValueError(f"commande inconnue {k}")


# ---------- adaptateur JS (workflow actuel, via pont) ----------
class JsBridgeAdapter:
    def __init__(self, bridge_dir):
        self.p = subprocess.Popen(["node", "bridge.mjs"], cwd=bridge_dir,
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, bufsize=1)
    def execute(self, c):
        self.p.stdin.write(json.dumps(c) + "\n"); self.p.stdin.flush()
        return json.loads(self.p.stdout.readline())
    def close(self):
        try: self.execute({"cmd": "fin"})
        except Exception: pass
        self.p.terminate()


# ---------- parcours canoniques ----------
def _base(did="D1", relay=None):
    return [{"cmd": "init"},
            {"cmd": "creer", "id": did, "final": "VF", "sections": [
                {"id": "IDENT", "label": "Identification", "validator": "V1", **({"relay": relay} if relay else {})},
                {"id": "FISC", "label": "Fiscalité", "validator": "V2"}]}]

def _tout_vise(did="D1"):
    return _base(did) + [
        {"cmd": "modifier", "id": did, "section": "IDENT", "acteur": "U1", "champ": "x"},
        {"cmd": "soumettre", "id": did, "section": "IDENT", "acteur": "U1"},
        {"cmd": "accorder", "id": did, "section": "IDENT", "acteur": "V1"},
        {"cmd": "modifier", "id": did, "section": "FISC", "acteur": "U2", "champ": "y"},
        {"cmd": "soumettre", "id": did, "section": "FISC", "acteur": "U2"},
        {"cmd": "accorder", "id": did, "section": "FISC", "acteur": "V2"}]

PARCOURS = [
 ("P01 V-01 visas parallèles", "PARTAGÉ", _base() + [
   {"cmd": "modifier", "id": "D1", "section": "IDENT", "acteur": "U1", "champ": "x"},
   {"cmd": "soumettre", "id": "D1", "section": "IDENT", "acteur": "U1"},
   {"cmd": "modifier", "id": "D1", "section": "FISC", "acteur": "U2", "champ": "y"},
   {"cmd": "soumettre", "id": "D1", "section": "FISC", "acteur": "U2"},
   {"cmd": "accorder", "id": "D1", "section": "IDENT", "acteur": "V1"}]),
 ("P02 V-02 4-yeux préparateur", "PARTAGÉ", _base() + [
   {"cmd": "modifier", "id": "D1", "section": "IDENT", "acteur": "V1", "champ": "x"},
   {"cmd": "soumettre", "id": "D1", "section": "IDENT", "acteur": "V1"},
   {"cmd": "accorder", "id": "D1", "section": "IDENT", "acteur": "V1"}]),
 ("P03 V-03 exclusion limitée", "PARTAGÉ", _base() + [
   {"cmd": "modifier", "id": "D1", "section": "IDENT", "acteur": "V2", "champ": "x"},
   {"cmd": "modifier", "id": "D1", "section": "FISC", "acteur": "U2", "champ": "y"},
   {"cmd": "soumettre", "id": "D1", "section": "FISC", "acteur": "U2"},
   {"cmd": "accorder", "id": "D1", "section": "FISC", "acteur": "V2"}]),
 ("P04 V-05 dérogation tracée", "PARTAGÉ", _base() + [
   {"cmd": "absent", "validateur": "V1"},
   {"cmd": "modifier", "id": "D1", "section": "IDENT", "acteur": "U1", "champ": "x"},
   {"cmd": "soumettre", "id": "D1", "section": "IDENT", "acteur": "U1"},
   {"cmd": "accorder_derogation", "id": "D1", "section": "IDENT", "acteur": "V3",
    "decideur": "PO1", "fichePoste": "FP-CO"}]),
 ("P05 V-08 invalidation en attente", "PARTAGÉ", _base() + [
   {"cmd": "modifier", "id": "D1", "section": "FISC", "acteur": "U2", "champ": "y"},
   {"cmd": "soumettre", "id": "D1", "section": "FISC", "acteur": "U2"},
   {"cmd": "modifier", "id": "D1", "section": "FISC", "acteur": "U9", "champ": "tin"}]),
 ("P06 V-09 invalidation ciblée", "PARTAGÉ", _tout_vise() + [
   {"cmd": "modifier", "id": "D1", "section": "FISC", "acteur": "U9", "champ": "tin"}]),
 ("P07 V-10 refus sans motivation", "PARTAGÉ", _base() + [
   {"cmd": "modifier", "id": "D1", "section": "IDENT", "acteur": "U1", "champ": "x"},
   {"cmd": "soumettre", "id": "D1", "section": "IDENT", "acteur": "U1"},
   {"cmd": "refuser", "id": "D1", "section": "IDENT", "acteur": "V1", "motivation": ""}]),
 ("P08 V-14 révocation interdite", "PARTAGÉ", _base() + [
   {"cmd": "modifier", "id": "D1", "section": "FISC", "acteur": "U2", "champ": "y"},
   {"cmd": "soumettre", "id": "D1", "section": "FISC", "acteur": "U2"},
   {"cmd": "accorder", "id": "D1", "section": "FISC", "acteur": "V2"},
   {"cmd": "revoquer", "id": "D1", "section": "FISC", "acteur": "V2"}]),
 ("P09 V-15 annulation pour vice", "PARTAGÉ", _base() + [
   {"cmd": "modifier", "id": "D1", "section": "IDENT", "acteur": "U1", "champ": "x"},
   {"cmd": "soumettre", "id": "D1", "section": "IDENT", "acteur": "U1"},
   {"cmd": "accorder", "id": "D1", "section": "IDENT", "acteur": "V1"},
   {"cmd": "annuler_vice", "id": "D1", "section": "IDENT", "motif": "délégation expirée",
    "decideurs": ["ProcessOwner-PO1", "VF"]}]),
 ("P10 V-16/17 cascade finale", "PARTAGÉ", _tout_vise() + [
   {"cmd": "modifier", "id": "D1", "section": "FISC", "acteur": "U9", "champ": "tin"}]),
 ("P11 R14 engagement à la finale", "PARTAGÉ", _tout_vise() + [
   {"cmd": "accorder", "id": "D1", "section": "FINAL", "acteur": "VF", "engagement": False}]),
 ("P12 R2 signataire non validateur", "PARTAGÉ", _base() + [
   {"cmd": "modifier", "id": "D1", "section": "IDENT", "acteur": "U1", "champ": "x"},
   {"cmd": "soumettre", "id": "D1", "section": "IDENT", "acteur": "U1"},
   {"cmd": "accorder", "id": "D1", "section": "IDENT", "acteur": "V3"}]),
 ("P13 D-02 MROS entrées/sorties", "PARTAGÉ", _base("D2") + [
   {"cmd": "mros", "id": "D2"},
   {"cmd": "op", "id": "D2", "sens": "entree"},
   {"cmd": "op", "id": "D2", "sens": "sortie"}]),
 ("P14 D-01 alerte → sorties gelées", "PARTAGÉ", _base("D3") + [
   {"cmd": "alerte", "id": "D3", "alerte": {"id": "AL-1", "resolved": False}},
   {"cmd": "op", "id": "D3", "sens": "sortie"}]),
 ("P15 D-03 rejet du prospect", "PARTAGÉ", _base("D4") + [
   {"cmd": "rejeter", "id": "D4", "motif": "SOW non corroborée"}]),
 ("P16 R52 contributeur exclu de la finale", "PARTAGÉ", _tout_vise("D5") + [
   {"cmd": "accorder", "id": "D5", "section": "FINAL", "acteur": "U1", "engagement": True}]),
]


# ---------- runner croisé ----------
class CrossRunner:
    def __init__(self, adA, adB, nomA="JS (workflow actuel)", nomB="Python (catalogue)"):
        self.a, self.b, self.nomA, self.nomB = adA, adB, nomA, nomB
        self.resultats = []

    def run(self, parcours=PARCOURS):
        for nom, attendu, cmds in parcours:
            divs = []
            for i, c in enumerate(cmds, 1):
                ra, rb = self.a.execute(c), self.b.execute(c)
                if ra.get("ok") != rb.get("ok"):
                    divs.append((i, c["cmd"], "DECISION", ra, rb))
                elif not ra.get("ok") and ra.get("regle") != rb.get("regle"):
                    divs.append((i, c["cmd"], "REGLE_DIFFERENTE", ra, rb))
                elif "valeur" in ra or "valeur" in rb:
                    if ra.get("valeur") != rb.get("valeur"):
                        divs.append((i, c["cmd"], "VALEUR", ra, rb))
                elif ra.get("snapshot") and rb.get("snapshot") and ra["snapshot"] != rb["snapshot"]:
                    divs.append((i, c["cmd"], "ETAT", ra["snapshot"], rb["snapshot"]))
            self.resultats.append({"parcours": nom, "attendu": attendu, "divergences": divs})
        return self.resultats

    def rapport(self):
        ok = sum(1 for r in self.resultats if not r["divergences"])
        L = [f"# Rapport croisé bidirectionnel — {self.nomA} ⇄ {self.nomB}", "",
             f"Parcours : {len(self.resultats)} — convergents : {ok} — divergents : {len(self.resultats) - ok}", ""]
        for r in self.resultats:
            if not r["divergences"]:
                L.append(f"- ✅ {r['parcours']} — convergent ({r['attendu']})")
        L.append("")
        for r in self.resultats:
            for (i, cmd, typ, ra, rb) in r["divergences"]:
                verdict = ("⚡ ATTENDU — écart réel entre les moteurs"
                           if r["attendu"] == "RÉVÉLATEUR" else "❌ INATTENDU — à trier")
                if typ == "ETAT":
                    diff = {k: (ra["sections"].get(k), rb["sections"].get(k))
                            for k in set(ra["sections"]) | set(rb["sections"])
                            if ra["sections"].get(k) != rb["sections"].get(k)}
                    L += [f"## {r['parcours']} — {verdict}",
                          f"- seq {i} `{cmd}` ETAT — sections divergentes : {diff}", ""]
                else:
                    L += [f"## {r['parcours']} — {verdict}",
                          f"- seq {i} `{cmd}` {typ}",
                          f"  - {self.nomA} : ok={ra.get('ok')} règle={ra.get('regle')} {ra.get('msg','')}",
                          f"  - {self.nomB} : ok={rb.get('ok')} règle={rb.get('regle')} {rb.get('msg','')}", ""]
        return "\n".join(L)
