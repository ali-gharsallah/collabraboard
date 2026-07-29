import React, { useState, useEffect, lazy, Suspense } from "react";
import { traduire, langue, setLangue, LANGUES, Langue } from "../lib/i18n";
import { apiBase } from "../lib/api";

// A6 (audit-architecture, PR #45 mergée) : code-splitting par écran — React.lazy + un
// <Suspense> unique ; patron conservé à l'IDENTIQUE lors de la réconciliation avec la
// branche pilote (les 51 écrans, dont Home/CPSI/Olivia/Runs, passent tous en chunk à la
// demande). Exports nommés ⇒ `.then((m) => ({ default: m.X }))`.
const ClientsList = lazy(() => import("../features/clients/ClientsList").then((m) => ({ default: m.ClientsList })));
const KycCreate = lazy(() => import("../features/kyc/KycCreate").then((m) => ({ default: m.KycCreate })));
const KycDetail = lazy(() => import("../features/kyc/KycDetail").then((m) => ({ default: m.KycDetail })));
const RejeuKyc = lazy(() => import("../features/kyc/RejeuKyc").then((m) => ({ default: m.RejeuKyc })));
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
const CrmBanque = lazy(() => import("../features/crm/CrmBanque").then((m) => ({ default: m.CrmBanque })));
const ContactReports = lazy(() => import("../features/crm/ContactReports").then((m) => ({ default: m.ContactReports })));
const WorkflowDesigner = lazy(() => import("../features/workflow/WorkflowDesigner").then((m) => ({ default: m.WorkflowDesigner })));
const CorroborationKyc = lazy(() => import("../features/corroboration/CorroborationKyc").then((m) => ({ default: m.CorroborationKyc })));
const ParametrageRegistre = lazy(() => import("../features/parametrage/ParametrageRegistre").then((m) => ({ default: m.ParametrageRegistre })));
const ConfigGolive = lazy(() => import("../features/parametrage/ConfigGolive").then((m) => ({ default: m.ConfigGolive })));
const PmsMandats = lazy(() => import("../features/pms/PmsMandats").then((m) => ({ default: m.PmsMandats })));
const ReferentielAml = lazy(() => import("../features/aml/ReferentielAml").then((m) => ({ default: m.ReferentielAml })));
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
  const [screen, setScreen] = useState<"home" | "clients" | "onboarding" | "kyc" | "aml" | "screening" | "alertes" | "dossiers" | "review" | "ubo" | "coc" | "ged" | "rejeu" | "dashboard" | "transactions" | "settlement" | "screeningadv" | "mros" | "gedcoffre" | "registrelba" | "crm" | "contactreports" | "workflow" | "corroboration" | "parametrage" | "golive" | "pms" | "amlref" | "sbaml" | "ports" | "nba" | "wfi" | "tasks" | "formations" | "trips" | "islamic" | "cpsiProfil" | "cpsiSeg" | "cpsiCases" | "cpsiParam" | "cpsiGuide" | "sbonb" | "offboarding" | "olivia" | "amlws" | "sdkyc" | "sdar" | "sdgar" | "paramfields" | "cocparam" | "sandboxes" | "oliviaruns" | "audit" | "command" | "paramnav" | "iamguide" | "ssoparam" | "compliance" | "auditit" | "integrations" | "prospection" | "crossborder" | "txrisk" | "fx" | "swiftlab" | "custodyta" | "builder" | "veille" | "legalreg" | "bi" | "mobileadmin" | "oprisk">("home");
  const [kycCode, setKycCode] = useState<string | null>(null);
  const [lang, setLang] = useState<Langue>(langue());
  // JW-05 (R328) : session expirée → re-connexion SANS rechargement — les brouillons en
  // cours (état React des écrans) survivent ; le login rejoue la vraie route deux temps.
  const [sessionExpiree, setSessionExpiree] = useState(false);
  const [loginEmail, setLoginEmail] = useState(""); const [loginMdp, setLoginMdp] = useState("");
  const [loginErreur, setLoginErreur] = useState("");
  useEffect(() => {
    const h = () => setSessionExpiree(true);
    window.addEventListener("olive:session-expiree", h);
    return () => window.removeEventListener("olive:session-expiree", h);
  }, []);
  // i18n §10 (ratifié) : le libellé FR EST la clé du dictionnaire maquette — la traduction
  // s'applique en UN point ; une clé absente reste rendue en FR (écart par clé, lib/i18n).
  const t = traduire(lang);
  const tab = (id: typeof screen, label: string) =>
    <button onClick={() => setScreen(id)} style={{ padding: "8px 16px", border: "none",
      borderRadius: 8, cursor: "pointer", fontWeight: screen === id ? 700 : 400,
      background: screen === id ? "#4A6B28" : "#eee", color: screen === id ? "#fff" : "#333" }}>
      {t(label)}</button>;
  return <div style={{ fontFamily: "system-ui", padding: 24, maxWidth: 1100, margin: "0 auto" }}>
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
    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", marginBottom: 6 }}>
      {LANGUES.map((l) => <button key={l} aria-label={`langue ${l}`}
        onClick={() => { setLangue(l); setLang(l); }}
        style={{ fontSize: 11, padding: "2px 8px", border: "none", borderRadius: 6, cursor: "pointer",
          fontWeight: lang === l ? 700 : 400, background: lang === l ? "#4A6B28" : "#eee",
          color: lang === l ? "#fff" : "#333" }}>{l}</button>)}
    </div>
    <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
      {tab("home", "Accueil")}{tab("command", "Command Center")}{tab("compliance", "Compliance Center")}{tab("dashboard", "Dashboard central")}{tab("clients", "Clients")}{tab("onboarding", "Onboarding")}{tab("prospection", "Pré-prospection")}{tab("kyc", "KYC")}{tab("screening", "Screening")}{tab("screeningadv", "Screening avancé")}{tab("alertes", "File d'alertes")}{tab("dossiers", "Dossiers de risque")}{tab("review", "Account Review")}{tab("ubo", "Personnes / UBO")}{tab("coc", "Chgt circonstances")}{tab("transactions", "Transferts & ordres")}{tab("txrisk", "Transactions Risk Monitoring")}{tab("fx", "Multi-devise & FX")}{tab("swiftlab", "Analyseur SWIFT/SEPA")}{tab("custodyta", "Custody & TA")}{tab("settlement", "Settlement")}{tab("mros", "Reporting MROS")}{tab("ged", "Pièces (GED)")}{tab("gedcoffre", "GED / coffre")}{tab("registrelba", "Registre LBA")}{tab("crm", "CRM Banque")}{tab("contactreports", "Contact Reports")}{tab("workflow", "Workflow")}{tab("builder", "Workflow Builder")}{tab("corroboration", "Corroboration KYC")}{tab("parametrage", "Paramétrage")}{tab("golive", "Config & Go-live")}{tab("pms", "PMS")}{tab("amlref", "Référentiel AML")}{tab("sbaml", "Bac à sable AML")}{tab("sbonb", "Bac à sable Onboarding")}{tab("ports", "Ports")}{tab("integrations", "Intégrations")}{tab("nba", "Prochaines actions")}{tab("wfi", "Workflow Instances")}{tab("tasks", "Tâches")}{tab("formations", "Formations")}{tab("veille", "Veille réglementaire")}{tab("legalreg", "Legal — Contrats")}{tab("bi", "BI — Reporting sur mesure")}{tab("mobileadmin", "Mobile Banking")}{tab("oprisk", "Octopulse OpRisk")}{tab("trips", "Business Trip")}{tab("crossborder", "Cross-Border")}{tab("rejeu", "Rejeu KYC à date")}{tab("aml", "Règles AML")}{tab("islamic", "Finance Islamique")}{tab("cpsiProfil", "CPSI · Profil")}{tab("cpsiSeg", "CPSI · Segmentation")}{tab("cpsiCases", "CPSI · Risk cases")}{tab("cpsiParam", "CPSI · Barèmes")}{tab("cpsiGuide", "CPSI · Guide")}{tab("offboarding", "Offboarding")}{tab("olivia", "Olivia")}{tab("oliviaruns", "Olivia · Runs")}{tab("amlws", "AML Investigation")}{tab("sdkyc", "Sections & droits")}{tab("sdar", "Profils AR")}{tab("sdgar", "Profils GAR")}{tab("paramfields", "Registre paramètres")}{tab("cocparam", "Types de CoC")}{tab("sandboxes", "Bacs à sable")}{tab("audit", "Audit & transport")}{tab("auditit", "Audit IT")}{tab("paramnav", "Utilisateurs & rôles")}{tab("iamguide", "Guide IAM")}{tab("ssoparam", "SSO / Fédération")}
    </div>
    <Suspense fallback={<div style={{ padding: 24, color: "#888" }}>{t("Chargement de l'écran…")}</div>}>
    {screen === "home" && <Home/>}
    {screen === "dashboard" && <Dashboard/>}
    {screen === "clients" && <ClientsList/>}
    {screen === "onboarding" && <Onboarding/>}
    {screen === "kyc" && <div>
      <KycCreate onCreated={setKycCode}/>
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
    {screen === "crm" && <CrmBanque/>}
    {screen === "contactreports" && <ContactReports/>}
    {screen === "workflow" && <WorkflowDesigner/>}
    {screen === "corroboration" && <CorroborationKyc/>}
    {screen === "parametrage" && <ParametrageRegistre/>}
    {screen === "golive" && <ConfigGolive/>}
    {screen === "pms" && <PmsMandats/>}
    {screen === "amlref" && <ReferentielAml/>}
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
    {screen === "iamguide" && <IamGuide/>}
    {screen === "ssoparam" && <SsoParam/>}
    {screen === "paramfields" && <ParamFields/>}
    {screen === "cocparam" && <CocParam/>}
    {screen === "sandboxes" && <Sandboxes/>}
    </Suspense>
  </div>;
}
