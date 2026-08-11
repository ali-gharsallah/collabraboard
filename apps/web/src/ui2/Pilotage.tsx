import React, { useState } from "react";
import { Ui2Shell } from "./Shell";
import { Ui2Nav, Ui2NavId } from "./Nav";
import { Ui2HeaderListe, Ui2Bouton } from "./Header";
import { StatTile } from "./StatTile";
import { StatusChip, ChipMode } from "./StatusChip";
import { EntityList } from "./Listes";
import { useApiOrSeed } from "../lib/useApiOrSeed";
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
type Obligation = { id: string; obligation?: string; periode?: string; echeance?: string;
  base?: string; statut?: string; responsable?: string };
const SEED_REGLEMENTAIRE: Obligation[] = [
  { id: "o-1", obligation: "Communication au MROS", periode: "au fil de l'eau", echeance: "sans délai",
    base: "LBA art. 9", statut: "A_JOUR", responsable: "MLRO" },
  { id: "o-2", obligation: "Rapport annuel LBA à la direction", periode: "exercice 2025", echeance: "31.03.2026",
    base: "OBA-FINMA", statut: "DEPOSE", responsable: "MLRO" },
  { id: "o-3", obligation: "Échange automatique de renseignements (AEOI/CRS)", periode: "exercice 2025",
    echeance: "30.06.2026", base: "LEAR", statut: "DEPOSE", responsable: "Fiscalité" },
  { id: "o-4", obligation: "Déclaration FATCA", periode: "exercice 2025", echeance: "30.09.2026",
    base: "Accord FATCA", statut: "EN_PREPARATION", responsable: "Fiscalité" },
  { id: "o-5", obligation: "Revue annuelle de calibrage AML", periode: "exercice 2026", echeance: "31.12.2026",
    base: "R377", statut: "EN_RETARD", responsable: "Compliance" },
];
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
type Acte = { cle: string; libelle: string; route: string; garde: string };
const ACTES: Record<string, Acte[]> = {
  mros: [
    { cle: "decider", libelle: "Décider d'une communication", route: "POST /v1/mros/decider",
      garde: "R129/R130 — la décision de communiquer est un acte HUMAIN motivé ; O-Live ne la prend jamais." },
    { cle: "goaml", libelle: "Générer le brouillon goAML", route: "GET /v1/mros/:id/goaml",
      garde: "Le brouillon est PRÉ-REMPLI du dossier ; le dépôt sur le portail goAML reste manuel et tracé ici." },
    { cle: "gel", libelle: "Poser un gel des avoirs", route: "POST /v1/mros/:id/gel",
      garde: "R131 — motif obligatoire ; le gel se lève par un acte symétrique, jamais par expiration silencieuse." },
  ],
  habilitations: [
    { cle: "assigner", libelle: "Assigner une formation", route: "POST /v1/formations/assignments",
      garde: "R236 — l'assignation nomme le collaborateur et l'échéance." },
    { cle: "viser", libelle: "Viser une complétion", route: "POST /v1/formations/assignments/:id/visa",
      garde: "R235/R13 — quatre yeux : celui qui a suivi la formation ne vise pas sa propre complétion." },
  ],
  veille: [
    { cle: "collecter", libelle: "Lancer une collecte", route: "POST /v1/regwatch/collecter",
      garde: "VR-01/02 — la collecte rapporte les publications ; elle n'en déduit aucun changement." },
    { cle: "proposer", libelle: "Proposer une application", route: "POST /v1/regwatch/items/:empreinte/proposer",
      garde: "VR-04/R44 — la veille PROPOSE ; l'application passe par le bac à sable puis un visa daté." },
  ],
  registre: [
    { cle: "exporter", libelle: "Exporter le registre", route: "POST /v1/audit/export",
      garde: "R49 — l'export est une LECTURE horodatée du journal ; il ne modifie ni ne purge quoi que ce soit." },
  ],
};

export function Pilotage({ active, onNavigate, onOuvrirAudit }: {
  active: Ui2NavId; onNavigate: (id: Ui2NavId) => void; onOuvrirAudit?: () => void;
}) {
  const t = traduire(langue());
  const [acte, setActe] = useState<Acte | null>(null);
  const [onglet, setOnglet] = useState<"pilotage" | "direction" | "reglementaire" | "surmesure"
    | "registre" | "mros" | "veille" | "habilitations">("pilotage");
  const reglementaire = useApiOrSeed<Obligation[]>("/v1/rapports/kpi", SEED_REGLEMENTAIRE);
  const vuesBi = useApiOrSeed<VueBi[]>("/v1/bi/annuaire", SEED_BI);
  const registre = useApiOrSeed<EntreeRegistre[]>("/v1/mros", SEED_REGISTRE);
  const mros = useApiOrSeed<Comm[]>("/v1/mros", SEED_MROS);
  const veille = useApiOrSeed<Item[]>("/v1/regwatch/items", SEED_VEILLE);
  const habilitations = useApiOrSeed<Habilitation[]>("/v1/formations/assignments", SEED_HABILITATIONS);
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
  const barreActes = (onglet: string) => {
    const actes = ACTES[onglet];
    if (!actes) return null;
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {actes.map((a) => (
            <Ui2Bouton key={a.cle} onClick={() => setActe(acte?.cle === a.cle ? null : a)}>
              {t(a.libelle)}</Ui2Bouton>))}
        </div>
        {acte && actes.some((a) => a.cle === acte.cle) && (
          <div role="status" style={{ marginTop: 9, background: "var(--warn-card)",
            border: "1px solid var(--warn-card-border)", borderLeft: "3px solid var(--warn-line)",
            borderRadius: 9, padding: "11px 13px" }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{t(acte.libelle)}</div>
            <div style={{ fontSize: 12, color: "var(--text-body)", marginTop: 4, lineHeight: 1.55 }}>
              {t(acte.garde)}</div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 6 }}>
              {acte.route}</div>
          </div>)}
      </div>);
  };

  if (onglet !== "pilotage" && onglet !== "direction") {
    const sousTitres = {
      reglementaire: reglementaire.isDemo ? t("données maquette")
        : t("source : /v1/rapports/kpi — calendrier gouverné (R29), jamais un avis juridique"),
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
          action={<Ui2Bouton>{t("Exporter")}</Ui2Bouton>} t={t} />}>
        {pilules}
        {onglet === "reglementaire" && (<>
          <EntityList grid="1.6fr 1fr 110px 1fr 130px" onOpen={() => undefined}
            entetes={[t("Obligation"), t("Période"), t("Échéance"), t("Responsable"), t("État")]}
            lignes={(reglementaire.data ?? []).map((o) => ({ id: o.id, cells: [
              <span key="o"><span style={{ fontWeight: 600, color: "var(--text)" }}>{t(o.obligation ?? "—")}</span>
                <span style={{ display: "block", fontSize: 10.5, color: "var(--text-muted)" }}>
                  {t("base déclarée")} : {o.base ?? "—"}</span></span>,
              t(o.periode ?? "—"),
              <span key="e" className="mono">{o.echeance ?? "—"}</span>,
              t(o.responsable ?? "—"),
              chipDe(t(o.statut === "DEPOSE" ? "DÉPOSÉ" : o.statut === "A_JOUR" ? "À JOUR"
                : o.statut === "EN_PREPARATION" ? "EN PRÉPARATION" : "EN RETARD"),
                o.statut === "EN_RETARD" ? "alert" : o.statut === "EN_PREPARATION" ? "warn" : "ok")] }))} />
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
            {t("Le calendrier des obligations est une configuration GOUVERNÉE de la banque, versionnée par date d'effet (R29) — O-Live ne qualifie aucune base légale et n'en déduit aucune obligation. Un retard est SIGNALÉ (R39), jamais corrigé ni masqué.")}</div>
        </>)}
        {onglet === "surmesure" && (<>
          <EntityList grid="1.2fr 1.2fr 110px 120px" onOpen={() => undefined}
            entetes={[t("Vue déclarée"), t("Domaine"), t("Colonnes"), t("Portée")]}
            lignes={(vuesBi.data ?? []).map((v) => ({ id: v.id, cells: [
              <span key="v" className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>{v.vue}</span>,
              t(v.domaine ?? "—"),
              <span key="c" className="mono">{v.colonnes ?? "—"}</span>,
              chipDe(t(v.portee === "tenant" ? "TENANT" : "ÉQUIPE"), "info")] }))} />
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
            {t("Le libre-service s'exerce sur des VUES DÉCLARÉES (R314-R315), jamais sur les tables : le périmètre de ce qu'un analyste peut interroger est une décision gouvernée, pas un effet de bord d'un accès base. Le cloisonnement par tenant et par équipe s'applique à la requête, pas après coup.")}</div>
        </>)}
        {onglet === "registre" && (<>
          {barreActes("registre")}
          <EntityList grid="180px 1.5fr 140px 110px 110px" onOpen={() => undefined}
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
          <EntityList grid="150px 1.4fr 150px 110px" onOpen={() => undefined}
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
          <EntityList grid="90px 1.5fr 1.2fr 130px 110px" onOpen={() => undefined}
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
          <EntityList grid="1fr 1.3fr 120px 150px" onOpen={() => undefined}
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
          action={<><Ui2Bouton>{t("30 derniers jours ⌄")}</Ui2Bouton><Ui2Bouton>{t("Exporter")}</Ui2Bouton></>} t={t} />}>
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
        action={<><Ui2Bouton>{t("30 derniers jours ⌄")}</Ui2Bouton><Ui2Bouton>{t("Exporter")}</Ui2Bouton>
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
