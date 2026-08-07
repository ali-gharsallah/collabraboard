import React, { useState, useEffect, lazy, Suspense } from "react";
import { traduire, langue, setLangue, LANGUES, Langue, estRTL, chargerAR } from "../lib/i18n";
import { apiBase } from "../lib/api";
import { OliveLogo } from "../components/OliveLogo";

// A6 (audit-architecture, PR #45 mergée) : code-splitting par écran — React.lazy + un
// <Suspense> unique ; patron conservé à l'IDENTIQUE lors de la réconciliation avec la
// branche pilote (les 51 écrans, dont Home/CPSI/Olivia/Runs, passent tous en chunk à la
// demande). Exports nommés ⇒ `.then((m) => ({ default: m.X }))`.
const ClientsList = lazy(() => import("../features/clients/ClientsList").then((m) => ({ default: m.ClientsList })));
const KycList = lazy(() => import("../features/kyc/KycList").then((m) => ({ default: m.KycList })));
const KycDetail = lazy(() => import("../features/kyc/KycDetail").then((m) => ({ default: m.KycDetail })));
const RejeuKyc = lazy(() => import("../features/kyc/RejeuKyc").then((m) => ({ default: m.RejeuKyc })));
const BatCampagne = lazy(() => import("../features/bat/BatCampagne").then((m) => ({ default: m.BatCampagne })));
const AmlParametres = lazy(() => import("../features/aml/AmlParametres").then((m) => ({ default: m.AmlParametres })));
const AlertsQueue = lazy(() => import("../features/alertes/AlertsQueue").then((m) => ({ default: m.AlertsQueue })));
const DossiersRisque = lazy(() => import("../features/dossiers/DossiersRisque").then((m) => ({ default: m.DossiersRisque })));
const GedPieces = lazy(() => import("../features/ged/GedPieces").then((m) => ({ default: m.GedPieces })));
const Onboarding = lazy(() => import("../features/onboarding/Onboarding").then((m) => ({ default: m.Onboarding })));
const AccountReview = lazy(() => import("../features/review/AccountReview").then((m) => ({ default: m.AccountReview })));
const Screening = lazy(() => import("../features/screening/Screening").then((m) => ({ default: m.Screening })));
const PersonnesLiees = lazy(() => import("../features/personnes/PersonnesLiees").then((m) => ({ default: m.PersonnesLiees })));
const ChangementCirconstances = lazy(() => import("../features/coc/ChangementCirconstances").then((m) => ({ default: m.ChangementCirconstances })));
const Dashboard = lazy(() => import("../features/dashboard/Dashboard").then((m) => ({ default: m.Dashboard })));
const TransfertsOrdres = lazy(() => import("../features/transactions/TransfertsOrdres").then((m) => ({ default: m.TransfertsOrdres })));
const Settlement = lazy(() => import("../features/settlement/Settlement").then((m) => ({ default: m.Settlement })));
const ScreeningAvance = lazy(() => import("../features/screening/ScreeningAvance").then((m) => ({ default: m.ScreeningAvance })));
const ReportingMros = lazy(() => import("../features/mros/ReportingMros").then((m) => ({ default: m.ReportingMros })));
const GedCoffre = lazy(() => import("../features/gedcoffre/GedCoffre").then((m) => ({ default: m.GedCoffre })));
const RegistreLBA = lazy(() => import("../features/registrelba/RegistreLBA").then((m) => ({ default: m.RegistreLBA })));
const InferenceScreen = lazy(() => import("../features/inference/RequirementChecklist").then((m) => ({ default: m.InferenceScreen })));
// Câblage complet back→front (2026-08-07) : les familles de routes jusqu'ici sans consommateur.
const RapportsConformite = lazy(() => import("../features/rapports/RapportsConformite").then((m) => ({ default: m.RapportsConformite })));
const GouvernanceO = lazy(() => import("../features/olivia/GouvernanceO").then((m) => ({ default: m.GouvernanceO })));
const PreRevue = lazy(() => import("../features/ia/PreRevue").then((m) => ({ default: m.PreRevue })));
const CapaciteEquipe = lazy(() => import("../features/workload/CapaciteEquipe").then((m) => ({ default: m.CapaciteEquipe })));
const SurveillanceEs = lazy(() => import("../features/surveillance/SurveillanceEs").then((m) => ({ default: m.SurveillanceEs })));
const CrmBanque = lazy(() => import("../features/crm/CrmBanque").then((m) => ({ default: m.CrmBanque })));
const ContactReports = lazy(() => import("../features/crm/ContactReports").then((m) => ({ default: m.ContactReports })));
const WorkflowDesigner = lazy(() => import("../features/workflow/WorkflowDesigner").then((m) => ({ default: m.WorkflowDesigner })));
const CorroborationKyc = lazy(() => import("../features/corroboration/CorroborationKyc").then((m) => ({ default: m.CorroborationKyc })));
const ParametrageRegistre = lazy(() => import("../features/parametrage/ParametrageRegistre").then((m) => ({ default: m.ParametrageRegistre })));
const ConfigGolive = lazy(() => import("../features/parametrage/ConfigGolive").then((m) => ({ default: m.ConfigGolive })));
const PmsMandats = lazy(() => import("../features/pms/PmsMandats").then((m) => ({ default: m.PmsMandats })));
const ReferentielAml = lazy(() => import("../features/aml/ReferentielAml").then((m) => ({ default: m.ReferentielAml })));
const AmlGap = lazy(() => import("../features/aml/AmlGap").then((m) => ({ default: m.AmlGap })));
const SandboxAml = lazy(() => import("../features/aml/SandboxAml").then((m) => ({ default: m.SandboxAml })));
const Ports = lazy(() => import("../features/ports/Ports").then((m) => ({ default: m.Ports })));
const NextBestAction = lazy(() => import("../features/nba/NextBestAction").then((m) => ({ default: m.NextBestAction })));
const WorkflowInstances = lazy(() => import("../features/workflow/WorkflowInstances").then((m) => ({ default: m.WorkflowInstances })));
const Tasks = lazy(() => import("../features/tasks/Tasks").then((m) => ({ default: m.Tasks })));
const Formations = lazy(() => import("../features/formations/Formations").then((m) => ({ default: m.Formations })));
const BusinessTrip = lazy(() => import("../features/businesstrip/BusinessTrip").then((m) => ({ default: m.BusinessTrip })));
const FinanceIslamique = lazy(() => import("../features/islamic/FinanceIslamique").then((m) => ({ default: m.FinanceIslamique })));
const CpsiProfiling = lazy(() => import("../features/cpsi/CpsiProfiling").then((m) => ({ default: m.CpsiProfiling })));
const CpsiSegmentation = lazy(() => import("../features/cpsi/CpsiSegmentation").then((m) => ({ default: m.CpsiSegmentation })));
const CpsiRiskCases = lazy(() => import("../features/cpsi/CpsiRiskCases").then((m) => ({ default: m.CpsiRiskCases })));
const CpsiParam = lazy(() => import("../features/cpsi/CpsiParam").then((m) => ({ default: m.CpsiParam })));
const CpsiGuide = lazy(() => import("../features/cpsi/CpsiGuide").then((m) => ({ default: m.CpsiGuide })));
const SandboxOnboarding = lazy(() => import("../features/onboarding/SandboxOnboarding").then((m) => ({ default: m.SandboxOnboarding })));
const Home = lazy(() => import("../features/home/Home").then((m) => ({ default: m.Home })));
const Offboarding = lazy(() => import("../features/offboarding/Offboarding").then((m) => ({ default: m.Offboarding })));
const Olivia = lazy(() => import("../features/olivia/Olivia").then((m) => ({ default: m.Olivia })));
const Runs = lazy(() => import("../features/olivia/Runs").then((m) => ({ default: m.Runs })));
const AmlWorkspace = lazy(() => import("../features/aml/AmlWorkspace").then((m) => ({ default: m.AmlWorkspace })));
const SdKyc = lazy(() => import("../features/parametrage/SdKyc").then((m) => ({ default: m.SdKyc })));
const SdAr = lazy(() => import("../features/parametrage/SdAr").then((m) => ({ default: m.SdAr })));
const SdGar = lazy(() => import("../features/parametrage/SdGar").then((m) => ({ default: m.SdGar })));
const AuditEcran = lazy(() => import("../features/audit/AuditEcran").then((m) => ({ default: m.AuditEcran })));
const AuditIt = lazy(() => import("../features/audit/AuditIt").then((m) => ({ default: m.AuditIt })));
const Integrations = lazy(() => import("../features/integrations/Integrations").then((m) => ({ default: m.Integrations })));
const Prospection = lazy(() => import("../features/onboarding/Prospection").then((m) => ({ default: m.Prospection })));
const CommandCenter = lazy(() => import("../features/command/CommandCenter").then((m) => ({ default: m.CommandCenter })));
const ComplianceCenter = lazy(() => import("../features/command/ComplianceCenter").then((m) => ({ default: m.ComplianceCenter })));
const ParamNav = lazy(() => import("../features/iam/ParamNav").then((m) => ({ default: m.ParamNav })));
const IamGuide = lazy(() => import("../features/iam/IamGuide").then((m) => ({ default: m.IamGuide })));
const SsoParam = lazy(() => import("../features/iam/SsoParam").then((m) => ({ default: m.SsoParam })));
const ParamFields = lazy(() => import("../features/parametrage/ParamFields").then((m) => ({ default: m.ParamFields })));
const MatriceDoc = lazy(() => import("../features/parametrage/MatriceDoc").then((m) => ({ default: m.MatriceDoc })));
const CocParam = lazy(() => import("../features/coc/CocParam").then((m) => ({ default: m.CocParam })));
const Sandboxes = lazy(() => import("../features/parametrage/Sandboxes").then((m) => ({ default: m.Sandboxes })));
const CrossBorder = lazy(() => import("../features/crossborder/CrossBorder").then((m) => ({ default: m.CrossBorder })));
const TxRisk = lazy(() => import("../features/txrisk/TxRisk").then((m) => ({ default: m.TxRisk })));
const FxExposition = lazy(() => import("../features/fx/FxExposition").then((m) => ({ default: m.FxExposition })));
const SwiftLab = lazy(() => import("../features/swift/SwiftLab").then((m) => ({ default: m.SwiftLab })));
const CustodyTa = lazy(() => import("../features/custody/CustodyTa").then((m) => ({ default: m.CustodyTa })));
const Builder = lazy(() => import("../features/builder/Builder").then((m) => ({ default: m.Builder })));
const Regwatch = lazy(() => import("../features/regwatch/Regwatch").then((m) => ({ default: m.Regwatch })));
const LegalRegistre = lazy(() => import("../features/legal/LegalRegistre").then((m) => ({ default: m.LegalRegistre })));
const BiReporting = lazy(() => import("../features/bi/BiReporting").then((m) => ({ default: m.BiReporting })));
const MobileAdmin = lazy(() => import("../features/mobile/MobileAdmin").then((m) => ({ default: m.MobileAdmin })));
const OpRisk = lazy(() => import("../features/oprisk/OpRisk").then((m) => ({ default: m.OpRisk })));

export function Router() {
  const [screen, setScreen] = useState<"home" | "clients" | "onboarding" | "kyc" | "aml" | "screening" | "alertes" | "dossiers" | "review" | "ubo" | "coc" | "ged" | "rejeu" | "dashboard" | "transactions" | "settlement" | "screeningadv" | "mros" | "gedcoffre" | "registrelba" | "inference" | "crm" | "contactreports" | "workflow" | "corroboration" | "parametrage" | "golive" | "pms" | "amlref" | "amlgap" | "sbaml" | "ports" | "nba" | "wfi" | "tasks" | "formations" | "trips" | "islamic" | "cpsiProfil" | "cpsiSeg" | "cpsiCases" | "cpsiParam" | "cpsiGuide" | "sbonb" | "offboarding" | "olivia" | "amlws" | "sdkyc" | "sdar" | "sdgar" | "paramfields" | "matricedoc" | "cocparam" | "sandboxes" | "oliviaruns" | "audit" | "command" | "paramnav" | "iamguide" | "ssoparam" | "compliance" | "auditit" | "integrations" | "prospection" | "crossborder" | "txrisk" | "fx" | "swiftlab" | "custodyta" | "builder" | "veille" | "legalreg" | "bi" | "mobileadmin" | "oprisk" | "sbkyc" | "sbbrm" | "sbcf" | "sbwf" | "bat" | "rapportsconf" | "gouvernanceo" | "prerevue" | "workload" | "surveillancees">("home");
  const [kycCode, setKycCode] = useState<string | null>(null);
  const [lang, setLang] = useState<Langue>(langue());
  // JW-05 (R328) : session expirée → re-connexion SANS rechargement — les brouillons en
  // cours (état React des écrans) survivent ; le login rejoue la vraie route deux temps.
  const [sessionExpiree, setSessionExpiree] = useState(false);
  const [loginEmail, setLoginEmail] = useState(""); const [loginMdp, setLoginMdp] = useState("");
  const [loginErreur, setLoginErreur] = useState("");
  // AR (5e langue, RTL) : le shell pose `dir`/`lang` sur <html> — géométrie logique, pas de
  // réécriture des écrans (les données restent LTR verbatim). LTR pour FR/EN/DE/IT.
  useEffect(() => {
    try {
      document.documentElement.dir = estRTL(lang) ? "rtl" : "ltr";
      document.documentElement.lang = lang.toLowerCase();
    } catch { /* pas de document (SSR/test sans DOM) — sans effet */ }
  }, [lang]);
  // AR persistée au démarrage (pack de langue paresseux, « pull ar out ») : on le charge puis on
  // re-rend. Avant chargement, l'AR retombe sur le FR (jamais un trou) ; après, le shell s'affiche en AR.
  const [, forcer] = useState(0);
  useEffect(() => {
    if (lang === "AR") chargerAR().then(() => forcer((n) => n + 1));
  }, [lang]);
  useEffect(() => {
    const h = () => setSessionExpiree(true);
    window.addEventListener("olive:session-expiree", h);
    return () => window.removeEventListener("olive:session-expiree", h);
  }, []);
  // i18n §10 (ratifié) : le libellé FR EST la clé du dictionnaire maquette — la traduction
  // s'applique en UN point ; une clé absente reste rendue en FR (écart par clé, lib/i18n).
  const t = traduire(lang);
  const [groupeOuvert, setGroupeOuvert] = useState<string | null>(null);

  // Menu latéral GROUPÉ — arborescence reprise de la maquette (`demo/olive-demo.html`, NAV) :
  // chaque écran câblé est rangé dans son domaine du cycle de vie. Item = [id d'écran, libellé, icône].
  type Item = [typeof screen, string, string];
  const GROUPES: { id: string; label: string; icon: string; items: Item[] }[] = [
    { id: "g_clients", label: "Clients & Relations", icon: "👥", items: [
      ["clients", "Clients", "◑"], ["kyc", "KYC", "◎"], ["ubo", "Personnes / UBO", "☺"],
      ["review", "Account Review", "↻"], ["coc", "Chgt circonstances", "⇆"],
      ["onboarding", "Onboarding", "🌱"], ["offboarding", "Offboarding", "🚪"]] },
    { id: "g_front", label: "Front & Croissance", icon: "✦", items: [
      ["prospection", "Pré-prospection", "🧲"], ["crm", "CRM Banque", "🗂"],
      ["contactreports", "Contact Reports", "📇"], ["nba", "Prochaines actions", "✦"],
      ["tasks", "Tâches", "✓"], ["workload", "Capacité équipe", "⚖"],
      ["trips", "Business Trip", "✈"], ["crossborder", "Cross-Border", "🌐"]] },
    { id: "g_comp", label: "Compliance & Risque", icon: "🛡", items: [
      ["compliance", "Compliance Center", "🛡"], ["screening", "Screening", "⌖"],
      ["screeningadv", "Screening avancé", "⌖"], ["alertes", "File d'alertes", "▤"],
      ["dossiers", "Dossiers de risque", "▤"], ["amlws", "AML Investigation", "◬"],
      ["aml", "Règles AML", "▤"], ["amlref", "Référentiel AML", "📖"], ["amlgap", "AML Gap", "🌊"], ["mros", "Reporting MROS", "📄"],
      ["corroboration", "Corroboration KYC", "⚖"], ["legalreg", "Legal — Contrats", "§"],
      ["oprisk", "Octopulse OpRisk", "🐙"], ["formations", "Formations", "🎓"],
      ["veille", "Veille réglementaire", "📡"], ["registrelba", "Registre LBA", "📖"], ["inference", "Checklist exigences", "🧭"],
      ["rapportsconf", "Rapports conformité", "📊"], ["prerevue", "Pré-revue IA", "🔎"]] },
    { id: "g_cpsi", label: "Profilage CPSI", icon: "◉", items: [
      ["cpsiProfil", "CPSI · Profil", "◉"], ["cpsiSeg", "CPSI · Segmentation", "▦"],
      ["cpsiCases", "CPSI · Risk cases", "▲"], ["cpsiParam", "CPSI · Barèmes", "⚖"],
      ["cpsiGuide", "CPSI · Guide", "📘"]] },
    { id: "g_tx", label: "Transactions & Marchés", icon: "⇄", items: [
      ["transactions", "Transferts & ordres", "➢"], ["txrisk", "Transactions Risk Monitoring", "⇄"],
      ["settlement", "Settlement", "⛓"], ["swiftlab", "Analyseur SWIFT/SEPA", "🔬"],
      ["custodyta", "Custody & TA", "📒"], ["fx", "Multi-devise & FX", "💱"], ["pms", "PMS", "▦"],
      ["mobileadmin", "Mobile Banking", "📱"], ["islamic", "Finance Islamique", "☪"]] },
    { id: "g_data", label: "Data & Intelligence", icon: "🫒", items: [
      ["olivia", "Olivia", "🫒"], ["oliviaruns", "Olivia · Runs", "▶"], ["gouvernanceo", "Gouvernance O", "🎚"],
      ["bi", "BI — Reporting sur mesure", "▥"], ["ged", "Pièces (GED)", "🗄"],
      ["gedcoffre", "GED / coffre", "🗄"], ["integrations", "Intégrations", "⇌"], ["ports", "Ports", "⇌"]] },
    { id: "g_wf", label: "Workflow", icon: "⎇", items: [
      ["workflow", "Workflow", "⎇"], ["builder", "Workflow Builder", "✎"], ["wfi", "Workflow Instances", "▶"]] },
    { id: "g_sb", label: "Bacs à sable", icon: "🧪", items: [
      ["sandboxes", "Bacs à sable", "🧪"], ["sbaml", "Bac à sable AML", "◬"], ["sbkyc", "Bac à sable KYC", "◎"],
      ["sbbrm", "Bac à sable BRM", "▲"], ["sbonb", "Bac à sable Onboarding", "🌱"],
      ["sbcf", "Bac à sable Central File", "📄"], ["sbwf", "Bac à sable Workflow", "⎇"]] },
    { id: "g_audit", label: "Audit", icon: "🔍", items: [
      ["audit", "Audit & transport", "🔍"], ["auditit", "Audit IT", "🖥"],
      ["surveillancees", "Surveillance ES", "🛰"]] },
    { id: "g_param", label: "Paramétrage", icon: "⚙", items: [
      ["parametrage", "Paramétrage", "⚙"], ["golive", "Config & Go-live", "🚦"],
      ["sdkyc", "Sections & droits", "◎"], ["sdar", "Profils AR", "↻"], ["sdgar", "Profils GAR", "▦"],
      ["paramfields", "Registre paramètres", "▤"], ["matricedoc", "Matrice documentaire", "▦"], ["cocparam", "Types de CoC", "⇆"],
      ["rejeu", "Rejeu KYC à date", "⏱"], ["bat", "Recette client (BAT)", "✅"],
      ["paramnav", "Utilisateurs & rôles", "👤"], ["iamguide", "Guide IAM", "📘"],
      ["ssoparam", "SSO / Fédération", "🔑"]] },
  ];
  const navItem = (id: typeof screen, label: string, icon: string, indent = false) =>
    <button key={id} onClick={() => setScreen(id)} style={{ display: "flex", alignItems: "center", gap: 9,
      width: "100%", textAlign: "left", padding: indent ? "7px 10px 7px 30px" : "8px 10px", marginBottom: 2,
      border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: screen === id ? 700 : 500,
      background: screen === id ? "#4A6B28" : "transparent", color: screen === id ? "#fff" : "#41492f" }}>
      <span aria-hidden style={{ width: 16, textAlign: "center", opacity: 0.85 }}>{icon}</span>
      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t(label)}</span></button>;
  const groupeActif = GROUPES.find((g) => g.items.some(([id]) => id === screen))?.id ?? null;
  const ouvert = groupeOuvert ?? groupeActif;
  const renderGroupe = (g: typeof GROUPES[number]) => {
    const open = ouvert === g.id; const actif = g.items.some(([id]) => id === screen);
    return <div key={g.id} style={{ marginTop: 3 }}>
      <button onClick={() => setGroupeOuvert(open ? "" : g.id)} style={{ display: "flex", alignItems: "center",
        gap: 9, width: "100%", textAlign: "left", padding: "8px 10px", border: "none", borderRadius: 8,
        cursor: "pointer", fontSize: 11, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase",
        color: actif ? "#3B5323" : "#8A9578", background: "transparent" }}>
        <span aria-hidden style={{ width: 16, textAlign: "center" }}>{g.icon}</span>
        <span style={{ flex: 1 }}>{t(g.label)}</span>
        <span aria-hidden style={{ fontSize: 9, opacity: 0.6 }}>{open ? "▾" : "▸"}</span></button>
      {open && <div>{g.items.map(([id, label, icon]) => navItem(id, label, icon, true))}</div>}
    </div>;
  };
  return <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", background: "#FAFBF7", color: "#2B331F" }}>
    <aside style={{ width: 238, flexShrink: 0, height: "100vh", position: "sticky", top: 0, overflowY: "auto",
      background: "#FFFFFF", borderRight: "1px solid #E7EBDD", padding: "16px 10px" }}>
      <div style={{ padding: "2px 8px 12px" }}><OliveLogo/></div>
      <div style={{ display: "flex", gap: 3, padding: "0 6px 10px" }}>
        {LANGUES.map((l) => <button key={l} aria-label={`langue ${l}`} onClick={async () => { if (l === "AR") await chargerAR(); setLangue(l); setLang(l); }}
          style={{ fontSize: 11, padding: "3px 9px", border: "1px solid " + (lang === l ? "#4A6B28" : "#E7EBDD"),
            borderRadius: 6, cursor: "pointer", fontWeight: lang === l ? 700 : 400,
            background: lang === l ? "#EEF3E4" : "#fff", color: lang === l ? "#3B5323" : "#5b6650" }}>{l}</button>)}
      </div>
      {navItem("home", "Accueil", "⌂")}
      {navItem("command", "Command Center", "⌁")}
      {navItem("dashboard", "Dashboard central", "▦")}
      <div style={{ height: 1, background: "#EEF1E7", margin: "8px 6px" }}/>
      {GROUPES.map(renderGroupe)}
    </aside>
    <main style={{ flex: 1, minWidth: 0, maxWidth: 1180, padding: "22px 28px", overflowX: "hidden" }}>
    {sessionExpiree && <div role="alert" style={{ background: "#FBEAE5", border: "1px solid #8C4A3C",
      borderRadius: 8, padding: 12, marginBottom: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <strong style={{ fontSize: 13 }}>{t("Session expirée — reconnectez-vous (votre brouillon en cours est conservé).")}</strong>
      <input placeholder={t("e-mail")} value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} style={{ fontSize: 12 }}/>
      <input placeholder={t("mot de passe")} type="password" value={loginMdp} onChange={(e) => setLoginMdp(e.target.value)} style={{ fontSize: 12 }}/>
      <button style={{ fontSize: 12 }} onClick={async () => {
        setLoginErreur("");
        try {
          const r = await fetch(`${apiBase()}/v1/auth/login`, { method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: loginEmail, password: loginMdp }) });
          const p = await r.json().catch(() => ({}));
          if (!r.ok || !p.access_token) { setLoginErreur(p.message ?? `Erreur ${r.status}`); return; }  // le refus, TEL QUEL (FE-04)
          sessionStorage.setItem("olive_jwt", p.access_token);
          setSessionExpiree(false); setLoginMdp("");
        } catch { setLoginErreur(t("Connexion impossible — vérifiez le réseau.")); }
      }}>{t("Se reconnecter")}</button>
      {loginErreur && <span style={{ fontSize: 12, color: "#8C4A3C" }}>{loginErreur}</span>}
    </div>}
    <Suspense fallback={<div style={{ padding: 24, color: "#888" }}>{t("Chargement de l'écran…")}</div>}>
    {screen === "home" && <Home/>}
    {screen === "dashboard" && <Dashboard/>}
    {screen === "clients" && <ClientsList/>}
    {screen === "onboarding" && <Onboarding/>}
    {screen === "kyc" && <div>
      <KycList onOpen={setKycCode}/>
      {kycCode && <div style={{ marginTop: 20 }}><KycDetail code={kycCode}/></div>}
    </div>}
    {screen === "screening" && <Screening/>}
    {screen === "screeningadv" && <ScreeningAvance/>}
    {screen === "aml" && <AmlParametres/>}
    {screen === "alertes" && <AlertsQueue/>}
    {screen === "dossiers" && <DossiersRisque/>}
    {screen === "review" && <AccountReview/>}
    {screen === "ubo" && <PersonnesLiees/>}
    {screen === "coc" && <ChangementCirconstances/>}
    {screen === "transactions" && <TransfertsOrdres/>}
    {screen === "settlement" && <Settlement/>}
    {screen === "mros" && <ReportingMros/>}
    {screen === "ged" && <GedPieces/>}
    {screen === "gedcoffre" && <GedCoffre/>}
    {screen === "registrelba" && <RegistreLBA/>}
    {screen === "inference" && <InferenceScreen/>}
    {screen === "rapportsconf" && <RapportsConformite/>}
    {screen === "gouvernanceo" && <GouvernanceO/>}
    {screen === "prerevue" && <PreRevue/>}
    {screen === "workload" && <CapaciteEquipe/>}
    {screen === "surveillancees" && <SurveillanceEs/>}
    {screen === "crm" && <CrmBanque/>}
    {screen === "contactreports" && <ContactReports/>}
    {screen === "workflow" && <WorkflowDesigner/>}
    {screen === "corroboration" && <CorroborationKyc/>}
    {screen === "parametrage" && <ParametrageRegistre/>}
    {screen === "golive" && <ConfigGolive/>}
    {screen === "pms" && <PmsMandats/>}
    {screen === "amlref" && <ReferentielAml/>}
    {screen === "amlgap" && <AmlGap/>}
    {screen === "sbaml" && <SandboxAml/>}
    {screen === "ports" && <Ports/>}
    {screen === "nba" && <NextBestAction/>}
    {screen === "wfi" && <WorkflowInstances/>}
    {screen === "tasks" && <Tasks/>}
    {screen === "formations" && <Formations/>}
    {screen === "trips" && <BusinessTrip/>}
    {screen === "rejeu" && <RejeuKyc/>}
    {screen === "islamic" && <FinanceIslamique/>}
    {screen === "cpsiProfil" && <CpsiProfiling/>}
    {screen === "cpsiSeg" && <CpsiSegmentation/>}
    {screen === "cpsiCases" && <CpsiRiskCases/>}
    {screen === "cpsiParam" && <CpsiParam/>}
    {screen === "cpsiGuide" && <CpsiGuide/>}
    {screen === "sbonb" && <SandboxOnboarding/>}
    {screen === "offboarding" && <Offboarding/>}
    {screen === "olivia" && <Olivia/>}
    {screen === "oliviaruns" && <Runs/>}
    {screen === "amlws" && <AmlWorkspace/>}
    {screen === "sdkyc" && <SdKyc/>}
    {screen === "sdar" && <SdAr/>}
    {screen === "sdgar" && <SdGar/>}
    {screen === "audit" && <AuditEcran/>}
    {screen === "auditit" && <AuditIt/>}
    {screen === "integrations" && <Integrations/>}
    {screen === "prospection" && <Prospection/>}
    {screen === "crossborder" && <CrossBorder/>}
    {screen === "txrisk" && <TxRisk onNaviguer={(e) => setScreen(e as never)}/>}
    {screen === "fx" && <FxExposition/>}
    {screen === "swiftlab" && <SwiftLab/>}
    {screen === "custodyta" && <CustodyTa/>}
    {screen === "builder" && <Builder/>}
    {screen === "veille" && <Regwatch/>}
    {screen === "legalreg" && <LegalRegistre/>}
    {screen === "bi" && <BiReporting/>}
    {screen === "mobileadmin" && <MobileAdmin/>}
    {screen === "oprisk" && <OpRisk/>}
    {screen === "command" && <CommandCenter onNaviguer={(e) => setScreen(e as never)}/>}
    {screen === "compliance" && <ComplianceCenter onNaviguer={(e) => setScreen(e as never)}/>}
    {screen === "paramnav" && <ParamNav/>}
    {screen === "bat" && <BatCampagne/>}
    {screen === "iamguide" && <IamGuide/>}
    {screen === "ssoparam" && <SsoParam/>}
    {screen === "paramfields" && <ParamFields/>}
    {screen === "matricedoc" && <MatriceDoc/>}
    {screen === "cocparam" && <CocParam/>}
    {/* Le hub Bacs à sable + 4 deep-links (sbkyc/sbbrm/sbcf/sbwf) qui l'ouvrent focalisé —
        la maquette (4 items de nav) est couverte 1:1, le hub reste UN écran (BS-01..06). */}
    {["sandboxes", "sbkyc", "sbbrm", "sbcf", "sbwf"].includes(screen) &&
      <Sandboxes focus={screen === "sandboxes" ? undefined : screen}/>}
    </Suspense>
    </main>
  </div>;
}
