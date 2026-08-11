# Référentiel des règles de détection — inventaire inter-moteurs

> Établi au lot **V2-M13** (11.08.2026). Le dépôt fait foi : chaque ligne est vérifiée dans le
> code cité, jamais reprise d'un document. Ce fichier est un **inventaire**, pas une source de
> vérité : les sources restent les référentiels cités en tête de chaque famille.

## Pourquoi ce document

La question « quelles sont les règles AML ? » n'avait pas de réponse unique dans le dépôt.
Le module `aml` en porte deux référentiels, mais des règles de **même nature** (détection d'un
comportement, seuil paramétrable, signal levé pour revue humaine) vivent aussi dans le module
`islamic` et dans la bibliothèque de scénarios CPSI. Compter 82 règles — les deux référentiels
`aml` seuls — sous-estimait le dispositif de **46 règles**. Le total réel est **128**.

## Les quatre familles

| Famille | Plage | Règles | Seuils | Source | Statut |
|---|---|---:|---:|---|---|
| Surveillance transactionnelle | R189–R206 | 18 | 20 | `apps/api/src/modules/aml/aml-scoring.engine.ts` | moteur |
| AML Gap, vagues 1 et 2 | R340–R403 | 64 | 80 | `apps/api/src/modules/aml/aml-gap.referentiel.gen.ts` | moteur |
| Conformité Shariah | R207–R221 | 15 | 5 | `apps/api/src/modules/islamic/islamic-screening.engine.ts` | moteur |
| Bibliothèque de scénarios CPSI | R71–R76 | 31 | 84 | `apps/web/src/parity/cpsi-data-support.ts` | **front de démonstration** |
| **Total** | | **128** | **189** | | |

### 1. Surveillance transactionnelle (R189–R206) — 18 détecteurs

Structuring, cross-border circulaire, unusual velocity, sanctions, UBO mismatch, in/out same day,
third-party payer, flux circulaire, juridiction HRI, montants ronds, cash + wire, PEP adjacent,
sous-paiement de factures, counterparty velocity, CRS/FATCA, abus fiduciaire, minimisation
fiscale, concentration. Deux règles bloquantes : R192 (sanctions) et R197 (juridiction HRI).

Les 20 seuils sont des clés `aml*` du registre R-Q (`parametres.service.ts`), avec défaut,
type et règle porteuse.

### 2. AML Gap, vagues 1 et 2 (R340–R403) — 64 règles, 12 blocs

Screening en flux (7) · indices OBA-FINMA (5) · vision groupe UBO (4) · instruments PB (7) ·
crypto/VASP (6) · CFT (5) · gouvernance du dispositif (4) · TBML (8) · correspondent banking (7) ·
prolifération (3) · immobilier & art (3) · analytique 2G (5).

Référentiel **généré** par `tools/aml-gap/gen_aml_gap.py` ; le test de fraîcheur rougit si le
fichier dérive. Les 80 paramètres sont étalés dans `REGISTRE_RQ` via `AML_GAP_RQ`
(`apps/api/src/modules/parametres/aml-gap.rq.gen.ts`) — **16 sans défaut**, à poser à
l'initialisation du tenant sous peine de refus gracieux. Corpus de vérité terrain : 130 cas
(66 vrais positifs, 64 faux positifs). 8 règles bloquantes.

### 3. Conformité Shariah (R207–R221) — 15 règles

**8 détecteurs** : secteur haram (R207), riba (R208), maysir (R209), gharar (R210), sukuk non
certifié (R212), contrepartie au cœur de métier illicite (R213), entité caritative sous sanction
(R216), fonds ESG sans certification (R221).
**7 opérations** : Zakat (R211), Qard ul Hasan (R214), Mudaraba (R215), audit Shariah annuel
(R217), Waqf (R218), Takaful (R219), maturité sukuk (R220).

R209 est le **seul blocage automatique** du bloc. R216 est explicitement soustraite à
l'auto-blocage : une entité caritative islamique sous sanction part en **revue humaine** (R44).
5 paramètres au registre R-Q (`islamic*`).

### 4. Bibliothèque de scénarios CPSI — 31 scénarios, 6 domaines

Cash & espèces (4) · transferts & transfer agent (9) · activité transactionnelle (4) ·
trading & marchés (3) · **capital markets / CIB (4)** · **abus de marché (7)**.
84 seuils, définis **par groupe de pairs** (56 groupes : type d'entité, secteur, AUM,
juridiction, PEP, transactionnel, custody, transferts, post-marché, capital markets, classe
d'actifs, combinés).

**Réserve de statut.** Le moteur CPSI expose un constructeur (`definir_scenario_aml`,
`engine.py:444`) alimenté par `bridge.py`, mais la bibliothèque elle-même n'existe que dans
`apps/web/src/parity/cpsi-data-support.ts` — un fichier du **front v1**. Aucun référentiel du
dépôt ne la fournit au moteur. Ces 31 scénarios ne sont donc pas des règles gouvernées au même
titre que les trois autres familles ; les traiter comme telles serait présenter le front comme
le moteur, ce que le CLAUDE.md interdit explicitement.

## Le réglage — trois voies, et leurs limites

1. **Simuler** — `POST /v1/aml/sandbox` rejoue le moteur pur sur des contextes réels, seuils
   actuels puis simulés, et rend l'impact **nominatif** (alertes nouvelles/disparues, par client,
   avec le fait et le seuil franchi). Aucune écriture (R70/R94).
2. **Appliquer** — `POST /v1/parametres/valeur` : acte gouverné, motif et date obligatoires
   (R126/R29), pop-up d'engagement R445. Versionné par date d'effet : un dossier garde la version
   en vigueur à sa création, l'évaluation se rejoue contre elle (R48).
3. **Mesurer** — `POST /v1/aml/eval/backtest-version` (GV-02/R375) mesure le rappel d'une version
   candidate sur le corpus GT **avant** application et propose un retour arrière. Complété par la
   campagne below-the-line (R374), le contrôle de qualité des données (R376) et la revue annuelle
   de calibrage (R377).

### Écarts constatés (à arbitrer, non corrigés ici)

- **E-AML-1** — pour les 64 règles AML Gap, le moteur *lit* une version de scénario par tenant
  (`aml_scenarios`, R29) mais **aucune route ne l'écrit** : le réglage passe uniquement par les
  clés R-Q. Le versionnement par scénario est un modèle de données prêt, pas une capacité exposée.
- **E-AML-2** — la bibliothèque CPSI (31 scénarios, 84 seuils) n'a pas de référentiel côté dépôt
  (cf. réserve ci-dessus). Cible proposée : un générateur sur le modèle de `gen_aml_gap.py`, avec
  étalement au registre R-Q et test de fraîcheur.
- **E-AML-3** — les surfaces de gouvernance du dispositif (backtest par version, campagne BTL,
  contrôle DQ, revue annuelle de calibrage) existent en API et n'ont **aucun écran** en v2.
- **E-AML-4** — les 15 règles Shariah n'ont aucun écran en v2 (l'écran « Finance Islamique »
  existe en v1 et n'est pas repris, ni même référencé dans la cartographie ⌘K).

## Vocabulaire

- **Franchissement** : hit brut de détection, niveau moteur.
- **Signal scoré** : franchissement dédupliqué par (client, scénario), doté d'un score (R81).
- **Bloquant** : la règle émet une *demande* de blocage (`aml.block.requested`), consommée par le
  module transferts. Jamais un blocage exécuté ici — l'humain décide (R44).
