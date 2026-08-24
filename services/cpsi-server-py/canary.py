# -*- coding: utf-8 -*-
# CANARI de méta-vérification (lot L1). Ce fichier contient UN test qui échoue DÉLIBÉRÉMENT.
# Il n'est PAS dans la suite normale : run_tests.py ne l'exécute qu'en mode --canary, et son nom
# (« canary.py », sans préfixe test_ ni suffixe _test) fait qu'un vrai pytest ne le collecte pas.
# But : prouver, en CI, que le runner sait échouer — si `run_tests.py --canary` rendait 0, le
# faux-vert serait de retour (cf. docs/notes/L1.md).


def test_canary_doit_echouer():
    assert False, "canari : échec délibéré — le runner DOIT propager ce code de sortie ≠ 0"
