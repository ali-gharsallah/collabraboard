import React, { useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";

/**
 * `fx` — R299 (dégel V1, ratifié 2026-07-28) : une LECTURE d'exposition par devise —
 * aucune opération de change, aucun ordre. Pas de port FX = montants en devise d'origine
 * avec MENTION rendue (jamais un taux inventé, R167). Un seuil franchi COLORE et a déjà
 * été notifié par le backend (R39) — rien n'est bloqué ici.
 */

type Expo = { parDevise: Record<string, { entrees: number; sorties: number; exposition: number;
  enChf: number | null; seuilFranchi: boolean }>; conversion: string };

export function FxExposition() {
  const [expo, setExpo] = useState<Expo | null>(null);
  const charger = async () => {
    const r = await apiGetSourced<Expo | null>("/v1/fx/exposition", null);
    setExpo(r.isDemo ? null : r.data);
  };
  const td = { fontSize: 12, borderTop: `1px solid ${tokens.color.border}`, padding: "3px 8px" };
  const fmt = (n: number) => n.toLocaleString("fr-CH");
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Multi-devise & FX — l&apos;exposition, servie (lecture seule — aucune exécution)</h3>
    <button onClick={charger} disabled={isDemoMode()} style={{ fontSize: 12, marginBottom: 10 }}>Charger</button>
    {expo && <div>
      <p style={{ fontSize: 12, color: tokens.color.muted }}>{expo.conversion}</p>
      <table style={{ borderCollapse: "collapse" }}><tbody>
        {Object.entries(expo.parDevise).map(([devise, d]) => <tr key={devise}>
          <td style={td}><strong>{devise}</strong></td>
          <td style={td}>entrées {fmt(d.entrees)}</td>
          <td style={td}>sorties {fmt(d.sorties)}</td>
          <td style={{ ...td, color: d.seuilFranchi ? "#b91c1c" : undefined }}>
            exposition <strong>{fmt(d.exposition)}</strong>{d.seuilFranchi ? " — seuil franchi (notifié)" : ""}</td>
          <td style={{ ...td, color: tokens.color.muted }}>{d.enChf != null ? `≈ ${fmt(d.enChf)} CHF` : "devise d'origine"}</td>
        </tr>)}
      </tbody></table>
    </div>}
  </div>;
}
