# Workflow Engine — port (P2)
Décision : modular monolith d'abord. Interface stable dès maintenant :
`start(definitionId, ctx)` · `signal(instanceId, event)` · `tasks(assignee)` ·
timers/escalades par Scheduler (BullMQ repeatable). Implémentation P2 : state
machine maison persistée (table workflow_instances) ; BPMN/Flowable seulement
si les banques exigent la modélisation graphique. Périmètre : onboarding,
perpetual KYC, account review, business trip, payment review, investigations,
offboarding — un JSON de définition par workflow, versionné.
