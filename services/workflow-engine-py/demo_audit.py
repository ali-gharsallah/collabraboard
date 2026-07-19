"""Démo des fondations bloc 7 déjà présentes : rejeu à date (R48) et
extraction par ID KYC (R51) — les deux démos FINMA-killer."""
import sys; sys.path.insert(0, ".")
from datetime import datetime, timedelta
from olive_engine.domain import Engine, FINAL_STEP

T0 = datetime(2026, 7, 1, 9, 0)
e = Engine(); e.actifs |= {"V1", "V2", "VF"}
d = e.creer_dossier("KYC-2026-CH-0001-R0", [("Identification","V1"),("Fiscalite","V2")], T0)
e.definir_validation_finale(d, "VF", T0)
e.modifier_donnee(d, "Identification", "U1", "nom", "Dupont", T0 + timedelta(hours=1))
e.soumettre_au_visa(d, "Identification", "U1", T0 + timedelta(hours=2))
e.accorder_visa(d, "Identification", "V1", T0 + timedelta(days=1))
e.modifier_donnee(d, "Fiscalite", "U1", "domicile", "GE", T0 + timedelta(days=2))
e.soumettre_au_visa(d, "Fiscalite", "U1", T0 + timedelta(days=2, hours=1))
e.refuser_visa(d, "Fiscalite", "V2", T0 + timedelta(days=3), motivation="Justificatif manquant")

print("=== R48 — Rejeu à date : état connu au 2 juillet 2026 ===")
for ev in e.journal.as_of(datetime(2026, 7, 2, 12, 0)):
    print(" ", ev)
print()
print("=== R51 — Extraction audit trail par ID KYC ===")
for ev in e.journal.for_dossier("KYC-2026-CH-0001-R0"):
    print(" ", ev.seq, ev.type, "|", ev.actor, "|", dict(ev.payload))
