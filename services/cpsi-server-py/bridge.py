#!/usr/bin/env python3
"""
Pont CPSI (transport shell-out) — la porte NestJS l'invoque en sous-processus. Il NE contient
AUCUNE règle : il reconstruit l'état d'un tenant en REJOUANT son journal append-only (fourni par
la porte depuis Postgres) puis exécute une opération de LECTURE via le moteur ratifié
`olive_cpsi.engine` (source de vérité unique, R63→R83). Aucune écriture, aucun état persistant ici.

Protocole d'ENVELOPPE VERSIONNÉE (R248, stdin JSON) :
  { "contract_version": "1",             # version d'enveloppe (refus typé si non supportée)
    "tenant_id": "...",                  # informatif (le rejeu est déjà borné au tenant côté porte)
    "as_of": "ISO|null",                 # rejeu à date (R48) ; la porte filtre déjà le journal ≤ as_of
    "config": {...},                     # config CPSI du tenant (R68 ; défauts moteur sinon)
    "journal": [ {"type": ..., ...}, ],  # événements append-only ordonnés (seq croissant, R49)
    "commande": "score",                 # l'opération de lecture demandée
    "payload": {...} }                   # arguments de la commande (client, seuil, changements…)
Réponse (stdout JSON) :
  { "contract_version": "1", "resultat": <...>, "meta": {"evenements_rejoues": N} }
  ou { "contract_version": ..., "erreur_typee": {"type","code","message"} }.
Une erreur métier du moteur (`CpsiError`, default-deny) devient `erreur_typee` — jamais avalée.
"""
import sys, json, time
from datetime import datetime
from olive_cpsi.engine import OliveCpsiEngine, CpsiError


def _dt(iso):
    # Le moteur travaille en datetimes NAÏFS (cf. sa base de config `datetime.min`). On accepte le
    # suffixe "Z" et tout offset, puis on retire le fuseau pour rester homogène (pas de comparaison
    # aware/naïf qui lèverait TypeError).
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).replace(tzinfo=None)


# Rejeu : chaque type d'événement → une méthode du moteur (mêmes arguments que le canon).
# `as_of` (PC-15/PA-03) : une application de paramètre à date de vigueur FUTURE n'affecte le
# calcul qu'à partir d'elle — l'événement existe au journal, sa PRISE D'EFFET attend sa date.
def _replay(engine, journal, as_of=None):
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
        elif t == "cpsi.case_proposal.emitted":
            pass  # R252 : artefact d'émission vers riskcases (R133-R136) — aucun état moteur
        elif t == "cpsi.param.applied":
            # PC-15 (extension ratifiée P2) : l'application est un ÉVÉNEMENT du journal (R68/R249).
            vigueur = _dt(ev["date_vigueur"])
            if as_of is None or vigueur <= as_of:
                engine.modifier_parametre(ev["chemin"], ev["valeur"], ev["par"], vigueur,
                                          note=ev.get("motif") or "application R68 (PC-15)")
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


# CP-10 (R69) : toutes les propositions (état reconstruit par rejeu) — lecture pour l'écran gouvernance.
def _propositions(engine, q):
    return engine.propositions


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


# PC-14 (extension ratifiée 2026-07-27, vague écrans pilote P1) : TIMELINE d'un client —
# PROJECTION du journal rejoué (déjà filtré ≤ as_of par la porte, R48), jamais un calcul.
# Le pont REND les événements du client dans l'ordre du journal ; rejouer redonne l'identique.
def _timeline(engine, q):
    journal = getattr(engine, "_journal_porte", [])
    return {"client": q["client"], "evenements": [
        {k: v for k, v in ev.items() if k != "statique"}                  # entrées PLATES du journal (type, at, …)
        for ev in journal if ev.get("client") == q["client"]]}


# PC-13 (extension ratifiée 2026-07-27, vague écrans pilote P1) : VOLUMÉTRIE par scénario —
# comptages des signaux scorés/alertes/near-miss du moteur à date. Le pont COMPTE ce que le
# moteur a produit (projection) — aucun seuil, aucune règle nouvelle.
def _volumetrie(engine, q):
    at = _dt(q["at"])
    signaux = engine.signaux(at, q.get("seuil"))
    par_scenario = {}
    for s in signaux:
        sc = par_scenario.setdefault(s.get("scenario"), {"signaux": 0, "alertes": 0, "near_miss": 0})
        sc["signaux"] += 1
        if s.get("statut") == "ALERTE":
            sc["alertes"] += 1
        elif s.get("statut") == "NEAR_MISS":
            sc["near_miss"] += 1
    return {"total_signaux": len(signaux), "par_scenario": par_scenario}


QUERIES = {"score": _score, "segmentation": _segmentation,
           "compliance_catalogue": _compliance_catalogue, "rules": _rules,
           "client_groups": _client_groups, "groups": _groups,
           "evaluate_scenario": _evaluate_scenario, "alerts": _alerts,
           "sandbox_simulate": _sandbox_simulate, "propose_param": _propose_param,
           "proposition": _proposition, "propositions": _propositions, "insiders": _insiders,
           "open_risk_case": _open_risk_case, "risk_case": _risk_case, "reporting": _reporting,
           "timeline": _timeline, "volumetrie": _volumetrie}


# R248 : versions d'enveloppe supportées. Une version inconnue est refusée typée (pas de 500 opaque).
SUPPORTED_CONTRACTS = {"1", "1.1"}

# ── Contrat 1.1 (R281, canon écarts anciens ratifié 2026-07-28) — EXTENSION par ALIAS :
# les noms canon délèguent aux commandes livrées (zéro duplication) ; reporting_sla est la
# seule commande neuve (jalons t0 par rejeu). Une commande 1.1 dans une enveloppe 1.0 est
# refusée TYPÉE (PC-17) ; la 1.0 reste servie telle quelle (compatibilité). ──
ALIAS_1_1 = {"timeline_client": "timeline", "reporting_volumetrie": "volumetrie"}
COMMANDES_1_1 = {"timeline_client", "reporting_volumetrie", "reporting_sla"}


def _reporting_sla(engine, q):
    # t0 (R281) : le PREMIER signal ingéré du client — l'alerte naît du rejeu de ces signaux
    # (R249) ; jalon par case_proposal émise (clé R252). t1/t2 vivent aux journaux riskcases/
    # MROS : la PORTE (Nest) les assemble — ici, la part CPSI de la chaîne, par rejeu pur.
    journal = getattr(engine, "_journal_porte", [])
    premiers = {}
    for e in journal:
        if e.get("type") == "cpsi.signal.ingested" and e.get("client") not in premiers:
            premiers[e.get("client")] = e.get("at")
    jalons = []
    for e in journal:
        if e.get("type") == "cpsi.case_proposal.emitted":
            jalons.append({"cle": e.get("cle"), "client": e.get("client"),
                           "scenarios": e.get("scenarios") or [],
                           "t0": premiers.get(e.get("client"), e.get("at")),
                           "proposalAt": e.get("at")})
    return {"jalons": jalons}


def traiter(env):
    # Une enveloppe → une réponse. AUCUN état ne survit entre deux enveloppes : le moteur est
    # reconstruit à chaque appel par rejeu du journal fourni (le mode --serve ne change QUE le
    # transport, jamais la sémantique — chantier #3, contrat R248 inchangé).
    cv = None
    try:
        cv = str(env.get("contract_version"))
        if cv not in SUPPORTED_CONTRACTS:
            return {"contract_version": cv, "erreur_typee": {
                "type": "UNSUPPORTED_CONTRACT", "code": "CPSI_CONTRACT",
                "message": f"contract_version {cv} non supportée (supportées : {sorted(SUPPORTED_CONTRACTS)})"}}
        engine = OliveCpsiEngine(env.get("config") or {})
        journal = env.get("journal") or []
        t0 = time.perf_counter()
        _replay(engine, journal, _dt(env["as_of"]) if env.get("as_of") else None)  # journal filtré ≤ as_of par la porte (R48)
        engine._journal_porte = journal                                   # PC-14 : la timeline PROJETTE le journal rejoué
        duree_ms = round((time.perf_counter() - t0) * 1000, 3)           # R250 : jauge d'hydratation
        commande = env.get("commande")
        if commande in COMMANDES_1_1 and cv != "1.1":                     # PC-17 : erreur TYPÉE « version »
            return {"contract_version": cv, "erreur_typee": {
                "type": "UNSUPPORTED_VERSION", "code": "CPSI_CONTRACT_VERSION",
                "message": f"commande {commande} exige contract_version 1.1 (enveloppe reçue : {cv})"}}
        commande_effective = "reporting_sla" if commande == "reporting_sla" else ALIAS_1_1.get(commande, commande)
        payload = env.get("payload") or {}
        q = {**payload, "op": commande_effective, "at": env.get("as_of") or payload.get("at")}
        if commande_effective == "reporting_sla":
            res = _reporting_sla(engine, q)
        elif commande_effective not in QUERIES:
            raise CpsiError(f"commande inconnue : {commande} (default-deny)")
        else:
            res = QUERIES[commande_effective](engine, q)
        return {"contract_version": cv, "resultat": res,
                "meta": {"evenements_rejoues": len(journal), "duree_ms": duree_ms}}
    except CpsiError as e:  # default-deny / règle métier du moteur → erreur TYPÉE (jamais avalée)
        return {"contract_version": cv, "erreur_typee": {
            "type": "DEFAULT_DENY", "code": "CPSI_ERROR", "message": str(e)}}
    except Exception as e:  # garde-fou : jamais de trace brute vers la porte
        return {"contract_version": cv, "erreur_typee": {
            "type": "BRIDGE_ERROR", "code": "CPSI_BRIDGE_ERROR", "message": str(e)}}


def main():
    # Mode one-shot historique (Q4) : une enveloppe sur stdin, une réponse sur stdout.
    try:
        env = json.load(sys.stdin)
    except Exception as e:
        print(json.dumps({"contract_version": None, "erreur_typee": {
            "type": "BRIDGE_ERROR", "code": "CPSI_BRIDGE_ERROR", "message": str(e)}}))
        return
    print(json.dumps(traiter(env)))


def serve():
    # Mode worker persistant (chantier #3) : NDJSON — une enveloppe par ligne, une réponse par
    # ligne, flush immédiat. Même contrat, même sémantique (traiter() est sans état) ; seul le
    # coût de démarrage Python est amorti. EOF (porte fermée) ⇒ sortie propre.
    for ligne in sys.stdin:
        ligne = ligne.strip()
        if not ligne:
            continue
        try:
            rep = traiter(json.loads(ligne))
        except Exception as e:  # ligne illisible : réponse typée, le worker SURVIT
            rep = {"contract_version": None, "erreur_typee": {
                "type": "BRIDGE_ERROR", "code": "CPSI_BRIDGE_ERROR", "message": str(e)}}
        sys.stdout.write(json.dumps(rep) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    serve() if "--serve" in sys.argv else main()
