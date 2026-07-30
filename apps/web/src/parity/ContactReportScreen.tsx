import React, { useState } from "react";
import { T } from "./tokens";
import { Badge, KpiCard, StatsToggle } from "./components";
import { clientById, kycsByClientId } from "./components-data";
import CLIENTS from "../fixtures/CLIENTS.json";
import PERSONS_DATA from "../fixtures/PERSONS_DATA.json";
import SCREEN_LABEL from "../fixtures/SCREEN_LABEL.json";
import { CONTACT_REPORTS, CONTACT_REPORT_CHANNELS, fl, similarContactReports, draftContactReport } from "./contactreports-support";

// pushParamAudit / wfEmit : piste d'audit + bus d'événements (hors périmètre front) → no-op.
const pushParamAudit = (_actor: string, _msg: string) => {};
const wfEmit = (_evt: string, _a: any, _b: any) => {};

// Source : docs/reference/olive-demo.html 21552–21672 — porté verbatim.
export function ContactReportScreen({ user }: { user?: any }) {
  const [, bump] = useState(0);
  const re = function () { bump(function (x) { return x + 1; }); };
  const [createOpen, setCreateOpen] = useState(false);
  const [ccClientId, setCcClientId] = useState("");
  const [ccPersonId, setCcPersonId] = useState("");
  const [ccChannel, setCcChannel] = useState(CONTACT_REPORT_CHANNELS[0]);
  const [ccSubject, setCcSubject] = useState("");
  const [ccNotes, setCcNotes] = useState("");
  const [ccDraft, setCcDraft] = useState("");
  const [search, setSearch] = useState("");
  const ccClient = ccClientId ? (clientById as any)[ccClientId] : null;
  const ccPersons = ccClientId ? (PERSONS_DATA as any[]).filter(function (p) { return (p.roles || []).some(function (r: any) { return r.entityId === ccClientId; }); }) : [];
  const sim = ccClient ? similarContactReports(ccClient, ccSubject) : [];
  const generateDraft = function () {
    const personName = ccPersonId ? ((PERSONS_DATA as any[]).find(function (p) { return p.id === ccPersonId; }) || {}).name : null;
    const kyc = ((kycsByClientId as any)[ccClientId] || []).slice(-1)[0];
    setCcDraft(draftContactReport(ccNotes, ccClient, kyc, personName));
  };
  const save = function () {
    if (!ccClientId || !ccNotes.trim()) return;
    const personName = ccPersonId ? ((PERSONS_DATA as any[]).find(function (p) { return p.id === ccPersonId; }) || {}).name : (ccClient && ccClient.uboName);
    const rec = { id: "CR-" + String(9000 + CONTACT_REPORTS.length), clientId: ccClientId, personId: ccPersonId || null, personName,
      channel: ccChannel, date: "2026-07-10", rm: (user && user.name) || (ccClient && ccClient.rm), subject: ccSubject || ccChannel,
      notes: ccNotes, draft: ccDraft || null };
    CONTACT_REPORTS.unshift(rec);
    pushParamAudit((user && user.name) || "RM", "Contact report créé : " + ccClient.name + " (" + ccChannel + ")");
    wfEmit("PARAM_CHANGED", null, { subjectId: "CONTACT_REPORT/" + rec.id, actor: (user && user.name) || "RM", payload: { client: ccClient.name } });
    setCreateOpen(false);
    setCcClientId(""); setCcPersonId(""); setCcSubject(""); setCcNotes(""); setCcDraft("");
    re();
  };
  const q = search.toLowerCase();
  const filtered = CONTACT_REPORTS.filter(function (r) {
    if (!q) return true;
    const c = (clientById as any)[r.clientId];
    return (c && c.name.toLowerCase().indexOf(q) >= 0) || r.subject.toLowerCase().indexOf(q) >= 0 || (r.personName || "").toLowerCase().indexOf(q) >= 0;
  });
  const inp: any = { padding: "9px 12px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 12.5, width: "100%", boxSizing: "border-box" };
  const lbl: any = { fontSize: 10, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 };
  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, color: T.olive700, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>CRM</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>{(SCREEN_LABEL as any).contactreports}</div>
          <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>Chaque contact — en business trip ou au quotidien — relié au client et à la personne effectivement rencontrée. Rédaction assistée par IA, cas similaires analysés automatiquement.</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <input value={search} onChange={function (e) { setSearch(e.target.value); }} placeholder="Rechercher…" style={{ padding: "8px 12px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 12 }} />
          <button onClick={function () { setCreateOpen(true); }} style={{ padding: "9px 16px", borderRadius: 9, border: "none", background: T.olive600, color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>＋ Nouveau contact report</button>
        </div>
      </div>
      <StatsToggle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 16 }}>
          <KpiCard label="Contact reports" value={CONTACT_REPORTS.length} sub="tous canaux" color={T.olive600} icon="📇" />
          <KpiCard label="Business Trip" value={CONTACT_REPORTS.filter(function (r) { return r.channel === "Business Trip"; }).length} sub="contacts en déplacement" color={T.gold} icon="✈" />
          <KpiCard label="Rendez-vous" value={CONTACT_REPORTS.filter(function (r) { return r.channel === "Rendez-vous"; }).length} sub="au quotidien" color={T.blue} icon="🤝" />
          <KpiCard label="Personnes distinctes" value={(function () { const s: any = {}; CONTACT_REPORTS.forEach(function (r) { if (r.personId) s[r.personId] = 1; }); return Object.keys(s).length; })()} sub="au-delà des entités" color={T.violet} icon="☺" />
        </div>
      </StatsToggle>
      {createOpen && (
        <div onClick={function () { setCreateOpen(false); }} style={{ position: "fixed", inset: 0, background: "rgba(20,26,14,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 340, padding: 20 }}>
          <div onClick={function (e) { e.stopPropagation(); }} style={{ background: T.surface, borderRadius: 16, width: 620, maxWidth: "96vw", maxHeight: "90vh", overflowY: "auto", padding: 22 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.ink, marginBottom: 4 }}>📇 Nouveau contact report</div>
            <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 14 }}>Notez vos points en vrac — l'assistant IA structure le compte-rendu et signale les cas similaires.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <div style={lbl}>{fl("contactReport", "client")}</div>
                <select value={ccClientId} onChange={function (e) { setCcClientId(e.target.value); setCcPersonId(""); setCcDraft(""); }} style={inp}>
                  <option value="">Sélectionner…</option>
                  {(CLIENTS as any[]).slice(0, 80).map(function (c) { return <option key={c.id} value={c.id}>{c.name}</option>; })}
                </select>
              </div>
              <div>
                <div style={lbl}>{fl("contactReport", "person")}</div>
                <select value={ccPersonId} onChange={function (e) { setCcPersonId(e.target.value); }} style={inp} disabled={!ccClientId}>
                  <option value="">{(ccClient && ccClient.uboName) ? ("Par défaut : " + ccClient.uboName) : "—"}</option>
                  {ccPersons.map(function (p) { return <option key={p.id} value={p.id}>{p.name}</option>; })}
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <div style={lbl}>{fl("contactReport", "channel")}</div>
                <select value={ccChannel} onChange={function (e) { setCcChannel(e.target.value); }} style={inp}>{CONTACT_REPORT_CHANNELS.map(function (c) { return <option key={c} value={c}>{c}</option>; })}</select>
              </div>
              <div>
                <div style={lbl}>{fl("contactReport", "subject")}</div>
                <input value={ccSubject} onChange={function (e) { setCcSubject(e.target.value); }} placeholder={ccChannel} style={inp} />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={lbl}>{fl("contactReport", "notes")}</div>
              <textarea value={ccNotes} onChange={function (e) { setCcNotes(e.target.value); }} placeholder={"Une idée par ligne, ex :\nDemande de crédit lombard\nSouhaite diversifier vers le private equity"} style={{ width: "100%", minHeight: 80, padding: 10, borderRadius: 9, border: "1px solid " + T.line, fontSize: 12, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>
            {ccClient && sim.length > 0 && (
              <div style={{ padding: "9px 11px", borderRadius: 9, background: T.oliveSoft, fontSize: 11, color: T.inkMid, marginBottom: 10 }}>
                <strong style={{ color: T.olive700 }}>Cas similaires ({sim.length})</strong> — {sim.map(function (r) { return ((clientById as any)[r.clientId] || {}).name + " : " + r.subject; }).join(" · ")}
              </div>
            )}
            <button onClick={generateDraft} disabled={!ccClientId || !ccNotes.trim()} style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid " + T.olive600, background: T.surface, color: T.olive700, fontSize: 12, fontWeight: 700, cursor: ccClientId && ccNotes.trim() ? "pointer" : "not-allowed", marginBottom: 10 }}>✦ Générer avec l'assistant IA</button>
            {ccDraft && (
              <div style={{ marginBottom: 10 }}>
                <div style={lbl}>{fl("contactReport", "draft")}</div>
                <textarea value={ccDraft} onChange={function (e) { setCcDraft(e.target.value); }} style={{ width: "100%", minHeight: 140, padding: 10, borderRadius: 9, border: "1px solid " + T.olive600 + "55", background: T.oliveSoft + "33", fontSize: 11.5, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", lineHeight: 1.5 }} />
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={function () { setCreateOpen(false); }} style={{ padding: "9px 16px", borderRadius: 9, border: "1px solid " + T.line, background: T.surface, color: T.inkMid, fontSize: 12.5, cursor: "pointer" }}>Annuler</button>
              <button onClick={save} disabled={!ccClientId || !ccNotes.trim()} style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: (ccClientId && ccNotes.trim()) ? T.olive600 : T.line, color: "#fff", fontSize: 12.5, fontWeight: 800, cursor: (ccClientId && ccNotes.trim()) ? "pointer" : "not-allowed" }}>Enregistrer →</button>
            </div>
          </div>
        </div>
      )}
      <div style={{ background: T.surface, borderRadius: 14, border: "1px solid " + T.line, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
          <thead>
            <tr style={{ background: T.lineSoft }}>{["Date", "Client", "Personne", "Canal", "Sujet", "RM"].map(function (h) { return <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 10, color: T.inkSoft, textTransform: "uppercase" }}>{h}</th>; })}</tr>
          </thead>
          <tbody>
            {filtered.slice(0, 60).map(function (r) {
              const c = (clientById as any)[r.clientId];
              return (
                <tr key={r.id} style={{ borderTop: "1px solid " + T.lineSoft }}>
                  <td style={{ padding: "9px 14px", fontSize: 10.5, color: T.inkSoft, whiteSpace: "nowrap" }}>{r.date}</td>
                  <td style={{ padding: "9px 14px", fontWeight: 700, color: T.ink }}>{c ? c.name : r.clientId}</td>
                  <td style={{ padding: "9px 14px", color: T.inkMid }}>{r.personName || "—"}</td>
                  <td style={{ padding: "9px 14px" }}><Badge text={r.channel} color={T.blue} bg={T.blueSoft} /></td>
                  <td style={{ padding: "9px 14px", color: T.inkMid }}>{r.subject}</td>
                  <td style={{ padding: "9px 14px", color: T.inkSoft, fontSize: 10.5 }}>{r.rm}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: T.inkSoft, fontSize: 12 }}>Aucun contact report.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
