# -*- coding: utf-8 -*-
"""
CPSI bloc 19 — PC-20 [R324, canon R321] : L'ÉQUIVALENCE EST PERMANENTE.
Contrat dormant ratifié (étape 0, 2026-07-29) : le snapshot n'est PAS déclenché (jauge
R250 à 103.7 ms pour 10 001 evts, seuil 2 000 ms) — mais le test d'équivalence protège
le futur DÈS MAINTENANT : les DEUX chemins d'hydratation existants (rejeu lourd = défaut
moteur ; rejeu léger = mode du pont, ratifié) produisent des réponses BYTE-À-BYTE
identiques sur TOUTES les commandes du pont, journal mixte. Toute optimisation future
(snapshot PC-21..23, cache PC-24..25) devra passer par CE test étendu.
Écart consigné : fixture à 1 200 événements (le chemin lourd est quadratique — c'est
précisément pourquoi le léger existe) ; la pleine charge se rejoue à la demande
(CPSI_EQUIV=10000 python3 run_tests.py). L'injection de corruption de snapshot
(canon PC-15) viendra AVEC le snapshot — il n'existe pas encore, rien à corrompre.
"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import bridge  # noqa: E402
from olive_cpsi.engine import OliveCpsiEngine  # noqa: E402

N = int(os.environ.get("CPSI_EQUIV", "1200"))


def _journal():
    j = [
        {"type": "cpsi.client.registered", "at": "2026-01-01T00:00:00", "client": "c1",
         "statique": {"pep": True, "pays_risque": 1}, "attributs": {}, "par": "u"},
        {"type": "cpsi.client.registered", "at": "2026-01-01T01:00:00", "client": "c2",
         "statique": {"pep": False, "pays_risque": 2}, "attributs": {}, "par": "u"},
    ]
    for i in range(N):
        j.append({"type": "cpsi.signal.ingested",
                  "at": "2026-%02d-%02dT%02d:00:00" % ((i % 11) + 2, (i % 27) + 1, i % 23),
                  "client": "c1" if i % 2 else "c2", "signal": "hit_screening",
                  "severite": (i % 3) + 1, "meta": None, "par": "u"})
    j.sort(key=lambda e: e["at"])
    return j


def _reponse(journal, commande, payload, leger):
    env = {"contract_version": "1.1", "tenant_id": "t", "as_of": "2026-12-31T00:00:00",
           "config": {}, "journal": journal, "commande": commande, "payload": payload}
    orig = bridge.OliveCpsiEngine
    bridge.OliveCpsiEngine = lambda cfg, rejeu_leger=True: orig(cfg, rejeu_leger=leger)
    try:
        r = bridge.traiter(env)
    finally:
        bridge.OliveCpsiEngine = orig
    r.pop("meta", None)  # la jauge (durée) diffère par construction — le RÉSULTAT jamais
    return json.dumps(r, sort_keys=True)


COMMANDES = [("score", {"client": "c1"}), ("score", {"client": "c2"}), ("segmentation", {}),
             ("rules", {}), ("alerts", {}), ("compliance_catalogue", {}), ("insiders", {}),
             ("timeline_client", {"client": "c1"}), ("reporting_volumetrie", {}),
             ("reporting_sla", {})]


def test_pc20_equivalence_byte_a_byte_sur_toutes_les_commandes():
    journal = _journal()
    for commande, payload in COMMANDES:
        lourd = _reponse(journal, commande, payload, leger=False)
        leger = _reponse(journal, commande, payload, leger=True)
        assert lourd == leger, "PC-20 DIVERGENCE sur %s" % commande


def test_pc20_equivalence_au_rejeu_a_date():
    journal = _journal()
    env_as_of = "2026-06-15T00:00:00"  # coupe le journal en deux — R48 sous équivalence
    coupe = [e for e in journal if e["at"] <= env_as_of]
    for leger in (False, True):
        pass  # la coupe est faite par la porte : on la reproduit ici
    lourd = _reponse(coupe, "score", {"client": "c1"}, leger=False)
    leger = _reponse(coupe, "score", {"client": "c1"}, leger=True)
    assert lourd == leger, "PC-20 DIVERGENCE au rejeu à date"


def test_pc20_le_chemin_est_declare_dans_les_meta():
    # R325 (contrat dormant) : les meta R250 déclarent COMMENT le chiffre a été produit.
    # Aujourd'hui un seul chemin existe : replay_complet (léger ou lourd = même rejeu intégral).
    env = {"contract_version": "1.1", "tenant_id": "t", "as_of": "2026-12-31T00:00:00",
           "config": {}, "journal": _journal()[:10], "commande": "score", "payload": {"client": "c1"}}
    r = bridge.traiter(env)
    assert r["meta"]["chemin"] == "replay_complet"
