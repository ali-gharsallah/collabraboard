# Rule Engine — port (P2)
`evaluate(rulesetId, context) → { score, verdict, trace[] }`. Rulesets versionnés
en base (AML, CDD/EDD, scoring, questionnaires, matrice documentaire), édités
par le Configuration Studio. La trace d'évaluation est journalisée (exigence
d'auditabilité FINMA : pouvoir rejouer une décision).
