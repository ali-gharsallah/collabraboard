import React from "react";
import { StatusChip } from "./StatusChip";
import { EntityList } from "./Listes";
import { Ui2Bouton } from "./Header";

/**
 * UI v2 — V2-M8 : « tout voir avant la bascule ». Chaque clé GOUVERNÉE du Paramétrage s'ouvre
 * sur sa vue détaillée : la grille de la matrice documentaire, le circuit de visa, la matrice
 * de droits, la structure du questionnaire… Tout est CONSULTATION de l'état en vigueur (R29 —
 * un dossier garde la version de sa création) ; toute modification passe par la SIMULATION de
 * la section (arbitrage n°1) puis une version datée, signée et validée par un humain (R44).
 */

const carte = (contenu: React.ReactNode) => (
  <section style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
    borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)", padding: "13px 16px",
    marginBottom: 12 }}>{contenu}</section>);

const doctrine = (texte: string) => (
  <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>{texte}</div>);

// Historique des versions — le socle commun de TOUTE clé gouvernée (R29/R48) : la version
// précédente reste rejouable, un dossier est toujours évalué contre la version à sa date.
function Historique({ lignes, t }: { lignes: { version: string; effet: string; note: string;
  courante?: boolean }[]; t: (s: string) => string }) {
  return carte(<>
    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
      {t("Historique des versions")}</div>
    {lignes.map((v) => (
      <div key={v.version} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0",
        borderBottom: "1px solid var(--border-row)", flexWrap: "wrap" }}>
        <span className="mono" style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text)" }}>{v.version}</span>
        <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{v.effet}</span>
        <span style={{ fontSize: 11.5, color: "var(--text-body)" }}>{v.note}</span>
        <span style={{ marginLeft: "auto" }}>
          <StatusChip mode={v.courante ? "ok" : "neutral"}>{t(v.courante ? "EN VIGUEUR" : "REJOUABLE")}</StatusChip></span>
      </div>))}
    <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
      {t("Un dossier garde la version en vigueur à sa création (R29) ; l'audit rejoue n'importe quelle date (R48).")}</div>
  </>);
}

// ── Matrice documentaire (doc-matrix) : la GRILLE exigences × niveau de vigilance.
const MATRICE_DOC: { code: string; exigence: string; sdd: string; cdd: string; edd: string }[] = [
  { code: "ID-01", exigence: "Pièce d'identité certifiée", sdd: "OBLIGATOIRE", cdd: "OBLIGATOIRE", edd: "OBLIGATOIRE" },
  { code: "ID-02", exigence: "Justificatif de domicile < 3 mois", sdd: "OBLIGATOIRE", cdd: "OBLIGATOIRE", edd: "OBLIGATOIRE" },
  { code: "BE-01", exigence: "Formulaire A / K — ayant droit économique", sdd: "OBLIGATOIRE", cdd: "OBLIGATOIRE", edd: "OBLIGATOIRE" },
  { code: "ST-01", exigence: "Organigramme de la structure", sdd: "—", cdd: "SI STRUCTURE", edd: "OBLIGATOIRE" },
  { code: "OF-01", exigence: "Origine des fonds documentée", sdd: "DÉCLARATIVE", cdd: "OBLIGATOIRE", edd: "OBLIGATOIRE" },
  { code: "OF-02", exigence: "Origine de la fortune (SoW) corroborée", sdd: "—", cdd: "SI > 1 MCHF", edd: "OBLIGATOIRE" },
  { code: "FI-01", exigence: "États financiers (personnes morales)", sdd: "—", cdd: "SI PM", edd: "SI PM" },
  { code: "PE-01", exigence: "Mémo PEP + approbation direction", sdd: "—", cdd: "—", edd: "OBLIGATOIRE" },
];

function celluleExigence(v: string, t: (s: string) => string) {
  const mode = v === "OBLIGATOIRE" ? "warn" as const : v === "—" ? "neutral" as const : "ok" as const;
  return v === "—" ? <span style={{ color: "var(--text-muted)" }}>—</span>
    : <StatusChip mode={mode}>{t(v)}</StatusChip>;
}

// ── Circuits de workflow : des ÉTAPES fermées, chacune portée par un rôle (quatre yeux R13).
function Etapes({ etapes, t }: { etapes: { n: number; libelle: string; role: string;
  note?: string }[]; t: (s: string) => string }) {
  return carte(<>
    {etapes.map((e, i) => (
      <div key={e.n} style={{ display: "flex", gap: 11, alignItems: "flex-start",
        paddingBottom: i < etapes.length - 1 ? 12 : 0 }}>
        <span className="mono" aria-hidden style={{ width: 24, height: 24, borderRadius: 999,
          background: "var(--brand-surface)", color: "var(--brand)", fontSize: 11.5, fontWeight: 700,
          display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{e.n}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, color: "var(--text)", fontWeight: 600 }}>{t(e.libelle)}
            <span className="mono" style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)",
              marginLeft: 8 }}>{e.role}</span></div>
          {e.note && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{t(e.note)}</div>}
        </div>
      </div>))}
  </>);
}

// ── Matrice de droits (iam.matrice, R282) : sections × rôles, L = lecture · É = écriture · V = visa.
const IAM_SECTIONS: { section: string; rm: string; co: string; mlro: string; audit: string }[] = [
  { section: "Dossiers KYC", rm: "É", co: "V", mlro: "V", audit: "L" },
  { section: "Screening & hits", rm: "L", co: "É", mlro: "V", audit: "L" },
  { section: "Risk cases", rm: "—", co: "É", mlro: "V", audit: "L" },
  { section: "Communications MROS", rm: "—", co: "—", mlro: "É", audit: "L" },
  { section: "Paramétrage", rm: "—", co: "L", mlro: "V", audit: "L" },
  { section: "Journal d'audit", rm: "—", co: "L", mlro: "L", audit: "L" },
];
const droit = (v: string) => v === "—" ? <span style={{ color: "var(--text-muted)" }}>—</span>
  : <span className="mono" style={{ fontWeight: 700, color: v === "V" ? "var(--brand)" : "var(--text)" }}>{v}</span>;

// ── Vue détaillée d'une clé. Le corps riche dépend de la clé ; toute clé a fiche + historique.
export function ParamCleDetail({ cle, t, onSandbox }: {
  cle: { cle: string; description?: string; valeur?: string; version?: string };
  t: (s: string) => string; onSandbox: () => void;
}) {
  const fiche = carte(
    <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "baseline" }}>
      <div><div className="microlabel">{t("Clé")}</div>
        <div className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{cle.cle}</div></div>
      <div><div className="microlabel">{t("Valeur en vigueur")}</div>
        <div className="mono" style={{ fontSize: 12.5, color: "var(--text)" }}>{t(cle.valeur ?? "—")}</div></div>
      <div><div className="microlabel">{t("Version · effet")}</div>
        <div className="mono" style={{ fontSize: 12.5, color: "var(--text)" }}>{cle.version ?? "—"}</div></div>
      <span style={{ marginLeft: "auto" }}>
        <Ui2Bouton primaire onClick={onSandbox}>{t("Simuler une modification →")}</Ui2Bouton></span>
    </div>);

  const histo = (note: string) => (
    <Historique t={t} lignes={[
      { version: (cle.valeur ?? "v?") + "", effet: cle.version ?? "—", note: t(note), courante: true },
      { version: "précédente", effet: t("version antérieure datée"), note: t("reste rejouable pour l'audit") },
    ]} />);

  let corps: React.ReactNode = null;
  let pied = "";

  if (cle.cle === "doc-matrix") {
    corps = (<>
      <EntityList grid="70px 1.6fr 1fr 1fr 1fr" onOpen={() => undefined}
        entetes={[t("Code"), t("Exigence"), "SDD", "CDD", "EDD"]}
        lignes={MATRICE_DOC.map((l) => ({ id: l.code, cells: [
          <span key="c" className="mono" style={{ fontWeight: 600 }}>{l.code}</span>,
          t(l.exigence), celluleExigence(l.sdd, t), celluleExigence(l.cdd, t), celluleExigence(l.edd, t)] }))} />
      {doctrine(t("La matrice est versionnée (R26/R27) : chaque exigence dépend du niveau de vigilance (SDD/CDD/EDD). Le dossier applique la version en vigueur à sa création (R29) — un durcissement ne réécrit jamais un dossier existant, il s'applique aux créations et revues suivantes."))}
    </>);
    pied = "Consultation de la grille en vigueur — la modification passe par une proposition versionnée soumise au comité (R44).";
  } else if (cle.cle === "kyc.questionnaire") {
    corps = (<>
      <EntityList grid="60px 1.6fr 110px 1fr" onOpen={() => undefined}
        entetes={["№", t("Section"), t("Champs"), t("Droits")]}
        lignes={["Identification", "Domiciliation & fiscalité", "Activité & profil économique",
          "Origine des fonds", "Origine de la fortune", "Structure & ayants droit",
          "Profil de risque & scoring", "Relation attendue (flux)", "Déclarations & signatures"]
          .map((s, i) => ({ id: String(i + 1), cells: [
            <span key="n" className="mono" style={{ fontWeight: 600 }}>{i + 1}</span>, t(s),
            <span key="c" className="mono">{[8, 6, 9, 7, 6, 10, 5, 6, 4][i]}</span>,
            <span key="d" style={{ fontSize: 11.5 }}>{t("RM saisit · CO valide (R15)")}</span>] }))} />
      {doctrine(t("Gabarit v7 — 9 sections obligatoires, 61 champs. Chaque section porte un visa séparé (R15) ; la précédence des refus de kyc.validate() est contractuelle."))}
    </>);
    pied = "Le gabarit est gouverné : un dossier ouvert sous v7 reste évalué sous v7 (R29).";
  } else if (cle.cle === "review.profiles") {
    corps = (<>
      <EntityList grid="130px 1fr 1fr 1fr" onOpen={() => undefined}
        entetes={[t("Profil"), "SDD", "CDD", "EDD"]}
        lignes={[{ p: "AR (annuelle)", v: ["36 mois", "24 mois", "12 mois"] },
          { p: "GAR (groupée)", v: ["24 mois", "12 mois", "6 mois"] }].map((l) => ({
          id: l.p, cells: [<span key="p" style={{ fontWeight: 600 }}>{t(l.p)}</span>,
            ...l.v.map((x, i) => <span key={i} className="mono">{x}</span>)] }))} />
      {doctrine(t("Profils de review AR/GAR × niveau de vigilance (R283) : la périodicité découle du profil, la revue groupée compose UBO ∪ garant (R469)."))}
    </>);
    pied = "La périodicité en vigueur à la création du cycle fait foi (R29).";
  } else if (cle.cle === "workflow.WF-KYC-03") {
    corps = (<>
      <Etapes t={t} etapes={[
        { n: 1, libelle: "Constitution du dossier", role: "RM", note: "9 sections du gabarit, pièces selon la matrice documentaire" },
        { n: 2, libelle: "Contrôle compliance — quatre yeux", role: "CO", note: "R13 : jamais le même acteur que l'étape 1 ; refus motivé possible" },
        { n: 3, libelle: "Approbation renforcée si EDD / PEP", role: "MLRO", note: "R44 : la PEPisation est décidée par un humain, jamais par une liste" },
        { n: 4, libelle: "Visa final et ouverture", role: "CO", note: "R15 : visa par section, le dossier passe APPROVED" }]} />
      {doctrine(t("Circuit v3 en vigueur depuis le 01.01.2025 — les étapes sont fermées : aucun saut, aucune fusion ; l'ordre des gardes est contractuel."))}
    </>);
    pied = "Le circuit est versionné : un dossier suit le circuit en vigueur à sa création (R29).";
  } else if (cle.cle === "businessTrip.chains") {
    corps = (<>
      <EntityList grid="140px 1fr 1fr" onOpen={() => undefined}
        entetes={[t("Risque pays"), t("Chaîne d'approbation"), t("Quota / contrainte")]}
        lignes={[{ r: "FAIBLE", c: "CO", q: "quota annuel R449" },
          { r: "MOYEN", c: "CO → MLRO", q: "quota annuel R449" },
          { r: "ÉLEVÉ", c: "CO → MLRO → Direction", q: "prospects interdits sans certificat (R465)" }].map((l) => ({
          id: l.r, cells: [<StatusChip key="r" mode={l.r === "ÉLEVÉ" ? "alert" : l.r === "MOYEN" ? "warn" : "ok"}>{t(l.r)}</StatusChip>,
            <span key="c" className="mono">{l.c}</span>, t(l.q)] }))} />
      {doctrine(t("Chaînes par risque pays (bloc 63) : l'activité en déplacement est bornée par le certificat de liens et les quotas (R448/R449/R465)."))}
    </>);
    pied = "La chaîne en vigueur à la demande du voyage fait foi (R29).";
  } else if (cle.cle === "offboarding.etapes") {
    corps = (<>
      <Etapes t={t} etapes={[
        { n: 1, libelle: "Demande de sortie motivée", role: "RM" },
        { n: 2, libelle: "Revue des positions et engagements", role: "CO" },
        { n: 3, libelle: "Contrôle AML de sortie", role: "CO", note: "R270 : le screening de sortie est obligatoire" },
        { n: 4, libelle: "Approbation de clôture", role: "MLRO" },
        { n: 5, libelle: "Clôture effective et archivage", role: "CO", note: "R49 : le journal reste — rien ne s'efface" }]} />
      {doctrine(t("5 étapes fermées (bloc 62) — la sortie est un workflow, pas une suppression."))}
    </>);
    pied = "Les étapes sont versionnées ; une sortie entamée suit sa version (R29).";
  } else if (cle.cle === "iam.matrice" || cle.cle === "iam.menus") {
    corps = (<>
      <EntityList grid="1.4fr 1fr 1fr 1fr 1fr" onOpen={() => undefined}
        entetes={[t("Section"), "RM", "CO", "MLRO", "AUDIT"]}
        lignes={IAM_SECTIONS.map((l) => ({ id: l.section, cells: [
          t(l.section), droit(l.rm), droit(l.co), droit(l.mlro), droit(l.audit)] }))} />
      {doctrine(t("L = lecture · É = écriture · V = visa. La matrice de droits est versionnée (R282) ; les menus par rôle en découlent — un écran non autorisé n'apparaît pas."))}
    </>);
    pied = "Tout changement de droits est une version datée, visée par le MLRO (R44).";
  } else if (cle.cle === "olivia.gouvernance.curseur") {
    corps = (<>
      {carte(<>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[["O1", "observe", false], ["O2", "propose, l'humain décide", true],
            ["O3", "agit sous portes humaines", false]].map(([n, l, actif]) => (
            <div key={n as string} style={{ flex: 1, minWidth: 150, padding: "10px 12px", borderRadius: 10,
              border: actif ? "1.5px solid var(--brand)" : "1px solid var(--border)",
              background: actif ? "var(--brand-surface)" : "var(--bg-subtle)" }}>
              <span className="mono" style={{ fontSize: 11.5, fontWeight: 700,
                color: actif ? "var(--brand)" : "var(--text-muted)" }}>{n}</span>
              <div style={{ fontSize: 11.5, color: "var(--text-body)", marginTop: 3 }}>{t(l as string)}</div>
              {actif ? <div style={{ marginTop: 6 }}><StatusChip mode="ok">{t("EN VIGUEUR")}</StatusChip></div> : null}
            </div>))}
        </div>
      </>)}
      {doctrine(t("Le curseur est au niveau O2 : Olivia propose, l'humain décide (R44). Aucun chemin de code n'exécute une sanction, une PEPisation ou une clôture automatiquement — sortie autorisée : événement, tâche, proposition."))}
    </>);
    pied = "Monter le curseur est une décision de gouvernance versionnée, jamais un réglage technique.";
  } else if (cle.cle === "aml.R17.seuil") {
    corps = carte(<>
      <div style={{ fontSize: 12.5, color: "var(--text-body)", lineHeight: 1.6 }}>
        {t("Ce paramètre se règle dans le bac à sable (écran 10) : l'effet est simulé sur 24 mois d'historique réel, le coût est nominatif, et l'application crée une version datée et signée.")}</div>
      <div style={{ marginTop: 10 }}>
        <Ui2Bouton primaire onClick={onSandbox}>{t("Ouvrir le bac à sable AML-R17 →")}</Ui2Bouton></div>
    </>);
    pied = "Production : × 2,0 · 30 j (v11, 12.09.2024) — 1 244 alertes générées depuis.";
  } else {
    pied = "Clé gouvernée par date (R29) — la modification passe par la simulation de la section, puis une version datée, signée et validée (R44).";
  }

  return (<>
    {fiche}
    {corps}
    {histo("valeur en vigueur")}
    {doctrine(t(pied))}
  </>);
}
