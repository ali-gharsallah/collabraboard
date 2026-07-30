import React, { useState } from "react";
import { T } from "./tokens";
import { Badge } from "./components";
import { pushParamAudit } from "./param-audit-support";
import { AML_ALERTS, aiContextualizeAlert, AML_ACTIONS, amlActionColor, amlStatusStyle, amlTypeStyle, amlSignalColor, AML_SCENARIOS } from "./aml-workspace-support";

// Source : docs/reference/olive-demo.html 14822–14969 — porté verbatim.
export function AmlWorkspaceScreen() {
  const [view, setView] = useState("inbox");
  const [selId, setSelId] = useState<any>(null);
  const [fStatus, setFStatus] = useState("all");
  const [fType, setFType] = useState("all");
  const [state, setState] = useState<any>({});
  const getStatus = (a: any) => (state[a.id] && state[a.id].status) || a.status;
  const getDecisions = (a: any) => (state[a.id] && state[a.id].decisions) || [];
  const decide = (a: any, actionId: string) => {
    const meta = AML_ACTIONS.find(x => x.id === actionId)!;
    setState((prev: any) => {
      const cur = prev[a.id] || { status: a.status, decisions: [] };
      const decisions = cur.decisions.concat([{ action: actionId, label: meta.label, at: "aujourd'hui", by: "Compliance Officer" }]);
      const ns: any = {};
      Object.keys(prev).forEach(k => ns[k] = prev[k]);
      ns[a.id] = { status: meta.status || cur.status, decisions: decisions };
      return ns;
    });
  };
  const openCount = AML_ALERTS.filter(a => getStatus(a) === "NEW").length;
  const clearedCount = AML_ALERTS.filter(a => getStatus(a) === "CLEARED").length;
  const escalatedCount = AML_ALERTS.filter(a => getStatus(a) === "ESCALATED").length;
  const alerts = AML_ALERTS.filter(a => {
    if (fStatus !== "all" && getStatus(a) !== fStatus) return false;
    if (fType !== "all" && a.alertType !== fType) return false;
    return true;
  });
  const selAlert = AML_ALERTS.find(a => a.id === selId);
  const Header = (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, color: T.olive700, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Screening Intelligence Layer</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>AML Investigation Workspace</div>
      <div style={{ fontSize: 13, color: T.inkMid, marginTop: 4, lineHeight: 1.6, maxWidth: 760 }}>On ne remplace pas LSEG / Dow Jones / ComplyAdvantage — on ajoute la couche de contexte manquante entre l'alerte brute et la décision. Enrichissement automatique KYC + UBO + relations, priorisation, et journal prêt pour l'audit FINMA. <strong style={{ color: T.olive700 }}>Objectif : 45 min → 8–12 min par alerte.</strong></div>
    </div>
  );
  const Tabs = (
    <div style={{ display: "flex", gap: 4, marginBottom: 18, background: T.surface, padding: 5, borderRadius: 12, border: `1px solid ${T.line}`, width: "fit-content" }}>
      {([["inbox", "▤ File d'alertes"], ["scenarios", "⚗ Scénarios"], ["dashboard", "▰ Compliance Ops"]] as [string, string][]).map(([id, label]) => (
        <button key={id} onClick={() => { setView(id); setSelId(null); }} style={{ padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", background: view === id ? T.olive600 : "transparent", color: view === id ? "#fff" : T.inkMid, fontSize: 13, fontWeight: view === id ? 700 : 500 }}>{label}</button>
      ))}
    </div>
  );
  // ---- CASE VIEW ----
  if (view === "case" && selAlert) {
    const ctx = aiContextualizeAlert(selAlert);
    const [tl, tc, tbg] = amlTypeStyle(selAlert.alertType);
    const [sl, sc, sbg] = amlStatusStyle(getStatus(selAlert));
    const decisions = getDecisions(selAlert);
    const c = ctx.client, k = ctx.kyc;
    return (
      <div>
        {Header}
        <button onClick={() => setView("inbox")} style={{ marginBottom: 14, padding: "7px 14px", borderRadius: 8, border: `1px solid ${T.line}`, background: T.surface, color: T.inkMid, fontSize: 12, cursor: "pointer" }}>← Retour à la file</button>
        <div style={{ display: "grid", gridTemplateColumns: "290px 1fr 260px", gap: 16, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 10, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Snapshot client</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: T.ink }}>{selAlert.clientName}</div>
              <div style={{ fontSize: 11.5, color: T.inkSoft, marginBottom: 10 }}>{selAlert.clientId} · {(c.typeLabel || k.structCode || "—")}</div>
              {([["Pays", ctx.country], ["Segment", c.segment || "—"], ["AUM", c.aum || k.aum || "—"], ["Secteur", c.sector || k.sector || "—"], ["RM", c.rm || k.rm || "—"]] as [string, string][]).map(([lab, val]) => (
                <div key={lab} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
                  <span style={{ color: T.inkSoft }}>{lab}</span>
                  <span style={{ color: T.ink, fontWeight: 600 }}>{val}</span>
                </div>
              ))}
              <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                <Badge text={(c.risk || k.risk || "—") + " risk"} color={(c.risk || k.risk) === "HIGH" ? T.red : (c.risk || k.risk) === "LOW" ? T.green : T.amber} bg={(c.risk || k.risk) === "HIGH" ? T.redSoft : (c.risk || k.risk) === "LOW" ? T.greenSoft : T.amberSoft} />
                {ctx.pep && <Badge text="PEP" color={T.violet} bg={T.violetSoft} />}
              </div>
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 10, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Résumé KYC (auto-importé)</div>
              {([["Dossier", k.code || "—"], ["Workflow", k.workflow || "—"], ["Phase", k.wfPhase || "—"], ["UBO", (k.uboName || "—") + " (" + (k.uboShare || "—") + ")"], ["Compliance", k.co || "—"]] as [string, string][]).map(([lab, val]) => (
                <div key={lab} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, padding: "3px 0" }}>
                  <span style={{ color: T.inkSoft }}>{lab}</span>
                  <span style={{ color: T.ink, fontWeight: 600, textAlign: "right", maxWidth: 150 }}>{val}</span>
                </div>
              ))}
              <div style={{ marginTop: 10, fontSize: 10, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Screening</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                {["ofac", "seco", "pep", "adverse"].map(key => {
                  const v = (k.screening || {})[key] || "—";
                  return (
                    <div key={key} style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, padding: "3px 6px", borderRadius: 5, background: v === "HIT" ? T.redSoft : T.lineSoft }}>
                      <span style={{ color: T.inkSoft, textTransform: "uppercase" }}>{key}</span>
                      <span style={{ color: v === "HIT" ? T.red : T.green, fontWeight: 700 }}>{v}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div style={{ background: T.surface, border: `1px solid ${T.violet}30`, borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 16 }}>✨</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: T.ink }}>Investigation IA</span>
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, padding: "2px 7px", borderRadius: 5, background: T.violetSoft, color: T.violet }}>Génération locale</span>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                <Badge text={tl} color={tc} bg={tbg} />
                <Badge text={sl} color={sc} bg={sbg} />
              </div>
            </div>
            <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 14 }}>{selAlert.source} · il y a {selAlert.ageHours}h · temps estimé {ctx.estMinutes} min</div>
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1, padding: "12px 14px", borderRadius: 10, background: T.lineSoft }}>
                <div style={{ fontSize: 10, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 }}>Screening brut</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: T.inkMid, fontFamily: "monospace" }}>{selAlert.matchConfidence}%</div>
                <div style={{ fontSize: 10, color: T.inkSoft }}>confiance du match</div>
              </div>
              <div style={{ flex: 1, padding: "12px 14px", borderRadius: 10, background: ctx.aiRiskScore >= 60 ? T.redSoft : ctx.aiRiskScore <= 20 ? T.greenSoft : T.amberSoft }}>
                <div style={{ fontSize: 10, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 }}>Risque contextualisé IA</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: ctx.aiRiskScore >= 60 ? T.red : ctx.aiRiskScore <= 20 ? T.green : T.amber, fontFamily: "monospace" }}>{ctx.aiRiskScore}/100</div>
                <div style={{ fontSize: 10, color: T.inkSoft }}>{ctx.verdict}</div>
              </div>
            </div>
            <div style={{ padding: "12px 14px", borderRadius: 10, background: T.violetSoft, fontSize: 12.5, color: T.ink, lineHeight: 1.65, marginBottom: 16 }}>{ctx.summary}</div>
            <div style={{ fontSize: 10, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Faisceau d'indices</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              {ctx.evidence.map((e: any, i: number) => (
                <div key={i} style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.line}`, borderLeft: `3px solid ${amlSignalColor(e.signal)}` }}>
                  <div style={{ fontSize: 10, color: T.inkSoft }}>{e.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>{e.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 10, color: T.inkSoft, marginTop: 6 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: T.green }} />Atténuant</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: T.red }} />Aggravant</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: T.inkSoft }} />Neutre</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 10, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Décision</div>
              {AML_ACTIONS.map(act => {
                const suggested = act.id === ctx.suggestedAction;
                return (
                  <button key={act.id} onClick={() => decide(selAlert, act.id)} style={{ width: "100%", marginBottom: 7, padding: "9px 11px", borderRadius: 9, border: `1.5px solid ${suggested ? amlActionColor(act.id) : T.line}`, background: suggested ? amlActionColor(act.id) + "12" : T.surface, color: amlActionColor(act.id), fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, textAlign: "left" }}>
                    <span>{act.icon}</span>
                    <span style={{ flex: 1 }}>{act.label}</span>
                    {suggested && <span style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: 0.5, padding: "2px 5px", borderRadius: 4, background: amlActionColor(act.id), color: "#fff" }}>IA</span>}
                  </button>
                );
              })}
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 10, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Journal de décision (audit)</div>
              {decisions.length === 0 && <div style={{ fontSize: 11.5, color: T.inkSoft, fontStyle: "italic" }}>Aucune décision enregistrée.</div>}
              {decisions.map((d: any, i: number) => (
                <div key={i} style={{ fontSize: 11, color: T.inkMid, padding: "7px 0", borderBottom: i < decisions.length - 1 ? `1px solid ${T.lineSoft}` : "none" }}>
                  <div style={{ fontWeight: 700, color: T.ink }}>{d.label}</div>
                  <div style={{ fontSize: 10, color: T.inkSoft }}>{d.by} · {d.at}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
  // ---- SCENARIOS VIEW ----
  if (view === "scenarios") {
    return (
      <div>
        {Header}
        {Tabs}
        <div style={{ background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 2 }}>⚗ Bibliothèque de scénarios — {AML_SCENARIOS.filter(x => x.on).length}/{AML_SCENARIOS.length} actifs</div>
          <div style={{ fontSize: 10.5, color: T.inkSoft, marginBottom: 12 }}>Correspondent banking, white collar, pays à risque, structuring, layering — mêmes scénarios que le paramétrage Admin → Scoring, activation tracée.</div>
          {AML_SCENARIOS.map(sc => (
            <div key={sc.code} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid " + T.lineSoft, background: sc.on ? T.cream : T.surface, marginBottom: 8, opacity: sc.on ? 1 : 0.6 }}>
              <div style={{ display: "flex", gap: 9, alignItems: "center", marginBottom: 4 }}>
                <button onClick={() => { sc.on = !sc.on; pushParamAudit("Compliance Officer", "Scénario AML " + sc.code + " — " + (sc.on ? "activé" : "désactivé")); setState((prev: any) => { const ns: any = {}; Object.keys(prev).forEach(k => ns[k] = prev[k]); return ns; }); }} style={{ width: 34, height: 19, borderRadius: 10, border: "none", cursor: "pointer", background: sc.on ? T.olive600 : T.line, position: "relative", flexShrink: 0 }}>
                  <span style={{ position: "absolute", top: 2, left: sc.on ? 17 : 2, width: 15, height: 15, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
                </button>
                <span style={{ fontFamily: "monospace", fontSize: 9.5, fontWeight: 800, color: T.violet, flexShrink: 0 }}>{sc.code}</span>
                <span style={{ fontSize: 9, fontWeight: 800, color: T.olive700, background: T.oliveSoft, padding: "2px 9px", borderRadius: 8, flexShrink: 0 }}>{sc.cat || "Typologie"}</span>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: T.ink, flex: 1 }}>{sc.name}</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: (sc.hits || 0) > 4 ? T.red : T.amber }}>{sc.hits || 0} hit(s) / 90 j</span>
              </div>
              <div style={{ fontSize: 10.5, color: T.inkMid, marginBottom: 3 }}>{sc.logic}</div>
              <div style={{ fontSize: 9.5, fontFamily: "monospace", color: T.inkSoft }}>Seuil : {sc.threshold} {sc.unit}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  // ---- DASHBOARD VIEW ----
  if (view === "dashboard") {
    const total = AML_ALERTS.length;
    const bySanctions = AML_ALERTS.filter(a => a.alertType === "SANCTIONS").length;
    const byPep = AML_ALERTS.filter(a => a.alertType === "PEP").length;
    const byMedia = AML_ALERTS.filter(a => a.alertType === "ADVERSE_MEDIA").length;
    const likelyFP = AML_ALERTS.filter(a => aiContextualizeAlert(a).suggestedAction === "CLEAR").length;
    const fpRate = Math.round(likelyFP / total * 100);
    return (
      <div>
        {Header}
        {Tabs}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
          {[
            { label: "Alertes ouvertes", value: openCount, color: T.blue },
            { label: "Temps moyen / alerte", value: "9 min", color: T.green, sub: "vs 45 min avant" },
            { label: "Faux positifs (IA)", value: fpRate + "%", color: T.amber, sub: likelyFP + " auto-clôturables" },
            { label: "Escaladées", value: escalatedCount, color: T.red },
          ].map((k: any) => (
            <div key={k.label} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: k.color, fontFamily: "monospace" }}>{k.value}</div>
              <div style={{ fontSize: 10, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>{k.label}</div>
              {k.sub && <div style={{ fontSize: 10, color: T.inkSoft, marginTop: 2 }}>{k.sub}</div>}
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.ink, marginBottom: 14 }}>Répartition par type d'alerte</div>
            {([["Sanctions", bySanctions, T.red], ["PEP", byPep, T.violet], ["Presse négative", byMedia, T.amber]] as [string, number, string][]).map(([lab, val, col]) => (
              <div key={lab} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: T.inkMid }}>{lab}</span>
                  <span style={{ color: col, fontWeight: 700 }}>{val}</span>
                </div>
                <div style={{ height: 6, background: T.lineSoft, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: (total ? Math.round(val / total * 100) : 0) + "%", background: col, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: T.violetSoft, border: `1px solid ${T.violet}30`, borderRadius: 14, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 15 }}>✨</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.ink }}>Insight IA</span>
            </div>
            <div style={{ fontSize: 12.5, color: T.inkMid, lineHeight: 1.65 }}>
              Sur <strong>{total} alertes</strong> en file, l'IA estime <strong>{likelyFP}</strong> comme faux positifs probables ({fpRate}%) — clôturables avec justification documentée en un clic. Les <strong>{escalatedCount + AML_ALERTS.filter(a => aiContextualizeAlert(a).suggestedAction === "ESCALATE").length}</strong> cas à escalader concentrent PEP et juridictions à risque. À 9 min/alerte contre 45 min, le backlog théorique passe de <strong>{Math.round(total * 45 / 60)}h</strong> à <strong>{Math.round(total * 9 / 60)}h</strong>.
            </div>
          </div>
        </div>
      </div>
    );
  }
  // ---- INBOX VIEW (default) ----
  return (
    <div>
      {Header}
      {Tabs}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {([["all", "Toutes"], ["NEW", "Nouvelles"], ["CLEARED", "Clôturées"], ["ESCALATED", "Escaladées"]] as [string, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setFStatus(id)} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${fStatus === id ? T.olive600 : T.line}`, background: fStatus === id ? T.oliveSoft : T.surface, color: fStatus === id ? T.olive700 : T.inkMid, fontSize: 12, fontWeight: fStatus === id ? 700 : 500, cursor: "pointer" }}>{label}</button>
        ))}
        <div style={{ width: 1, background: T.line, margin: "0 4px" }} />
        {([["all", "Tous types"], ["SANCTIONS", "Sanctions"], ["PEP", "PEP"], ["ADVERSE_MEDIA", "Presse"]] as [string, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setFType(id)} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${fType === id ? T.olive600 : T.line}`, background: fType === id ? T.oliveSoft : T.surface, color: fType === id ? T.olive700 : T.inkMid, fontSize: 12, fontWeight: fType === id ? 700 : 500, cursor: "pointer" }}>{label}</button>
        ))}
        <div style={{ marginLeft: "auto", fontSize: 12, color: T.inkSoft, alignSelf: "center" }}>{alerts.length} alerte(s)</div>
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: T.lineSoft }}>{["Client", "Type", "Source", "Match", "Risque IA", "Pourquoi signalé", "Âge", "Statut"].map(h => (<th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 10, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>))}</tr>
          </thead>
          <tbody>
            {alerts.map(a => {
              const ctx = aiContextualizeAlert(a);
              const [tl, tc, tbg] = amlTypeStyle(a.alertType);
              const [sl, sc, sbg] = amlStatusStyle(getStatus(a));
              return (
                <tr key={a.id} onClick={() => { setSelId(a.id); setView("case"); }} style={{ borderBottom: `1px solid ${T.lineSoft}`, cursor: "pointer" }}>
                  <td style={{ padding: "11px 12px" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>{a.clientName}</div>
                    <div style={{ fontSize: 10.5, color: T.inkSoft }}>{a.kycCode}</div>
                  </td>
                  <td style={{ padding: "11px 12px" }}><Badge text={tl} color={tc} bg={tbg} /></td>
                  <td style={{ padding: "11px 12px", fontSize: 11, color: T.inkMid, maxWidth: 150 }}>{a.source}</td>
                  <td style={{ padding: "11px 12px", fontSize: 12, color: T.inkMid, fontFamily: "monospace" }}>{a.matchConfidence}%</td>
                  <td style={{ padding: "11px 12px" }}><span style={{ fontSize: 12, fontWeight: 800, fontFamily: "monospace", color: ctx.aiRiskScore >= 60 ? T.red : ctx.aiRiskScore <= 20 ? T.green : T.amber }}>{ctx.aiRiskScore}</span></td>
                  <td style={{ padding: "11px 12px", fontSize: 11, color: T.inkMid, maxWidth: 230 }}>{ctx.verdict}</td>
                  <td style={{ padding: "11px 12px", fontSize: 11, color: T.inkSoft }}>{a.ageHours}h</td>
                  <td style={{ padding: "11px 12px" }}><Badge text={sl} color={sc} bg={sbg} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
