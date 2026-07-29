# CANON — SOLDE DES 4 DERNIERS ÉCARTS (enregistré 2026-07-29, statut RATIFIÉ)

**Étape 0 ratifiée (Ali, 2026-07-29)** : le canon PO numérotait R321–R324 ; R321–R323
sont consommés (Octopulse OpRisk, dégel V9). Mapping ratifié :

| Canon PO | Dépôt | Objet |
|----------|-------|-------|
| R321 | **R324** | Snapshot = projection JETABLE du journal — jamais une source |
| R322 | **R325** | Cache d'instance = commodité RÉVOCABLE — le journal commande |
| R323 | **R326** | Le dictionnaire i18n est LA source — versionné, complet ou signalé |
| R324 | **R327** | L'UI se traduit, la DONNÉE jamais ; le paramétrage se traduit par le tenant |
| PC-15..20 (canon) | **PC-20..PC-25** | PC-01..19 pris (porte CPSI + contrat 1.1) |
| LN-01..06 | LN-01..06 | famille libre, conservée telle quelle |

**Ratifications d'exécution (mêmes réponses)** :
1. **R324/R325 = CONTRAT DORMANT** : la jauge R250 post-`rejeu_leger` est à 103,7 ms
   pour 10 001 événements (seuil 2 000 ms) — la règle d'activation du canon (« ne
   s'active que si la jauge est franchie ») dit NON DÉCLENCHÉE. Livré aujourd'hui :
   test d'équivalence PERMANENT PC-20 (léger vs lourd, byte-à-byte), chemin déclaré
   dans les meta R250, 3 clés R-Q déclarées dormantes, mesures publiées. Le snapshot
   (PC-21..23) et le cache (PC-24..25) s'implémentent le jour où la jauge refranchit.
2. **R326/R327 = CLIQUET** : infra complète maintenant (rapport CI de clés manquantes,
   marqueur dev, données verbatim LN-03, configs tenant multilingues LN-04,
   langue_correspondance→OF-09 LN-05, formats LN-06) ; le « zéro texte en dur » (LN-01)
   vaut en CLIQUET : la liste des écrans convertis ne peut que croître, tout nouvel
   écran doit passer — conversion des 73 écrans en continu, comme la grille.
3. **Partie 3** : store partagé du rate limit écrit MAINTENANT (interface + adaptateur
   Redis prêt, testé par stub in-process — démon Docker indisponible en session, le
   test « 2 instances compose » se rejoue en staging, consigné) ; Terraform/WAL-G/
   compose/dashboards préparés SANS provisionnement.
4. **Partie 4** : `langue_correspondance` = le champ `corrLang` existant de
   ClientCreate (pas de doublon) ; grille ASVS L2 + CI sécurité + dossier
   docs/SECURITE.md préparés.

Le texte du canon PO fait foi pour le CONTENU des règles (contraintes des snapshots,
invalidation, meta chemin, doctrine i18n, runbook Exoscale §1–10, cadrage pentest) —
il est reproduit par référence : message PO du 2026-07-29, intégré ci-dessous par
sections lors de l'implémentation de chaque règle. Interdits repris : optimisation
activée sans mesures publiées · chemin de code qui change le RÉSULTAT (seule la
latence change) · traduction d'une donnée métier · provisionnement cloud réel ·
code avant test.
