import React, { useEffect, useState } from "react";
import { apiGetSourced } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { P } from "../../theme/palette";
import { KycCreate } from "./KycCreate";
import clientsSeed from "../../seed/clients.json";
import kycSeed from "../../seed/kyc.json";

// ─── Liste des dossiers KYC (menu KYC ≠ menu Client) — port fidèle de la maquette.
// Le backend ne sert que le RÉSUMÉ (code, clientId, status, riskLevel, createdAt) ; le nom /
// la structure / le pays viennent de /v1/clients (jointure côté écran). Score, workflow et
// révision ne sont PAS servis par la liste → ils s'affichent à l'OUVERTURE du dossier, jamais
// fabriqués ici (canon : rien d'inventé).
type KycRow = { code: string; clientId: string; status: string; riskLevel?: string; createdAt?: string };
type Client = { id: string; name: string; structure: string; country: string; riskLevel: string };

const RISK = (r?: string): [string, string] =>
  r === "HIGH" ? [P.red, P.redSoft] : r === "LOW" ? [P.green, P.greenSoft] : [P.amber, P.amberSoft];
const RISK_FR: Record<string, string> = { HIGH: "Élevé", MEDIUM: "Moyen", LOW: "Faible" };
const FLAG: Record<string, string> = { CH: "🇨🇭", JP: "🇯🇵", AE: "🇦🇪", FR: "🇫🇷", DE: "🇩🇪", GB: "🇬🇧",
  US: "🇺🇸", IT: "🇮🇹", ES: "🇪🇸", LU: "🇱🇺", AT: "🇦🇹", JE: "🇯🇪", SG: "🇸🇬", HK: "🇭🇰" };

// Nomenclature de statut — VERBATIM de la maquette (KYC_STATUS_LABEL / KYC_STATUS_STYLE).
const ST_LABEL: Record<string, string> = { APPROVED: "Approuvé", IN_PROGRESS: "En cours",
  UNDER_REVIEW: "En revue", PENDING_APPROVAL: "Att. approbation", DRAFT: "Brouillon", REJECTED: "Rejeté" };
const ST_STYLE: Record<string, [string, string]> = {
  APPROVED: [P.green, P.greenSoft], IN_PROGRESS: [P.gold, P.amberSoft], UNDER_REVIEW: [P.amber, P.amberSoft],
  PENDING_APPROVAL: [P.olive600, P.oliveSoft], DRAFT: [P.inkSoft, P.lineSoft], REJECTED: [P.red, P.redSoft] };
const ACTIFS = ["IN_PROGRESS", "UNDER_REVIEW", "PENDING_APPROVAL"];
const STATUTS: [string, string][] = [["ALL", "Tous statuts"], ["APPROVED", "Approuvé"], ["IN_PROGRESS", "En cours"],
  ["UNDER_REVIEW", "En revue"], ["PENDING_APPROVAL", "Att. appro."], ["DRAFT", "Brouillon"], ["REJECTED", "Rejeté"]];

function Kpi({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  return <div style={{ background: P.surface, border: `1px solid ${P.line}`, borderRadius: 14, padding: "14px 16px" }}>
    <div style={{ fontSize: 11, color: P.inkSoft, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
    <div style={{ fontSize: 11, color: P.inkMid, marginTop: 2 }}>{sub}</div>
  </div>;
}

export function KycList({ onOpen }: { onOpen: (code: string) => void }) {
  const [rows, setRows] = useState<KycRow[]>([]);
  const [clients, setClients] = useState<Record<string, Client>>({});
  const [demo, setDemo] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterRisk, setFilterRisk] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);

  const charger = () => {
    apiGetSourced<KycRow[]>("/v1/kyc", kycSeed as KycRow[]).then(r => { setRows(r.data); setDemo(d => d || r.isDemo); });
    apiGetSourced<{ data: Client[] }>("/v1/clients", { data: clientsSeed as Client[] })
      .then(r => { setClients(Object.fromEntries(r.data.data.map(c => [c.id, c]))); setDemo(d => d || r.isDemo); });
  };
  useEffect(charger, []);

  const nom = (k: KycRow) => clients[k.clientId]?.name ?? k.clientId;
  const filtered = rows.filter(k => {
    const q = search.toLowerCase();
    const matchSearch = !q || k.code.toLowerCase().includes(q) || nom(k).toLowerCase().includes(q);
    const matchStatus = filterStatus === "ALL" || k.status === filterStatus;
    const matchRisk = filterRisk === "ALL" || k.riskLevel === filterRisk;
    return matchSearch && matchStatus && matchRisk;
  });
  const nApp = rows.filter(k => k.status === "APPROVED").length;
  const nActif = rows.filter(k => ACTIFS.includes(k.status)).length;
  const nHigh = rows.filter(k => k.riskLevel === "HIGH").length;

  const th = { padding: "9px 16px", textAlign: "left" as const, fontSize: 10, color: P.inkSoft, textTransform: "uppercase" as const, letterSpacing: 0.5, whiteSpace: "nowrap" as const };
  const td = { padding: "11px 16px", fontSize: 12, color: P.inkMid };

  return <div>
    {demo && <DemoModeBanner/>}
    <h2>Dossiers KYC — {rows.length}</h2>

    {/* KPIs — comptés sur les dossiers réellement servis (aucun agrégat inventé) */}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginBottom: 18 }}>
      <Kpi label="Total dossiers" value={rows.length} sub={`${Object.keys(clients).length} clients`} color={P.olive600}/>
      <Kpi label="En cours / revue" value={nActif} sub="saisie · revue · approbation" color={P.amber}/>
      <Kpi label="Approuvés" value={nApp} sub={rows.length ? `${Math.round(nApp / rows.length * 100)}% du total` : "—"} color={P.green}/>
      <Kpi label="Risque élevé" value={nHigh} sub="diligence renforcée" color={P.red}/>
    </div>

    {/* recherche + filtres statut + filtres risque */}
    <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
      <div style={{ position: "relative", flex: "1 1 200px" }}>
        <span aria-hidden style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: P.inkSoft, fontSize: 13 }}>🔍</span>
        <input type="search" placeholder="Code KYC, client…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: "100%", padding: "8px 10px 8px 32px", borderRadius: 8, border: `1px solid ${P.line}`, fontSize: 12, background: P.surface, color: P.ink, outline: "none", boxSizing: "border-box" }}/>
      </div>
      {STATUTS.map(([v, l]) => {
        const on = filterStatus === v;
        return <button key={v} onClick={() => setFilterStatus(v)}
          style={{ padding: "6px 11px", borderRadius: 7, border: `1px solid ${on ? P.olive600 : P.line}`, background: on ? P.oliveSoft : "transparent",
            color: on ? P.olive700 : P.inkMid, fontSize: 11, fontWeight: on ? 700 : 400, cursor: "pointer" }}>{l}</button>;
      })}
    </div>
    <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
      {([["ALL", "Tout risque"], ["LOW", "Faible"], ["MEDIUM", "Moyen"], ["HIGH", "Élevé"]] as const).map(([v, l]) => {
        const on = filterRisk === v; const [cc, cbg] = v === "ALL" ? [P.inkMid, "transparent"] : RISK(v);
        return <button key={v} onClick={() => setFilterRisk(v)}
          style={{ padding: "6px 11px", borderRadius: 7, border: `1px solid ${on ? cc : P.line}`, background: on ? cbg : "transparent",
            color: on ? cc : P.inkMid, fontSize: 11, fontWeight: on ? 700 : 400, cursor: "pointer" }}>{l}</button>;
      })}
    </div>

    {/* la LISTE (tableau) — cliquez une ligne pour ouvrir le dossier */}
    <div style={{ background: P.surface, borderRadius: 14, border: `1px solid ${P.line}`, overflow: "hidden" }}>
      <div style={{ padding: "12px 20px", borderBottom: `1px solid ${P.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: P.ink }}>{filtered.length} dossier(s)
          <span style={{ fontSize: 11, fontWeight: 400, color: P.inkSoft }}> · score, workflow &amp; révision s'affichent à l'ouverture</span></span>
        <button onClick={() => setCreateOpen(true)} disabled={demo}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 8, border: "none",
            background: demo ? P.line : P.olive600, color: demo ? P.inkSoft : "#fff", fontSize: 12, fontWeight: 700, cursor: demo ? "not-allowed" : "pointer" }}>🌱 Créer KYC</button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr style={{ background: P.lineSoft }}>
              {["Code KYC", "Client", "Structure", "Pays", "Risque", "Statut", "Créé le", ""].map((h, i) => <th key={i} style={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map(k => {
              const c = clients[k.clientId];
              const [sc, sbg] = ST_STYLE[k.status] ?? [P.inkSoft, P.lineSoft];
              const [rc, rbg] = RISK(k.riskLevel);
              return <tr key={k.code} onClick={() => onOpen(k.code)}
                style={{ borderBottom: `1px solid ${P.lineSoft}`, cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background = P.oliveSoft}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <td style={{ padding: "11px 16px", fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: P.olive700, whiteSpace: "nowrap" }}>{k.code}</td>
                <td style={{ padding: "11px 16px", fontSize: 12, fontWeight: 600, color: P.ink, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nom(k)}</td>
                <td style={{ padding: "11px 16px" }}>{c
                  ? <span style={{ fontSize: 10, fontWeight: 700, color: P.olive700, background: P.oliveSoft, padding: "2px 7px", borderRadius: 4 }}>{c.structure}</span>
                  : <span style={{ fontSize: 11, color: P.inkSoft }}>—</span>}</td>
                <td style={td}>{c ? (FLAG[c.country] ? FLAG[c.country] + " " : "") + c.country : "—"}</td>
                <td style={{ padding: "11px 16px" }}>{k.riskLevel
                  ? <span style={{ fontSize: 10, fontWeight: 700, color: rc, background: rbg, padding: "2px 7px", borderRadius: 4 }}>{RISK_FR[k.riskLevel] ?? k.riskLevel}</span>
                  : <span style={{ fontSize: 11, color: P.inkSoft }}>—</span>}</td>
                <td style={{ padding: "11px 16px" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: sc, background: sbg, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>{ST_LABEL[k.status] ?? k.status}</span></td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>{k.createdAt ? k.createdAt.slice(0, 10) : "—"}</td>
                <td style={{ padding: "11px 16px", textAlign: "right", fontSize: 15, color: P.inkSoft }}>›</td>
              </tr>;
            })}
            {filtered.length === 0 && <tr><td colSpan={8} style={{ padding: "28px 16px", textAlign: "center", fontSize: 12, color: P.inkSoft }}>Aucun dossier ne correspond aux filtres.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>

    {/* modale « Créer KYC » — réutilise le formulaire gouverné (le moteur décide du workflow) */}
    {createOpen && <div onClick={() => setCreateOpen(false)} role="dialog" aria-modal aria-label="Créer un dossier KYC"
      style={{ position: "fixed", inset: 0, background: "rgba(20,26,14,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: P.surface, borderRadius: 16, padding: 24, width: 560, maxWidth: "94vw", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(10,15,8,0.3)" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: -8 }}>
          <button onClick={() => setCreateOpen(false)} aria-label="Fermer"
            style={{ border: "none", background: "transparent", fontSize: 20, color: P.inkSoft, cursor: "pointer" }}>✕</button>
        </div>
        <KycCreate onCreated={code => { setCreateOpen(false); charger(); onOpen(code); }}/>
      </div>
    </div>}
  </div>;
}
