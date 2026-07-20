"""Croisement bidirectionnel workflow actuel (JS) ⇄ nouveau moteur (Python)."""
import sys, os; sys.path.insert(0, ".")
from olive_engine.cross import CrossRunner, CanonPyAdapter, JsBridgeAdapter, PARCOURS

BRIDGE = os.path.join(os.path.dirname(__file__), "..", "..", "packages", "workflow-engine")
js = JsBridgeAdapter(os.path.abspath(BRIDGE))
runner = CrossRunner(js, CanonPyAdapter())
runner.run(PARCOURS)
js.close()
rapport = runner.rapport()
rapport += ("\n\n## Lecture bidirectionnelle du tri\n"
 "- Sens « le workflow actuel fait foi » : chaque divergence INATTENDUE est une\n"
 "  régression candidate du nouveau moteur — corriger, le test du catalogue existe.\n"
 "- Sens « le catalogue fait foi » : chaque écart ATTENDU documente un laxisme du\n"
 "  workflow actuel (R2, R14) ou une règle implicite à ratifier — brouillon Rn.\n")
open("rapport-croise-bidirectionnel.md", "w").write(rapport)
print(rapport)
