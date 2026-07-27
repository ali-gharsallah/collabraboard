# Règles PROPOSÉES R222..R238 — GELÉES (attente validation Ali)

Source : `SPEC-FRONT-CÂBLAGE v2`, sections 7.1 (Business Trip / MOD-75, R222..R230) et
7.2 (Formations & Certifications / MOD-43, R231..R238).

**Statut : RATIFIÉES (« OK pour R222..R238 », Ali, 2026-07-27).** La numérotation continue après R221 (Bloc 49).

- **MOD-43 Formations (R231→R238) : IMPLÉMENTÉ — Vague 13.** Gherkin ratifié déplacé en
  `spec/vague13-scenarios/FORMATIONS-MOD43.feature` ; backend `FormationsModule` + e2e FO-01..08 verts
  (`apps/api/test/e2e/fat-vague13.e2e-spec.ts`) ; écran `Formations.tsx`.
- **MOD-75 Business Trip (R222→R230) : à construire — Vague 14.** Le Gherkin `BUSINESS-TRIP-MOD75.feature`
  reste ici (ratifié, pas encore implémenté). Note d'ordonnancement : MOD-43 a été bâti **avant** MOD-75
  car BT-08/R237 résout la certification voyageur **depuis MOD-43** (dépendance).

Toute divergence découverte à l'implémentation devient une **nouvelle règle au catalogue**,
jamais une règle implicite.

Toute divergence découverte à l'implémentation devient une **nouvelle règle au catalogue**,
jamais une règle implicite.
