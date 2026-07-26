import React, { useState } from "react";
import { useApiOrSeed } from "../../lib/useApiOrSeed";
import { apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";

// Écran « Ports » (SPEC-FRONT-CÂBLAGE v2, FE-PORT) — « pas de secret = refus gracieux ». Liste les
// ports RÉELLEMENT ratifiés (GET /v1/ports) : core banking (R167), IA (R163), coffre (R180). Le
// statut vient du backend (présence de la config tenant), JAMAIS d'un secret : le navigateur n'en
// voit que l'état, n'émet aucune requête externe, n'affiche aucun formulaire de secret.
// Écart signalé (ECARTS-FRONT) : fx/custody/mobile non ratifiés → non listés.

type Port = { portId: string; label: string; status: "CONFIGURED" | "NOT_CONFIGURED" | "DEGRADED"; regle: string; lastCheckAt: string };

const SEED: Port[] = [
  { portId: "core-banking", label: "Core banking (Avaloq / Temenos / Olympic-ERI)", status: "NOT_CONFIGURED", regle: "R167", lastCheckAt: "" },
  { portId: "ia", label: "Prestataire IA", status: "NOT_CONFIGURED", regle: "R163", lastCheckAt: "" },
  { portId: "storage", label: "Coffre / stockage documentaire", status: "NOT_CONFIGURED", regle: "R180", lastCheckAt: "" },
];

function PortPanel({ port, onRetest }: { port: Port; onRetest: (id: string) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const couleur = port.status === "CONFIGURED" ? "#4A6B28" : port.status === "DEGRADED" ? "#C9A227" : "#999";
  const retester = async () => { setBusy(true); try { await onRetest(port.portId); } finally { setBusy(false); } };
  return <div style={{ padding: 14, borderRadius: 10, background: "#FAFBF7", borderLeft: `5px solid ${couleur}`, marginBottom: 10 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <strong>{port.label}</strong> <span style={{ fontSize: 11, color: "#888" }}>({port.regle})</span>
        <div style={{ fontSize: 12, color: couleur, fontWeight: 700, marginTop: 2 }}>{port.status}</div>
      </div>
      <button disabled={busy || isDemoMode()} onClick={retester}
        style={{ padding: "6px 12px", borderRadius: 8, border: "none", cursor: busy ? "default" : "pointer",
          background: busy || isDemoMode() ? "#ccc" : "#5A7D3A", color: "#fff", fontSize: 12 }}>Re-tester</button>
    </div>
    {port.status === "CONFIGURED" && port.lastCheckAt &&
      <div style={{ fontSize: 11, color: "#666", marginTop: 6 }}>Dernier contrôle : {new Date(port.lastCheckAt).toLocaleString()}</div>}
    {port.status === "NOT_CONFIGURED" &&
      <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>Port non configuré — renseigner la référence côté tenant (registre R-Q).
        <span style={{ color: "#999" }}> Aucun secret n'est saisi ni transmis depuis le navigateur.</span></div>}
    {port.status === "DEGRADED" &&
      <div style={{ fontSize: 12, color: "#8a6d00", marginTop: 6 }}>Port dégradé — voir le détail du dernier échec, puis « Re-tester ».</div>}
  </div>;
}

export function Ports() {
  const { data: ports, isDemo, reload } = useApiOrSeed<Port[]>("/v1/ports", SEED);
  const [msg, setMsg] = useState("");

  async function retest(portId: string) {
    setMsg("");
    try {
      const h = await apiPost<{ status: string; detail: string }>(`/v1/ports/${portId}/health`, {});
      setMsg(`${portId} : ${h.status} — ${h.detail}`);
      reload();                                      // relit l'état (pas de mise à jour optimiste)
    } catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }
  }

  return <div>
    {isDemo && <DemoModeBanner/>}
    <h3>Ports — intégrations optionnelles (pas de secret = refus gracieux)</h3>
    <p style={{ fontSize: 12, color: "#777" }}>Ports ratifiés uniquement (core banking, IA, coffre). Le statut vient du backend ;
      le navigateur ne voit que l'état, n'émet aucune requête externe, ne saisit aucun secret. « Re-tester » relit l'état côté serveur.</p>
    {msg && <div style={{ margin: "8px 0", padding: 8, borderRadius: 6, background: "#eef4e6", fontSize: 12 }}>{msg}</div>}
    {ports.map((p) => <PortPanel key={p.portId} port={p} onRetest={retest}/>)}
    <p style={{ fontSize: 11, color: "#888", marginTop: 8 }}>Écart (ECARTS-FRONT) : les ports fx / custody / mobile ne sont pas ratifiés — non listés, jamais fabriqués.</p>
  </div>;
}
