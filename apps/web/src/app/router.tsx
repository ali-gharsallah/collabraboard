import React, { useState, lazy, Suspense } from "react";

// A6 (audit-architecture) : code-splitting par écran. Chaque écran est chargé à la demande
// (`React.lazy`), plus en un seul bundle eager de 35 imports — le chunk initial fond, chaque
// écran arrive quand on l'ouvre. Comportement identique (mêmes écrans, même aiguillage) ; les
// exports sont nommés, d'où le `.then((m) => ({ default: m.X }))`. Un `<Suspense>` unique borne
// l'attente du chunk. (Inline, sans helper générique, pour rester zéro-`any` — règle du front.)
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

export function Router() {
  const [screen, setScreen] = useState<"clients" | "onboarding" | "kyc" | "aml" | "screening" | "alertes" | "dossiers" | "review" | "ubo" | "coc" | "ged" | "rejeu" | "dashboard" | "transactions" | "settlement" | "screeningadv" | "mros" | "gedcoffre" | "registrelba" | "crm" | "contactreports" | "workflow" | "corroboration" | "parametrage" | "golive" | "pms" | "amlref" | "sbaml" | "ports" | "nba" | "wfi" | "tasks" | "formations" | "trips" | "islamic">("clients");
  const [kycCode, setKycCode] = useState<string | null>(null);
  const tab = (id: typeof screen, label: string) =>
    <button onClick={() => setScreen(id)} style={{ padding: "8px 16px", border: "none",
      borderRadius: 8, cursor: "pointer", fontWeight: screen === id ? 700 : 400,
      background: screen === id ? "#4A6B28" : "#eee", color: screen === id ? "#fff" : "#333" }}>
      {label}</button>;
  return <div style={{ fontFamily: "system-ui", padding: 24, maxWidth: 1100, margin: "0 auto" }}>
    <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
      {tab("dashboard", "Dashboard")}{tab("clients", "Clients")}{tab("onboarding", "Onboarding")}{tab("kyc", "KYC")}{tab("screening", "Screening")}{tab("screeningadv", "Screening avancé")}{tab("alertes", "File d'alertes")}{tab("dossiers", "Dossiers de risque")}{tab("review", "Account Review")}{tab("ubo", "Personnes / UBO")}{tab("coc", "Chgt circonstances")}{tab("transactions", "Transferts & ordres")}{tab("settlement", "Settlement")}{tab("mros", "Reporting MROS")}{tab("ged", "Pièces (GED)")}{tab("gedcoffre", "GED / coffre")}{tab("registrelba", "Registre LBA")}{tab("crm", "CRM Banque")}{tab("contactreports", "Contact Reports")}{tab("workflow", "Workflow")}{tab("corroboration", "Corroboration")}{tab("parametrage", "Paramétrage")}{tab("golive", "Config & Go-live")}{tab("pms", "PMS")}{tab("amlref", "Référentiel AML")}{tab("sbaml", "Bac à sable AML")}{tab("ports", "Ports")}{tab("nba", "Next Best Action")}{tab("wfi", "Workflow Instances")}{tab("tasks", "Tâches")}{tab("formations", "Formations")}{tab("trips", "Business Trip")}{tab("rejeu", "Rejeu KYC à date")}{tab("aml", "Règles AML")}{tab("islamic", "Finance Islamique")}
    </div>
    <Suspense fallback={<div style={{ padding: 24, color: "#888" }}>Chargement de l'écran…</div>}>
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
    </Suspense>
  </div>;
}
