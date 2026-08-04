import React, { useState } from "react";
import { T } from "./tokens";
import { Badge, Donut, KpiCard, StatsToggle, OliveNote, colOn, colLabel, KYC_STATUS_STYLE, KYC_STATUS_LABEL } from "./components";
import { ExportBtn, RiskFactorsList } from "./components-data";
import { wfNomenclature, wfNomColor, wfNomBg, kycTypeOf, wfTriage, latestKycFor, nextRevisionFor } from "./kyc-support";
import { evalAmlRules } from "./aml";
import KYCS_DATA from "../fixtures/KYCS_DATA.json";
import CLIENTS from "../fixtures/CLIENTS.json";
import USERS from "../fixtures/USERS.json";
import DS_STATS from "../fixtures/DS_STATS.json";
import { FilterBar } from "../components/FilterBar";

// KycListScreen — PORT de docs/reference/olive-demo.html (13280–13474). Filtres (workflow/statut/RM)
// + recherche portés sur FilterBar (R404, R-FB.1) ; barre « Mes KYC »/ouverture = scope conservé.
// Câblé sur KYCS_DATA (81) + CLIENTS (60). StatsToggle → null (B.6). onOpen = no-op isolé.
const kycs = KYCS_DATA as any[];
const clients = CLIENTS as any[];
const users = USERS as any[];
const NK_REASONS = ["Revue périodique", "Revue événementielle", "Mise à jour réglementaire", "Changement de circonstances", "Autre cycle KYC"];

export function KycListScreen({ onOpen = () => {} }: { onOpen?: (k: any) => void }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [nkClientId, setNkClientId] = useState("");
  const [nkReason, setNkReason] = useState("Revue périodique");
  const [nkRm, setNkRm] = useState("");
  const [nkDone, setNkDone] = useState<any>(null);
  const [mine, setMine] = useState(false);
  const [openness, setOpenness] = useState("ALL");
  const [search, setSearch] = useState("");
  const [filterWf, setFilterWf] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterRm, setFilterRm] = useState("ALL");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;
  const rmList = [...new Set(kycs.map(k => k.rm))].sort();

  const doCreateKyc = () => {
    const client = clients.find(c => c.id === nkClientId);
    if (!client) return;
    const nextRev = nextRevisionFor(client.id);
    const prevKyc = latestKycFor(client.id);
    const score = evalAmlRules({ type: client.type, countryCode: client.countryCode, tags: client.tags || [], pep: client.pep, sector: client.sector, aum: client.aum, name: client.name, uboName: client.uboName }, null).score;
    const tri = wfTriage({ score, revision: nextRev, previousKycId: prevKyc ? prevKyc.id : null });
    const code = "KYC-2026-" + (client.countryCode || "CH") + "-" + String(Math.floor(1000 + Math.random() * 9000)) + "-R" + nextRev;
    setNkDone({ code, tier: tri.tier, score, defLabel: tri.defLabel, pseudo: client, revision: nextRev });
    setNkClientId("");
  };

  const filtered = kycs.filter(k => {
    const q = search.toLowerCase();
    const matchSearch = !q || k.code.toLowerCase().includes(q) || (k.clientName || "").toLowerCase().includes(q) || (k.rm || "").toLowerCase().includes(q);
    const matchWf = filterWf === "ALL" || wfNomenclature(k).code === filterWf;
    const matchSt = filterStatus === "ALL" || k.status === filterStatus;
    const matchRm = filterRm === "ALL" || k.rm === filterRm;
    const closed = ["APPROVED", "REJECTED"].includes(k.status);
    const matchOpen = openness === "ALL" || (openness === "OPEN" && !closed) || (openness === "CLOSED" && closed);
    return matchSearch && matchWf && matchSt && matchRm && (!mine) && matchOpen;
  });
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const kpiApproved = kycs.filter(k => k.status === "APPROVED").length;
  const kpiActive = kycs.filter(k => ["IN_PROGRESS", "UNDER_REVIEW", "PENDING_APPROVAL"].includes(k.status)).length;
  const kpiEdd = kycs.filter(k => { const c = wfNomenclature(k).code; return c[0] === "H" || c[0] === "P"; }).length;
  const kpiRev = kycs.filter(k => k.revision > 1).length;

  const th = { padding: "9px 16px", textAlign: "left" as const, fontSize: 10, color: T.inkSoft, textTransform: "uppercase" as const, letterSpacing: 0.5, whiteSpace: "nowrap" as const };
  const mb = (on: boolean) => ({ padding: "7px 14px", borderRadius: 8, border: `1px solid ${on ? T.olive600 : T.line}`, background: on ? T.oliveSoft : T.surface, color: on ? T.olive700 : T.inkMid, fontSize: 12, fontWeight: on ? 700 : 500, cursor: "pointer" });

  return (
    <div>
      {/* MineBar */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        {([[false, "Tous"], [true, "◉ Mes KYC"]] as const).map(([v, l]) => <button key={String(v)} onClick={() => { setMine(v); setPage(0); }} style={mb(mine === v)}>{l}</button>)}
        <span style={{ width: 1, alignSelf: "stretch", background: T.line }} />
        {([["ALL", "Tous statuts"], ["OPEN", "En cours"], ["CLOSED", "Fermés"]] as const).map(([v, l]) => <button key={v} onClick={() => { setOpenness(v); setPage(0); }} style={mb(openness === v)}>{l}</button>)}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <ExportBtn filename="kycs.csv" headers={["Code", "Client", "Workflow", "Statut", "Phase", "RM", "CO", "Score"]} rows={() => filtered.map(k => [k.code, k.clientName, wfNomenclature(k).code, k.status, k.wfPhase, k.rm, k.co, k.riskScore])} />
        </div>
      </div>

      <StatsToggle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 18 }}>
          <KpiCard label="Total dossiers KYC" value={kycs.length} sub={`${(DS_STATS as any).totalClients} clients`} color={T.olive600} icon="◎" />
          <KpiCard label="En cours / révision" value={kpiActive} sub={`dont ${kpiEdd} renforcés (H*/P*)`} color={T.amber} icon="⏳" />
          <KpiCard label="Approuvés" value={kpiApproved} sub={`${Math.round(kpiApproved / kycs.length * 100)}% du total`} trend={15} color={T.green} icon="✓" />
          <KpiCard label="Révisions (Rn≥2)" value={kpiRev} sub="re-KYC successifs" color={T.gold} icon="↻" />
        </div>
      </StatsToggle>

      {/* Filtres — FilterBar uniforme (R404) */}
      <FilterBar
        search={{ value: search, onChange: v => { setSearch(v); setPage(0); }, placeholder: "Code KYC, client, RM…" }}
        filters={[
          { id: "workflow", label: "Workflow", value: filterWf, allValue: "ALL", onChange: v => { setFilterWf(v); setPage(0); },
            options: ["ALL", "SOW", "HOW", "POW", "SKW", "HKW", "PKW"].map((v): [string, string] => [v, v === "ALL" ? "Tous" : v]) },
          { id: "statut", label: "Statut", value: filterStatus, allValue: "ALL", onChange: v => { setFilterStatus(v); setPage(0); },
            options: [["ALL", "Tous statuts"], ["APPROVED", "Approuvé"], ["IN_PROGRESS", "En cours"], ["UNDER_REVIEW", "En revue"], ["PENDING_APPROVAL", "Att. appro."], ["DRAFT", "Brouillon"], ["REJECTED", "Rejeté"]] },
          { id: "rm", label: "RM", value: filterRm, allValue: "ALL", onChange: v => { setFilterRm(v); setPage(0); },
            options: ([["ALL", "Tous les RM"]] as [string, string][]).concat(rmList.map(rm => [rm, rm] as [string, string])) },
        ]}
        shown={filtered.length}
        total={kycs.length}
        onReset={() => { setFilterWf("ALL"); setFilterStatus("ALL"); setFilterRm("ALL"); setSearch(""); setPage(0); }}
      />

      {/* Table */}
      <div style={{ background: T.surface, borderRadius: 14, border: `1px solid ${T.line}`, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{filtered.length} dossier(s) {search || filterWf !== "ALL" || filterStatus !== "ALL" || filterRm !== "ALL" ? "— filtrés" : ""}</div>
          <button onClick={() => { setCreateOpen(true); setNkDone(null); }} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 8, border: "none", background: T.olive600, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}><span>🌱</span> Créer KYC</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
            <thead>
              <tr style={{ background: T.lineSoft }}>
                {["Code KYC", "Client", "Structure", "Type", "Rév.", "Workflow", "Score", "Statut", "RM", "Créé le", ""].filter(h => h === "" || colOn("kycs", h)).map(h => <th key={h} style={th}>{colLabel("kycs", h)}</th>)}
              </tr>
            </thead>
            <tbody>
              {paged.map(k => {
                const [sc, sbg] = KYC_STATUS_STYLE[k.status] || [T.inkSoft, T.lineSoft];
                const statusLabel = KYC_STATUS_LABEL[k.status] || k.status;
                const wn = wfNomenclature(k);
                return (
                  <tr key={k.code} onClick={() => onOpen(k)} style={{ borderBottom: `1px solid ${T.lineSoft}`, cursor: "pointer" }} onMouseEnter={e => (e.currentTarget.style.background = T.oliveSoft)} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    {colOn("kycs", "Code KYC") && <td style={{ padding: "11px 16px", fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: T.olive700, whiteSpace: "nowrap" }}>{k.code}</td>}
                    {colOn("kycs", "Client") && <td style={{ padding: "11px 16px", fontSize: 12, fontWeight: 600, color: T.ink, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.clientName}</td>}
                    {colOn("kycs", "Structure") && <td style={{ padding: "11px 16px" }}><Badge text={k.structCode} color={T.olive700} bg={T.oliveSoft} /></td>}
                    {colOn("kycs", "Type") && <td style={{ padding: "11px 16px" }}><Badge text={kycTypeOf(k) === "ONBOARDING" ? "Onboarding" : "Review"} color={kycTypeOf(k) === "ONBOARDING" ? T.violet : T.blue} bg={kycTypeOf(k) === "ONBOARDING" ? T.violet + "18" : T.blueSoft} /></td>}
                    {colOn("kycs", "Rév.") && <td style={{ padding: "11px 16px" }}><span style={{ fontSize: 11, fontWeight: 700, color: T.inkMid }}>R{k.revision}</span></td>}
                    {colOn("kycs", "Workflow") && <td style={{ padding: "11px 16px" }}><span title={wn.label + " · diligence " + wn.tier}><Badge text={wn.code} color={wfNomColor(wn.code)} bg={wfNomBg(wn.code)} /></span></td>}
                    {colOn("kycs", "Score") && <td style={{ padding: "11px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Donut value={k.riskScore} size={24} stroke={3} showLabel={false} />
                        <span style={{ fontSize: 12, fontWeight: 800, color: T.ink }}>{k.riskScore}</span>
                      </div>
                    </td>}
                    {colOn("kycs", "Statut") && <td style={{ padding: "11px 16px" }}><span style={{ fontSize: 10, fontWeight: 700, color: sc, background: sbg, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>{statusLabel}</span></td>}
                    {colOn("kycs", "RM") && <td style={{ padding: "11px 16px", fontSize: 11, color: T.inkMid, whiteSpace: "nowrap" }}>{(k.rm || "").split(" ").slice(-1)[0]}</td>}
                    {colOn("kycs", "Créé le") && <td style={{ padding: "11px 16px", fontSize: 11, color: T.inkSoft, whiteSpace: "nowrap" }}>{k.createdAt?.slice(0, 10)}</td>}
                    <td style={{ padding: "11px 16px", textAlign: "right", fontSize: 15, color: T.inkSoft }}>›</td>
                  </tr>);
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && <div style={{ padding: "12px 20px", borderTop: `1px solid ${T.line}`, display: "flex", gap: 6, alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: T.inkSoft }}>{filtered.length} résultats · page {page + 1}/{totalPages}</span>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${T.line}`, background: T.surface, color: page === 0 ? T.inkSoft : T.olive700, cursor: page === 0 ? "not-allowed" : "pointer", fontSize: 11 }}>← Préc</button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const pg = totalPages <= 7 ? i : Math.max(0, Math.min(totalPages - 7, page - 3)) + i;
              return <button key={pg} onClick={() => setPage(pg)} style={{ padding: "5px 9px", borderRadius: 6, border: `1px solid ${pg === page ? T.olive600 : T.line}`, background: pg === page ? T.oliveSoft : T.surface, color: pg === page ? T.olive700 : T.inkMid, cursor: "pointer", fontSize: 11, fontWeight: pg === page ? 700 : 400 }}>{pg + 1}</button>;
            })}
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${T.line}`, background: T.surface, color: page === totalPages - 1 ? T.inkSoft : T.olive700, cursor: page === totalPages - 1 ? "not-allowed" : "pointer", fontSize: 11 }}>Suiv →</button>
          </div>
        </div>}
      </div>

      {/* Modale « Créer KYC » */}
      {createOpen && <div onClick={() => setCreateOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(20,26,14,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: T.surface, borderRadius: 16, padding: 24, width: 440, maxWidth: "92vw", boxShadow: "0 24px 64px rgba(10,15,8,0.3)" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.ink, marginBottom: 4 }}>🌱 Créer KYC — nouvelle version (Review)</div>
          <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 14 }}>Sélectionnez un client <strong>existant</strong> — un prospect non onboardé n'apparaît pas ici. Le premier KYC (V1 — Onboarding) est créé automatiquement lors de l'onboarding, jamais depuis cet écran.</div>
          {!nkDone ? <>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <select value={nkClientId} onChange={e => setNkClientId(e.target.value)} style={{ padding: "9px 12px", borderRadius: 9, border: `1px solid ${T.line}`, fontSize: 12.5 }}>
                <option value="">Sélectionner un client existant…</option>
                {clients.slice(0, 100).map(c => <option key={c.id} value={c.id}>{c.name} — {latestKycFor(c.id) ? "V" + latestKycFor(c.id)!.revision + " existant" : "aucun KYC"}</option>)}
              </select>
              {nkClientId && (() => { const lk = latestKycFor(nkClientId); return <OliveNote style={{ fontSize: 11, color: T.inkMid, padding: "8px 10px", borderRadius: 8, background: T.oliveSoft }}>Prochaine version : <strong>V{nextRevisionFor(nkClientId)} — Review</strong>{lk ? ` (chaînée depuis ${lk.code})` : ""}. Sections initialisées vides — aucune donnée pré-remplie.</OliveNote>; })()}
              <select value={nkReason} onChange={e => setNkReason(e.target.value)} style={{ padding: "9px 12px", borderRadius: 9, border: `1px solid ${T.line}`, fontSize: 12.5 }}>{NK_REASONS.map(r => <option key={r} value={r}>{r}</option>)}</select>
              <select value={nkRm} onChange={e => setNkRm(e.target.value)} style={{ padding: "9px 12px", borderRadius: 9, border: `1px solid ${T.line}`, fontSize: 12.5 }}>
                <option value="">RM associé : moi</option>
                {users.filter(u => u.role === "ARM" || u.role === "RM").map(u => <option key={u.id} value={u.name}>{u.name} — {u.roleLabel}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <button onClick={() => setCreateOpen(false)} style={{ padding: "9px 16px", borderRadius: 9, border: `1px solid ${T.line}`, background: T.surface, color: T.inkMid, fontSize: 12.5, cursor: "pointer" }}>Annuler</button>
              <button onClick={doCreateKyc} disabled={!nkClientId} style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: nkClientId ? T.olive600 : T.line, color: nkClientId ? "#fff" : T.inkSoft, fontSize: 12.5, fontWeight: 800, cursor: nkClientId ? "pointer" : "not-allowed" }}>Calculer &amp; initier →</button>
            </div>
          </> : <>
            <div style={{ background: T.oliveSoft, borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.olive700, marginBottom: 6 }}>✓ Dossier initié</div>
              <div style={{ fontSize: 12, color: T.ink, fontFamily: "monospace", marginBottom: 4 }}>{nkDone.code}</div>
              <div style={{ fontSize: 11.5, color: T.inkMid }}>Score {nkDone.score}/100 → diligence <strong>{nkDone.tier}</strong> · {nkDone.defLabel}. Le dossier apparaît en tête de liste (statut DRAFT) — cliquez la ligne pour l'ouvrir.</div>
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(0,0,0,0.08)" }}><RiskFactorsList client={nkDone.pseudo} max={5} compact /></div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setCreateOpen(false)} style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: T.olive600, color: "#fff", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>Fermer</button>
            </div>
          </>}
        </div>
      </div>}
    </div>);
}
