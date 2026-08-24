import React, { useState } from "react";
import { Ui2Shell } from "./Shell";
import { Ui2Nav, Ui2NavId } from "./Nav";
import { Ui2HeaderListe, Ui2Bouton } from "./Header";
import { StatTile } from "./StatTile";
import { StatusChip, ChipMode } from "./StatusChip";
import { EntityList } from "./Listes";
import { useApiOrSeed } from "../lib/useApiOrSeed";
import { listeVuesBi, listeHabilitations } from "./moteur-formes";
import { exporterCsv, jourFichier } from "./actions";
import { BarreActes, type ActeMoteur } from "./acte-moteur";
import { traduire, langue } from "../lib/i18n";

/**
 * UI v2 — étape 8 : écran 08 « Pilotage — direction ». Un tableau de bord qui montre OÙ LE
 * TRAVAIL EST BLOQUÉ plutôt qu'une collection d'indicateurs : le Bar Meter (temps d'attente
 * médian par étape) se conclut par une phrase ÉCRITE qui nomme le seul goulot interne — la
 * lecture est faite, pas déléguée au lecteur. Chaque chiffre est cliquable jusqu'aux dossiers
 * qui le composent (règle StatTile : un chiffre sans chemin n'existe pas).
 */

function BarMeter({ lignes, max }: {
  lignes: { label: string; valeur: number; affichage: string; mode: "ok" | "warn" | "alert" }[];
  max: number;
}) {
  return (
    <div>
      {lignes.map((l) => (
        <div key={l.label} style={{ padding: "7px 0", borderBottom: "1px solid var(--border-row)" }}>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span style={{ fontSize: 12, color: "var(--text-body)" }}>{l.label}</span>
            <span className="mono" style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600,
              color: l.mode === "ok" ? "var(--text)" : `var(--${l.mode}-text)` }}>{l.affichage}</span>
          </div>
          <div aria-hidden style={{ height: 5, borderRadius: 3, background: "var(--border-soft)",
            marginTop: 4 }}>
            <div style={{ height: 5, borderRadius: 3, width: `${(l.valeur / max) * 100}%`,
              background: `var(--${l.mode}-line)` }} />
          </div>
        </div>))}
    </div>);
}

const carte: React.CSSProperties = { background: "var(--bg-surface)", border: "1px solid var(--border)",
  borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)", padding: "14px 16px" };

// ── V2-M5 : les onglets du bloc Rapports (cartographie ratifiée), sources signalées ────────
// Registre LBA (lecture PURE — il agrège communications MROS, verdicts de transactions en
// revue et passages de screening) ; MROS/goAML (/v1/mros — relecture OPPOSABLE R130, brouillon
// goAML généré, dossier FIGÉ) ; veille (/v1/regwatch/items — R309-R311, la veille PROPOSE,
// R44) ; habilitations (/v1/formations — certifications à date R238).
type EntreeRegistre = { id: string; type?: string; objet?: string; reference?: string; date?: string; statut?: string };
const SEED_REGISTRE: EntreeRegistre[] = [
  { id: "reg-1", type: "COMMUNICATION_MROS", objet: "Cèdre Maritime SARL — soupçon fondé", reference: "MROS-2026-0031", date: "10.08.2026", statut: "TRANSMISE" },
  { id: "reg-2", type: "VERDICT_TRANSACTION", objet: "SWIFT MT103 800 000 CHF — retenue", reference: "TXR-2026-1187", date: "08.08.2026", statut: "MOTIVÉ" },
  { id: "reg-3", type: "RUN_SCREENING", objet: "Passage périodique — 4 812 sujets, 1 hit", reference: "RUN-2026-0810", date: "10.08.2026", statut: "CONSIGNÉ" },
];
type Comm = { id: string; reference?: string; client?: string; statut?: string; date?: string };
const SEED_MROS: Comm[] = [
  { id: "mros-1", reference: "MROS-2026-0031", client: "Cèdre Maritime SARL", statut: "TRANSMISE", date: "10.08.2026" },
  { id: "mros-2", reference: "MROS-2026-0027", client: "Atlas Commodities Ltd", statut: "ACCUSÉE", date: "18.06.2026" },
  { id: "mros-3", reference: "MROS-2026-0019", client: "—", statut: "BROUILLON_GOAML", date: "04.05.2026" },
];
type Item = { id: string; source?: string; objet?: string; impact?: string; statut?: string; date?: string };
const SEED_VEILLE: Item[] = [
  { id: "rw-1", source: "FINMA", objet: "Circulaire 2026/2 — obligations de diligence numériques", impact: "Questionnaire KYC §identification", statut: "A_ANALYSER", date: "05.08.2026" },
  { id: "rw-2", source: "SECO", objet: "Révision liste sanctions — 14 entrées", impact: "Re-screening déclenché", statut: "TRAITE", date: "30.07.2026" },
  { id: "rw-3", source: "GAFI", objet: "Suivi renforcé — mise à jour pays", impact: "Matrice de risque pays v4.6 proposée", statut: "A_ANALYSER", date: "22.07.2026" },
];
type Habilitation = { id: string; collaborateur?: string; formation?: string; echeance?: string; statut?: string };
const SEED_HABILITATIONS: Habilitation[] = [
  { id: "h-1", collaborateur: "Sofia Berger", formation: "LBA — recyclage annuel", echeance: "30.09.2026", statut: "CERTIFIE" },
  { id: "h-2", collaborateur: "Thomas Roth", formation: "Sanctions & embargos", echeance: "15.08.2026", statut: "A_RENOUVELER" },
  { id: "h-3", collaborateur: "Ana Lopes", formation: "CDB 20 — certification", echeance: "01.07.2026", statut: "EN_RETARD" },
];

// ── V2-M16 : reporting réglementaire, BI sur mesure, tableaux de bord par profil ───────────
// Réglementaire : le CALENDRIER des obligations (période, échéance, base légale, état). O-Live
// ne décide AUCUNE base légale — le calendrier est une config gouvernée par la banque (R29,
// registre R-Q) ; l'écran l'affiche et signale les retards (R39), il ne les corrige pas.
// V2-M43 : la forme est celle du moteur (`GET /v1/reglementaire/calendrier`, R490/R491) —
// `code` identifie l'obligation, `statut` est CALCULÉ à la lecture, `depot` porte l'accusé.
type Obligation = { code: string; obligation?: string; periode?: string; echeance?: string | null;
  base?: string; statut?: string; responsable?: string; depot?: { reference?: string } | null };
// Les cinq statuts que le MOTEUR calcule (R491) — l'écran les affiche, il n'en invente aucun.
// `SANS_ECHEANCE` est neutre et non « en retard » : la loi n'a pas fixé de date (LBA art. 9).
const LIBELLE_STATUT: Record<string, string> = { DEPOSEE: "DÉPOSÉE", SANS_ECHEANCE: "SANS DÉLAI",
  EN_RETARD: "EN RETARD", DUE: "DUE", A_VENIR: "À VENIR" };
const MODE_STATUT: Record<string, ChipMode> = { DEPOSEE: "ok", SANS_ECHEANCE: "neutral",
  EN_RETARD: "alert", DUE: "warn", A_VENIR: "info" };

// Seed de MAQUETTE, au format du moteur. Son contenu vient de la v1 et n'a PAS été validé
// juridiquement (question Q-CR-1 de la spec, consignée pour revue) : ces intitulés, ces bases
// et ces dates sont là pour montrer l'écran, pas pour dire le droit.
const SEED_REGLEMENTAIRE: Obligation[] = [
  { code: "LBA-9", obligation: "Communication au MROS", periode: "au fil de l'eau", echeance: null,
    base: "LBA art. 9", statut: "SANS_ECHEANCE", responsable: "MLRO" },
  { code: "RAP-LBA-2025", obligation: "Rapport annuel LBA à la direction", periode: "2025", echeance: "2026-03-31",
    base: "OBA-FINMA", statut: "DEPOSEE", responsable: "MLRO", depot: { reference: "DIR-2026-0031" } },
  { code: "AEOI-2025", obligation: "Échange automatique de renseignements (AEOI/CRS)", periode: "2025",
    echeance: "2026-06-30", base: "LEAR", statut: "DEPOSEE", responsable: "Fiscalité", depot: { reference: "AFC-ACK-88214" } },
  { code: "FATCA-2025", obligation: "Déclaration FATCA", periode: "2025", echeance: "2026-09-30",
    base: "Accord FATCA", statut: "DUE", responsable: "Fiscalité" },
  { code: "AML-CALIB-2026", obligation: "Revue annuelle de calibrage AML", periode: "2026", echeance: "2026-07-31",
    base: "R377", statut: "EN_RETARD", responsable: "Compliance" },
];
// Nommé, et pas en ligne : `scripts/verifier-formes-api.mjs` ne sait comparer à l'API vivante
// qu'un seed qu'il peut évaluer — un littéral anonyme échappe à la vérification de forme.
const SEED_CALENDRIER = { obligations: SEED_REGLEMENTAIRE, preavisJours: 30 };

// BI sur mesure : l'ANNUAIRE des vues déclarées (/v1/bi/annuaire, R314-R315). Le libre-service
// s'exerce sur des vues DÉCLARÉES, jamais sur les tables : le périmètre est une décision, pas
// un effet de bord d'un accès base.
type VueBi = { id: string; vue?: string; domaine?: string; colonnes?: number; portee?: string };
const SEED_BI: VueBi[] = [
  { id: "v-1", vue: "dossiers_kyc", domaine: "Connaissance client", colonnes: 14, portee: "tenant" },
  { id: "v-2", vue: "alertes_aml", domaine: "Surveillance", colonnes: 11, portee: "tenant" },
  { id: "v-3", vue: "revues_echues", domaine: "Revue périodique", colonnes: 9, portee: "tenant" },
  { id: "v-4", vue: "charge_equipe", domaine: "Pilotage", colonnes: 7, portee: "équipe" },
];

// ── V2-M18 : rendre les ACTES aux capacités servies en consultation seule ─────────────────
// L'audit V2-M17 a nommé le manque le plus coûteux : quatre écrans montraient sans permettre
// d'agir, ce qui renvoie l'utilisateur vers la v1. Chaque acte ci-dessous existe au moteur ;
// le bouton n'est JAMAIS grisé — il énonce l'acte, sa garde et la route qui le porte (motif
// maison, cf. « Transmettre pour visa » du dossier KYC).
// V2-M37 : les actes des Rapports se POSENT. Trois d'entre eux n'étaient même pas offerts
// alors que le moteur les porte — dont la LEVÉE de gel, que la garde du gel annonçait déjà
// (« le gel se lève par un acte symétrique ») sans qu'aucun bouton ne permette de l'honorer.
// Un écran qui énonce une règle et n'en donne pas le moyen est pire qu'un écran muet.
const ACTES: Record<string, ActeMoteur[]> = {
  mros: [
    { cle: "decider", libelle: "Décider d'une communication", route: "POST /v1/mros/decider",
      methode: "POST", champs: [
        { cle: "riskCaseId", libelle: "Cas de risque", exemple: "RC-2026-0104" },
        { cle: "clientId", libelle: "Client", exemple: "CLI-00001" },
        { cle: "decision", libelle: "Décision (COMMUNIQUER | NE_PAS_COMMUNIQUER)", exemple: "COMMUNIQUER" },
        { cle: "motif", libelle: "Motif (R7 — exigé dans les DEUX sens)" }],
      garde: "R129/R130 — la décision de communiquer est un acte HUMAIN motivé ; O-Live ne la prend jamais." },
    { cle: "goaml", libelle: "Générer le brouillon goAML", route: "GET /v1/mros/:id/goaml",
      methode: "GET", champs: [{ cle: ":id", libelle: "Communication", exemple: "MROS-2026-0007" }],
      garde: "Le brouillon est PRÉ-REMPLI du dossier ; le dépôt sur le portail goAML reste manuel et tracé ici." },
    { cle: "gel", libelle: "Poser un gel des avoirs", route: "POST /v1/mros/:id/gel",
      methode: "POST", champs: [
        { cle: ":id", libelle: "Communication", exemple: "MROS-2026-0007" },
        { cle: "motif", libelle: "Motif (R131 — obligatoire)" }],
      garde: "R131 — motif obligatoire ; le gel se lève par un acte symétrique, jamais par expiration silencieuse." },
    { cle: "lever", libelle: "Lever un gel", route: "POST /v1/mros/:id/gel/lever",
      methode: "POST", champs: [
        { cle: ":id", libelle: "Communication", exemple: "MROS-2026-0007" },
        { cle: "motif", libelle: "Motif de la levée (R131)" }],
      garde: "R131 — l'acte SYMÉTRIQUE annoncé par la pose du gel. Il se motive comme elle : un gel ne disparaît jamais de lui-même, il est levé par quelqu'un, à une date, pour une raison." },
    { cle: "notification", libelle: "Saisir la notification reçue", route: "POST /v1/mros/:id/notification",
      methode: "POST", champs: [
        { cle: ":id", libelle: "Communication", exemple: "MROS-2026-0007" },
        { cle: "notification", libelle: "Contenu de la notification" }],
      garde: "R131 — la notification du bureau de communication est CONSIGNÉE telle que reçue ; c'est elle qui fait courir les délais." },
    { cle: "soumettre", libelle: "Tracer le dépôt goAML", route: "POST /v1/mros/:id/goaml/soumettre",
      methode: "POST", champs: [
        { cle: ":id", libelle: "Communication", exemple: "MROS-2026-0007" },
        { cle: "reference", libelle: "Référence du dépôt", exemple: "goAML-2026-8841" }],
      garde: "Le dépôt sur le portail goAML est MANUEL — O-Live ne l'exécute pas. Ce qui est tracé ici, c'est le fait qu'il a eu lieu, par qui et quand." },
  ],
  habilitations: [
    { cle: "assigner", libelle: "Assigner une formation", route: "POST /v1/formations/assignments",
      methode: "POST", champs: [
        { cle: "userId", libelle: "Collaborateur", exemple: "u-004" },
        { cle: "formationCode", libelle: "Code de formation", exemple: "LBA-2026" },
        { cle: "echeance", libelle: "Échéance", exemple: "2026-12-31" }],
      garde: "R236 — l'assignation nomme le collaborateur et l'échéance." },
    { cle: "viser", libelle: "Viser une complétion", route: "POST /v1/formations/assignments/:id/visa",
      methode: "POST", champs: [{ cle: ":id", libelle: "Assignation", exemple: "asg-12" }],
      garde: "R235/R13 — quatre yeux : celui qui a suivi la formation ne vise pas sa propre complétion." },
  ],
  veille: [
    { cle: "collecter", libelle: "Lancer une collecte", route: "POST /v1/regwatch/collecter",
      methode: "POST", champs: [],
      garde: "VR-01/02 — la collecte rapporte les publications ; elle n'en déduit aucun changement." },
    { cle: "proposer", libelle: "Proposer une application", route: "POST /v1/regwatch/items/:empreinte/proposer",
      methode: "POST", champs: [
        { cle: ":empreinte", libelle: "Empreinte de la publication", exemple: "a1b2c3" },
        { cle: "statut", libelle: "Statut proposé (PERTINENT | NON_PERTINENT)", exemple: "PERTINENT" },
        { cle: "justification", libelle: "Justification (R7)" }],
      garde: "VR-04/R44 — la veille PROPOSE ; l'application passe par le bac à sable puis un visa daté." },
  ],
  registre: [
    { cle: "exporter", libelle: "Exporter le registre", route: "POST /v1/audit/export",
      methode: "POST", champs: [
        { cle: "aggregateId", libelle: "Objet (vide = tout le tenant)", exemple: "KYC-2026-00447" },
        { cle: "type", libelle: "Type d'événement (facultatif)", exemple: "mros.gel.pose" }],
      garde: "R49 — l'export est une LECTURE horodatée du journal ; il ne modifie ni ne purge quoi que ce soit." },
  ],
};

export function Pilotage({ active, onNavigate, onOuvrirAudit }: {
  active: Ui2NavId; onNavigate: (id: Ui2NavId) => void; onOuvrirAudit?: () => void;
}) {
  const t = traduire(langue());
  // V2-M33 : la fenêtre d'observation est un CHOIX, plus une étiquette. Elle ne recalcule pas
  // les chiffres de maquette — elle dit sur quelle période ils sont lus, et le dira à l'API
  // le jour du branchement (paramètre `since`).
  const [periode, setPeriode] = useState<30 | 90 | 365>(30);
  const [onglet, setOnglet] = useState<"pilotage" | "direction" | "reglementaire" | "surmesure"
    | "registre" | "mros" | "veille" | "habilitations">("pilotage");
  // V2-M43 — E-V2-7 SOLDÉ : le calendrier réglementaire EXISTE au moteur (R490→R492). Il vient
  // du registre R-Q, versionné par date d'effet, et chaque statut est calculé à la lecture.
  // L'onglet lisait auparavant `/v1/rapports/kpi`, qui rend des indicateurs et non des
  // obligations — une fausse source, retirée au lot précédent.
  const reglementaire = useApiOrSeed<typeof SEED_CALENDRIER>("/v1/reglementaire/calendrier", SEED_CALENDRIER);
  const vuesBi = useApiOrSeed<VueBi[]>("/v1/bi/annuaire", SEED_BI);
  const registre = useApiOrSeed<EntreeRegistre[]>("/v1/mros", SEED_REGISTRE);
  const mros = useApiOrSeed<Comm[]>("/v1/mros", SEED_MROS);
  const veille = useApiOrSeed<Item[]>("/v1/regwatch/items", SEED_VEILLE);
  const habs0 = useApiOrSeed<unknown>("/v1/formations/assignments", SEED_HABILITATIONS);
  const habilitations = { ...habs0, data: listeHabilitations(habs0.data) };
  const pilule = (id: typeof onglet, label: string) => (
    <button key={id} onClick={() => setOnglet(id)} aria-pressed={onglet === id}
      style={{ padding: "6px 13px", borderRadius: 999, fontFamily: "inherit", fontSize: 12,
        fontWeight: 600, cursor: "pointer",
        border: onglet === id ? "1px solid var(--brand)" : "1px solid var(--border-input)",
        background: onglet === id ? "var(--brand-surface)" : "var(--bg-surface)",
        color: onglet === id ? "var(--brand)" : "var(--text-secondary)" }}>{label}</button>);
  const pilules = (
    <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
      {pilule("pilotage", t("Compliance"))}
      {pilule("direction", t("Direction"))}
      {pilule("reglementaire", t("Réglementaire"))}
      {pilule("surmesure", t("Sur mesure (BI)"))}
      {pilule("registre", t("Registre LBA"))}
      {pilule("mros", t("MROS · goAML"))}
      {pilule("veille", t("Veille"))}
      {pilule("habilitations", t("Habilitations"))}
    </div>);
  const chipDe = (label: string, mode: ChipMode) => <StatusChip mode={mode}>{label}</StatusChip>;
  // Barre d'actes d'un onglet + zone d'explication. Le clic n'exécute rien tant que l'écran
  // tourne sur des données de maquette : il DIT l'acte, sa garde et sa route — l'utilisateur
  // sait ce qui se passerait, et le branchement API est trivial (la route est déjà nommée).
  // La barre d'actes est MUTUALISÉE (acte-moteur.tsx) : Cross-Border et Rapports posent leurs
  // actes par le même chemin, avec le même rendu du refus — pas de deuxième copie qui dérive.
  const barreActes = (onglet: string) =>
    ACTES[onglet] ? <BarreActes actes={ACTES[onglet]} t={t} /> : null;

  if (onglet !== "pilotage" && onglet !== "direction") {
    const sousTitres = {
      reglementaire: reglementaire.isDemo ? t("données maquette")
        : t("source : /v1/reglementaire/calendrier — config gouvernée (R490), statuts calculés à date (R491)"),
      surmesure: vuesBi.isDemo ? t("données maquette")
        : t("source : /v1/bi/annuaire (R314-R315) — vues déclarées, jamais les tables"),
      registre: registre.isDemo ? t("données maquette") : t("source : /v1/mros + revue + runs (lecture pure — rien ne change d'état)"),
      mros: mros.isDemo ? t("données maquette") : t("source : /v1/mros (relecture opposable R130)"),
      veille: veille.isDemo ? t("données maquette") : t("source : /v1/regwatch/items (R309-R311)"),
      habilitations: habilitations.isDemo ? t("données maquette") : t("source : /v1/formations (certifications à date R238)"),
    } as const;
    return (
      <Ui2Shell nav={<Ui2Nav active={active} user="Marc Bregy" role={t("Directeur Compliance")}
        onNavigate={onNavigate} t={t}
        badges={{ journee: { n: 12 }, dossiers: { n: 48, sobre: true }, clients: { n: 214, sobre: true },
          surveillance: { n: 5, alert: true } }} />}
        header={<Ui2HeaderListe titre={t("Rapports")} sousTitre={sousTitres[onglet]}
          action={<Ui2Bouton onClick={() => exporterCsv(`olive-${onglet}-${jourFichier()}`,
            [t("Onglet"), t("Période"), t("Exporté le")],
            [[onglet, `${periode} ${t("jours")}`, new Date().toISOString().slice(0, 10)]])}>
            {t("Exporter")}</Ui2Bouton>} t={t} />}>
        {pilules}
        {onglet === "reglementaire" && (<>
          <EntityList grid="1.6fr 1fr 110px 1fr 130px" onOpen={() => onNavigate("rapports")}
            entetes={[t("Obligation"), t("Période"), t("Échéance"), t("Responsable"), t("État")]}
            lignes={(reglementaire.data?.obligations ?? []).map((o) => ({ id: o.code, cells: [
              <span key="o"><span style={{ fontWeight: 600, color: "var(--text)" }}>{t(o.obligation ?? "—")}</span>
                <span style={{ display: "block", fontSize: 10.5, color: "var(--text-muted)" }}>
                  {t("base déclarée")} : {o.base ?? "—"}</span></span>,
              t(o.periode ?? "—"),
              // « sans délai » (LBA art. 9) n'est pas une date : on l'écrit, on n'invente pas
              // d'échéance pour pouvoir colorer une pastille.
              <span key="e" className="mono">{o.echeance ?? t("sans délai")}</span>,
              t(o.responsable ?? "—"),
              chipDe(t(LIBELLE_STATUT[o.statut ?? ""] ?? o.statut ?? "—"), MODE_STATUT[o.statut ?? ""] ?? "neutral")] }))} />
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
            {t("Le calendrier des obligations est une configuration GOUVERNÉE de la banque, versionnée par date d'effet (R29) — O-Live ne qualifie aucune base légale et n'en déduit aucune obligation. Un retard est SIGNALÉ (R39), jamais corrigé ni masqué.")}</div>
        </>)}
        {onglet === "surmesure" && (<>
          <EntityList grid="1.2fr 1.2fr 110px 120px" onOpen={() => onNavigate("rapports")}
            entetes={[t("Vue déclarée"), t("Domaine"), t("Colonnes"), t("Portée")]}
            lignes={listeVuesBi(vuesBi.data).map((v) => ({ id: v.id, cells: [
              <span key="v" className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>{v.vue}</span>,
              t(v.domaine ?? "—"),
              <span key="c" className="mono">{v.colonnes ?? "—"}</span>,
              chipDe(t(v.portee === "tenant" ? "TENANT" : "ÉQUIPE"), "info")] }))} />
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
            {t("Le libre-service s'exerce sur des VUES DÉCLARÉES (R314-R315), jamais sur les tables : le périmètre de ce qu'un analyste peut interroger est une décision gouvernée, pas un effet de bord d'un accès base. Le cloisonnement par tenant et par équipe s'applique à la requête, pas après coup.")}</div>
        </>)}
        {onglet === "registre" && (<>
          {barreActes("registre")}
          <EntityList grid="180px 1.5fr 140px 110px 110px" onOpen={() => onNavigate("surveillance")}
            entetes={[t("Type"), t("Objet"), t("Référence"), t("Date"), t("Statut")]}
            lignes={(Array.isArray(registre.data) ? registre.data : []).slice(0, 30).map((e) => ({
              id: e.id, cells: [
                <span key="t" className="mono" style={{ fontSize: 10.5 }}>{t(e.type ?? "—")}</span>,
                <span key="o" style={{ fontWeight: 600, color: "var(--text)" }}>{t(e.objet ?? "—")}</span>,
                <span key="r" className="mono">{e.reference ?? "—"}</span>,
                <span key="d" className="mono">{e.date ?? "—"}</span>,
                chipDe(t(e.statut ?? "—"), "neutral")] }))} />
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
            {t("Le registre LBA est une LECTURE PURE du journal : communications MROS, verdicts de transactions en revue, passages de screening — rien ne change d'état ici, tout est déjà consigné ailleurs (R49).")}</div>
        </>)}
        {onglet === "mros" && (<>
          {barreActes("mros")}
          <EntityList grid="150px 1.4fr 150px 110px" onOpen={() => onNavigate("surveillance")}
            entetes={[t("Référence"), t("Client"), t("Statut"), t("Date")]}
            lignes={(Array.isArray(mros.data) ? mros.data : []).slice(0, 30).map((c) => ({
              id: c.id, cells: [
                <span key="r" className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>{c.reference ?? c.id}</span>,
                <span key="c" style={{ fontWeight: 600, color: "var(--text)" }}>{c.client ?? "—"}</span>,
                chipDe(t(c.statut === "BROUILLON_GOAML" ? "BROUILLON goAML" : c.statut ?? "—"),
                  c.statut === "TRANSMISE" ? "warn" : c.statut === "ACCUSÉE" ? "ok" : "neutral"),
                <span key="d" className="mono">{c.date ?? "—"}</span>] }))} />
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
            {t("La relecture d'une communication est OPPOSABLE (R130) et l'accès est habilité (art. 10a, R132). Le brouillon goAML est GÉNÉRÉ pré-rempli ; le dossier communiqué est FIGÉ — toute suite est un nouvel acte motivé (R7).")}</div>
        </>)}
        {onglet === "veille" && (<>
          {barreActes("veille")}
          <EntityList grid="90px 1.5fr 1.2fr 130px 110px" onOpen={() => onNavigate("param")}
            entetes={[t("Source"), t("Objet"), t("Impact identifié"), t("Statut"), t("Date")]}
            lignes={(Array.isArray(veille.data) ? veille.data : []).slice(0, 30).map((i) => ({
              id: i.id, cells: [
                <span key="s" className="mono" style={{ fontWeight: 600 }}>{i.source ?? "—"}</span>,
                <span key="o" style={{ fontWeight: 600, color: "var(--text)" }}>{t(i.objet ?? "—")}</span>,
                t(i.impact ?? "—"),
                chipDe(t(i.statut === "A_ANALYSER" ? "À ANALYSER" : "TRAITÉ"),
                  i.statut === "A_ANALYSER" ? "warn" : "ok"),
                <span key="d" className="mono">{i.date ?? "—"}</span>] }))} />
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
            {t("La veille réglementaire (R309-R311) identifie l'impact et PROPOSE — l'application d'un changement de paramétrage reste un acte humain, daté et signé (R44), via le bac à sable.")}</div>
        </>)}
        {onglet === "habilitations" && (<>
          {barreActes("habilitations")}
          <EntityList grid="1fr 1.3fr 120px 150px" onOpen={() => onNavigate("param")}
            entetes={[t("Collaborateur"), t("Formation"), t("Échéance"), t("Statut")]}
            lignes={(Array.isArray(habilitations.data) ? habilitations.data : []).slice(0, 30).map((h) => ({
              id: h.id, cells: [
                <span key="c" style={{ fontWeight: 600, color: "var(--text)" }}>{h.collaborateur ?? "—"}</span>,
                t(h.formation ?? "—"),
                <span key="e" className="mono">{h.echeance ?? "—"}</span>,
                chipDe(t(h.statut === "CERTIFIE" ? "CERTIFIÉ" : h.statut === "A_RENOUVELER" ? "À RENOUVELER" : "EN RETARD"),
                  h.statut === "CERTIFIE" ? "ok" : h.statut === "A_RENOUVELER" ? "warn" : "alert")] }))} />
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
            {t("Les certifications s'évaluent À DATE (R238) : une habilitation échue se voit — et un visa qui l'exige la vérifie au moment de l'acte, pas au moment du rapport.")}</div>
        </>)}
      </Ui2Shell>);
  }

  // ── Tableau de bord DIRECTION : la même doctrine que le dashboard Compliance (montrer où le
  //    travail est bloqué, jamais une collection d'indicateurs), mais sur les questions d'un
  //    directeur : capacité des équipes, tenue des délais, entrées et sorties du mois. Aucun
  //    indicateur de performance individuelle — la charge se lit par équipe (R39). ──
  if (onglet === "direction") {
    return (
      <Ui2Shell nav={<Ui2Nav active={active} user="Marc Bregy" role={t("Directeur Compliance")}
        onNavigate={onNavigate} t={t}
        badges={{ journee: { n: 12 }, dossiers: { n: 48, sobre: true }, clients: { n: 214, sobre: true },
          surveillance: { n: 5, alert: true } }} />}
        header={<Ui2HeaderListe titre={t("Direction")}
          sousTitre={t("août 2026 · Banque Olive Suisse SA · vue consolidée des deux sites")}
          action={<><Ui2Bouton onClick={() => setPeriode(periode === 30 ? 90 : periode === 90 ? 365 : 30)}>
            {`${periode} ${t("derniers jours")} ⌄`}</Ui2Bouton>
            <Ui2Bouton onClick={() => exporterCsv(`olive-pilotage-${jourFichier()}`,
              [t("Vue"), t("Période")], [["pilotage", `${periode} ${t("jours")}`]])}>
            {t("Exporter")}</Ui2Bouton></>} t={t} />}>
        {pilules}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
          <StatTile label={t("Entrées en relation du mois")} valeur={31} note={t("+6 vs juillet")}
            onOpen={() => onNavigate("entree")} />
          <StatTile label={t("Revues échues")} valeur={19} note={t("dont 7 au-delà de 30 j")} accent="warn"
            onOpen={() => onNavigate("revue")} />
          <StatTile label={t("Délai médian d'entrée en relation")} valeur={<>18 <span style={{ fontSize: 16 }}>j</span></>}
            note={t("cible interne : 15 j")} accent="warn" onOpen={() => onNavigate("entree")} />
          <StatTile label={t("Sorties prononcées")} valeur={4} note={t("dont 1 sur décision MLRO")}
            onOpen={() => onNavigate("revue")} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 14, alignItems: "start" }}>
          <section style={carte}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{t("Charge par équipe")}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
              {t("dossiers ouverts rapportés à la capacité déclarée")}</div>
            <BarMeter max={140} lignes={[
              { label: t("Gestion — Zurich"), valeur: 128, affichage: "128 %", mode: "alert" },
              { label: t("Gestion — Genève"), valeur: 94, affichage: "94 %", mode: "ok" },
              { label: t("Compliance"), valeur: 112, affichage: "112 %", mode: "warn" },
              { label: t("Middle office"), valeur: 71, affichage: "71 %", mode: "ok" }]} />
            <div style={{ fontSize: 11.5, color: "var(--text-body)", marginTop: 10, lineHeight: 1.55 }}>
              {t("La lecture : Zurich est en surcharge durable (128 %) et c'est là que le délai d'entrée en relation dérive. Le déséquilibre est entre sites, pas entre personnes — la capacité déclarée est la seule référence, aucun indicateur individuel n'est calculé.")}</div>
          </section>
          <section style={carte}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{t("Tenue des délais")}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
              {t("part des dossiers dans le SLA, par étape")}</div>
            <BarMeter max={100} lignes={[
              { label: t("Entrée en relation"), valeur: 82, affichage: "82 %", mode: "warn" },
              { label: t("Visa Compliance"), valeur: 91, affichage: "91 %", mode: "ok" },
              { label: t("Revue périodique"), valeur: 68, affichage: "68 %", mode: "alert" }]} />
            <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.5 }}>
              {t("Un dépassement de SLA est SIGNALÉ, jamais bloquant (R39) : le système mesure et notifie, il ne coerce pas.")}</div>
          </section>
        </div>
      </Ui2Shell>);
  }

  return (
    <Ui2Shell nav={<Ui2Nav active={active} user="Marc Bregy" role={t("Directeur Compliance")}
      onNavigate={onNavigate} t={t}
      badges={{ journee: { n: 12 }, dossiers: { n: 48, sobre: true }, clients: { n: 214, sobre: true },
        surveillance: { n: 5, alert: true } }} />}
      header={<Ui2HeaderListe titre={t("Compliance")}
        sousTitre={t("août 2026 · Banque Olive Suisse SA · Zurich et Genève")}
        action={<><Ui2Bouton onClick={() => setPeriode(periode === 30 ? 90 : periode === 90 ? 365 : 30)}>
          {`${periode} ${t("derniers jours")} ⌄`}</Ui2Bouton>
          <Ui2Bouton onClick={() => exporterCsv(`olive-direction-${jourFichier()}`,
            [t("Vue"), t("Période")], [["direction", `${periode} ${t("jours")}`]])}>
            {t("Exporter")}</Ui2Bouton>
          {onOuvrirAudit && <Ui2Bouton onClick={onOuvrirAudit}>{t("Rejeu d'audit →")}</Ui2Bouton>}</>} t={t} />}>
      {pilules}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
        <StatTile label={t("Dossiers en cours")} valeur={438} note={t("+12 sur 30 jours")}
          onOpen={() => onNavigate("dossiers")} />
        <StatTile label={t("Hors SLA")} valeur={37} note={t("8,4 % du stock")} accent="warn"
          onOpen={() => onNavigate("dossiers")} />
        <StatTile label={t("Délai médian d'ouverture")} valeur={<>11 <span style={{ fontSize: 16 }}>j</span></>}
          note={t("−3 j depuis janvier")} onOpen={() => onNavigate("entree")} />
        <StatTile label={t("Alertes AML ouvertes")} valeur={23} note={t("dont 4 en escalade MLRO")}
          accent="alert" onOpen={() => onNavigate("surveillance")} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 14, alignItems: "start" }}>
        <section style={carte}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{t("Où le travail est bloqué")}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
            {t("temps d'attente médian par étape du parcours")}</div>
          <BarMeter max={7} lignes={[
            { label: t("Saisie gestionnaire"), valeur: 2.1, affichage: "2,1 j", mode: "ok" },
            { label: t("Attente de documents client"), valeur: 6.8, affichage: "6,8 j", mode: "warn" },
            { label: t("Visa Compliance"), valeur: 4.3, affichage: "4,3 j", mode: "alert" },
            { label: t("Décision MLRO"), valeur: 1.4, affichage: "1,4 j", mode: "ok" },
            { label: t("Ouverture technique"), valeur: 0.6, affichage: "0,6 j", mode: "ok" }]} />
          <div style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "10px 12px", marginTop: 12, fontSize: 11.5,
            color: "var(--text-body)", lineHeight: 1.55 }}>
            {t("Le visa Compliance est le seul goulot interne : 4,3 jours pour 3 contrôleurs, dont 61 % du temps sur des dossiers à risque faible. Le reste de l'attente vient du client.")}</div>
        </section>
        <div style={{ display: "grid", gap: 14 }}>
          <section style={carte}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
              {t("Charge par contrôleur")}</div>
            {[{ ini: "SB", nom: "Sofia Berger", pct: 94, mode: "alert" },
              { ini: "TR", nom: "Thomas Roth", pct: 71, mode: "warn" },
              { ini: "AL", nom: "Ana Lopes", pct: 44, mode: "ok" }].map((c) => (
              <div key={c.ini} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                <span aria-hidden style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                  background: "var(--bg-subtle)", border: "1px solid var(--border)", display: "inline-flex",
                  alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 600,
                  color: "var(--text-secondary)" }}>{c.ini}</span>
                <span style={{ fontSize: 12, color: "var(--text-body)", minWidth: 90 }}>{c.nom}</span>
                <span aria-hidden style={{ flex: 1, height: 5, borderRadius: 3, background: "var(--border-soft)" }}>
                  <span style={{ display: "block", height: 5, borderRadius: 3, width: `${c.pct}%`,
                    background: `var(--${c.mode}-line)` }} /></span>
                <span className="mono" style={{ fontSize: 11.5, color: `var(--${c.mode}-text)` }}>{c.pct} %</span>
              </div>))}
            <button onClick={() => onNavigate("dossiers")} style={{ border: "none", background: "transparent",
              padding: 0, marginTop: 8, fontFamily: "inherit", fontSize: 11.5, fontWeight: 600,
              color: "var(--brand)", cursor: "pointer" }}>{t("Rééquilibrer 9 dossiers vers Ana Lopes →")}</button>
          </section>
          <section style={carte}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
              {t("Exposition par risque pays")}</div>
            {[{ label: t("Critique"), couleur: "var(--alert-line)", detail: t("6 clients · 41 M") },
              { label: t("Élevé"), couleur: "var(--warn-line)", detail: t("73 clients · 620 M") },
              { label: t("Modéré"), couleur: "var(--text-muted)", detail: t("218 clients · 2,1 Md") },
              { label: t("Faible"), couleur: "var(--ok-line)", detail: t("141 clients · 1,4 Md") }].map((r) => (
              <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 0" }}>
                <span aria-hidden style={{ width: 9, height: 9, borderRadius: 2, background: r.couleur }} />
                <span style={{ fontSize: 12, color: "var(--text-body)" }}>{r.label}</span>
                <span className="mono" style={{ marginLeft: "auto", fontSize: 11.5,
                  color: "var(--text-muted)" }}>{r.detail}</span>
              </div>))}
            <button onClick={() => onNavigate("surveillance")} style={{ border: "none", background: "transparent",
              padding: 0, marginTop: 8, fontFamily: "inherit", fontSize: 11.5, fontWeight: 600,
              color: "var(--brand)", cursor: "pointer" }}>{t("Ouvrir la carte des flux →")}</button>
          </section>
        </div>
      </div>
    </Ui2Shell>);
}
