# O-Live — MATRICE DE TRAÇABILITÉ FAT (générée, R332/FB-03 — ne pas éditer à la main)

Générée le 2026-07-29. Substrat : parcours API à jetons réels (porte CI bloquante) ; job
Playwright « recette visuelle » non bloquant sur les parcours phares. Chaque scénario ci-
dessous est ADOSSÉ à un test e2e réel (✓) — sinon le harnais FB-02 échoue (anti-fiction).

| Parcours | Jeton | Scénarios (adossés e2e) | Règles | Suite e2e |
|----------|-------|--------------------------|--------|-----------|
| PARC-KYC-AML — Ouverture de relation & surveillance AML | CO_SR | KYC-01 ✓, KYC-02 ✓, AML-01 ✓, AML-02 ✓ | R189, R206 | fat-vague1 |
| PARC-COC — Change of Circumstances | CO | CC-01 ✓, CC-03 ✓, CC-06 ✓, CC-08 ✓, RV-04 ✓ | R133, R136 | fat-coc |
| PARC-REVIEW — Revue périodique gouvernée | CO_SR | RV-01 ✓, RV-03 ✓, RV-05 ✓, RV-08 ✓ | R283 | fat-reviews |
| PARC-OFFBOARDING — Clôture de relation (art. 10a cloisonné) | CO_SR | OF-01 ✓, OF-04 ✓, OF-07 ✓, OF-11 ✓, OF-12 ✓ | R267, R271 | fat-offboarding |
| PARC-OLIVIA — Assistant compliance (propose / humain décide) | CO_SR | OL-01 ✓, OL-16 ✓, OL-24 ✓, OL-32 ✓ | R253, R254, R258 | fat-olivia |
| PARC-DEMO — Démo GWB — histoire complète (DEMO-SCRIPT) | CO_SR | DM-01 ✓, DM-02 ✓, DM-03 ✓ | R329 | fat-cloture-demo |

**Parcours : 6 · scénarios orphelins : 0 · règles orphelines : 0.**
