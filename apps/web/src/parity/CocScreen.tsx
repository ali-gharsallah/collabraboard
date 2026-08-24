import React, { useState } from "react";
import { T } from "./tokens";
import { Badge, StatsToggle } from "./components";
import { clientById } from "./components-data";
import COC_DATA from "../fixtures/COC_DATA.json";
import COC_TYPE_LABELS from "../fixtures/COC_TYPE_LABELS.json";
import COC_ROLES from "../fixtures/COC_ROLES.json";
import COC_CONFIG_DEFAULT from "../fixtures/COC_CONFIG_DEFAULT.json";
import CLIENTS from "../fixtures/CLIENTS.json";

// Source : docs/reference/olive-demo.html 42346–42501 — porté verbatim.
export function CocScreen({ user }: { user?: any }) {
  // Source : useState(COC_DATA.filter(r => !clientById[r.clientId] || typeof clientVisibleTo !== "function" || clientVisibleTo(user, cc)))
  // clientVisibleTo n'est pas portée côté parité → la garde `typeof … !== "function"` retient toutes les lignes (comportement identique à la maquette).
  const [rows, setRows] = useState<any[]>(() => (COC_DATA as any[]).map(r => ({ ...r })));
  const [config, setConfig] = useState<any>(COC_CONFIG_DEFAULT as any);
  const [creating, setCreating] = useState(false);
  const [showCfg, setShowCfg] = useState(false);
  const [form, setForm] = useState<any>({ clientId: (CLIENTS as any[])[0].id, type: "EMAIL", detail: "", note: "" });
  // Habilitation : seuls certains profils peuvent paramétrer (Central File, Compliance, Admin, Security)
  const canConfig = ["CF", "ADMIN", "COMPLIANCE", "CO", "SO"].includes(user?.role) ||
    (user?.permissions || []).includes("documents_manage") ||
    (user?.permissions || []).includes("coc_config");
  const matColor = (m: string) => m === "HIGH" ? { c: T.red, b: T.redSoft } : m === "MEDIUM" ? { c: T.amber, b: T.amberSoft } : { c: T.green, b: T.greenSoft };
  const matLabel = (m: string) => m === "HIGH" ? "Matérielle" : m === "MEDIUM" ? "Modérée" : "Mineure";
  const stColor = (s: string): any => ({ APPLIED: { c: T.green, b: T.greenSoft, l: "Appliqué" }, ASSIGNED: { c: T.violet, b: "#F0E9FB", l: "Affecté" }, KYC_TRIGGERED: { c: T.red, b: T.redSoft, l: "KYC déclenché" }, SUBMITTED: { c: T.amber, b: T.amberSoft, l: "Soumis" }, UNDER_REVIEW: { c: T.blue, b: T.blueSoft, l: "En revue" }, DRAFT: { c: T.inkSoft, b: T.lineSoft, l: "Brouillon" }, REJECTED: { c: T.red, b: T.redSoft, l: "Rejeté" } } as any)[s] || { c: T.inkSoft, b: T.lineSoft, l: s };
  const total = rows.length;
  const kycT = rows.filter(r => r.status === "KYC_TRIGGERED").length;
  const assigned = rows.filter(r => r.status === "ASSIGNED").length;
  const pending = rows.filter(r => r.status === "SUBMITTED" || r.status === "UNDER_REVIEW").length;
  const createCoc = () => {
    const cfg = config[form.type] || { materiality: "LOW", action: "ROLE", role: "Central File" };
    const cli = (CLIENTS as any[]).find(c => c.id === form.clientId);
    const isKyc = cfg.action === "KYC";
    const status = isKyc ? "SUBMITTED" : (cfg.materiality === "LOW" ? "ASSIGNED" : "SUBMITTED");
    const row: any = {
      id: "COC-2026-" + String(1000 + rows.length + 1).slice(1),
      clientId: cli.id, clientName: cli.name, type: form.type,
      source: "Saisie manuelle", detail: form.detail || "—",
      materiality: cfg.materiality, status, assignedRole: isKyc ? undefined : cfg.role,
      fourEyes: cfg.materiality !== "LOW",
      createdAt: new Date().toISOString().slice(0, 10),
      raisedBy: (user?.name || "RM") + " (RM)", reviewer: status === "ASSIGNED" ? cfg.role : "—", note: form.note || "",
    };
    setRows([row, ...rows]);
    setCreating(false);
    setForm({ clientId: (CLIENTS as any[])[0].id, type: "EMAIL", detail: "", note: "" });
  };
  const approve = (id: string) => setRows(rows.map(r => {
    if (r.id !== id) return r;
    const cfg = config[r.type] || {};
    if (cfg.action === "KYC")
      return { ...r, status: "KYC_TRIGGERED", reviewer: (user?.name || "CO"), kycRef: "KYC-révision-auto" };
    return { ...r, status: "ASSIGNED", assignedRole: cfg.role || r.assignedRole, reviewer: cfg.role || r.assignedRole };
  }));
  const reject = (id: string) => setRows(rows.map(r => r.id === id ? { ...r, status: "REJECTED", reviewer: (user?.name || "CO") } : r));
  const setCfg = (type: string, patch: any) => setConfig({ ...config, [type]: { ...config[type], ...patch } });
  const cell: any = { padding: "11px 14px", fontSize: 12.5, color: T.ink, borderBottom: `1px solid ${T.lineSoft}`, verticalAlign: "top" };
  const th: any = { padding: "10px 14px", fontSize: 10.5, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, textAlign: "left", borderBottom: `1px solid ${T.line}` };
  const sel: any = { padding: "6px 8px", borderRadius: 7, border: `1px solid ${T.line}`, fontSize: 12, background: "#fff" };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16, gap: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.ink }}>Change of Circumstances ⇆</div>
          <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 2 }}>Réévaluation ciblée du risque — sans relancer un KYC complet.</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={() => { setCreating(!creating); setShowCfg(false); }} style={{ background: T.olive600, color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{creating ? "✕ Fermer" : "+ Nouveau COC"}</button>
        </div>
      </div>
      <StatsToggle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
          {([["Total COC", total, T.olive700], ["KYC déclenchés", kycT, T.red], ["Affectés à un rôle", assigned, T.violet], ["En attente de revue", pending, T.amber]] as any[]).map(([l, v, c], i) => (
            <div key={i} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 600 }}>{l}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: c, marginTop: 4 }}>{v}</div>
            </div>
          ))}
        </div>
      </StatsToggle>
      {showCfg && (
        <div style={{ background: T.surface, border: `1px solid ${T.olive600}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.olive900 }}>Paramétrage du traitement par type de changement</div>
            <Badge text={"Habilité : " + (user?.roleLabel || user?.role || "—")} color={T.violet} bg="#F0E9FB" />
          </div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 14 }}>
            Pour chaque type, définissez s'il <b>déclenche une révision KYC</b> ou s'il est simplement <b>affecté à un rôle</b> (ex. Central File). Modifiable par Central File, Compliance, Admin.
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Type de changement</th>
                <th style={th}>Matérialité</th>
                <th style={th}>Traitement</th>
                <th style={th}>Rôle affecté</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(COC_TYPE_LABELS as any).map(t => {
                const cfg = config[t];
                const mc = matColor(cfg.materiality);
                return (
                  <tr key={t}>
                    <td style={cell}><b>{(COC_TYPE_LABELS as any)[t]}</b></td>
                    <td style={cell}>
                      <select style={{ ...sel, color: mc.c, fontWeight: 700 }} value={cfg.materiality} onChange={e => setCfg(t, { materiality: e.target.value })}>
                        <option value="LOW">Mineure</option>
                        <option value="MEDIUM">Modérée</option>
                        <option value="HIGH">Matérielle</option>
                      </select>
                    </td>
                    <td style={cell}>
                      <select style={sel} value={cfg.action} onChange={e => setCfg(t, { action: e.target.value })}>
                        <option value="KYC">Révision KYC</option>
                        <option value="ROLE">Affecter à un rôle</option>
                      </select>
                    </td>
                    <td style={cell}>{cfg.action === "ROLE" ? (
                      <select style={sel} value={cfg.role} onChange={e => setCfg(t, { role: e.target.value })}>
                        {(COC_ROLES as any[]).map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : <span style={{ fontSize: 11, color: T.red, fontWeight: 600 }}>→ KYC (révision)</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 10 }}>Les nouveaux COC suivent immédiatement ce paramétrage.</div>
        </div>
      )}
      {creating && (
        <div style={{ background: T.oliveSoft, border: `1px solid ${T.sage}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.olive900, marginBottom: 12 }}>Déclarer un changement de situation</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: T.inkMid }}>
              Client
              <select value={form.clientId} onChange={e => setForm({ ...form, clientId: e.target.value })} style={{ width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 12.5, background: "#fff" }}>
                {(CLIENTS as any[]).slice(0, 30).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 11, color: T.inkMid }}>
              Type de changement
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={{ width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 12.5, background: "#fff" }}>
                {Object.keys(COC_TYPE_LABELS as any).map(k => <option key={k} value={k}>{(COC_TYPE_LABELS as any)[k]}</option>)}
              </select>
            </label>
          </div>
          <label style={{ fontSize: 11, color: T.inkMid }}>
            Détail (ancienne → nouvelle valeur)
            <input value={form.detail} onChange={e => setForm({ ...form, detail: e.target.value })} placeholder="ex. Suisse → Royaume-Uni" style={{ width: "100%", marginTop: 4, marginBottom: 12, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 12.5, boxSizing: "border-box" }} />
          </label>
          {(() => {
            const cfg = config[form.type];
            const mc = matColor(cfg.materiality);
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: T.inkMid, marginBottom: 12, flexWrap: "wrap" }}>
                <span>Traitement paramétré :</span>
                <Badge text={matLabel(cfg.materiality)} color={mc.c} bg={mc.b} />
                {cfg.action === "KYC"
                  ? <Badge text="→ Révision KYC + four-eyes" color={T.red} bg={T.redSoft} />
                  : <Badge text={"→ Affecté à " + cfg.role} color={T.violet} bg="#F0E9FB" />}
              </div>
            );
          })()}
          <button onClick={createCoc} style={{ background: T.olive700, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Créer le COC</button>
        </div>
      )}
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Réf.</th>
              <th style={th}>Client</th>
              <th style={th}>Type</th>
              <th style={th}>Détail</th>
              <th style={th}>Matérialité</th>
              <th style={th}>Statut</th>
              <th style={th}>Traitement</th>
              <th style={th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const mc = matColor(r.materiality);
              const sc = stColor(r.status);
              const canReview = r.status === "SUBMITTED" || r.status === "UNDER_REVIEW";
              return (
                <tr key={r.id}>
                  <td style={cell}><span style={{ fontFamily: "monospace", fontSize: 11, color: T.inkMid }}>{r.id}</span></td>
                  <td style={{ ...cell, fontWeight: 600 }}>{r.clientName}</td>
                  <td style={cell}>{(COC_TYPE_LABELS as any)[r.type] || r.type}</td>
                  <td style={{ ...cell, color: T.inkMid, maxWidth: 200 }}>{r.detail}</td>
                  <td style={cell}><Badge text={r.materiality} color={mc.c} bg={mc.b} /></td>
                  <td style={cell}>
                    <Badge text={sc.l} color={sc.c} bg={sc.b} />
                    {r.fourEyes && <span style={{ marginLeft: 6, fontSize: 9.5, color: T.inkSoft }}>👁👁</span>}
                  </td>
                  <td style={{ ...cell, fontSize: 11.5 }}>{r.status === "KYC_TRIGGERED" ? <span style={{ color: T.red, fontWeight: 600 }}>↳ {r.kycRef || "révision KYC"}</span> : r.assignedRole ? <span style={{ color: T.violet, fontWeight: 600 }}>{r.assignedRole}</span> : <span style={{ color: T.inkSoft }}>—</span>}</td>
                  <td style={cell}>{canReview ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => approve(r.id)} style={{ background: T.greenSoft, color: T.green, border: `1px solid ${T.green}33`, borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Approuver</button>
                      <button onClick={() => reject(r.id)} style={{ background: T.redSoft, color: T.red, border: `1px solid ${T.red}33`, borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Rejeter</button>
                    </div>
                  ) : <span style={{ fontSize: 11, color: T.inkSoft }}>{r.reviewer || "—"}</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 10, lineHeight: 1.5 }}>
        Le <b>traitement de chaque type</b> est paramétrable (⚙) : déclencher une révision KYC, ou affecter à un rôle (Central File, Compliance…). Réservé aux profils habilités.
      </div>
    </div>
  );
}
