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
        elif t == "cpsi.param.proposed":
            engine.proposer_parametre(ev["auteur"], ev["chemin"], ev["valeur"], ev["justification"], at)
        elif t == "cpsi.param.adopted":
            engine.adopter_proposition(ev["pid"], ev["humain"], at)
        elif t == "cpsi.param.rejected":
            engine.rejeter_proposition(ev["pid"], ev["humain"], ev["motivation"], at)
        elif t == "cpsi.fp.declared":
            engine.declarer_faux_positif(ev["client"], ev["scenario"], ev["acteur"], at)
        elif t == "cpsi.insider.tagged":
            engine.taguer_insider(ev["client"], ev["acteur"], ev["role"], ev["motif"], at, ev.get("instrument"))
        elif t == "cpsi.insider.lifted":
            engine.lever_insider(ev["client"], ev["acteur"], ev["role"], ev["motif"], at)
        elif t == "cpsi.riskcase.opened":
            engine.ouvrir_risk_case(ev["alertes"], ev["acteur"], at)
        elif t == "cpsi.riskcase.transition":
            engine.transition_risk_case(ev["case"], ev["action"], ev["acteur"], at, ev.get("motif"))
        elif t == "cpsi.riskcase.note":
            engine.documenter_risk_case(ev["case"], ev["acteur"], ev["note"], at)
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


# CP-09 (R70) : bac à sable — simulation d'impact, dry-run (aucune mutation persistée).
def _sandbox_simulate(engine, q):
    return engine.simuler_impact(q["changements"], _dt(q["at"]), q.get("acteur", "sandbox"))


# CP-10 (R69) : dernière proposition émise (id déterministe PROP-N) / une proposition par id.
def _propose_param(engine, q):
    if not engine.propositions:
        raise CpsiError("aucune proposition")
    return engine.propositions[-1]


def _proposition(engine, q):
    p = next((p for p in engine.propositions if p["id"] == q["id"]), None)
    if p is None:
        raise CpsiError(f"proposition inconnue : {q['id']}")
    return p


# CP-14 (R75) : liste des initiés (MAR).
def _insiders(engine, q):
    return {"inities": engine.liste_inities()}


# CP-15/16 (R83) : le dernier risk case ouvert (id déterministe RC-000N) / un case par id.
def _open_risk_case(engine, q):
    if not engine.risk_cases:
        raise CpsiError("aucun risk case")
    cid = max(engine.risk_cases, key=lambda k: int(k.split("-")[1]))
    return engine.risk_cases[cid]


def _risk_case(engine, q):
    c = engine.risk_cases.get(q["id"])
    if c is None:
        raise CpsiError(f"risk case inconnu : {q['id']}")
    return c


# CP-17 (R39) : reporting SLA des cases (mesure, ne bloque pas).
def _reporting(engine, q):
    return engine.reporting_cases(q.get("sla_jours", 30))


QUERIES = {"score": _score, "segmentation": _segmentation,
           "compliance_catalogue": _compliance_catalogue, "rules": _rules,
           "client_groups": _client_groups, "groups": _groups,
           "evaluate_scenario": _evaluate_scenario, "alerts": _alerts,
           "sandbox_simulate": _sandbox_simulate, "propose_param": _propose_param,
           "proposition": _proposition, "insiders": _insiders,
           "open_risk_case": _open_risk_case, "risk_case": _risk_case, "reporting": _reporting}


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
