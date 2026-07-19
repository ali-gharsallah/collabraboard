"""Croisement bidirectionnel JS ⇄ Python (XC-01..XC-03).
XC-01 : parcours partagé → convergence totale.
XC-02 : R14 (engagement à la finale) — divergence réelle détectée et citée.
XC-03 : R2 (signataire non validateur) — laxisme du workflow actuel détecté."""
import os
from olive_engine.cross import CrossRunner, CanonPyAdapter, JsBridgeAdapter, PARCOURS

BRIDGE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..",
                                      "packages", "workflow-engine"))
def run(noms):
    js = JsBridgeAdapter(BRIDGE)
    try:
        r = CrossRunner(js, CanonPyAdapter())
        return r.run([p for p in PARCOURS if p[0].split()[0] in noms])
    finally:
        js.close()

def test_XC01_parcours_partages_convergent():
    res = run({"P01", "P02", "P06", "P09", "P10", "P16"})
    for r in res:
        assert r["divergences"] == [], f"{r['parcours']} devait converger"

def test_XC02_R14_convergent_apres_portage():
    """Le port JS a rattrapé R14 (12.07.2026) : les deux moteurs refusent
    la finale sans engagement, en citant la même règle."""
    res = run({"P11"})
    assert res[0]["divergences"] == [], "R14 désormais convergent"

def test_XC03_R2_convergent_apres_portage():
    res = run({"P12"})
    assert res[0]["divergences"] == [], "R2 désormais convergent"
