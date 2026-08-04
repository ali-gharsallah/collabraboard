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

    # AG-01 — 38 règles contiguës R340..R377, une par scénario, ordre stable par ruleRef.
    refs = [r["ruleRef"] for r in rules]
    expected = ["R%d" % n for n in range(340, 378)]
    check("AG-01 38 règles contiguës R340–R377 (identité step-0), triées",
          refs == expected, "refs=%s" % refs)

    # AG-02 — familles = 7 blocs, comptes attendus par famille.
    fam_expected = {"SF": 7, "QO": 5, "GU": 4, "IP": 7, "CR": 6, "FT": 5, "GV": 4}
    fam_seen = {}
    for r in rules:
        fam_seen[r["famille"]] = fam_seen.get(r["famille"], 0) + 1
    check("AG-02 7 familles SF/QO/GU/IP/CR/FT/GV aux effectifs de la spec",
          fam_seen == fam_expected, "seen=%s" % fam_seen)

    # AG-03 — ids scénario uniques et bien formés (XX-NN).
    ids = [r["id"] for r in rules]
    check("AG-03 ids scénario uniques et bien formés (XX-NN)",
          len(set(ids)) == 38 and all(re.match(r"^[A-Z]{2}-\d{2}$", i) for i in ids),
          "ids=%s" % ids)

    # AG-04 — corpus GT : 78 cas, 40 TP / 38 FP (contrat de l'en-tête de spec).
    tp = [c for c in gt if c["label"] == "TP"]
    fp = [c for c in gt if c["label"] == "FP"]
    check("AG-04 78 cas GT = 40 TP / 38 FP",
          len(gt) == 78 and len(tp) == 40 and len(fp) == 38,
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
    check("AG-06 caseId uniques, rattachés à une règle R340–R377",
          len(set(case_ids)) == 78 and all(c["ruleRef"] in refset for c in gt),
          "uniq=%d" % len(set(case_ids)))

    # AG-07 — exactement 6 règles BLOQUANTES = liste §1.2 (R344,R346,R363,R365,R367,R373).
    blocking = sorted(r["ruleRef"] for r in rules if r["blocking"])
    check("AG-07 6 bloquantes = {R344,R346,R363,R365,R367,R373}",
          blocking == ["R344", "R346", "R363", "R365", "R367", "R373"], "bloc=%s" % blocking)

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
    check("AG-11b tout FP non-placeholder a une cause d'écartement documentée",
          all(c.get("ecartement", "").strip() for c in fp_documented),
          "sans_ecartement=%s" % [c["caseId"] for c in fp_documented if not c.get("ecartement")])

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

    # AG-16 — seed front (web) présent et cohérent (38 scénarios + 78 cas GT).
    web_dir = os.path.normpath(os.path.join(HERE, "..", "..", "apps", "web", "src", "features", "aml"))
    web_path = os.path.join(web_dir, "aml-gap.seed.gen.ts")
    scen_seed = _embedded_json(web_path, "AML_GAP_SCENARIOS")
    gt_seed = _embedded_json(web_path, "AML_GAP_GT_SEED")
    check("AG-16 seed front à jour (38 scénarios + 78 cas GT)",
          scen_seed is not None and len(scen_seed) == 38 and gt_seed is not None and len(gt_seed) == 78,
          "régénérez : python3 tools/aml-gap/gen_aml_gap.py")

    # AG-17 — parité avec le canon PO (source de vérité ratifiée data/aml-gap-dataset-gt.json,
    # générée par tools/gen_aml_gap.py). L'émetteur Nest/React (ce fichier) doit rester en phase
    # avec la tranche Wave 1 du canon : mêmes règles, mêmes cas GT (narratifs). Les enrichissements
    # propres à l'émetteur (ecartement, payloads) ne sont pas dans le canon — hors comparaison.
    # Divergence documentée : GV-04/FP est un placeholder vide côté émetteur (« ») et « — » au canon.
    po_path = os.path.normpath(os.path.join(HERE, "..", "..", "data", "aml-gap-dataset-gt.json"))
    if os.path.exists(po_path):
        po_all = json.load(open(po_path, encoding="utf-8"))["cases"]
        po_w1 = [c for c in po_all if c["rule"] <= "R377"]
        norm = lambda n: n if n else "—"  # noqa: E731
        mine_key = sorted((c["scenarioId"], c["label"], norm(c["narrative"])) for c in gt)
        po_key = sorted((c["scenarioId"], c["label"], c["narrative"]) for c in po_w1)
        check("AG-17 parité canon PO (Wave 1) : mêmes cas GT (scénario/label/narratif)",
              mine_key == po_key,
              "l'émetteur diverge du canon data/aml-gap-dataset-gt.json — réconcilier via le générateur PO")
        check("AG-17b parité canon PO (Wave 1) : mêmes règles R340–R377",
              sorted({c["ruleRef"] for c in gt}) == sorted({c["rule"] for c in po_w1}),
              "jeu de règles divergent du canon PO")
    else:
        check("AG-17 canon PO présent (data/aml-gap-dataset-gt.json)", False,
              "verser le canon PO pour activer la parité")

    total = 14 + 3 + 2 + 1 + 2  # + AG-16 + AG-17/AG-17b
    passed = total - len(FAILS)
    print("\n### %d/%d invariants AML Gap verts ###" % (passed, total))
    if FAILS:
        sys.exit(1)


if __name__ == "__main__":
    main()
