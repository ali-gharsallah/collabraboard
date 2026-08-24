import React, { useState } from "react";
import { T } from "./tokens";
import CLIENTS from "../fixtures/CLIENTS.json";
import SCREEN_LABEL from "../fixtures/SCREEN_LABEL.json";
import {
  OFFBOARDING_CASES, OFFBOARDING_REASONS, KYCS_DATA,
  offCanInitiate, offHealthCheck, offChecklistFor, offApprovalChain, offStepsFor,
} from "./offboarding-support";

// CONSIGNÉ : pushParamAudit / wfEmit écrivent la piste d'audit / le bus d'événements (hors
// périmètre parité front) → no-op local, sans effet sur l'UI.
const pushParamAudit = (_actor: string, _msg: string) => {};
const wfEmit = (_evt: string, _a: any, _b: any) => {};

// Source : docs/reference/olive-demo.html 20662–20881 — porté verbatim.
export function OffboardingScreen({ user }: { user?: any; go?: any }) {
  const [tab, setTab] = useState("cases"); // cases | dashboard
  const [, bump] = useState(0);
  const re = function () { bump(function (x) { return x + 1; }); };
  const [selId, setSelId] = useState<string | null>((OFFBOARDING_CASES[0] || {}).id || null);
  const [createOpen, setCreateOpen] = useState(false);
  const [ncClientId, setNcClientId] = useState("");
  const [ncReason, setNcReason] = useState(OFFBOARDING_REASONS[0]);
  const allowedReasons = OFFBOARDING_REASONS.filter(function (r) { return offCanInitiate((user && user.role) || "", r); });
  const cases = OFFBOARDING_CASES;
  const sel = cases.find(function (o) { return o.id === selId; }) || cases[0] || null;
  const selClient = sel && (CLIENTS as any[]).find(function (c) { return c.id === sel.clientId; });
  const selKyc = selClient && (KYCS_DATA as any[]).filter(function (k) { return k.clientId === selClient.id; }).sort(function (a, b) { return (b.createdAt || "").localeCompare(a.createdAt || ""); })[0];
  const hc = selClient ? offHealthCheck(selClient, selKyc) : null;
  const checklist = selClient ? offChecklistFor(selClient) : [];
  const chain = selClient ? offApprovalChain(selClient.risk, sel && sel.reason) : [];
  const createCase = function () {
    const c = (CLIENTS as any[]).find(function (x) { return x.id === ncClientId; });
    if (!c || allowedReasons.indexOf(ncReason) < 0) return;
    const newId = "OFF-" + String(2000 + cases.length);
    const checklistArr = offChecklistFor(c).map(function () { return false; });
    cases.unshift({ id: newId, clientId: c.id, reason: ncReason, initiatedAt: "2026-07-10", initiatedBy: (user && user.name) || "—", checklistState: checklistArr, approvalIdx: 0, status: "EN_COURS" });
    pushParamAudit((user && user.name) || "RM", "Offboarding initié : " + c.name + " (" + ncReason + ")");
    wfEmit("PARAM_CHANGED", null, { subjectId: "OFFBOARDING/" + newId, actor: (user && user.name) || "RM", payload: { reason: ncReason, client: c.name } });
    setSelId(newId);
    setCreateOpen(false);
    re();
  };
  const toggleChecklistItem = function (idx: number) {
    if (!sel) return;
    sel.checklistState[idx] = !sel.checklistState[idx];
    pushParamAudit((user && user.name) || "RM", "Checklist offboarding " + sel.id + " — étape " + (idx + 1) + (sel.checklistState[idx] ? " cochée" : " décochée"));
    re();
  };
  const advanceApproval = function () {
    if (!sel) return;
    if (sel.approvalIdx < chain.length) {
      sel.approvalIdx++;
      wfEmit("TRANSITION_FIRED", null, { subjectId: sel.id, actor: (user && user.name) || "—", actorRole: (user && user.role) || "RM", payload: { step: chain[sel.approvalIdx - 1][1] } });
      pushParamAudit((user && user.name) || "—", "Offboarding " + sel.id + " — approbation " + chain[sel.approvalIdx - 1][1]);
      if (sel.approvalIdx >= chain.length) {
        sel.status = "ARCHIVE";
        pushParamAudit((user && user.name) || "—", "Offboarding " + sel.id + " — Relationship Closed");
      }
      re();
    }
  };
  const checklistDone = sel ? sel.checklistState : [];
  const approvalsDone = chain.map(function (_: any, i: number) { return sel && i < sel.approvalIdx; });
  const steps = sel ? offStepsFor(checklistDone, approvalsDone) : [];
  const globalPct = steps.length ? Math.round(steps.reduce(function (a, st) { return a + st.pct; }, 0) / steps.length) : 0;
  // -- Dashboard --
  const byReason: any = {};
  cases.forEach(function (o) { byReason[o.reason] = (byReason[o.reason] || 0) + 1; });
  const byRm: any = {};
  cases.forEach(function (o) { const c = (CLIENTS as any[]).find(function (x) { return x.id === o.clientId; }); const rm = (c && c.rm) || "—"; byRm[rm] = (byRm[rm] || 0) + 1; });
  const bySegment: any = {};
  cases.forEach(function (o) { const c = (CLIENTS as any[]).find(function (x) { return x.id === o.clientId; }); const sg = (c && c.segment) || "—"; bySegment[sg] = (bySegment[sg] || 0) + 1; });
  const byCountry: any = {};
  cases.forEach(function (o) { const c = (CLIENTS as any[]).find(function (x) { return x.id === o.clientId; }); const co = (c && c.country) || "—"; byCountry[co] = (byCountry[co] || 0) + 1; });
  const blockedCases = cases.filter(function (o) { const c = (CLIENTS as any[]).find(function (x) { return x.id === o.clientId; }); const k = c && (KYCS_DATA as any[]).filter(function (x) { return x.clientId === c.id; })[0]; return c && !offHealthCheck(c, k).canProceed; });
  const eddCases = cases.filter(function (o) { const c = (CLIENTS as any[]).find(function (x) { return x.id === o.clientId; }); return c && c.ddl === "EDD"; });
  const card: any = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 18 };
  const barRow = function (label: string, n: number, max: number, color: string) {
    return (
      <div key={label} style={{ marginBottom: 9 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: T.inkMid }}>{label}</span>
          <span style={{ color: color, fontWeight: 700 }}>{n}</span>
        </div>
        <div style={{ height: 6, background: T.lineSoft, borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: (n / max * 100) + "%", background: color, borderRadius: 3 }} />
        </div>
      </div>
    );
  };
  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, color: T.olive700, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>Intelligent Offboarding</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>{(SCREEN_LABEL as any).offboarding}</div>
          <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>Garantir qu'un client quitte la banque sans risque opérationnel, réglementaire ou juridique résiduel.</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <div style={{ display: "flex", gap: 4, background: T.cream, padding: 4, borderRadius: 10 }}>
            {([["cases", "Dossiers"], ["dashboard", "Dashboard"]] as any[]).map(function (tb) {
              return <button key={tb[0]} onClick={function () { setTab(tb[0]); }} style={{ padding: "7px 14px", borderRadius: 7, border: "none", cursor: "pointer", background: tab === tb[0] ? T.olive600 : "transparent", color: tab === tb[0] ? "#fff" : T.inkMid, fontSize: 12, fontWeight: tab === tb[0] ? 700 : 500 }}>{tb[1]}</button>;
            })}
          </div>
          <button onClick={function () { setNcReason((allowedReasons[0]) || OFFBOARDING_REASONS[0]); setCreateOpen(true); }} style={{ padding: "9px 16px", borderRadius: 9, border: "none", background: T.olive600, color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>＋ Nouvel offboarding</button>
        </div>
      </div>
      {createOpen && (
        <div onClick={function () { setCreateOpen(false); }} style={{ position: "fixed", inset: 0, background: "rgba(20,26,14,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 340, padding: 20 }}>
          <div onClick={function (e) { e.stopPropagation(); }} style={{ background: T.surface, borderRadius: 16, width: 460, maxWidth: "94vw", padding: 22 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.ink, marginBottom: 4 }}>🚪 Nouvel offboarding</div>
            <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 14 }}>L'IA identifie le scénario et déclenche le Compliance Health Check.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <select value={ncClientId} onChange={function (e) { setNcClientId(e.target.value); }} style={{ padding: "9px 12px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 12.5 }}>
                <option value="">Sélectionner un client…</option>
                {(CLIENTS as any[]).slice(0, 60).map(function (c) { return <option key={c.id} value={c.id}>{c.name} — {c.country}</option>; })}
              </select>
              <select value={ncReason} onChange={function (e) { setNcReason(e.target.value); }} style={{ padding: "9px 12px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 12.5 }}>
                {allowedReasons.map(function (r) { return <option key={r} value={r}>{r}</option>; })}
              </select>
              {allowedReasons.length === 0 && <div style={{ fontSize: 10.5, color: T.red }}>Votre rôle ({(user && user.role) || "—"}) ne peut initier aucun motif d'offboarding paramétré — contactez Compliance.</div>}
              {allowedReasons.length > 0 && <div style={{ fontSize: 9.5, color: T.inkSoft }}>Motifs limités à votre rôle — paramétrable dans Admin → Offboarding.</div>}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={function () { setCreateOpen(false); }} style={{ padding: "9px 16px", borderRadius: 9, border: "1px solid " + T.line, background: T.surface, color: T.inkMid, fontSize: 12.5, cursor: "pointer" }}>Annuler</button>
              <button onClick={createCase} disabled={!ncClientId} style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: ncClientId ? T.olive600 : T.line, color: "#fff", fontSize: 12.5, fontWeight: 800, cursor: ncClientId ? "pointer" : "not-allowed" }}>Initier →</button>
            </div>
          </div>
        </div>
      )}
      {tab === "cases" && (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16 }}>
          <div style={{ background: T.surface, borderRadius: 14, border: "1px solid " + T.line, overflow: "hidden", maxHeight: 640, overflowY: "auto" }}>
            {cases.map(function (o) {
              const c = (CLIENTS as any[]).find(function (x) { return x.id === o.clientId; });
              const isSel = sel && sel.id === o.id;
              const hc2 = c ? offHealthCheck(c, (KYCS_DATA as any[]).filter(function (k) { return k.clientId === c.id; })[0]) : null;
              return (
                <div key={o.id} onClick={function () { setSelId(o.id); }} style={{ padding: "12px 14px", borderBottom: "1px solid " + T.lineSoft, cursor: "pointer", background: isSel ? T.oliveSoft : (o.status === "ARCHIVE" ? T.greenSoft : "transparent") }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>{c ? c.name : o.clientId}</span>
                    {o.status === "ARCHIVE"
                      ? <span style={{ fontSize: 9, fontWeight: 800, color: T.green, background: T.greenSoft, padding: "2px 6px", borderRadius: 5 }}>ARCHIVÉ</span>
                      : (hc2 && !hc2.canProceed ? <span style={{ fontSize: 9, fontWeight: 800, color: T.red, background: T.redSoft, padding: "2px 6px", borderRadius: 5 }}>BLOQUÉ</span>
                        : <span style={{ fontSize: 9, fontWeight: 800, color: T.amber, background: T.amberSoft, padding: "2px 6px", borderRadius: 5 }}>EN COURS</span>)}
                  </div>
                  <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 2 }}>{o.reason} · {o.id}</div>
                </div>
              );
            })}
          </div>
          {sel && selClient ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, marginBottom: 2 }}>{selClient.countryFlag} {selClient.name}</div>
                <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 12 }}>{sel.reason} · initié {sel.initiatedAt} par {sel.initiatedBy} · {selClient.typeLabel}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 13 }}>✦</span>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: T.ink, textTransform: "uppercase", letterSpacing: 0.4 }}>AI Exit Assessment — Compliance Health Check</span>
                </div>
                <div style={{ padding: "12px 14px", borderRadius: 10, background: hc!.canProceed ? T.greenSoft : T.redSoft, border: "1px solid " + (hc!.canProceed ? T.green : T.red) + "44", fontSize: 12, color: T.inkMid, lineHeight: 1.6, marginBottom: 14 }}>{hc!.narrative}</div>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: T.ink, marginBottom: 8 }}>☑ Checklist intelligente ({selClient.type === "PP" ? "personne physique" : "société"})</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 14px", marginBottom: 14 }}>
                  {checklist.map(function (item, idx) {
                    const done = sel.checklistState[idx];
                    return (
                      <div key={idx} onClick={function () { toggleChecklistItem(idx); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", cursor: "pointer" }}>
                        <span style={{ width: 16, height: 16, borderRadius: 5, border: "1.5px solid " + (done ? T.green : T.line), background: done ? T.greenSoft : T.surface, color: T.green, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{done ? "✓" : ""}</span>
                        <span style={{ fontSize: 11.5, color: done ? T.inkSoft : T.ink, textDecoration: done ? "line-through" : "none" }}>{item}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: T.ink, marginBottom: 8 }}>⌘ Workflow d'approbation — quatre yeux (risque {selClient.risk})</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                  {chain.map(function (step, i) {
                    const done = i < sel.approvalIdx;
                    const current = i === sel.approvalIdx;
                    return (
                      <React.Fragment key={step[0]}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 20, background: done ? T.greenSoft : current ? T.amberSoft : T.lineSoft, color: done ? T.green : current ? T.amber : T.inkSoft }}>{done ? "✓ " : current ? "● " : ""}{step[1]}</span>
                        {i < chain.length - 1 && <span style={{ color: T.inkSoft, fontSize: 11 }}>→</span>}
                      </React.Fragment>
                    );
                  })}
                </div>
                {sel.status !== "ARCHIVE" && <button onClick={advanceApproval} disabled={!hc!.canProceed} title={!hc!.canProceed ? "Le Compliance Health Check bloque la progression" : ""} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: hc!.canProceed ? T.olive600 : T.line, color: hc!.canProceed ? "#fff" : T.inkSoft, fontSize: 12, fontWeight: 700, cursor: hc!.canProceed ? "pointer" : "not-allowed" }}>{sel.approvalIdx < chain.length - 1 ? ("Valider " + chain[sel.approvalIdx][1] + " →") : "Finaliser — Relationship Closed →"}</button>}
                {sel.status === "ARCHIVE" && <div style={{ fontSize: 12, fontWeight: 800, color: T.green }}>✓ Relationship Closed</div>}
              </div>
              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 14 }}>🪪</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: T.ink }}>Digital Twin — {sel.status === "ARCHIVE" ? "Client Archivé" : "Client Actif → Archivé"}</span>
                  <span style={{ marginLeft: "auto", fontSize: 18, fontWeight: 800, color: T.olive700 }}>{globalPct}%</span>
                </div>
                {steps.map(function (st) {
                  return (
                    <div key={st.label} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 3 }}>
                        <span style={{ color: T.inkMid }}>{st.label}</span>
                        <span style={{ color: st.pct === 100 ? T.green : T.amber, fontWeight: 700 }}>{st.pct}%</span>
                      </div>
                      <div style={{ height: 6, background: T.lineSoft, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: st.pct + "%", background: st.pct === 100 ? T.green : T.amber, borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : <div style={card}>Sélectionnez un dossier.</div>}
        </div>
      )}
      {tab === "dashboard" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div style={card}>
              <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 10 }}>Motifs de sortie</div>
              {Object.keys(byReason).map(function (k) { return barRow(k, byReason[k], Math.max(1, cases.length), T.olive600); })}
            </div>
            <div style={card}>
              <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 10 }}>Départs par RM</div>
              {Object.keys(byRm).map(function (k) { return barRow(k, byRm[k], Math.max(1, cases.length), T.blue); })}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div style={card}>
              <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 10 }}>Départs par segment</div>
              {Object.keys(bySegment).map(function (k) { return barRow(k, bySegment[k], Math.max(1, cases.length), T.gold); })}
            </div>
            <div style={card}>
              <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 10 }}>Départs par pays</div>
              {Object.keys(byCountry).map(function (k) { return barRow(k, byCountry[k], Math.max(1, cases.length), T.leaf); })}
            </div>
          </div>
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 14 }}>✦</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: T.ink }}>AI Exit Analytics — tendances observées</span>
            </div>
            <div style={{ fontSize: 10.5, color: T.inkSoft, marginBottom: 10, lineHeight: 1.5 }}>Calculé sur l'échantillon d'offboarding en cours ({cases.length} dossiers) — les corrélations gagnent en fiabilité statistique à l'échelle réelle du portefeuille.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(function () {
                const insights: string[] = [];
                const hnwiN = cases.filter(function (o) { const c = (CLIENTS as any[]).find(function (x) { return x.id === o.clientId; }); return c && (c.segment === "HNWI" || c.segment === "UHNWI"); }).length;
                if (hnwiN) insights.push(Math.round(hnwiN / cases.length * 100) + "% des départs concernent des clients HNWI/UHNWI.");
                if (eddCases.length) insights.push(eddCases.length + " offboarding(s) sur des clients EDD — diligence de sortie renforcée à anticiper (délai de clôture généralement supérieur).");
                if (blockedCases.length) insights.push(Math.round(blockedCases.length / cases.length * 100) + "% des dossiers en cours sont bloqués par le Compliance Health Check — principal frein : alertes AML ou reviews non clôturées.");
                const amlReason = cases.filter(function (o) { return o.reason === "Risque AML élevé" || o.reason === "Sanctions"; }).length;
                if (amlReason) insights.push(amlReason + " dossier(s) motivé(s) par un risque AML/sanctions — segment à surveiller en amont via le scoring plutôt qu'en sortie.");
                if (insights.length === 0) insights.push("Pas assez de dossiers pour dégager une tendance statistique fiable.");
                return insights.map(function (t, i) { return <div key={i} style={{ fontSize: 11.5, color: T.inkMid, paddingLeft: 14, position: "relative" }}><span style={{ position: "absolute", left: 0 }}>•</span>{t}</div>; });
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
