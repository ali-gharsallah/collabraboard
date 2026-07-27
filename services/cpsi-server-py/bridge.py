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
        elif t == "cpsi.group.defined":
            engine.definir_groupe(ev["gid"], ev["label"], ev["predicat"], at,
                                  ev.get("priorite", 100), ev.get("bareme"))
        elif t == "cpsi.scenario.defined":
            engine.definir_scenario_aml(ev["sid"], ev["label"], ev["champ"], ev["groupes_seuils"],
                                        at, ev.get("sens", "gte"))
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


# CP-03 (R65) : segmentation en groupes de pairs — déterministe, explicable.
def _segmentation(engine, q):
    res = engine.segmenter(_dt(q["at"]))
    return [{"client": c, "segment": s} for c, s in res.items()]


# CP-07 (R79) : catalogue de conformité, lecture seule (vide tant qu'aucun scénario défini).
def _compliance_catalogue(engine, q):
    return engine.catalogue_conformite(_dt(q["at"]))


# CP-08 (R68) : règles de calcul en clair.
def _rules(engine, q):
    return engine.decrire_regles(_dt(q["at"]))


# CP-04 (R71/R72) : groupes d'un client + groupe primaire (barème effectif).
def _client_groups(engine, q):
    at = _dt(q["at"])
    return {
        "groups": [{"id": g["id"], "label": g["label"], "priorite": g["priorite"]}
                   for g in engine.groupes_de(q["client"], at)],
        "primary": engine.groupe_primaire(q["client"], at),
    }


# CP-05 (R74) : registre des groupes en clair (prédicat, barème, effectif).
def _groups(engine, q):
    return engine.decrire_groupes(_dt(q["at"]))


# CP-06 (R73) : évaluation d'un scénario ciblé — seuls les membres des groupes visés.
def _evaluate_scenario(engine, q):
    return engine.evaluer_scenario(q["scenario"], _dt(q["at"]))


# CP-12 (R80/R81) : signaux scorés dédupliqués, alertes (score≥X), near-miss, corrélations.
def _alerts(engine, q):
    at = _dt(q["at"])
    seuil = q.get("seuil")
    return {"signaux": engine.signaux(at, seuil), "correlations": engine.correlations(at, seuil)}


QUERIES = {"score": _score, "segmentation": _segmentation,
           "compliance_catalogue": _compliance_catalogue, "rules": _rules,
           "client_groups": _client_groups, "groups": _groups,
           "evaluate_scenario": _evaluate_scenario, "alerts": _alerts}


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
