import React, { useEffect, useState } from "react";
import { apiGetSourced } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { BanniereCloture } from "../../components/BanniereCloture"; // R267/OF-10 — écran client
import { OliveBranch, Stage } from "../../components/OliveBranch";
import { P } from "../../theme/palette";
import seed from "../../seed/clients.json";

type Row = { id: string; name: string; structure: string; country: string; riskLevel: string };

const RISK = (r: string): [string, string] =>
  r === "HIGH" ? [P.red, P.redSoft] : r === "LOW" ? [P.green, P.greenSoft] : [P.amber, P.amberSoft];

// Cycle de vie affiché = le MODÈLE (Prospection→…→Review) ; le SEUL état dérivé d'une donnée
// réelle est le screening (rouge si le client est classé HIGH). Le reste = « client au master =
// relation active », vrai par construction — aucun statut KYC fabriqué (canon : rien d'inventé).
function lifecycle(c: Row): Stage[] {
  return [
    { id: 1, label: "Prospection", state: "done" },
    { id: 2, label: "Onboarding", state: "done" },
    { id: 3, label: "KYC", state: "done" },
    { id: 4, label: "Screening", state: c.riskLevel === "HIGH" ? "alert" : "done" },
    { id: 5, label: "Relation active", state: "current" },
    { id: 6, label: "Review", state: "pending" },
  ];
}

export function ClientsList() {
  const [rows, setRows] = useState<Row[]>([]);
  const [demo, setDemo] = useState(false);
  const [selection, setSelection] = useState<string | null>(null);   // client sélectionné → bannière R267
  useEffect(() => { apiGetSourced<{ data: Row[] }>("/v1/clients", { data: seed as Row[] })
    .then(r => { setRows(r.data.data); setDemo(r.isDemo); }); }, []);
  return <div>
    {demo && <DemoModeBanner/>}
    <h2>Clients — {rows.length}</h2>
    <BanniereCloture clientId={selection}/>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 16, marginTop: 8 }}>
      {rows.map(c => {
        const [rc, rbg] = RISK(c.riskLevel); const sel = selection === c.id;
        const initiales = c.name.split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
        return <div key={c.id} onClick={() => setSelection(c.id)} className="olv-card" style={{
          cursor: "pointer", padding: 0, overflow: "hidden",
          border: `1px solid ${sel ? P.olive500 : P.line}`, boxShadow: sel ? `0 0 0 3px ${P.oliveSoft}` : "0 1px 2px rgba(26,36,16,0.04)" }}>
          {/* carte de visite : avatar + identité + risque */}
          <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "16px 18px 10px" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, fontWeight: 800, fontSize: 15, color: "#fff",
              background: `linear-gradient(135deg,${P.olive700},${P.leaf})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{initiales}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: P.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: P.inkMid, background: P.lineSoft, borderRadius: 6, padding: "2px 8px" }}>{c.structure}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: P.inkMid, background: P.lineSoft, borderRadius: 6, padding: "2px 8px" }}>{c.country}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: rc, background: rbg, borderRadius: 6, padding: "2px 8px" }}>{c.riskLevel}</span>
              </div>
            </div>
          </div>
          {/* branche d'olivier = cycle de vie du client */}
          <div style={{ borderTop: `1px solid ${P.lineSoft}`, background: P.cream, padding: "6px 8px 2px" }}>
            <OliveBranch stages={lifecycle(c)} compact/>
          </div>
        </div>;
      })}
    </div>
  </div>;
}
