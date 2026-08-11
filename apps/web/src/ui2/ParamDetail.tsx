import React, { useState } from "react";
import { StatusChip } from "./StatusChip";
import { EntityList } from "./Listes";
import { Ui2Bouton } from "./Header";
import { EditeurMatriceDoc, EditeurQuestionnaire, EditeurStructures, SectionQuest,
  LigneStructure } from "./ParamEdit";

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

// V2-M9 : gabarit éditable du questionnaire (les champs des sections 1 et 4 servent
// d'extrait concret ; la composition — activer/désactiver — porte sur les 9 sections).
const SEED_QUESTIONNAIRE: SectionQuest[] = [
  { section: "Identification", active: true, champs: [
    { code: "ID.1", label: "Nom", requise: true }, { code: "ID.2", label: "Prénom(s)", requise: true },
    { code: "ID.3", label: "Date de naissance", requise: true },
    { code: "ID.4", label: "Nationalité(s)", requise: true }] },
  { section: "Domiciliation & fiscalité", active: true, champs: [] },
  { section: "Activité & profil économique", active: true, champs: [] },
  { section: "Origine des fonds", active: true, champs: [
    { code: "OF.1", label: "Provenance des avoirs déposés", requise: true },
    { code: "OF.2", label: "Banque remettante", requise: false },
    { code: "OF.3", label: "Justificatif de transfert", requise: true }] },
  { section: "Origine de la fortune", active: true, champs: [] },
  { section: "Structure & ayants droit", active: true, champs: [] },
  { section: "Profil de risque & scoring", active: true, champs: [] },
  { section: "Relation attendue (flux)", active: true, champs: [] },
  { section: "Déclarations & signatures", active: true, champs: [] },
];

// V2-M10 : structures juridiques — miroir du barème MOTEUR (risk-engine.ts STRUCTURE_PTS,
// règle gouvernée R288) + exigence documentaire associée.
const STRUCTURES_JURIDIQUES: LigneStructure[] = [
  { code: "PP", libelle: "Personne physique", points: 0, exigence: "—" },
  { code: "SA", libelle: "Société anonyme", points: 10, exigence: "Formulaire K" },
  { code: "SARL", libelle: "Société à responsabilité limitée", points: 10, exigence: "Formulaire K" },
  { code: "FUND", libelle: "Fonds de placement", points: 15, exigence: "Formulaire K" },
  { code: "HOLDING", libelle: "Société holding", points: 20, exigence: "Organigramme + registre" },
  { code: "FOUNDATION", libelle: "Fondation", points: 25, exigence: "Formulaire A" },
  { code: "DOMICILE", libelle: "Société de domicile", points: 30, exigence: "Formulaire A" },
  { code: "TRUST", libelle: "Trust", points: 35, exigence: "Acte de trust + trustee" },
];

// V2-M10 : paramètres initiaux du tenant — extrait du R-Q exécutable (R125-R128,
// parametres.service.ts fait foi ; /v1/parametres/registre + /v1/parametres/valeur/:cle).
const RQ_INITIALISATION: { cle: string; regle: string; defaut: string; valeur?: string;
  requis?: boolean }[] = [
  { cle: "gedDocTypes", regle: "R110/R112", defaut: "aucun défaut", requis: true },
  { cle: "coreSystemeRef", regle: "R167", defaut: "aucun défaut", requis: true },
  { cle: "screeningSeuil", regle: "R100", defaut: "85", valeur: "85" },
  { cle: "cumulRolesAutorise", regle: "R31", defaut: "non", valeur: "non" },
  { cle: "depepDelaiJours", regle: "R33", defaut: "365", valeur: "365" },
  { cle: "onboardingSlaJours", regle: "—", defaut: "30 / 45 / 10", valeur: "30 / 45 / 10" },
  { cle: "workflowRoles", regle: "R173", defaut: "CO, ADMIN", valeur: "CO, ADMIN" },
  { cle: "docStorage", regle: "R180", defaut: "COFFRE_INTERNE", valeur: "COFFRE_INTERNE" },
];

const MODULES_LICENCE = ["kyc", "screening", "aml", "riskcases", "ged", "businesstrip",
  "crossborder", "mros", "etl"];

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
  // V2-M9 : les clés ÉDITABLES (Builder R304-R308 en formulaire) portent un onglet
  // Consultation / Modifier (brouillon). Les autres restent consultation + simulation.
  const editable = cle.cle === "doc-matrix" || cle.cle === "kyc.questionnaire"
    || cle.cle === "legal.structures";
  const [mode, setMode] = useState<"consult" | "edit">("consult");
  const ongletMode = editable && (
    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
      {([["consult", "Consultation"], ["edit", "Modifier (brouillon)"]] as const).map(([m, label]) => (
        <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m}
          style={{ padding: "5px 12px", borderRadius: 999, fontFamily: "inherit", fontSize: 12,
            fontWeight: 600, cursor: "pointer",
            border: mode === m ? "1px solid var(--brand)" : "1px solid var(--border-input)",
            background: mode === m ? "var(--brand-surface)" : "var(--bg-surface)",
            color: mode === m ? "var(--brand)" : "var(--text-secondary)" }}>{t(label)}</button>))}
    </div>);
  if (editable && mode === "edit") {
    return (<>
      {ongletMode}
      {cle.cle === "doc-matrix" ? <EditeurMatriceDoc base={MATRICE_DOC} t={t} />
        : cle.cle === "legal.structures" ? <EditeurStructures base={STRUCTURES_JURIDIQUES} t={t} />
        : <EditeurQuestionnaire base={SEED_QUESTIONNAIRE} t={t} />}
      <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
        {t("Même circuit que le Builder v1 (R304-R308), en formulaire : brouillon → diff → simulation R305 → publication motivée (R7) par un SECOND habilité (R13). La version en vigueur reste rejouable (R29/R48).")}</div>
    </>);
  }
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
  } else if (cle.cle === "coc.types") {
    corps = (<>
      <EntityList grid="130px 1.3fr 110px 130px 70px 90px" onOpen={() => undefined}
        entetes={[t("Type"), t("Libellé"), t("Matérialité"), t("Action requise"), t("Rôle"), t("Sévérité CPSI")]}
        lignes={[
          { c: "UBO_CHANGE", l: "Changement d'UBO", m: "HAUTE", a: "REVISION_KYC", r: "CO", s: "3" },
          { c: "NATIONALITE", l: "Changement de nationalité (identité)", m: "HAUTE", a: "REVISION_KYC", r: "CO", s: "3" },
          { c: "ACTIVITE", l: "Changement d'activité économique", m: "MOYENNE", a: "MAJ_CIBLEE", r: "CO", s: "2" },
          { c: "ADRESSE", l: "Changement d'adresse", m: "BASSE", a: "MAJ_CIBLEE", r: "RM", s: "1" },
        ].map((x) => ({ id: x.c, cells: [
          <span key="c" className="mono" style={{ fontSize: 10.5, fontWeight: 600 }}>{x.c}</span>, t(x.l),
          <StatusChip key="m" mode={x.m === "HAUTE" ? "alert" : x.m === "MOYENNE" ? "warn" : "neutral"}>{t(x.m)}</StatusChip>,
          <span key="a" className="mono" style={{ fontSize: 10.5 }}>{x.a}</span>,
          <span key="r" className="mono">{x.r}</span>, <span key="s" className="mono">{x.s}</span>] }))} />
      {doctrine(t("Registre versionné à date (R276-R278, /v1/coc/config) : chaque type porte sa matérialité, son action et son rôle traitant. La contrainte « matérialité HAUTE force la révision KYC » est un refus typé SERVI par le moteur (SD-06), jamais pré-calculé à l'écran ; un changement sur un champ d'identité déclenche un re-screening PROPOSÉ, jamais exécuté (R42/R44)."))}
    </>);
    pied = "Le CoC est un dossier à cycle de vie — la donnée vit sur la personne, les dossiers reçoivent des événements tracés, aucune bascule d'état par effet de bord.";
  } else if (cle.cle === "banque.golive") {
    corps = (<>
      {carte(<>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
          {t("Configuration reconstruite au 10.08.2026 (R127)")}</div>
        <div style={{ fontSize: 11.5, color: "var(--text-body)", lineHeight: 1.55 }}>
          {t("34 clés résolues à date — chaque valeur est celle en vigueur à la date demandée, pas la « courante ».")}</div>
      </>)}
      <section role="alert" style={{ background: "var(--alert-card)", border: "1px solid var(--alert-line)",
        borderRadius: "var(--r-card)", padding: "13px 16px", marginBottom: 12 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--alert-text)", marginBottom: 5 }}>
          {t("GO-LIVE BLOQUÉ (R128) — les clés requises manquantes sont NOMMÉES")}</div>
        {["gedDocTypes — types documentaires GED (R110/R112)", "coreSystemeRef — référence core banking (R167)"].map((x) => (
          <div key={x} className="mono" style={{ fontSize: 11.5, color: "var(--text-body)", padding: "3px 0" }}>✗ {t(x)}</div>))}
        <div style={{ fontSize: 11.5, color: "var(--text-body)", marginTop: 7, lineHeight: 1.55 }}>
          {t("Pas de go-live sur un questionnaire troué : l'activation exige zéro requis manquant ET la signature du répondant bancaire — elle est irréversible et journalisée.")}</div>
      </section>
      {doctrine(t("L'activation (POST /v1/parametres/activer) gouverne la mise en production : la config activée est gravée, datée et signée ; les dossiers créés ensuite la portent (R29). Aucune règle côté écran — le refus vient du moteur."))}
    </>);
    pied = "Écran v1 « Config & Go-live » repris tel quel : reconstruction à date + activation gouvernée, rien de précalculé.";
  } else if (cle.cle === "banque.bat") {
    corps = (<>
      <EntityList grid="110px 1.4fr 100px 130px" onOpen={() => undefined}
        entetes={[t("Module"), t("Cas de recette"), t("Verdict"), t("Écart")]}
        lignes={[
          { m: "kyc", i: "Ouverture dossier CDD — visas par section", v: "PASS", e: "" },
          { m: "screening", i: "Hit sanction — clôture motivée à 4 yeux", v: "PASS", e: "" },
          { m: "aml", i: "Alerte R17 — instruction et issue tracée", v: "PASS", e: "" },
          { m: "etl", i: "Lot EOD tout-ou-rien — rejet motivé", v: "PASS", e: "MINEUR" },
          { m: "mros", i: "Communication goAML — export opposable", v: "ECHEC", e: "BLOQUANT" },
        ].map((x) => ({ id: x.m + x.i, cells: [
          <span key="m" className="mono" style={{ fontWeight: 600 }}>{x.m}</span>, t(x.i),
          <StatusChip key="v" mode={x.v === "PASS" ? "ok" : "alert"}>{x.v}</StatusChip>,
          x.e ? <StatusChip key="e" mode={x.e === "BLOQUANT" ? "alert" : "warn"}>{t(x.e)}</StatusChip>
            : <span key="e" style={{ color: "var(--text-muted)" }}>—</span>] }))} />
      <section style={{ background: "var(--warn-card)", border: "1px solid var(--warn-card-border)",
        borderRadius: "var(--r-card)", padding: "12px 14px", margin: "12px 0" }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--warn-text)", marginBottom: 4 }}>
          {t("NON PROMOTABLE — le verdict fait autorité côté moteur")}</div>
        {["1 écart BLOQUANT ouvert (mros)", "visa de campagne manquant (R15)"].map((r) => (
          <div key={r} style={{ fontSize: 11.5, color: "var(--text-body)", padding: "2px 0" }}>• {t(r)}</div>))}
      </section>
      {doctrine(t("Recette client (R333) : le cahier est GÉNÉRÉ et filtré par licence — un tenant ne teste que ses modules licenciés, jamais un cahier rédigé à la main. L'écran rend l'état ; la promotion n'est possible que campagne complète, sans écart bloquant, VISÉE."))}
    </>);
    pied = "La promotion est un acte visé (R15) — l'écran ne re-décide rien.";
  } else if (cle.cle === "sso.saml") {
    corps = (<>
      {carte(<>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 12 }}>
          <span><span className="microlabel">{t("Fournisseur d'identité")}</span>
            <div className="mono">SAML 2.0 / OIDC</div></span>
          <span><span className="microlabel">{t("Secret client")}</span>
            <div><StatusChip mode="ok">{t("CONFIGURÉ — jamais servi au front")}</StatusChip></div></span>
          <span><span className="microlabel">{t("Rotation JWKS")}</span>
            <div className="mono">{t("dernière : 18.02.2026 · motivée")}</div></span>
        </div>
      </>)}
      {doctrine(t("SSO gouverné (R290) : le backend ne sert que « configuré / absent » — le secret ne descend JAMAIS (IM-01) ; « Tester » est un dry-run tracé (IM-03) ; la rotation JWKS est motivée (R7) et la bascule de mode se fait à DEUX REGARDS et à date (IM-04, R13). Les refus arrivent du moteur, tels quels."))}
    </>);
    pied = "La config déclarée s'écrit par le registre (clé ssoOidc) — même gouvernance que toute clé (R29).";
  } else if (cle.cle === "legal.structures") {
    corps = (<>
      <EntityList grid="90px 1.5fr 90px 1.2fr" onOpen={() => undefined}
        entetes={[t("Code"), t("Structure"), t("Points"), t("Exigence documentaire")]}
        lignes={STRUCTURES_JURIDIQUES.map((l) => ({ id: l.code, cells: [
          <span key="c" className="mono" style={{ fontWeight: 600 }}>{l.code}</span>, t(l.libelle),
          <StatusChip key="p" mode={l.points >= 25 ? "warn" : l.points === 0 ? "ok" : "neutral"}>{`${l.points} pts`}</StatusChip>,
          t(l.exigence)] }))} />
      {doctrine(t("Le barème structure fait partie du scoring KYC (règle gouvernée R288) : la forme juridique pèse dans le niveau de vigilance, et l'exigence documentaire associée alimente la matrice. Une société de domicile ou un trust n'entre jamais en SDD."))}
    </>);
    pied = "Modifier le barème = nouvelle version de règle (R288) — onglet « Modifier (brouillon) », circuit R305/R7/R13.";
  } else if (cle.cle === "banque.initialisation") {
    corps = (<>
      <EntityList grid="180px 90px 1fr 1fr 130px" onOpen={() => undefined}
        entetes={[t("Clé"), t("Règle"), t("Défaut"), t("Valeur posée"), t("Statut")]}
        lignes={RQ_INITIALISATION.map((l) => ({ id: l.cle, cells: [
          <span key="k" className="mono" style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text)" }}>{l.cle}</span>,
          <span key="r" className="mono">{l.regle}</span>, t(l.defaut),
          <span key="v" className="mono" style={{ color: "var(--text)" }}>{l.valeur ?? "—"}</span>,
          l.valeur ? <StatusChip key="s" mode="ok">{t("POSÉ")}</StatusChip>
            : <StatusChip key="s" mode={l.requis ? "alert" : "neutral"}>{t(l.requis ? "REQUIS MANQUANT" : "DÉFAUT")}</StatusChip>] }))} />
      {doctrine(t("Le R-Q exécutable (R125-R128) est la liste de naissance de chaque banque : les clés REQUISES sans défaut (types documentaires GED, référence core banking) doivent être posées avant la mise en production — un module dont la clé manque refuse gracieusement, il ne devine pas. Chaque pose passe par /v1/parametres/valeur/:cle, motivée et journalisée."))}
    </>);
    pied = "Un dossier garde la config en vigueur à sa création (R29) — l'initialisation ne se rejoue pas, elle se complète.";
  } else if (cle.cle === "banque.licence") {
    corps = (<>
      {carte(<>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          {MODULES_LICENCE.map((m) => (
            <span key={m} className="mono" style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px",
              borderRadius: 999, border: "1px solid var(--brand-border)", background: "var(--brand-surface)",
              color: "var(--brand)" }}>{m}</span>))}
        </div>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 12 }}>
          <span><span className="microlabel">{t("Seats")}</span><div className="mono">40</div></span>
          <span><span className="microlabel">{t("Échéance")}</span><div className="mono">31.12.2026</div></span>
          <span><span className="microlabel">{t("Signature")}</span>
            <div><StatusChip mode="ok">{t("Ed25519 VALIDE — vérifiable hors ligne")}</StatusChip></div></span>
        </div>
      </>)}
      {doctrine(t("La licence est un fichier SIGNÉ par l'éditeur (R320) : signature et expiration sont deux constats distincts — une licence expirée reste authentique, les modules deviennent inactifs mais l'audit reste lisible. Un tenant ne voit et ne teste que ses modules licenciés (cahier BAT filtré, R333)."))}
    </>);
    pied = "Le renouvellement passe par la console éditeur (espace séparé, rôle EDITOR) — jamais par ce paramétrage.";
  } else if (cle.cle === "aml.R17.seuil") {
    corps = carte(<>
      <div style={{ fontSize: 12.5, color: "var(--text-body)", lineHeight: 1.6 }}>
        {t("Ce paramètre se règle dans le bac à sable (écran 10) : l'effet est simulé sur 24 mois d'historique réel, le coût est nominatif, et l'application crée une version datée et signée.")}</div>
      <div style={{ marginTop: 10 }}>
        <Ui2Bouton primaire onClick={onSandbox}>{t("Ouvrir le bac à sable AML-R17 →")}</Ui2Bouton></div>
    </>);
    pied = "Production : × 2,0 · 30 j (v11, 12.09.2024) — 1 244 alertes générées depuis.";
  } else if (cle.cle.startsWith("crossborder.")) {
    // V2-M31 — le registre §CrossBorder (R462) se règle ICI, au Paramétrage, jamais dans
    // l'écran métier. Le moteur reconnaît deux familles de clés : celles qui ENGAGENT la
    // banque vis-à-vis d'un régulateur étranger (sévérités, entités, exemptions) et les
    // autres. Les premières exigent un engagement de responsabilité NOMINATIF (R445) — sans
    // confirmation, le moteur n'écrit RIEN : il refuse avec le pop-up en réponse.
    const engage = /severite|entites|exemption/i.test(cle.cle);
    corps = (<>
      {engage && <PopupEngagement cle={cle.cle} valeur={cle.valeur ?? "—"} t={t} />}
      {carte(<>
        <div className="microlabel" style={{ marginBottom: 6 }}>{t("Portée d'une modification")}</div>
        <div style={{ fontSize: 12.5, color: "var(--text-body)", lineHeight: 1.6 }}>
          {t("Actes FUTURS uniquement. Les checks déjà consignés gardent la version de matrice et la sévérité qui les ont jugés (grandfathering R29) — sans quoi un acte régulier hier deviendrait irrégulier demain, sans qu'aucun fait n'ait changé.")}</div>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 8 }}>
          GET /v1/crossborder/params/registre · POST /v1/crossborder/params/modifier</div>
      </>)}
    </>);
    pied = engage
      ? "R462 + R445 — clé ENGAGEANTE : la diffusion transfrontière et les exemptions engagent la banque vis-à-vis des régulateurs étrangers. Le moteur refuse toute écriture sans engagement nominatif."
      : "R462 — clé gouvernée par date (R29). Le country manual reste LA clé de lecture ; ce registre règle la façon dont le moteur s'en sert, jamais son contenu.";
  } else {
    pied = "Clé gouvernée par date (R29) — la modification passe par la simulation de la section, puis une version datée, signée et validée (R44).";
  }

  return (<>
    {ongletMode}
    {fiche}
    {corps}
    {histo("valeur en vigueur")}
    {doctrine(t(pied))}
  </>);
}


/**
 * Pop-up d'engagement de responsabilité (R445, mécanisme COMMUN du bloc 62 étendu au
 * Cross-Border par R462). Ce n'est pas une confirmation de politesse : le moteur REFUSE
 * l'écriture tant que le texte d'engagement et son auteur ne sont pas fournis, et le refus
 * porte le pop-up en réponse. L'écran le montre tel quel — ancien, nouveau, portée, rappel.
 */
function PopupEngagement({ cle, valeur, t }: { cle: string; valeur: string; t: (s: string) => string }) {
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState("");
  return carte(<>
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <StatusChip mode="warn">{t("ENGAGEMENT REQUIS")}</StatusChip>
      <span style={{ fontSize: 12, color: "var(--text-body)" }}>
        {t("Cette clé engage la banque vis-à-vis de régulateurs étrangers.")}</span>
      <span style={{ marginLeft: "auto" }}>
        <Ui2Bouton onClick={() => setOuvert(!ouvert)}>
          {t(ouvert ? "Fermer" : "Modifier avec engagement")}</Ui2Bouton></span>
    </div>
    {ouvert && (
      <div style={{ marginTop: 12, background: "var(--warn-card)",
        border: "1px solid var(--warn-card-border)", borderLeft: "3px solid var(--warn-line)",
        borderRadius: 9, padding: "12px 14px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12,
          marginBottom: 10 }}>
          <div><div className="microlabel">{t("Clé")}</div>
            <div className="mono" style={{ fontSize: 11.5 }}>{cle}</div></div>
          <div><div className="microlabel">{t("Valeur actuelle")}</div>
            <div className="mono" style={{ fontSize: 11.5 }}>{t(valeur)}</div></div>
          <div><div className="microlabel">{t("Portée")}</div>
            <div style={{ fontSize: 11.5 }}>{t("actes futurs (R29)")}</div></div>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--warn-text)", lineHeight: 1.55, marginBottom: 10 }}>
          {t("Rappel réglementaire — la diffusion transfrontière et les exemptions engagent la banque vis-à-vis des régulateurs étrangers. L'engagement est nominatif et consigné au journal.")}</div>
        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600,
          color: "var(--text-secondary)", marginBottom: 6 }}>
          {t("Texte d'engagement")}
          <textarea value={texte} onChange={(e) => setTexte(e.target.value)}
            aria-label={t("Texte d'engagement")} rows={2}
            style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 5,
              padding: "8px 10px", borderRadius: "var(--r-input)", fontFamily: "inherit",
              border: "1px solid var(--border-input)", fontSize: 12, color: "var(--text)",
              background: "var(--bg-surface)" }} /></label>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Ui2Bouton primaire>{t("Engager et publier")}</Ui2Bouton>
          <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
            {texte.trim()
              ? t("Le moteur écrira une version datée et l'engagement nominatif au journal.")
              : t("Sans texte d'engagement, le moteur REFUSE l'écriture — rien n'est publié.")}</span>
        </div>
      </div>)}
  </>);
}
