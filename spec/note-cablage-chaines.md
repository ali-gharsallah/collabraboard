# Note de câblage — Les chaînes (CB-01..06) · Lot 30

**AUCUNE RÈGLE NOUVELLE.** Ce lot tient les promesses de câblage déjà ratifiées et
explicitement reportées « à un lot dédié » dans les amendements R148-R151, R156-R159 —
sans modifier un seul service prouvé : `chaines/chaines.service.ts` est un **composeur**.

| Chaîne | Clauses tenues | Preuve |
|---|---|---|
| `classerEtIndexer` | R139 → R151 (le classement déclenche l'indexation) ; garde R148 : un document sans dérivé OCR ne se classe pas cherchable — refus net, pas de demi-état | CB-01, CB-06 |
| `ocriserEtIndexer` | R138 → R151 (l'index sert l'état courant) | CB-02 |
| `detruireComplet` | R115 → R146 (purge du coffre, l'empreinte survit) → R151 (retrait d'index, l'oubli certifié est complet) | CB-03 |
| `caviarderEtDeposer` | R158 → R144 (le dérivé au coffre, clé préfixée tenant `{t}/{doc}/caviarde-{id}`) ; clause R148 : **volontairement aucun appel à l'indexation** — le caviardé sert la sortie (R159), pas la consultation | CB-04, CB-05 |

Événement nouveau : `cablage.caviarde.depose` (clé + empreinte du dérivé — le dépôt est prouvé).
Reste au périmètre UI (session dédiée) : montage de `LierPersonnePopup` dans les écrans
KYC/onboarding (le composant démo est prêt et réutilisable).

Corpus : 262 + 6 CB = **268**.
