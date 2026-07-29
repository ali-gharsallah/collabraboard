import React, { useEffect, useState } from "react";
import { T } from "./tokens";
import { SectionTitle } from "./components";
import { evalAmlRules } from "./aml";
import CLIENTS from "../fixtures/CLIENTS.json";
import KYCS_DATA from "../fixtures/KYCS_DATA.json";
import ACCOUNT_REVIEWS_DATA from "../fixtures/ACCOUNT_REVIEWS_DATA.json";

// Composants partagés DÉPENDANTS DES DONNÉES — port verbatim de docs/reference/olive-demo.html.
// (RiskFactorsList/ScorePopover 13131 · BrancheDeVie 13506 · ClientTimelineModal 13555 ·
//  LifecycleBadge 16545 · ExportBtn 18082). Câblés sur les fixtures extraites (§5).

// Dérivations (13068–13069)
export const clientById: Record<string, any> = Object.fromEntries((CLIENTS as any[]).map(c => [c.id, c]));
export const kycsByClientId: Record<string, any[]> = (() => {
  const m: Record<string, any[]> = {};
  (KYCS_DATA as any[]).forEach(k => { (m[k.clientId] = m[k.clientId] || []).push(k); });
  return m;
})();

// RiskFactorsList (13131)
export function RiskFactorsList({ client, kyc, max, compact }: { client: any; kyc?: any; max?: number; compact?: boolean }) {
  const ev = evalAmlRules(client || {}, kyc || null);
  const hits = ev.rules.filter(r => r.hit).sort((a, b) => b.pts - a.pts);
  const shown = max ? hits.slice(0, max) : hits;
  if (hits.length === 0)
    return <div style={{ fontSize: compact ? 10.5 : 11.5, color: T.inkSoft, fontStyle: "italic" }}>Aucun facteur de risque declenche - score plancher.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 3 : 5 }}>
      {shown.map(r => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: compact ? 10 : 11, fontWeight: 800, fontFamily: "monospace", color: r.pts >= 20 ? T.red : T.amber, minWidth: 26 }}>+{r.pts}</span>
          <span style={{ fontSize: compact ? 10.5 : 12, color: T.ink }}>{r.label}</span>
        </div>))}
      {max && hits.length > max && <div style={{ fontSize: 9.5, color: T.inkSoft }}>+{hits.length - max} autre(s) facteur(s)</div>}
    </div>);
}

// ScorePopover (13150)
export function ScorePopover({ client, kyc }: { client: any; kyc?: any }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
      <button onClick={() => setOpen(!open)} title="Pourquoi ce score ?" style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 10.5, color: T.inkSoft, padding: 0, marginLeft: 3 }}>info</button>
      {open && <div onMouseLeave={() => setOpen(false)} style={{ position: "absolute", top: 20, left: 0, zIndex: 60, width: 250, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px", boxShadow: "0 10px 30px rgba(10,15,8,0.18)" }}>
        <div style={{ fontSize: 9.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Facteurs contributeurs</div>
        <RiskFactorsList client={client} kyc={kyc} compact />
      </div>}
    </div>);
}

// LifecycleBadge (16545) + clientLifecycleStatus (16530) + LIFECYCLE_STATUS_STYLE (16523)
const LIFECYCLE_STATUS_STYLE: Record<string, [string, string]> = {
  "Prospect — en contact": [T.inkSoft, T.lineSoft], "Prospect — en onboarding": [T.gold, T.amberSoft],
  "Client actif": [T.green, T.greenSoft], "Client — sortie en cours": [T.amber, T.amberSoft], "Ancien client": [T.inkSoft, T.lineSoft],
};
function clientLifecycleStatus(entity: any): string {
  if (!entity) return "—";
  if (entity._isLead) return "Prospect — en contact";
  if (entity.firstKyc !== undefined) return entity.entered ? "Client actif" : "Prospect — en onboarding";
  return "Client actif"; // OFFBOARDING_CASES non extrait (guard) → client actif par défaut
}
export function LifecycleBadge({ entity }: { entity: any }) {
  const st = clientLifecycleStatus(entity);
  const [c, bg] = LIFECYCLE_STATUS_STYLE[st] || [T.inkSoft, T.lineSoft];
  return <span style={{ fontSize: 9.5, fontWeight: 800, color: c, background: bg, padding: "2px 9px", borderRadius: 20, whiteSpace: "nowrap" }}>{st}</span>;
}

// ExportBtn (18082) + exportCSV
function exportCSV(filename: string, headers: string[], rows: any[][]) {
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(","), ...rows.map(r => r.map(esc).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
export function ExportBtn({ filename, headers, rows }: { filename: string; headers: string[]; rows: any[][] | (() => any[][]) }) {
  return <button onClick={() => exportCSV(filename, headers, typeof rows === "function" ? rows() : rows)}
    style={{ padding: "7px 13px", borderRadius: 8, border: `1px solid ${T.line}`, background: T.surface, color: T.inkMid, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>⇩ Export Excel/CSV</button>;
}

// clientLifecycleStages (13077)
function clientLifecycleStages(client: any) {
  const defs = [{ id: 1, label: "Prospection" }, { id: 2, label: "Onboarding" }, { id: 3, label: "KYC" }, { id: 4, label: "Screening" }, { id: 5, label: "Relation active" }, { id: 6, label: "Account Review" }, { id: 7, label: "Surveillance" }];
  let curIdx = 4;
  if (client) {
    const st = client.currentKycStatus;
    if (st === "DRAFT") curIdx = 1;
    else if (st === "IN_PROGRESS" || st === "UNDER_REVIEW" || st === "PENDING_APPROVAL") curIdx = 2;
    else if (st === "REJECTED") curIdx = 1;
    else curIdx = 4;
    const overdue = (ACCOUNT_REVIEWS_DATA as any[]).some(a => a.clientId === client.id && a.status === "OVERDUE");
    if (curIdx >= 4 && overdue) curIdx = 6; else if (curIdx >= 4) curIdx = 5;
  }
  return defs.slice(0, curIdx + 1).map((d, i) => ({ id: d.id, label: d.label, state: i < curIdx ? "done" : (d.id === 7 ? "alert" : "current") }));
}

// FeuilleSurTige (13475)
function FeuilleSurTige({ side, color, filled, size }: { side?: number; color: string; filled?: boolean; size?: number }) {
  const s = side || 1, k = (size || 14) / 14, x0 = 21.5, y0 = 22, x1 = x0 + s * 13 * k, y1 = 9;
  return (
    <svg width={46} height={30} viewBox="0 0 46 30" style={{ position: "absolute", left: 0, top: 3, display: "block", overflow: "visible" }}>
      <path d={`M ${x0} ${y0} Q ${x0 + s * 7 * k} ${y0 - 4}, ${x1} ${y1}`} fill="none" stroke="#8A9B6E" strokeWidth={1.6} strokeLinecap="round" />
      <g transform={`translate(${x1} ${y1}) rotate(${s * 38}) scale(${k})`}>
        <path d="M0 0 C 5.5 -3.5, 8.5 -10, 0 -17 C -8.5 -10, -5.5 -3.5, 0 0 Z" fill={filled ? color : color + "2A"} stroke={color} strokeWidth={1.3} />
        <path d="M0 -1.5 L 0 -15" stroke={color} strokeWidth={0.8} opacity={0.5} />
      </g>
    </svg>);
}
// OliveAuSommet (13491)
function OliveAuSommet() {
  return (
    <svg width={46} height={42} viewBox="0 0 46 42" style={{ position: "absolute", left: 0, top: 0, display: "block", overflow: "visible" }}>
      <path d="M 21.5 40 L 21.5 12" stroke="#7B6B4E" strokeWidth={3} strokeLinecap="round" />
      <path d="M 21.5 16 Q 27 12, 30.5 7" fill="none" stroke="#8A9B6E" strokeWidth={1.6} strokeLinecap="round" />
      <ellipse cx={30.5} cy={10.5} rx={4.3} ry={5.4} fill="#3A4D22" />
      <ellipse cx={35.6} cy={13.5} rx={3.5} ry={4.4} fill="#5A7D3A" />
      <path d="M 21.5 20 Q 16 16, 12.5 10" fill="none" stroke="#8A9B6E" strokeWidth={1.6} strokeLinecap="round" />
      <g transform="translate(12.5 10) rotate(-38)">
        <path d="M0 0 C 6 -4, 9.5 -11, 0 -19 C -9.5 -11, -6 -4, 0 0 Z" fill={T.gold} stroke={T.gold} strokeWidth={1.2} />
        <path d="M0 -2 L 0 -17" stroke="#8A6C12" strokeWidth={0.9} opacity={0.6} />
      </g>
    </svg>);
}
// BrancheDeVie (13506)
function BrancheDeVie({ cname, ev, stages }: { cname: string; ev: any[]; stages: any[] }) {
  const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [grown, setGrown] = useState(reduced);
  useEffect(() => { if (reduced) return; const t = setTimeout(() => setGrown(true), 120); return () => clearTimeout(t); }, []);
  let courante: any = null;
  for (const s of stages || []) if (s.current || s.status === "current" || s.active) courante = s;
  const labelCourante = (courante && courante.label) || "Relation active";
  return (
    <div style={{ background: T.surface, borderRadius: 14, padding: 24, border: `1px solid ${T.line}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <SectionTitle>Branche de vie — {cname}</SectionTitle>
        <div style={{ marginLeft: "auto" }}>
          <ExportBtn filename="branche-de-vie.csv" headers={["Date", "Événement", "Détail"]} rows={() => ev.map(e => [e.d, e.t, e.x])} />
        </div>
      </div>
      {ev.length === 0 && <div style={{ fontSize: 12, color: T.inkSoft, fontStyle: "italic" }}>Aucun événement pour ce client dans les données de démonstration.</div>}
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: 20, top: 34, bottom: 6, width: 3, borderRadius: 2, background: "linear-gradient(180deg, #8A9B6E 0px, #7B6B4E 90px, #6B5D44 100%)", transformOrigin: "bottom", transform: grown ? "scaleY(1)" : "scaleY(0)", transition: reduced ? "none" : "transform 1.1s cubic-bezier(.34,1,.5,1)" }} />
        <div key="now" style={{ position: "relative", padding: "4px 0 16px 52px", minHeight: 42, opacity: grown ? 1 : 0, transition: reduced ? "none" : "opacity .5s ease .05s" }}>
          <OliveAuSommet />
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.olive700 }}>Aujourd'hui — {labelCourante}</div>
          <div style={{ fontSize: 10, color: T.inkSoft }}>Étape actuelle de {cname} — pas de projection au-delà.</div>
        </div>
        {ev.map((e, i) => {
          const racine = e.icon === "⌂";
          return (
            <div key={"e" + i} style={{ position: "relative", padding: "9px 0 9px 52px", minHeight: 30, opacity: grown ? 1 : 0, transform: grown ? "none" : "translateY(8px)", transition: reduced ? "none" : `opacity .45s ease ${120 + i * 45}ms, transform .45s ease ${120 + i * 45}ms` }}>
              <FeuilleSurTige side={i % 2 === 0 ? -1 : 1} color={racine ? T.leaf : e.c} filled={racine} size={racine ? 16 : 13} />
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, fontFamily: "monospace", color: T.inkSoft, minWidth: 72 }}>{e.d}</span>
                <span style={{ fontSize: 12, fontWeight: racine ? 800 : 700, color: racine ? T.olive700 : T.ink }}>{e.t}</span>
                <span style={{ fontSize: 10.5, color: T.inkSoft }}>{e.x}</span>
              </div>
            </div>);
        })}
      </div>
    </div>);
}

// ClientTimelineModal (13555) — sources de timeline non extraites (COC/AML/TX/TRIPS) omises
// (guards). Événements construits depuis KYCS_DATA + ACCOUNT_REVIEWS_DATA + onboarding.
export function ClientTimelineModal({ client, kyc, onClose }: { client: any; kyc?: any; onClose: () => void }) {
  const cid = (client && client.id) || "";
  const cname = (client && client.name) || (kyc && kyc.clientName) || "";
  const ev: any[] = [];
  (KYCS_DATA as any[]).filter(k => k.clientId === cid || k.clientName === cname).forEach(k => ev.push({ d: k.createdAt || "2026-01-01", icon: "◎", c: T.olive600, t: "KYC " + k.code + " — " + k.workflow, x: (k.status || "") + " · phase " + (k.wfPhase || "—") }));
  (ACCOUNT_REVIEWS_DATA as any[]).filter(a => a.clientId === cid).forEach(a => ev.push({ d: a.reviewDate || "2026-01-01", icon: "↻", c: T.amber, t: "Account Review — " + (a.trigger || ""), x: (a.status || "") + " · " + (a.reviewer || "") }));
  ev.push({ d: (client && client.onboardingDate) || "2023-05-12", icon: "⌂", c: T.leaf, t: "Onboarding — entrée en relation", x: "Prospect → client" });
  ev.sort((a, b) => String(b.d).localeCompare(String(a.d)));
  const twinKyc = kyc || (KYCS_DATA as any[]).filter(k => k.clientId === cid || k.clientName === cname).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0];
  const scr = (twinKyc && twinKyc.screening) || {};
  const scrHit = scr.ofac === "HIT" || scr.seco === "HIT" || scr.pep === "HIT" || scr.adverse === "HIT";
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,15,8,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 600, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.cream, borderRadius: 16, width: 760, maxWidth: "96vw", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 70px rgba(10,15,8,0.35)", padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 16 }}>🪪</span>
          <div style={{ flex: 1, fontSize: 16, fontWeight: 800, color: T.ink }}>Vue 360° — {cname}</div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", fontSize: 18, color: T.inkSoft, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ background: T.surface, borderRadius: 14, padding: 22, border: `1px solid ${T.line}`, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
            <div>
              <div style={{ fontSize: 9.5, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>Identité &amp; structure</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{(client && client.countryFlag) || ""} {cname}</div>
              <div style={{ fontSize: 11.5, color: T.inkMid, marginTop: 2 }}>{(client && client.typeLabel) || (twinKyc && twinKyc.structCode) || "—"} · {(client && client.country) || (twinKyc && twinKyc.country) || "—"}</div>
              <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>RM {(client && client.rm) || (twinKyc && twinKyc.rm) || "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 9.5, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>Ayant droit économique</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{(client && client.uboName) || (twinKyc && twinKyc.uboName) || "—"}</div>
              <div style={{ fontSize: 11.5, color: T.inkMid, marginTop: 2 }}>Part {(twinKyc && twinKyc.uboShare) || "—"}</div>
              {client && client.pep && <span style={{ display: "inline-block", marginTop: 4, fontSize: 9.5, fontWeight: 800, color: T.violet, background: T.violet + "18", padding: "2px 7px", borderRadius: 5 }}>PEP</span>}
            </div>
            <div>
              <div style={{ fontSize: 9.5, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>Screening &amp; documents</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: scrHit ? T.red : T.green }}>{scrHit ? "⚠ Hit détecté" : "✓ Screening levé"}</div>
              <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>OFAC {scr.ofac || "—"} · SECO {scr.seco || "—"} · PEP {scr.pep || "—"} · Media {scr.adverse || "—"}</div>
              <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>Docs {(twinKyc && twinKyc.totalPct != null) ? twinKyc.totalPct + "%" : "—"} complétés · {(twinKyc && twinKyc.signedCount) || 0} signés</div>
            </div>
            <div>
              <div style={{ fontSize: 9.5, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>Facteurs de risque (explicable)</div>
              <RiskFactorsList client={client || {}} kyc={twinKyc} max={3} compact />
            </div>
          </div>
        </div>
        <BrancheDeVie cname={cname} ev={ev} stages={clientLifecycleStages(client)} />
      </div>
    </div>);
}
