# Q-INF-1 — Publier un CompletionProfile (PP, CH) : contenu réglementaire à faire valider

**Contexte** (V2-M57). L'onglet « Exigences » du dossier KYC (V2-M47) lit le ledger d'inférence.
Le résolveur refuse — à raison, P-L7-1 — pour les dossiers de démonstration : le YAML gouverné
par défaut (`profils.defaut.ts`) ne couvre que TRUST, et les dossiers GWB sont (PP, CH).

**Pourquoi je ne tranche pas.** Publier un profil PP/CH, c'est écrire QUELS documents une
personne physique suisse doit fournir, avec leurs bases légales (CDB 20, LBA, OBA-FINMA) — le
même type de contenu que Q-CR-1 (calendrier réglementaire). CLAUDE.md : en cas de doute sur une
base légale, consigner pour revue humaine, ne pas trancher. Un test (ou une démo) qui passe avec
une sémantique réglementaire fausse est pire qu'un test rouge.

**Ce qu'il faudrait décider** : le contenu d'un profil `pp-defaut` (entityType PP, jurisdiction
CH ou « * ») — vraisemblablement REQ passeport (R26), screening (R46/R101), visa CO (R14/R86) en
miroir des REQ- déjà ratifiées du profil TRUST — et SI ce profil vit dans le YAML par défaut
(tous tenants) ou dans un référentiel par tenant versionné R29 (qui n'existe pas encore : le
code le dit — « Un tenant fournira à terme SES profils versionnés »).

**En attendant** : `inference` reste « partiel » au registre, et l'onglet affiche le refus motivé
du moteur mot pour mot — ce qui est le comportement voulu, pas un défaut.
