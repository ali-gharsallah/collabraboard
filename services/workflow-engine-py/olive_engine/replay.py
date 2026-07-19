"""Corpus de rejeu — capture par handles, rejeu bi-moteur, fidélité.

CAPTURE (EngineRecorder) : proxy transparent autour d'un Engine réel. Chaque
appel public est journalisé : méthode, args sérialisés, issue (ok / règle
citée), handle du retour. Tout objet RETOURNÉ par le moteur reçoit un handle ;
quand un test le repasse en argument (dossier, process, hit, tâche...), l'arg
est enregistré comme {"__ref__": handle}. `eng.actifs |= {...}` est capturé
via un set enregistreur. Les mutations directes d'objets domaine (hors moteur)
sont invisibles à la capture — c'est le contrôle de FIDÉLITÉ qui les révèle.

REJEU (CorpusReplayer) : le corpus est rejoué dans DEUX moteurs neufs
(maître / ombre). Après chaque commande : parité de décision (et règle citée
sur refus) + parité d'état canonique des dossiers. Puis contrôle de fidélité :
l'état final du maître rejoué doit être identique aux snapshots capturés —
sinon le scénario est REJEU_PARTIEL et ne compte pas pour la bascule."""
from datetime import datetime
from .errors import OliveRuleError
from .shadow import Divergence

_PRIMITIFS = (str, int, float, bool, type(None), tuple, frozenset)


# ---------- sérialisation ----------
def _ser(v, handles):
    if isinstance(v, datetime): return {"__dt__": v.isoformat()}
    if id(v) in handles: return {"__ref__": handles[id(v)]}
    if isinstance(v, _PRIMITIFS): return v
    if isinstance(v, (list, tuple)): return [_ser(x, handles) for x in v]
    if isinstance(v, set): return {"__set__": sorted(_ser(x, handles) for x in v)}
    if isinstance(v, dict): return {k: _ser(x, handles) for k, x in v.items()}
    if hasattr(v, "__dataclass_fields__"):        # Document, etc.
        return {"__dc__": type(v).__name__,
                "champs": {f: _ser(getattr(v, f), handles) for f in v.__dataclass_fields__}}
    return {"__repr__": repr(v)}                  # dernier recours (non rejouable)

def _deser(v, objets, dc_registry):
    if isinstance(v, dict):
        if "__dt__" in v: return datetime.fromisoformat(v["__dt__"])
        if "__ref__" in v:
            if v["__ref__"] not in objets:
                raise ValueError(f"référence {v['__ref__']} non disponible au rejeu")
            return objets[v["__ref__"]]
        if "__set__" in v: return set(_deser(x, objets, dc_registry) for x in v["__set__"])
        if "__dc__" in v:
            cls = dc_registry[v["__dc__"]]
            return cls(**{k: _deser(x, objets, dc_registry) for k, x in v["champs"].items()})
        if "__repr__" in v: raise ValueError(f"arg non rejouable : {v['__repr__']}")
        return {k: _deser(x, objets, dc_registry) for k, x in v.items()}
    if isinstance(v, list): return [_deser(x, objets, dc_registry) for x in v]
    return v


class _ActifsEnregistreur:
    """Capture `eng.actifs |= {...}` (mutation en place, sinon invisible)."""
    def __init__(self, reel, corpus): self._reel, self._corpus = reel, corpus
    def __ior__(self, autres):
        self._corpus.append({"m": "__actifs__", "args": [sorted(autres)], "kwargs": {},
                             "issue": {"ok": True, "regle": None}, "ret": None})
        self._reel |= set(autres); return self
    def __contains__(self, x): return x in self._reel
    def __iter__(self): return iter(self._reel)
    def __len__(self): return len(self._reel)
    def __and__(self, o): return self._reel & set(o)
    def __rand__(self, o): return set(o) & self._reel
    def __or__(self, o): return self._reel | set(o)
    def __ror__(self, o): return set(o) | self._reel
    def __sub__(self, o): return self._reel - set(o)
    def __rsub__(self, o): return set(o) - self._reel
    def __isub__(self, autres):
        self._corpus.append({"m": "__actifs_moins__", "args": [sorted(autres)], "kwargs": {},
                             "issue": {"ok": True, "regle": None}, "ret": None})
        self._reel -= set(autres); return self
    def add(self, x):
        self._corpus.append({"m": "__actifs__", "args": [[x]], "kwargs": {},
                             "issue": {"ok": True, "regle": None}, "ret": None})
        self._reel.add(x)
    def discard(self, x):
        self._corpus.append({"m": "__actifs_moins__", "args": [[x]], "kwargs": {},
                             "issue": {"ok": True, "regle": None}, "ret": None})
        self._reel.discard(x)


class _SetEnregistreur(_ActifsEnregistreur):
    """Même mécanique que actifs, pour tout attribut-ensemble (absences...)."""
    def __init__(self, nom, reel, corpus):
        self._nom = nom; super().__init__(reel, corpus)
    def add(self, x):
        self._corpus.append({"m": "__set_add__", "attr": self._nom, "args": [[x]],
            "kwargs": {}, "issue": {"ok": True, "regle": None}, "ret": None})
        self._reel.add(x)
    def discard(self, x):
        self._corpus.append({"m": "__set_moins__", "attr": self._nom, "args": [[x]],
            "kwargs": {}, "issue": {"ok": True, "regle": None}, "ret": None})
        self._reel.discard(x)


class _DictEnregistreur:
    """Capture les affectations dict (eng.relais["V1"] = "V3")."""
    def __init__(self, nom, reel, corpus):
        self._nom, self._reel, self._corpus = nom, reel, corpus
    def __setitem__(self, k, v):
        self._corpus.append({"m": "__dict_set__", "attr": self._nom, "args": [k, v],
            "kwargs": {}, "issue": {"ok": True, "regle": None}, "ret": None})
        self._reel[k] = v
    def __getitem__(self, k): return self._reel[k]
    def __contains__(self, k): return k in self._reel
    def get(self, k, d=None): return self._reel.get(k, d)
    def pop(self, k, *a):
        self._corpus.append({"m": "__dict_pop__", "attr": self._nom, "args": [k],
            "kwargs": {}, "issue": {"ok": True, "regle": None}, "ret": None})
        return self._reel.pop(k, *a)


class _AttrEnregistreur:
    """Proxy générique : enregistre les appels de méthode faits sur un attribut
    du moteur (ex. eng.referentiel.publier(...)), les rejoue à l'identique."""
    def __init__(self, nom, reel, corpus, handles):
        self._nom, self._reel, self._corpus, self._handles = nom, reel, corpus, handles
    def __getattr__(self, sub):
        attr = getattr(self._reel, sub)
        if not callable(attr): return attr
        def enregistre(*args, **kwargs):
            self._corpus.append({"m": "__attr__", "attr": self._nom, "sub": sub,
                "args": [_ser(a, self._handles) for a in args],
                "kwargs": {k: _ser(v, self._handles) for k, v in kwargs.items()},
                "issue": {"ok": True, "regle": None}, "ret": None})
            return attr(*args, **kwargs)
        return enregistre


class EngineRecorder:
    """Proxy d'enregistrement : délègue tout, journalise les appels publics."""
    def __init__(self, engine):
        object.__setattr__(self, "_e", engine)
        object.__setattr__(self, "corpus", [])
        object.__setattr__(self, "_handles", {})      # id(objet) -> handle
        object.__setattr__(self, "_suivis", {})       # handle -> objet (dossiers…)
        object.__setattr__(self, "_actifs", _ActifsEnregistreur(engine.actifs, self.corpus))

    ATTRS_ENREGISTRES = ("referentiel",)

    def __getattr__(self, name):
        if name == "actifs": return self._actifs
        if name in self.ATTRS_ENREGISTRES:
            return _AttrEnregistreur(name, getattr(self._e, name), self.corpus, self._handles)
        cible = getattr(self._e, name, None)
        if isinstance(cible, set) and not name.startswith("_"):
            return _SetEnregistreur(name, cible, self.corpus)
        if isinstance(cible, dict) and not name.startswith("_") and name in ("relais",):
            return _DictEnregistreur(name, cible, self.corpus)
        attr = getattr(self._e, name)
        if not callable(attr) or name.startswith("_"): return attr
        def enregistre(*args, **kwargs):
            entree = {"m": name, "args": [_ser(a, self._handles) for a in args],
                      "kwargs": {k: _ser(v, self._handles) for k, v in kwargs.items()}}
            try:
                ret = attr(*args, **kwargs)
                entree["issue"] = {"ok": True, "regle": None}
            except OliveRuleError as ex:
                entree["issue"] = {"ok": False, "regle": ex.rule}
                entree["ret"] = None
                self.corpus.append(entree)
                raise
            h = None
            if ret is not None and not isinstance(ret, _PRIMITIFS) \
               and not isinstance(ret, (list, dict, set, datetime)):
                h = f"h{len(self._handles) + 1}"
                self._handles[id(ret)] = h
                self._suivis[h] = ret
            entree["ret"] = h
            self.corpus.append(entree)
            return ret
        return enregistre

    def __setattr__(self, name, value): setattr(self._e, name, value)

    def snapshots_finales(self):
        """État canonique final de chaque dossier vu pendant la capture."""
        return {h: _canon(o) for h, o in self._suivis.items() if hasattr(o, "sections")}


# ---------- état canonique ----------
def _canon(d):
    return {"etat": str(getattr(d, "etat", None)),
            "sections": {nom: {"etat": str(s.etat),
                               "visa": str(s.visa.etat) if s.visa else None,
                               "validateur": s.visa.validateur if s.visa else None}
                         for nom, s in d.sections.items()}}


class CorpusReplayer:
    """Rejoue un corpus dans deux moteurs neufs et compare pas à pas."""
    def __init__(self, fabrique_maitre, fabrique_ombre):
        self.fab_m, self.fab_o = fabrique_maitre, fabrique_ombre
        self.resultats = []
        self.scenarios_fideles_consecutifs = 0

    def _dc_registry(self):
        from . import domain
        return {n: getattr(domain, n) for n in dir(domain)
                if hasattr(getattr(domain, n, None), "__dataclass_fields__")}

    def rejouer(self, scenario_id, corpus, snapshots_capture):
        m, o = self.fab_m(), self.fab_o()
        objets_m, objets_o = {}, {}
        dcr = self._dc_registry()
        divergences = []
        for i, c in enumerate(corpus, 1):
            issue_m = self._exec(m, c, objets_m, dcr)
            issue_o = self._exec(o, c, objets_o, dcr)
            if issue_m != issue_o:
                divergences.append(Divergence(i, {"cmd": c["m"]}, "DECISION", issue_m, issue_o))
                continue
            if not issue_o["ok"] and not issue_o.get("regle"):
                divergences.append(Divergence(i, {"cmd": c["m"]}, "REGLE_NON_CITEE", issue_m, issue_o))
            sm = {h: _canon(x) for h, x in objets_m.items() if hasattr(x, "sections")}
            so = {h: _canon(x) for h, x in objets_o.items() if hasattr(x, "sections")}
            if sm != so:
                divergences.append(Divergence(i, {"cmd": c["m"]}, "ETAT", sm, so))
        # fidélité : le maître rejoué reproduit-il la capture ?
        sm_final = {h: _canon(x) for h, x in objets_m.items() if hasattr(x, "sections")}
        fidele = sm_final == snapshots_capture
        if divergences: self.scenarios_fideles_consecutifs = 0
        elif fidele: self.scenarios_fideles_consecutifs += 1
        res = {"scenario": scenario_id, "commandes": len(corpus),
               "divergences": divergences, "fidele": fidele}
        self.resultats.append(res)
        return res

    def _exec(self, engine, c, objets, dcr):
        if c["m"] == "__actifs__":
            engine.actifs |= set(c["args"][0]); return {"ok": True, "regle": None}
        if c["m"] == "__actifs_moins__":
            engine.actifs -= set(c["args"][0]); return {"ok": True, "regle": None}
        if c["m"] == "__set_add__":
            getattr(engine, c["attr"]).add(c["args"][0][0]); return {"ok": True, "regle": None}
        if c["m"] == "__set_moins__":
            getattr(engine, c["attr"]).discard(c["args"][0][0]); return {"ok": True, "regle": None}
        if c["m"] == "__dict_set__":
            getattr(engine, c["attr"])[c["args"][0]] = c["args"][1]; return {"ok": True, "regle": None}
        if c["m"] == "__dict_pop__":
            getattr(engine, c["attr"]).pop(c["args"][0], None); return {"ok": True, "regle": None}
        if c["m"] == "__attr__":
            args = [_deser(a, objets, dcr) for a in c["args"]]
            kwargs = {k: _deser(v, objets, dcr) for k, v in c["kwargs"].items()}
            getattr(getattr(engine, c["attr"]), c["sub"])(*args, **kwargs)
            return {"ok": True, "regle": None}
        try:
            args = [_deser(a, objets, dcr) for a in c["args"]]
            kwargs = {k: _deser(v, objets, dcr) for k, v in c["kwargs"].items()}
        except ValueError:
            return {"ok": None, "regle": "__NON_REJOUABLE__"}
        try:
            ret = getattr(engine, c["m"])(*args, **kwargs)
            if c.get("ret"): objets[c["ret"]] = ret
            return {"ok": True, "regle": None}
        except OliveRuleError as ex:
            return {"ok": False, "regle": ex.rule}
        except Exception as ex:                    # noqa: BLE001 — parité d'échec
            return {"ok": False, "regle": f"__EXC__:{type(ex).__name__}"}

    def pret_a_basculer(self, n):
        return self.scenarios_fideles_consecutifs >= n

    def rapport(self, titre="Rapport — rejeu du corpus catalogue"):
        tot = len(self.resultats)
        fid = sum(1 for r in self.resultats if r["fidele"] and not r["divergences"])
        div = sum(len(r["divergences"]) for r in self.resultats)
        L = [f"# {titre}", "",
             f"Scénarios rejoués : {tot} — intégralement fidèles : {fid} — divergences A/B : {div}", ""]
        partiels = [r for r in self.resultats if not r["fidele"]]
        if partiels:
            L.append("## ⚠️ REJEU_PARTIEL (mutation directe ou appel non rejouable — hors corpus de bascule)")
            for r in partiels: L.append(f"- {r['scenario']} ({r['commandes']} commandes)")
            L.append("")
        for r in self.resultats:
            for d in r["divergences"]:
                L.append(f"- ❌ {r['scenario']} seq {d.seq} {d.type} `{d.cmd['cmd']}` : "
                         f"maître={d.maitre} | ombre={d.ombre}")
        if div == 0: L.append("✅ Zéro divergence maître/ombre sur tout le corpus.")
        return "\n".join(L)
