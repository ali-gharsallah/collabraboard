"""Démo parallel run SANS intégration : rejeu de parcours dans deux moteurs.
Maître = legacy simulé avec deux travers réalistes ; Ombre = moteur catalogue.
Sortie : rapport-parallel-run.md (divergences triées en trois causes)."""
import sys; sys.path.insert(0, ".")
from datetime import datetime, timedelta
from olive_engine.domain import Engine, VisaState, SectionState
from olive_engine.shadow import ShadowRunner, OliveEngineAdapter

T0 = datetime(2026, 7, 1, 9, 0)
def t(h): return T0 + timedelta(hours=h)

class LegacySimule(OliveEngineAdapter):
    """L'engine actuel, avec ses deux écarts au catalogue (typiques du réel) :
    ① laxisme R7 : accepte un refus sans motivation ;
    ② règle implicite jamais extraite en session : « pas de visa sans document »."""
    def _dispatch(self, c):
        if c["cmd"] == "refuser" and not c.get("motivation"):
            d = self.dossiers[c["dossier"]]; s = d.sections[c["section"]]
            s.visa.etat = VisaState.REFUSE; s.etat = SectionState.EN_PREPARATION
            return                                             # ① viole R7 en silence
        if c["cmd"] == "accorder":
            d = self.dossiers[c["dossier"]]; s = d.sections[c["section"]]
            if not s.documents:                                # ② règle implicite
                from olive_engine.errors import InvalidTransition
                raise InvalidTransition("legacy : aucun document rattaché à la section")
        super()._dispatch(c)

def adaptateur(cls=OliveEngineAdapter):
    e = Engine(); e.actifs |= {"V1", "V2", "VF"}; return cls(e)

def parcours(did, avec_refus_vide=False):
    p = [{"cmd": "creer", "dossier": did, "at": T0, "validateur_final": "VF",
          "sections": [("Identification", "V1"), ("Fiscalite", "V2")]},
         {"cmd": "modifier", "dossier": did, "section": "Identification",
          "acteur": "U1", "champ": "domicile", "valeur": "GE", "at": t(1)},
         {"cmd": "soumettre", "dossier": did, "section": "Identification",
          "acteur": "U1", "at": t(1)},
         {"cmd": "accorder", "dossier": did, "section": "Identification",
          "acteur": "V1", "at": t(2)}]
    if avec_refus_vide:
        p.insert(3, {"cmd": "refuser", "dossier": did, "section": "Identification",
                     "acteur": "V1", "at": t(2), "motivation": ""})
    return p

runner = ShadowRunner(maitre=adaptateur(LegacySimule), ombre=adaptateur())
for i, flags in enumerate([{}, {"avec_refus_vide": True}, {}], start=1):
    for cmd in parcours(f"KYC-2026-CH-{i:04d}-R0", **flags):
        runner.execute(cmd)
    runner.fin_de_parcours()

# ── tri des divergences (session quotidienne compliance + dev) ──
for d in runner.divergences:
    if d.type == "DECISION" and d.cmd["cmd"] == "refuser":
        runner.classer(d, "BUG_MAITRE",
            "le maître accepte un refus sans motivation — R7 le proscrit")
    elif d.type == "DECISION" and d.cmd["cmd"] == "accorder":
        brouillon = runner.classer(d, "REGLE_IMPLICITE",
            "le maître exige au moins un document rattaché avant tout visa")
        print("── brouillon généré pour le catalogue ──\n" + brouillon)
    elif d.type == "ETAT":
        runner.classer(d, "BUG_MAITRE",
            "état divergent en aval du refus sans motivation (même cause R7)")

rapport = runner.rapport("Rapport quotidien — parallel run (démo sans intégration)")
open("rapport-parallel-run.md", "w").write(rapport)
print(rapport)
print(f"\nPrêt à basculer (3 parcours propres) : {runner.pret_a_basculer(3)}")
