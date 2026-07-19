"""Journal d'événements append-only (R48, R49).

Fondation du moteur : rien ne change d'état par effet de bord.
Toute mutation du domaine passe par un événement horodaté, attribué,
immuable. Le journal ne s'efface jamais — une correction s'ajoute
par-dessus (R49). Le rejeu à date (R48) est une lecture filtrée.
"""
from dataclasses import dataclass, field
from datetime import datetime
from types import MappingProxyType


@dataclass(frozen=True)
class Event:
    seq: int
    at: datetime
    type: str
    actor: str
    payload: MappingProxyType

    def __repr__(self):
        return f"<{self.seq}:{self.type} par {self.actor} @ {self.at:%Y-%m-%d %H:%M}>"


class EventJournal:
    """Append-only : pas de __setitem__, pas de suppression (R49)."""

    def __init__(self):
        self._events = []

    def append(self, at: datetime, type: str, actor: str, **payload) -> Event:
        ev = Event(seq=len(self._events) + 1, at=at, type=type,
                   actor=actor, payload=MappingProxyType(dict(payload)))
        self._events.append(ev)
        return ev

    def all(self):
        return tuple(self._events)

    def of_type(self, *types):
        return tuple(e for e in self._events if e.type in types)

    def as_of(self, at: datetime):
        """Rejeu à date (R48) : les événements connus à une date antérieure."""
        return tuple(e for e in self._events if e.at <= at)

    def for_dossier(self, dossier_id: str):
        """Extraction par identifiant KYC (R51)."""
        return tuple(e for e in self._events
                     if e.payload.get("dossier") == dossier_id)
