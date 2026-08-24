import React, { useEffect, useState } from "react";
import { apiGetSourced } from "../../lib/api";
import { DemoModeBanner, DEMO_MESSAGE } from "../../components/DemoModeBanner";
import { useConfirmGate } from "../../components/ConfirmValidation";  // contrat UX

export function KycCreate({ onCreated }: { onCreated: (code: string) => void }) {
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [form, setForm] = useState({ clientId: "", legalStructure: "SA",
    accountType: "ADVISORY", countryCode: "CH", rmId: "00000000-0000-0000-0000-000000000001" });
  const [risk, setRisk] = useState<any>(null);
  const [err, setErr] = useState("");
  const [demo, setDemo] = useState(false);
  const { ask, modal } = useConfirmGate();               // contrat UX : confirmer la création du dossier
  useEffect(() => { apiGetSourced<{ data: any[] }>("/v1/clients", { data: [] })
    .then(r => { setClients(r.data.data); setDemo(r.isDemo); }); }, []);

  async function submit() {
    setErr("");
    const base = (window as any).OLIVE_API_URL;
    if (!base) { setErr(DEMO_MESSAGE); return; }
    const r = await fetch(`${base}/v1/kyc`, { method: "POST",
      headers: { "Content-Type": "application/json",
        Authorization: `Bearer ${sessionStorage.getItem("olive_jwt")}`,
        "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify(form) });
    const body = await r.json();
    if (!r.ok) { setErr(body.message ?? "Erreur"); return; }
    setRisk({ code: body.code, workflow: body.workflow, score: body.riskScore, trace: body.riskTrace });
    onCreated(body.code);
  }
  const inp = { padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
  return <div>
    {modal}
    {demo && <DemoModeBanner/>}
    <h3>Nouveau dossier KYC — 4 informations, le moteur décide du reste</h3>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <select style={inp} value={form.clientId} onChange={e => setForm({ ...form, clientId: e.target.value })}>
        <option value="">— Client —</option>
        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select style={inp} value={form.legalStructure} onChange={e => setForm({ ...form, legalStructure: e.target.value })}>
        {["PP","SA","SARL","HOLDING","DOMICILE","TRUST","FOUNDATION","FUND"].map(x => <option key={x}>{x}</option>)}
      </select>
      <select style={inp} value={form.accountType} onChange={e => setForm({ ...form, accountType: e.target.value })}>
        {["CURRENT","ADVISORY","DISCRETIONARY","LOMBARD"].map(x => <option key={x}>{x}</option>)}
      </select>
      <input style={{ ...inp, width: 60 }} maxLength={2} value={form.countryCode}
        onChange={e => setForm({ ...form, countryCode: e.target.value.toUpperCase() })}/>
      <button onClick={() => ask({ title: "Créer le dossier KYC",
          message: "À la création, le moteur calcule le workflow et le score de risque. La décision est engagée.",
          confirmLabel: "Confirmer la création", onConfirm: submit })}
        disabled={!form.clientId}
        style={{ ...inp, background: "#4A6B28", color: "#fff", cursor: "pointer", border: "none" }}>
        Créer le dossier</button>
    </div>
    {err && <p style={{ color: "#B5483C" }}>{err}</p>}
    {risk && <div style={{ marginTop: 12, padding: 12, background: "#F4F1E8", borderRadius: 10 }}>
      <strong>{risk.code}</strong> — workflow {risk.workflow}, score {risk.score}
      <ul>{risk.trace.map((t: any, i: number) =>
        <li key={i}>{t.rule} : +{t.points} ({t.detail})</li>)}</ul>
    </div>}
  </div>;
}
