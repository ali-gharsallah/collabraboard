# CANON — VAGUE DE CLÔTURE PRÉ-PILOTE (enregistré 2026-07-29, statut RATIFIÉ)

**Étape 0 ratifiée (Ali)** : canon R325-R327 → dépôt **R328-R330** (R325-R327 pris par le
solde des 4 écarts). Familles **JW/DM/RZ libres**, conservées.

| Canon PO | Dépôt | Objet | État réel constaté (publié avant code, ratifié) |
|----------|-------|-------|--------------------------------------------------|
| R325 | **R328** | Le contexte vient du jeton — les en-têtes meurent | LARGEMENT FAIT (guard global RS256/JWKS, 0 en-tête API+harnais, jetons réels partout) → livrer le RELIQUAT : JW-01 énumération du routeur, JW-02 formalisé 5 modules, JW-04 rotation via guard, suppression du mode `headers` du FRONT, JW-05 expiration→login propre |
| R326 | **R329** | Tenant de démo GWB — scripté, rejouable, jamais mêlé | seed §11 minimal existant → REFONTE : histoire complète par les VRAIES APIs, idempotence PAR RÉFÉRENCES (remplace le refus de double semis), personas, DEMO-SCRIPT.md, run Olivia v2 inclus |
| R327 | **R330** | Readiness & pipeline | À CRÉER (/readyz agrégé, smoke, pipeline humain) ; Redis vérifié seulement si REDIS_URL (pas de files au dépôt), relais outbox = worker in-process |
| §4.a | — | Grille 100 % | ~23/72 écrans détaillés → ~49 à passer |
| §4.b | — | Index sans suspens | prospects DÉJÀ tranché (verdict 0b.1 appliqué) ; sbowner DÉJÀ couvert (mapping consigné) → formaliser |
| §4.c | — | Olivia v2 | DÉJÀ EXÉCUTÉ INTÉGRALEMENT (R259-R266, SW-01..18 verts) → constat + run de démo au seed |

Le texte du canon PO fait foi pour le contenu des règles (JW-01..06, DM-01..06,
RZ-01..04, directives 4.a/4.b). Interdits repris : route hors liste blanche sans
guard · en-tête de contexte résiduel (code OU harnais OU front) · INSERT direct dans
le seed · branche `demo` dans le code produit · bascule sans smoke verts · copie du
ContextBuilder · code avant test. Ordre ratifié : R328 → R330 → R329 → 4.a → 4.b →
constat 4.c.
