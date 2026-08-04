import React, { useState } from "react";
import { T } from "./tokens";
import { Badge, StatsToggle } from "./components";
import CLIENTS from "../fixtures/CLIENTS.json";
import TASKS_DATA from "../fixtures/TASKS_DATA.json";
import TASK_TYPE_LABELS from "../fixtures/TASK_TYPE_LABELS.json";
import TASK_ASSIGNEES from "../fixtures/TASK_ASSIGNEES.json";
import { FilterBar } from "../components/FilterBar";

// Source : docs/reference/olive-demo.html 42503–42656. Filtres statut/priorité portés sur FilterBar
// (R404, R-FB.1 ; statut allValue="OPEN" car le défaut métier ≠ ALL) ; « Mes tâches » reste un scope.
export function TasksScreen({ user }: { user?: any }) {
  const TODAY = "2026-06-29";
  const [rows, setRows] = useState<any[]>(() => (TASKS_DATA as any[]).map(r => ({ ...r })));
  const [view, setView] = useState("all"); // all | mine
  const [stFilter, setStFilter] = useState("OPEN"); // OPEN | ALL | DONE
  const [priFilter, setPriFilter] = useState("ALL");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<any>({ title: "", type: "KYC_COMPLETE", clientId: (CLIENTS as any[])[0].id, assigneeId: user?.id || "USR-001", priority: "MEDIUM", due: "2026-07-15" });
  const aMap: any = (TASK_ASSIGNEES as any[]).reduce((m: any, a: any) => { m[a.id] = a; return m; }, {});
  const myId = user?.id;
  const priColor = (p: string): any => p === "CRITICAL" ? { c: T.red, b: T.redSoft } : p === "HIGH" ? { c: T.amber, b: T.amberSoft } : p === "MEDIUM" ? { c: T.blue, b: T.blueSoft } : { c: T.inkSoft, b: T.lineSoft };
  const priLabel = (p: string) => ({ CRITICAL: "Critique", HIGH: "Haute", MEDIUM: "Moyenne", LOW: "Basse" } as any)[p] || p;
  const stMeta = (s: string): any => ({ TODO: { c: T.inkSoft, b: T.lineSoft, l: "À faire" }, IN_PROGRESS: { c: T.amber, b: T.amberSoft, l: "En cours" }, WAITING: { c: T.blue, b: T.blueSoft, l: "En attente" }, DONE: { c: T.leaf, b: T.greenSoft, l: "Terminé" } } as any)[s] || { c: T.inkSoft, b: T.lineSoft, l: s };
  const overdue = (r: any) => r.status !== "DONE" && r.due < TODAY;
  const dueToday = (r: any) => r.status !== "DONE" && r.due === TODAY;
  const priRank: any = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  // périmètre + filtres
  const scope = view === "mine" ? rows.filter(r => r.assigneeId === myId) : rows;
  const kTotal = scope.filter(r => r.status !== "DONE").length;
  const kOver = scope.filter(overdue).length;
  const kToday = scope.filter(dueToday).length;
  const kDone = scope.filter(r => r.status === "DONE").length;
  const list = scope.filter(r => {
    if (stFilter === "OPEN" && r.status === "DONE") return false;
    if (stFilter === "DONE" && r.status !== "DONE") return false;
    if (priFilter !== "ALL" && r.priority !== priFilter) return false;
    return true;
  }).sort((a, b) => {
    if ((a.status === "DONE") !== (b.status === "DONE")) return a.status === "DONE" ? 1 : -1;
    if (overdue(a) !== overdue(b)) return overdue(a) ? -1 : 1;
    if (a.due !== b.due) return a.due < b.due ? -1 : 1;
    return priRank[a.priority] - priRank[b.priority];
  });
  const setStatus = (id: string, s: string) => setRows(rows.map(r => r.id === id ? { ...r, status: s } : r));
  const toggleDone = (id: string) => setRows(rows.map(r => r.id === id ? { ...r, status: r.status === "DONE" ? "TODO" : "DONE" } : r));
  const reassign = (id: string, aid: string) => setRows(rows.map(r => r.id === id ? { ...r, assigneeId: aid } : r));
  const createTask = () => {
    const cli = (CLIENTS as any[]).find(c => c.id === form.clientId);
    const row = { id: "TSK-2026-" + String(1000 + rows.length + 1).slice(1), title: form.title || (TASK_TYPE_LABELS as any)[form.type], type: form.type, clientId: cli.id, clientName: cli.name, assigneeId: form.assigneeId, priority: form.priority, status: "TODO", due: form.due, source: "manual", note: "" };
    setRows([row, ...rows]);
    setCreating(false);
    setForm({ title: "", type: "KYC_COMPLETE", clientId: (CLIENTS as any[])[0].id, assigneeId: user?.id || "USR-001", priority: "MEDIUM", due: "2026-07-15" });
  };
  const cell: any = { padding: "11px 14px", fontSize: 12.5, color: T.ink, borderBottom: `1px solid ${T.lineSoft}`, verticalAlign: "middle" };
  const th: any = { padding: "10px 14px", fontSize: 10.5, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, textAlign: "left", borderBottom: `1px solid ${T.line}` };
  const sel: any = { padding: "5px 8px", borderRadius: 7, border: `1px solid ${T.line}`, fontSize: 11.5, background: "#fff" };
  const inp: any = { width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 12.5, boxSizing: "border-box", background: "#fff" };
  const chip = (active: boolean, c: string): any => ({ padding: "5px 12px", borderRadius: 7, border: `1px solid ${active ? c : T.line}`, background: active ? c + "18" : "#fff", color: active ? c : T.inkSoft, fontSize: 11.5, fontWeight: active ? 700 : 500, cursor: "pointer" });
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16, gap: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.ink }}>Tâches ✓</div>
          <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 2 }}>File contextuelle — générée par les workflows (auto) ou créée manuellement.</div>
        </div>
        <button onClick={() => setCreating(!creating)} style={{ marginLeft: "auto", background: T.olive600, color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{creating ? "✕ Fermer" : "+ Nouvelle tâche"}</button>
      </div>
      <StatsToggle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
          {([["Ouvertes", kTotal, T.olive700], ["En retard", kOver, T.red], ["Échéance aujourd'hui", kToday, T.amber], ["Terminées", kDone, T.leaf]] as any[]).map(([l, v, c], i) => (
            <div key={i} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 600 }}>{l}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: c, marginTop: 4 }}>{v}</div>
            </div>
          ))}
        </div>
      </StatsToggle>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setView("all")} style={chip(view === "all", T.olive700)}>Toutes</button>
          <button onClick={() => setView("mine")} style={chip(view === "mine", T.olive700)}>Mes tâches</button>
        </div>
        <span style={{ width: 1, height: 18, background: T.line }} />
        <FilterBar
          filters={[
            { id: "statut", label: "Statut", value: stFilter, allValue: "OPEN", onChange: setStFilter,
              options: [["OPEN", "Ouvertes"], ["ALL", "Tout statut"], ["DONE", "Terminées"]] },
            { id: "priorite", label: "Priorité", value: priFilter, allValue: "ALL", onChange: setPriFilter,
              options: ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((p): [string, string] => [p, p === "ALL" ? "Toute priorité" : priLabel(p)]) },
          ]}
          shown={list.length}
          total={scope.length}
          onReset={() => { setStFilter("OPEN"); setPriFilter("ALL"); }}
        />
      </div>
      {creating && (
        <div style={{ background: T.oliveSoft, border: `1px solid ${T.sage}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.olive900, marginBottom: 12 }}>Créer une tâche</div>
          <label style={{ fontSize: 11, color: T.inkMid }}>Intitulé
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="ex. Relancer le client pour le justificatif SOF" style={inp} />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
            <label style={{ fontSize: 11, color: T.inkMid }}>Type
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={inp}>{Object.keys(TASK_TYPE_LABELS as any).map(k => <option key={k} value={k}>{(TASK_TYPE_LABELS as any)[k]}</option>)}</select>
            </label>
            <label style={{ fontSize: 11, color: T.inkMid }}>Client
              <select value={form.clientId} onChange={e => setForm({ ...form, clientId: e.target.value })} style={inp}>{(CLIENTS as any[]).slice(0, 40).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </label>
            <label style={{ fontSize: 11, color: T.inkMid }}>Assigné à
              <select value={form.assigneeId} onChange={e => setForm({ ...form, assigneeId: e.target.value })} style={inp}>{(TASK_ASSIGNEES as any[]).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
            </label>
            <label style={{ fontSize: 11, color: T.inkMid }}>Priorité
              <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={inp}>
                <option value="CRITICAL">Critique</option>
                <option value="HIGH">Haute</option>
                <option value="MEDIUM">Moyenne</option>
                <option value="LOW">Basse</option>
              </select>
            </label>
            <label style={{ fontSize: 11, color: T.inkMid }}>Échéance
              <input type="date" value={form.due} onChange={e => setForm({ ...form, due: e.target.value })} style={inp} />
            </label>
          </div>
          <button onClick={createTask} style={{ marginTop: 14, background: T.olive700, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Créer la tâche</button>
        </div>
      )}
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Priorité</th>
              <th style={th}>Tâche</th>
              <th style={th}>Client</th>
              <th style={th}>Échéance</th>
              <th style={th}>Assigné à</th>
              <th style={th}>Statut</th>
              <th style={th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {list.map(r => {
              const pc = priColor(r.priority);
              const sm = stMeta(r.status);
              const od = overdue(r);
              return (
                <tr key={r.id} style={r.status === "DONE" ? { opacity: 0.55 } : undefined}>
                  <td style={cell}><Badge text={priLabel(r.priority)} color={pc.c} bg={pc.b} /></td>
                  <td style={cell}>
                    <div style={{ fontWeight: 600, color: T.ink }}>{r.title}</div>
                    <div style={{ marginTop: 3, display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: T.inkSoft, background: T.lineSoft, padding: "1px 7px", borderRadius: 4 }}>{(TASK_TYPE_LABELS as any)[r.type] || r.type}</span>
                      {r.source === "auto" && <span style={{ fontSize: 9.5, color: T.blue }}>⚙ auto</span>}
                      {r.kycRef && <span style={{ fontSize: 10, color: T.inkSoft, fontFamily: "monospace" }}>{r.kycRef}</span>}
                    </div>
                  </td>
                  <td style={{ ...cell, fontWeight: 600 }}>{r.clientName}</td>
                  <td style={cell}><span style={{ color: od ? T.red : T.inkMid, fontWeight: od ? 700 : 500 }}>{r.due}{od && " ⚠"}</span></td>
                  <td style={cell}>
                    <select value={r.assigneeId} onChange={e => reassign(r.id, e.target.value)} style={{ ...sel, maxWidth: 150 }}>{(TASK_ASSIGNEES as any[]).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                  </td>
                  <td style={cell}>
                    <select value={r.status} onChange={e => setStatus(r.id, e.target.value)} style={{ ...sel, color: sm.c, fontWeight: 700 }}>
                      <option value="TODO">À faire</option>
                      <option value="IN_PROGRESS">En cours</option>
                      <option value="WAITING">En attente</option>
                      <option value="DONE">Terminé</option>
                    </select>
                  </td>
                  <td style={cell}>
                    <button onClick={() => toggleDone(r.id)} style={{ background: r.status === "DONE" ? T.lineSoft : T.greenSoft, color: r.status === "DONE" ? T.inkSoft : T.leaf, border: `1px solid ${r.status === "DONE" ? T.line : T.leaf + "33"}`, borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{r.status === "DONE" ? "Rouvrir" : "✓ Terminer"}</button>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={7} style={{ ...cell, textAlign: "center", color: T.inkSoft, padding: "28px" }}>Aucune tâche pour ce filtre.</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 10, lineHeight: 1.5 }}>Les tâches <b>⚙ auto</b> sont générées par les workflows (KYC, screening, COC, revues). Filtre <b>Mes tâches</b> = assignées à l'utilisateur connecté ({user?.name || "—"}).</div>
    </div>
  );
}
