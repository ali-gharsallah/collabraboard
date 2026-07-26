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
import { FinanceIslamique } from "../features/islamic/FinanceIslamique";

export function Router() {
  const [screen, setScreen] = useState<"clients" | "onboarding" | "kyc" | "aml" | "screening" | "alertes" | "dossiers" | "review" | "ubo" | "coc" | "ged" | "rejeu" | "dashboard" | "transactions" | "settlement" | "screeningadv" | "mros" | "gedcoffre" | "registrelba" | "islamic">("clients");
  const [kycCode, setKycCode] = useState<string | null>(null);
  const tab = (id: typeof screen, label: string) =>
    <button onClick={() => setScreen(id)} style={{ padding: "8px 16px", border: "none",
      borderRadius: 8, cursor: "pointer", fontWeight: screen === id ? 700 : 400,
      background: screen === id ? "#4A6B28" : "#eee", color: screen === id ? "#fff" : "#333" }}>
      {label}</button>;
  return <div style={{ fontFamily: "system-ui", padding: 24, maxWidth: 1100, margin: "0 auto" }}>
    <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
      {tab("dashboard", "Dashboard")}{tab("clients", "Clients")}{tab("onboarding", "Onboarding")}{tab("kyc", "KYC")}{tab("screening", "Screening")}{tab("screeningadv", "Screening avancé")}{tab("alertes", "File d'alertes")}{tab("dossiers", "Dossiers de risque")}{tab("review", "Account Review")}{tab("ubo", "Personnes / UBO")}{tab("coc", "Chgt circonstances")}{tab("transactions", "Transferts & ordres")}{tab("settlement", "Settlement")}{tab("mros", "Reporting MROS")}{tab("ged", "Pièces (GED)")}{tab("gedcoffre", "GED / coffre")}{tab("registrelba", "Registre LBA")}{tab("rejeu", "Rejeu KYC à date")}{tab("aml", "Règles AML")}{tab("islamic", "Finance Islamique")}
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
    {screen === "rejeu" && <RejeuKyc/>}
    {screen === "islamic" && <FinanceIslamique/>}
  </div>;
}
