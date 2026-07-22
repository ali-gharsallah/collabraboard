# Décalage Frontend ↔ Backend — cartographie prouvée

**Vérifié au 2026-07-22 par diagnostic automatisé.** Chaque ligne est adossée à une commande
shell réellement exécutée (sorties brutes ci-dessous). `master` = `dad0ae4`.
Note de chemins : ce dépôt utilise `apps/api/src` (backend) et `apps/web/src` (frontend), pas
`backend/`/`frontend/`.

---

## VERDICT (binaire et chiffré)

- **Écrans frontend réellement câblés au backend : 5 / 5** (tous appellent une vraie route ; preuve §2).
- **Écrans vivant uniquement sur seed : 0** (les seeds ne sont que des *fallbacks*, jamais l'unique source).
- **Fallback seed : MIXTE — silencieux pour les LECTURES** (`apiGet` retourne le seed sans bandeau : `ClientsList`, registre AML) — **visible pour `KycDetail` et les ÉCRITURES** (« Mode démo : API non connectée »). Le silence sur `ClientsList` est un **risque de due diligence**.
- **Démo HTML : maquette SÉPARÉE, HORS dépôt** (`olive-demo.html` absent ; le smoke test pointe `file:///mnt/user-data/outputs/olive-demo.html`). Ce **n'est pas** le vrai produit.
- **Décalage front↔back : IMPORTANT en COUVERTURE, FAIBLE en câblage.** Le vrai frontend = **5 écrans / 4 onglets** ; le backend expose **75 routes**. Ce qui existe côté front est réel, mais il ne couvre qu'une **fine tranche** du backend.

---

## 1. Inventaire des deux côtés

### Backend — 75 routes HTTP (hors specs)
```
$ grep -rnE "@(Get|Post|Patch|Put|Delete)\(" apps/api/src --include=*.ts | grep -v .spec.ts | wc -l
75
```
Controllers porteurs (`@Controller`) : `aml, auth, clients, crm, ged, ia/prerevue, islamic, kyc,
onboarding, parametres, workload` (+ fichiers schema-adapter de référence). Extrait des chemins
réellement décorés : `kyc` (13 routes : POST, GET :code, PATCH questions, visas, validate, lock,
handoff…), `ged` (8), `islamic` (10), `clients` (3), `parametres` (3), `workload` (6), `aml` (2),
`crm` (4).

### Frontend — appels réseau réels
```
$ grep -rhoE "/v1/[a-z:/-]+" apps/web/src | sort -u
/v1/clients
/v1/islamic/evaluer
/v1/islamic/zakat
/v1/kyc            /v1/kyc/
/v1/parametres     /v1/parametres/registre     /v1/parametres/valeur/
```
Fichiers frontend appelant le réseau : `features/clients/ClientsList.tsx`, `features/kyc/KycCreate.tsx`,
`features/kyc/KycDetail.tsx`, `features/aml/AmlParametres.tsx`, `features/islamic/FinanceIslamique.tsx`,
via `lib/api.ts` (`apiGet`) ou `fetch` direct.

## 2. Table de correspondance (le cœur)

| Écran frontend | Appelle une vraie route backend ? | Source des données |
|---|---|---|
| **Clients** (`ClientsList.tsx`) | **OUI** — `apiGet("/v1/clients")` → `clients.controller @Get()` | API réelle **+ seed** `seed/clients.json` en fallback (**silencieux**) |
| **KYC création** (`KycCreate.tsx`) | **OUI** — `apiGet("/v1/clients")` + `fetch POST /v1/kyc` → `kyc.controller @Post()` | API réelle ; dropdown clients fallback `{data:[]}` (silencieux) ; submit **visible** « Mode démo » |
| **KYC détail** (`KycDetail.tsx`) | **OUI** — `fetch /v1/kyc/:code`, `POST …/visas/:section`, `PATCH …/questions/:q`, `POST …/validate` → `kyc.controller` (@Get/@Patch/@Post) | API réelle ; base absente → **visible** « Mode démo : API non connectée » |
| **Paramétrages AML** (`AmlParametres.tsx`) | **OUI** — `apiGet("/v1/parametres/registre")` + `fetch POST /v1/parametres/valeur/:cle` → `parametres.controller` | API réelle ; registre fallback `SEED` (**silencieux**) ; écriture **visible** « Mode démo » |
| **Finance Islamique** (`FinanceIslamique.tsx`) | **OUI** — `fetch POST /v1/islamic/zakat`, `POST /v1/islamic/evaluer` → `islamic.controller` | API réelle ; base absente → `{_demo:true}`, l'UI **masque** la sortie (ni donnée ni bandeau) |

Chaque route ci-dessus **existe** côté backend (prouvé §1). **5 écrans, 5 câblés, 0 mensonge de câblage.**

## 3. Les seeds — quantifier la vitrine
```
$ find apps/web \( -iname "*seed*" -o -iname "*mock*" -o -iname "*fixture*" \)  → apps/web/src/seed (dossier)
   fichier : apps/web/src/seed/clients.json
$ grep -rn "seed|SEED" apps/web/src
   ClientsList.tsx:3  import seed from "../../seed/clients.json"
   AmlParametres.tsx:11  const SEED: Entree[] = [ … ]   (seed INLINE)
```
- **1 fichier de seed** (`seed/clients.json`) + **1 seed inline** (`AmlParametres` registre).
- Consommateurs : `ClientsList` (clients.json), `KycCreate` (fallback vide), `AmlParametres` (SEED inline).
- **Écrans vivant UNIQUEMENT sur seed (jamais l'API) : 0.** Tous tentent l'API d'abord.

## 4. Le mécanisme de fallback
```
apps/web/src/lib/api.ts
  export async function apiGet<T>(path, seed): Promise<T> {
    const base = (window as any).OLIVE_API_URL;
    if (!base) return seed;                 // ← LECTURE : fallback SILENCIEUX
    try { … if (!r.ok) throw …; return json } catch { return seed; }   // ← erreur : SILENCIEUX
  }
```
Comportement quand `OLIVE_API_URL` est absent, écran par écran :
- `ClientsList` (apiGet) → **SILENCIEUX** : affiche les clients du seed, aucun indicateur. **← risque DD.**
- `AmlParametres` lecture registre (apiGet) → **SILENCIEUX** (SEED) ; écriture → **VISIBLE** `setMsg("Mode démo : API non connectée")`.
- `KycCreate` dropdown (apiGet) → silencieux (vide) ; submit → **VISIBLE** `setErr("Mode démo…")`.
- `KycDetail` → **VISIBLE** : `if (!base) return <p>Mode démo : API non connectée.</p>`.
- `FinanceIslamique` → `{_demo:true}`, l'UI n'affiche rien (semi-visible, pas de bandeau).

**Conclusion §4** : le fallback est **mixte** ; les **lectures** (`apiGet`) sont **silencieuses** (l'utilisateur peut croire voir du réel alors que c'est du seed — cas `ClientsList` et registre AML), les **écritures** et `KycDetail` sont **explicites**.

## 5. La démo HTML vs le vrai frontend
```
$ find . -iname "olive-demo*" -o -iname "*demo*.html"   → ABSENT (aucun olive-demo.html)
$ grep DEMO_URL tests/demo/helpers.mjs
   export const DEMO_URL = process.env.DEMO_URL || "file:///mnt/user-data/outputs/olive-demo.html";
$ find . -iname "*.html" (hors node_modules/dist)
   services/workflow-engine-py/ui/index.html (156 l., moteur Python, sans rapport)
   apps/web/index.html (3 l., point d'entrée Vite)
$ cat apps/web/src/app/router.tsx  → 4 onglets : Clients, KYC, Paramétrages AML, Finance Islamique
$ grep -rE "export function [A-Z]" apps/web/src/features | wc -l  → 5 composants d'écran
```
**Verdict §5** : les « ~60 écrans » de la démo **n'existent PAS dans le vrai frontend**. `olive-demo.html`
est un **artefact séparé, hors dépôt** (chemin externe `/mnt/user-data/outputs/`). Le **vrai produit
React** = **4 onglets / 5 composants d'écran**. La démo HTML est une **maquette de vente distincte,
bien plus riche que le produit** — exactement le « risque de dérive démo vs produit » déjà noté dans
`PLAN-EXECUTION.md`.

---

## Synthèse chiffrée

| Mesure | Valeur prouvée |
|---|---|
| Routes backend exposées | **75** |
| Écrans frontend réels | **5** (4 onglets) |
| Écrans câblés au backend | **5 / 5** |
| Écrans seed-only | **0** |
| Fichiers de seed | 1 (`clients.json`) + 1 inline |
| Fallback lectures | **silencieux** |
| Fallback écritures / KycDetail | visible (« Mode démo ») |
| Démo `olive-demo.html` | **absente du dépôt** (artefact externe) |

**Le décalage n'est pas un mensonge de câblage** (les 5 écrans appellent de vraies routes) **mais un
décalage de COUVERTURE** : un frontend mince (5 écrans) sur un backend riche (75 routes), doublé d'une
maquette de démo externe (~60 écrans) qui n'est pas le produit. Priorité produit : construire les
écrans réels manquants (GED, screening, MROS, risk cases, workflow, transactions…) et **rendre le
fallback lecture visible** (bandeau « données de démonstration ») pour lever le risque de due diligence.
