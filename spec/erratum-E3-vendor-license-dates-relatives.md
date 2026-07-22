# Erratum E3 — 22.07.2026 · Dates relatives dans le spec Licence vendor (R177→R179)

**Nature : erratum de robustesse temporelle, comportement STRICTEMENT inchangé.**
Signalé par le poste d'intégration (vérif base avant Bloc 48) : `vendor-license.wiring.spec.ts`
(LC-01..05) codait ses dates en dur au jour de rédaction — `effetAt: '2026-07-21'`,
`expiry: '2027-07-21'`, etc. Or R179 refuse l'effet rétroactif avec une fenêtre de grâce
de 24h (`vendor-license.service.ts` : `new Date(dto.effetAt).getTime() < Date.now() - 86_400_000`).
Dès le 22.07.2026, `effetAt='2026-07-21'` tombait hors fenêtre → 4 des 5 tests viraient au
rouge (« R179 : effet rétroactif refusé ») sans qu'aucun code métier ne change. La CI verte du
21.07 (PR #20, 339/339) le masquait car la date de rédaction = jour d'exécution.

**Correction** : les dates du spec sont désormais calculées relativement à « aujourd'hui »
via un helper `jour(décalage)` — `AUJ` (effet immédiat, dans la fenêtre), `EXPIRY` (~1 an),
`FUTUR` (+60 j, porte le test « motif obligatoire »), `PASSE` (−3650 j, porte le test
« rétroactif refusé »). Les intentions des scénarios sont préservées à l'identique : aucun
seuil, aucune règle, aucune assertion affaiblie — LC-01..05 re-exécutés **5/5**.

Fichier touché : `apps/api/src/modules/license/vendor-license.wiring.spec.ts` (spec seul ;
le service R177→R179 n'est PAS modifié). Base harnais rétablie à **339/339** (48 suites).
