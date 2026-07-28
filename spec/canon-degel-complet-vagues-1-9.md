# O-Live — CANON DU DÉGEL COMPLET (Vagues 1–9) + état du développement restant

**Statut : RATIFIÉ le 2026-07-28 (Ali, PO) — mapping +3 (R297–R323), familles WB+VR, les 4 cross-réfs 0b, branche unique PR #46.**

## ÉTAPE 0 — vérifications sur pièce (collisions détectées → mapping proposé, STOP)

**0a. Numérotation.** Le canon propose R294–R320. **COLLISION** ✗ : R294 (check XB),
R295 (reverse solicitation) et R296 (login deux temps) sont PRIS — ratifiés et livrés le
2026-07-28 (canon triage final). Prochain numéro libre : **R297**. Mapping proposé :
**décalage +3 uniforme — canon R294→R297 … canon R320→R323** (27 règles, R297–R323).

| Vague | Canon dit | Se lit | Famille |
|-------|-----------|--------|---------|
| 1 Flux/Txrisk/FX/SWIFT | R294–R297 | **R297–R300** | TF ✓ libre |
| 2 Custody & TA | R298–R300 | **R301–R303** | CY ✓ libre |
| 3 Builder | R301–R305 | **R304–R308** | BD ✗ prise (CPSI bandes BD-01/02) → **WB** proposé |
| 4 Regwatch | R306–R308 | **R309–R311** | RW ✗ prise (R283 review, RW-01..05) → **VR** proposé |
| 5 Legal | R309–R310 | **R312–R313** | LE ✓ libre |
| 6 BI libre | R311–R312 | **R314–R315** | BL ✓ libre |
| 7 Mobile | R313–R315 | **R316–R318** | MB ✓ libre |
| 8 Console éditeur | R316–R317 | **R319–R320** | VE ✓ libre |
| 9 OpRisk | R318–R320 | **R321–R323** | OP ✓ libre |

**0b. Cross-références internes du canon à remapper** (le texte fait foi selon ce tableau) :
- « country manual R290 » (vague 5) → **R293** (le manual ratifié vit sur `tripCrossBorderReferentiel`) ;
- « rate limiting login (R293) » (dette §7) → **R296** ;
- « AU-07 » (vague 9) → **SO-07** (mapping AU→SO ratifié au canon SO) ;
- « pattern R265 : registre en CI, build échoue hors liste » (vague 6) → **R264**
  (R264 = liste blanche d'endpoints en CI ; R265 = replay intégral) — à confirmer.

**0c. Dépendances par vague — TOUTES présentes, aucun STOP :** port core banking
(R167-169, SY-01..05) pour V1/V2 ✓ · moteur R1-R51 (INTOUCHABLE — le Builder n'édite
que des configurations) pour V3 ✓ · GED (R109-115) + country manual R293 pour V5 ✓ ·
audit IT SO-07 pour V9 ✓ · SB-03 (bac onboarding/kyc) réutilisable pour V3 ✓.
Table `transactions` : n'existe pas (modèle Prisma NOUVEAU, prévu par la vague 1).

**0d. Visas obligatoires avant code (du prompt PO) :** Vague 3 (Builder) et Vague 7
(Mobile) — plan d'implémentation d'une page chacune, soumis et ATTENDU.

---
# TEXTE DU CANON (les numéros se lisent selon le mapping 0a/0b ci-dessus)

Invariants hérités, applicables PARTOUT sans re-déclaration : événements append-only
rejouables (R48/R49) · versionné à date + grandfathering (R29/R68) · ports optionnels,
refus gracieux, zéro donnée simulée en prod (R167) · default-deny · mesure/notifie,
ne coerce pas (R39) · IA propose, humain décide (R44/R255) · motif (R7) · four-eyes
(R13) · RBAC+RLS backend, le front ne filtre jamais · module inactif = absent (R279).

## VAGUE 1 — FLUX TRANSACTIONNEL, TXRISK, FX, SWIFT (canon R294–R297 → R297–R300, TF-01..12)

**R297 [canon R294] — Le flux transactionnel est UN journal canonique — alimenté par le
port, jamais inventé.** Table `transactions` append-only, alimentée exclusivement par le
port core banking (R167–R169) via l'outbox/consommateurs (R285/R286 — idempotence par
référence externe `(source, ref_externe)` unique). Modèle canonique minimal : tenant,
client, compte, date valeur/comptable, montant, devise, sens, contrepartie (nom, pays,
IBAN haché), type, ref_externe, source. Port absent = aucun flux, écrans en refus
gracieux ; fixtures déterministes en TEST uniquement. Enrichissement (pays de
contrepartie, catégorisation) = colonnes calculées tracées, jamais des écrasements.

**R298 [canon R295] — Txrisk est une SURFACE du moteur CPSI — jamais un second moteur.**
Le monitoring transactionnel ne crée AUCUNE règle de détection propre : les patterns
(vélocité, structuring, circulaire…) sont les scénarios AML existants (R73/R79/R80), qui
consomment le flux comme source d'attributs (le registre R79 déclare les nouveaux
attributs transactionnels). L'écran txrisk = vue temps réel du flux (SSE R287) +
tendances servies par la porte (volumétrie PC-11+) + drill vers l'AML workspace. Un
pattern manquant = un scénario à AJOUTER au catalogue CPSI (voie normale R69/R70),
pas du code txrisk.

**R299 [canon R296] — FX est une LECTURE d'exposition — seuils qui notifient, zéro
exécution.** Positions par devise (agrégées du flux + soldes du port), taux via port FX
dédié (pas de port = pas de conversion, affichage en devise d'origine avec mention —
jamais un taux inventé). Exposition par client/portefeuille/tenant ; seuils = paramètres
tenant qui NOTIFIENT (R39). Aucune opération de change, aucun ordre — lecture et alerte.

**R300 [canon R297] — SWIFT est un LABORATOIRE d'analyse — parsing entrant, émission
interdite.** Parsing MT/MX (bibliothèque de types déclarée : MT103, MT202, pacs.008…)
en extraction structurée, rattachement aux transactions par référence, surlignage des
champs sensibles (alimente les attributs R79 : third-party payer, etc.). Message non
parsable = quarantaine listée (pattern R169), jamais deviné. AUCUNE émission —
structurellement (pas d'endpoint sortant).

Scénarios TF-01..12 (texte du canon, verbatim) : TF-01 port absent → refus gracieux typé,
zéro donnée, suite verte sans port · TF-02 même ref_externe deux fois → une transaction ·
TF-03 journal immuable (UPDATE/DELETE → exception) · TF-04 scénario CPSI sur attribut
transactionnel détecte via le MOTEUR (zéro logique dans txrisk) · TF-05 live par SSE
(AS-06 rejoué) · TF-06 tendances = volumétrie par rejeu à date · TF-07 pas de port FX →
devise d'origine + mention, jamais un taux par défaut · TF-08 seuil franchi →
notification, rien bloqué · TF-09 MT103 fixture → extraction structurée rattachée ·
TF-10 message inconnu → quarantaine visible motivée · TF-11 aucun endpoint d'émission
SWIFT (test négatif routes) · TF-12 champs contrepartie alimentent le registre R79
(attribut déclaré, formule en français).
Paramètres R-Q : `fx_seuils_exposition` (par devise), `swift_types_actifs`.

## VAGUE 2 — CUSTODY & TRANSFER AGENT (canon R298–R300 → R301–R303, CY-01..06)

**R301 [canon R298]** — Positions custody servies par le PORT (lecture, refus gracieux) ;
O-Live ne tient pas les positions : il les lit et les rapproche.
**R302 [canon R299]** — Le registre nominatif (TA) est un JOURNAL append-only :
souscription, transfert, nantissement, radiation = événements (titulaire, quantité,
référence, visas selon type — paramètre tenant). État à toute date = rejeu (R48).
Correction = contre-passation motivée (R7), jamais une réécriture.
**R303 [canon R300]** — Le rapprochement LISTE les écarts — tous (pattern R269), typés,
avec voie de résolution (contre-passation, correction dépositaire, attestation),
résolution tracée. Tokenisation : HORS bloc — option à ratifier séparément.

Scénarios CY-01..06 : CY-01 pas de port → custody refus gracieux, registre pleinement
fonctionnel · CY-02 transfert = événement visé, état à J-30 rejoué exact · CY-03
contre-passation motivée requise, UPDATE direct → exception · CY-04 3 écarts fixture →
3 listés typés avec voie · CY-05 résolution → événement, rapprochement suivant n'en
montre que 2 · CY-06 visas par type = paramètre tenant, initiateur exclu (R13).

## VAGUE 3 — WORKFLOW/QUESTIONNAIRE/SECTION BUILDER (canon R301–R305 → R304–R308, WB-01..10) — VISA ALI AVANT CODE

**R304 [canon R301]** — Tout artefact du Builder (sections, questionnaires, workflows)
est VERSIONNÉ à date avec grandfathering : brouillon → versions publiées datées,
append-only ; dossiers en cours sur LEUR version (R29) — modèle R282/R283 étendu.
**R305 [canon R302]** — La publication passe par le BAC À SABLE — verrou structurel
(R70, pattern PA-02) : rapport d'impact obligatoire (SB-03 réutilisé/étendu) ;
re-modification invalide la simulation.
**R306 [canon R303]** — La COHÉRENCE est validée par le BACKEND — refus typés, liste
complète (R269) : section sans rôle EDIT ; REQUIRED d'un rôle HIDDEN ; workflow sans
état terminal ; transition orpheline ; étape sans owner ; cycle sans sortie ; rôle
inexistant. Le Builder AFFICHE, il ne précalcule pas.
**R307 [canon R304]** — Publication FOUR-EYES : auteur ≠ publicateur (R13) ; rôles
habilités = paramètre `roles_publication_builder` (défaut ADMIN + CO_SR) ; publication =
événement (auteur, publicateur, version, rapport d'impact joint).
**R308 [canon R305]** — Les artefacts s'exécutent sur les MOTEURS existants — jamais un
second : workflow → moteur R1–R51 ; section → kyc_sections/questions/access_rules
(R282) ; questionnaire review → review_profile (R283). Zéro runtime propre (revue :
aucun interpréteur dans le module). Olivia PROPOSE un artefact (R255) — brouillon,
jamais publié par elle.

Scénarios WB-01..10 [canon BD-01..10] : WB-01 artefact publié immuable, modification =
version · WB-02 dossier ouvert v1 / v2 publiée → dossier finit v1, nouveau prend v2 ·
WB-03 publier sans simulation → verrou (bouton absent + refus serveur), re-modification
→ re-simulation · WB-04 7 incohérences fixture → refusées d'un coup, toutes listées ·
WB-05 auteur=publicateur → refus R13 · WB-06 workflow créé exécute un dossier de bout
en bout sur le moteur R1-R51 (e2e) · WB-07 section créée apparaît dans sdkyc, obéit à
R282 · WB-08 zéro interpréteur (revue + test d'architecture) · WB-09 proposition Olivia
→ brouillon PENDING, jamais publiée sans chaîne humaine · WB-10 rapport d'impact joint
à l'événement de publication, consultable à l'audit.

## VAGUE 4 — REGWATCH (canon R306–R308 → R309–R311, VR-01..05)

**R309 [canon R306]** — Sources de veille = PORTS déclarés (URL/credentials au coffre,
refus gracieux, dernier fetch tracé) ; item = événement (source, date, titre,
contenu/référence, empreinte — déduplication par empreinte).
**R310 [canon R307]** — Qualification HUMAINE motivée : NON_TRAITE → PERTINENT (impact)
| NON_PERTINENT (motif R7). Olivia PROPOSE (R255/R257, citations vers les Rn) —
l'humain décide.
**R311 [canon R308]** — L'impact se RATTACHE au catalogue : item PERTINENT référence
les Rn impactés + ouvre une tâche d'analyse ; changement → voie normale (amendement
ratifié, R68, bac à sable) — regwatch ne modifie JAMAIS une règle. Digest notifié par
rôle (R39).

Scénarios VR-01..05 [canon RW-01..05] : VR-01 source sans credentials → port éteint,
zéro item, rien cassé · VR-02 même item deux fois → une entrée (empreinte) · VR-03
NON_PERTINENT sans motif → refus · VR-04 proposition Olivia cite des Rn existants,
adoption → qualification tracée · VR-05 PERTINENT référençant une règle → tâche
ouverte visible ; aucune règle modifiée par regwatch (test négatif).

## VAGUE 5 — LEGAL (canon R309–R310 → R312–R313, LE-01..04)

**R312 [canon R309]** — Le registre LEGAL vit sur la GED : contrats/mémos = objets
(type, parties, dates, tacite reconduction, préavis, rattachements : client,
juridiction du country manual **R293**, fournisseur) — chaque pièce est un document GED
(R109–R115). Le mémo référencé par une position cross-border vit ICI.
**R313 [canon R310]** — Échéances CALCULÉES (pattern R272/R274 réutilisé) : préavis =
tâche + notification, retard = fait calculé, escalade notifiée, jamais bloquant.
Modification de dates = événement.

Scénarios LE-01..04 : LE-01 contrat sans document GED → création refusée · LE-02
préavis J-60 → tâche + notification ; dépassé → EN_RETARD, escalade · LE-03 le mémo
cité par le country manual s'ouvre depuis l'écran cross-border (bidirectionnel) ·
LE-04 mémo v2 → l'évaluation XB antérieure référence v1 (rejeu), la nouvelle v2.

## VAGUE 6 — BI LIBRE (canon R311–R312 → R314–R315, BL-01..04)

**R314 [canon R311]** — La BI interroge des PROJECTIONS déclarées — liste blanche de
vues en CI (pattern **R264**), zéro SQL libre ; chaque vue déclare colonnes, source,
sensibilité.
**R315 [canon R312]** — Le scope s'applique aux projections (RBAC/RLS) ; export
au-delà de `bi_seuil_export` = AUDIT_ACCESS notifié SO — mesuré, jamais bloqué (R39).

Scénarios BL-01..04 : BL-01 requête hors liste → refus typé ; vue hors CI → build
rouge · BL-02 même requête RM vs CO → résultats scopés différents (backend) · BL-03
export 50k lignes → AUDIT_ACCESS + notification SO, export servi · BL-04 aucune
écriture depuis le module BI (inventaire SQL).

## VAGUE 7 — MOBILE BANKING (canon R313–R315 → R316–R318, MB-01..05) — VISA ALI AVANT CODE

**R316 [canon R313]** — Clients finaux = POPULATION IAM DISTINCTE (jamais les rôles
internes — contrainte structurelle) ; auth dédiée MFA obligatoire, sessions
distinctes ; activation par le RM + code hors bande, tracée.
**R317 [canon R314]** — Mobile v1 = LECTURE + MESSAGERIE ; EXCLUS v1 (liste fermée,
opposable) : paiements, ordres de bourse, signature, modification de données
personnelles (→ message au RM ouvre un CoC R276), gestion des bénéficiaires. Tout
ajout = amendement ratifié.
**R318 [canon R315]** — Le client ne voit QUE le partagé (comptes + documents marqués) ;
AUCUNE donnée compliance (même l'existence — pattern OL-34/R270) ; tout contrôle est
serveur, l'app est un rendu.

Scénarios MB-01..05 : MB-01 client final avec rôle interne → refusé structurellement ·
MB-02 activation sans code hors bande → refusée ; avec → tracée · MB-03 document non
partagé n'apparaît jamais (réponse réseau) · MB-04 routes des exclusions → 404 (pas
403) · MB-05 « changer mon adresse » par message → CoC OUVERT côté banque (CC-01
rejoué depuis mobile). Paramètres R-Q : `mobile_actif`, `mobile_partage_defaut`.

## VAGUE 8 — CONSOLE ÉDITEUR (canon R316–R317 → R319–R320, VE-01..03)

**R319 [canon R316]** — Console VENDOR = INSTANCE séparée (déploiement, base, IAM
propres — EDITOR n'existe que là) ; registre des instances clientes (version, modules,
échéances, canal) ; aucune connexion entrante console → données tenant.
**R320 [canon R317]** — La licence descend SIGNÉE ; l'instance vérifie (clé publique)
et alimente R279 ; expiration → notifications longues puis module inactif (R279,
lecture d'audit préservée LC-03). Jamais de coupure de données.

Scénarios VE-01..03 : VE-01 EDITOR absent du RBAC tenant (test négatif permanent) ·
VE-02 jeton signé → modules à jour (LC-02 rejoué) ; altéré → refus · VE-03 licence
expirée → module inactif, audit consultable (LC-03), notifications J-60/J-30.

## VAGUE 9 — OCTOPULSE OPRISK (canon R318–R320 → R321–R323, OP-01..05)

**R321 [canon R318]** — Incident opérationnel = DOSSIER tracé : déclaration (tout
collaborateur), taxonomie Bâle 1/2 (paramètre tenant), sévérité, pertes, statut
DECLARE → EN_ANALYSE → CLOS (motif R7). Un incident d'intégrité détecté par l'audit IT
(**SO-07**) peut ouvrir un incident OpRisk référencé.
**R322 [canon R319]** — La heatmap est CALCULÉE (fréquence × sévérité par catégorie),
jamais peinte ; rejouable à date.
**R323 [canon R320]** — Plan d'action tracé et suivi (owner, échéance, statut) ; retard
= fait calculé (R274), notifié, jamais bloquant. AMA quantitatif : option à ratifier
séparément.

Scénarios OP-01..05 : OP-01 incident déclaré → dossier tracé, classification
obligatoire · OP-02 clôture sans motif → refus · OP-03 heatmap à J-90 rejouée exacte,
aucune écriture directe de cellule (test négatif) · OP-04 SO-07 détecte une chaîne
rompue → incident OpRisk ouvrable, référencé · OP-05 action en retard → notification
owner puis escalade, rien bloqué.

## ÉTAT DU DÉVELOPPEMENT — dette et améliorations (hors vagues, du canon PO)

Dette d'intégration (avant pilote) : 1. JWT sur TOUTES les routes (fin des headers
x-tenant-id) — MOD-30 prêt, branchement à faire · 2. extinction appel Anthropic
navigateur (grep CI B.11.4 à vérifier) · 3. provisionnement Exoscale Zurich (VMs,
Postgres, backups + restauration TESTÉE).
Qualité : 4. perf front (virtualisation, mémoïsation, budget bundle) · 5. observabilité
(logs structurés, métriques, alerting dead-letters sur canal réel) · 6. tests de charge
rejeu CPSI 10k+ événements (jauge R224) · 7. sécurité (OWASP, rate limiting login
**R296**, pentest, rotation secrets) · 8. migrations expand/contract.
Produit : 9. conformité visuelle à dérouler en continu (grille initialisée) · 10. i18n
4 langues (écart par clé) · 11. seed tenant démo GWB bout-en-bout.
Hors dev : CO art. 332 (avocat), marque O-Live.

## INTERDITS (rappel du prompt PO)

Second moteur (R298/R308) · émission SWIFT (TF-11) · SQL libre BI (R314) · rôle interne
pour un client final (MB-01) · EDITOR au RBAC tenant (VE-01) · cellule de heatmap
saisie (OP-03) · donnée simulée en prod · code avant test · tout écart repo vs canon :
STOP et signale.
