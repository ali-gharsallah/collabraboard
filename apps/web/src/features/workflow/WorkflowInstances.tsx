import React, { useState } from "react";
import { useApiOrSeed } from "../../lib/useApiOrSeed";
import { apiGetSourced } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { VisaBadge, Visa } from "../../components/VisaBadge";
import { tokens } from "../../theme/tokens";

// Écran « Workflow Instances » (SPEC-FRONT-CÂBLAGE v2, FE-WFI · A3.2). Câblé au backend en LECTURE SEULE :
// GET /v1/workflow-instances (liste, filtres), /:id[?asOf=] (détail : steps + visas R15 + subjectRef +
// currentStep ; rejeu à date R48), /:id/events[?asOf=] (timeline append-only : acteur + horodatage + type,
// FE-20). Reconnaissance A3 = CAS A. Aucun endpoint d'écriture : l'avancement passe par le moteur (intouchable).

type Instance = { id: string; code: string; type: string; subjectRef: string; status: string; currentStep: string; visas: string; revision: number };
type Detail = { id: string; code: string; type: string; subjectRef: string; status: string; currentStep: string; revision?: number;
  existeADate?: boolean; lectureSeule?: boolean; asOf?: string; steps: { code: string; label: string; ordre: number }[]; visas: Visa[] };
type Event = { type: string; at: string; acteur: string | null };

export function WorkflowInstances() {
  const { data: instances, isDemo, reload } = useApiOrSeed<Instance[]>("/v1/workflow-instances", []);
  const [sel, setSel] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [asOf, setAsOf] = useState("");

  async function ouvrir(id: string, at?: string) {
    setSel(id); setDetail(null); setEvents([]);
    const q = at ? `?asOf=${at}` : "";
    setDetail((await apiGetSourced<Detail | null>(`/v1/workflow-instances/${id}${q}`, null)).data);
    setEvents((await apiGetSourced<Event[]>(`/v1/workflow-instances/${id}/events${q}`, [])).data);
  }

  const statutColor = (s: string) => s === "VALIDATED" || s === "VALIDE" ? tokens.color.ok : s === "REJECTED" ? tokens.color.danger : tokens.color.warn;
  const th = { padding: 6, textAlign: "left" as const };
  return <div>
    {isDemo && <DemoModeBanner/>}
    <h3>Workflow Instances</h3>
    <p style={{ fontSize: tokens.font.sm, color: tokens.color.muted }}>Instances du workflow gouverné ratifié (dossiers KYC) :
      étapes, visas (R15), timeline append-only avec acteur. Lecture seule — l'avancement suit les événements métier
      (aucun forçage d'étape). Le rejeu à date (asOf) reconstruit l'état d'alors (R48).</p>
    <button onClick={reload} style={{ padding: 8, borderRadius: tokens.radius.md, border: "none", background: tokens.color.olive700, color: "#fff", cursor: "pointer", fontSize: tokens.font.sm }}>Rafraîchir</button>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: tokens.font.sm, marginTop: 12 }}>
      <thead><tr style={{ borderBottom: `2px solid ${tokens.color.olive700}` }}>
        <th style={th}>Code</th><th style={th}>Type</th><th style={th}>Étape</th><th style={th}>Statut</th><th style={th}>Visas</th></tr></thead>
      <tbody>
        {instances.map((i) => <tr key={i.id} onClick={() => ouvrir(i.id)}
          style={{ borderBottom: `1px solid ${tokens.color.border}`, cursor: "pointer", background: sel === i.id ? "#f2f5ec" : undefined }}>
          <td style={{ padding: 6, fontFamily: "monospace" }}>{i.code}</td>
          <td style={{ fontSize: 11 }}>{i.type}</td><td>{i.currentStep}</td>
          <td><span style={{ color: statutColor(i.status), fontWeight: 700 }}>{i.status}</span></td>
          <td>{i.visas}</td>
        </tr>)}
        {!instances.length && <tr><td colSpan={5} style={{ padding: 6, color: tokens.color.muted }}>Aucune instance.</td></tr>}
      </tbody>
    </table>

    {sel && detail && <div style={{ marginTop: 16, padding: 14, borderRadius: tokens.radius.lg, border: `1px solid ${tokens.color.border}` }}>
      <h4 style={{ margin: "0 0 4px" }}>{detail.code} <span style={{ fontSize: 12, color: tokens.color.muted }}>· {detail.type} · sujet {detail.subjectRef} · {detail.status}</span></h4>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, fontSize: 12 }}>
        <label style={{ color: tokens.color.muted }}>Vue au</label>
        <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} style={{ padding: 4, borderRadius: 6, border: "1px solid #ccc" }}/>
        <button onClick={() => ouvrir(detail.id, asOf || undefined)} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: tokens.color.olive600, color: "#fff", cursor: "pointer" }}>Rejouer</button>
        {detail.lectureSeule && <span style={{ color: tokens.color.warn }}>Vue historique — lecture seule (R48){detail.existeADate === false ? " · instance inexistante à cette date" : ""}</span>}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {detail.steps.map((s) => <span key={s.code} style={{ padding: "4px 10px", borderRadius: 16, background: "#eef4e6", fontSize: 11 }}>{s.ordre + 1}. {s.label}</span>)}
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 280px" }}>
          <h5 style={{ margin: "4px 0" }}>Visas (R15)</h5>
          {detail.visas.length ? detail.visas.map((v, i) => <VisaBadge key={i} visa={v}/>) : <div style={{ fontSize: 12, color: tokens.color.muted }}>Aucun visa.</div>}
        </div>
        <div style={{ flex: "1 1 280px" }}>
          <h5 style={{ margin: "4px 0" }}>Timeline (append-only)</h5>
          {events.map((e, i) => <div key={i} style={{ padding: 6, borderLeft: `2px solid ${tokens.color.leaf}`, marginBottom: 4, fontSize: 12 }}>
            <span style={{ fontFamily: "monospace" }}>{e.type}</span>
            <span style={{ color: tokens.color.muted }}> · {new Date(e.at).toLocaleString()}{e.acteur ? ` · par ${e.acteur}` : ""}</span></div>)}
          {!events.length && <div style={{ fontSize: 12, color: tokens.color.muted }}>Aucun événement.</div>}
        </div>
      </div>
    </div>}
  </div>;
}
