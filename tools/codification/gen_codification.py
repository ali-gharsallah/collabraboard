#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Générateur de la CODIFICATION MÉTIER des règles de détection (V2-M15).

Demande PO du 11.08.2026 : « une codification de règle en adéquation avec la famille de
règle — CIB-SEN1, ISLAMIC-SEN2 ». Le code porte donc la famille métier, pas le bloc
d'implémentation.

TROIS IDENTIFIANTS, JAMAIS UN SEUL :
  · `ref`      — le numéro R (R189, R340, R207…). CANON ratifié (namespace R1→R417), seule
                 référence normative. La codification ne le remplace NI ne le renumérote.
  · `idMoteur` — l'identifiant que le moteur utilise et que la base PERSISTE
                 (`aml_gap_signals.scenarioCode` = "SF-01", scénarios CPSI = "SCN-STRUCT",
                 détecteurs transactionnels = "STRUCTURING"). Intouchable : le renommer
                 casserait les signaux déjà écrits (R49 — le journal ne se réécrit pas).
  · `code`     — NOUVEAU. Code métier lisible `FAMILLE-SENnn`, ajouté par-dessus. Sert aux
                 humains : écrans, rapports, échanges avec le régulateur, cahiers de recette.

RÈGLES DE LA CODIFICATION (invariants gardés par test_gen_codification.py) :
  1. Un code est IMMUABLE une fois attribué. Une règle retirée garde son numéro ; le numéro
     n'est JAMAIS réattribué à une autre règle — sinon un rapport ancien devient faux.
  2. La numérotation suit l'ordre de la source, par famille, à partir de 01. Deux chiffres :
     aucune famille ne dépasse 99 règles aujourd'hui, et le tri alphabétique reste correct.
  3. Le code ne porte AUCUNE sémantique au-delà de la famille : ni sévérité, ni statut, ni
     ordre d'exécution. Ces informations vivent dans le référentiel, pas dans l'identifiant.

Sortie : apps/api/src/modules/aml/codification.gen.ts — NE PAS ÉDITER À LA MAIN.
"""
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
API_AML = os.path.join(ROOT, "apps", "api", "src", "modules", "aml")
ENGINE_TX = os.path.join(API_AML, "aml-scoring.engine.ts")
REF_GAP = os.path.join(API_AML, "aml-gap.referentiel.gen.ts")
ENGINE_ISL = os.path.join(ROOT, "apps", "api", "src", "modules", "islamic", "islamic-screening.engine.ts")
LIB_CPSI = os.path.join(ROOT, "apps", "web", "src", "parity", "cpsi-data-support.ts")
SORTIE = os.path.join(API_AML, "codification.gen.ts")

# ── Familles métier : code → (libellé, source). L'ordre fixe l'ordre d'émission. ──
FAMILLES = [
    ("TX", "Surveillance transactionnelle", "moteur"),
    ("SF", "Screening en flux", "moteur"),
    ("QO", "Indices OBA-FINMA", "moteur"),
    ("GU", "Vision groupe UBO", "moteur"),
    ("IP", "Instruments PB", "moteur"),
    ("CR", "Crypto / VASP", "moteur"),
    ("FT", "CFT", "moteur"),
    ("GV", "Gouvernance du dispositif", "moteur"),
    ("TB", "TBML", "moteur"),
    ("CB", "Correspondent Banking", "moteur"),
    ("PF", "Prolifération", "moteur"),
    ("IA", "Immobilier & Art", "moteur"),
    ("AN", "Analytique 2G", "moteur"),
    ("CASH", "Cash & espèces", "biblio-cpsi"),
    ("TRF", "Transferts & transfer agent", "biblio-cpsi"),
    ("ACT", "Activité transactionnelle", "biblio-cpsi"),
    ("TRAD", "Trading & marchés", "biblio-cpsi"),
    ("CIB", "Capital markets / CIB", "biblio-cpsi"),
    ("ABUS", "Abus de marché", "biblio-cpsi"),
    ("ISLAMIC", "Conformité Shariah", "moteur"),
]
LIB_FAM = {c: (l, s) for c, l, s in FAMILLES}

# Domaine de la bibliothèque CPSI (champ `fam`) → famille métier.
CPSI_FAM = {
    "Cash & espèces": "CASH", "Transferts & transfer agent": "TRF",
    "Activité transactionnelle": "ACT", "Trading & marchés": "TRAD",
    "Capital markets / CIB": "CIB", "Abus de marché": "ABUS",
}


def _tableau_ts(texte, ancre):
    """Extrait le littéral tableau qui suit `ancre`, en ignorant les crochets des chaînes."""
    debut = texte.index("[", texte.index(ancre) + len(ancre))
    prof, chaine, echap = 0, False, False
    for i in range(debut, len(texte)):
        c = texte[i]
        if chaine:
            if echap:
                echap = False
            elif c == "\\":
                echap = True
            elif c == '"':
                chaine = False
            continue
        if c == '"':
            chaine = True
        elif c == "[":
            prof += 1
        elif c == "]":
            prof -= 1
            if prof == 0:
                return texte[debut:i + 1]
    raise ValueError("tableau non refermé après " + ancre)


def lire_tx():
    s = open(ENGINE_TX, encoding="utf-8").read()
    lignes = re.findall(
        r'\{ regle: "(R\d+)", type: "([A-Z_]+)", niveau: (\d), libelle: "([^"]+)"', s)
    return [{"famille": "TX", "ref": r, "idMoteur": t, "niveau": int(n), "titre": lib}
            for r, t, n, lib in lignes]


def lire_gap():
    s = open(REF_GAP, encoding="utf-8").read()
    arr = json.loads(_tableau_ts(s, "AmlGapRule[] = "))
    return [{"famille": r["famille"], "ref": r["ruleRef"], "idMoteur": r["id"],
             "niveau": r["niveau"], "titre": r["titre"]} for r in arr]


def lire_cpsi():
    s = open(LIB_CPSI, encoding="utf-8").read()
    pat = re.compile(
        r'\{\s*id:\s*"(SCN-[\w-]+)",\s*fam:\s*"([^"]+)",\s*label:\s*"([^"]+)"', re.S)
    out = []
    for m in pat.finditer(s):
        fam = CPSI_FAM.get(m.group(2))
        if fam is None:
            raise SystemExit(f"domaine CPSI inconnu : {m.group(2)} — ajouter à CPSI_FAM")
        out.append({"famille": fam, "ref": "R71-R76", "idMoteur": m.group(1),
                    "niveau": 2, "titre": m.group(3)})
    return out


def lire_islamic():
    s = open(ENGINE_ISL, encoding="utf-8").read()
    titres = {}
    for m in re.finditer(r"// (R2[0-2][0-9]) — (.+)", s):
        ref, titre = m.group(1), m.group(2).strip()
        if len(titre) > len(titres.get(ref, "")):
            titres[ref] = titre
    return [{"famille": "ISLAMIC", "ref": ref, "idMoteur": ref, "niveau": 1 if ref == "R209" else 2,
             "titre": titres[ref]} for ref in sorted(titres)]


def codifier():
    regles = lire_tx() + lire_gap() + lire_cpsi() + lire_islamic()
    compteur, out = {}, []
    for fam_code, _, _ in FAMILLES:
        for r in [x for x in regles if x["famille"] == fam_code]:
            compteur[fam_code] = compteur.get(fam_code, 0) + 1
            libelle, source = LIB_FAM[fam_code]
            out.append({"code": f"{fam_code}-SEN{compteur[fam_code]:02d}", "famille": fam_code,
                        "familleLabel": libelle, "source": source, "ref": r["ref"],
                        "idMoteur": r["idMoteur"], "niveau": r["niveau"], "titre": r["titre"]})
    inconnues = {r["famille"] for r in regles} - set(LIB_FAM)
    if inconnues:
        raise SystemExit("familles non déclarées : " + ", ".join(sorted(inconnues)))
    return out


ENTETE = '''// GÉNÉRÉ par tools/codification/gen_codification.py — NE PAS ÉDITER À LA MAIN.
// Codification MÉTIER des règles de détection (V2-M15, demande PO du 11.08.2026) : le code
// porte la FAMILLE (CIB-SEN01, ISLAMIC-SEN02…), pas le bloc d'implémentation.
//
// Le code s'AJOUTE, il ne remplace rien :
//   · `ref`      = le numéro R — canon ratifié, seule référence normative ;
//   · `idMoteur` = l'identifiant persisté en base (aml_gap_signals.scenarioCode, scénarios
//                  CPSI, types de détecteurs) — intouchable, le renommer casserait les
//                  signaux déjà écrits (R49) ;
//   · `code`     = le code métier lisible, pour les écrans, rapports et échanges régulateur.
//
// Un code est IMMUABLE une fois attribué ; une règle retirée garde son numéro et celui-ci
// n'est jamais réattribué — sinon un rapport ancien devient faux.

export type SourceRegle = "moteur" | "biblio-cpsi";

export interface RegleCodifiee {
  code: string;          // FAMILLE-SENnn — code métier, immuable
  famille: string;       // code de famille (TX, CIB, ISLAMIC…)
  familleLabel: string;  // libellé lisible de la famille
  source: SourceRegle;   // "biblio-cpsi" = bibliothèque du front, PAS encore un référentiel moteur
  ref: string;           // numéro R du canon — référence normative
  idMoteur: string;      // identifiant persisté par le moteur — ne jamais renommer
  niveau: number;        // 1 = sévère · 2 = signal
  titre: string;
}

'''


def main():
    regles = codifier()
    corps = json.dumps(regles, ensure_ascii=False, indent=2)
    with open(SORTIE, "w", encoding="utf-8") as f:
        f.write(ENTETE + "export const CODIFICATION: RegleCodifiee[] = " + corps + ";\n")
    familles = {}
    for r in regles:
        familles[r["famille"]] = familles.get(r["famille"], 0) + 1
    print(f"{len(regles)} règles codifiées dans {len(familles)} familles → {os.path.relpath(SORTIE, ROOT)}")
    for c, _, _ in FAMILLES:
        print(f"  {c:8} {familles.get(c, 0):3}  {LIB_FAM[c][0]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
