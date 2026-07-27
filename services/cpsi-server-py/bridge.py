#!/usr/bin/env python3
"""
Pont CPSI (transport shell-out) — la porte NestJS l'invoque en sous-processus. Il NE contient
AUCUNE règle : il reconstruit l'état d'un tenant en REJOUANT son journal append-only (fourni par
la porte depuis Postgres) puis exécute une opération de LECTURE via le moteur ratifié
`olive_cpsi.engine` (source de vérité unique, R63→R83). Aucune écriture, aucun état persistant ici.

Protocole (stdin JSON) :
  { "config": {...},                     # config CPSI du tenant (R68 ; défauts moteur sinon)
    "journal": [ {"type": ..., ...}, ],  # événements append-only ordonnés (seq croissant, R49)
    "query":   {"op": "score", ...} }    # l'opération de lecture demandée
Réponse (stdout JSON) : {"ok": <résultat>} ou {"error": {"code","message"}}.
Une erreur métier du moteur (`CpsiError`, default-deny) devient {"error"} — jamais avalée.
"""
import sys, json
from datetime import datetime
from olive_cpsi.engine import OliveCpsiEngine, CpsiError


def _dt(iso):
    # Le moteur travaille en datetimes NAÏFS (cf. sa base de config `datetime.min`). On accepte le
    # suffixe "Z" et tout offset, puis on retire le fuseau pour rester homogène (pas de comparaison
    # aware/naïf qui lèverait TypeError).
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).replace(tzinfo=None)


# Rejeu : chaque type d'événement → une méthode du moteur (mêmes arguments que le canon).
def _replay(engine, journal):
    for ev in journal:
        t = ev["type"]
        at = _dt(ev["at"])
        if t == "cpsi.client.registered":
            engine.enregistrer_client(ev["client"], ev["statique"], at, ev.get("attributs"))
        elif t == "cpsi.signal.ingested":
            engine.ingester_signal(ev["client"], ev["signal"], ev["severite"], at, ev.get("meta"))
        else:
            raise CpsiError(f"type d'événement de rejeu inconnu : {t} (default-deny)")


def _score(engine, q):
    at = _dt(q["at"])
    score, drivers = engine.score_a_date(q["client"], at)
    return {
        "score": score,
        "bande": engine.bande(score, at),
        "drivers": [{"source": s, "contribution": c} for (s, c) in drivers],
    }


QUERIES = {"score": _score}


def main():
    try:
        req = json.load(sys.stdin)
        engine = OliveCpsiEngine(req.get("config") or {})
        _replay(engine, req.get("journal") or [])
        q = req["query"]
        op = q.get("op")
        if op not in QUERIES:
            raise CpsiError(f"opération de lecture inconnue : {op} (default-deny)")
        print(json.dumps({"ok": QUERIES[op](engine, q)}))
    except CpsiError as e:
        print(json.dumps({"error": {"code": "CPSI_ERROR", "message": str(e)}}))
    except Exception as e:  # garde-fou : jamais de trace brute vers la porte
        print(json.dumps({"error": {"code": "CPSI_BRIDGE_ERROR", "message": str(e)}}))


if __name__ == "__main__":
    main()
