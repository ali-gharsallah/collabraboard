import React, { useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner, DEMO_MESSAGE } from "../../components/DemoModeBanner";
import { useConfirmGate } from "../../components/ConfirmValidation";  // contrat UX

// Écran « Reporting réglementaire (MROS) » (Vague 4). Le registre des communications
// (GET /v1/mros) est habilité (art. 10a, R132). La relecture (GET /v1/mros/:id) est OPPOSABLE :
// elle rend l'empreinte de dossier à l'identique (R130). La notification et le gel (POST
// /v1/mros/:id/notification · /gel · /gel/lever) sont motivés (R7). Le dossier est FIGÉ : jamais
// re-décidé (R130). Aucune règle côté écran : le service porte les invariants.

type Comm = { id: string; riskCaseId: string; decision: string; notification?: string; gelActif?: boolean; dossierSha256: string; decideAt: string };
type Relu = { decision: string; motif: string; dossierSha256: string } | null;
const apiBase = (): string | undefined => (window as unknown as { OLIVE_API_URL?: string }).OLIVE_API_URL;
const auth = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("olive_jwt")}` });

export function ReportingMros() {
  const [comms, setComms] = useState<Comm[]>([]);
  const [detail, setDetail] = useState<Relu>(null);
  const [msg, setMsg] = useState("");
  const { ask, modal } = useConfirmGate();               // contrat UX : confirmation + pré-vol

  async function charger() { setComms((await apiGetSourced<Comm[]>("/v1/mros", [])).data); }
  async function relire(id: string) {
    const d = await apiGetSourced<Relu>(`/v1/mros/${id}`, null);
    setDetail(d.data);
    setMsg(d.data ? `Relecture opposable — empreinte ${String(d.data.dossierSha256 ?? "").slice(0, 16)}…` : "");
  }
  async function poserGel(id: string, motif: string) {
    setMsg("");
    const base = apiBase();
    if (!base) { setMsg(DEMO_MESSAGE); return; }
    const r = await fetch(`${base}/v1/mros/${id}/gel`, { method: "POST", headers: auth(), body: JSON.stringify({ motif }) });
    const b = await r.json().catch(() => ({}));
    setMsg(r.ok ? "Gel posé (art. 10 LBA)." : (b.message ?? "Erreur (motif requis ? R7)"));
    if (r.ok) charger();
  }
  async function notifier(id: string, notification: string) {
    const base = apiBase();
    if (!base) { setMsg(DEMO_MESSAGE); return; }
    const r = await fetch(`${base}/v1/mros/${id}/notification`, { method: "POST", headers: auth(), body: JSON.stringify({ notification }) });
    setMsg(r.ok ? `Notification saisie : ${notification}.` : "Erreur");
    if (r.ok) charger();
  }

  const inp = { padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
  const btn = { ...inp, cursor: "pointer", background: "#4A6B28", color: "#fff", border: "none" };
  return <div>
    {modal}
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Reporting réglementaire (MROS) — registre opposable & figé (R129→R132)</h3>
    <button style={btn} onClick={charger}>Charger le registre</button>
    {msg && <div style={{ margin: "8px 0", padding: 8, borderRadius: 6, background: "#f3f0e8", fontSize: 13 }}>{msg}</div>}
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 10 }}>
      <thead><tr style={{ textAlign: "left", borderBottom: "2px solid #4A6B28" }}>
        <th style={{ padding: 6 }}>Décision</th><th>Notification</th><th>Gel</th><th>Empreinte</th><th>Quand</th><th/></tr></thead>
      <tbody>
        {comms.map((c) => <tr key={c.id} style={{ borderBottom: "1px solid #eee" }}>
          <td style={{ padding: 6, fontWeight: 600 }}>{c.decision}</td>
          <td>{c.notification ?? "—"}</td><td align="center">{c.gelActif ? "🔒" : "—"}</td>
          <td style={{ fontFamily: "monospace", fontSize: 11 }}>{c.dossierSha256?.slice(0, 12)}…</td>
          <td>{c.decideAt ? new Date(c.decideAt).toLocaleDateString() : "—"}</td>
          <td><button style={{ ...btn, background: "#777" }} onClick={() => relire(c.id)}>Relire</button>{" "}
            <button style={btn} onClick={() => ask({ title: "Notifier — transmission à l'autorité",
              message: "Acte opposable et tracé (art. 10a). Le dossier reste figé (R130).", confirmLabel: "Transmettre",
              onConfirm: () => notifier(c.id, "TRANSMISSION_AUTORITE") })}>Transmis</button>{" "}
            <button style={{ ...btn, background: "#c33" }} onClick={() => ask({ title: "Poser un gel (art. 10 LBA)", danger: true,
              message: "Le gel est motivé (R7) et opposable.", input: { label: "Motif du gel", placeholder: "obligatoire", required: true },
              confirmLabel: "Geler", onConfirm: (motif) => poserGel(c.id, motif ?? "") })}>Geler</button></td>
        </tr>)}
        {comms.length === 0 && <tr><td colSpan={6} style={{ padding: 6, color: "#666" }}>Registre vide (rôle habilité requis — art. 10a).</td></tr>}
      </tbody>
    </table>
    {detail && <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: "#f3f0e8", fontSize: 13 }}>
      <strong>Relecture opposable</strong> — décision {detail.decision}, motif « {detail.motif} »,
      empreinte <span style={{ fontFamily: "monospace" }}>{detail.dossierSha256}</span> (identique au dépôt, R130).
    </div>}
  </div>;
}
