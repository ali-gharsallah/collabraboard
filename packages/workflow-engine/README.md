> ⚠️ **PORT GELÉ (ADR-14).** Le moteur de référence est
> `services/workflow-engine-py` (65 scénarios verts, 7/7 blocs). Ce port JS
> (blocs 1-2) ne sert que d'embarqué navigateur pour démos ; il ne progresse
> que scénario par scénario sur besoin explicite.

# @olive/workflow-engine — spécification exécutable
Contrat : `spec/catalogue-v2-inventaire.md` (source normative : OLive-Specifications-Moteur-Workflow-v2).
Méthode : chaque scénario Gherkin = un test node:test écrit AVANT le code. Un bloc
est terminé quand 100% de ses scénarios passent.

## État
| Bloc | Scénarios | Verts |
|---|---|---|
| 1. Visa 4-yeux (R1–R15) | V-01…V-17 | **17/17 ✅** |
| 2. Dossier (R16–R23) | D-01…D-09 | **9/9 ✅** |
| 3–7 | S/P/T/A/X | à venir |

## Traçabilité Bloc 1
Chaque test porte son ID de scénario et ses règles : `V-02 (R13)`, `V-15 (R12, R14)`…
Invariants moteur vérifiés par construction : toute action publique émet un
événement (`emit`), les projections sont reconstruites par `apply()` ; l'audit
est le journal d'événements lui-même, append-only et gelé (`Object.freeze`),
prêt pour le rejeu à date (R48/R49 — Bloc 7 le testera).

## Écarts & décisions signalés
1. **Kit d'intégration absent** : `OLive-Kit-Integration-Projet.md` ne figure pas
   dans les fichiers reçus — à re-transmettre.
2. **V-06** : le seuil « après le deuxième rappel » est implémenté comme paramètre
   tenant `reminderMaxBeforeEscalade` (défaut 2) — point R-Q.
3. **Interprétation V-16/R13 → proposition R52** : le catalogue fait hériter la
   validation finale de R1–R14 mais ne définit pas qui est « préparateur » de
   l'étape finale. Implémenté : **tout contributeur de données du dossier est
   exclu du visa de validation finale** (4-yeux global, prudent). Proposition
   d'ajout au catalogue : R52 + scénario V-18, à valider avant d'être considéré
   comme normatif.
