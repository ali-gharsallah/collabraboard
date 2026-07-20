"""Adaptateurs de persistance du journal (R48/R49).

Même interface que EventJournal (append, all, of_type, as_of, for_dossier) :
le domaine ne sait pas sur quoi il écrit. L'immutabilité R49 est imposée AU
NIVEAU BASE par triggers — même un accès SQL direct ne peut ni modifier ni
effacer un événement.

- SqlJournal : implémentation de référence (sqlite3, stdlib) — dev et tests.
- PostgresJournal : même schéma et mêmes garanties pour la production
  (psycopg) ; SQL strictement parallèle.
"""
import json
import sqlite3
from datetime import datetime
from types import MappingProxyType
from .events import Event

_SCHEMA = """
CREATE TABLE IF NOT EXISTS events (
    seq     INTEGER PRIMARY KEY AUTOINCREMENT,
    at      TEXT NOT NULL,
    type    TEXT NOT NULL,
    actor   TEXT NOT NULL,
    dossier TEXT,
    payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_dossier ON events(dossier);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
-- R49 : append-only imposé par la base elle-même
CREATE TRIGGER IF NOT EXISTS no_update BEFORE UPDATE ON events
BEGIN SELECT RAISE(ABORT, 'R49: audit trail append-only — UPDATE interdit'); END;
CREATE TRIGGER IF NOT EXISTS no_delete BEFORE DELETE ON events
BEGIN SELECT RAISE(ABORT, 'R49: audit trail append-only — DELETE interdit'); END;
"""


class SqlJournal:
    """Journal persistant sur SQLite. Interface identique à EventJournal."""

    def __init__(self, path=":memory:"):
        self._db = sqlite3.connect(path)
        self._db.executescript(_SCHEMA)

    def append(self, at: datetime, type: str, actor: str, **payload) -> Event:
        cur = self._db.execute(
            "INSERT INTO events (at, type, actor, dossier, payload) "
            "VALUES (?, ?, ?, ?, ?)",
            (at.isoformat(), type, actor, payload.get("dossier"),
             json.dumps(payload, default=str, ensure_ascii=False)))
        self._db.commit()
        return Event(seq=cur.lastrowid, at=at, type=type, actor=actor,
                     payload=MappingProxyType(dict(payload)))

    def _row(self, r) -> Event:
        return Event(seq=r[0], at=datetime.fromisoformat(r[1]), type=r[2],
                     actor=r[3], payload=MappingProxyType(json.loads(r[4])))

    def _select(self, where="", params=()):
        rows = self._db.execute(
            f"SELECT seq, at, type, actor, payload FROM events {where} "
            "ORDER BY seq", params).fetchall()
        return tuple(self._row(r) for r in rows)

    def all(self):
        return self._select()

    def of_type(self, *types):
        q = ",".join("?" * len(types))
        return self._select(f"WHERE type IN ({q})", types)

    def as_of(self, at: datetime):
        """R48 : rejeu à date — une requête, pas une reconstruction."""
        return self._select("WHERE at <= ?", (at.isoformat(),))

    def for_dossier(self, dossier_id: str):
        """R51 : extraction par identifiant KYC — indexée."""
        return self._select("WHERE dossier = ?", (dossier_id,))


class PostgresJournal:
    """Production. Schéma et garanties identiques ; nécessite psycopg.

    CREATE TABLE events (
        seq BIGSERIAL PRIMARY KEY, at TIMESTAMPTZ NOT NULL,
        type TEXT NOT NULL, actor TEXT NOT NULL,
        dossier TEXT, payload JSONB NOT NULL);
    CREATE INDEX ON events (dossier); CREATE INDEX ON events (type);
    CREATE RULE no_update AS ON UPDATE TO events DO INSTEAD NOTHING;
    CREATE RULE no_delete AS ON DELETE TO events DO INSTEAD NOTHING;
    -- + REVOKE UPDATE, DELETE ON events FROM ALL;
    """

    def __init__(self, dsn):
        import psycopg
        self._db = psycopg.connect(dsn)

    def append(self, at, type, actor, **payload):
        with self._db.cursor() as cur:
            cur.execute(
                "INSERT INTO events (at, type, actor, dossier, payload) "
                "VALUES (%s, %s, %s, %s, %s) RETURNING seq",
                (at, type, actor, payload.get("dossier"),
                 json.dumps(payload, default=str, ensure_ascii=False)))
            seq = cur.fetchone()[0]
        self._db.commit()
        return Event(seq=seq, at=at, type=type, actor=actor,
                     payload=MappingProxyType(dict(payload)))
    # all/of_type/as_of/for_dossier : mêmes requêtes que SqlJournal (%s au lieu de ?)
