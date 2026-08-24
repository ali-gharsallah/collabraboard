# Synchronisation repo ↔ projet O-Live (claude.ai)

Protocole pour garder le **projet O-Live sur claude.ai** aligné avec le dépôt, après **chaque bloc
validé par Claude Code**. Objectif : que le contexte uploadé dans claude.ai ne soit **jamais périmé**.

## Le fichier qui fait foi (à exporter)

| Exporter | Fichier | Pourquoi |
|----------|---------|----------|
| ✅ **OUI, à chaque bloc** | **`docs/CANON-MASTER.md`** | **Généré** depuis le repo (`tools/canon-master/`) : mapping session→repo, inventaire intégral **R1–R339+** (n° · titre · statut · familles · suites), paramètres R-Q, écrans, invariants, **rapport d'anomalies**. **Gaté par la CI** (porte « 3c ») → garanti à jour à chaque push. **Remplace** l'ancien catalogue R1-R206. |
| ⚠️ optionnel | `docs/PROJECT-INDEX.md` | Index des docs — **maintenu à la main**, peut être en retard. |
| ⚠️ optionnel | `README.md` | Vue d'ensemble — **maintenu à la main**, peut être en retard. |
| ❌ **NE PLUS exporter** | `docs/CATALOGUE-REGLES-R1-R206.md` | **PÉRIMÉ & GELÉ** (s'arrête à R206). Remplacé par `CANON-MASTER.md`. |

> **En un mot : exporte `docs/CANON-MASTER.md`.** À lui seul il porte le catalogue à jour.

## La boucle

**Claude Code (à chaque bloc validé) :**
1. Régénère le document : `node tools/canon-master/run.mjs`.
2. La porte CI **3c** (`run.mjs --check`) rend le build **ROUGE** si `docs/CANON-MASTER.md` a dérivé
   ou a été édité à la main → le fichier poussé est **toujours** le reflet exact du repo.
3. Commit + push.

**Toi (à chaque bloc) :**
1. Récupère `docs/CANON-MASTER.md` (dernier `master`).
2. Ré-uploade-le dans le projet claude.ai (remplace la version précédente).

## Garanties

- **Fraîcheur** : l'en-tête de `CANON-MASTER.md` porte **la date + le hash du commit** de génération —
  le document se périme visiblement. Si le hash ne correspond pas au dernier `master`, régénère.
- **Zéro invention** : le mapping session→repo vient d'un **seed ratifié** (`spec/mapping-session-repo.md`) ;
  les anomalies connues sont classées & justifiées (`spec/canon-master-exceptions.md`).
- **Le repo fait foi** : `CANON-MASTER.md` n'est jamais rédigé à la main (l'éditer = build rouge).

## Régénérer / vérifier à la main

```bash
node tools/canon-master/test.mjs      # harnais GC-01..07 (attendu 7/7)
node tools/canon-master/run.mjs       # (ré)génère docs/CANON-MASTER.md
node tools/canon-master/run.mjs --check   # vérifie l'absence de dérive (ce que fait la CI)
```
