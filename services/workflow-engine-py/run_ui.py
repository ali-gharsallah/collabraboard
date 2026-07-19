"""Démo pilote : python3 run_ui.py → http://localhost:8700 (zéro dépendance)."""
import sys; sys.path.insert(0, ".")
from olive_engine.ui_server import creer_serveur
httpd, _ = creer_serveur(8700)
print("O-Live UI — http://localhost:8700  (Ctrl-C pour arrêter)")
httpd.serve_forever()
