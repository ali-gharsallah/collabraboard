"""R55 (proposé) — Snapshots de reprise : photographie d'un dossier à sa
version R53, restauration fidèle et O(récent), store append-only (SQLite).

Sérialisation générique par introspection des dataclasses du domaine —
aucun champ codé en dur : un champ ajouté à Dossier/Section/Visa/Document
est photographié automatiquement."""
import json, sqlite3
from dataclasses import is_dataclass, fields
from datetime import datetime, timedelta
from enum import Enum
from . import domain


def _registres():
    dc, en = {}, {}
    for n in dir(domain):
        o = getattr(domain, n)
        if isinstance(o, type):
            if is_dataclass(o): dc[n] = o
            elif issubclass(o, Enum) and o is not Enum: en[n] = o
    return dc, en

_DC, _EN = _registres()


def _ser(v):
    if v is None or isinstance(v, (str, int, float, bool)): return v
    if isinstance(v, datetime): return {"__dt__": v.isoformat()}
    if isinstance(v, timedelta): return {"__td__": v.total_seconds()}
    if isinstance(v, Enum): return {"__en__": type(v).__name__, "v": v.name}
    if is_dataclass(v): return {"__dc__": type(v).__name__,
                                "f": {f.name: _ser(getattr(v, f.name)) for f in fields(v)}}
    if isinstance(v, set): return {"__set__": sorted(_ser(x) for x in v)}
    if isinstance(v, (list, tuple)): return [_ser(x) for x in v]
    if isinstance(v, dict): return {"__map__": [[_ser(k), _ser(x)] for k, x in v.items()]}
    raise TypeError(f"non sérialisable : {type(v).__name__}")


def _deser(v):
    if isinstance(v, list): return [_deser(x) for x in v]
    if not isinstance(v, dict): return v
    if "__dt__" in v: return datetime.fromisoformat(v["__dt__"])
    if "__td__" in v: return timedelta(seconds=v["__td__"])
    if "__en__" in v: return _EN[v["__en__"]][v["v"]]
    if "__set__" in v: return set(_deser(x) for x in v["__set__"])
    if "__map__" in v: return {_deser(k): _deser(x) for k, x in v["__map__"]}
    if "__dc__" in v:
        cls = _DC[v["__dc__"]]
        obj = cls.__new__(cls)
        for k, x in v["f"].items(): setattr(obj, k, _deser(x))
        return obj
    return v


class SnapshotStore:
    """Append-only : (dossier_id, version) unique — réécriture refusée (R49)."""
    def __init__(self, chemin=":memory:"):
        self.db = sqlite3.connect(chemin)
        self.db.execute("""CREATE TABLE IF NOT EXISTS snapshots(
            dossier_id TEXT NOT NULL, version INTEGER NOT NULL,
            at TEXT NOT NULL, etat TEXT NOT NULL,
            PRIMARY KEY (dossier_id, version))""")
        self.db.execute("""CREATE TRIGGER IF NOT EXISTS snap_no_update
            BEFORE UPDATE ON snapshots BEGIN
            SELECT RAISE(ABORT, 'snapshots append-only (R55/R49)'); END""")
        self.db.execute("""CREATE TRIGGER IF NOT EXISTS snap_no_delete
            BEFORE DELETE ON snapshots BEGIN
            SELECT RAISE(ABORT, 'snapshots append-only (R55/R49)'); END""")

    def ecrire(self, dossier_id, version, etat, at):
        self.db.execute("INSERT INTO snapshots VALUES (?,?,?,?)",
                        (dossier_id, version, at.isoformat(), json.dumps(etat)))
        self.db.commit()

    def dernier(self, dossier_id):
        row = self.db.execute(
            "SELECT version, etat FROM snapshots WHERE dossier_id=? "
            "ORDER BY version DESC LIMIT 1", (dossier_id,)).fetchone()
        return (row[0], json.loads(row[1])) if row else (None, None)


def prendre_snapshot(engine, dossier, store, at=None):
    version = engine.version(dossier)
    store.ecrire(dossier.id, version, _ser(dossier),
                 at or datetime.now())
    engine.journal.append(at or datetime.now(), "snapshot_pris", "system",
                          dossier=dossier.id, version=version)
    return version


def restaurer_dossier(engine, store, journal, dossier_id, compter_lectures=False):
    """Dernier snapshot + les seuls événements du dossier qui lui sont
    postérieurs (retard signalé) — jamais le journal entier."""
    version, etat = store.dernier(dossier_id)
    if version is None:
        raise KeyError(f"aucun snapshot pour {dossier_id}")
    d = _deser(etat)
    engine.dossiers[dossier_id] = d
    # retard : événements effectifs du dossier au-delà de la version photographiée
    evs = journal.for_dossier(dossier_id)          # index par dossier (R51) — O(récent)
    effectifs = [e for e in evs
                 if e.type not in engine._EVENEMENTS_SANS_VERSION
                 and e.type not in ("snapshot_pris",)]
    retard = max(0, len(effectifs) - version)
    if compter_lectures:
        restaurer_dossier.derniere_lecture = len(evs) - version if len(evs) >= version else len(evs)
    return d, version, retard
restaurer_dossier.derniere_lecture = 0
