import React, { useCallback, useEffect, useState } from "react";
import { apiGetSourced, isDemoMode } from "../lib/api";
import { tokens } from "../theme/tokens";

// PATRON DE TUILE PARTAGÉ — Home (R253) et Command Center (R289) : « un patron, deux écrans ».
// Une tuile = UNE source ratifiée, un état indépendant (chargement / indisponible / vide / données).
// R289 ajoute (optionnels, Home inchangé) : testId, alerte(data) → « ambre » | « rouge » (command_seuils
// COLORE, ne bloque jamais — R39).
export function Tuile<T>({ titre, path, seed, rendre, clic, fluxVersion, testId, alerte }: {
  titre: string; path: string; seed: T; rendre: (data: T) => React.ReactNode; clic?: string;
  fluxVersion?: number; testId?: string; alerte?: (data: T) => "ambre" | "rouge" | null;
}) {
  const [etat, setEtat] = useState<{ data: T | null; indisponible: boolean; charge: boolean }>({ data: null, indisponible: false, charge: false });
  const charger = useCallback(async () => {
    setEtat({ data: null, indisponible: false, charge: false });
    const r = await apiGetSourced<T>(path, seed);
    // API configurée mais appel retombé sur le seed ⇒ la SOURCE est indisponible (HO-04 : pas un zéro).
    if (!isDemoMode() && r.isDemo) setEtat({ data: null, indisponible: true, charge: true });
    else setEtat({ data: r.data, indisponible: false, charge: true });
  }, [path]);
  useEffect(() => { charger(); }, [charger, fluxVersion]);        // R287 : une référence du flux ⇒ la tuile REFETCHE sa source
  const niveau = etat.charge && !etat.indisponible && etat.data != null && alerte ? alerte(etat.data as T) : null;
  const bord = niveau === "rouge" ? tokens.color.danger : niveau === "ambre" ? tokens.color.gold : tokens.color.border;
  return <div data-tuile={titre} {...(testId ? { "data-testid": testId } : {})} {...(niveau ? { "data-alerte": niveau } : {})}
    style={{ flex: "1 1 240px", padding: 12, borderRadius: tokens.radius.lg,
    background: tokens.color.surface, border: `1px solid ${bord}`, minHeight: 90 }}>
    <div style={{ fontWeight: 700, fontSize: 13, color: tokens.color.olive700 }}>{titre}</div>
    {!etat.charge && <div style={{ marginTop: 8, height: 18, borderRadius: 4, background: "#eee" }}/>}
    {etat.charge && etat.indisponible && <div style={{ marginTop: 8, fontSize: 12, color: tokens.color.danger }}>
      indisponible <button onClick={charger} style={{ marginLeft: 6, fontSize: 11, padding: "2px 8px", borderRadius: 4,
        border: `1px solid ${tokens.color.border}`, background: "#fff", cursor: "pointer" }}>réessayer</button></div>}
    {etat.charge && !etat.indisponible && <div style={{ marginTop: 6, fontSize: 12 }}>{rendre(etat.data as T)}</div>}
    {clic && <div style={{ marginTop: 6, fontSize: 11, color: tokens.color.muted }}>→ {clic}</div>}
  </div>;
}
