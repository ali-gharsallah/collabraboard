import React, { useState } from "react";
import { Ui2Shell } from "./Shell";
import { Ui2Nav, Ui2NavId } from "./Nav";
import { Ui2HeaderDossier, Ui2HeaderListe, Ui2Bouton } from "./Header";
import { StatusChip } from "./StatusChip";
import { DecisionPanel } from "./DecisionPanel";
// La scène des flux (V2-M22) : le globe est le FOND de l'onglet Transactions, la table se lit
// par-dessus. Le panneau part avec l'écran (~2 kB) ; seul le canvas (d3 + atlas, ~52 kB gz) est
// paresseux et exclu du budget cœur — la table ne doit jamais attendre le décor.
import { FluxPanneau } from "./globe/FluxPanneau";
import { DiffTable } from "./DiffRow";
import { EntityList } from "./Listes";
import { useApiOrSeed } from "../lib/useApiOrSeed";
import { listeReglesAml, listeHitsScreening, listeSignauxAml, listeCasRisque,
  configScreening, listeRunsScreening, DEFAUTS_R413, DEFAUTS_R409 } from "./moteur-formes";
import { exporterCsv, jourFichier } from "./actions";
import { traduire, langue } from "../lib/i18n";
import { MODULES_METIERS_DEMO } from "./modules-metiers";
import { useActeMoteur, RetourActe, BarreActes, ActeMoteur } from "./acte-moteur";
// V2-M60 : LA FilterBar mutualisée (R404/R-FB.1) — une seconde copie serait la dérive que le
// composant existe pour empêcher.
import { FilterBar } from "../components/FilterBar";

/**
 * UI v2 — étape 6 : Surveillance — écrans 03 « AML Investigation » et 05 « Screening ».
 * Deux dossiers du même bloc de nav, bascule par l'action d'en-tête. Le DecisionPanel est le
 * visage de la décision unifiée (motif obligatoire repris tel quel, effets annoncés AVANT,
 * second regard rappelé) ; sur une alerte CRITIQUE, Olivia fournit du CONTEXTE et ne propose
 * AUCUNE décision (principe n°4 du handoff, R44). La DiffTable rend la divergence à la ligne.
 */

const nombre = (s: string) => <span className="mono">{s}</span>;

// ── V2-M2 : les listes RÉELLES de la Surveillance, sources signalées ───────────────────────
// File screening (/v1/screening/hits, R411 — sujet × temps, config du run référencée) ;
// règles AML en CONSULTATION (/v1/aml/referentiel — la modification passe par le bac à
// sable de l'écran 10) ; transactions (/v1/txflux). Les seeds miment ces formes.
type Hit = { id: string; sujet?: string; nom?: string; liste?: string; score?: number;
  statut?: string; at?: string };
const SEED_HITS: Hit[] = [
  { id: "hit-1", nom: "Andrei Volkov", liste: "UE consolidée 2026-07-31", score: 0.92, statut: "OPEN", at: "10.08.2026" },
  { id: "hit-2", nom: "Cedar Maritime Ltd", liste: "OFAC SDN 2026-07-28", score: 0.71, statut: "FAUX_POSITIF", at: "06.08.2026" },
  { id: "hit-3", nom: "Farid El-Masri", liste: "SECO 2026-07-30", score: 0.64, statut: "FAUX_POSITIF", at: "03.08.2026" },
];
// ── V2-M32 — AML GAP (R340–R403, 64 règles réparties en 7 blocs). Le seed ci-dessous est
// un ÉCHANTILLON représentatif : le référentiel complet est servi par /v1/aml/scenarios et
// vit dans le générateur (tools/aml-gap/gen_aml_gap.py). On ne recopie pas 64 règles dans un
// écran — un référentiel dupliqué à la main dérive, et c'est la copie qu'on finit par lire.
type ScenarioGap = { code: string; ruleRef?: string; famille?: string; blocTitre?: string;
  titre?: string; niveau?: number | null; blocking?: boolean; signal?: string };
const SEED_GAP: ScenarioGap[] = [
  { code: "SF-01", ruleRef: "R340", famille: "SF", blocTitre: "Screening en flux", titre: "Contrepartie PEP en flux", niveau: 2, blocking: false, signal: "PEP_CONTREPARTIE" },
  { code: "SF-03", ruleRef: "R342", famille: "SF", blocTitre: "Screening en flux", titre: "Contrepartie sanctionnée sur un virement", niveau: 3, blocking: true, signal: "SANCTION_CONTREPARTIE" },
  { code: "UB-02", ruleRef: "R351", famille: "UB", blocTitre: "Bénéficiaires effectifs", titre: "UBO commun à plusieurs structures", niveau: 2, blocking: false, signal: "UBO_PARTAGE" },
  { code: "CO-04", ruleRef: "R358", famille: "CO", blocTitre: "Corridors", titre: "Corridor à risque sans justificatif", niveau: 3, blocking: false, signal: "CORRIDOR_NON_JUSTIFIE" },
  { code: "ST-01", ruleRef: "R363", famille: "ST", blocTitre: "Structuration", titre: "Fractionnement sous le seuil de déclaration", niveau: 3, blocking: false, signal: "STRUCTURATION" },
  { code: "CA-02", ruleRef: "R370", famille: "CA", blocTitre: "Cash", titre: "Cash intensif hors profil déclaré", niveau: 2, blocking: false, signal: "CASH_HORS_PROFIL" },
  { code: "CR-05", ruleRef: "R381", famille: "CR", blocTitre: "Crypto", titre: "Contrepartie exchange non régulé", niveau: 3, blocking: true, signal: "VASP_NON_REGULE" },
  { code: "TB-01", ruleRef: "R392", famille: "TB", blocTitre: "Trade based", titre: "Sur-facturation d'une marchandise", niveau: 2, blocking: false, signal: "TBML_PRIX" },
];
type SignalGap = { id: string; scenarioCode?: string; clientId?: string; statut?: string; at?: string };
const SEED_SIGNAUX: SignalGap[] = [
  { id: "sg-1", scenarioCode: "ST-01", clientId: "Levant Shipping Co.", statut: "OUVERT", at: "10.08.2026" },
  { id: "sg-2", scenarioCode: "SF-01", clientId: "Zhang Wei Family Office", statut: "TP", at: "08.08.2026" },
  { id: "sg-3", scenarioCode: "CO-04", clientId: "Nordwind Energie GmbH", statut: "FP", at: "05.08.2026" },
];

// ── V2-M32 — RÉFÉRENTIEL DE DÉTECTION : les QUATRE familles de règles du produit, telles
// qu'inventoriées dans docs/REFERENTIEL-DETECTION.md (V2-M13). Ce tableau ne duplique aucune
// règle : il dit QUEL moteur porte quoi, combien, et où cela se lit. La quatrième ligne porte
// un écart assumé — la bibliothèque CPSI n'existe qu'en v1, sans moteur v2 (E-AML-2).
const FAMILLES_DETECTION = [
  { famille: "Surveillance transactionnelle", plage: "R189 → R206", n: 18, params: 20,
    moteur: "moteur v2", ou: "onglet Règles AML", route: "/v1/aml/referentiel" },
  { famille: "AML Gap", plage: "R340 → R403", n: 64, params: 80,
    moteur: "moteur v2", ou: "onglet AML Gap", route: "/v1/aml/scenarios" },
  { famille: "Conformité Shariah", plage: "R207 → R221", n: 15, params: 5,
    moteur: "moteur v2", ou: "écran Finance Islamique (à construire)", route: "—" },
  { famille: "Bibliothèque CPSI", plage: "R71 → R76", n: 31, params: 84,
    moteur: "front v1 seulement", ou: "aucun écran v2", route: "— (écart E-AML-2)" },
];

type Regle = { code: string; libelle?: string; seuils?: string; version?: string; alertes12m?: number };
const SEED_REGLES: Regle[] = [
  { code: "AML-R17", libelle: "Écart au profil de flux déclaré", seuils: "× 2,0 · fenêtre 30 j", version: "v11 · 12.09.2024", alertes12m: 1244 },
  { code: "AML-R04", libelle: "Structuration sous les seuils", seuils: "9 500 CHF · 5 op. / 7 j", version: "v6 · 03.02.2025", alertes12m: 312 },
  { code: "AML-R22", libelle: "Corridor à risque sans justificatif", seuils: "pays liste GAFI · > 50 k", version: "v3 · 18.04.2026", alertes12m: 87 },
  { code: "AML-R09", libelle: "Cash intensif hors profil", seuils: "> 15 k / mois espèces", version: "v9 · 12.09.2024", alertes12m: 158 },
];
// Cas de risque (/v1/riskcases, R133–R136) — RÉCONCILIÉS avec les alertes/hits (R280 : un cas
// né d'une alerte reste lié à elle, jamais un double pilotage) ; transitions fermées, terminaux
// motivés, clôture cohérente avec le MROS.
type Rc = { id: string; reference?: string; clientId?: string; origine?: string; statut?: string;
  createdAt?: string; etatDepuis?: string; slaSignale?: boolean };
// V2-M60 : statuts = la liste FERMÉE du moteur (TRANSITIONS de risk-case.service — NOUVELLE,
// EN_ANALYSE, CLARIFICATION, CLOTUREE, ESCALADEE). Le seed précédent portait des statuts
// INVENTÉS (« OUVERT », « EN_INVESTIGATION », « CLOS_MROS ») — une survivance de maquette,
// même famille que U2-43. Et un cas en SLA SIGNALÉ, pour que le filtre ait quelque chose à
// filtrer (leçon U2-73 : un seed sans état limite laisse la garde tourner à vide).
const SEED_RC: Rc[] = [
  { id: "rc-1", reference: "RC-2026-0102", clientId: "Cèdre Maritime SARL", origine: "Alerte AML-2026-0447",
    statut: "EN_ANALYSE", createdAt: "10.08.2026", etatDepuis: "2026-07-20T09:00:00Z", slaSignale: true },
  { id: "rc-2", reference: "RC-2026-0098", clientId: "Meridian Trust Ltd", origine: "Hit screening — UBO listé",
    statut: "NOUVELLE", createdAt: "10.08.2026", etatDepuis: "2026-08-10T09:00:00Z", slaSignale: false },
  { id: "rc-3", reference: "RC-2026-0071", clientId: "Atlas Commodities Ltd", origine: "Signalement gestionnaire",
    statut: "CLOTUREE", createdAt: "12.06.2026", etatDepuis: "2026-06-12T09:00:00Z", slaSignale: false },
];
type Tx = { id: string; date?: string; contrepartie?: string; montant?: string; canal?: string; statut?: string };
const SEED_TX: Tx[] = [
  { id: "tx-1", date: "08.08.2026", contrepartie: "Levant Shipping Co.", montant: "800 000 CHF", canal: "SWIFT MT103", statut: "EN_REVUE" },
  { id: "tx-2", date: "07.08.2026", contrepartie: "Nordwind Energie GmbH", montant: "120 000 CHF", canal: "SEPA", statut: "REGLEE" },
  { id: "tx-3", date: "05.08.2026", contrepartie: "Helvetia Kids (don)", montant: "25 000 CHF", canal: "Virement interne", statut: "REGLEE" },
  { id: "tx-4", date: "04.08.2026", contrepartie: "Levant Shipping Co.", montant: "760 000 CHF", canal: "SWIFT MT103", statut: "EN_REVUE" },
];

function Chiffre({ label, valeur, mode }: { label: string; valeur: string; mode?: "alert" | "warn" }) {
  return (
    <span style={{ minWidth: 0 }}>
      <span className="microlabel" style={{ display: "block", marginBottom: 3 }}>{label}</span>
      <span className="mono" style={{ fontSize: 13.5, fontWeight: 600,
        color: mode ? `var(--${mode}-text)` : "var(--text)" }}>{valeur}</span>
    </span>);
}

/**
 * V2-M48 — TRANSACTIONS & MARCHÉS : les deux vues que l'onglet Transactions ne portait pas.
 *
 * Le registre disait « onglet Transactions commun — pas d'analyseur SWIFT/SEPA » et « …pas de
 * vue settlement dédiée ». Confrontation au moteur vivant AVANT de construire — c'est elle qui
 * a décidé du périmètre :
 *   · /v1/swift/*        → aucun port requis, l'analyse est un ACTE que l'écran peut poser ;
 *   · /v1/corebanking/*  → port core banking VIDE par construction (phase 1 lecture seule,
 *                          R114/R167) : la vue existe, elle DIT l'absence, elle ne l'invente pas ;
 *   · /v1/txrisk/*       → agrège le flux transactionnel, lui-même alimenté par le port core
 *                          banking (R297). Sans port, aucune tendance — ce n'est pas un manque
 *                          d'écran mais un manque de port, et `capacites.ts` le dit désormais.
 * Formes RELEVÉES sur l'API vivante (seed conforme au moteur, pas l'inverse).
 */
type SwiftMsg = { type?: string; reference?: string; dateValeur?: string; devise?: string;
  montant?: number; donneurOrdre?: string; beneficiaire?: string; banqueBeneficiaire?: string;
  transactionId?: string | null; at?: string };
type SwiftQuar = { motif?: string; apercu?: string; at?: string };
type EtatCore = { lots?: number; enQuarantaine?: number };
type EtatFlux = { portConfigure?: boolean; transactions?: number };

const SEED_SWIFT: SwiftMsg[] = [
  { type: "MT103", reference: "REF-DEMO-001", dateValeur: "2026-08-10", devise: "CHF", montant: 12500,
    donneurOrdre: "/CH9300762011623852957\nNORDWIND HANDEL SA",
    beneficiaire: "/DE89370400440532013000\nALPHA GMBH", banqueBeneficiaire: "DEUTDEFF",
    transactionId: null, at: "2026-08-12T20:25:44.104Z" },
];
const SEED_SWIFT_Q: SwiftQuar[] = [
  { motif: "en-tête SWIFT absent (bloc {2:}) — non parsable, quarantaine",
    apercu: "ceci n est pas un message SWIFT", at: "2026-08-12T20:25:44.196Z" },
];

// R300 : l'analyse est le SEUL acte de la famille SWIFT — le contrôleur ne porte pas d'émission,
// et l'écran ne peut donc pas en inventer une.
const ACTES_SWIFT: ActeMoteur[] = [
  // L'ORDRE des clés n'est pas cosmétique : la garde de contrat AC-05 lit le bloc d'un acte
  // JUSQU'À `garde:` — déclarer `champs` après ferait voir un acte SANS champ, et la garde a
  // effectivement rougi sur ce point. Convention du fichier tenue : champs, puis garde.
  { cle: "swift.analyser", libelle: "Analyser un message SWIFT/SEPA",
    route: "POST /v1/swift/analyser", methode: "POST",
    champs: [{ cle: "texte", libelle: "Message brut (MT ou pacs.008)",
      exemple: "{1:F01…}{2:I103…}{4::20:REF-…:32A:260810CHF12500,00…-}" }],
    garde: "R300 : un message hors bibliothèque déclarée (swift_types_actifs) ou non parsable part en QUARANTAINE MOTIVÉE — jamais un rejet muet, jamais une extraction devinée. L'analyse ne crée aucune transaction : elle se rattache par référence à une transaction existante, ou reste orpheline et le dit." },
];

/**
 * V2-M61 — SCREENING AVANCÉ : les paramètres de rapprochement, exposés. La v1 résumait la
 * config par hit (« seuil 85 · phon:off ») ; la v2 ne montrait RIEN des réglages alors que le
 * moteur les gouverne entièrement : seuil de revue (clé tenant `screeningSeuil`, R100), config
 * versionnée SC-SCREENING (R415, effet daté R29), knobs du score (R413), canal phonétique
 * (R416), discriminant nationalité (R417), pré-filtre trigramme (R409). Deux ACTES réels :
 */
const ACTES_RAPPROCHEMENT: ActeMoteur[] = [
  { cle: "screening.config.publier", libelle: "Publier une version de la config",
    route: "POST /v1/screening/config", methode: "POST",
    champs: [{ cle: "moteur", libelle: "Knobs du score (R413/R416/R417)", exemple: '{"phonetique":true,"phonetiqueMethode":"double"}' },
      { cle: "prefiltre", libelle: "Pré-filtre trigramme (R409)", exemple: '{"plafond":400}' },
      { cle: "effectiveFrom", libelle: "Date d'effet (R29)", exemple: "2026-09-01" },
      { cle: "motif", libelle: "Motif (R7, obligatoire)" }],
    garde: "R415/R7 — la config du rapprochement ne se règle pas à l'appel : elle se PUBLIE en version datée (motif obligatoire, auteur = jeton, effet R29), et chaque run référence la version qui l'a produit (R414). Un override d'appel reste possible mais GOUVERNÉ (C7) : opt-in tenant allowCallOverride + justification tracée sur le run — jamais un écrasement silencieux." },
  { cle: "screening.replay", libelle: "Rejouer un run à l'identique",
    route: "POST /v1/screening/runs/:id/replay", methode: "POST",
    champs: [{ cle: ":id", libelle: "Run à rejouer" },
      { cle: "entries", libelle: "Entrées de la liste (mêmes que l'origine)" }],
    garde: "R415/R48/R49 — le rejeu re-score le périmètre EXACT du run avec la config PERSISTÉE dessus (jamais la config courante) et rend « identique » ou « DIVERGENT ». Il ne persiste RIEN : c'est une preuve de reproductibilité, pas un nouveau run." },
];

// Seeds au format EXACT du moteur — relevés sur l'API vivante après la publication (semis 8a).
const SEED_CONFIG_SCREENING = {
  code: "SC-SCREENING",
  enVigueur: { code: "SC-SCREENING", ruleRef: "R415", version: 1,
    effectiveFrom: "2026-08-24T00:00:00.000Z",
    params: { motif: "Activation du canal phonétique Double Metaphone (R416) et du discriminant nationalité (R417) pour le screening des listes de sanctions — recall sur translittérations, décision compliance du 24.08.2026",
      moteur: { phonetique: true, nationalite: true, nationaliteBonus: 8, phonetiqueMethode: "double" },
      prefiltre: { plafond: 400, minPartages: 2, maxTrigrammes: 12 } },
    active: true },
  versions: [{ version: 1 }],
};
const SEED_RUNS = [
  { id: "d2fee3f2-0bb2-436e-a206-0a244605c5ee", liste: "SECO-DEMO", listeVersion: "2026-08-01",
    seuil: 85, prefiltre: {}, perimetre: 3, nbHits: 1, sujetType: "client",
    config: { moteur: {}, source: null, override: null, prefiltre: {} },
    at: "2026-08-21T12:52:28.472Z" },
];

export function Surveillance({ active, onNavigate }: { active: Ui2NavId; onNavigate: (id: Ui2NavId) => void }) {
  const t = traduire(langue());
  const [ecran, setEcran] = useState<"alerte" | "hit" | "screening" | "regles" | "transactions"
    | "cas" | "amlgap" | "referentiel" | "swift" | "settlement" | "rapprochement">("alerte");
  const hitsBruts = useApiOrSeed<unknown>("/v1/screening/hits", SEED_HITS);
  const hits = { ...hitsBruts, data: listeHitsScreening(hitsBruts.data) };
  // V2-M32 : les deux capacités Compliance de la v1 qui manquaient encore sous Surveillance.
  const gap = useApiOrSeed<ScenarioGap[]>("/v1/aml/scenarios", SEED_GAP);
  const signauxBruts = useApiOrSeed<unknown>("/v1/aml/signals", SEED_SIGNAUX);
  const signaux = { ...signauxBruts, data: listeSignauxAml(signauxBruts.data) };
  const regles = useApiOrSeed<Regle[]>("/v1/aml/referentiel", SEED_REGLES);
  const txs = useApiOrSeed<Tx[]>("/v1/txflux", SEED_TX);
  const cas0 = useApiOrSeed<unknown>("/v1/riskcases", SEED_RC);
  const cas = { ...cas0, data: listeCasRisque(cas0.data) };
  // V2-M48 : les quatre lectures des deux vues neuves.
  const swift = useApiOrSeed<SwiftMsg[]>("/v1/swift/messages", SEED_SWIFT);
  const swiftQ = useApiOrSeed<SwiftQuar[]>("/v1/swift/quarantaine", SEED_SWIFT_Q);
  // V2-M61 : les deux lectures du screening avancé (gouvernance R415 + runs R103/R414).
  const cfg0 = useApiOrSeed<unknown>("/v1/screening/config", SEED_CONFIG_SCREENING);
  const cfgScreening = configScreening(cfg0.data);
  const runs0 = useApiOrSeed<unknown>("/v1/screening/runs", SEED_RUNS);
  const runsScreening = listeRunsScreening(runs0.data);
  const core = useApiOrSeed<EtatCore>("/v1/corebanking/etat", { lots: 0, enQuarantaine: 0 });
  const fluxEtat = useApiOrSeed<EtatFlux>("/v1/txflux/etat", { portConfigure: false, transactions: 0 });
  // DEUX décisions distinctes (l'alerte AML et le hit screening) — l'état est par écran, et le
  // DecisionPanel porte key={ecran} pour que le motif saisi sur l'un ne fuie jamais sur l'autre.
  const [decisions, setDecisions] = useState<Partial<Record<"alerte" | "hit", { option: string; motif: string }>>>({});
  // V2-M60 — l'état des filtres de la FILE (R-FB.2 : l'état vit dans l'hôte, la barre relaie).
  const [fRecherche, setFRecherche] = useState("");
  const [fStatut, setFStatut] = useState("ALL");
  const [fSla, setFSla] = useState("ALL");
  const [fTri, setFTri] = useState("ETAT_ANCIEN");
  const decision = decisions[ecran] ?? null;
  // V2-M35 — LE PREMIER ACTE QUI PART. La décision n'est plus un état local : elle est POSÉE
  // au moteur, et son issue — succès comme refus — est rendue à l'écran. Deux routes réelles :
  //   hit screening  → POST /v1/screening/hits/:id/qualify   (R101/R7 : motif obligatoire)
  //   alerte AML     → POST /v1/riskcases/:id/transition     (R133/R136 : transition motivée)
  // Le motif saisi voyage TEL QUEL : c'est lui que le registre conservera, pas un résumé.
  const acte = useActeMoteur();
  const ROUTE_ACTE: Record<"alerte" | "hit", string> = {
    hit: "/v1/screening/hits/hit-1/qualify",
    alerte: "/v1/riskcases/rc-1/transition",
  };
  const poserDecision = (d: { option: string; motif: string }) => {
    setDecision(d);
    const corps = ecran === "hit"
      ? { verdict: d.option, motif: d.motif }
      : { vers: d.option, motif: d.motif };
    void acte.poser(ROUTE_ACTE[ecran as "alerte" | "hit"], corps);
  };
  const setDecision = (d: { option: string; motif: string } | null) =>
    setDecisions((prev) => ({ ...prev, [ecran]: d ?? undefined }));
  const nav = (
    <Ui2Nav active={active} user="Sofia Berger" role="Compliance Officer" onNavigate={onNavigate} t={t}
      badges={{ journee: { n: 9 }, dossiers: { n: 17, sobre: true }, surveillance: { n: 5, alert: true } }}
      modulesLicencies={MODULES_METIERS_DEMO} />);
  // Le bandeau ne DÉCLARE plus l'enregistrement : il rend ce que le moteur a répondu. Avant
  // V2-M35 il affichait « Qualification enregistrée » alors qu'aucune écriture n'était partie.
  const bandeauDecision = decision && (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: "var(--text-body)" }}>
        {t("Décision soumise")} — <strong>{decision.option}</strong>{" "}
        <button onClick={() => { setDecision(null); acte.reinitialiser(); }}
          style={{ marginLeft: 6, border: "none", background: "transparent",
            color: "var(--text-secondary)", fontFamily: "inherit", fontSize: 11.5,
            fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>{t("Reprendre")}</button>
      </div>
      <RetourActe etat={acte.etat} route={ROUTE_ACTE[ecran as "alerte" | "hit"]} t={t} />
    </div>);

  const pilule = (id: typeof ecran, label: string) => (
    <button key={id} onClick={() => setEcran(id)} aria-pressed={ecran === id}
      style={{ padding: "6px 13px", borderRadius: 999, fontFamily: "inherit", fontSize: 12,
        fontWeight: 600, cursor: "pointer",
        border: ecran === id ? "1px solid var(--brand)" : "1px solid var(--border-input)",
        background: ecran === id ? "var(--brand-surface)" : "var(--bg-surface)",
        color: ecran === id ? "var(--brand)" : "var(--text-secondary)" }}>{label}</button>);
  const pilules = (
    <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
      {pilule("alerte", t("Alerte AML"))}
      {pilule("screening", `${t("File screening")} · ${Array.isArray(hits.data) ? hits.data.length : 0}`)}
      {pilule("rapprochement", t("Rapprochement"))}
      {pilule("regles", t("Règles AML"))}
      {pilule("transactions", t("Transactions"))}
      {pilule("swift", t("SWIFT/SEPA"))}
      {pilule("settlement", t("Settlement"))}
      {pilule("cas", `${t("Cas de risque")} · ${Array.isArray(cas.data) ? cas.data.length : 0}`)}
      {pilule("amlgap", t("AML Gap"))}
      {pilule("referentiel", t("Référentiel"))}
    </div>);

  // ── V2-M2/M3 : les vues « liste » du bloc Surveillance ──
  if (ecran === "screening" || ecran === "regles" || ecran === "transactions" || ecran === "cas"
    || ecran === "amlgap" || ecran === "referentiel" || ecran === "swift" || ecran === "settlement"
    || ecran === "rapprochement") {
    const sousTitres = {
      screening: hits.isDemo ? t("données maquette") : t("source : /v1/screening/hits (R411 — sujet × temps, config du run référencée)"),
      regles: regles.isDemo ? t("données maquette") : t("source : /v1/aml/referentiel"),
      transactions: txs.isDemo ? t("données maquette") : t("source : /v1/txflux"),
      cas: cas.isDemo ? t("données maquette") : t("source : /v1/riskcases (R133–R136)"),
      amlgap: gap.isDemo ? t("échantillon de maquette — le référentiel complet est servi par l'API")
        : t("source : /v1/aml/scenarios (R340–R403, générateur = source de vérité)"),
      referentiel: t("inventaire des quatre familles — docs/REFERENTIEL-DETECTION.md"),
      // V2-M48 : chaque vue neuve NOMME sa source ; Settlement nomme les deux qu'elle croise.
      swift: swift.isDemo ? t("données maquette") : t("source : /v1/swift/messages + /v1/swift/quarantaine (R300)"),
      settlement: core.isDemo ? t("données maquette")
        : t("source : /v1/corebanking/etat + /v1/txflux/etat (R167-R169 — le core est un PORT)"),
      rapprochement: cfg0.isDemo ? t("données maquette")
        : t("source : /v1/screening/config + /v1/screening/runs (R415 — config versionnée, R414 — référencée par run)"),
    } as const;
    return (
      <Ui2Shell nav={nav}
        header={<Ui2HeaderListe titre={t("Surveillance")} sousTitre={sousTitres[ecran]}
          action={ecran === "regles"
            ? <Ui2Bouton primaire onClick={() => onNavigate("param")}>{t("Ouvrir le bac à sable →")}</Ui2Bouton>
            : <Ui2Bouton onClick={() => setEcran("alerte")}>{t("Alerte en cours →")}</Ui2Bouton>} t={t} />}>
        {pilules}
        {ecran === "screening" && (<>
          <EntityList grid="1.3fr 1.3fr 90px 130px 110px"
            onOpen={() => setEcran("hit")}
            entetes={[t("Sujet"), t("Liste · version"), t("Score"), t("Statut"), t("Détecté")]}
            lignes={(Array.isArray(hits.data) ? hits.data : []).slice(0, 30).map((h) => ({
              id: h.id, cells: [
                <span key="n" style={{ fontWeight: 600, color: "var(--text)" }}>{h.nom ?? h.sujet ?? h.id}</span>,
                <span key="l" className="mono">{h.liste ?? "—"}</span>,
                <span key="s" className="mono" style={{ fontWeight: 600 }}>{h.score != null ? `${Math.round(h.score * 100)} %` : "—"}</span>,
                <StatusChip key="c" mode={h.statut === "OPEN" ? "warn" : h.statut === "CONFIRME" ? "alert" : "ok"}>
                  {t(h.statut === "OPEN" ? "À QUALIFIER" : h.statut ?? "QUALIFIÉ")}</StatusChip>,
                <span key="d" className="mono">{h.at ?? "—"}</span>] }))} />
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
            {t("Scoring : le moteur de screening du produit (Jaro-Winkler + IDF + blocking trigramme + Double Metaphone), golden set 127 cas asserté en CI. Une ligne s'ouvre sur la qualification (écran hit) — motif obligatoire. Les réglages se lisent sous Rapprochement.")}</div>
        </>)}
        {ecran === "rapprochement" && (() => {
          // V2-M61 — les paramètres de rapprochement. L'écran AFFICHE ce que le moteur gouverne
          // (sincérité P-L6-3) : il n'importe pas le moteur, ne recalcule rien, et la table des
          // défauts R413/R409 est une copie assertée à l'identique en CI (U2-88).
          const ev = cfgScreening.enVigueur;
          const regle = (cle: string): unknown => ev?.moteur?.[cle];
          const reglePre = (cle: string): unknown => ev?.prefiltre?.[cle];
          const montre = (v: unknown) => v === true ? "on" : v === false ? "off" : String(v);
          return (<>
            <BarreActes actes={ACTES_RAPPROCHEMENT} t={t} />
            <section style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
              borderRadius: "var(--r-card)", padding: "13px 16px", margin: "12px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6, flexWrap: "wrap" }}>
                {ev ? <StatusChip mode="ok">{`SC-SCREENING v${ev.version ?? "?"}`}</StatusChip>
                  : <StatusChip mode="warn">{t("AUCUNE VERSION PUBLIÉE")}</StatusChip>}
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>
                  {ev ? `${t("Config en vigueur depuis le")} ${ev.effectiveFrom ?? "—"} (R415, ${t("effet daté")} R29)`
                    : t("les défauts figés du moteur s'appliquent (R413)")}</span>
              </div>
              {ev?.motif && (
                // R7 : le motif de la publication, TEL QUEL — c'est lui la trace de gouvernance.
                <div style={{ fontSize: 11.5, color: "var(--text-body)", lineHeight: 1.6,
                  borderLeft: "3px solid var(--border)", paddingLeft: 10 }}>{ev.motif}</div>)}
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
                {t("Une config publiée gouverne les runs qui la RÉFÉRENCENT (scenarioCode, R414) — chaque run persiste la config exacte qui l'a produit, c'est elle que le rejeu utilise (R48/R49).")}
                {cfgScreening.nbVersions > 1 ? ` ${cfgScreening.nbVersions} ${t("versions publiées.")}` : ""}</div>
            </section>
            <div style={{ fontSize: 13, fontWeight: 600, margin: "0 0 8px" }}>{t("Knobs du score (R413) et du pré-filtre (R409)")}</div>
            <EntityList grid="190px 1.7fr 90px 150px" onOpen={() => setEcran("screening")}
              entetes={[t("Paramètre"), t("Ce que le bouton fait"), t("Valeur"), t("Source")]}
              lignes={[
                ...DEFAUTS_R413.map((k) => ({ id: k.cle, cells: [
                  <span key="c" className="mono" style={{ fontWeight: 600, color: "var(--text)", fontSize: 11.5 }}>{k.cle}</span>,
                  <span key="l" style={{ fontSize: 11.5 }}>{t(k.libelle)}</span>,
                  <span key="v" className="mono" style={{ fontWeight: 600 }}>{montre(regle(k.cle) ?? k.defaut)}</span>,
                  regle(k.cle) !== undefined
                    ? <StatusChip key="s" mode="ok">{`${t("GOUVERNÉ")} v${ev?.version}`}</StatusChip>
                    : <span key="s" style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("défaut moteur (R413)")}</span>] })),
                ...DEFAUTS_R409.map((k) => ({ id: k.cle, cells: [
                  <span key="c" className="mono" style={{ fontWeight: 600, color: "var(--text)", fontSize: 11.5 }}>{k.cle}</span>,
                  <span key="l" style={{ fontSize: 11.5 }}>{t(k.libelle)}</span>,
                  <span key="v" className="mono" style={{ fontWeight: 600 }}>{montre(reglePre(k.cle) ?? k.defaut)}</span>,
                  reglePre(k.cle) !== undefined
                    ? <StatusChip key="s" mode="ok">{`${t("GOUVERNÉ")} v${ev?.version}`}</StatusChip>
                    : <span key="s" style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("défaut moteur (R409)")}</span>] })),
              ]} />
            <div style={{ fontSize: 10.5, color: "var(--text-muted)", margin: "9px 0 14px", lineHeight: 1.5 }}>
              {t("Le SEUIL DE REVUE n'est pas un knob de version : c'est le paramètre gouverné screeningSeuil (R100, registre R-Q, défaut 85), repli de tout run qui n'en donne pas — il s'édite au Paramétrage. L'IDF n'est pas un réglage non plus : il se construit des entrées de la liste À CHAQUE run (C8, aucun état partagé) — il n'y a rien à publier.")}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "0 0 8px" }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{t("Runs — la preuve de fraîcheur (R103)")}</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("chaque run porte la config qui l'a produit (R414)")}</span>
            </div>
            <EntityList grid="1.2fr 90px 90px 70px 70px 140px 100px" onOpen={() => setEcran("screening")}
              entetes={[t("Liste · version"), t("Sujet"), t("Seuil"), t("Périm."), t("Hits"), t("Config"), t("Le")]}
              lignes={runsScreening.slice(0, 20).map((r) => ({ id: r.id, cells: [
                <span key="l" className="mono" style={{ fontWeight: 600, color: "var(--text)", fontSize: 11.5 }}>{`${r.liste ?? "—"} · ${r.version ?? "—"}`}</span>,
                <span key="t" style={{ fontSize: 11.5 }}>{r.sujetType ?? "—"}</span>,
                <span key="s" className="mono" style={{ fontWeight: 600 }}>{r.seuil ?? "—"}</span>,
                <span key="p" className="mono">{r.perimetre ?? "—"}</span>,
                <span key="h" className="mono" style={{ fontWeight: 600 }}>{r.nbHits ?? "—"}</span>,
                r.scenario === "défauts R413"
                  ? <span key="c" style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("défauts R413")}</span>
                  : <StatusChip key="c" mode="ok">{r.scenario ?? "—"}</StatusChip>,
                <span key="a" className="mono" style={{ fontSize: 11 }}>{r.at ?? "—"}</span>] }))} />
            <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
              {t("Un override d'appel (moteurConfig) est GOUVERNÉ (C7) : refus typé sans opt-in tenant allowCallOverride, et une justification (R7) est exigée puis tracée sur le run. La trace de passage s'écrit TOUJOURS, hits ou pas (R103) — un run à zéro hit est une preuve, pas un silence.")}</div>
          </>);
        })()}
        {ecran === "regles" && (<>
          <EntityList grid="110px 1.4fr 1fr 150px 110px" onOpen={() => onNavigate("param")}
            entetes={[t("Règle"), t("Scénario"), t("Seuils effectifs"), t("Version"), t("Alertes 12 m")]}
            lignes={listeReglesAml(regles.data).slice(0, 30).map((s) => ({
              id: s.code, cells: [
                <span key="c" className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>{s.code}</span>,
                t(s.libelle ?? ""),
                <span key="s" className="mono">{s.seuils ?? "—"}</span>,
                <span key="v" className="mono">{s.version ?? "—"}</span>,
                <span key="a" className="mono">{s.alertes12m != null ? s.alertes12m.toLocaleString("fr-CH") : "—"}</span>] }))} />
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
            {t("Consultation seule : chaque règle est versionnée et rejouable. La modification passe par le bac à sable du Paramétrage (écran 10) — effet simulé sur l'historique, coût nominatif, version datée et signée.")}</div>
        </>)}
        {ecran === "transactions" && (<>
          {/* V2-M22 : le globe est le FOND de l'onglet ; la table des transactions se lit
              par-dessus, dans une surface opaque — la lisibilité prime sur l'effet. */}
          <FluxPanneau>
          <EntityList grid="110px 1.3fr 140px 150px 120px" onOpen={() => setEcran("alerte")}
            fond="transparent"
            entetes={[t("Date"), t("Contrepartie"), t("Montant"), t("Canal"), t("Statut")]}
            lignes={(Array.isArray(txs.data) ? txs.data : []).slice(0, 30).map((x) => ({
              id: x.id, cells: [
                <span key="d" className="mono">{x.date ?? "—"}</span>,
                <span key="c" style={{ fontWeight: 600, color: "var(--text)" }}>{x.contrepartie ?? x.id}</span>,
                <span key="m" className="mono" style={{ fontWeight: 600 }}>{x.montant ?? "—"}</span>,
                <span key="k" className="mono">{x.canal ?? "—"}</span>,
                <StatusChip key="s" mode={x.statut === "EN_REVUE" ? "warn" : "ok"}>
                  {t(x.statut === "EN_REVUE" ? "EN REVUE" : "RÉGLÉE")}</StatusChip>] }))} />
              <div style={{ fontSize: 10.5, color: "var(--text-muted)", padding: "9px 12px 11px",
                lineHeight: 1.5 }}>
                {t("Les transactions EN REVUE sont rapprochées des alertes AML — une ligne s'ouvre sur l'alerte liée. L'analyseur SWIFT/SEPA reste un outil contextuel depuis une transaction.")}</div>
          </FluxPanneau>
        </>)}
        {/* ── V2-M48 · SWIFT/SEPA — le laboratoire d'analyse (R300). L'écran POSE l'acte réel et
            rend le verdict du moteur : extraction, ou quarantaine AVEC son motif. Deux listes
            dérivées du journal (aucune table nouvelle) : ce qui a été lu, ce qui a été refusé. ── */}
        {ecran === "swift" && (<>
          <BarreActes actes={ACTES_SWIFT} t={t} />
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "14px 0 8px" }}>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{t("Messages analysés")}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {swift.isDemo ? t("données maquette") : "/v1/swift/messages"}</span>
          </div>
          {!(Array.isArray(swift.data) ? swift.data : []).length ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {t("Aucun message analysé — le journal est vide.")}</div>
          ) : (
          <EntityList grid="90px 130px 110px 130px 1fr 110px" onOpen={() => setEcran("transactions")}
            entetes={[t("Type"), t("Référence"), t("Date valeur"), t("Montant"),
              t("Donneur d'ordre → bénéficiaire"), t("Transaction liée")]}
            lignes={(Array.isArray(swift.data) ? swift.data : []).map((m, i) => ({
              id: `${m.reference ?? i}`, cells: [
                <span key="t" className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>{m.type ?? "—"}</span>,
                <span key="r" className="mono">{m.reference ?? "—"}</span>,
                <span key="d" className="mono">{m.dateValeur ?? "—"}</span>,
                <span key="m" className="mono" style={{ fontWeight: 600 }}>
                  {m.montant != null ? `${m.montant.toLocaleString("fr-CH")} ${m.devise ?? ""}` : "—"}</span>,
                <span key="p" style={{ fontSize: 11 }}>
                  {`${(m.donneurOrdre ?? "—").split("\n").pop()} → ${(m.beneficiaire ?? "—").split("\n").pop()}`}
                  {m.banqueBeneficiaire ? <span style={{ color: "var(--text-muted)" }}>{` · ${m.banqueBeneficiaire}`}</span> : null}</span>,
                m.transactionId
                  ? <StatusChip key="x" mode="ok">{t("RATTACHÉE")}</StatusChip>
                  : <StatusChip key="x" mode="neutral">{t("ORPHELINE")}</StatusChip>] }))} />)}
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "16px 0 8px" }}>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{t("Quarantaine")}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {t("un message refusé est CONSERVÉ avec son motif — jamais jeté")}</span>
          </div>
          {!(Array.isArray(swiftQ.data) ? swiftQ.data : []).length ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("Aucun message en quarantaine.")}</div>
          ) : (
          <EntityList grid="1.2fr 1fr 130px" onOpen={() => setEcran("swift")}
            entetes={[t("Motif du refus"), t("Aperçu du message"), t("Reçu le")]}
            lignes={(Array.isArray(swiftQ.data) ? swiftQ.data : []).map((q, i) => ({
              id: `q-${i}`, cells: [
                <span key="m" style={{ fontSize: 11.5, color: "var(--warn-text)" }}>{q.motif ?? "—"}</span>,
                <span key="a" className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{q.apercu ?? "—"}</span>,
                <span key="d" className="mono" style={{ fontSize: 11 }}>{(q.at ?? "").slice(0, 10) || "—"}</span>] }))} />)}
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
            {t("Le laboratoire LIT, il n'émet pas : le contrôleur ne porte aucune route d'émission (R300/TF-11). L'extraction se rattache à une transaction par sa RÉFÉRENCE ; sans transaction correspondante le message reste ORPHELIN et l'écran le dit, plutôt que d'inventer un rattachement. Les champs donneur d'ordre et bénéficiaire sont des données sensibles (R79).")}</div>
        </>)}

        {/* ── V2-M48 · SETTLEMENT — la vue qui dit l'absence de port. Le core banking est un PORT
            (R167→R169) et la phase 1 est LECTURE SEULE, port injecté vide : il n'y a rien à
            afficher, et c'est précisément ce qu'il faut afficher. Un écran qui montrerait des
            lots inventés serait pire que cet écran-ci. ── */}
        {ecran === "settlement" && (<>
          <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            {([[t("Lots reçus du core"), String(core.data?.lots ?? 0), "/v1/corebanking/etat"],
               [t("Lots en quarantaine"), String(core.data?.enQuarantaine ?? 0), "/v1/corebanking/etat"],
               [t("Transactions au journal"), String(fluxEtat.data?.transactions ?? 0), "/v1/txflux/etat"]] as const)
              .map(([l, v, src]) => (
              <div key={l} style={{ flex: 1, minWidth: 180, background: "var(--bg-surface)",
                border: "1px solid var(--border)", borderLeft: "3px solid var(--border-input)",
                borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)", padding: "12px 14px" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{l}</div>
                <div className="mono" style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.1 }}>{v}</div>
                <div className="mono" style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>{src}</div>
              </div>))}
          </div>
          <section style={{ background: "var(--warn-card)", border: "1px solid var(--warn-card-border)",
            borderRadius: "var(--r-card)", padding: "13px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
              <StatusChip mode={fluxEtat.data?.portConfigure ? "ok" : "warn"}>
                {t(fluxEtat.data?.portConfigure ? "PORT CONFIGURÉ" : "AUCUN PORT CORE BANKING")}</StatusChip>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>
                {t("Settlement / exécution — phase 1, lecture seule")}</span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-body)", lineHeight: 1.6 }}>
              {t("Le core banking est un PORT (R167→R169) : Avaloq, Temenos, Finnova ou ERI en sont des implémentations, jamais réimplémentées ici. Tant qu'aucun port n'est configuré, l'import REFUSE explicitement (R114/R167) et le journal transactionnel reste vide — ce qui manque à cette vue n'est pas un écran, c'est un port. Aucun lot n'est simulé : une donnée de settlement inventée serait indiscernable d'une vraie, et c'est ce que R167 interdit.")}</div>
          </section>
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
            {t("Conséquence à consigner, pas à masquer : sans flux transactionnel, l'agrégation de risque (R298, onglet à venir) n'a rien à agréger. Les trois capacités « Transactions & Marchés » de la v1 dépendent donc du même port, et le registre des capacités le nomme désormais.")}</div>
        </>)}

        {ecran === "amlgap" && (<>
          <EntityList grid="90px 1.6fr 130px 90px 130px" onOpen={() => setEcran("regles")}
            entetes={[t("Code"), t("Scénario"), t("Bloc"), t("Niveau"), t("Signal émis")]}
            lignes={(Array.isArray(gap.data) ? gap.data : []).slice(0, 40).map((g) => ({
              id: g.code, cells: [
                <span key="c" className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>{g.code}</span>,
                <span key="s"><span style={{ fontWeight: 600, color: "var(--text)" }}>{t(g.titre ?? "—")}</span>
                  <span style={{ display: "block", fontSize: 10.5, color: "var(--text-muted)" }}>
                    {g.ruleRef ?? "—"}{g.blocking ? ` · ${t("bloquant")}` : ""}</span></span>,
                t(g.blocTitre ?? "—"),
                <StatusChip key="n" mode={g.niveau === 3 ? "alert" : g.niveau === 2 ? "warn" : "neutral"}>
                  {`N${g.niveau ?? "—"}`}</StatusChip>,
                <span key="g" className="mono" style={{ fontSize: 10.5 }}>{g.signal ?? "—"}</span>] }))} />
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", margin: "16px 0 8px" }}>
            {t("Signaux à qualifier")} <span style={{ fontWeight: 400, fontSize: 11,
              color: "var(--text-muted)" }}>{t("(un signal n'est pas une alerte : il se qualifie TP ou FP)")}</span></div>
          <EntityList grid="110px 1.5fr 130px 110px" onOpen={() => setEcran("alerte")}
            entetes={[t("Scénario"), t("Client"), t("Qualification"), t("Détecté")]}
            lignes={(Array.isArray(signaux.data) ? signaux.data : []).slice(0, 20).map((x) => ({
              id: x.id, cells: [
                <span key="s" className="mono" style={{ fontWeight: 600 }}>{x.scenarioCode ?? "—"}</span>,
                <span key="c" style={{ fontWeight: 600, color: "var(--text)" }}>{x.clientId ?? "—"}</span>,
                <StatusChip key="q" mode={x.statut === "TP" ? "alert" : x.statut === "FP" ? "ok" : "warn"}>
                  {t(x.statut === "TP" ? "VRAI POSITIF" : x.statut === "FP" ? "FAUX POSITIF" : "À QUALIFIER")}</StatusChip>,
                <span key="d" className="mono">{x.at ?? "—"}</span>] }))} />
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
            {t("Le référentiel AML Gap est GÉNÉRÉ (tools/aml-gap/gen_aml_gap.py) et un test de fraîcheur rougit si le code dérive de la source. Un scénario ne DÉCIDE de rien : il émet un signal, qualifié TP ou FP par un humain, et cette qualification alimente le jeu de vérité terrain qui mesure le moteur (R44).")}</div>
        </>)}
        {ecran === "referentiel" && (<>
          <EntityList grid="1.6fr 130px 90px 110px 1.4fr" onOpen={() => setEcran("regles")}
            entetes={[t("Famille de règles"), t("Plage canon"), t("Règles"), t("Paramètres"), t("Où cela se lit")]}
            lignes={FAMILLES_DETECTION.map((f) => ({ id: f.famille, cells: [
              <span key="f"><span style={{ fontWeight: 600, color: "var(--text)" }}>{t(f.famille)}</span>
                <span style={{ display: "block", fontSize: 10.5, color: "var(--text-muted)" }}>
                  {t(f.moteur)}</span></span>,
              <span key="p" className="mono" style={{ fontSize: 11 }}>{f.plage}</span>,
              <span key="n" className="mono" style={{ fontWeight: 600 }}>{f.n}</span>,
              <span key="x" className="mono">{f.params}</span>,
              <span key="o">{t(f.ou)}
                <span style={{ display: "block", fontSize: 10, color: "var(--text-muted)" }}
                  className="mono">{f.route}</span></span>] }))} />
          <div style={{ display: "flex", gap: 18, marginTop: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--text-body)" }}>
              <strong style={{ color: "var(--text)" }}>128</strong> {t("règles de détection au total")}</span>
            <span style={{ fontSize: 12, color: "var(--text-body)" }}>
              <strong style={{ color: "var(--text)" }}>189</strong> {t("paramètres de réglage")}</span>
            <span style={{ fontSize: 12, color: "var(--warn-text)" }}>
              {t("1 famille sur 4 sans moteur v2")}</span>
          </div>
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
            {t("Ce tableau ne duplique aucune règle : il dit quel moteur porte quoi et où cela se lit. La bibliothèque CPSI (31 scénarios, 84 seuils) n'existe qu'en front v1 et n'a AUCUN moteur en v2 — l'écart E-AML-2 est ouvert, il n'est pas comblé par cet écran. La codification par famille (CIB-SEN01, ISLAMIC-SEN02…) est générée et figée par des ancres de stabilité en CI.")}</div>
        </>)}
        {ecran === "cas" && (() => {
          // V2-M60 — la file TRIE et FILTRE, comme la v1, sur les données du MOTEUR : statuts
          // de la liste fermée (TRANSITIONS), SLA signalé (R136), âge de l'état (etatDepuis).
          const tous = Array.isArray(cas.data) ? cas.data : [];
          const visibles = tous
            .filter((c) => fStatut === "ALL" || c.statut === fStatut)
            .filter((c) => fSla === "ALL" || (fSla === "OUI") === !!c.slaSignale)
            .filter((c) => !fRecherche.trim()
              || `${c.reference ?? ""} ${c.clientId ?? ""} ${c.origine ?? ""}`.toLowerCase().includes(fRecherche.toLowerCase()))
            .sort((a, b) => {
              if (fTri === "ETAT_RECENT" || fTri === "ETAT_ANCIEN") {
                const ta = Date.parse(a.etatDepuis ?? "") || 0, tb = Date.parse(b.etatDepuis ?? "") || 0;
                return fTri === "ETAT_ANCIEN" ? ta - tb : tb - ta;   // anciens d'abord = la file de travail
              }
              return (b.slaSignale ? 1 : 0) - (a.slaSignale ? 1 : 0);          // SLA d'abord
            });
          return (<>
          <FilterBar
            search={{ value: fRecherche, onChange: setFRecherche, placeholder: t("Rechercher (référence, client, origine)…") }}
            filters={[
              { id: "statut", label: t("Statut (liste fermée du moteur)"), value: fStatut, onChange: setFStatut,
                options: [["ALL", t("Tous")], ["NOUVELLE", "NOUVELLE"], ["EN_ANALYSE", "EN_ANALYSE"],
                  ["CLARIFICATION", "CLARIFICATION"], ["ESCALADEE", "ESCALADEE"], ["CLOTUREE", "CLOTUREE"]] },
              { id: "sla", label: t("SLA signalé (R136)"), value: fSla, onChange: setFSla,
                options: [["ALL", t("Indifférent")], ["OUI", t("En dépassement")], ["NON", t("Dans les délais")]] },
              { id: "tri", label: t("Tri"), value: fTri, onChange: setFTri, allValue: "ETAT_ANCIEN",
                options: [["ETAT_ANCIEN", t("État le plus ancien d'abord")],
                  ["ETAT_RECENT", t("État le plus récent d'abord")], ["SLA", t("SLA signalés d'abord")]] },
            ]}
            shown={visibles.length} total={tous.length}
            onReset={() => { setFRecherche(""); setFStatut("ALL"); setFSla("ALL"); setFTri("ETAT_ANCIEN"); }} />
          <EntityList grid="140px 1.2fr 1.3fr 140px 90px 110px" onOpen={() => setEcran("alerte")}
            entetes={[t("Référence"), t("Client"), t("Origine"), t("Statut"), t("SLA"), t("Ouvert le")]}
            lignes={visibles.slice(0, 30).map((c) => ({
              id: c.id, cells: [
                <span key="r" className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>{(c.reference ?? c.id).slice(0, 14)}</span>,
                <span key="c" style={{ fontWeight: 600, color: "var(--text)" }}>{c.clientId ?? "—"}</span>,
                t(c.origine ?? "—"),
                <StatusChip key="s" mode={c.statut === "CLOTUREE" ? "ok"
                  : c.statut === "ESCALADEE" ? "alert"
                  : c.statut === "NOUVELLE" ? "neutral" : "warn"}>{c.statut ?? "—"}</StatusChip>,
                c.slaSignale ? <StatusChip key="x" mode="alert">{t("DÉPASSÉ")}</StatusChip>
                  : <span key="x" className="mono" style={{ color: "var(--text-muted)" }}>—</span>,
                <span key="d" className="mono">{c.createdAt ?? "—"}</span>] }))} />
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
            {t("Un cas de risque reste RÉCONCILIÉ avec l'alerte ou le hit qui l'a fait naître (R280) — jamais un double pilotage ; ses transitions sont fermées et ses terminaux motivés, la clôture est cohérente avec le MROS (R133–R136). Les statuts du filtre sont la liste FERMÉE du moteur ; le SLA est un fait signalé (R136), pas un calcul d'écran. Une ligne s'ouvre sur l'origine.")}</div>
        </>); })()}
      </Ui2Shell>);
  }

  if (ecran === "hit") {
    return (
      <Ui2Shell nav={nav} sideWidth={380}
        header={<Ui2HeaderDossier nom={t("Hit sanctions — Meridian Trust Ltd")} initiales="⚑"
          identifiants="Personne : Andrei Volkov · rôle UBO · liste UE consolidée · détecté il y a 2 h"
          puces={<StatusChip mode="warn">{t("À QUALIFIER")}</StatusChip>}
          actions={<><Ui2Bouton onClick={() => setEcran("alerte")}>{t("← Alerte AML liée")}</Ui2Bouton>
            <Ui2Bouton onClick={() => setEcran("screening")}>{t("Historique des screenings")}</Ui2Bouton></>} t={t} />}
        side={<DecisionPanel key={ecran} titre={t("Qualifier le hit")} t={t}
          sousTitre={t("Deux divergences sur cinq attributs. La décision engage la banque.")}
          options={[
            { id: "HOMONYME", titre: t("Homonyme — écarter"), sous: t("Motif obligatoire") },
            { id: "CONFIRMEE", titre: t("Correspondance confirmée"), sous: t("Gel et communication immédiats") },
            { id: "PIECE", titre: t("Demander une pièce complémentaire"), sous: t("Dossier maintenu bloqué") }]}
          effets={[t("Dossier Meridian Trust maintenu bloqué"), t("Tâche créée pour le gestionnaire"),
            t("Re-screening automatique à réception")]}
          boutonLabel={t("Enregistrer la qualification")}
          mention={t("Second regard MLRO requis sur toute correspondance confirmée.")}
          onDecider={poserDecision} />}>
        {bandeauDecision}
        <DiffTable enteteGauche={t("Dossier O-Live")} enteteDroite={t("Liste source")} t={t} lignes={[
          { attribut: t("Nom complet"), gauche: "Andrei Volkov", droite: "Andrey Volkov", concordance: { label: "92 %", mode: "pct" } },
          { attribut: t("Date de naissance"), gauche: nombre("14.06.1971"), droite: nombre("03.11.1967"), concordance: { label: t("DIVERGE"), mode: "diverge" } },
          { attribut: t("Nationalité"), gauche: t("Fédération de Russie"), droite: t("Fédération de Russie"), concordance: { label: t("EXACT"), mode: "exact" } },
          { attribut: t("Lieu de naissance"), gauche: "Saint-Pétersbourg", droite: "Moscou", concordance: { label: t("DIVERGE"), mode: "diverge" } },
          { attribut: t("Pièce d'identité"), gauche: nombre("Passeport 71-xxxx-4402"), droite: t("non renseigné"), concordance: { label: "N/A", mode: "na" } }]} />
        <section style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)", padding: "13px 16px", margin: "14px 0" }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>{t("Mesure listée")}</div>
          <div style={{ fontSize: 12, color: "var(--text-body)", lineHeight: 1.55 }}>
            {t("Gel des avoirs et interdiction de mise à disposition de fonds — régime UE relatif aux actions compromettant l'intégrité territoriale de l'Ukraine. Inscription du 08.04.2022, révisée le 15.01.2026.")}</div>
          <div style={{ display: "flex", gap: 26, marginTop: 10 }}>
            <Chiffre label={t("Liste")} valeur="UE consolidée" />
            <Chiffre label={t("Version")} valeur="2026-07-31" />
            <Chiffre label={t("Autres listes")} valeur={t("OFAC : absent · SECO : absent")} />
          </div>
        </section>
        <section style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)", padding: "13px 16px" }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>{t("Où cette personne intervient")}</div>
          {[["Meridian Trust Ltd", "UBO · 55 %", t("DOSSIER BLOQUÉ"), "alert"],
            ["Volkov Family Foundation", t("fondateur"), t("REVUE ANTICIPÉE"), "warn"]].map(([nom, role, chip, mode]) => (
            <div key={nom as string} style={{ display: "flex", alignItems: "center", gap: 10,
              padding: "8px 0", borderBottom: "1px solid var(--border-row)" }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{nom}</span>
              <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{role}</span>
              <span style={{ marginLeft: "auto" }}><StatusChip mode={mode as never}>{chip}</StatusChip></span>
            </div>))}
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 8 }}>
            {t("Une seule qualification vaut pour la personne : elle se propage aux deux dossiers par événement, sans double saisie.")}</div>
        </section>
      </Ui2Shell>);
  }

  return (
    <Ui2Shell nav={nav} sideWidth={400}
      header={<Ui2HeaderDossier nom={t("Alerte AML-2026-0447")} initiales="⚠"
        identifiants="Cèdre Maritime SARL · corridor Genève → Beyrouth · ouverte il y a 2 h"
        puces={<><StatusChip mode="alert">{t("CRITIQUE")}</StatusChip><StatusChip mode="neutral">{t("EN COURS")}</StatusChip></>}
        actions={<><Ui2Bouton onClick={() => setEcran("hit")}>{t("Hit screening lié →")}</Ui2Bouton>
          <Ui2Bouton onClick={() => onNavigate("rapports")}>{t("Rejouer l'historique")}</Ui2Bouton>
          <Ui2Bouton onClick={() => setEcran("cas")}>{t("Escalader au MLRO")}</Ui2Bouton></>} t={t} />}
      side={<DecisionPanel key={ecran} titre={t("Qualifier l'alerte")} t={t}
        sousTitre={t("Toute qualification exige un motif. Elle est horodatée, nominative et opposable.")}
        options={[
          { id: "FAUX_POSITIF", titre: t("Faux positif"), sous: t("Le flux est expliqué par le dossier") },
          { id: "INVESTIGATION", titre: t("Investigation approfondie"), sous: t("Demander des justificatifs au client") },
          { id: "MROS", titre: t("Communication MROS"), sous: t("Soupçon fondé — escalade MLRO obligatoire") }]}
        effets={[t("Tâche créée pour le gestionnaire"), t("Dossier KYC repassé en revue anticipée"),
          t("Compte non bloqué — aucun effet automatique")]}
        boutonLabel={t("Enregistrer la qualification")}
        mention={t("Le second regard MLRO reste requis avant clôture.")}
        onDecider={poserDecision} />}>
      {pilules}
      {bandeauDecision}
      <section style={{ background: "var(--bg-surface)", border: "1px solid var(--alert-line)",
        borderLeft: "3px solid var(--alert-line)", borderRadius: "var(--r-card)",
        boxShadow: "var(--shadow-card)", padding: "14px 16px", marginBottom: 14 }}>
        <div className="microlabel" style={{ marginBottom: 5 }}>{t("Règle déclenchée")}</div>
        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>
          AML-R17 — {t("écart au profil de flux déclaré")}</div>
        <div style={{ fontSize: 12, color: "var(--text-body)", lineHeight: 1.55, maxWidth: 620 }}>
          {t("Trois virements sortants vers une contrepartie non déclarée, cumulés à 2,4 M CHF sur 9 jours, alors que le dossier annonce des flux commerciaux de 150 à 400 k CHF par trimestre.")}</div>
        <div style={{ display: "flex", gap: 30, marginTop: 12, flexWrap: "wrap" }}>
          <Chiffre label={t("Attendu au dossier")} valeur="≤ 400 000 / trim." />
          <Chiffre label={t("Constaté")} valeur="2 400 000 / 9 j" mode="alert" />
          <Chiffre label={t("Écart")} valeur="× 6,0" mode="alert" />
          <Chiffre label={t("Pays contrepartie")} valeur={t("Liban — risque élevé")} mode="warn" />
        </div>
      </section>
      <section style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)", overflow: "hidden", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "11px 16px",
          borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>{t("Transactions concernées")}</span>
          <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--text-muted)" }}>
            {t("rapprochées automatiquement · 3 sur 128 du mois")}</span>
        </div>
        <div role="row" style={{ display: "grid", gridTemplateColumns: "110px 1fr 130px 150px 110px",
          padding: "0 16px", background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)" }}>
          {[t("Date"), t("Contrepartie"), t("Montant"), t("Canal"), t("Écart")].map((h) => (
            <span key={h} className="microlabel" style={{ padding: "8px 10px 8px 0" }}>{h}</span>))}
        </div>
        {[["31.07.2026", "840 000", "× 2,1"], ["04.08.2026", "760 000", "× 1,9"], ["08.08.2026", "800 000", "× 2,0"]]
          .map(([date, montant, ecart]) => (
          <div role="row" key={date} style={{ display: "grid", gridTemplateColumns: "110px 1fr 130px 150px 110px",
            alignItems: "center", padding: "0 16px", borderBottom: "1px solid var(--border-row)" }}>
            <span className="mono" style={{ padding: "11px 10px 11px 0", fontSize: 11.5, color: "var(--text-muted)" }}>{date}</span>
            <span style={{ padding: "11px 10px 11px 0", minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 12.5, fontWeight: 600 }}>Levant Shipping Co.</span>
              <span style={{ display: "block", fontSize: 10.5, color: "var(--text-muted)" }}>
                {t("Beyrouth · non déclarée au dossier")}</span></span>
            <span className="mono" style={{ padding: "11px 10px 11px 0", fontSize: 12, fontWeight: 600 }}>{montant}</span>
            <span className="mono" style={{ padding: "11px 10px 11px 0", fontSize: 11.5, color: "var(--text-muted)" }}>SWIFT MT103</span>
            <span style={{ padding: "9px 0" }}><StatusChip mode="alert">{ecart}</StatusChip></span>
          </div>))}
        <button style={{ display: "block", padding: "11px 16px", border: "none", background: "transparent",
          cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: "var(--brand)" }}>
          {t("Voir les 125 transactions du mois pour contexte →")}</button>
      </section>
      <div style={{ background: "var(--ai-card)", border: "1px solid var(--ai-card-border)",
        borderRadius: 11, padding: 12, fontSize: 12, lineHeight: 1.55, color: "var(--ai-text)" }}>
        <span className="mono" style={{ fontSize: 9.5, background: "var(--ai-chip)", padding: "1px 5px",
          borderRadius: 4, letterSpacing: 1 }}>IA</span>{" "}
        {t("Levant Shipping Co. apparaît dans deux dossiers de la banque comme fournisseur du même groupe. La contrepartie n'est pas sous sanction. Le motif de rejet le plus fréquent sur cette règle est « flux commercial documenté ».")}
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 6 }}>
          {t("Éléments de contexte — aucune décision n'est proposée sur une alerte critique.")}</div>
      </div>
    </Ui2Shell>);
}
