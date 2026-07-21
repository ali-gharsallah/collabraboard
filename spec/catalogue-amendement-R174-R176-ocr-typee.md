# Catalogue O-Live — Amendement PROPOSÉ (R174 → R176) · Bloc 36 « L'extraction comprend le document »

**Statut : RATIFIÉ le 21.07.2026 par Ali Gharsallah.**
Numérotation continue après R173. Famille : **OC** (vérifiée libre — EX est pris).
**Le catalogue précède le code.** L'OCR actuel (R138) lit du texte en dérivé. Ali exige le
moteur qui COMPREND : par type de document, savoir OÙ trouver chaque information, CONTRÔLER
l'authenticité, et DIGITALISER vers les formulaires (GED, KYC…) — solide, paramétrable,
scalable. Trois règles, une doctrine : le moteur extrait et contrôle, l'humain qualifie et
dispose.

## R174 — L'extraction est un CONTRAT par type — le gabarit vit au plan de classement

Chaque type du plan de classement (`gedDocTypes` — la clé maîtresse s'enrichit, pattern
R170) peut porter son **gabarit d'extraction** : la liste des champs attendus (nom, indices
de localisation, format, obligatoire) et sa **version**. L'extraction typée exige un
document **classé** (le type est connu) ; elle produit des **champs candidats**
`{champ, valeur, confiance}` en **dérivé signé** (empreinte source → empreinte du dérivé,
moteur, version du gabarit) — l'original intact (R138). Sans gabarit : extraction brute
seule, tracée. Le gabarit se modifie par le chemin des paramètres (motivé, daté, R125/R126) ;
un dérivé produit garde À VIE la version du gabarit qui l'a produit.

> **OC-01** gabarit → champs candidats + dérivé signé + événement · **OC-02** non classé →
> refus explicite ; sans gabarit → brut tracé · **OC-05** gabarit modifié par `ecrire` →
> les nouvelles extractions suivent, les anciennes gardent leur version

## R175 — L'authenticité est un RAPPORT de contrôles, jamais un verdict

Le gabarit déclare ses **contrôles** (cohérence de dates, somme de contrôle MRZ, expiration,
format, présence des champs obligatoires…). Le moteur les exécute et produit un **rapport**
`{contrôle → PASSE|ECHEC|INAPPLICABLE}` avec synthèse — en dérivé, tracé. Un échec **crée un
signal** (tâche d'examen), il ne bloque rien (R39) et ne qualifie pas le document : **l'humain
qualifie** (pattern R44). Le rapport ne se rejoue pas pour une même version+gabarit
(idempotence — la voie du scalable : par événement, jamais deux fois le même travail).

> **OC-03** contrôles du gabarit exécutés, échec → signal tracé, rien de bloqué ·
> **OC-06** re-extraire la même version+gabarit → refus « déjà produit »

## R176 — La digitalisation PROPOSE, le formulaire dispose

Le gabarit porte son **mapping** vers les champs cibles (section/question KYC, fiche GED…).
La digitalisation produit des **propositions** `{cible, valeur, confiance, source}` en
attente — rien n'entre dans un formulaire sans un **acte humain** d'acceptation (jeton,
tracé), champ par champ ou en lot. L'écriture réelle passe par un **port de formulaire**
(`FormPort` — le KYC réel y est compatible ; injection = déploiement). Chaque valeur
acceptée garde sa provenance : document, version, gabarit, confiance — l'audit remonte du
formulaire au pixel.

> **OC-04** propositions générées ; accepter = acte qui écrit par le port et trace la
> provenance ; refuser = tracé ; rien n'écrit sans acte

## Implications techniques
| Point | Conséquence |
|---|---|
| Modèle | `OcrExtraction` (tenantId, documentId, versionId, gabaritVersion, moteur, champs Json, controles Json, shaSource, shaDerive, at) — unique (versionId, gabaritVersion) — RLS |
| Modèle | `OcrProposition` (tenantId, extractionId, cible Json, valeur, confiance, statut EN_ATTENTE|ACCEPTEE|REFUSEE, decidePar?, decideAt?) — RLS |
| Service | `ocr/ocr-extraction.service.ts` : `extraireTypee` (R174), contrôles (R175), `proposer` / `accepter` / `refuser` (R176) — port OCR déclaré (R138), FormPort |
| Paramètres | `gedDocTypes[].extraction` = { version, champs[], controles[], mapping[] } — AUCUNE clé nouvelle |
| Événements | `ocr.extraction.produite` · `ocr.controle.echec` · `ocr.proposition.*` |
| Scalable | idempotence par (version, gabarit) ; traitement par événements ; moteur = port (tesseract → prestataire industriel sans changer une règle) |
| À suivre | écran de vérification (champs surlignés sur le document, accepter/refuser au clic) — lot UI dédié |

Tests : OC-01..06 (`ocr-extraction.wiring.spec.ts`), écrits **avant** l'implémentation.

`RATIFIÉ le 21.07.2026 par Ali Gharsallah`
