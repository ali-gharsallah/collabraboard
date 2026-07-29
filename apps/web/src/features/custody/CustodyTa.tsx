import React, { useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";

/**
 * `custodyta` — R301-R303 (dégel V2, ratifié 2026-07-28). Custody = positions du PORT
 * (jamais recopiées, refus gracieux rendu) ; le registre nominatif = JOURNAL rejoué (à
 * date) ; le rapprochement LISTE tous les écarts, typés, avec leur voie — la résolution
 * est motivée. Les refus backend (R7, R13) s'affichent tels quels (FE-04).
 */

type Pos = { portConfigure: boolean; depositaire?: string; positions: { titre: string; quantite: number }[] };
type Reg = { asOf: string; positions: { titre: string; titulaire: string; quantite: number }[];
  contrepassations: string[] };
type Rap = { depositaire: string; resolus: number;
  ecarts: { cle: string; type: string; titre: string; custody: number | null; registre: number | null; voie: string }[] };

export function CustodyTa() {
  const [pos, setPos] = useState<Pos | null>(null);
  const [reg, setReg] = useState<Reg | null>(null);
  const [rap, setRap] = useState<Rap | null>(null);
  const [asOf, setAsOf] = useState("");
  const [msg, setMsg] = useState("");

  const charger = async () => {
    const p = await apiGetSourced<Pos | null>("/v1/custody/positions", null);
    setPos(p.isDemo ? null : p.data);
    const q = asOf ? `?asOf=${encodeURIComponent(new Date(asOf).toISOString())}` : "";
    const r = await apiGetSourced<Reg | null>(`/v1/ta/registre${q}`, null);
    setReg(r.isDemo ? null : r.data);
  };
  const td = { fontSize: 12, borderTop: `1px solid ${tokens.color.border}`, padding: "3px 8px" };
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Custody & Transfer Agent — positions du port, registre rejoué, écarts listés</h3>
    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
      <button onClick={charger} disabled={isDemoMode()} style={{ fontSize: 12 }}>Charger</button>
      <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} style={{ fontSize: 12 }} title="registre à date (rejeu R48)"/>
      <button style={{ fontSize: 12 }} disabled={isDemoMode()} onClick={async () => {
        setMsg("");
        const g = await apiGetSourced<Rap | null>("/v1/custody/rapprochement", null);
        if (g.isDemo || !g.data) setMsg("Rapprochement indisponible — le port custody est requis (R301)");
        else setRap(g.data);
      }}>Rapprocher</button>
    </div>
    {msg && <p style={{ fontSize: 12, color: tokens.color.olive700 }}>{msg}</p>}
    {pos && !pos.portConfigure && <p style={{ fontSize: 12, color: tokens.color.muted }}>
      Aucun port custody — positions non servies, rien n&apos;est simulé (R167). Le registre reste pleinement fonctionnel.</p>}
    {pos?.portConfigure && <div>
      <h4 style={{ fontSize: 13, margin: "4px 0" }}>Positions dépositaire ({pos.depositaire}) — lues, jamais recopiées</h4>
      <table style={{ borderCollapse: "collapse" }}><tbody>
        {pos.positions.map((p) => <tr key={p.titre}><td style={td}><strong>{p.titre}</strong></td><td style={td}>{p.quantite}</td></tr>)}
      </tbody></table>
    </div>}
    {reg && <div style={{ marginTop: 8 }}>
      <h4 style={{ fontSize: 13, margin: "4px 0" }}>Registre nominatif au {reg.asOf.slice(0, 10)} (rejeu du journal)</h4>
      <table style={{ borderCollapse: "collapse" }}><tbody>
        {reg.positions.map((p, i) => <tr key={i}>
          <td style={td}><strong>{p.titre}</strong></td>
          <td style={{ ...td, color: tokens.color.muted }}>{p.titulaire.slice(0, 8)}…</td>
          <td style={{ ...td, color: p.quantite < 0 ? "#b91c1c" : undefined }}>{p.quantite}</td>
        </tr>)}
      </tbody></table>
      {reg.contrepassations.length > 0 && <p style={{ fontSize: 12, color: tokens.color.muted }}>
        Contre-passations : {reg.contrepassations.join(", ")} (motivées, jamais une réécriture)</p>}
    </div>}
    {rap && <div style={{ marginTop: 8 }}>
      <h4 style={{ fontSize: 13, margin: "4px 0" }}>Écarts custody ↔ registre — TOUS listés, {rap.resolus} résolu(s) compté(s)</h4>
      {rap.ecarts.length === 0 && <p style={{ fontSize: 12, color: tokens.color.olive700 }}>Aucun écart ouvert</p>}
      <table style={{ borderCollapse: "collapse" }}><tbody>
        {rap.ecarts.map((e) => <tr key={e.cle}>
          <td style={td}><strong>{e.titre}</strong></td>
          <td style={td}>{e.type}</td>
          <td style={td}>custody {e.custody ?? "—"} / registre {e.registre ?? "—"}</td>
          <td style={{ ...td, color: tokens.color.muted }}>voie : {e.voie}</td>
        </tr>)}
      </tbody></table>
    </div>}
  </div>;
}
