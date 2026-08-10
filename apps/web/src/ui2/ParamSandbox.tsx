import React, { useState } from "react";
import { Check } from "lucide-react";
import { Ui2Shell } from "./Shell";
import { Ui2Nav, Ui2NavId } from "./Nav";
import { Ui2HeaderDossier, Ui2Bouton } from "./Header";
import { StatusChip } from "./StatusChip";
import { SandboxSlider } from "./SandboxSlider";
import { EntityList } from "./Listes";
import { ParamCleDetail } from "./ParamDetail";
import { useApiOrSeed } from "../lib/useApiOrSeed";
import { traduire, langue } from "../lib/i18n";

/**
 * UI v2 — étape 8 : écran 10 « Paramétrage — bac à sable ». Changer un seuil sans savoir ce
 * qu'il produit est le vrai risque opérationnel : l'effet est SIMULÉ sur l'historique réel
 * avant toute mise en production. Le gain n'a de sens qu'avec son coût — les alertes fondées
 * qui n'auraient pas été levées sont listées NOMINATIVEMENT, avec leur issue réelle. Olivia
 * propose un réglage mais rien ne s'applique sans validation humaine (R44) ; l'application
 * crée une version datée et signée, la précédente reste rejouable (R29/R48).
 */

// Modèle de la simulation maquette (calé sur ses chiffres : ×2,0 → 1 244 ; ×2,5 → 812/419/13).
function simuler(seuilX10: number) {
  const s = seuilX10 / 10;
  const generees = Math.max(120, Math.round(s >= 2 ? 1244 - 864 * (s - 2) : 1244 + 600 * (2 - s)));
  const evitees = Math.max(0, 1244 - generees);
  const perdues = Math.round(evitees * 0.03);
  return { generees, evitees, fauxPositifs: evitees - perdues, perdues,
    heures: Math.round((evitees - perdues) * 0.62) };
}

// ── V2-M6 : le Paramétrage PAR SECTIONS (cartographie ratifiée). Chaque section liste ses
// clés GOUVERNÉES (/v1/parametres/registre — un dossier garde la version de sa création, R29)
// et porte l'arbitrage n°1 : les 8 bacs à sable ont disparu comme écrans, la SIMULATION est
// un onglet de chaque section (modèle écran 10, ci-contre sur AML-R17). Seeds au format API.
type Cle = { cle: string; description?: string; valeur?: string; version?: string };
const SECTIONS_PARAM: { id: string; label: string; seed: Cle[] }[] = [
  { id: "questionnaires", label: "Questionnaires", seed: [
    { cle: "kyc.questionnaire", description: "Gabarit KYC — 9 sections obligatoires", valeur: "v7", version: "01.06.2026" },
    { cle: "doc-matrix", description: "Matrice documentaire (exigences par niveau)", valeur: "v7", version: "01.06.2026" },
    { cle: "review.profiles", description: "Profils de review AR/GAR × SDD/CDD/EDD (R283)", valeur: "v3", version: "12.04.2026" }] },
  { id: "regles", label: "Règles", seed: [
    { cle: "aml.R17.seuil", description: "Écart déclenchant AML-R17", valeur: "× 2,0 · 30 j", version: "v11 · 12.09.2024" },
    { cle: "decision.renvoi.seuilBoucles", description: "Signal de boucles de renvoi (R476)", valeur: "3", version: "10.08.2026" },
    { cle: "review.groupe.criteres", description: "Composition des revues groupées (R469)", valeur: "UBO ∪ garant", version: "10.08.2026" }] },
  { id: "workflow", label: "Workflow", seed: [
    { cle: "workflow.WF-KYC-03", description: "Circuit de visa KYC — quatre yeux (R13)", valeur: "v3", version: "01.01.2025" },
    { cle: "businessTrip.chains", description: "Chaînes d'approbation BT par risque pays", valeur: "LOW: CO · HIGH: CO→MLRO", version: "05.05.2026" },
    { cle: "offboarding.etapes", description: "Étapes de sortie (bloc 62)", valeur: "5 étapes fermées", version: "22.03.2026" }] },
  { id: "acces", label: "Accès", seed: [
    { cle: "iam.menus", description: "Menus par rôle (RM/CO/MLRO/AUDIT)", valeur: "4 profils", version: "18.02.2026" },
    { cle: "iam.matrice", description: "Matrice de droits par section (R282)", valeur: "v2", version: "12.04.2026" },
    { cle: "sso.saml", description: "SSO — fournisseur d'identité", valeur: "SAML 2.0", version: "18.02.2026" }] },
  { id: "ia", label: "IA", seed: [
    { cle: "olivia.gouvernance.curseur", description: "Curseur d'autonomie O1/O2/O3", valeur: "O2 — propose, l'humain décide", version: "01.08.2026" },
    { cle: "olivia.budgets", description: "Budgets de runs par mission (R262)", valeur: "500 / jour", version: "01.08.2026" },
    { cle: "olivia.outils", description: "Outils en liste blanche (R264)", valeur: "12 outils", version: "01.08.2026" }] },
  // V2-M10 : la BANQUE elle-même — paramètres initiaux du tenant (R-Q exécutable R125-R128),
  // licence signée (R320) et référentiel des structures juridiques (barème R288).
  { id: "banque", label: "Banque", seed: [
    { cle: "banque.initialisation", description: "Paramètres initiaux du tenant (R-Q exécutable)", valeur: "2 requis à poser", version: "R125-R128" },
    { cle: "banque.licence", description: "Licence signée — modules activés, seats, échéance", valeur: "9 modules · 40 seats", version: "R320" },
    { cle: "legal.structures", description: "Structures juridiques — barème de risque (R288)", valeur: "8 formes", version: "v2 · 01.05.2026" }] },
  { id: "general", label: "Général", seed: [
    { cle: "core.langue", description: "Langues d'affichage (R326-R327)", valeur: "FR · EN · DE · IT · AR", version: "20.07.2026" },
    { cle: "integrations.ports", description: "Ports d'intégration (R284/R286)", valeur: "2 actifs — pas de secret = refus gracieux", version: "15.07.2026" },
    { cle: "audit.retention", description: "Rétention du journal (R49 — append-only)", valeur: "10 ans", version: "01.01.2025" }] },
];

export function ParamSandbox({ active, onNavigate }: { active: Ui2NavId; onNavigate: (id: Ui2NavId) => void }) {
  const t = traduire(langue());
  const [seuil, setSeuil] = useState(25);                  // ×2,5 — la proposition d'Olivia
  const [fenetre, setFenetre] = useState(30);
  const [pops, setPops] = useState({ eleve: true, multi: true, faible: false });
  const [soumis, setSoumis] = useState(false);
  const [section, setSection] = useState<string>("sandbox");
  const [cleOuverte, setCleOuverte] = useState<string | null>(null);   // V2-M8 : drill-down par clé
  const registre = useApiOrSeed<Cle[] | Record<string, unknown>>("/v1/parametres/registre", null as never);
  // V2-M7 (suite) : fraîcheur ETL par connecteur × famille (/v1/etl/fraicheur, R488).
  const fraicheur = useApiOrSeed<{ cle: string; connecteur: string; famille: string;
    dernierLot?: string; recuLe?: string; statut?: string }[]>("/v1/etl/fraicheur", [
    { cle: "GENERIQUE/TRANSACTIONS", connecteur: "GENERIQUE", famille: "TRANSACTIONS",
      dernierLot: "LOT-2026-0810-EOD", recuLe: "10.08.2026 22:05", statut: "RECONCILIE" },
    { cle: "GENERIQUE/CLIENTS", connecteur: "GENERIQUE", famille: "CLIENTS",
      dernierLot: "LOT-2026-0809-EOD", recuLe: "09.08.2026 22:03", statut: "RECONCILIE" },
    { cle: "GENERIQUE/COMPTES", connecteur: "GENERIQUE", famille: "COMPTES",
      dernierLot: "LOT-2026-0807-EOD", recuLe: "07.08.2026 22:04", statut: "INCIDENT" },
  ]);
  const pilule = (id: string, label: string) => (
    <button key={id} onClick={() => { setSection(id); setCleOuverte(null); }} aria-pressed={section === id}
      style={{ padding: "6px 13px", borderRadius: 999, fontFamily: "inherit", fontSize: 12,
        fontWeight: 600, cursor: "pointer",
        border: section === id ? "1px solid var(--brand)" : "1px solid var(--border-input)",
        background: section === id ? "var(--brand-surface)" : "var(--bg-surface)",
        color: section === id ? "var(--brand)" : "var(--text-secondary)" }}>{label}</button>);
  const pilules = (
    <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
      {pilule("sandbox", t("Bac à sable AML-R17 (écran 10)"))}
      {SECTIONS_PARAM.map((s) => pilule(s.id, t(s.label)))}
      {pilule("integrations", t("Intégrations (ETL)"))}
    </div>);
  const sectionActive = SECTIONS_PARAM.find((s) => s.id === section);

  if (section === "integrations") {
    return (
      <Ui2Shell nav={<Ui2Nav active={active} user="Sofia Berger" role="Compliance Officer"
        onNavigate={onNavigate} t={t}
        badges={{ journee: { n: 12 }, dossiers: { n: 48, sobre: true }, clients: { n: 214, sobre: true },
          surveillance: { n: 5, alert: true } }} />}
        header={<Ui2HeaderDossier nom={`${t("Paramétrage")} — ${t("Intégrations (ETL)")}`} initiales="IN"
          identifiants={fraicheur.isDemo ? t("données maquette") : t("source : /v1/etl/fraicheur (R488)")}
          puces={<StatusChip mode="neutral">{t("EOD · GÉNÉRIQUE CSV/SFTP")}</StatusChip>}
          actions={<Ui2Bouton onClick={() => setSection("sandbox")}>{t("← Bac à sable")}</Ui2Bouton>} t={t} />}>
        {pilules}
        <EntityList grid="130px 140px 1fr 160px 130px" onOpen={() => undefined}
          entetes={[t("Connecteur"), t("Famille"), t("Dernier lot"), t("Reçu le"), t("Statut")]}
          lignes={(Array.isArray(fraicheur.data) ? fraicheur.data : []).map((f) => ({
            id: f.cle, cells: [
              <span key="c" className="mono" style={{ fontWeight: 600 }}>{f.connecteur}</span>,
              <span key="f" className="mono">{f.famille}</span>,
              <span key="l" className="mono" style={{ color: "var(--text)" }}>{f.dernierLot ?? "—"}</span>,
              <span key="r" className="mono">{f.recuLe ?? "—"}</span>,
              <StatusChip key="s" mode={f.statut === "INCIDENT" ? "alert" : "ok"}>
                {t(f.statut === "INCIDENT" ? "INCIDENT" : "RÉCONCILIÉ")}</StatusChip>] }))} />
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
          {t("Pipeline arbitré (PO 10.08.2026) : connecteur générique CSV/SFTP, fin de journée, tout-ou-rien. La fraîcheur s'affiche, ne se devine pas (R488) ; un lot dont la réconciliation diverge est un INCIDENT consigné (R485), jamais une correction silencieuse ; l'import ne décide rien (R489) — le portail R140 et le screening prennent la suite.")}</div>
      </Ui2Shell>);
  }

  // V2-M8 : vue détaillée d'une clé gouvernée (grille doc-matrix, circuit de visa, matrice
  // de droits…) — tout est visible en v2 avant toute bascule.
  const cleDetail = cleOuverte && sectionActive?.seed.find((c) => c.cle === cleOuverte);
  if (sectionActive && cleDetail) {
    return (
      <Ui2Shell nav={<Ui2Nav active={active} user="Sofia Berger" role="Compliance Officer"
        onNavigate={onNavigate} t={t}
        badges={{ journee: { n: 12 }, dossiers: { n: 48, sobre: true }, clients: { n: 214, sobre: true },
          surveillance: { n: 5, alert: true } }} />}
        header={<Ui2HeaderDossier nom={t(cleDetail.description ?? cleDetail.cle)} initiales="CL"
          identifiants={`${t("Paramétrage")} — ${t(sectionActive.label)} · ` +
            (registre.isDemo ? t("données maquette") : t("source : /v1/parametres/registre (config gouvernée par date, R29)"))}
          puces={<StatusChip mode="neutral">{t("GOUVERNÉ")}</StatusChip>}
          actions={<Ui2Bouton onClick={() => setCleOuverte(null)}>{`← ${t(sectionActive.label)}`}</Ui2Bouton>} t={t} />}>
        {pilules}
        <ParamCleDetail cle={cleDetail} t={t}
          onSandbox={() => { setSection("sandbox"); setCleOuverte(null); }} />
      </Ui2Shell>);
  }

  if (sectionActive) {
    return (
      <Ui2Shell nav={<Ui2Nav active={active} user="Sofia Berger" role="Compliance Officer"
        onNavigate={onNavigate} t={t}
        badges={{ journee: { n: 12 }, dossiers: { n: 48, sobre: true }, clients: { n: 214, sobre: true },
          surveillance: { n: 5, alert: true } }} />}
        header={<Ui2HeaderDossier nom={`${t("Paramétrage")} — ${t(sectionActive.label)}`} initiales="PR"
          identifiants={registre.isDemo ? t("données maquette") : t("source : /v1/parametres/registre (config gouvernée par date, R29)")}
          puces={<StatusChip mode="neutral">{t("GOUVERNÉ")}</StatusChip>}
          actions={<Ui2Bouton primaire onClick={() => setSection("sandbox")}>{t("Simuler dans le bac à sable →")}</Ui2Bouton>} t={t} />}>
        {pilules}
        <EntityList grid="200px 1.5fr 1fr 140px" onOpen={(id) => setCleOuverte(id)}
          entetes={[t("Clé"), t("Description"), t("Valeur en vigueur"), t("Version · effet")]}
          lignes={sectionActive.seed.map((c) => ({ id: c.cle, cells: [
            <span key="k" className="mono" style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text)" }}>{c.cle}</span>,
            t(c.description ?? ""),
            <span key="v" className="mono">{t(c.valeur ?? "—")}</span>,
            <span key="e" className="mono">{c.version ?? "—"}</span>] }))} />
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
          {t("Config gouvernée par date : un dossier garde la version en vigueur à sa création (R29) — jamais la « courante ». Les 8 bacs à sable ont disparu comme écrans (arbitrage n°1) : la SIMULATION est un onglet de chaque section, sur le modèle de l'écran 10 — effet rejoué sur l'historique, coût nominatif, version datée et signée.")}</div>
      </Ui2Shell>);
  }
  const sim = simuler(seuil);
  const fmt = (n: number) => n.toLocaleString("fr-CH");

  const tuile = (label: string, valeur: string, note1: string, note2: string, mode: "ok" | "alert") => (
    <div style={{ flex: 1, background: "var(--bg-surface)", borderRadius: "var(--r-card)",
      border: `1px solid var(--${mode === "alert" ? "alert-line" : "border"})`,
      borderLeft: `3px solid var(--${mode}-line)`, boxShadow: "var(--shadow-card)", padding: "12px 14px" }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      <div className="mono" style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.1,
        color: mode === "alert" ? "var(--alert-text)" : "var(--text)" }}>{valeur}
        <span style={{ fontSize: 12, fontWeight: 500, color: `var(--${mode}-text)`, marginLeft: 6 }}>{note1}</span></div>
      <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 3 }}>{note2}</div>
    </div>);

  return (
    <Ui2Shell nav={<Ui2Nav active={active} user="Sofia Berger" role="Compliance Officer"
      onNavigate={onNavigate} t={t}
      badges={{ journee: { n: 12 }, dossiers: { n: 48, sobre: true }, clients: { n: 214, sobre: true },
        surveillance: { n: 5, alert: true } }} />}
      sideGauche={<div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{t("Paramètres")}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", margin: "3px 0 14px", lineHeight: 1.5 }}>
          {t("Les modifications ne touchent que la simulation tant qu'elles ne sont pas appliquées.")}</div>
        <SandboxSlider label={t("Seuil d'écart déclenchant")} affichage={`× ${(seuil / 10).toFixed(1).replace(".", ",")}`}
          min={15} max={50} value={seuil} onChange={setSeuil} ia
          production={{ valeur: 20, label: t("production : × 2,0") }} minLabel="× 1,5" maxLabel="× 5,0" />
        <SandboxSlider label={t("Fenêtre d'observation")} affichage={`${fenetre} j`}
          min={7} max={90} value={fenetre} onChange={setFenetre} minLabel="7 j" maxLabel="90 j" />
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", margin: "4px 0 7px" }}>
          {t("Populations concernées")}</div>
        {([["eleve", t("Risque élevé et critique")], ["multi", t("Structures multi-niveaux")],
          ["faible", t("Risque faible et modéré")]] as const).map(([cle, label]) => (
          <button key={cle} role="checkbox" aria-checked={pops[cle]}
            onClick={() => setPops((p) => ({ ...p, [cle]: !p[cle] }))}
            style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left",
              padding: "9px 11px", marginBottom: 6, cursor: "pointer", fontFamily: "inherit",
              borderRadius: 9, fontSize: 12, color: "var(--text-body)",
              border: pops[cle] ? "1px solid var(--brand)" : "1px solid var(--border-input)",
              background: pops[cle] ? "var(--brand-surface)" : "var(--bg-surface)" }}>
            <span aria-hidden style={{ width: 15, height: 15, borderRadius: 4, flexShrink: 0,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              border: pops[cle] ? "none" : "1.5px solid var(--border-input)",
              background: pops[cle] ? "var(--brand)" : "var(--bg-surface)" }}>
              {pops[cle] && <Check size={11} strokeWidth={3} color="#fff" />}</span>
            {label}</button>))}
        <div style={{ background: "var(--ai-card)", border: "1px solid var(--ai-card-border)",
          borderRadius: 11, padding: "10px 12px", marginTop: 12 }}>
          <span className="mono" style={{ fontSize: 9.5, fontWeight: 600, background: "var(--ai-chip)",
            borderRadius: 5, padding: "2px 6px", color: "var(--ai-text)" }}>IA</span>
          <div style={{ fontSize: 11.5, color: "var(--ai-text)", marginTop: 6, lineHeight: 1.55 }}>
            {t("Proposition d'Olivia : ce réglage vient de l'analyse des 1 244 alertes historiques. Il n'a pas été appliqué et ne le sera pas sans validation humaine.")}</div>
        </div>
      </div>} sideGaucheWidth={320}
      header={<Ui2HeaderDossier nom={t("AML-R17 — écart au profil de flux")} initiales="R17"
        identifiants={t("Version en production : v11 · dernière modification 12.09.2024 · 1 244 alertes générées depuis")}
        puces={<StatusChip mode="ai">{t("SIMULATION")}</StatusChip>}
        actions={<Ui2Bouton>{t("Historique des versions")}</Ui2Bouton>} t={t} />}>
      {pilules}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{t("Effet simulé sur l'historique")}</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("rejoué sur 24 mois de transactions réelles")}</span>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        {tuile(t("Alertes générées"), fmt(sim.generees), sim.evitees > 0 ? `−${fmt(sim.evitees)}` : "",
          `${t("contre")} 1 244 ${t("en production")}`, "ok")}
        {tuile(t("Faux positifs évités"), fmt(sim.fauxPositifs), "",
          `≈ ${fmt(sim.heures)} h ${t("de contrôle")}`, "ok")}
        {tuile(t("Alertes fondées perdues"), fmt(sim.perdues), "",
          t("dont 2 communications MROS"), "alert")}
      </div>
      {sim.perdues === 0 ? (
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 14 }}>
          {t("Aucune alerte fondée perdue à ce réglage — le coût de la simulation est nul.")}</div>
      ) : (
      <section style={{ background: "var(--alert-card)", border: "1px solid var(--alert-line)",
        borderRadius: "var(--r-card)", padding: "13px 16px", marginBottom: 14 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--alert-text)", marginBottom: 5 }}>
          {`${t("Les")} ${sim.perdues} ${t("alertes qui n'auraient pas été levées")}`}</div>
        <div style={{ fontSize: 11.5, color: "var(--text-body)", lineHeight: 1.55, marginBottom: 9 }}>
          {t("Le gain n'a de sens qu'avec son coût. Ces cas sont listés nominativement, avec leur issue réelle, pour que la décision se prenne en connaissance de cause.")}</div>
        {[{ nom: "Cèdre Maritime SARL", note: t("alerte de mars 2025"), chip: t("MROS COMMUNIQUÉ"), mode: "alert" as const },
          { nom: "Atlas Commodities Ltd", note: t("alerte de juin 2025"), chip: t("MROS COMMUNIQUÉ"), mode: "alert" as const },
          { nom: `${Math.max(0, sim.perdues - 2)} ${t("autres")}`, note: t("toutes classées sans suite"),
            chip: t("SANS SUITE"), mode: "neutral" as const }].slice(0, sim.perdues >= 2 ? 3 : 1).map((l) => (
          <div key={l.nom} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 11px",
            marginBottom: 6, borderRadius: 9, background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{l.nom}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>· {l.note}</span>
            <span style={{ marginLeft: "auto" }}><StatusChip mode={l.mode}>{l.chip}</StatusChip></span>
          </div>))}
      </section>)}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5, maxWidth: 420 }}>
          {t("L'application crée une nouvelle version datée et signée. La version précédente reste rejouable pour l'audit.")}</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {soumis ? (
            <span role="status" style={{ fontSize: 11.5, color: "var(--ok-text)" }}>
              ✓ {t("Soumis au comité — v12 proposée, datée et signée ; v11 reste en production et rejouable.")}</span>
          ) : (<>
            <Ui2Bouton>{t("Enregistrer")}</Ui2Bouton>
            <Ui2Bouton primaire onClick={() => setSoumis(true)}>{t("Soumettre au comité")}</Ui2Bouton>
          </>)}
        </span>
      </div>
    </Ui2Shell>);
}
