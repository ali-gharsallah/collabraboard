# -*- coding: utf-8 -*-
import sys, importlib, inspect, traceback
sys.path.insert(0, ".")
mods = [("CPSI bloc 1 — R63..R67 (PS-01..05 · SG-01..03 · BD-01..02)", "tests.test_cpsi_bloc1"),
        ("CPSI bloc 2 — R68..R70 (PT-01..03 · IA-01..02 · ST-01..03)", "tests.test_cpsi_bloc2"),
        ("CPSI bloc 3 — R71..R74 (GP-01..05 · BG-01..03 · SC-01..03)", "tests.test_cpsi_bloc3"),
        ("CPSI bloc 4 — bibliothèque étendue (TX-01..02 · CU-01..02 · MA-01..02 · SPEC-01)", "tests.test_cpsi_bloc4"),
        ("CPSI bloc 5 — R75 marquage insider (IN-01..06)", "tests.test_cpsi_bloc5"),
        ("CPSI bloc 6 — R76 cases + familles transferts/post-marché (CASE-01..04 · TR-01 · PM-01)", "tests.test_cpsi_bloc6"),
        ("CPSI bloc 7 — pump & dump par classe d actifs (PD-01..03)", "tests.test_cpsi_bloc7"),
        ("CPSI bloc 8 — domaines cash & capital markets (CASH-01..02 · CIB-01..02)", "tests.test_cpsi_bloc8"),
        ("CPSI bloc 9 — bac a sable AML : simulation dry-run (SIM-01..03)", "tests.test_cpsi_bloc9"),
        ("CPSI bloc 10 — referentiel : alertes par scenario (REF-01..02)", "tests.test_cpsi_bloc10"),
        ("CPSI bloc 11 — catalogue de conformite : parametres exacts + calcul attributs (CAT-01..03)", "tests.test_cpsi_bloc11"),
        ("CPSI bloc 12 — R80 score+seuil X, R81 dedup/correlation (SCO-01..03, COR-01)", "tests.test_cpsi_bloc12"),
        ("CPSI bloc 13 — R82 retroaction faux-positif escaladante desactivable (FP-01..04)", "tests.test_cpsi_bloc13"),
        ("CPSI bloc 14 — R83 risk case anime par workflow (RC-01..05)", "tests.test_cpsi_bloc14"),
        ("CPSI bloc 15 — reporting & delai hit -> SAR/MROS (RP-01..04)", "tests.test_cpsi_bloc15"),
        ("CPSI bloc 16 — R84 edition exclusive du dossier KYC / la main (CK-01..05)", "tests.test_cpsi_bloc16"),
        ("CPSI bloc 17 — R85 passage de main entre validateurs / Next step / Revenir (HM-01..06)", "tests.test_cpsi_bloc17"),
        ("CPSI bloc 18 — R86 visa qualifie / verdict OK-CONDITIONAL-NOK + message (VQ-01..06)", "tests.test_cpsi_bloc18"),
        ("CPSI bloc 19 — PC-20 equivalence permanente des chemins d hydratation (R324 dormant)", "tests.test_cpsi_bloc19"),
        ("CPSI bloc 20 — Analytique 2G AML gap (R399..R403 · AN-01..05, jamais en Nest)", "tests.test_cpsi_bloc20")]
total_ok = 0
for label, modname in mods:
    print(f"=== {label} ===")
    m = importlib.import_module(modname)
    fixtures = {n: f for n, f in vars(m).items() if getattr(f, "_is_fixture", False)}
    ok = ko = 0
    for n, f in vars(m).items():
        if not n.startswith("test_"): continue
        try:
            kwargs = {}
            for p in inspect.signature(f).parameters:
                if p in fixtures: kwargs[p] = fixtures[p]()
            f(**kwargs)
            print(f"  PASS  {n}"); ok += 1
        except Exception:
            print(f"  FAIL  {n}"); traceback.print_exc(limit=3); ko += 1
    print(f"\n{ok} passés, {ko} échoués / {ok+ko}\n")
    if ko == 0: total_ok += 1
print(f"### {total_ok}/{len(mods)} suites vertes ###")
