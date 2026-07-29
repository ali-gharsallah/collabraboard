# -*- coding: utf-8 -*-
"""O-Live CPSI — Client Profiling & Segmentation Intelligence Server.
Moteur de référence (pur Python, déterministe).

Invariants hérités du catalogue :
- R63 : score perpétuel ÉVÉNEMENTIEL — tout signal recalcule, chaque recalcul est
  un événement append-only avec drivers explicables ; rejouable à date (R48/R49).
- R64 : décroissance temporelle — half-life exponentielle, paramètre tenant.
- R65 : segmentation en groupes de pairs — déterministe, appartenance tracée.
- R66 : franchissement de bande = ÉVÉNEMENT, jamais effet de bord — le CPSI ne
  touche à aucun dossier : il émet tâches et propositions (R39/R44).
- R67 : explicabilité obligatoire — aucun score boîte noire ; les drivers sont
  publiés avec chaque score et leur somme reconstitue la part comportementale.
"""
import math
import copy
from datetime import datetime

# ── Poids par défaut (paramètres tenant, questionnaire R-Q) ──
POIDS_SIGNAUX = {
    "alerte_fondee":      12.0,   # alerte AML qualifiée fondée
    "alerte_non_fondee":   2.0,   # faux positif : pèse peu mais n'est pas nul
    "hit_screening":       8.0,   # hit sanctions/PEP/adverse media qualifié
    "review_defavorable":  9.0,   # account review avec réserves
    "coc_sensible":        6.0,   # change of circumstances sensible
    "velocite_tx":         5.0,   # vélocité transactionnelle hors norme
}
POIDS_STATIQUE = {"pays_risque": 6.0, "structure_risque": 5.0,
                  "pep": 15.0, "secteur_risque": 4.0}

class CpsiError(Exception): pass

class OliveCpsiEngine:
    # `rejeu_leger` (optimisation RATIFIÉE PO 2026-07-28, jauge R250 à l'appui — 10k événements
    # = 159 s de rejeu quadratique) : en mode léger, les RECALCULS INTERMÉDIAIRES d'hydratation
    # (score_recalcule/bande_franchie/tâches à CHAQUE ingestion) sont sautés — ils n'alimentent
    # que le journal interne `events` et `taches`, qu'AUCUNE requête du pont ne lit ; toute
    # lecture (score, signaux, segmentation…) reste une fonction PURE de (statique, signaux ≤
    # as_of, config) — résultats BYTE-IDENTIQUES. Défaut False : le contrat direct-Python
    # (PC-01..06, pytest sur events/taches) est INCHANGÉ.
    def __init__(self, tenant_config=None, rejeu_leger=False):
        cfg = tenant_config or {}
        self._rejeu_leger = bool(rejeu_leger)
        self.half_life_jours = cfg.get("half_life_jours", 180)   # R64
        self.bandes = cfg.get("bandes", (40, 70))                # LOW < b0 ≤ MED < b1 ≤ HIGH
        self.k_segments = cfg.get("k_segments", 4)               # accepté (granularité future)
        self.seg_stat_seuils = cfg.get("seg_stat_seuils", (15, 30))   # R65 : grille statique B/M/H
        self.seg_comp_seuils = cfg.get("seg_comp_seuils", (8, 25))    # R65 : grille comportement
        self.poids_signaux = dict(POIDS_SIGNAUX, **cfg.get("poids_signaux", {}))
        self.poids_statique = dict(POIDS_STATIQUE, **cfg.get("poids_statique", {}))
        # R68 : la configuration de calcul est VERSIONNÉE par date de mise en
        # vigueur — le rejeu à date (R48) vaut aussi pour les règles de calcul.
        self._config_versions = [(datetime.min, {
            "poids_signaux": dict(self.poids_signaux),
            "poids_statique": dict(self.poids_statique),
            "half_life_jours": self.half_life_jours,
            "bandes": tuple(self.bandes),
            "seg_stat_seuils": tuple(self.seg_stat_seuils),
            "seg_comp_seuils": tuple(self.seg_comp_seuils),
        })]
        self.propositions = []   # R69 : propositions (IA ou humaines) en attente de décision
        self.groupes = {}        # R71 : groupes de population (cohortes paramétrables)
        self.scenarios = {}      # R73 : scénarios AML ciblés par groupe
        self.roles_insider = (cfg.get("roles_insider")
                              or {"COMPLIANCE", "CO_SR", "CO", "SO", "ADMIN", "CF"})  # R75
        self.cases = {}          # R76 : cases d'investigation issues des hits de scénarios
        self.clients = {}        # id -> {"statique": {...}, "signaux": [(at, type, sev, meta)]}
        self.events = []         # journal append-only (R49)
        self.taches = []         # tâches émises — JAMAIS d'effet de bord sur un dossier
        self._derniere_bande = {}
        self._dernier_segment = {}
        # R80 : alerte = signal scoré (impact + fréquence) franchissant un seuil X paramétrable
        self.seuil_alerte = cfg.get("seuil_alerte", 55)          # X — paramétrable (tenant/scénario)
        self.marge_near_miss = cfg.get("marge_near_miss", 10)    # bande "quasi-alerte" [X-marge, X)
        self.w_impact = cfg.get("w_impact", 0.6)
        self.w_freq = cfg.get("w_freq", 0.4)
        self._recur = {}     # (client, scénario) -> set d'horodatages de hit (mesure de fréquence)
        # R82 : rétroaction faux-positif (suppression apprenante), désactivable (paramètre tenant)
        self.fp_suppression_active = cfg.get("fp_suppression_active", True)
        self._fp = {}        # (client, scénario) -> nombre de faux positifs déclarés
        self.risk_cases = {}     # R83 : risk cases d'investigation animés par workflow
        self._rc_seq = 0

    # ---------- journal append-only ----------
    def _log(self, at, type, **payload):
        ev = {"seq": len(self.events) + 1, "at": at.isoformat(), "type": type, **payload}
        self.events.append(ev)
        return ev

    # ---------- référentiel ----------
    def enregistrer_client(self, cid, statique, at, attributs=None):
        if cid in self.clients:
            raise CpsiError(f"client {cid} déjà enregistré")
        self.clients[cid] = {"statique": dict(statique), "signaux": [],
                             "attributs": dict(attributs or {})}
        self._log(at, "client_enregistre", client=cid, statique=dict(statique))
        self._recalculer(cid, at)

    # ---------- R63 : ingestion événementielle ----------
    def ingester_signal(self, cid, type, severite, at, meta=None):
        if type not in self._cfg(at)["poids_signaux"]:
            raise CpsiError(f"type de signal inconnu : {type} (default-deny)")
        c = self.clients[cid]
        c["signaux"].append((at, type, float(severite), meta or {}))
        self._log(at, "signal_ingere", client=cid, signal=type, severite=severite,
                  **({"meta": meta} if meta else {}))
        return self._recalculer(cid, at)

    # ---------- R68 : configuration en vigueur à une date ----------
    def _cfg(self, at=None):
        if at is None:
            return self._config_versions[-1][1]
        eff = self._config_versions[0][1]
        for depuis, snap in self._config_versions:
            if depuis <= at:
                eff = snap
        return eff

    # ---------- calcul déterministe et rejouable (R48) ----------
    def _decay(self, age_jours, cfg):
        # R64 : half-life exponentielle — un signal vieux d'une demi-vie pèse moitié
        return math.pow(2.0, -max(age_jours, 0) / float(cfg["half_life_jours"]))

    def score_statique(self, cid, at=None, cfg=None):
        cfg = cfg or self._cfg(at)
        st = self.clients[cid]["statique"]
        drivers = []
        for k, w in cfg["poids_statique"].items():
            v = st.get(k, 0)
            contrib = w * (1.0 if v is True else 0.0 if v is False else float(v))
            if contrib:
                drivers.append((f"statique:{k}", round(contrib, 2)))
        return sum(d[1] for d in drivers), drivers

    def score_comportemental(self, cid, at, cfg=None):
        cfg = cfg or self._cfg(at)
        drivers = []
        for (t, type, sev, _meta) in self.clients[cid]["signaux"]:
            if t > at:
                continue                       # rejeu à date : le futur n'existe pas
            age = (at - t).days
            contrib = cfg["poids_signaux"][type] * sev * self._decay(age, cfg)
            if contrib > 0.05:
                drivers.append((f"{type}@J-{age}", round(contrib, 2)))
        return sum(d[1] for d in drivers), drivers

    def score_base(self, cid, at):
        """Score au barème GLOBAL — sert à l'appartenance aux groupes et évite la
        circularité (le groupe fixe le barème qui fixerait le score)."""
        cfg = self._cfg(at)
        s_st, _ = self.score_statique(cid, at, cfg)
        s_cp, _ = self.score_comportemental(cid, at, cfg)
        return min(100.0, round(s_st + s_cp, 2))

    def score_a_date(self, cid, at, cfg=None):
        """R48/R63/R68/R72 : fonction pure (statique, signaux ≤ at, barème). Barème =
        celui du groupe primaire du client s'il en surcharge un, sinon le global."""
        cfg = cfg or self._cfg_client(cid, at)
        s_st, d_st = self.score_statique(cid, at, cfg)
        s_cp, d_cp = self.score_comportemental(cid, at, cfg)
        score = min(100.0, round(s_st + s_cp, 2))
        return score, d_st + d_cp

    def bande(self, score, at=None, cfg=None):
        b0, b1 = (cfg or self._cfg(at))["bandes"]
        return "LOW" if score < b0 else ("MEDIUM" if score < b1 else "HIGH")

    def _recalculer(self, cid, at):
        if self._rejeu_leger:
            return None        # rejeu léger (ratifié) : la lecture recalcule PUREMENT à la demande
        score, drivers = self.score_a_date(cid, at)
        bande = self.bande(score)
        # R67 : les drivers accompagnent CHAQUE score publié
        self._log(at, "score_recalcule", client=cid, score=score, bande=bande,
                  drivers=drivers)
        avant = self._derniere_bande.get(cid)
        if avant is not None and bande != avant:
            # R66 : franchissement = événement + tâche + PROPOSITION — rien d'imposé
            self._log(at, "bande_franchie", client=cid, avant=avant, apres=bande,
                      score=score)
            self.taches.append(("revue_client", cid, bande))
            if bande == "HIGH":
                self._log(at, "aiguillage_propose", client=cid, workflow="EDD",
                          motif=f"score {score} ≥ bande HIGH — décision humaine requise (R44)")
                self.taches.append(("proposition_aiguillage", cid, "EDD"))
            elif avant == "HIGH":
                self._log(at, "aiguillage_propose", client=cid, workflow="CDD",
                          motif="sortie de bande HIGH — allègement proposé, décision humaine (R44)")
        self._derniere_bande[cid] = bande
        return score, bande, drivers

    # ---------- R65 : segmentation en groupes de pairs (grille déterministe) ----------
    # Choix méthodologique (auditabilité FINMA) : une grille quantile statique ×
    # comportement plutôt qu'un k-means — labels STABLES (pas de permutation),
    # segment explicable en une phrase, groupe de pairs = même bande statique.
    def _bandes_client(self, cid, at):
        cfg = self._cfg(at)
        s_st, _ = self.score_statique(cid, at, cfg)
        s_cp, _ = self.score_comportemental(cid, at, cfg)
        a, b = cfg["seg_stat_seuils"]
        stat_b = "B" if s_st < a else ("M" if s_st < b else "H")
        c, d = cfg["seg_comp_seuils"]
        comp_b = "CALME" if s_cp < c else ("ACTIF" if s_cp < d else "INTENSE")
        return stat_b, comp_b, s_st, s_cp

    def segmenter(self, at):
        ids = sorted(self.clients.keys())
        pairs = {}           # bande statique -> [(cid, s_cp)]
        result = {}
        for cid in ids:
            stat_b, comp_b, _s_st, s_cp = self._bandes_client(cid, at)
            seg = f"{stat_b}-{comp_b}"
            avant = self._dernier_segment.get(cid)
            if avant is None:
                self._log(at, "segment_affecte", client=cid, segment=seg)
            elif avant != seg:
                self._log(at, "segment_change", client=cid, avant=avant, apres=seg)
            self._dernier_segment[cid] = seg
            result[cid] = seg
            pairs.setdefault(stat_b, []).append((cid, s_cp))
        # Anomalie vs groupe de pairs (même bande statique) — MESURE sans coercition
        # (R39) : on signale et on crée une tâche, on n'altère JAMAIS le score.
        import math as _m
        for stat_b, mem in pairs.items():
            if len(mem) < 3:
                continue
            vals = [v for _c, v in mem]
            mu = sum(vals) / len(vals)
            sd = _m.sqrt(sum((v - mu) ** 2 for v in vals) / len(vals)) or 1.0
            for c, v in mem:
                z = (v - mu) / sd
                if z > 2.0:
                    self._log(at, "anomalie_pairs_signalee", client=c,
                              segment=self._dernier_segment[c], z=round(z, 2))
                    self.taches.append(("revue_anomalie", c, self._dernier_segment[c]))
        return result

    # ═══ R68 : paramètres transparents, en clair, versionnés ═══
    _CHEMINS = ("half_life_jours", "bandes", "seg_stat_seuils", "seg_comp_seuils")

    def _valider_chemin(self, chemin, cfg):
        if chemin in self._CHEMINS:
            return True
        for pref, table in (("poids_signaux.", "poids_signaux"),
                            ("poids_statique.", "poids_statique")):
            if chemin.startswith(pref) and chemin[len(pref):] in cfg[table]:
                return True
        raise CpsiError(f"paramètre inconnu : {chemin} (default-deny)")

    def _appliquer(self, snap, chemin, valeur):
        if "." in chemin:
            table, cle = chemin.split(".", 1)
            snap[table][cle] = float(valeur)
        else:
            snap[chemin] = tuple(valeur) if isinstance(valeur, (list, tuple)) else valeur
        return snap

    def modifier_parametre(self, chemin, valeur, acteur, at, note="", proposition=None):
        cfg = self._cfg()
        self._valider_chemin(chemin, cfg)
        avant = (cfg[chemin] if "." not in chemin
                 else cfg[chemin.split(".")[0]][chemin.split(".", 1)[1]])
        snap = self._appliquer(copy.deepcopy(cfg), chemin, valeur)
        self._config_versions.append((at, snap))
        self._log(at, "parametre_modifie", acteur=acteur, chemin=chemin,
                  avant=avant, apres=valeur, note=note,
                  **({"proposition": proposition} if proposition else {}))
        # le changement de règle recalcule la population — les franchissements
        # de bande qui en découlent suivent le régime normal R66 (tracés, proposés)
        for cid in sorted(self.clients):
            self._recalculer(cid, at)

    def decrire_regles(self, at=None):
        """R68 : les règles de calcul EN CLAIR — affichées à côté du paramétrage."""
        c = self._cfg(at)
        L = ["Score client = Statique + Comportemental, plafonné à 100.",
             "Comportemental = Σ signaux : poids(type) × sévérité × 2^(−âge / half-life).",
             f"Half-life : {c['half_life_jours']} jours — un signal vieux d'une demi-vie pèse moitié (R64)."]
        for k, w in sorted(c["poids_statique"].items()):
            L.append(f"Statique · {k} : poids {w}")
        for k, w in sorted(c["poids_signaux"].items()):
            L.append(f"Signal · {k} : poids {w}")
        b0, b1 = c["bandes"]
        L.append(f"Bandes : LOW < {b0} ≤ MEDIUM < {b1} ≤ HIGH — franchissement = événement + proposition (R66).")
        a, b = c["seg_stat_seuils"]; d0, d1 = c["seg_comp_seuils"]
        L.append(f"Segments : statique B<{a}≤M<{b}≤H × comportement CALME<{d0}≤ACTIF<{d1}≤INTENSE (R65).")
        L.append("Chaque score publie ses drivers ; leur somme reconstitue le score (R67).")
        return L

    # ═══ R70 : bac à sable — l'impact AVANT la décision, sans rien muter ═══
    def simuler_impact(self, changements, at, acteur="sandbox"):
        cfg_avant = self._cfg(at)
        cand = copy.deepcopy(cfg_avant)
        for chemin, valeur in changements.items():
            self._valider_chemin(chemin, cfg_avant)
            self._appliquer(cand, chemin, valeur)
        franchissements, deltas = [], []
        for cid in sorted(self.clients):
            s0, _ = self.score_a_date(cid, at, cfg_avant)
            s1, _ = self.score_a_date(cid, at, cand)
            b0, b1 = self.bande(s0, cfg=cfg_avant), self.bande(s1, cfg=cand)
            deltas.append(s1 - s0)
            if b0 != b1:
                franchissements.append({"client": cid, "avant": b0, "apres": b1,
                                        "score_avant": s0, "score_apres": s1})
        rapport = {"changements": dict(changements),
                   "clients_evalues": len(deltas),
                   "delta_moyen": round(sum(deltas) / len(deltas), 2) if deltas else 0.0,
                   "franchissements": franchissements,
                   "nouveaux_high": sum(1 for f in franchissements if f["apres"] == "HIGH"),
                   "charge_revues_induite": len(franchissements)}
        self._log(at, "impact_simule", acteur=acteur, changements=dict(changements),
                  clients=rapport["clients_evalues"],
                  franchissements=len(franchissements),
                  delta_moyen=rapport["delta_moyen"])
        return rapport

    # ═══ R69 : l'IA (ou un humain) PROPOSE — un humain DÉCIDE (R44) ═══
    def proposer_parametre(self, auteur, chemin, valeur, justification, at):
        self._valider_chemin(chemin, self._cfg())
        impact = self.simuler_impact({chemin: valeur}, at, acteur=auteur)
        prop = {"id": f"PROP-{len(self.propositions)+1}", "auteur": auteur,
                "chemin": chemin, "valeur": valeur, "justification": justification,
                "impact": impact, "statut": "EN_ATTENTE"}
        self.propositions.append(prop)
        self._log(at, "proposition_emise", acteur=auteur, proposition=prop["id"],
                  chemin=chemin, valeur=valeur, justification=justification,
                  franchissements=len(impact["franchissements"]))
        return prop

    def adopter_proposition(self, pid, humain, at):
        prop = next((p for p in self.propositions if p["id"] == pid), None)
        if prop is None or prop["statut"] != "EN_ATTENTE":
            raise CpsiError(f"proposition {pid} inconnue ou déjà décidée")
        prop["statut"] = "ADOPTEE"
        self._log(at, "proposition_adoptee", acteur=humain, proposition=pid,
                  chemin=prop["chemin"], valeur=prop["valeur"],
                  impact_franchissements=len(prop["impact"]["franchissements"]))
        self.modifier_parametre(prop["chemin"], prop["valeur"], humain, at,
                                note=f"adoption {pid} ({prop['auteur']})",
                                proposition=pid)
        return prop

    def rejeter_proposition(self, pid, humain, motivation, at):
        prop = next((p for p in self.propositions if p["id"] == pid), None)
        if prop is None or prop["statut"] != "EN_ATTENTE":
            raise CpsiError(f"proposition {pid} inconnue ou déjà décidée")
        if not motivation:
            raise CpsiError("R69 : le rejet d'une proposition exige une motivation")
        prop["statut"] = "REJETEE"
        self._log(at, "proposition_rejetee", acteur=humain, proposition=pid,
                  motivation=motivation)
        return prop

    # ═══ R71 : groupes de population (cohortes paramétrables) ═══
    _OPS = {
        "eq": lambda a, b: a == b, "ne": lambda a, b: a != b,
        "in": lambda a, b: a in b, "nin": lambda a, b: a not in b,
        "gte": lambda a, b: a is not None and a >= b,
        "lte": lambda a, b: a is not None and a <= b,
        "gt": lambda a, b: a is not None and a > b,
        "lt": lambda a, b: a is not None and a < b,
    }

    def definir_groupe(self, gid, label, predicat, at, priorite=100, bareme=None):
        """predicat = {"logique": "ET"|"OU", "conditions": [{champ, op, val}, ...]}.
        priorite : plus BAS = plus prioritaire pour l'appartenance exclusive (barème)."""
        if predicat.get("logique") not in ("ET", "OU"):
            raise CpsiError("logique de groupe invalide (ET|OU)")
        for c in predicat["conditions"]:
            if c["op"] not in self._OPS:
                raise CpsiError(f"opérateur inconnu : {c['op']} (default-deny)")
        self.groupes[gid] = {"id": gid, "label": label, "predicat": predicat,
                             "priorite": priorite, "bareme": bareme}
        self._log(at, "groupe_defini", groupe=gid, label=label,
                  priorite=priorite, a_bareme=bool(bareme))
        return self.groupes[gid]

    def _valeur_attribut(self, cid, champ, at):
        c = self.clients[cid]
        if champ in c["attributs"]:
            return c["attributs"][champ]
        if champ == "score":
            return self.score_base(cid, at)         # barème global : pas de circularité
        if champ == "bande":
            return self.bande(self.score_base(cid, at))
        if champ == "nb_alertes":
            return sum(1 for (t, ty, _s, _m) in c["signaux"]
                       if ty.startswith("alerte") and t <= at)
        if champ in c["statique"]:
            return c["statique"][champ]
        return None

    def _predicat_vrai(self, cid, predicat, at):
        res = []
        for c in predicat["conditions"]:
            v = self._valeur_attribut(cid, c["champ"], at)
            res.append(self._OPS[c["op"]](v, c["val"]))
        return all(res) if predicat["logique"] == "ET" else any(res)

    def groupes_de(self, cid, at):
        """Tous les groupes dont le client est membre (chevauchement autorisé)."""
        return [g for g in self.groupes.values()
                if self._predicat_vrai(cid, g["predicat"], at)]

    def groupe_primaire(self, cid, at):
        """Le groupe le plus prioritaire (priorite la plus basse) — barème exclusif."""
        membres = self.groupes_de(cid, at)
        if not membres:
            return None
        return sorted(membres, key=lambda g: (g["priorite"], g["id"]))[0]["id"]

    def membres(self, gid, at):
        return [cid for cid in sorted(self.clients)
                if self._predicat_vrai(cid, self.groupes[gid]["predicat"], at)]

    # ═══ R72 : barème par groupe (surcharge du barème global) ═══
    def _cfg_client(self, cid, at):
        base = copy.deepcopy(self._cfg(at))
        gid = self.groupe_primaire(cid, at)
        if gid and self.groupes[gid].get("bareme"):
            for k, v in self.groupes[gid]["bareme"].items():
                if isinstance(v, dict):
                    base[k] = dict(base[k], **v)
                else:
                    base[k] = tuple(v) if isinstance(v, (list, tuple)) else v
        return base

    def decrire_groupes(self, at):
        """R74 : les groupes en clair — prédicat, barème (hérité/surchargé), effectif."""
        out = []
        LIB = {"in": "∈", "nin": "∉", "eq": "=", "ne": "≠",
               "gte": "≥", "lte": "≤", "gt": ">", "lt": "<"}
        for g in sorted(self.groupes.values(), key=lambda x: (x["priorite"], x["id"])):
            conds = " {} ".format(g["predicat"]["logique"]).join(
                f"{c['champ']} {LIB[c['op']]} {c['val']}" for c in g["predicat"]["conditions"])
            out.append({"id": g["id"], "label": g["label"], "regle": conds,
                        "priorite": g["priorite"],
                        "bareme": "surchargé" if g["bareme"] else "hérité (global)",
                        "effectif": len(self.membres(g["id"], at))})
        return out

    # ═══ R73 : scénarios AML ciblés par groupe (périmètre + seuils par groupe) ═══
    def definir_scenario_aml(self, sid, label, champ, groupes_seuils, at, sens="gte"):
        """groupes_seuils = {gid: seuil} — le scénario ne s'évalue QUE sur les membres
        des groupes listés, avec le seuil PROPRE à chaque groupe (fine-tuning)."""
        for gid in groupes_seuils:
            if gid not in self.groupes:
                raise CpsiError(f"groupe cible inconnu : {gid}")
        if sens not in ("gte", "lte", "gt", "lt"):
            raise CpsiError(f"sens de seuil invalide : {sens}")
        self.scenarios[sid] = {"id": sid, "label": label, "champ": champ,
                               "groupes_seuils": dict(groupes_seuils), "sens": sens}
        self._log(at, "scenario_aml_defini", scenario=sid, label=label,
                  champ=champ, groupes=list(groupes_seuils))
        return self.scenarios[sid]

    def evaluer_scenario(self, sid, at):
        """Renvoie UNIQUEMENT les personnes concernées : membres des groupes ciblés
        dont l'attribut franchit le seuil de LEUR groupe. Ciblage = moins de faux positifs."""
        sc = self.scenarios[sid]
        op = self._OPS[sc["sens"]]
        hits, evalues = [], 0
        for gid, seuil in sc["groupes_seuils"].items():
            for cid in self.membres(gid, at):
                evalues += 1
                v = self._valeur_attribut(cid, sc["champ"], at)
                if op(v, seuil):
                    hits.append({"client": cid, "groupe": gid,
                                 "valeur": v, "seuil": seuil})
        self._log(at, "scenario_aml_evalue", scenario=sid,
                  evalues=evalues, hits=len(hits))
        return {"scenario": sid, "evalues": evalues, "hits": hits}

    # ═══ R75 : marquage insider (liste d'initiés surveillée, MAR) ═══
    # Statut sensible porté par le client : tracé (qui/quand/motif/instrument),
    # réservé aux rôles habilités, réversible avec motivation, append-only (R49).
    # Alimente les prédicats de groupe (R71) et le ciblage des scénarios (R73).
    def taguer_insider(self, cid, acteur, role, motif, at, instrument=None):
        if cid not in self.clients:
            raise CpsiError(f"client {cid} inconnu")
        if role not in self.roles_insider:
            raise CpsiError(f"rôle {role} non habilité au marquage insider (default-deny)")
        if not motif:
            raise CpsiError("R75 : le marquage insider exige un motif")
        self.clients[cid]["attributs"]["insider"] = True
        self._log(at, "insider_tague", client=cid, acteur=acteur, role=role,
                  motif=motif, instrument=instrument or "—")
        return self.clients[cid]["attributs"]["insider"]

    def lever_insider(self, cid, acteur, role, motif, at):
        if not self.clients.get(cid, {}).get("attributs", {}).get("insider"):
            raise CpsiError(f"client {cid} n'est pas marqué insider")
        if role not in self.roles_insider:
            raise CpsiError(f"rôle {role} non habilité (default-deny)")
        if not motif:
            raise CpsiError("R75 : la levée du statut insider exige une motivation")
        self.clients[cid]["attributs"]["insider"] = False
        self._log(at, "insider_leve", client=cid, acteur=acteur, role=role, motif=motif)
        return False

    # ═══ Registre des attributs : comment CHAQUE attribut surveillé est calculé (R79) ═══
    # Source de vérité unique — nature : "structurel" (fiche client) ou "calculé" (comportemental dérivé).
    ATTR_DEFS = {
        "type":            {"label": "Type d'entité", "domaine": "Profil", "nature": "structurel", "unite": "", "formule": "Type juridique du client (personne physique, société opérationnelle, holding, trust, fondation, fonds, family office). Issu de la fiche client."},
        "secteur":         {"label": "Secteur d'activité", "domaine": "Profil", "nature": "structurel", "unite": "", "formule": "Secteur économique du client. Issu de la fiche client."},
        "aum_band":        {"label": "Segment de fortune", "domaine": "Profil", "nature": "structurel", "unite": "", "formule": "Segment (Affluent / HNWI / UHNWI) déterminé par les avoirs sous gestion."},
        "countryCode":     {"label": "Pays", "domaine": "Profil", "nature": "structurel", "unite": "", "formule": "Pays de domicile / d'incorporation. Issu de la fiche client."},
        "pays_risque":     {"label": "Risque pays", "domaine": "Profil", "nature": "calculé", "unite": "0-3", "formule": "Niveau de risque de la juridiction (0 faible -> 3 élevé), issu de la table des pays à risque (FATF, listes SECO/UE)."},
        "pep":             {"label": "Statut PEP", "domaine": "Profil", "nature": "structurel", "unite": "booléen", "formule": "Personne politiquement exposée, statut porté par la personne (contamine le dossier seulement si KYC validé)."},
        "score":           {"label": "Score CPSI", "domaine": "Profil", "nature": "calculé", "unite": "0-100", "formule": "Score de risque perpétuel, composite pondéré pays / structure / PEP / secteur / comportement, avec demi-vie 180j (R63/R64)."},
        "risk_band":       {"label": "Bande de risque", "domaine": "Profil", "nature": "calculé", "unite": "LOW/MEDIUM/HIGH", "formule": "Classe de risque issue du score CPSI par grille de quantiles déterministe (R65)."},
        "asset_dominant":  {"label": "Classe d'actifs dominante", "domaine": "Trading & marchés", "nature": "calculé", "unite": "", "formule": "Classe d'actifs majoritaire du portefeuille (actions, obligations, crypto, penny stocks, produits structurés, matières premières, FX/dérivés, fonds/ETF)."},
        "ratio_cash":      {"label": "Part d'espèces", "domaine": "Cash & espèces", "nature": "calculé", "unite": "ratio 0-1", "formule": "Part des opérations en espèces sur le total. Amplifiée pour la distribution retail et le négoce de matières premières."},
        "cash_deposits":   {"label": "Dépôts espèces", "domaine": "Cash & espèces", "nature": "calculé", "unite": "nombre", "formule": "Nombre de dépôts en espèces sur la période. Base plus élevée pour retail / négoce."},
        "cash_withdrawals":{"label": "Retraits espèces", "domaine": "Cash & espèces", "nature": "calculé", "unite": "nombre", "formule": "Nombre de retraits en espèces sur la période."},
        "tx_par_mois":     {"label": "Transactions / mois", "domaine": "Activité transactionnelle", "nature": "calculé", "unite": "nombre/mois", "formule": "Fréquence transactionnelle mensuelle moyenne. Amplifiée x1.8 pour les profils de négoce et selon la fortune."},
        "volume_tx_mensuel_chf": {"label": "Volume mensuel", "domaine": "Activité transactionnelle", "nature": "calculé", "unite": "CHF", "formule": "Volume transactionnel mensuel en CHF (2 à 15 % des avoirs sous gestion)."},
        "rapidite_in_out": {"label": "Vélocité in/out", "domaine": "Activité transactionnelle", "nature": "calculé", "unite": "0-100", "formule": "Rapidité avec laquelle les fonds entrés ressortent (indice de pass-through / compte de passage)."},
        "score_structuration": {"label": "Score de structuration", "domaine": "Activité transactionnelle", "nature": "calculé", "unite": "0-100", "formule": "Indice de fractionnement d'opérations sous le seuil de déclaration. Amplifié pour les juridictions à risque."},
        "dormance_puis_actif": {"label": "Réveil de compte dormant", "domaine": "Activité transactionnelle", "nature": "calculé", "unite": "0/1", "formule": "1 si activité soudaine après une période de dormance, sinon 0."},
        "ratio_cross_border": {"label": "Part transfrontalière", "domaine": "Activité transactionnelle", "nature": "calculé", "unite": "ratio 0-1", "formule": "Part des flux transfrontaliers. Amplifiée pour les juridictions à risque."},
        "wires_third_party": {"label": "Virements tiers", "domaine": "Transferts & transfer agent", "nature": "calculé", "unite": "nombre", "formule": "Nombre de virements impliquant un tiers non titulaire. Pondéré à la hausse pour les juridictions à risque."},
        "wires_same_day_inout": {"label": "Aller-retours même jour", "domaine": "Transferts & transfer agent", "nature": "calculé", "unite": "nombre", "formule": "Nombre de couples entrée/sortie de fonds le jour même (indice de pass-through)."},
        "wires_high_risk_jur": {"label": "Virements juridictions à risque", "domaine": "Transferts & transfer agent", "nature": "calculé", "unite": "nombre", "formule": "Nombre de virements vers/depuis des juridictions à haut risque."},
        "wires_structured": {"label": "Virements structurés", "domaine": "Transferts & transfer agent", "nature": "calculé", "unite": "nombre", "formule": "Nombre de virements structurés (fractionnés sous seuil de déclaration)."},
        "funnel_sources":  {"label": "Sources convergentes", "domaine": "Transferts & transfer agent", "nature": "calculé", "unite": "nombre", "formule": "Nombre de sources de fonds distinctes convergeant vers le compte (funnel account)."},
        "reglements_tiers":{"label": "Règlements pour tiers", "domaine": "Transferts & transfer agent", "nature": "calculé", "unite": "nombre", "formule": "Nombre de règlements effectués pour le compte de tiers."},
        "fop_deliveries":  {"label": "Livraisons FOP", "domaine": "Transferts & transfer agent", "nature": "calculé", "unite": "nombre", "formule": "Livraisons de titres franco de paiement (free of payment), sans contrepartie cash. Base plus élevée en custody."},
        "transferts_in_specie": {"label": "Transferts en nature", "domaine": "Transferts & transfer agent", "nature": "calculé", "unite": "nombre", "formule": "Transferts de titres en nature (in specie)."},
        "rotation_titres": {"label": "Rotation titres", "domaine": "Transferts & transfer agent", "nature": "calculé", "unite": "ratio", "formule": "Taux de rotation du portefeuille titres (turnover). Base plus élevée en custody."},
        "illiquid_ratio":  {"label": "Part illiquide", "domaine": "Trading & marchés", "nature": "calculé", "unite": "ratio 0-1", "formule": "Part d'actifs illiquides dans le portefeuille."},
        "churn_ratio":     {"label": "Ratio de barattage", "domaine": "Trading & marchés", "nature": "calculé", "unite": "ratio", "formule": "Barattage (churning) : rotation excessive génératrice de frais."},
        "cross_trades_related": {"label": "Cross trades liés", "domaine": "Trading & marchés", "nature": "calculé", "unite": "nombre", "formule": "Nombre de cross trades entre parties liées."},
        "off_market_trades": {"label": "Transactions hors marché", "domaine": "Trading & marchés", "nature": "calculé", "unite": "nombre", "formule": "Nombre de transactions hors marché (de gré à gré)."},
        "capital_calls":   {"label": "Appels de capital", "domaine": "Capital markets / CIB", "nature": "calculé", "unite": "nombre", "formule": "Nombre d'appels de capital. Base plus élevée pour private equity et asset management."},
        "private_placements": {"label": "Placements privés", "domaine": "Capital markets / CIB", "nature": "calculé", "unite": "nombre", "formule": "Nombre de placements privés souscrits. Base plus élevée en private equity."},
        "ipo_flows":       {"label": "Flux IPO / pre-IPO", "domaine": "Capital markets / CIB", "nature": "calculé", "unite": "nombre", "formule": "Flux liés aux IPO / pré-IPO (souscriptions inhabituelles). Base plus élevée pour finance et technologie."},
        "unlisted_investments": {"label": "Investissements non cotés", "domaine": "Capital markets / CIB", "nature": "calculé", "unite": "nombre", "formule": "Nombre d'investissements en titres non cotés. Base plus élevée pour private equity et holdings."},
        "trades_pre_annonce": {"label": "Trades avant annonce", "domaine": "Abus de marché", "nature": "calculé", "unite": "nombre", "formule": "Transactions effectuées juste avant une annonce de marché (proxy d'opération d'initié)."},
        "ratio_annulation_ordres": {"label": "Taux d'annulation d'ordres", "domaine": "Abus de marché", "nature": "calculé", "unite": "ratio 0-1", "formule": "Proxy de spoofing / layering : part des ordres annulés."},
        "wash_trade_flags": {"label": "Signaux wash trading", "domaine": "Abus de marché", "nature": "calculé", "unite": "nombre", "formule": "Achats/ventes simultanés du même instrument sans transfert de risque."},
        "concentration_intraday": {"label": "Concentration intraday", "domaine": "Abus de marché", "nature": "calculé", "unite": "ratio 0-1", "formule": "Part du volume d'une journée concentrée sur un seul instrument (indice de manipulation / marking the close)."},
        "marking_close_flags": {"label": "Marking the close", "domaine": "Abus de marché", "nature": "calculé", "unite": "nombre", "formule": "Transactions en clôture manipulant le cours de référence."},
        "pump_dump_score": {"label": "Score pump & dump", "domaine": "Abus de marché", "nature": "calculé", "unite": "0-100", "formule": "Composite : part illiquide + barattage + concentration intraday + vélocité, amplifié pour les classes illiquides (crypto x1.6, penny stocks x1.7, structurés x1.35)."},
        "insider":         {"label": "Statut initié (MAR)", "domaine": "Abus de marché", "nature": "structurel", "unite": "booléen", "formule": "Le client figure-t-il sur la liste d'initiés surveillés (R75) ? Statut tracé, réservé, réversible."},
    }

    # ═══ Catalogue de conformité : paramètres EXACTS de chaque scénario, lecture seule (R79) ═══
    # Pour chaque scénario : attribut surveillé + son mode de calcul, opérateur, seuils PAR groupe, groupes cibles.
    def catalogue_conformite(self, at):
        OPSYM = {"gte": "≥", "lte": "≤", "gt": ">", "lt": "<", "eq": "=", "ne": "≠", "in": "∈", "nin": "∉"}
        out = []
        for sid, sc in self.scenarios.items():
            champ = sc["champ"]
            adef = self.ATTR_DEFS.get(champ, {"label": champ, "domaine": "—", "nature": "?",
                                              "unite": "", "formule": "(attribut non documenté)"})
            out.append({"id": sid, "label": sc["label"], "domaine": adef["domaine"],
                        "champ": champ, "champ_label": adef["label"], "champ_formule": adef["formule"],
                        "champ_unite": adef.get("unite", ""), "champ_nature": adef.get("nature", ""),
                        "sens": sc["sens"], "operateur": OPSYM.get(sc["sens"], sc["sens"]),
                        "seuils": dict(sc["groupes_seuils"]), "groupes": list(sc["groupes_seuils"].keys())})
        return out

    # ═══ Référentiel : alertes générées PAR scénario (une ligne par scénario) ═══
    # Retour : { sid: {label, champ, domaine, groupes, total, high, medium} }.
    def alertes_par_scenario(self, at, scenarios=None):
        sids = scenarios if scenarios is not None else list(self.scenarios)
        ref = {}
        for sid in sids:
            sc = self.scenarios.get(sid)
            if not sc:
                continue
            r = self.evaluer_scenario(sid, at)
            high = medium = 0
            for h in r["hits"]:
                dep = (h["valeur"] - h["seuil"]) if isinstance(h["valeur"], (int, float)) else 0
                if dep >= max(1, 0.5 * h["seuil"]):
                    high += 1
                else:
                    medium += 1
            ref[sid] = {"label": sc.get("label", sid), "champ": sc["champ"],
                        "domaine": sc.get("fam", ""), "groupes": list(sc["groupes_seuils"].keys()),
                        "total": len(r["hits"]), "high": high, "medium": medium}
        return ref

    # ═══ R80 : signaux scorés (impact + fréquence) + porte de seuil X ═══
    def _impact(self, v, s):
        """Ampleur du franchissement, bornée 0-100. Booléen vrai = 100."""
        if isinstance(v, bool):
            return 100 if v else 0
        if isinstance(v, (int, float)) and isinstance(s, (int, float)) and s:
            return max(0, min(100, round(100 * (v - s) / abs(s))))
        return 50

    def penalite_fp(self, client, scenario):
        """R82 : pénalité cumulée = -(10*1 + ... + 10*n) pour n faux positifs déclarés."""
        n = self._fp.get((client, scenario), 0)
        return -10 * n * (n + 1) // 2

    def signaux(self, at, seuil_alerte=None):
        """R80/R81 : UN signal dédupliqué par (client, scénario), scoré (impact+fréquence),
        classé ALERTE / NEAR_MISS / ANALYSE selon le seuil X. Aucune mutation de dossier (R66)."""
        X = self.seuil_alerte if seuil_alerte is None else seuil_alerte
        stamp = at.isoformat() if hasattr(at, "isoformat") else str(at)
        # 1) dédup R81 : agrège par (client, scénario), garde l'impact max sur les groupes
        agg = {}
        for sid in self.scenarios:
            for h in self.evaluer_scenario(sid, at)["hits"]:
                key = (h["client"], sid)
                imp = self._impact(h["valeur"], h["seuil"])
                cur = agg.get(key)
                if cur is None or imp > cur["impact"]:
                    agg[key] = {"impact": imp, "groupe": h["groupe"]}
        # 2) scoring + porte de seuil
        out = []
        for (client, sid), a in agg.items():
            self._recur.setdefault((client, sid), set()).add(stamp)
            freq = min(100, 25 * len(self._recur[(client, sid)]))
            brut = round(self.w_impact * a["impact"] + self.w_freq * freq)
            penal = self.penalite_fp(client, sid) if self.fp_suppression_active else 0
            score = max(0, brut + penal)
            statut = ("ALERTE" if score >= X
                      else "NEAR_MISS" if score >= X - self.marge_near_miss
                      else "ANALYSE")
            out.append({"client": client, "scenario": sid, "groupe": a["groupe"],
                        "impact": a["impact"], "frequence": freq, "score_brut": brut,
                        "penalite_fp": penal, "score": score, "seuil": X, "statut": statut})
        out.sort(key=lambda s: (-s["score"], s["client"], s["scenario"]))
        return out

    def alertes(self, at, seuil_alerte=None):
        return [s for s in self.signaux(at, seuil_alerte) if s["statut"] == "ALERTE"]

    def analyses(self, at, seuil_alerte=None):
        """Signaux qui n'ont PAS abouti à une alerte (near-miss inclus). 'Presque alerte' = near-miss."""
        return [s for s in self.signaux(at, seuil_alerte) if s["statut"] != "ALERTE"]

    # ═══ R81 : corrélation — un même client touché par ≥2 scénarios (phénomène commun) ═══
    def correlations(self, at, seuil_alerte=None):
        par_client = {}
        for s in self.alertes(at, seuil_alerte):
            par_client.setdefault(s["client"], set()).add(s["scenario"])
        return {c: sorted(sc) for c, sc in par_client.items() if len(sc) >= 2}

    # ═══ R82 : rétroaction faux-positif — pénalité escaladante, désactivable, tracée ═══
    def declarer_faux_positif(self, client, scenario, acteur, at):
        key = (client, scenario)
        self._fp[key] = self._fp.get(key, 0) + 1
        n = self._fp[key]
        increment, cumul = -10 * n, self.penalite_fp(client, scenario)
        self._log(at, "faux_positif_declare", client=client, scenario=scenario, acteur=acteur,
                  occurrence=n, increment=increment, penalite_cumulee=cumul,
                  applique=self.fp_suppression_active)
        return {"client": client, "scenario": scenario, "occurrence": n,
                "increment": increment, "penalite_cumulee": cumul, "applique": self.fp_suppression_active}

    def set_fp_suppression(self, active, at, acteur="ADMIN"):
        self.fp_suppression_active = bool(active)
        self._log(at, "fp_suppression_config", actif=self.fp_suppression_active, acteur=acteur)
        return self.fp_suppression_active

    # ═══ R83 : Risk case d'investigation animé par un workflow ═══
    # États et transitions. Clore / escalader / demander une clarification exigent un motif (R7).
    CASE_WF = {
        "NOUVELLE":      {"prendre_en_charge": "EN_ANALYSE"},
        "EN_ANALYSE":    {"demander_clarification": "CLARIFICATION", "clore": "CLOTUREE", "escalader": "ESCALADEE"},
        "CLARIFICATION": {"reprendre": "EN_ANALYSE", "clore": "CLOTUREE"},
        "CLOTUREE":      {},
        "ESCALADEE":     {},
    }
    CASE_MOTIF_REQUIS = {"clore", "escalader", "demander_clarification"}
    CASE_TERMINAL = {"CLOTUREE", "ESCALADEE"}

    def ouvrir_risk_case(self, alertes, acteur, at):
        """alertes = [{client, scenario}, ...] — regroupe des alertes (corrélées) en UN case (R81/R83)."""
        if not alertes:
            raise CpsiError("un risk case exige au moins une alerte")
        client = alertes[0]["client"]
        if any(a["client"] != client for a in alertes):
            raise CpsiError("un risk case regroupe les alertes d'un SEUL client")
        self._rc_seq += 1
        cid = "RC-%04d" % self._rc_seq
        case = {"id": cid, "client": client,
                "scenarios": sorted({a["scenario"] for a in alertes}),
                "etat": "NOUVELLE", "owner": acteur,
                "cree_le": at.isoformat(), "notes": [], "history": []}
        case["history"].append({"action": "ouverture", "acteur": acteur, "at": at.isoformat(),
                                "de": None, "vers": "NOUVELLE", "motif": None})
        self.risk_cases[cid] = case
        self._log(at, "risk_case_ouvert", case=cid, client=client, scenarios=case["scenarios"], acteur=acteur)
        return case

    def transition_risk_case(self, cid, action, acteur, at, motif=None):
        case = self.risk_cases.get(cid)
        if not case:
            raise CpsiError("risk case inconnu : %s" % cid)
        trans = self.CASE_WF.get(case["etat"], {})
        if action not in trans:
            raise CpsiError("transition « %s » impossible depuis l'état %s" % (action, case["etat"]))
        if action in self.CASE_MOTIF_REQUIS and not (motif and str(motif).strip()):
            raise CpsiError("un motif est obligatoire pour « %s » (R7)" % action)
        avant = case["etat"]
        case["etat"] = trans[action]
        case["history"].append({"action": action, "acteur": acteur, "at": at.isoformat(),
                                "de": avant, "vers": case["etat"], "motif": motif})
        self._log(at, "risk_case_transition", case=cid, action=action, de=avant, vers=case["etat"],
                  acteur=acteur, motif=motif)
        return case

    def documenter_risk_case(self, cid, acteur, note, at):
        """Documentation de l'analyse — APPEND ONLY (R48/R49)."""
        case = self.risk_cases.get(cid)
        if not case:
            raise CpsiError("risk case inconnu : %s" % cid)
        if not (note and str(note).strip()):
            raise CpsiError("note vide")
        entree = {"acteur": acteur, "note": note, "at": at.isoformat()}
        case["notes"].append(entree)
        self._log(at, "risk_case_note", case=cid, acteur=acteur)
        return entree

    # ═══ Point 4 : reporting & délai de traitement (hit → SAR/MROS) — application R39/R48 ═══
    def delai_case(self, cid):
        """Délai en jours entre l'ouverture du case et sa transition terminale (escalade/clôture).
        Rejoué depuis l'historique tracé (R48/R49). None si le case n'est pas terminal."""
        case = self.risk_cases.get(cid)
        if not case:
            raise CpsiError("risk case inconnu : %s" % cid)
        if case["etat"] not in self.CASE_TERMINAL:
            return None
        from datetime import datetime
        ouv = next((h for h in case["history"] if h["action"] == "ouverture"), None)
        term = next((h for h in reversed(case["history"]) if h["vers"] in self.CASE_TERMINAL), None)
        if not ouv or not term:
            return None
        return (datetime.fromisoformat(term["at"]) - datetime.fromisoformat(ouv["at"])).days

    def reporting_cases(self, sla_jours=30):
        """Synthèse reporting : cases par état + délais des escalades (hit → SAR/MROS).
        Mesure et notifie les dépassements de SLA, sans bloquer (R39)."""
        par_etat, escalades = {}, []
        for cid, c in self.risk_cases.items():
            par_etat[c["etat"]] = par_etat.get(c["etat"], 0) + 1
            if c["etat"] == "ESCALADEE":
                d = self.delai_case(cid)
                escalades.append({"case": cid, "client": c["client"], "delai": d,
                                  "hors_sla": (d is not None and d > sla_jours)})
        delais = [e["delai"] for e in escalades if e["delai"] is not None]
        return {"par_etat": par_etat, "escalades": escalades, "sla_jours": sla_jours,
                "delai_moyen": (sum(delais) / len(delais)) if delais else None,
                "delai_max": max(delais) if delais else None,
                "hors_sla": sum(1 for e in escalades if e["hors_sla"])}

    # ═══ Bac à sable AML : simulation dry-run de la bibliothèque (application R70) ═══
    # Projette les alertes/cases SANS muter l'état (ni self.cases, ni les scénarios).
    # facteur : multiplie tous les seuils (facteur<1 = plus sensible = plus d'alertes).
    def simuler_scenarios(self, at, facteur=1.0, scenarios=None):
        cases_avant = len(self.cases)
        sids = scenarios if scenarios is not None else list(self.scenarios)
        total, par_scenario, par_sev = 0, {}, {"HIGH": 0, "MEDIUM": 0}
        for sid in sids:
            sc = self.scenarios.get(sid)
            if not sc:
                continue
            seuils = sc["groupes_seuils"]
            projete = {gid: (s * facteur) for gid, s in seuils.items()}
            orig = sc["groupes_seuils"]
            sc["groupes_seuils"] = projete
            try:
                r = self.evaluer_scenario(sid, at)
            finally:
                sc["groupes_seuils"] = orig            # restauration : aucune mutation
            n = len(r["hits"])
            par_scenario[sid] = n
            total += n
            for h in r["hits"]:
                dep = (h["valeur"] - h["seuil"]) if isinstance(h["valeur"], (int, float)) else 0
                par_sev["HIGH" if dep >= max(1, 0.5 * h["seuil"]) else "MEDIUM"] += 1
        assert len(self.cases) == cases_avant           # invariant : dry-run, rien créé
        return {"total": total, "par_scenario": par_scenario, "par_severite": par_sev}

    def est_insider(self, cid):
        return bool(self.clients.get(cid, {}).get("attributs", {}).get("insider"))

    def liste_inities(self):
        return sorted(cid for cid in self.clients if self.est_insider(cid))

    # ═══ R76 : un hit de scénario devient une alerte/case tracée alimentant le workflow ═══
    # Rien par effet de bord (R66) : chaque hit ouvre une case tracée (statut, assignation,
    # escalade). La clôture exige un motif ; l'escalade vers revue KYC / annonce MROS est une
    # décision humaine (R44). Idempotent : un même (scénario, client) ne rouvre pas de doublon.
    def generer_cases(self, at, scenarios=None):
        sids = scenarios if scenarios is not None else list(self.scenarios)
        ouvertes = []
        for sid in sids:
            r = self.evaluer_scenario(sid, at)
            for h in r["hits"]:
                cid = f"CASE:{sid}:{h['client']}"
                if cid in self.cases:
                    continue                      # pas de doublon (idempotent)
                depassement = (h["valeur"] - h["seuil"]) if isinstance(h["valeur"], (int, float)) else 0
                sev = "HIGH" if depassement >= max(1, 0.5 * h["seuil"]) else "MEDIUM"
                self.cases[cid] = {"id": cid, "scenario": sid, "client": h["client"],
                                   "groupe": h["groupe"], "valeur": h["valeur"],
                                   "seuil": h["seuil"], "severite": sev,
                                   "statut": "NOUVELLE", "assignee": None, "decisions": []}
                self._log(at, "case_ouverte", case=cid, scenario=sid,
                          client=h["client"], groupe=h["groupe"], severite=sev)
                ouvertes.append(self.cases[cid])
        return ouvertes

    _CASE_ACTIONS = {
        "CLOTURER": ("CLOTUREE", True),      # faux positif — motif obligatoire
        "ESCALADER": ("ESCALADEE", False),   # EDD / MROS
        "REVISION_KYC": ("KYC_DECLENCHE", False),
        "DEMANDE_INFO": ("INFO_DEMANDEE", False),
        "ASSIGNER": (None, False),
    }
    def decider_case(self, case_id, action, acteur, at, motif=None, assignee=None):
        c = self.cases.get(case_id)
        if not c:
            raise CpsiError(f"case {case_id} inconnue")
        if action not in self._CASE_ACTIONS:
            raise CpsiError(f"action inconnue : {action} (default-deny)")
        nouveau_statut, motif_requis = self._CASE_ACTIONS[action]
        if motif_requis and not motif:
            raise CpsiError(f"R76 : l'action {action} exige un motif")
        if action == "ASSIGNER":
            c["assignee"] = assignee
        elif nouveau_statut:
            c["statut"] = nouveau_statut
        c["decisions"].append({"action": action, "acteur": acteur,
                               "motif": motif, "at": at.isoformat()})
        self._log(at, "case_decidee", case=case_id, action=action,
                  acteur=acteur, statut=c["statut"],
                  **({"motif": motif} if motif else {}))
        return c
