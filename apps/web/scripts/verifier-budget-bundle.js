#!/usr/bin/env node
/**
 * BUDGET BUNDLE (dette qualité §4 du canon du dégel, 2026-07-28) — bloquant en CI.
 * Le poids se MESURE (gzip réel, pas une estimation) et le dépassement rend le build ROUGE :
 * un budget silencieusement dépassé n'existe pas (même doctrine que les listes blanches R264).
 * État au jour du budget : total 158.9 kB gz, plus gros chunk 50.2 kB gz (73 onglets lazy).
 * Relever un budget = un commit motivé qui édite CES constantes — jamais un contournement.
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// 2026-08-05 : budget maintenu à 220 (« pull ar out », décision PO). Les PACKS DE LANGUE à
// chargement PARESSEUX (import dynamique, ex. l'arabe `i18n-ar-*.js`) sont téléchargés À LA DEMANDE
// par les seuls utilisateurs qui choisissent la langue — ils ne pèsent PAS sur le chargement INITIAL
// que ce budget garde. On les MESURE et on les AFFICHE (transparence, pas un trou), mais on les
// EXCLUT du total de base. Ajouter un pack de langue n'inflate donc plus le bundle core.
// 2026-08-07 (P-L6-3, commit motivé) : 220 → 225. L'écran screening affiche désormais la
// DÉCOMPOSITION du moteur (R411), la version de liste et la config du run, plus le bandeau
// d'âge des listes (R409) — ~1 kB gz de plus, et le budget était déjà à fleur (mesure locale
// 220.4 sur le commit précédent). Marge résiduelle ≈ 4 kB, pas un blanc-seing.
// 2026-08-07 (câblage back→front, commit motivé) : 225 → 240. CINQ écrans neufs câblent les
// familles de routes jusqu'ici sans consommateur (rapports/KPI, gouvernance O, pré-revue IA,
// workload, surveillance-es) + goAML/déploiements dans deux écrans existants — mesure 232.8
// (tous en chunks LAZY : le chargement initial ne bouge pas, mais ce budget somme TOUS les
// chunks hors packs de langue). Marge résiduelle ≈ 7 kB, pas un blanc-seing.
// 2026-08-10 (UI v2 étapes 1+2, commit motivé) : 240 → 250. Le handoff ratifié (plan validé
// PO 10.08.2026) ajoute la couche opt-in ui2 : tokens.css + shell (Nav/Headers/Shell) +
// 4 composants transverses + aperçu — UN chunk LAZY (route « ui2 », le chargement initial ne
// bouge pas) mesuré à ~5,9 kB gz ; mesure totale 242.7. Marge résiduelle ≈ 7 kB — les étapes
// suivantes du handoff (Ma journée, ⌘K…) motiveront CHACUNE leur relèvement, jamais un trou.
// 2026-08-10 (UI v2 étapes 3–5, commit motivé) : 250 → 260. Arbitrage PO « Lucide » : le jeu
// d'icônes vectoriel remplace les glyphes Unicode (tree-shaké, embarqué au build — aucun appel
// sortant, on-premise) ; + écran 02 « Dossier KYC » (FieldCard/SectionChecklist) et palette ⌘K.
// Tout reste dans le chunk LAZY ui2 (chargement initial inchangé) — mesure 250.8. Marge ≈ 9 kB.
// 2026-08-10 (UI v2 étapes 6–8, commit motivé) : 260 → 270. Les cinq derniers écrans maquettés
// du handoff (03/05 Surveillance, 06/07 Revue+CoC, 08/09/10 Pilotage/Audit/Sandbox) et leurs
// composants (DecisionPanel, DiffTable/DiffRow, ImpactPreview, SandboxSlider, BarMeter) —
// toujours DANS le chunk LAZY ui2, le chargement initial ne bouge pas. Mesure 262.7 à la fin
// de l'étape 8. Marge ≈ 7 kB pour l'étape 9 (migrations par patterns), pas un blanc-seing.
// 2026-08-10 (V2-M1/M2, commit motivé) : 270 → 280. Migration des modules dans le shell v2 :
// M1 Connaissance client (sections réelles /v1/kyc, onglets GED/Corroboration/Cross-border,
// mesure 268.9) puis M2 Surveillance (file screening /v1/screening/hits, règles AML en
// consultation /v1/aml/referentiel, onglet Transactions /v1/txflux — mesure 270.3). Toujours
// dans le chunk LAZY ui2 (chargement initial inchangé). Annoncé au PO à la clôture de M1.
// Marge ≈ 10 kB pour M3..M6, chaque lot reste un commit motivé — jamais un trou.
// Relève 280 → 290 (V2-M9, 10.08.2026) : demande PO « modification des noms de champs et
// composition de tableau depuis paramétrage comme dans la v1 » — éditeurs en formulaire
// matrice doc + questionnaire (ParamEdit, circuit Builder R304-R308 : brouillon → diff →
// R305 → R7/R13). Mesure 282.4 ; toujours dans le chunk LAZY ui2, chargement initial inchangé.
// Relève 290 → 300 (V2-M18, 11.08.2026) : l'audit V2-M17 a nommé le manque le plus coûteux —
// quatre écrans montraient sans permettre d'agir. Rendre les actes (MROS, habilitations,
// veille, registre) coûte ~1,3 kB gz, et la marge restante après V2-M16 était de 0,8 kB. Les
// lots suivants comblent 16 capacités absentes : une marge de 10 kB est le minimum honnête
// pour ne pas relever ce budget à chaque commit. Mesure : 290,5 avant relève.
// Relève 300 → 310 (V2-M29, 11.08.2026) : Cross-Border devient un écran de plein droit —
// six onglets couvrant les six familles de routes du moteur (E-V2-1 soldé), ~5,5 kB gz.
// Mesure 299,3 avant relève : la marge de 10 kB ouverte au lot V2-M18 est consommée.
// CE QUE CETTE RELÈVE DIT AUSSI, ET QU'IL FAUT LIRE : il reste NEUF écrans verticaux à bâtir
// (PMS, Custody & TA, FX, Mobile, Finance Islamique, Legal, OpRisk, et les deux CPSI). Au même
// coût unitaire, les relever un par un mènerait ce budget à ~360 — ce serait un budget qui
// suit la dette au lieu de la tenir. Les verticaux sont pourtant LICENCIÉS : un tenant sans
// †CROSSBORDER ne devrait jamais télécharger cet écran. Le prochain lot vertical passera donc
// par un chargement PARESSEUX par module et un compartiment borné dans cette garde — même
// doctrine que les packs de langue et le globe — et non par une nouvelle relève.
// Relève 310 → 315 (V2-M47, 12.08.2026) : les QUATRE capacités v1 dont l'onglet de destination
// n'existait pas — Exigences et Pré-revue IA au dossier KYC, Runs Olivia et Instances en cours au
// Paramétrage — plus la propagation du message de refus du moteur en lecture (FE-04b). Mesure
// 308,1 avant, 310,8 après : +2,7 kB gz pour quatre écarts fermés. Relève de 5 kB seulement, et
// pas de 10 : les NEUF verticaux restants (PMS, Custody & TA, FX, Mobile, Finance Islamique,
// Legal, OpRisk, les deux CPSI) ne doivent PAS passer par une relève — l'arbitrage écrit à la
// relève précédente tient toujours : chargement PARESSEUX par module licencié et compartiment
// borné dans cette garde. Une marge courte est ici volontaire — elle force cette conversation
// au prochain lot vertical au lieu de la reporter.
// BAISSE 315 → 310 (V2-M49, 12.08.2026) — dans l'autre sens, et c'est le point. Sortir les
// modules licenciés du socle rend 8 kB au cœur (312,8 → 304,7 mesurés). Garder 315 aurait
// transformé un gain d'architecture en marge dormante, c'est-à-dire en autorisation tacite de
// grossir. Le budget redescend donc, et la marge reste courte (≈ 5 kB) : les neuf verticaux à
// venir n'ont plus besoin d'elle — ils ont leur compartiment.
// BAISSE 310 → 302 (V2-M53) : verser la couche v1 des modules † rend ~7,7 kB au cœur
// (305,3 → 297,6 mesurés). Même doctrine qu'à la baisse précédente : une marge gagnée par
// l'architecture ne reste pas dormante — le budget suit la mesure, dans les deux sens.
const BUDGET_TOTAL_KB = 302;   // somme gzip du bundle de BASE (hors packs de langue paresseux)
const BUDGET_CHUNK_KB = 80;
const BUDGET_GLOBE_KB = 60;    // le globe paresseux reste borné (mesure 51,9 — marge 8 kB)    // aucun chunk gzip au-delà (l'index inclus — le shell reste mince)
const EST_PACK_LANGUE = (f) => /^i18n-ar[-.]/.test(f);  // packs de langue à chargement paresseux
// Globe des flux (V2-M19) : atlas mondial vendorisé + d3-geo, ~53 kB gz. MÊME DOCTRINE que les
// packs de langue — chargé PARESSEUSEMENT à l'ouverture de l'onglet Transactions, donc jamais
// payé au chargement initial. On le MESURE et on l'AFFICHE (transparence, pas un trou), mais on
// l'EXCLUT du total de base : l'inclure ferait rougir un budget que le premier écran ne consomme
// pas. La garde reste entière — si le globe cessait d'être paresseux, il rentrerait dans le core.
const EST_GLOBE = (f) => /^GlobeFond[-.]/.test(f);   // renommé en V2-M22 (le canvas seul)

// ── V2-M49 : LE COMPARTIMENT DES MODULES LICENCIÉS ────────────────────────────────────────
// Les capacités dont la licence porte un † (crossborder, custody, fx, islamic, legal, mobile,
// oprisk…) ne sont PAS du socle : un tenant qui ne les achète pas ne doit pas les télécharger.
// Elles sortent donc du budget de base, comme les packs de langue et le globe — mais à la même
// condition, écrite noir sur blanc dans ce fichier depuis V2-M22 : un chunk paresseux reste
// BORNÉ, sinon « paresseux » devient le tiroir où l'on range ce qu'on ne veut pas mesurer.
// D'où DEUX plafonds, pas un : chaque module, et la SOMME de tous.
//
// La liste est EXPLICITE, jamais un joker `*` : un nouveau chunk ne s'exonère pas du budget en
// choisissant son nom de fichier. Elle est tenue en accord avec `capacites.ts` par la garde
// U2-70 — si un écran de module licencié est bâti sans entrer ici, le front rougit.
// V2-M53 (arbitrage PO « verse la couche v1 au compartiment », E-V2-18 soldé) : les écrans V1
// des modules † rejoignent le compartiment. Ils étaient DÉJÀ paresseux dans le routeur v1 —
// il ne leur manquait que l'entrée ici, et ils pesaient donc sur le budget du socle sans
// qu'aucun tenant non licencié ne les télécharge jamais au chargement initial.
// Deux précisions d'inventaire, dites plutôt que découvertes plus tard :
//   · le chunk v1 `CrossBorder` était DÉJÀ compté — même préfixe de nom que l'écran v2, le
//     matcher l'attrapait par accident. L'accident devient une décision : les deux couches du
//     même module † vivent dans le même compartiment.
//   · `PmsMandats` N'ENTRE PAS : la licence de PMS ne porte pas de † (ce n'est pas un module
//     vendu à part au registre des capacités). E-V2-18 le listait à tort — corrigé là-bas.
const MODULES_LICENCIES = [
  "CrossBorder", "Custody", "Oprisk", "Legal",                 // couche v2 (Ui2Preview, lazy)
  "CustodyTa", "LegalRegistre", "OpRisk", "MobileAdmin",       // couche v1 (router.tsx, lazy)
  "FxExposition", "FinanceIslamique",
];
const BUDGET_MODULE_KB = 40;                            // un module licencié reste mince
const BUDGET_MODULES_TOTAL_KB = 120;                    // …et leur somme aussi (9 verticaux à venir)
const EST_MODULE_LICENCIE = (f) =>
  MODULES_LICENCIES.some((m) => new RegExp(`^${m}[-.]`).test(f));

const dir = path.join(__dirname, "..", "dist", "assets");
if (!fs.existsSync(dir)) { console.error("dist/assets absent — lancer `vite build` d'abord"); process.exit(1); }

let total = 0, packsLangue = 0, globe = 0, modules = 0; const horsBudget = [];
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".js"))) {
  const kb = zlib.gzipSync(fs.readFileSync(path.join(dir, f))).length / 1024;
  if (EST_PACK_LANGUE(f)) { packsLangue += kb; continue; }   // pack de langue paresseux : hors budget core
  if (EST_MODULE_LICENCIE(f)) {                              // module † : hors socle, mais BORNÉ
    modules += kb;
    if (kb > BUDGET_MODULE_KB) horsBudget.push(`MODULE LICENCIÉ — ${f} : ${kb.toFixed(1)} kB gz > ${BUDGET_MODULE_KB} kB`);
    continue;
  }
  if (EST_GLOBE(f)) {                                        // globe des flux paresseux : hors budget core
    globe += kb;
    // ...mais PAS hors garde : un chunk paresseux reste borné, sinon « paresseux » devient un
    // fourre-tout où l'on range ce qu'on ne veut pas mesurer.
    if (kb > BUDGET_GLOBE_KB) horsBudget.push(`GLOBE — ${f} : ${kb.toFixed(1)} kB gz > ${BUDGET_GLOBE_KB} kB`);
    continue;
  }
  total += kb;
  if (kb > BUDGET_CHUNK_KB) horsBudget.push(`${f} : ${kb.toFixed(1)} kB gz > ${BUDGET_CHUNK_KB} kB`);
}
console.log(`budget bundle — core ${total.toFixed(1)} kB gz (budget ${BUDGET_TOTAL_KB}) + packs langue ${packsLangue.toFixed(1)} kB gz + globe ${globe.toFixed(1)} kB gz + modules licenciés ${modules.toFixed(1)} kB gz sur ${BUDGET_MODULES_TOTAL_KB} (${MODULES_LICENCIES.join(", ") || "aucun"}), tous paresseux à la demande, pire chunk sous ${BUDGET_CHUNK_KB} kB : ${horsBudget.length === 0 ? "oui" : "NON"}`);
if (modules > BUDGET_MODULES_TOTAL_KB)
  horsBudget.push(`MODULES LICENCIÉS (somme) : ${modules.toFixed(1)} kB gz > ${BUDGET_MODULES_TOTAL_KB} kB`);
if (total > BUDGET_TOTAL_KB) horsBudget.push(`CORE : ${total.toFixed(1)} kB gz > ${BUDGET_TOTAL_KB} kB`);
if (horsBudget.length) { horsBudget.forEach((l) => console.error("HORS BUDGET —", l)); process.exit(1); }
