#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Garde de la codification métier (V2-M15). Bloquante en CI.

Deux natures de vérification :
  · FRAÎCHEUR — le fichier généré est-il celui que le générateur produit aujourd'hui ? Une
    règle ajoutée à une source sans régénération rend ce test rouge (même doctrine que
    test_gen_aml_gap.py) ;
  · INVARIANTS — unicité, format, couverture, et surtout la STABILITÉ des codes déjà
    attribués : un code qui change de règle rendrait faux tout rapport antérieur.

Lancement : python3 tools/codification/test_gen_codification.py
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
import gen_codification as gen  # noqa: E402

ROOT = gen.ROOT
ECHOUES = []


def verifier(nom, condition, detail=""):
    if condition:
        print(f"  ✓ {nom}")
    else:
        ECHOUES.append(f"{nom} — {detail}")
        print(f"  ✗ {nom} — {detail}")


def charge_genere():
    s = open(gen.SORTIE, encoding="utf-8").read()
    return json.loads(gen._tableau_ts(s, "CODIFICATION: RegleCodifiee[] = "))


# ── Ancrage de stabilité : ces codes sont ATTRIBUÉS et ne doivent plus bouger. ──
# Toute modification volontaire d'une de ces lignes est un acte tracé (commit motivé), jamais
# un effet de bord d'une régénération.
ANCRES = {
    "TX-SEN01": "R189", "TX-SEN04": "R192", "TX-SEN18": "R206",
    "SF-SEN01": "R340", "GV-SEN04": "R377", "AN-SEN05": "R403",
    "CIB-SEN01": "R71-R76", "ABUS-SEN07": "R71-R76",
    "ISLAMIC-SEN01": "R207", "ISLAMIC-SEN02": "R208", "ISLAMIC-SEN15": "R221",
}


def main():
    print("Codification métier des règles (V2-M15) :")
    attendu = gen.codifier()
    obtenu = charge_genere()

    verifier("fraîcheur : le fichier généré correspond aux sources",
             attendu == obtenu,
             f"{len(attendu)} règles calculées vs {len(obtenu)} dans le fichier — relancer le générateur")

    codes = [r["code"] for r in obtenu]
    verifier("unicité : aucun code attribué deux fois",
             len(set(codes)) == len(codes),
             "codes en double : " + ", ".join(sorted({c for c in codes if codes.count(c) > 1})))

    mauvais = [c for c in codes if not re.fullmatch(r"[A-Z]{2,7}-SEN\d{2}", c)]
    verifier("format : FAMILLE-SENnn sur deux chiffres", not mauvais, ", ".join(mauvais[:5]))

    familles_declarees = {c for c, _, _ in gen.FAMILLES}
    familles_vues = {r["famille"] for r in obtenu}
    verifier("familles : toutes déclarées, aucune orpheline",
             familles_vues <= familles_declarees,
             "non déclarées : " + ", ".join(sorted(familles_vues - familles_declarees)))

    vides = [c for c in familles_declarees if c not in familles_vues]
    verifier("familles : aucune déclarée à vide", not vides,
             "familles sans règle : " + ", ".join(sorted(vides)))

    # La numérotation d'une famille est contiguë et part de 01 : un trou signale une règle
    # perdue en route (le cas exact que ce lot corrige pour la cartographie).
    trous = []
    for fam in sorted(familles_vues):
        nums = sorted(int(r["code"].split("-SEN")[1]) for r in obtenu if r["famille"] == fam)
        if nums != list(range(1, len(nums) + 1)):
            trous.append(fam)
    verifier("numérotation : contiguë depuis 01 dans chaque famille", not trous,
             "familles trouées : " + ", ".join(trous))

    par_code = {r["code"]: r for r in obtenu}
    derives = [f"{c} → {par_code[c]['ref']} (attendu {ref})"
               for c, ref in ANCRES.items() if c in par_code and par_code[c]["ref"] != ref]
    absents = [c for c in ANCRES if c not in par_code]
    verifier("stabilité : les codes ancrés désignent toujours la même règle",
             not derives and not absents,
             "; ".join(derives + [f"{c} disparu" for c in absents]))

    # L'identifiant moteur est la clé persistée : il doit rester unique et non vide.
    moteurs = [r["idMoteur"] for r in obtenu]
    verifier("identifiants moteur : uniques et non vides",
             all(moteurs) and len(set(moteurs)) == len(moteurs),
             "doublons : " + ", ".join(sorted({m for m in moteurs if moteurs.count(m) > 1})))

    # Vérité sur le statut : la bibliothèque CPSI n'est pas un référentiel moteur (E-AML-2).
    cpsi = [r for r in obtenu if r["source"] == "biblio-cpsi"]
    verifier("source : les 31 scénarios CPSI restent marqués « biblio-cpsi »",
             len(cpsi) == 31, f"{len(cpsi)} trouvés")

    print(f"\n### {len(obtenu)} règles · {len(familles_vues)} familles · "
          f"{'TOUT VERT' if not ECHOUES else str(len(ECHOUES)) + ' ÉCHEC(S)'} ###")
    return 1 if ECHOUES else 0


if __name__ == "__main__":
    sys.exit(main())
