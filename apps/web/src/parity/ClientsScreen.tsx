import React, { useState } from "react";
import { T } from "./tokens";
import { Badge, KpiCard, StatsToggle, Donut, colOn, colLabel, KYC_STATUS_STYLE, KYC_STATUS_LABEL } from "./components";
import { ScorePopover, LifecycleBadge, ExportBtn, ClientTimelineModal, kycsByClientId } from "./components-data";
import CLIENTS from "../fixtures/CLIENTS.json";
import { FilterBar } from "../components/FilterBar";

// ClientsScreen — PORT de docs/reference/olive-demo.html (13642–13754). Filtres (segment/risque/
// structure) + recherche portés sur FilterBar (R404, R-FB.1) ; la barre « Mes clients » reste un scope.
// Câblé sur la fixture CLIENTS (60 clients). onOpen (ouverture du dossier) = no-op en
// mode parité isolé ; le 🪪 ouvre la Vue 360° (ClientTimelineModal). StatsToggle → null (B.6).
const clients = CLIENTS as any[];

export function ClientsScreen({ onOpen = () => {} }: { onOpen?: (c: any) => void }) {
  const [twinFor, setTwinFor] = useState<any>(null);
  const [mine, setMine] = useState(false);
  const [search, setSearch] = useState("");
  const [filterSeg, setFilterSeg] = useState("ALL");
  const [filterRisk, setFilterRisk] = useState("ALL");
  const [filterType, setFilterType] = useState("ALL");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;
  const ALL = clients;
  const structTypes = [...new Set(ALL.map(c => c.type))].sort();
  const filtered = ALL.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || c.rm.toLowerCase().includes(q) || c.country.toLowerCase().includes(q);
    const matchSeg = filterSeg === "ALL" || c.segment === filterSeg;
    const matchRisk = filterRisk === "ALL" || c.risk === filterRisk;
    const matchType = filterType === "ALL" || c.type === filterType;
    const matchMine = !mine || c.rm === "—";
    return matchSearch && matchSeg && matchRisk && matchType && matchMine;
  });
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const uhnwi = clients.filter(c => c.segment === "UHNWI").length;
  const hnwi = clients.filter(c => c.segment === "HNWI").length;
  const pepC = clients.filter(c => c.pep).length;

  const th = { padding: "9px 14px", textAlign: "left" as const, fontSize: 10, color: T.inkSoft, textTransform: "uppercase" as const, letterSpacing: 0.5, whiteSpace: "nowrap" as const };

  return (
    <div>
      {/* MineBar */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        {([[false, "Tous les clients"], [true, "◉ Mes clients"]] as const).map(([v, l]) => (
          <button key={String(v)} onClick={() => { setMine(v); setPage(0); }} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${mine === v ? T.olive600 : T.line}`, background: mine === v ? T.oliveSoft : T.surface, color: mine === v ? T.olive700 : T.inkMid, fontSize: 12, fontWeight: mine === v ? 700 : 500, cursor: "pointer" }}>{l}</button>))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <ExportBtn filename="clients.csv" headers={["ID", "Nom", "Type", "Pays", "Segment", "AUM", "RM", "Risque"]} rows={() => filtered.map(c => [c.id, c.name, c.type, c.country, c.segment, c.aum, c.rm, c.risk])} />
        </div>
      </div>

      {/* KPI — regroupés dans Accueil (StatsToggle → null, B.6) */}
      <StatsToggle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 18 }}>
          <KpiCard label="Clients référencés" value={clients.length} sub={`dont ${uhnwi} UHNWI`} color={T.olive600} icon="◑" />
          <KpiCard label="UHNWI / HNWI" value={uhnwi + hnwi} sub={`${Math.round((uhnwi + hnwi) / clients.length * 100)}% du portefeuille`} color={T.gold} icon="◆" />
          <KpiCard label="PEP identifiés" value={pepC} sub="diligences renforcées" color={T.red} icon="◬" />
          <KpiCard label="Structures légales" value={structTypes.length} sub="PP, SA, Trust, Fond…" color={T.leaf} icon="⬡" />
        </div>
      </StatsToggle>

      {/* Barre de filtres — FilterBar uniforme (R404) */}
      <FilterBar
        search={{ value: search, onChange: v => { setSearch(v); setPage(0); }, placeholder: "Nom, ID, pays, RM…" }}
        filters={[
          { id: "segment", label: "Segment", value: filterSeg, allValue: "ALL", onChange: v => { setFilterSeg(v); setPage(0); },
            options: [["ALL", "Tous"], ["UHNWI", "UHNWI"], ["HNWI", "HNWI"], ["Affluent", "Affluent"], ["Mass Affluent", "Mass Aff."]] },
          { id: "risque", label: "Risque", value: filterRisk, allValue: "ALL", onChange: v => { setFilterRisk(v); setPage(0); },
            options: [["ALL", "Tout risque"], ["LOW", "Faible"], ["MEDIUM", "Moyen"], ["HIGH", "Élevé"]] },
          { id: "structure", label: "Structure", value: filterType, allValue: "ALL", onChange: v => { setFilterType(v); setPage(0); },
            options: ([["ALL", "Toutes structures"]] as [string, string][]).concat(structTypes.map(t => [t, t] as [string, string])) },
        ]}
        shown={filtered.length}
        total={ALL.length}
        onReset={() => { setFilterSeg("ALL"); setFilterRisk("ALL"); setFilterType("ALL"); setSearch(""); setPage(0); }}
      />

      {/* Tableau */}
      <div style={{ background: T.surface, borderRadius: 14, border: `1px solid ${T.line}`, overflow: "hidden" }}>
        <div style={{ padding: "12px 20px", borderBottom: `1px solid ${T.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{filtered.length} client(s)</span>
          <span style={{ fontSize: 11, color: T.inkSoft }}>Cliquez pour ouvrir le dossier KYC</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
            <thead>
              <tr style={{ background: T.lineSoft }}>
                {["Client", "ID", "Structure", "Segment", "AUM", "Pays", "Risque", "Score", "KYC", "Statut", ""].filter(h => h === "" || colOn("clients", h)).map(h => <th key={h} style={th}>{colLabel("clients", h)}</th>)}
              </tr>
            </thead>
            <tbody>
              {paged.map(c => {
                const riskColor = c.risk === "HIGH" ? T.red : c.risk === "MEDIUM" ? T.amber : T.green;
                const riskBg = c.risk === "HIGH" ? T.redSoft : c.risk === "MEDIUM" ? T.amberSoft : T.greenSoft;
                const clientKycs = kycsByClientId[c.id] || [];
                const latestKyc = clientKycs[clientKycs.length - 1];
                const kycStatus = latestKyc ? KYC_STATUS_LABEL[latestKyc.status] || latestKyc.status : "—";
                const [ksc, ksbg] = latestKyc ? (KYC_STATUS_STYLE[latestKyc.status] || [T.inkSoft, T.lineSoft]) : [T.inkSoft, T.lineSoft];
                return (
                  <tr key={c.id} onClick={() => onOpen(c)} style={{ borderBottom: `1px solid ${T.lineSoft}`, cursor: "pointer" }} onMouseEnter={e => (e.currentTarget.style.background = T.oliveSoft)} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    {colOn("clients", "Client") && <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg,${T.olive700},${T.leaf})`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{c.initials}</div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: T.ink, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                          <div style={{ fontSize: 10, color: T.inkSoft }}>{c.rm.split(" ").slice(-1)}</div>
                        </div>
                      </div>
                    </td>}
                    {colOn("clients", "ID") && <td style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: 10, color: T.inkSoft }}>{c.id}</td>}
                    {colOn("clients", "Structure") && <td style={{ padding: "12px 14px" }}><Badge text={c.type} color={T.olive700} bg={T.oliveSoft} /></td>}
                    {colOn("clients", "Segment") && <td style={{ padding: "12px 14px", fontSize: 11, color: T.inkMid }}>{c.segment}</td>}
                    {colOn("clients", "AUM") && <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 700, color: T.ink, whiteSpace: "nowrap" }}>{c.aum}</td>}
                    {colOn("clients", "Pays") && <td style={{ padding: "12px 14px", fontSize: 11, color: T.inkMid }}>{c.countryFlag} {c.country}</td>}
                    {colOn("clients", "Risque") && <td style={{ padding: "12px 14px" }}><span style={{ fontSize: 10, fontWeight: 700, color: riskColor, background: riskBg, padding: "2px 7px", borderRadius: 4 }}>{c.risk}</span></td>}
                    {colOn("clients", "Score") && <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <Donut value={c.score} size={24} stroke={3} showLabel={false} />
                        <span style={{ fontSize: 12, fontWeight: 800, color: T.ink }}>{c.score}</span>
                        <ScorePopover client={c} kyc={latestKyc} />
                      </div>
                    </td>}
                    {colOn("clients", "KYC") && <td style={{ padding: "12px 14px" }}><span style={{ fontSize: 10, fontWeight: 600, color: ksc, background: ksbg, padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap" }}>{kycStatus}</span></td>}
                    {colOn("clients", "Statut") && <td style={{ padding: "12px 14px" }}><LifecycleBadge entity={c} /></td>}
                    <td style={{ padding: "12px 14px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => setTwinFor(c)} title="Vue 360° — Digital Twin & timeline" style={{ border: `1px solid ${T.line}`, background: T.surface, color: T.olive700, borderRadius: 7, padding: "4px 8px", cursor: "pointer", fontSize: 12 }}>🪪</button>
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontSize: 15, color: T.inkSoft }}>›</td>
                  </tr>);
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && <div style={{ padding: "10px 20px", borderTop: `1px solid ${T.line}`, display: "flex", gap: 6, alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: T.inkSoft }}>{filtered.length} résultats · page {page + 1}/{totalPages}</span>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${T.line}`, background: T.surface, color: page === 0 ? T.inkSoft : T.olive700, cursor: page === 0 ? "not-allowed" : "pointer", fontSize: 11 }}>←</button>
            {Array.from({ length: Math.min(totalPages, 6) }, (_, i) => {
              const pg = totalPages <= 6 ? i : Math.max(0, Math.min(totalPages - 6, page - 3)) + i;
              return <button key={pg} onClick={() => setPage(pg)} style={{ padding: "5px 9px", borderRadius: 6, border: `1px solid ${pg === page ? T.olive600 : T.line}`, background: pg === page ? T.oliveSoft : T.surface, color: pg === page ? T.olive700 : T.inkMid, cursor: "pointer", fontSize: 11, fontWeight: pg === page ? 700 : 400 }}>{pg + 1}</button>;
            })}
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${T.line}`, background: T.surface, color: page === totalPages - 1 ? T.inkSoft : T.olive700, cursor: page === totalPages - 1 ? "not-allowed" : "pointer", fontSize: 11 }}>→</button>
          </div>
        </div>}
      </div>

      {twinFor && <ClientTimelineModal client={twinFor} kyc={(kycsByClientId[twinFor.id] || []).slice(-1)[0]} onClose={() => setTwinFor(null)} />}
    </div>);
}
