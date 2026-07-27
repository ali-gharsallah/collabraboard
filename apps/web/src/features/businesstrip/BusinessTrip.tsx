import React, { useState } from "react";
import { useApiOrSeed } from "../../lib/useApiOrSeed";
import { apiGetSourced, apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { VisaBadge } from "../../components/VisaBadge";
import { tokens } from "../../theme/tokens";

// Écran « Business Trip » (MOD-75, R222→R230 · FE-TRIP). Câblé au backend : liste/création/soumission
// (R222), avis cross-border qui ne décident pas (R223), signaux KYC/certif (R224/R228), visas d'approbation
// (R225, composant unique <VisaBadge>), contact reports mesurés (R226). L'avis s'affiche, l'approbateur décide.

type Trip = { id: string; status: string; dateStart: string; dateEnd: string; destinations: string[]; clients: string[]; revision: number };
type Advisory = { jurisdiction: string; activite: string; verdict: string; referentielVersion: string };
type Signal = { type: string; severite: string; detail: string };
type TripVisa = { role: string; status: string; signedBy?: string | null; signedAt?: string | null };
type Detail = Trip & { advisories: Advisory[]; signals: Signal[]; visas: TripVisa[] };

export function BusinessTrip() {
  const { data: trips, isDemo, reload } = useApiOrSeed<Trip[]>("/v1/trips", []);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [msg, setMsg] = useState("");
  const [dest, setDest] = useState(""); const [cli, setCli] = useState("");
  const [d1, setD1] = useState(""); const [d2, setD2] = useState("");

  async function creer() {
    setMsg("");
    try {
      const t = await apiPost<Trip>("/v1/trips", {
        destinations: dest.split(",").map((x) => x.trim()).filter(Boolean),
        clients: cli.split(",").map((x) => x.trim()).filter(Boolean),
        dateStart: d1, dateEnd: d2 });
      await apiPost(`/v1/trips/${t.id}/submit`, {});
      setMsg("Voyage soumis."); reload();
    } catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }
  }
  async function ouvrir(id: string) { setDetail((await apiGetSourced<Detail | null>(`/v1/trips/${id}`, null)).data); }
  async function viser(id: string, role: string) {
    setMsg("");
    try { const r = await apiPost<{ status: string }>(`/v1/trips/${id}/visa`, { role }); setMsg(`Visa ${role} → ${r.status}`); ouvrir(id); reload(); }
    catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }
  }

  const verdictColor = (v: string) => v === "INTERDITE" ? tokens.color.danger : v === "SOUMISE_A_LICENCE" ? tokens.color.warn : tokens.color.ok;
  const statutColor = (s: string) => s === "APPROVED" ? tokens.color.ok : s === "CANCELLED" || s === "REJECTED" ? tokens.color.danger : tokens.color.warn;
  const inp = { padding: 6, borderRadius: 6, border: "1px solid #ccc", fontSize: 13 };
  const th = { padding: 6, textAlign: "left" as const };
  return <div>
    {isDemo && <DemoModeBanner/>}
    <h3>Business Trip — voyages d'affaires (R222→R230)</h3>
    <p style={{ fontSize: tokens.font.sm, color: tokens.color.muted }}>L'avis cross-border s'affiche mais ne décide pas (R223) ;
      l'approbation est un visa uniforme (R225), jamais par le voyageur (R13). Contact reports mesurés, jamais imposés (R226).</p>
    {msg && <div style={{ margin: "8px 0", padding: 8, borderRadius: 6, background: "#eef4e6", fontSize: 12 }}>{msg}</div>}

    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
      <input style={{ ...inp, width: 180 }} placeholder="Destinations (FR,SA)" value={dest} onChange={(e) => setDest(e.target.value)}/>
      <input style={{ ...inp, width: 200 }} placeholder="Clients visités (ids)" value={cli} onChange={(e) => setCli(e.target.value)}/>
      <input type="date" style={inp} value={d1} onChange={(e) => setD1(e.target.value)}/>
      <input type="date" style={inp} value={d2} onChange={(e) => setD2(e.target.value)}/>
      <button disabled={isDemoMode()} style={{ ...inp, cursor: "pointer", background: tokens.color.olive700, color: "#fff", border: "none" }} onClick={creer}>Créer & soumettre</button>
    </div>

    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: tokens.font.sm }}>
      <thead><tr style={{ borderBottom: `2px solid ${tokens.color.olive700}` }}>
        <th style={th}>Destinations</th><th style={th}>Dates</th><th style={th}>Rév.</th><th style={th}>Statut</th></tr></thead>
      <tbody>
        {trips.map((t) => <tr key={t.id} onClick={() => ouvrir(t.id)} style={{ borderBottom: `1px solid ${tokens.color.border}`, cursor: "pointer" }}>
          <td style={{ padding: 6 }}>{(t.destinations ?? []).join(", ") || "—"}</td>
          <td>{t.dateStart} → {t.dateEnd}</td><td>V{t.revision}</td>
          <td><span style={{ color: statutColor(t.status), fontWeight: 700 }}>{t.status}</span></td>
        </tr>)}
        {!trips.length && <tr><td colSpan={4} style={{ padding: 6, color: tokens.color.muted }}>Aucun voyage.</td></tr>}
      </tbody>
    </table>

    {detail && <div style={{ marginTop: 16, padding: 14, borderRadius: tokens.radius.lg, border: `1px solid ${tokens.color.border}` }}>
      <h4 style={{ margin: "0 0 8px" }}>Voyage V{detail.revision} <span style={{ fontSize: 12, color: tokens.color.muted }}>· {detail.status} · {detail.dateStart} → {detail.dateEnd}</span></h4>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 240px" }}>
          <h5 style={{ margin: "4px 0" }}>Destinations & avis (R223)</h5>
          {detail.advisories.map((a, i) => <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>
            <strong>{a.jurisdiction}</strong> · {a.activite} → <span style={{ color: verdictColor(a.verdict), fontWeight: 700 }}>{a.verdict}</span>
            <span style={{ color: tokens.color.muted }}> (réf. {a.referentielVersion})</span></div>)}
          {!detail.advisories.length && <div style={{ fontSize: 12, color: tokens.color.muted }}>Aucun avis.</div>}
        </div>
        <div style={{ flex: "1 1 240px" }}>
          <h5 style={{ margin: "4px 0" }}>Signaux (R224/R228)</h5>
          {detail.signals.map((s, i) => <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: s.severite.startsWith("BLOQUANT") ? tokens.color.danger : tokens.color.warn, fontWeight: 700 }}>{s.type}</span>
            <span style={{ color: tokens.color.muted }}> · {s.detail}</span></div>)}
          {!detail.signals.length && <div style={{ fontSize: 12, color: tokens.color.muted }}>Aucun signal.</div>}
        </div>
        <div style={{ flex: "1 1 240px" }}>
          <h5 style={{ margin: "4px 0" }}>Visas d'approbation (R15/R225)</h5>
          {detail.visas.map((v, i) => <div key={i}>
            <VisaBadge visa={{ section: v.role, roleRequis: v.role, statut: v.status, signePar: v.signedBy, signeAt: v.signedAt }}/>
            {v.status === "PENDING" && <button disabled={isDemoMode()} style={{ ...inp, cursor: "pointer", background: tokens.color.gold, color: "#fff", border: "none", marginBottom: 6 }} onClick={() => viser(detail.id, v.role)}>Viser {v.role}</button>}
          </div>)}
          {!detail.visas.length && <div style={{ fontSize: 12, color: tokens.color.muted }}>Aucun visa.</div>}
        </div>
      </div>
    </div>}
  </div>;
}
