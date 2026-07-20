# Erratum R119 — `APPROVED` → `VALIDATED` (19.07.2026, soir)

**Détecté par** : premier run réel du bloc 19 (Claude Code, branche) — signalé « À trancher par
Ali », jamais résolu en silence. **DÉCISION : option B — tranchée par Ali Gharsallah le 19.07.2026.** La règle s'aligne
sur l'enum réellement implémentée.

**Le fond.** R119 première rédaction : « ouverture ssi KYC `APPROVED` » — vocabulaire du document
de modèle de données MOD-01 (`DRAFT…APPROVED`). Or l'implémentation canonique depuis la v0.2
écrit **`VALIDATED`** (`kyc.service.validate`, enum Prisma `KycStatus`), testée e2e, RLS, outbox.
Le corpus OB passait sur un **faux** KYC répondant `APPROVED` : test vert, runtime mort —
`DECISION → OUVERT` aurait été bloquée à jamais.

**Leçon de méthode (ajoutée aux réflexes)** : quand un test s'appuie sur un faux d'un AUTRE
domaine, les **valeurs d'états du faux se copient depuis l'enum du schéma**, jamais depuis la
mémoire du rédacteur. Un faux qui invente un statut fabrique un vert qui ment.

**Rejeté (option A)** : renommer l'enum `VALIDATED → APPROVED` — migration + retouches e2e pour
un pur nom, contre « seul le code qui tourne fait foi ».

**Propagé (préparé, prouvé 193/193)** : onboarding.service + OB-04 + amendement (note d'erratum)
+ démo (titre/expl/champ R119). Le doc MOD-01 est historique sur ce point. À reporter sur la
branche après le mot d'Ali ; l'erratum se fold au prochain re-cut Word.
