import React, { useState } from "react";
import { ClientsList } from "../features/clients/ClientsList";
import { KycCreate } from "../features/kyc/KycCreate";
import { KycDetail } from "../features/kyc/KycDetail";
import { AmlParametres } from "../features/aml/AmlParametres";

export function Router() {
  const [screen, setScreen] = useState<"clients" | "kyc" | "aml">("clients");
  const [kycCode, setKycCode] = useState<string | null>(null);
  const tab = (id: typeof screen, label: string) =>
    <button onClick={() => setScreen(id)} style={{ padding: "8px 16px", border: "none",
      borderRadius: 8, cursor: "pointer", fontWeight: screen === id ? 700 : 400,
      background: screen === id ? "#4A6B28" : "#eee", color: screen === id ? "#fff" : "#333" }}>
      {label}</button>;
  return <div style={{ fontFamily: "system-ui", padding: 24, maxWidth: 1100, margin: "0 auto" }}>
    <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
      {tab("clients", "Clients")}{tab("kyc", "KYC")}{tab("aml", "Paramétrages AML")}
    </div>
    {screen === "clients" && <ClientsList/>}
    {screen === "kyc" && <div>
      <KycCreate onCreated={setKycCode}/>
      {kycCode && <div style={{ marginTop: 20 }}><KycDetail code={kycCode}/></div>}
    </div>}
    {screen === "aml" && <AmlParametres/>}
  </div>;
}
