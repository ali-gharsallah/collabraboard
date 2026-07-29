# CANON — DÉCISIONS PO : BACS À SABLE + CONSOLE ÉDITEUR (enregistré 2026-07-29, RATIFIÉ)

## Étape 0 — clarifications de numérotation (pré-autorisées « confirme l'équivalence et consigne »)

1. **Bacs à sable (sbkyc/sbbrm/sbcf/sbwf)** : le PO référence « R95 dans ta numérotation ».
   Constat dépôt : le patron sandbox est l'**application de R70** (bac obligatoire avant
   application) réalisée par **R94 (B-02)** sous `SandboxAml` ; la famille de scénarios est
   **BS-01..06** (ex-SB, renommée BS car SB-xx pris par SecretBox). **Il n'existe pas de R95.**
   Équivalence consignée : *canon « R95 » = R70 (règle d'origine) appliquée via R94/B-02,
   famille BS — aucune règle nouvelle mintée.*

2. **Console éditeur (editorconsole)** : le PO référence « R316 ». Constat dépôt : le mapping
   +3 de la vague de clôture place **R316 = Mobile Banking** ; la console vendor est
   **R319 (instance séparée, EDITOR jamais au RBAC tenant)** et **R320 (licence signée
   descendante)**, scénarios **VE-01..03**. Équivalence consignée : *canon « R316/R317 » =
   dépôt R319/R320 (pré-mapping +3).*

## Décision 1 — les 4 bacs (RATIFIÉ, livré autrement que prévu — écart consigné)

CONSTAT à l'étape 0 : les 4 bacs étaient **déjà intégralement livrés** — endpoints
`/v1/sandbox/{kyc-droits,brm-seuils,cf-exigences,wf-delais}` (module sandbox), hub
`Sandboxes.tsx` (aucun « Appliquer », pont « Ouvrir dans le paramétrage » BS-06), tests
`fat-bs` 5/5 verts dont **BS-01 (zéro mutation, comptages byte-identiques)**. Refaire
4 commits eût dupliqué du code testé (interdit anti-redondance).

RÉSOLUTION RATIFIÉE (AskUserQuestion, 2026-07-29) : **4 onglets deep-link** (sbkyc/sbbrm/
sbcf/sbwf) ouvrent le hub FOCALISÉ sur leur bac (ancre + surbrillance) — la maquette (4 items
de nav) est couverte **1:1**, le hub reste UN écran (BS-01..06 inchangés). Comptage front
tenant : **71/72** (seul editorconsole absent, par canon).

## Décision 2 — editorconsole (RATIFIÉ)

Absence du front tenant **CONFORME au canon R319** (instance vendor séparée, EDITOR jamais au
RBAC tenant — VE-01 test négatif permanent, déjà vert dans `fat-degel-v8`). À scaffolder :
`apps/editor-console` (app vendor séparée : déploiement/base/IAM propres) + registre
d'instances clientes + émission de licences signées (clé privée vendor → vérifiée côté tenant,
R320). — livré au commit suivant.
