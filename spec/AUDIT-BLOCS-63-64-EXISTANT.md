<!-- ÉDITION AU VERSEMENT (A1, 2026-08-08 — session Blocs 63/64) :
  1. NUMÉROTATION : corps renuméroté session→repo (R439–R445+R458 → R446–R452+R465 ;
     R446–R457 → R453–R464 ; « R438 » (pop-up Bloc 62) → R445 repo). Mécanisme
     mapping-session-repo.md §3 : l'implémenté prend le créneau contigu, PK glisse à R466+.
  2. DOCTRINE DELTA (arbitrage PO 2026-08-08, E-6364-0) : implémentation en EXTENSION des
     modules existants — MOD-75 Business Trip (R222–R230), Cross-Border R293–R295 (jamais un
     second référentiel), MOD-43 Formations (R231–R238). Aucun nouveau moteur, aucune règle
     dupliquée : quand l'existant couvre, la règle repo le référence.
  3. La réserve §Réserve de l'audit (vérif CANON au repo) est LEVÉE par A0 : verdict dans
     docs/ECARTS-FRONT.md §E-6364-0 (collisions numérotation + périmètre, arbitrage delta).
  Le document original du drop fait foi pour l'intention ; cette copie fait foi pour les numéros. -->

# AUDIT 08.08.2026 — Blocs 63 & 64 vs existant (démo + catalogue)
**Objet** : vérifier, ligne à ligne, ce qui existe déjà dans `olive-demo.html` (modules Business Trip, Cross-Border MOD-33, Formations MOD-43, Contact Reports) et le catalogue accessible R1–R431, avant implémentation des Blocs 63–64. Méthode : audit HTML avant transcription — rien n'est présumé nouveau, rien n'est dupliqué en silence.
**Réserve** : audit conduit sur les sources accessibles en session. Vérification finale contre `CANON-MASTER.md` au repo = action A0 de la session Claude Code.

---

## 1. Verdicts par règle

| Règle | Capacité | Existant constaté | Verdict |
|---|---|---|---|
| R446 | Demande = workflow, chaîne de visas | Chaîne **fixe** RM→MGR→XB→HPB pour TOUS les voyages ; `ROLE_GATE` paramètre QUI agit par étape (pas la chaîne) ; progression par mutation `approvals[].state` ; refus = état `alert` | **PARTIEL** — l'UX et les étapes existent ; le moteur, les visas R15, l'exclusion R13 et les chaînes par risque/budget sont nouveaux |
| R447 | Guards pré-départ | Quota affiché avec ⚠ « dérogation Compliance requise » (texte, non bloquant) ; licence lue d'INDIGITA_DB ; sanctions RU en note de matrice ; **aucun guard moteur** | **PARTIEL** — signaux affichés, jamais évalués en garde de transition |
| R448 | Check pré-voyage figé | Check juridiction×activités existe, consigné en PARAM_AUDIT (« preuve que le RM a vérifié AVANT ») ; **aucune version de matrice référencée, aucune invalidation** sur changement de destination/dates | **PARTIEL** — le check existe, la preuve rejouable est nouvelle |
| R449 | Quotas jours bancables | Plafonds banque par destination, année glissante, consommation agrégée des voyages approuvés — **ET `RM_OVERRIDES_SEED` : overrides par RM par destination**, absents du spec initial | **DÉJÀ LARGEMENT FAIT** → spec amendé : clé `quotasOverridesRM` ajoutée (R449) |
| R450 | Certificat de trip | **Le compte-rendu de voyage EXISTE** : champ `report` + `reportDate`, textarea « Au retour, le RM documente le déroulement… », bouton Enregistrer. **Sans** cycle de vie, sans visa, sans liens contact reports, sans SLA/relance, sans écarts | **PARTIEL → E-BT-2** — R450 ne crée pas le compte-rendu, il le FORMALISE (le texte libre devient le corps narratif du certificat) |
| R451/R458 | Certification × activité / par juridiction | MOD-43 complet : catalogue thématique (LBA-INIT, LBA-REC, CDB20, LSFIN, GOAML), suspension auto si échue, contrôles de cohérence certification × activité tracée. **Aucun code de certification cross-border, aucune granularité pays** | R451 = **DÉJÀ FAIT** (réutiliser MOD-43 tel quel) ; R458 = **NOUVEAU** (ajout de codes `XB-<pays>` au catalogue MOD-43, pas un nouveau module) |
| R452/R462 | Pop-up d'engagement | R445 ratifié au Bloc 62 | **RÉUTILISATION** — étendre, ne pas dupliquer |
| R453 | Port matrice versionné | **DEUX référentiels parallèles** : `CB_RULES` (matrice 6 activités, en dur, écran Cross-Border) et `INDIGITA_DB` (status/solicitation/licence/produits par pays, paramétrable en Admin, consulté par voyage via `runIndigita`). Non synchronisés — un pays peut être BLOQUÉ dans l'un et permissif dans l'autre | **CONFLIT → E-XB-3** — R453 amendé : le port produit UN référentiel unifié versionné ; CB_RULES et INDIGITA_DB deviennent deux PROJECTIONS de la même version, jamais deux vérités |
| R454 | Actes cross-border distants | Canaux distants existent aux contact reports (Visioconférence, Appel, Email) et personnes rattachées — **aucun check déclenché** | **NOUVEAU** — la plomberie d'accueil existe déjà |
| R455 | Pré-acte (MKT/ADVICE/ORDER) | « Restrictions par client selon son domicile » = 3e usage MOD-33, consultation seule | **PARTIEL** — la lecture existe, le check-au-moment-de-l'acte est nouveau |
| R456 | Registre reverse solicitation | Mentions texte dans les verdicts (FR, US « reverse solicitation documentée », HK « uniquement ») — **aucun objet de preuve, aucun registre** | **NOUVEAU** — confirmé |
| R457 | Localisation temporaire | Rien | **NOUVEAU** |
| R459 | Analyse d'impact | Rien pour la matrice — MAIS le pattern existe ailleurs : bacs à sable questionnaires/BRM avec `sbProposer` (proposition au comité portant `impacts:[{dossiers impactés, charge…}]`) | **NOUVEAU** — implémenter en RÉUTILISANT le pattern comité/impacts existant, pas un mécanisme inédit |
| R460 | Exposition consolidée | Rapport LBA Direction §6 compte juridictions couvertes + checks pré-voyage tracés | **PARTIEL** — étendre le §6, ajouter la projection dashboard |
| R461 | Multi-entité | Rien (exemption BaFin citée en note de matrice seulement) | **NOUVEAU** |
| R463/R464 | Olivia briefing/rapprochement | Modules Olivia existants (12 agents) mais rien de spécifique voyage | **NOUVEAU — GELÉ** |
| **R465 (AJOUT D'AUDIT)** | **Prospect né en voyage** | **La démo le fait déjà** : « Nouvelle demande de voyage » permet de déclarer un nouveau client rencontré → crée un prospect complet (`source: "Business Trip"`, docs CDB pré-listés) via `onNewProspect` | **NON COUVERT par les blocs → règle R465 ajoutée** (sinon la migration A7 aurait supprimé une fonctionnalité — interdit) |

## 2. Écarts consignés (→ docs/ECARTS-FRONT.md)

- **E-BT-1** (déjà consigné) — module Business Trip hors moteur : `approvals[].state` muté, constantes non tenant.
- **E-BT-2** (nouveau) — le compte-rendu de voyage existe en texte libre sans validation, sans visa, sans liens, sans SLA. Résolution : R450 le formalise ; les comptes rendus existants migrent comme corps narratif de certificats en statut Brouillon.
- **E-BT-3** (nouveau) — la création de prospect depuis un voyage existe en démo mais n'était couverte par aucune règle. Résolution : R465.
- **E-XB-1** (déjà consigné) — CB_RULES en constante, sans source ni version.
- **E-XB-2** (déjà réservé, session) — intégration réseau Indigita/Apiax hors session (contrat + mock).
- **E-XB-3** (nouveau) — **duplication de référentiels** : CB_RULES et INDIGITA_DB coexistent sans synchronisation. Résolution : R453 amendé — un seul référentiel versionné, deux projections.

## 3. Amendements appliqués aux specs (v2)

**Bloc 63** (fichier mis à jour) :
- **R449** intègre les overrides par RM : clé `settings.businessTrip.quotasOverridesRM` (map RM×destination→jours), le plafond effectif = override s'il existe, sinon plafond banque ; l'override est lui-même soumis au pop-up R452.
- **R450** précise : le certificat REPREND le compte-rendu libre existant comme corps narratif ; migration des `report` existants en certificats Brouillon (E-BT-2).
- **R465 (nouvelle)** — « Le voyage fait naître le prospect à sa source » : la déclaration d'un nouveau contact en voyage crée un prospect tracé `source=BUSINESS_TRIP`, lié à l'ID du voyage ET au contact report de la rencontre ; le certificat de trip (R450) liste les prospects nés du voyage ; le prospect suit ensuite le circuit onboarding standard (aiguillage R59/WR0) — le voyage n'accorde aucun raccourci de diligence.
- **Scénarios ajoutés : BT-15** (override RM prime le plafond banque, tracé, pop-up) et **BT-16** (prospect né en voyage : lié au voyage + contact report, aiguillé vers l'onboarding standard, listé au certificat). Bloc 63 = **16 scénarios**.

**Bloc 64** (fichier mis à jour) :
- **R453** amendé : la version de matrice unifie les DEUX référentiels démo — champs activités (MEET…ORDER) ET champs synthèse (statut, sollicitation, licence, produits) dans le même objet versionné ; CB_RULES et INDIGITA_DB deviennent des projections de lecture (E-XB-3).
- **R458** précisé : les certifications par juridiction sont des codes `XB-<pays>` AJOUTÉS au catalogue MOD-43 existant (suspension auto et contrôles de cohérence hérités) — pas un nouveau module.
- **R459** précisé : réutilise le pattern comité/impacts des bacs à sable existants.

## 4. Conclusion d'audit

Rien dans les Blocs 63–64 ne réinvente un existant : sur 20 capacités, **2 étaient déjà largement faites** (quotas, croisement certification×activité — les specs les référencent au lieu de les respécifier), **7 partielles** (formalisées par le moteur), **8 nouvelles**, **1 conflit de référentiels** (résolu par unification), **1 fonctionnalité démo orpheline** récupérée en règle (R465). Aucune collision de numérotation détectée dans le catalogue accessible ; vérification CANON-MASTER au repo en A0.
