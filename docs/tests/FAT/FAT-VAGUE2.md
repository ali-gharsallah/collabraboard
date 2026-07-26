# Tests d'Acceptation Fonctionnelle — Vague 2 (Surveillance & Dossiers)

**Exécutés le 2026-07-22 contre le backend réel (4 FAT)** (`apps/api/test/e2e/fat-vague2.e2e-spec.ts`).
Preuve brute : `docs/tests/PREUVES/fat-vague2-run.txt`. Statut global : **4/4 PASS**.

Légende criticité : **C** = critique (bloquant recette) · **M** = majeur · **m** = mineur.

| ID FAT | Persona | Objectif métier | Préconditions | Étapes (langage humain) | Résultat attendu (métier) | Règle / exigence | Criticité | Statut |
|---|---|---|---|---|---|---|---|---|
| **FAT-DOSSIER-01** | Compliance Officer | Instruire un dossier de risque : consigner l'analyse **sans jamais pouvoir la réécrire**, et ne clôturer qu'avec un motif | Dossier ouvert depuis une alerte AML (R133) | 1. J'ajoute deux notes d'instruction. 2. Je relis l'historique. 3. Je fais avancer NOUVELLE → EN_ANALYSE. 4. Je tente de clôturer **sans** motif. 5. Je clôture **avec** motif. | Les **deux** notes persistées en ordre (append-only) ; EN_ANALYSE accepté ; clôture sans motif **refusée** (400, R7) ; clôture motivée → **CLOTUREE**. | R134 (append-only) · R133/R136 · R7 | **C** | ✅ PASS |
| **FAT-DOSSIER-02** | Compliance Officer | Un dossier ne peut sauter des états : la gouvernance des transitions est opposable | Dossier NOUVELLE | 1. Je tente NOUVELLE → CLOTUREE directement (avec motif). | **Refusé** (400, transition **illégale**) — seuls les états prévus sont atteignables. | R133 | **C** | ✅ PASS |
| **FAT-GED-01** | Compliance Officer / MLRO | Consulter les pièces d'un client, **filtrées à mon rôle** ; ne jamais voir le contenu, seulement l'empreinte | Type `PASSEPORT` réservé aux rôles CO/RM (R110) ; une pièce classée du client | 1. En **CO** (autorisé) je liste les pièces. 2. En **MLRO** (non autorisé) je liste. 3. J'ouvre la fiche de la pièce. | CO voit la pièce (≥1) ; MLRO voit **0** (filtrage au résultat) ; fiche = métadonnées + empreinte des versions (200), **jamais** le contenu. | R110 (rôle relu à l'acte) · R145 | **C** | ✅ PASS |
| **FAT-GED-02** | Compliance Officer | Les pièces d'un établissement sont **invisibles** d'un autre établissement | Pièce du tenant A | 1. Un CO du **tenant B** liste les pièces du client du tenant A. | **0** pièce (isolation RLS multi-tenant). | Isolation multi-tenant (RLS) | **C** | ✅ PASS |

**Écrans React associés** : `apps/web/src/features/dossiers/DossiersRisque.tsx` (instruction — notes append-only + transitions gouvernées) · `apps/web/src/features/ged/GedPieces.tsx` (consultation filtrée au rôle, fiche sans contenu). Construits **spec-first** (`spec/vague2-scenarios/VAGUE2-ECRANS.feature`), sur routes réelles, fallback seed **signalé** (`<DemoModeBanner/>` quand l'API n'est pas connectée).

**Note de périmètre** : Vague 2 n'ajoute **aucun modèle Prisma** — `RiskCase`, `Document`, `DomainEvent` préexistent. Les seules additions backend sont deux **portes HTTP** (`POST`/`GET /v1/riskcases/:id/notes`) déléguant à des méthodes de service **déjà ratifiées** (`noter`/`notes`). La boucle RLS FORCE reste inchangée ; l'isolation est prouvée à l'exécution (FAT-GED-02).
