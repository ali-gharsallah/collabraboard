"""Parallel run (strangler fig) — ShadowRunner + comparateur + rapport.

Montage : l'engine MAÎTRE reste seul à produire des effets visibles. Chaque
commande est dupliquée vers le moteur OMBRE (jamais d'effet visible : toute
exception de l'ombre est capturée). Après chaque commande, le comparateur
vérifie : même décision (accepté/refusé — et l'ombre CITE SA RÈGLE sur refus),
même état canonique dossier/section/visa. Toute divergence part au rapport.

Tri des divergences (trois causes) :
  BUG_OMBRE        → on corrige le nouveau moteur, le test du catalogue existe déjà
  BUG_MAITRE       → le catalogue vient de révéler un bug de l'engine actuel
  REGLE_IMPLICITE  → règle du maître absente du catalogue : brouillon Rn+1 généré

Critère de bascule : N parcours complets consécutifs à zéro divergence.
"""
from dataclasses import dataclass, field


# ---------- protocole adaptateur ----------
class EngineAdapter:
    """Adapte un moteur au protocole de commandes du ShadowRunner.
    execute(cmd) -> {"ok": bool, "regle": str|None, "msg": str|None}
    snapshot(dossier_id) -> état canonique comparable."""
    def execute(self, cmd): raise NotImplementedError
    def snapshot(self, dossier_id): raise NotImplementedError


class OliveEngineAdapter(EngineAdapter):
    """Adaptateur du moteur de référence (catalogue R1-R52)."""
    def __init__(self, engine):
        self.e = engine
        self.dossiers = {}

    def execute(self, cmd):
        from .errors import OliveRuleError
        try:
            self._dispatch(cmd)
            return {"ok": True, "regle": None, "msg": None}
        except OliveRuleError as ex:
            return {"ok": False, "regle": ex.rule, "msg": str(ex)}

    def _dispatch(self, c):
        k = c["cmd"]
        if k == "creer":
            d = self.e.creer_dossier(c["dossier"], c["sections"], c["at"])
            self.e.definir_validation_finale(d, c["validateur_final"], c["at"])
            self.dossiers[c["dossier"]] = d
        else:
            d = self.dossiers[c["dossier"]]
            if k == "modifier":
                self.e.modifier_donnee(d, c["section"], c["acteur"], c["champ"], c["valeur"], c["at"])
            elif k == "soumettre":
                self.e.soumettre_au_visa(d, c["section"], c["acteur"], c["at"])
            elif k == "accorder":
                self.e.accorder_visa(d, c["section"], c["acteur"], c["at"],
                                     engagement=c.get("engagement", False),
                                     derogation=c.get("derogation"))
            elif k == "refuser":
                self.e.refuser_visa(d, c["section"], c["acteur"], c["at"],
                                    motivation=c.get("motivation"))
            else:
                raise ValueError(f"commande inconnue {k}")

    def snapshot(self, dossier_id):
        d = self.dossiers[dossier_id]
        return {
            "dossier": getattr(d, "etat", None) and str(d.etat),
            "sections": {
                nom: {
                    "etat": str(s.etat),
                    "visa": (str(s.visa.etat) if s.visa else None),
                    "validateur": (s.visa.validateur if s.visa else None),
                } for nom, s in d.sections.items()
            },
        }


# ---------- divergences & rapport ----------
@dataclass
class Divergence:
    seq: int
    cmd: dict
    type: str                 # DECISION | ETAT | CRASH_OMBRE | REGLE_NON_CITEE
    maitre: object
    ombre: object
    triage: str = None        # BUG_OMBRE | BUG_MAITRE | REGLE_IMPLICITE
    note: str = ""


@dataclass
class ShadowRunner:
    maitre: EngineAdapter
    ombre: EngineAdapter
    divergences: list = field(default_factory=list)
    seq: int = 0
    parcours_propres_consecutifs: int = 0
    _parcours_propre: bool = True
    _prochaine_regle: int = 53          # numérotation continue après R52
    _brouillons: dict = field(default_factory=dict)   # note → numéro (dédoublonnage)

    # ---- exécution en ombre ----
    def execute(self, cmd):
        self.seq += 1
        res_m = self.maitre.execute(cmd)          # le maître fait foi, effets visibles
        try:
            res_o = self.ombre.execute(cmd)       # l'ombre ne casse JAMAIS le flux
        except Exception as ex:                   # noqa: BLE001 — capture totale voulue
            self._diverge(cmd, "CRASH_OMBRE", res_m, repr(ex))
            return res_m
        # 1) même décision ?
        if res_m["ok"] != res_o["ok"]:
            self._diverge(cmd, "DECISION", res_m, res_o)
        else:
            # 2) sur refus, l'ombre doit citer sa règle
            if not res_o["ok"] and not res_o.get("regle"):
                self._diverge(cmd, "REGLE_NON_CITEE", res_m, res_o)
            # 3) mêmes états canoniques ?
            if cmd["cmd"] != "creer" or True:
                snap_m = self._safe_snapshot(self.maitre, cmd["dossier"])
                snap_o = self._safe_snapshot(self.ombre, cmd["dossier"])
                if snap_m != snap_o:
                    self._diverge(cmd, "ETAT", snap_m, snap_o)
        return res_m

    def _safe_snapshot(self, adapter, did):
        try: return adapter.snapshot(did)
        except Exception as ex: return {"__erreur_snapshot__": repr(ex)}

    def _diverge(self, cmd, typ, maitre, ombre):
        self._parcours_propre = False
        self.divergences.append(Divergence(self.seq, cmd, typ, maitre, ombre))

    # ---- parcours & bascule ----
    def fin_de_parcours(self):
        if self._parcours_propre: self.parcours_propres_consecutifs += 1
        else: self.parcours_propres_consecutifs = 0
        self._parcours_propre = True

    def pret_a_basculer(self, n_parcours):
        return self.parcours_propres_consecutifs >= n_parcours

    # ---- tri des divergences ----
    def classer(self, divergence, verdict, note=""):
        assert verdict in ("BUG_OMBRE", "BUG_MAITRE", "REGLE_IMPLICITE")
        divergence.triage = verdict
        divergence.note = note
        if verdict == "REGLE_IMPLICITE":
            return self._brouillon_regle(divergence)
        return None

    def _brouillon_regle(self, div):
        """Règle implicite du maître capturée → brouillon Rn au catalogue,
        numérotation continue, avec squelette de scénario Gherkin."""
        if div.note in self._brouillons:
            n = self._brouillons[div.note]            # même cause → même règle
        else:
            n = self._prochaine_regle; self._prochaine_regle += 1
            self._brouillons[div.note] = n
        c = div.cmd
        return (
            f"R{n} — [BROUILLON — règle implicite capturée par parallel run] {div.note}\n"
            f"> Scénario {c.get('section','?')}-R{n}-01 (à formaliser)\n"
            f"> Étant donné {c}\n"
            f"> Quand la commande « {c['cmd']} » est exécutée\n"
            f"> Alors le maître répond {div.maitre} et le catalogue répond {div.ombre}\n"
            f"> Et la règle du maître doit être validée puis ajoutée au catalogue avant implémentation\n")

    # ---- rapport quotidien ----
    def rapport(self, titre="Rapport quotidien — parallel run"):
        lignes = [f"# {titre}", "",
                  f"Commandes rejouées : {self.seq} — divergences : {len(self.divergences)}",
                  f"Parcours propres consécutifs : {self.parcours_propres_consecutifs}", ""]
        if not self.divergences:
            lignes.append("✅ Zéro divergence.")
        buckets = {"BUG_OMBRE": [], "BUG_MAITRE": [], "REGLE_IMPLICITE": [], None: []}
        for d in self.divergences: buckets.setdefault(d.triage, []).append(d)
        for k, label in [("BUG_OMBRE", "🔧 Bugs du nouveau moteur (corriger, test déjà écrit)"),
                         ("BUG_MAITRE", "🔴 Bugs de l'engine actuel révélés par le catalogue"),
                         ("REGLE_IMPLICITE", "📜 Règles implicites → à ajouter au catalogue"),
                         (None, "❓ Non triées")]:
            if buckets.get(k):
                lignes.append(f"## {label}")
                for d in buckets[k]:
                    lignes.append(f"- seq {d.seq} · {d.type} · cmd `{d.cmd['cmd']}` "
                                  f"{d.cmd.get('section','')} — maître={d.maitre} | ombre={d.ombre}"
                                  + (f" — {d.note}" if d.note else ""))
                lignes.append("")
        return "\n".join(lignes)
