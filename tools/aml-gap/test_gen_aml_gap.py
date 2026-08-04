#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_gen_aml_gap.py — invariants du générateur AML Gap Wave 1 (source de vérité).

Autonome (aucune dépendance, pas de Postgres/Redis) : régénère en mémoire et vérifie les
invariants ratifiés. Rouge = régression. Aligne l'esprit des harnais canon-master / registrar.

    python3 tools/aml-gap/test_gen_aml_gap.py
"""

import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gen_aml_gap as G  # noqa: E402

FAILS = []


def check(name, cond, detail=""):
    if cond:
        print("  ✓ %s" % name)
    else:
        print("  ✗ %s  %s" % (name, detail))
        FAILS.append(name)


def main():
    rules, gt = G.build()

    # AG-01 — 64 règles contiguës R340..R403 (Waves 1+2), une par scénario, ordre stable par ruleRef.
    refs = [r["ruleRef"] for r in rules]
    expected = ["R%d" % n for n in range(340, 404)]
    check("AG-01 64 règles contiguës R340–R403 (Waves 1+2), triées",
          refs == expected, "refs=%s" % refs)

    # AG-02 — 12 familles (7 Wave 1 + 5 Wave 2), comptes attendus par famille.
    fam_expected = {"SF": 7, "QO": 5, "GU": 4, "IP": 7, "CR": 6, "FT": 5, "GV": 4,
                    "TB": 8, "CB": 7, "PF": 3, "IA": 3, "AN": 5}
    fam_seen = {}
    for r in rules:
        fam_seen[r["famille"]] = fam_seen.get(r["famille"], 0) + 1
    check("AG-02 12 familles (SF/QO/GU/IP/CR/FT/GV + TB/CB/PF/IA/AN) aux effectifs de la spec",
          fam_seen == fam_expected, "seen=%s" % fam_seen)

    # AG-03 — ids scénario uniques et bien formés (XX-NN).
    ids = [r["id"] for r in rules]
    check("AG-03 ids scénario uniques et bien formés (XX-NN)",
          len(set(ids)) == 64 and all(re.match(r"^[A-Z]{2}-\d{2}$", i) for i in ids),
          "ids=%s" % ids)

    # AG-04 — corpus GT : 130 cas, 66 TP / 64 FP (Waves 1+2).
    tp = [c for c in gt if c["label"] == "TP"]
    fp = [c for c in gt if c["label"] == "FP"]
    check("AG-04 130 cas GT = 66 TP / 64 FP",
          len(gt) == 130 and len(tp) == 66 and len(fp) == 64,
          "gt=%d tp=%d fp=%d" % (len(gt), len(tp), len(fp)))

    # AG-05 — chaque règle a >= 1 TP et >= 1 FP (TP et FP déclenchent : corpus de recall).
    by_rule = {}
    for c in gt:
        by_rule.setdefault(c["ruleRef"], {"TP": 0, "FP": 0})[c["label"]] += 1
    missing = [ref for ref in expected if by_rule.get(ref, {}).get("TP", 0) < 1
               or by_rule.get(ref, {}).get("FP", 0) < 1]
    check("AG-05 chaque règle a >= 1 TP et >= 1 FP", not missing, "manque=%s" % missing)

    # AG-06 — caseId uniques + rattachés à une règle existante.
    case_ids = [c["caseId"] for c in gt]
    refset = set(expected)
    check("AG-06 caseId uniques, rattachés à une règle R340–R403",
          len(set(case_ids)) == 130 and all(c["ruleRef"] in refset for c in gt),
          "uniq=%d" % len(set(case_ids)))

    # AG-07 — 8 règles BLOQUANTES = 6 Wave 1 + R390 (shell bank) + R393 (sanctions sectorielles).
    blocking = sorted(r["ruleRef"] for r in rules if r["blocking"])
    check("AG-07 8 bloquantes = {R344,R346,R363,R365,R367,R373,R390,R393}",
          blocking == ["R344", "R346", "R363", "R365", "R367", "R373", "R390", "R393"], "bloc=%s" % blocking)

    # AG-08 — niveau cohérent : détection ∈ {1,2} ; campagnes/ops de gouvernance = None sauf R376 (N1).
    bad = []
    for r in rules:
        if r["kind"] == "detection" and r["niveau"] not in (1, 2):
            bad.append((r["ruleRef"], r["niveau"]))
        if r["kind"] == "campagne" and r["niveau"] is not None:
            bad.append((r["ruleRef"], r["niveau"]))
    check("AG-08 niveau cohérent (détection 1/2 ; campagne None)", not bad, "bad=%s" % bad)

    # AG-09 — chaque règle porte >= 1 paramètre tenant (registre R-Q) avec key/label/default.
    bad = [r["ruleRef"] for r in rules
           if not r["params"] or not all(set(p) >= {"key", "label", "default"} for p in r["params"])]
    check("AG-09 chaque règle a >= 1 paramètre R-Q bien formé", not bad, "bad=%s" % bad)
    # clés de paramètres globalement uniques (pas de collision de registre R-Q entre règles)
    pkeys = [p["key"] for r in rules for p in r["params"]]
    check("AG-09b clés de paramètres R-Q uniques (aucune collision de registre)",
          len(pkeys) == len(set(pkeys)),
          "dups=%s" % sorted({k for k in pkeys if pkeys.count(k) > 1}))

    # AG-10 — chaque Gherkin a given/when/then non vides.
    bad = [r["ruleRef"] for r in rules
           if not all(r["gherkin"].get(k, "").strip() for k in ("given", "when", "then"))]
    check("AG-10 Gherkin given/when/then non vides", not bad, "bad=%s" % bad)

    # AG-11 — FP portent une cause d'écartement documentée SAUF le placeholder unique laissé vide
    #          par la spec (R377/GV-04) — never invent : compté, jamais comblé.
    placeholders = [c for c in fp if c.get("placeholder")]
    fp_documented = [c for c in fp if not c.get("placeholder")]
    check("AG-11 exactement 1 FP placeholder (R377 GV-04, spec « — — — » vide)",
          len(placeholders) == 1 and placeholders[0]["ruleRef"] == "R377"
          and placeholders[0]["narrative"] == "",
          "ph=%s" % [(c["ruleRef"], c["caseId"]) for c in placeholders])
    # ecartement = enrichissement de l'émetteur porté sur la Wave 1 (les narratifs Wave 2, dérivés
    # du canon PO plus mince, portent la cause dans le narratif lui-même — pas de champ séparé).
    fp_w1 = [c for c in fp_documented if c["ruleRef"] <= "R377"]
    check("AG-11b tout FP Wave 1 non-placeholder a une cause d'écartement documentée",
          all(c.get("ecartement", "").strip() for c in fp_w1),
          "sans_ecartement=%s" % [c["caseId"] for c in fp_w1 if not c.get("ecartement")])

    # AG-12 — TP concrets portent un payload synthétique déterministe ; placeholder n'en a pas.
    tp_no_payload = [c["caseId"] for c in tp if "payload" not in c]
    ph_with_payload = [c["caseId"] for c in placeholders if "payload" in c]
    check("AG-12 TP => payload synthétique ; placeholder => aucun payload",
          not tp_no_payload and not ph_with_payload,
          "tp_sans=%s ph_avec=%s" % (tp_no_payload, ph_with_payload))

    # AG-13 — déterminisme : deux builds successifs produisent des artefacts identiques.
    r2, g2 = G.build()
    check("AG-13 générateur déterministe (build reproductible)",
          json.dumps([rules, gt], ensure_ascii=False, sort_keys=True)
          == json.dumps([r2, g2], ensure_ascii=False, sort_keys=True))

    # AG-14 — les artefacts sur disque sont à jour (générateur exécuté = pas de dérive).
    for fname, key in (("aml-gap-rules.json", "rules"), ("aml-gap-dataset-gt.json", "cases")):
        path = os.path.join(HERE, fname)
        on_disk = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else None
        fresh = {"rules": rules, "cases": gt}[key]
        check("AG-14 %s à jour (aucune dérive vs générateur)" % fname,
              on_disk is not None and on_disk.get(key) == fresh,
              "régénérez : python3 tools/aml-gap/gen_aml_gap.py")

    # AG-15 — artefacts TS backend à jour (le générateur alimente aussi apps/api).
    api_dir = os.path.normpath(os.path.join(HERE, "..", "..", "apps", "api", "src", "modules", "aml"))

    def _embedded_json(path, marker):
        if not os.path.exists(path):
            return None
        txt = open(path, encoding="utf-8").read()
        i = txt.find(marker + ":")  # la déclaration `export const <marker>: <Type>[] = [...]`
        if i < 0:
            return None
        start = txt.index("[", txt.index("=", i))  # 1er « [ » après le « = », pas le [] du type
        depth = 0                                    # « ] » appariée par comptage (arrays imbriqués : params)
        for j in range(start, len(txt)):
            if txt[j] == "[":
                depth += 1
            elif txt[j] == "]":
                depth -= 1
                if depth == 0:
                    return json.loads(txt[start:j + 1])
        return None

    ref_ts = _embedded_json(os.path.join(api_dir, "aml-gap.referentiel.gen.ts"), "AML_GAP_REFERENTIEL")
    gt_ts = _embedded_json(os.path.join(api_dir, "aml-gap.gt.gen.ts"), "AML_GAP_GT")
    check("AG-15 aml-gap.referentiel.gen.ts à jour (aucune dérive)", ref_ts == rules,
          "régénérez : python3 tools/aml-gap/gen_aml_gap.py")
    check("AG-15 aml-gap.gt.gen.ts à jour (aucune dérive)", gt_ts == gt,
          "régénérez : python3 tools/aml-gap/gen_aml_gap.py")

    # AG-16 — seed front (web) présent et cohérent (64 scénarios + 130 cas GT, Waves 1+2).
    web_dir = os.path.normpath(os.path.join(HERE, "..", "..", "apps", "web", "src", "features", "aml"))
    web_path = os.path.join(web_dir, "aml-gap.seed.gen.ts")
    scen_seed = _embedded_json(web_path, "AML_GAP_SCENARIOS")
    gt_seed = _embedded_json(web_path, "AML_GAP_GT_SEED")
    check("AG-16 seed front à jour (64 scénarios + 130 cas GT)",
          scen_seed is not None and len(scen_seed) == 64 and gt_seed is not None and len(gt_seed) == 130,
          "régénérez : python3 tools/aml-gap/gen_aml_gap.py")

    # AG-17 — parité avec le canon PO (source de vérité ratifiée data/aml-gap-dataset-gt.json,
    # générée par tools/gen_aml_gap.py). L'émetteur Nest/React couvre désormais Waves 1+2 : Wave 1
    # transcrite (BLOCS), Wave 2 DÉRIVÉE du canon. La parité porte sur les 130 cas (scénario/label/
    # narratif). Enrichissements de l'émetteur (ecartement, payloads) hors comparaison. Divergence
    # documentée : GV-04/FP = placeholder vide côté émetteur (« ») et « — » au canon.
    po_path = os.path.normpath(os.path.join(HERE, "..", "..", "data", "aml-gap-dataset-gt.json"))
    if os.path.exists(po_path):
        po_all = json.load(open(po_path, encoding="utf-8"))["cases"]
        norm = lambda n: n if n else "—"  # noqa: E731
        mine_key = sorted((c["scenarioId"], c["label"], norm(c["narrative"])) for c in gt)
        po_key = sorted((c["scenarioId"], c["label"], c["narrative"]) for c in po_all)
        check("AG-17 parité canon PO (Waves 1+2) : mêmes 130 cas GT (scénario/label/narratif)",
              mine_key == po_key,
              "l'émetteur diverge du canon data/aml-gap-dataset-gt.json — réconcilier via le générateur PO")
        check("AG-17b parité canon PO (Waves 1+2) : mêmes règles R340–R403",
              sorted({c["ruleRef"] for c in gt}) == sorted({c["rule"] for c in po_all}),
              "jeu de règles divergent du canon PO")
    else:
        check("AG-17 canon PO présent (data/aml-gap-dataset-gt.json)", False,
              "verser le canon PO pour activer la parité")

    # AG-18 — le générateur PO (tools/gen_aml_gap.py) est runnable in-repo et le corpus versé ne
    # dérive pas (« brancher la ré-émission dans le pipeline », journal action 6). On régénère et on
    # exige que data/aml-gap-dataset-gt.json soit inchangé (déterministe ⇒ no-drift).
    import subprocess
    root = os.path.normpath(os.path.join(HERE, "..", ".."))
    po_gen = os.path.join(root, "tools", "gen_aml_gap.py")
    ds_committed = os.path.join(root, "data", "aml-gap-dataset-gt.json")
    if os.path.exists(po_gen) and os.path.exists(ds_committed):
        before = open(ds_committed, encoding="utf-8").read()
        r = subprocess.run([sys.executable, po_gen], cwd=root, capture_output=True, text=True)
        after = open(ds_committed, encoding="utf-8").read()
        check("AG-18 générateur PO runnable + corpus stable (no-drift)",
              r.returncode == 0 and before == after,
              "régénérez : python3 tools/gen_aml_gap.py (et committez si intentionnel)")
    else:
        check("AG-18 générateur PO présent (tools/gen_aml_gap.py)", False, "verser le générateur PO")

    # AG-19 — registre R-Q émis (action 5) : 80 paramètres tenant des 64 règles, étalables dans
    # REGISTRE_RQ. Chaque entrée bien formée (cle/type/regle Rxx/requis/défaut) ; les `tenant`
    # sont requis + json + exemple (pas de défaut silencieux ⇒ bonType passe à l'écriture du test).
    rq_ts = os.path.join(HERE, "..", "..", "apps", "api", "src", "modules", "parametres",
                         "aml-gap.rq.gen.ts")
    if os.path.exists(rq_ts):
        src = open(rq_ts, encoding="utf-8").read()
        arr = json.loads(src[src.index("= [") + 2: src.rindex("]") + 1])
        expected = [p["key"] for r in rules for p in r["params"]]
        wellformed = all(e.get("cle") and e.get("type") in {"int", "bool", "json", "string"}
                         and "defaut" in e and re.match(r"^R\d+", e.get("regle", ""))
                         and isinstance(e.get("requis"), bool) for e in arr)
        tenant_ok = all(e["requis"] and e["type"] == "json" and "exemple" in e
                        for e in arr if e["defaut"] is None)
        cles = [e["cle"] for e in arr]
        check("AG-19 registre R-Q émis : 80 paramètres bien formés, clés uniques, `tenant` requis",
              len(arr) == 80 and len(arr) == len(expected) and len(cles) == len(set(cles))
              and wellformed and tenant_ok,
              "n=%d attendu=%d uniq=%s wf=%s tenant=%s"
              % (len(arr), len(expected), len(cles) == len(set(cles)), wellformed, tenant_ok))
    else:
        check("AG-19 registre R-Q présent (aml-gap.rq.gen.ts)", False,
              "régénérez : python3 tools/aml-gap/gen_aml_gap.py")

    # AG-20 — métadonnées moteur émises (src/aml/aml-gap.meta.gen.ts) : 64 scénarios, bloc 61
    # (Analytique 2G, AN-*) marqué deferred (détecteur CPSI Python, jamais Nest), niveau None → 0.
    meta_ts = os.path.join(HERE, "..", "..", "src", "aml", "aml-gap.meta.gen.ts")
    if os.path.exists(meta_ts):
        src = open(meta_ts, encoding="utf-8").read()
        meta = json.loads(src[src.index("= {") + 2: src.rindex("}") + 1])
        deferred = sorted(k for k, v in meta.items() if v["deferred"])
        campagnes = [r["id"] for r in rules if r["niveau"] is None]
        niveau0_ok = all(meta[i]["niveau"] == 0 for i in campagnes)
        num_ok = all(isinstance(v["niveau"], int) and isinstance(v["blocking"], bool)
                     and v["ruleRef"] and v["params"] is not None for v in meta.values())
        check("AG-20 méta moteur : 64 scénarios, bloc 61 (AN-*) deferred CPSI, niveau campagne → 0",
              len(meta) == 64 and deferred == ["AN-01", "AN-02", "AN-03", "AN-04", "AN-05"]
              and niveau0_ok and num_ok,
              "n=%d deferred=%s niveau0=%s wf=%s" % (len(meta), deferred, niveau0_ok, num_ok))
    else:
        check("AG-20 méta moteur présente (aml-gap.meta.gen.ts)", False,
              "régénérez : python3 tools/aml-gap/gen_aml_gap.py")

    total = 14 + 3 + 2 + 1 + 2 + 1 + 1 + 1  # + AG-16 + AG-17/17b + AG-18 + AG-19 + AG-20
    passed = total - len(FAILS)
    print("\n### %d/%d invariants AML Gap verts ###" % (passed, total))
    if FAILS:
        sys.exit(1)


if __name__ == "__main__":
    main()
