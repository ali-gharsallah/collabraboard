import React, { useState } from "react";
import { T } from "./tokens";
import { KpiCard, StatsToggle } from "./components";
import { clientById } from "./components-data";
import ACCOUNT_REVIEWS_DATA from "../fixtures/ACCOUNT_REVIEWS_DATA.json";
import CLIENTS from "../fixtures/CLIENTS.json";
import DS_STATS from "../fixtures/DS_STATS.json";
import { FilterBar } from "../components/FilterBar";

// AccountReviewScreen — Filtres statut/déclencheur + recherche portés sur FilterBar (R404, R-FB.1).
// PORT de docs/reference/olive-demo.html 42173–42340. Câblé sur
// ACCOUNT_REVIEWS_DATA (113). StatsToggle → null (B.6). Détail (AccountReviewDetailScreen) consigné.
const clients = CLIENTS as any[];
const AR_STATUS_CFG: Record<string, [string, string, string]> = {
  COMPLETED: [T.green, T.greenSoft, "Complétée"], IN_PROGRESS: [T.gold, T.amberSoft, "En cours"],
  PENDING: [T.amber, T.amberSoft, "En attente"], OVERDUE: [T.red, T.redSoft, "En retard"],
};
const PAGE_SIZE = 20;
const clientGroupMembers = (cid: string) => { const c = clients.find(x => x.id === cid); if (!c?.uboName) return []; return clients.filter(x => x.uboName === c.uboName); };

export function AccountReviewScreen({ user }: { user?: any }) {
  const [rows, setRows] = useState<any[]>(() => (ACCOUNT_REVIEWS_DATA as any[]).map(r => ({ ...r })));
  const [locks, setLocks] = useState<Record<string, any>>({});
  const [selArId, setSelArId] = useState<string | null>(null);
  const [selIds, setSelIds] = useState<string[]>([]);
  const [grpOutcome, setGrpOutcome] = useState("Risk unchanged");
  const [trigOpen, setTrigOpen] = useState(false);
  const [trigClientId, setTrigClientId] = useState("");
  const [trigReason, setTrigReason] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterTrigger, setFilterTrigger] = useState("ALL");
  const [page, setPage] = useState(0);

  const toggleSel = (id: string) => setSelIds(x => x.indexOf(id) >= 0 ? x.filter(y => y !== id) : x.concat([id]));
  const applyGroup = () => {
    if (!selIds.length) return;
    setRows(rs => rs.map(r => selIds.indexOf(r.id) >= 0 && !(locks[r.id] && locks[r.id].by !== user?.name)
      ? { ...r, status: "COMPLETED", outcome: grpOutcome, nextReviewDate: "2027-07-04", reviewer: (user?.name || "—") + " (revue groupée)" } : r));
    setSelIds([]);
  };
  const triggerReview = () => {
    const c = clientById[trigClientId]; if (!c) return;
    const nr = { id: "AR-" + trigClientId + "-N" + (rows.length), clientId: trigClientId, kycRef: (c.kycCodes || [])[0] || "—", trigger: trigReason || "Revue manuelle", status: "PENDING", reviewDate: "2026-07-04", nextReviewDate: null, reviewer: user?.name || "—", rm: c.rm, outcome: null };
    setRows(rs => [nr, ...rs]); setTrigOpen(false); setTrigClientId(""); setTrigReason("");
  };

  const triggers = [...new Set(rows.map(r => r.trigger))].sort();
  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    const ms = !q || r.id.toLowerCase().includes(q) || r.clientId.toLowerCase().includes(q) || (clientById[r.clientId]?.name || "").toLowerCase().includes(q) || (r.reviewer || "").toLowerCase().includes(q);
    return ms && (filterStatus === "ALL" || r.status === filterStatus) && (filterTrigger === "ALL" || r.trigger === filterTrigger);
  });
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const kOver = rows.filter(r => r.status === "OVERDUE").length;
  const kProg = rows.filter(r => r.status === "IN_PROGRESS").length;
  const kDone = rows.filter(r => r.status === "COMPLETED").length;

  const th = { padding: "9px 14px", textAlign: "left" as const, fontSize: 10, color: T.inkSoft, textTransform: "uppercase" as const, letterSpacing: 0.5, whiteSpace: "nowrap" as const };

  if (selArId) {
    const ar = rows.find(r => r.id === selArId);
    return <div>
      <button onClick={() => setSelArId(null)} style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${T.line}`, background: T.surface, color: T.inkMid, fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: 14 }}>← Retour à la liste</button>
      <div style={{ background: T.surface, borderRadius: 14, padding: 40, border: `1px solid ${T.line}`, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.25 }}>🌿</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, marginBottom: 6 }}>Account Review — {clientById[ar?.clientId]?.name || ar?.clientId} · {ar?.id}</div>
        <div style={{ fontSize: 13, color: T.inkSoft, maxWidth: 460, margin: "0 auto", lineHeight: 1.6 }}>Détail de la revue (AccountReviewDetailScreen : checklist, workflow, documents, commentaires, décision) — port de parité consigné pour une prochaine session. Déclencheur : {ar?.trigger} · Reviewer : {ar?.reviewer}.</div>
      </div>
    </div>;
  }

  return (
    <div>
      <StatsToggle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 18 }}>
          <KpiCard label="Révisions totales" value={rows.length} sub={`${(DS_STATS as any).totalClients} clients`} color={T.olive600} icon="↻" />
          <KpiCard label="En retard" value={kOver} sub="action requise" color={T.red} icon="⚠" />
          <KpiCard label="En cours" value={kProg} sub="en traitement" color={T.amber} icon="⏳" />
          <KpiCard label="Complétées" value={kDone} sub={`${Math.round(kDone / rows.length * 100)}% du total`} color={T.green} icon="✓" />
        </div>
      </StatsToggle>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <button onClick={() => setTrigOpen(true)} style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: T.olive600, color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>＋ Déclencher une revue</button>
      </div>

      {kOver > 0 && <div style={{ background: T.redSoft, border: `1px solid ${T.red}33`, borderRadius: 10, padding: "10px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 16 }}>🚨</span>
        <div style={{ fontSize: 12, color: T.red, fontWeight: 600 }}>{kOver} révision(s) en retard — action Compliance requise sous 30 jours (FINMA)</div>
      </div>}

      <FilterBar
        search={{ value: search, onChange: v => { setSearch(v); setPage(0); }, placeholder: "ID, client, reviewer…" }}
        filters={[
          { id: "statut", label: "Statut", value: filterStatus, allValue: "ALL", onChange: v => { setFilterStatus(v); setPage(0); },
            options: [["ALL", "Tous"], ["OVERDUE", "En retard"], ["IN_PROGRESS", "En cours"], ["PENDING", "En attente"], ["COMPLETED", "Complétée"]] },
          { id: "declencheur", label: "Déclencheur", value: filterTrigger, allValue: "ALL", onChange: v => { setFilterTrigger(v); setPage(0); },
            options: ([["ALL", "Tous les déclencheurs"]] as [string, string][]).concat(triggers.map(t => [t, t] as [string, string])) },
        ]}
        shown={filtered.length}
        total={rows.length}
        onReset={() => { setFilterStatus("ALL"); setFilterTrigger("ALL"); setSearch(""); setPage(0); }}
      />

      {selIds.length > 0 && <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: T.oliveSoft, border: `1px solid ${T.olive600}66`, borderRadius: 12, padding: "10px 14px", marginBottom: 12 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: T.olive700 }}>☑ {selIds.length} review(s) sélectionnée(s)</span>
        <select value={grpOutcome} onChange={e => setGrpOutcome(e.target.value)} style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 12 }}>{["Risk unchanged", "Risk downgraded", "Risk upgraded", "EDD triggered", "Escalation required"].map(o => <option key={o} value={o}>{o}</option>)}</select>
        <button onClick={applyGroup} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: T.olive600, color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>Clôturer en revue groupée →</button>
        <button onClick={() => setSelIds([])} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${T.line}`, background: T.surface, color: T.inkMid, fontSize: 12, cursor: "pointer" }}>Annuler</button>
        <span style={{ fontSize: 10.5, color: T.inkSoft }}>Les reviews verrouillées par un autre intervenant sont ignorées.</span>
      </div>}

      <div style={{ background: T.surface, borderRadius: 14, border: `1px solid ${T.line}`, overflow: "hidden" }}>
        <div style={{ padding: "12px 20px", borderBottom: `1px solid ${T.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{filtered.length} révision(s)</span>
          <span style={{ fontSize: 11, color: T.inkSoft }}>Délai max : 30j (FINMA Circ. 2016/7)</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
            <thead><tr style={{ background: T.lineSoft }}>{["☑", "ID Révision", "Client", "Déclencheur", "Statut", "Date", "Outcome", "Reviewer", "🔒", "KYC Réf.", ""].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>{paged.map(r => {
              const cfg = AR_STATUS_CFG[r.status] || [T.inkSoft, T.lineSoft, "—"];
              const client = clientById[r.clientId]; const lk = locks[r.id];
              return <tr key={r.id} onClick={() => setSelArId(r.id)} style={{ borderBottom: `1px solid ${T.lineSoft}`, cursor: "pointer" }} onMouseEnter={e => (e.currentTarget.style.background = T.oliveSoft)} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <td style={{ padding: "11px 14px" }} onClick={e => e.stopPropagation()}><input type="checkbox" checked={selIds.indexOf(r.id) >= 0} disabled={r.status === "COMPLETED"} onChange={() => toggleSel(r.id)} style={{ width: 15, height: 15, accentColor: "#5A7D3A", cursor: "pointer" }} /></td>
                <td style={{ padding: "11px 14px", fontFamily: "monospace", fontSize: 10, color: T.olive700, whiteSpace: "nowrap" }}>{r.id}</td>
                <td style={{ padding: "11px 14px", fontSize: 12, fontWeight: 600, color: T.ink, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{client?.name || r.clientId}</td>
                <td style={{ padding: "11px 14px", fontSize: 11, color: T.inkMid, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.trigger}</td>
                <td style={{ padding: "11px 14px" }}><span style={{ fontSize: 10, fontWeight: 700, color: cfg[0], background: cfg[1], padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>{cfg[2]}</span></td>
                <td style={{ padding: "11px 14px", fontSize: 11, color: T.inkSoft, whiteSpace: "nowrap" }}>{r.reviewDate}</td>
                <td style={{ padding: "11px 14px", fontSize: 11, color: r.outcome ? T.inkMid : T.inkSoft, fontStyle: r.outcome ? "normal" : "italic", whiteSpace: "nowrap", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis" }}>{r.outcome || "—"}</td>
                <td style={{ padding: "11px 14px", fontSize: 11, color: T.inkMid, whiteSpace: "nowrap" }}>{(r.reviewer || "").split(" ").slice(-2).join(" ")}</td>
                <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>{
                  lk ? <button onClick={() => setLocks(m => { const n = { ...m }; delete n[r.id]; return n; })} title={`Verrouillé par ${lk.by}`} style={{ padding: "4px 9px", borderRadius: 6, border: `1px solid ${T.olive600}`, background: T.oliveSoft, color: T.olive700, fontSize: 10, fontWeight: 800, cursor: "pointer" }}>🔒 {lk.by.split(" ")[0]}</button>
                    : r.status !== "COMPLETED" ? <button onClick={() => setLocks(m => ({ ...m, [r.id]: { by: user?.name || "Moi", role: user?.role || "" } }))} title="Prendre en charge (check-out)" style={{ padding: "4px 9px", borderRadius: 6, border: `1px dashed ${T.line}`, background: T.surface, color: T.inkSoft, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>🔓 Prendre</button>
                      : <span style={{ fontSize: 10, color: T.inkSoft }}>—</span>
                }</td>
                <td style={{ padding: "11px 14px", fontFamily: "monospace", fontSize: 10, color: T.inkSoft, whiteSpace: "nowrap" }}>{r.kycRef || "—"}</td>
                <td style={{ padding: "11px 14px", textAlign: "right", fontSize: 15, color: T.inkSoft }}>›</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        {totalPages > 1 && <div style={{ padding: "10px 20px", borderTop: `1px solid ${T.line}`, display: "flex", gap: 6, alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: T.inkSoft }}>{filtered.length} résultats · page {page + 1}/{totalPages}</span>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${T.line}`, background: T.surface, color: page === 0 ? T.inkSoft : T.olive700, cursor: page === 0 ? "not-allowed" : "pointer", fontSize: 11 }}>←</button>
            {Array.from({ length: Math.min(totalPages, 6) }, (_, i) => { const pg = totalPages <= 6 ? i : Math.max(0, Math.min(totalPages - 6, page - 3)) + i; return <button key={pg} onClick={() => setPage(pg)} style={{ padding: "5px 9px", borderRadius: 6, border: `1px solid ${pg === page ? T.olive600 : T.line}`, background: pg === page ? T.oliveSoft : T.surface, color: pg === page ? T.olive700 : T.inkMid, cursor: "pointer", fontSize: 11, fontWeight: pg === page ? 700 : 400 }}>{pg + 1}</button>; })}
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${T.line}`, background: T.surface, color: page === totalPages - 1 ? T.inkSoft : T.olive700, cursor: page === totalPages - 1 ? "not-allowed" : "pointer", fontSize: 11 }}>→</button>
          </div>
        </div>}
      </div>

      {trigOpen && (() => {
        const c = trigClientId ? clientById[trigClientId] : null;
        const members = c ? clientGroupMembers(c.id) : [];
        const hasGroup = members.length > 1;
        return <div onClick={() => setTrigOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(20,26,14,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 340, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: T.surface, borderRadius: 16, width: 460, maxWidth: "94vw", padding: 22 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.ink, marginBottom: 4 }}>↻ Déclencher une Account Review</div>
            <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 14 }}>Revue groupée — si le client appartient à un groupe (UBO commun), la cascade s'applique automatiquement selon le paramétrage.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <select value={trigClientId} onChange={e => setTrigClientId(e.target.value)} style={{ padding: "9px 12px", borderRadius: 9, border: `1px solid ${T.line}`, fontSize: 12.5 }}>
                <option value="">Sélectionner un client…</option>
                {clients.slice(0, 80).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
              <input value={trigReason} onChange={e => setTrigReason(e.target.value)} placeholder="Motif de déclenchement" style={{ padding: "9px 12px", borderRadius: 9, border: `1px solid ${T.line}`, fontSize: 12.5 }} />
              {c && <div style={{ padding: "10px 12px", borderRadius: 10, background: hasGroup ? T.violetSoft : T.cream, fontSize: 11.5, color: T.inkMid }}>{hasGroup ? <><strong>Groupe</strong> détecté ({members.length} client(s) — {members.map(m => m.name).join(", ")}). La cascade déclenchera la revue de tous les membres.</> : "Aucun groupe détecté pour ce client — revue individuelle."}</div>}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setTrigOpen(false)} style={{ padding: "9px 16px", borderRadius: 9, border: `1px solid ${T.line}`, background: T.surface, color: T.inkMid, fontSize: 12.5, cursor: "pointer" }}>Annuler</button>
              <button disabled={!trigClientId} onClick={triggerReview} style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: trigClientId ? T.olive600 : T.line, color: "#fff", fontSize: 12.5, fontWeight: 800, cursor: trigClientId ? "pointer" : "not-allowed" }}>Déclencher →</button>
            </div>
          </div>
        </div>;
      })()}
    </div>);
}
