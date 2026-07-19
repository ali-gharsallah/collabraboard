"""Rejeu du CATALOGUE COMPLET comme corpus de parallel run.
Phase 1 — CAPTURE : exécute les 65 scénarios (suites blocs 1-7) sur des moteurs
enregistreurs, sans toucher une ligne des tests.
Phase 2 — REJEU : chaque corpus est rejoué dans deux moteurs neufs (maître /
ombre) avec comparaison pas à pas + contrôle de fidélité.
Sortie : rapport-corpus-rejeu.md"""
import sys, inspect; sys.path.insert(0, ".")
import pytest
from olive_engine import domain
from olive_engine.replay import EngineRecorder, CorpusReplayer
from tests import (test_bloc1_visa as b1, test_bloc2_dossier as b2,
                   test_bloc3_matrice as b3, test_bloc4_personnes as b4,
                   test_bloc5_taches as b5, test_bloc6_screening as b6,
                   test_bloc7_audit as b7)

MODULES = [("Bloc 1", b1), ("Bloc 2", b2), ("Bloc 3", b3), ("Bloc 4", b4),
           ("Bloc 5", b5), ("Bloc 6", b6), ("Bloc 7", b7)]

# ── Phase 1 : capture ──
captures = []          # (scenario_id, corpus, snapshots)
echecs_capture = []
for bloc, mod in MODULES:
    recorders_du_test = []
    class EngineCapture:                 # remplace le symbole Engine du module
        def __new__(cls, *a, **k):
            r = EngineRecorder(domain.Engine(*a, **k))
            recorders_du_test.append(r)
            return r
    ancien = mod.Engine
    mod.Engine = EngineCapture
    fixtures = {n: f for n, f in vars(mod).items()
                if callable(f) and getattr(f, "_is_fixture", False)}
    def _resolve(name, cache):
        if name in cache: return cache[name]
        fn = fixtures[name]
        cache[name] = fn(*[_resolve(p, cache) for p in inspect.signature(fn).parameters])
        return cache[name]
    for name, fn in vars(mod).items():
        if not (name.startswith("test_") and callable(fn)): continue
        recorders_du_test.clear()
        cache = {}
        try:
            fn(*[_resolve(p, cache) for p in inspect.signature(fn).parameters])
            for k, rec in enumerate(recorders_du_test):
                sid = f"{name}" + (f"#{k+1}" if len(recorders_du_test) > 1 else "")
                captures.append((bloc, sid, list(rec.corpus), rec.snapshots_finales()))
        except Exception as ex:          # noqa: BLE001
            echecs_capture.append((name, repr(ex)[:120]))
    mod.Engine = ancien

print(f"Capture : {len(captures)} corpus depuis les suites du catalogue "
      f"({sum(len(c[2]) for c in captures)} commandes) — échecs : {len(echecs_capture)}")
for n, e in echecs_capture: print("  ⚠ capture impossible:", n, e)

# ── Phase 2 : rejeu bi-moteur ──
rep = CorpusReplayer(lambda: domain.Engine(), lambda: domain.Engine())
for bloc, sid, corpus, snaps in captures:
    rep.rejouer(f"{bloc} · {sid}", corpus, snaps)

rapport = rep.rapport("Rapport — les 65 scénarios du catalogue comme corpus de rejeu")
rapport += (f"\n\nCritère de bascule : scénarios fidèles consécutifs = "
            f"{rep.scenarios_fideles_consecutifs}")
open("rapport-corpus-rejeu.md", "w").write(rapport)
print()
print(rapport)
