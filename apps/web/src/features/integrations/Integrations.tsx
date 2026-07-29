import React, { useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";

/**
 * `integrations` — application du canon triage final (ratifié 2026-07-28), aucune règle.
 * L'ÉTAT des ports déclarés, en LECTURE (registre /v1/ports — R167-169 core, porte CPSI R250,
 * port IA) + les modules actifs (R279). « Configurer » RENVOIE vers l'écran du port concerné
 * (pattern SD-05) — rien ne s'écrit ici.
 */

type Port = { portId: string; libelle?: string; statut?: string; lastCheckAt?: string | null };
type Mods = { enforcement: boolean; modules: { code: string }[] | null };
const RENVOIS: Record<string, string> = { corebanking: "écran Settlement", ia: "écran Ports", coffre: "écran GED / coffre", cpsi: "CPSI · Barèmes" };

export function Integrations() {
  const [ports, setPorts] = useState<Port[] | null>(null);
  const [mods, setMods] = useState<Mods | null>(null);
  const charger = async () => {
    const p = await apiGetSourced<Port[] | null>("/v1/ports", null);
    setPorts(p.isDemo ? null : p.data);
    const m = await apiGetSourced<Mods | null>("/v1/modules/actifs", null);
    setMods(m.isDemo ? null : m.data);
  };
  const td = { fontSize: 12, borderTop: `1px solid ${tokens.color.border}`, padding: "3px 8px" };
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Intégrations — l&apos;état des ports, servi (lecture seule)</h3>
    <button onClick={charger} disabled={isDemoMode()} style={{ fontSize: 12, marginBottom: 10 }}>Charger</button>
    {ports && <table style={{ borderCollapse: "collapse" }}><tbody>
      {ports.map((p) => <tr key={p.portId}>
        <td style={td}><strong>{p.libelle ?? p.portId}</strong></td>
        <td style={td}>{p.statut ?? "—"}</td>
        <td style={td}>{p.lastCheckAt ? new Date(p.lastCheckAt).toLocaleString("fr-CH") : "jamais vérifié"}</td>
        <td style={{ ...td, color: tokens.color.muted }}>→ {RENVOIS[p.portId] ?? "écran du port"}</td>
      </tr>)}
    </tbody></table>}
    {mods && <p style={{ fontSize: 12, marginTop: 10 }}>Licence (R279) : {mods.enforcement
      ? <>modules actifs — {(mods.modules ?? []).map((m) => m.code).join(", ") || "aucun"}</>
      : "mode socle (tout actif)"}</p>}
  </div>;
}
