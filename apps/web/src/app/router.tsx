import React, { useState } from "react";
import { ClientsList } from "../features/clients/ClientsList";
import { KycCreate } from "../features/kyc/KycCreate";
import { KycDetail } from "../features/kyc/KycDetail";
import { RejeuKyc } from "../features/kyc/RejeuKyc";
import { AmlParametres } from "../features/aml/AmlParametres";
import { AlertsQueue } from "../features/alertes/AlertsQueue";
import { DossiersRisque } from "../features/dossiers/DossiersRisque";
import { GedPieces } from "../features/ged/GedPieces";
import { Onboarding } from "../features/onboarding/Onboarding";
import { AccountReview } from "../features/review/AccountReview";
import { Screening } from "../features/screening/Screening";
import { PersonnesLiees } from "../features/personnes/PersonnesLiees";
import { ChangementCirconstances } from "../features/coc/ChangementCirconstances";
import { Dashboard } from "../features/dashboard/Dashboard";
import { TransfertsOrdres } from "../features/transactions/TransfertsOrdres";
import { Settlement } from "../features/settlement/Settlement";
import { ScreeningAvance } from "../features/screening/ScreeningAvance";
import { ReportingMros } from "../features/mros/ReportingMros";
import { GedCoffre } from "../features/gedcoffre/GedCoffre";
import { RegistreLBA } from "../features/registrelba/RegistreLBA";
import { CrmBanque } from "../features/crm/CrmBanque";
import { ContactReports } from "../features/crm/ContactReports";
import { WorkflowDesigner } from "../features/workflow/WorkflowDesigner";
import { CorroborationKyc } from "../features/corroboration/CorroborationKyc";
import { ParametrageRegistre } from "../features/parametrage/ParametrageRegistre";
import { ConfigGolive } from "../features/parametrage/ConfigGolive";
import { PmsMandats } from "../features/pms/PmsMandats";
import { ReferentielAml } from "../features/aml/ReferentielAml";
import { SandboxAml } from "../features/aml/SandboxAml";
import { Ports } from "../features/ports/Ports";
import { NextBestAction } from "../features/nba/NextBestAction";
import { WorkflowInstances } from "../features/workflow/WorkflowInstances";
import { Tasks } from "../features/tasks/Tasks";
import { Formations } from "../features/formations/Formations";
import { BusinessTrip } from "../features/businesstrip/BusinessTrip";
import { FinanceIslamique } from "../features/islamic/FinanceIslamique";
import { CpsiProfiling } from "../features/cpsi/CpsiProfiling";
import { CpsiSegmentation } from "../features/cpsi/CpsiSegmentation";
import { CpsiRiskCases } from "../features/cpsi/CpsiRiskCases";

export function Router() {
  const [screen, setScreen] = useState<"clients" | "onboarding" | "kyc" | "aml" | "screening" | "alertes" | "dossiers" | "review" | "ubo" | "coc" | "ged" | "rejeu" | "dashboard" | "transactions" | "settlement" | "screeningadv" | "mros" | "gedcoffre" | "registrelba" | "crm" | "contactreports" | "workflow" | "corroboration" | "parametrage" | "golive" | "pms" | "amlref" | "sbaml" | "ports" | "nba" | "wfi" | "tasks" | "formations" | "trips" | "islamic" | "cpsiProfil" | "cpsiSeg" | "cpsiCases">("clients");
  const [kycCode, setKycCode] = useState<string | null>(null);
  const tab = (id: typeof screen, label: string) =>
    <button onClick={() => setScreen(id)} style={{ padding: "8px 16px", border: "none",
      borderRadius: 8, cursor: "pointer", fontWeight: screen === id ? 700 : 400,
      background: screen === id ? "#4A6B28" : "#eee", color: screen === id ? "#fff" : "#333" }}>
      {label}</button>;
  return <div style={{ fontFamily: "system-ui", padding: 24, maxWidth: 1100, margin: "0 auto" }}>
    <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
      {tab("dashboard", "Dashboard")}{tab("clients", "Clients")}{tab("onboarding", "Onboarding")}{tab("kyc", "KYC")}{tab("screening", "Screening")}{tab("screeningadv", "Screening avancé")}{tab("alertes", "File d'alertes")}{tab("dossiers", "Dossiers de risque")}{tab("review", "Account Review")}{tab("ubo", "Personnes / UBO")}{tab("coc", "Chgt circonstances")}{tab("transactions", "Transferts & ordres")}{tab("settlement", "Settlement")}{tab("mros", "Reporting MROS")}{tab("ged", "Pièces (GED)")}{tab("gedcoffre", "GED / coffre")}{tab("registrelba", "Registre LBA")}{tab("crm", "CRM Banque")}{tab("contactreports", "Contact Reports")}{tab("workflow", "Workflow")}{tab("corroboration", "Corroboration")}{tab("parametrage", "Paramétrage")}{tab("golive", "Config & Go-live")}{tab("pms", "PMS")}{tab("amlref", "Référentiel AML")}{tab("sbaml", "Bac à sable AML")}{tab("ports", "Ports")}{tab("nba", "Next Best Action")}{tab("wfi", "Workflow Instances")}{tab("tasks", "Tâches")}{tab("formations", "Formations")}{tab("trips", "Business Trip")}{tab("rejeu", "Rejeu KYC à date")}{tab("aml", "Règles AML")}{tab("islamic", "Finance Islamique")}{tab("cpsiProfil", "CPSI · Profil")}{tab("cpsiSeg", "CPSI · Segmentation")}{tab("cpsiCases", "CPSI · Risk cases")}
    </div>
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
  </div>;
}
