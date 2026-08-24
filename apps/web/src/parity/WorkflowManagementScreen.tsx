import React, { useState } from "react";
import { T } from "./tokens";
import { offRoleLabel, OFF_ROLE_SEQ } from "./offboarding-support";
import { PARAM_AUDIT } from "./param-audit-support";
import { WF_MGMT_TEMPLATES, WF_MGMT_CATEGORY_LABEL, WF_MGMT_APPLICABILITY, wfMgmtTemplate, wfMgmtInstanceCount, wfMgmtUpdateStep, wfMgmtAddStep, wfMgmtRemoveStep } from "./wf-mgmt-support";

// Source : docs/reference/olive-demo.html 41667–41836 — porté verbatim.
export function WorkflowManagementScreen({ user }: { user?: any }) {
  void user;
  const [tab, setTab] = useState("dashboard");
  const [selCode, setSelCode] = useState("SOW");
  const [selStepIdx, setSelStepIdx] = useState<number | null>(null);
  const [, bump] = useState(0);
  const re = () => bump(x => x + 1);
  const [newStepName, setNewStepName] = useState("");
  const [newStepOwner, setNewStepOwner] = useState("CO");
  const t = wfMgmtTemplate(selCode);
  const card: any = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 20 };
  const TABS = [["dashboard", "▦ Dashboard"], ["designer", "✎ Designer"], ["instances", "▶ Instances"], ["history", "⏱ History"], ["params", "⚙ Parameters"]];
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: T.olive700, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>Workflow Management</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>12 workflows nommés — Onboarding, Perpetual KYC, Offboarding, Business Trip, Account Review, Group Account Review</div>
        <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>Un compliance officer doit comprendre en 5 secondes : où est le dossier, quelle étape, qui doit agir, quelle validation manque.</div>
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 18, background: T.surface, padding: 5, borderRadius: 12, border: "1px solid " + T.line, width: "fit-content" }}>{TABS.map(function (tb) {
        return <button key={tb[0]} onClick={function () { setTab(tb[0]); }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === tb[0] ? T.olive600 : "transparent", color: tab === tb[0] ? "#fff" : T.inkMid, fontSize: 12.5, fontWeight: tab === tb[0] ? 700 : 500 }}>{tb[1]}</button>;
      })}</div>
      {tab === "dashboard" && <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>{WF_MGMT_TEMPLATES.map(function (tpl) {
        const n = wfMgmtInstanceCount(tpl.code);
        return <div key={tpl.code} onClick={function () { setSelCode(tpl.code); setTab("designer"); }} style={{ background: T.surface, border: "1px solid " + (tpl.active ? T.line : T.redSoft), borderRadius: 14, padding: 16, cursor: "pointer", opacity: tpl.active ? 1 : 0.55 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 800, fontFamily: "monospace", color: T.olive700, background: T.oliveSoft, padding: "2px 8px", borderRadius: 6 }}>{tpl.code}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: tpl.active ? T.green : T.red }}>{tpl.active ? "● ON" : "○ OFF"}</span>
            <span style={{ marginLeft: "auto", fontSize: 9, color: T.inkSoft }}>{tpl.version}</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 3 }}>{tpl.label}</div>
          <div style={{ fontSize: 10.5, color: T.inkSoft, marginBottom: 10 }}>{WF_MGMT_CATEGORY_LABEL[tpl.category]}{tpl.riskTier ? (" · " + tpl.riskTier) : ""}</div>
          <div style={{ display: "flex", gap: 14 }}>
            <div><div style={{ fontSize: 16, fontWeight: 800, color: T.olive700 }}>{tpl.steps.length}</div><div style={{ fontSize: 9, color: T.inkSoft, textTransform: "uppercase" }}>étapes</div></div>
            <div><div style={{ fontSize: 16, fontWeight: 800, color: T.blue }}>{n}</div><div style={{ fontSize: 9, color: T.inkSoft, textTransform: "uppercase" }}>instances</div></div>
          </div>
        </div>;
      })}</div>}
      {tab === "designer" && <div>
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>{WF_MGMT_TEMPLATES.map(function (tpl) {
          return <button key={tpl.code} onClick={function () { setSelCode(tpl.code); setSelStepIdx(null); }} style={{ padding: "6px 13px", borderRadius: 8, border: "1px solid " + (selCode === tpl.code ? T.olive600 : T.line), background: selCode === tpl.code ? T.olive600 : T.surface, color: selCode === tpl.code ? "#fff" : T.inkMid, fontSize: 11, fontWeight: selCode === tpl.code ? 700 : 500, cursor: "pointer" }}>{tpl.code}</button>;
        })}</div>
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.ink }}>{t.label}</div>
            <span style={{ fontSize: 10, color: T.inkSoft }}>{WF_MGMT_CATEGORY_LABEL[t.category]}{t.riskTier ? (" · " + t.riskTier) : ""} · {t.version}</span>
          </div>
          <div style={{ fontSize: 10.5, color: T.inkSoft, marginBottom: 20 }}>Cliquer une étape pour la configurer. Les flèches indiquent le sens du processus.</div>
          <div style={{ overflowX: "auto", paddingBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", minWidth: t.steps.length * 190 }}>{t.steps.map(function (step: any, idx: number) {
              const sel = selStepIdx === idx;
              return <React.Fragment key={idx}>
                <div onClick={function () { setSelStepIdx(sel ? null : idx); }} style={{ minWidth: 150, maxWidth: 150, padding: "14px 16px", borderRadius: 24, border: (sel ? "2.5px " : "1.5px ") + "solid " + (sel ? T.olive600 : T.line), background: sel ? T.oliveSoft : T.cream, cursor: "pointer", flexShrink: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: T.ink, marginBottom: 6, lineHeight: 1.3 }}>{step.name}</div>
                  <div style={{ fontSize: 9, color: T.inkSoft, marginBottom: 2 }}>Owner : <strong style={{ color: T.olive700 }}>{offRoleLabel(step.owner)}</strong></div>
                  {step.validator && <div style={{ fontSize: 9, color: T.inkSoft, marginBottom: 2 }}>Validator : <strong>{offRoleLabel(step.validator)}</strong></div>}
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 8.5, fontWeight: 700, color: step.visaRequired ? T.green : T.inkSoft, background: step.visaRequired ? T.greenSoft : T.lineSoft, padding: "1px 6px", borderRadius: 10 }}>{step.visaRequired ? "Visa ✓" : "Sans visa"}</span>
                    <span style={{ fontSize: 8.5, fontWeight: 700, color: T.amber, background: T.amberSoft, padding: "1px 6px", borderRadius: 10 }}>{step.slaDays}j</span>
                  </div>
                </div>
                {idx < t.steps.length - 1 && <div style={{ display: "flex", alignItems: "center", flexShrink: 0, margin: "0 4px" }}>
                  <div style={{ width: 24, height: 2, background: T.olive600 }} />
                  <div style={{ width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderLeft: "7px solid " + T.olive600 }} />
                </div>}
              </React.Fragment>;
            })}</div>
          </div>
          {selStepIdx != null && t.steps[selStepIdx] && (function () {
            const step = t.steps[selStepIdx];
            return <div style={{ marginTop: 20, paddingTop: 18, borderTop: "1px solid " + T.line }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: T.olive700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Step Configuration</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div><div style={{ fontSize: 9.5, color: T.inkSoft, marginBottom: 3 }}>Step Name</div><input defaultValue={step.name} onBlur={function (e) { wfMgmtUpdateStep(selCode, selStepIdx, "name", e.target.value); re(); }} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid " + T.line, fontSize: 12, boxSizing: "border-box" }} /></div>
                <div><div style={{ fontSize: 9.5, color: T.inkSoft, marginBottom: 3 }}>Approval Type</div><select value={step.approvalType} onChange={function (e) { wfMgmtUpdateStep(selCode, selStepIdx, "approvalType", e.target.value); re(); }} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid " + T.line, fontSize: 12 }}><option value="Single Approval">Single Approval</option><option value="Dual Approval">Dual Approval</option><option value="Committee Approval">Committee Approval</option></select></div>
                <div><div style={{ fontSize: 9.5, color: T.inkSoft, marginBottom: 3 }}>Owner</div><select value={step.owner} onChange={function (e) { wfMgmtUpdateStep(selCode, selStepIdx, "owner", e.target.value); re(); }} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid " + T.line, fontSize: 12 }}>{OFF_ROLE_SEQ.concat(["MLRO", "BRM", "SYSTEM"]).filter(function (v, i, a) { return a.indexOf(v) === i; }).map(function (r) { return <option key={r} value={r}>{offRoleLabel(r)}</option>; })}</select></div>
                <div><div style={{ fontSize: 9.5, color: T.inkSoft, marginBottom: 3 }}>Validator</div><select value={step.validator || ""} onChange={function (e) { wfMgmtUpdateStep(selCode, selStepIdx, "validator", e.target.value || null); re(); }} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid " + T.line, fontSize: 12 }}><option value="">—</option>{OFF_ROLE_SEQ.concat(["MLRO", "BRM"]).filter(function (v, i, a) { return a.indexOf(v) === i; }).map(function (r) { return <option key={r} value={r}>{offRoleLabel(r)}</option>; })}</select></div>
                <div><div style={{ fontSize: 9.5, color: T.inkSoft, marginBottom: 3 }}>SLA (jours)</div><input type="number" value={step.slaDays} onChange={function (e) { wfMgmtUpdateStep(selCode, selStepIdx, "slaDays", parseInt(e.target.value) || 0); re(); }} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid " + T.line, fontSize: 12, boxSizing: "border-box" }} /></div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: T.inkMid, cursor: "pointer" }}><input type="checkbox" checked={step.visaRequired} onChange={function (e) { wfMgmtUpdateStep(selCode, selStepIdx, "visaRequired", e.target.checked); re(); }} style={{ accentColor: T.olive600 }} />Visa obligatoire</label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: T.inkMid, cursor: "pointer" }}><input type="checkbox" checked={step.commentsRequired} onChange={function (e) { wfMgmtUpdateStep(selCode, selStepIdx, "commentsRequired", e.target.checked); re(); }} style={{ accentColor: T.olive600 }} />Commentaire requis</label>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}><div style={{ fontSize: 9.5, color: T.inkSoft, marginBottom: 3 }}>Description</div><textarea defaultValue={step.description} onBlur={function (e) { wfMgmtUpdateStep(selCode, selStepIdx, "description", e.target.value); re(); }} rows={2} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid " + T.line, fontSize: 12, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} /></div>
              <div style={{ marginBottom: 14 }}><div style={{ fontSize: 9.5, color: T.inkSoft, marginBottom: 3 }}>Escalation Rule</div><input defaultValue={step.escalationRule} onBlur={function (e) { wfMgmtUpdateStep(selCode, selStepIdx, "escalationRule", e.target.value); re(); }} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid " + T.line, fontSize: 12, boxSizing: "border-box" }} /></div>
              <button onClick={function () { if (window.confirm('Supprimer l\'étape "' + step.name + '" ?')) { wfMgmtRemoveStep(selCode, selStepIdx!); setSelStepIdx(null); re(); } }} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid " + T.red, background: T.surface, color: T.red, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✕ Supprimer cette étape</button>
            </div>;
          })()}
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid " + T.line, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: T.olive700 }}>＋ Ajouter une étape</span>
            <input value={newStepName} onChange={function (e) { setNewStepName(e.target.value); }} placeholder="Nom de l'étape…" style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid " + T.line, fontSize: 11, flex: "1 1 160px" }} />
            <select value={newStepOwner} onChange={function (e) { setNewStepOwner(e.target.value); }} style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid " + T.line, fontSize: 11 }}>{OFF_ROLE_SEQ.filter(function (r) { return r !== "ADMIN"; }).map(function (r) { return <option key={r} value={r}>{offRoleLabel(r)}</option>; })}</select>
            <button onClick={function () { if (!newStepName.trim()) return; wfMgmtAddStep(selCode, newStepName.trim(), newStepOwner); setNewStepName(""); re(); }} style={{ padding: "6px 14px", borderRadius: 7, border: "none", background: T.olive600, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Ajouter</button>
          </div>
        </div>
      </div>}
      {tab === "instances" && <div style={card}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 4 }}>▶ Instances par workflow</div>
        <div style={{ fontSize: 10.5, color: T.inkSoft, marginBottom: 14 }}>Dérivées des dossiers réels (KYC, Account Review, Offboarding, Business Trip) — pas de duplication de données.</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
          <thead><tr>{["Code", "Workflow", "Catégorie", "Instances actives", "Étape la plus fréquente"].map(function (h) { return <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: 9.5, color: T.inkSoft, textTransform: "uppercase", borderBottom: "1px solid " + T.line }}>{h}</th>; })}</tr></thead>
          <tbody>{WF_MGMT_TEMPLATES.map(function (tpl) {
            const n = wfMgmtInstanceCount(tpl.code);
            return <tr key={tpl.code} style={{ borderTop: "1px solid " + T.lineSoft }}>
              <td style={{ padding: "8px 10px", fontFamily: "monospace", fontWeight: 700, color: T.olive700 }}>{tpl.code}</td>
              <td style={{ padding: "8px 10px", fontWeight: 600, color: T.ink }}>{tpl.label}</td>
              <td style={{ padding: "8px 10px", color: T.inkMid }}>{WF_MGMT_CATEGORY_LABEL[tpl.category]}</td>
              <td style={{ padding: "8px 10px", fontWeight: 800, color: n > 0 ? T.blue : T.inkSoft }}>{n}</td>
              <td style={{ padding: "8px 10px", color: T.inkSoft }}>{tpl.steps[Math.min(1, tpl.steps.length - 1)].name}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>}
      {tab === "history" && <div style={card}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 4 }}>⏱ History — piste d'audit</div>
        <div style={{ fontSize: 10.5, color: T.inkSoft, marginBottom: 14 }}>Derniers changements de configuration et transitions de workflow.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 420, overflowY: "auto" }}>
          {PARAM_AUDIT.slice(0, 60).map(function (e, i) {
            return <div key={i} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: "1px solid " + T.lineSoft }}>
              <span style={{ fontSize: 10, color: T.inkSoft, minWidth: 70 }}>{e.at}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: T.olive700, minWidth: 110 }}>{e.by}</span>
              <span style={{ fontSize: 11.5, color: T.inkMid, flex: 1 }}>{e.what}</span>
            </div>;
          })}
          {PARAM_AUDIT.length === 0 && <div style={{ fontSize: 12, color: T.inkSoft, fontStyle: "italic" }}>Aucun événement pour l'instant.</div>}
        </div>
      </div>}
      {tab === "params" && <div style={card}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 4 }}>⚙ Parameters — le paramétrage a déménagé</div>
        <div style={{ fontSize: 10.5, color: T.inkSoft, marginBottom: 10 }}>L'activation, les versions et l'applicabilité des workflows se gouvernent sous Gouvernance → Workflows — Versions & publication (résolutions datées, publication motivée). Cet onglet est en lecture : rien ne se modifie ici.</div>
        <button onClick={function () { if ((window as any).OLIVE_NAVIGATE) (window as any).OLIVE_NAVIGATE("admin", { admin: "workflow" }); }} style={{ padding: "6px 13px", borderRadius: 8, border: "1.5px solid " + T.olive600, background: T.surface, color: T.olive700, fontSize: 11, fontWeight: 800, cursor: "pointer", marginBottom: 12 }}>Ouvrir Gouvernance → Workflows</button>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead><tr>{["Code", "Actif", "Version", "Booking center", "Segment", "Niveau de risque"].map(function (h) { return <th key={h} style={{ textAlign: "left", padding: "7px 9px", fontSize: 9.5, color: T.inkSoft, textTransform: "uppercase", borderBottom: "1px solid " + T.line }}>{h}</th>; })}</tr></thead>
          <tbody>{WF_MGMT_TEMPLATES.map(function (tpl) {
            const app = WF_MGMT_APPLICABILITY[tpl.code];
            return <tr key={tpl.code} style={{ borderTop: "1px solid " + T.lineSoft }}>
              <td style={{ padding: "7px 9px", fontFamily: "monospace", fontWeight: 700, color: T.olive700 }}>{tpl.code}</td>
              <td style={{ padding: "7px 9px", fontWeight: 800, color: tpl.active ? T.green : T.inkSoft }}>{tpl.active ? "✓ actif" : "—"}</td>
              <td style={{ padding: "7px 9px", color: T.inkMid }}>{tpl.version}</td>
              <td style={{ padding: "7px 9px", color: T.inkMid }}>{app.bookingCenter.join(", ")}</td>
              <td style={{ padding: "7px 9px", color: T.inkMid }}>{app.segment.join(", ")}</td>
              <td style={{ padding: "7px 9px", color: T.inkMid }}>{app.riskLevel.join(", ")}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>}
    </div>
  );
}
