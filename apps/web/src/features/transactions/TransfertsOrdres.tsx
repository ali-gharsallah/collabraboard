import React, { useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner, DEMO_MESSAGE } from "../../components/DemoModeBanner";
import { BanniereCloture } from "../../components/BanniereCloture"; // R267/OF-10 — écran comptes/ordres
import { useConfirmGate } from "../../components/ConfirmValidation"; // contrat UX

// Écran « Transferts & ordres » (Vague 4). Toute transaction passe par le portail
// (POST /v1/transactions/evaluer) : verdict PASSE|BLOQUE|SUSPEND tracé garde par garde (R140).
// La file de revue (GET /v1/transactions/revue) est habilitée (R143) ; la décision est motivée
// (POST /:id/decider, R7) ; le statut client (GET /:id/statut-client) ne porte JAMAIS de motif
// AML (art. 10a, R132). Aucune règle côté écran : le service porte les invariants.

type Verdict = { id: string; txRef: string; verdict: string; montantChf: number };
const apiBase = (): string | undefined => (window as unknown as { OLIVE_API_URL?: string }).OLIVE_API_URL;
const auth = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("olive_jwt")}` });

export function TransfertsOrdres() {
  const [clientId, setClientId] = useState("");
  const [txRef, setTxRef] = useState("TX-001");
  const [type, setType] = useState("VIREMENT");
  const [montant, setMontant] = useState("100000");
  const [file, setFile] = useState<Verdict[]>([]);
  const [msg, setMsg] = useState("");
  const { ask, modal } = useConfirmGate();               // contrat UX : confirmation + pré-vol

  async function evaluer() {
    setMsg("");
    const base = apiBase();
    if (!base) { setMsg(DEMO_MESSAGE); return; }
    const r = await fetch(`${base}/v1/transactions/evaluer`, { method: "POST", headers: auth(),
      body: JSON.stringify({ clientId, txRef, type, montantChf: Number(montant) }) });
    const b = await r.json().catch(() => ({}));
    setMsg(r.ok ? `Verdict ${b.verdict}${b.motif ? " — " + b.motif : ""}` : (b.message ?? "Erreur"));
    charger();
  }
  async function charger() {
    const d = await apiGetSourced<Verdict[]>("/v1/transactions/revue", []);
    setFile(d.data);
  }
  async function decider(id: string, decision: string, motif: string) {
    setMsg("");
    const base = apiBase();
    if (!base) { setMsg(DEMO_MESSAGE); return; }
    const r = await fetch(`${base}/v1/transactions/${id}/decider`, { method: "POST", headers: auth(),
      body: JSON.stringify({ decision, motif }) });
    const b = await r.json().catch(() => ({}));
    setMsg(r.ok ? `Transaction ${decision === "LIBERER" ? "libérée" : "bloquée"}.` : (b.message ?? "Erreur (motif requis ? R7)"));
    if (r.ok) charger();
  }

  const inp = { padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
  const btn = { ...inp, cursor: "pointer", background: "#4A6B28", color: "#fff", border: "none" };
  const vColor = (v: string) => v === "SUSPEND" ? "#c93" : v === "BLOQUE" ? "#c33" : "#3a7";
  return <div>
    {modal}
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Transferts & ordres — portail transactionnel (R140→R143)</h3>
    <BanniereCloture clientId={clientId.trim() || null}/>
    <div style={{ display: "flex", gap: 8, margin: "10px 0", flexWrap: "wrap" }}>
      <input style={inp} placeholder="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)}/>
      <input style={{ ...inp, width: 100 }} placeholder="txRef" value={txRef} onChange={(e) => setTxRef(e.target.value)}/>
      <select style={inp} value={type} onChange={(e) => setType(e.target.value)}>
        {["VIREMENT", "CONVERSION_CRYPTO", "RETRAIT", "ORDRE_BOURSE"].map((t) => <option key={t}>{t}</option>)}
      </select>
      <input style={{ ...inp, width: 120 }} placeholder="montant CHF" value={montant} onChange={(e) => setMontant(e.target.value)}/>
      <button style={btn} onClick={evaluer} disabled={!clientId}>Évaluer</button>
      <button style={{ ...btn, background: "#777" }} onClick={charger}>File de revue</button>
    </div>
    {msg && <div style={{ margin: "8px 0", padding: 8, borderRadius: 6, background: "#f3f0e8", fontSize: 13 }}>{msg}</div>}
    <h4>File de revue (SUSPEND) — habilitée (R143) — {file.length}</h4>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead><tr style={{ textAlign: "left", borderBottom: "2px solid #4A6B28" }}>
        <th style={{ padding: 6 }}>Réf</th><th>Montant</th><th>Verdict</th><th/></tr></thead>
      <tbody>
        {file.map((v) => <tr key={v.id} style={{ borderBottom: "1px solid #eee" }}>
          <td style={{ padding: 6 }}>{v.txRef}</td><td>{v.montantChf?.toLocaleString()} CHF</td>
          <td style={{ color: vColor(v.verdict), fontWeight: 700 }}>{v.verdict}</td>
          <td><button style={{ ...btn, background: "#3a7" }} onClick={() => ask({ title: "Libérer la transaction (R143/R7)",
              message: `Réf ${v.txRef} · ${v.montantChf?.toLocaleString()} CHF · verdict ${v.verdict}.`,
              input: { label: "Motif de décision", placeholder: "obligatoire (R7)", required: true }, confirmLabel: "Libérer",
              onConfirm: (motif) => decider(v.id, "LIBERER", motif ?? "") })}>Libérer</button>{" "}
            <button style={{ ...btn, background: "#c33" }} onClick={() => ask({ title: "Bloquer la transaction (R143/R7)", danger: true,
              message: `Réf ${v.txRef} · ${v.montantChf?.toLocaleString()} CHF · verdict ${v.verdict}.`,
              input: { label: "Motif de décision", placeholder: "obligatoire (R7)", required: true }, confirmLabel: "Bloquer",
              onConfirm: (motif) => decider(v.id, "BLOQUER", motif ?? "") })}>Bloquer</button></td>
        </tr>)}
        {file.length === 0 && <tr><td colSpan={4} style={{ padding: 6, color: "#666" }}>File vide.</td></tr>}
      </tbody>
    </table>
  </div>;
}
