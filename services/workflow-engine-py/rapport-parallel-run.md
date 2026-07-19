# Rapport quotidien — parallel run (démo sans intégration)

Commandes rejouées : 13 — divergences : 4
Parcours propres consécutifs : 0

## 🔴 Bugs de l'engine actuel révélés par le catalogue
- seq 8 · DECISION · cmd `refuser` Identification — maître={'ok': True, 'regle': None, 'msg': None} | ombre={'ok': False, 'regle': 'R7', 'msg': "[R7] Le refus d'un visa exige une motivation obligatoire"} — le maître accepte un refus sans motivation — R7 le proscrit

## 📜 Règles implicites → à ajouter au catalogue
- seq 4 · DECISION · cmd `accorder` Identification — maître={'ok': False, 'regle': 'R1', 'msg': '[R1] legacy : aucun document rattaché à la section'} | ombre={'ok': True, 'regle': None, 'msg': None} — le maître exige au moins un document rattaché avant tout visa
- seq 9 · DECISION · cmd `accorder` Identification — maître={'ok': False, 'regle': 'R1', 'msg': '[R1] legacy : aucun document rattaché à la section'} | ombre={'ok': True, 'regle': None, 'msg': None} — le maître exige au moins un document rattaché avant tout visa
- seq 13 · DECISION · cmd `accorder` Identification — maître={'ok': False, 'regle': 'R1', 'msg': '[R1] legacy : aucun document rattaché à la section'} | ombre={'ok': True, 'regle': None, 'msg': None} — le maître exige au moins un document rattaché avant tout visa
