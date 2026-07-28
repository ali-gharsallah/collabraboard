import React, { useEffect, useState } from "react";
import { apiGetSourced, apiPost, isDemoMode, OliveError } from "../../lib/api";
import { ouvrirFlux } from "../../lib/flux";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";

/**
 * `txrisk` — R298 (dégel V1, ratifié 2026-07-28) : une SURFACE du moteur CPSI, jamais un
 * second moteur. L'écran REND : le flux R297 (journal servi), le live par SSE (R287 —
 * références seules, refetch par l'API), les tendances rejouées à date, et le DRILL vers
 * l'AML Investigation (où vivent scénarios et alertes). « Alimenter » pousse les agrégats
 * AU moteur — rien n'est décidé ici. Port absent = refus gracieux rendu (R167).
 */

type Etat = { portConfigure: boolean; source?: string; transactions: number };
type Txn = { id: string; compte: string; dateValeur: string; montant: string; devise: string;
  sens: string; type: string; contrepartieNom?: string | null; contrepartiePays?: string | null };
type Tendances = { asOf: string; parMois: Record<string, { n: number; volume: number }> };

export function TxRisk({ onNaviguer }: { onNaviguer?: (ecran: string) => void }) {
  const [etat, setEtat] = useState<Etat | null>(null);
  const [flux, setFlux] = useState<Txn[] | null>(null);
  const [tend, setTend] = useState<Tendances | null>(null);
  const [asOf, setAsOf] = useState("");
  const [live, setLive] = useState(0);
  const [msg, setMsg] = useState("");

  const charger = async () => {
    const e = await apiGetSourced<Etat | null>("/v1/txflux/etat", null);
    setEtat(e.isDemo ? null : e.data);
    const f = await apiGetSourced<Txn[] | null>("/v1/txflux", null);
    setFlux(f.isDemo ? null : f.data);
    const q = asOf ? `?asOf=${encodeURIComponent(new Date(asOf).toISOString())}` : "";
    const t = await apiGetSourced<Tendances | null>(`/v1/txrisk/tendances${q}`, null);
    setTend(t.isDemo ? null : t.data);
  };

  useEffect(() => {                                  // R287 : le live descend — référence, puis REFETCH par l'API
    if (isDemoMode()) return;
    return ouvrirFlux((ref) => { if (ref.type === "tx.flux.importee") { setLive((n) => n + 1); void charger(); } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const td = { fontSize: 12, borderTop: `1px solid ${tokens.color.border}`, padding: "3px 8px" };
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Transactions Risk Monitoring — une surface du moteur CPSI (les scénarios vivent au catalogue)</h3>
    <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
      <button onClick={charger} disabled={isDemoMode()} style={{ fontSize: 12 }}>Charger</button>
      <button disabled={isDemoMode()} style={{ fontSize: 12 }} onClick={async () => {
        setMsg("");
        try { const r = await apiPost<{ clients: number }>("/v1/txrisk/alimenter", {});
          setMsg(`Attributs poussés au moteur pour ${r.clients} client(s) — l'évaluation vit au catalogue CPSI.`); }
        catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }
      }}>Alimenter le moteur</button>
      <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} style={{ fontSize: 12 }}/>
      {onNaviguer && <button style={{ fontSize: 12 }} onClick={() => onNaviguer("amlws")}>→ AML Investigation (scénarios & alertes)</button>}
      {live > 0 && <span style={{ fontSize: 11, color: tokens.color.olive700 }}>● live : {live} événement(s) reçu(s)</span>}
    </div>
    {msg && <p data-testid="msg-txrisk" style={{ fontSize: 12, color: tokens.color.olive700 }}>{msg}</p>}
    {etat && !etat.portConfigure && <p style={{ fontSize: 12, color: tokens.color.muted }}>
      Aucun port core banking configuré — aucun flux, rien n&apos;est simulé (R167/R297).</p>}
    {etat?.portConfigure && <p style={{ fontSize: 12 }}>Source : <strong>{etat.source}</strong> · {etat.transactions} transaction(s) au journal</p>}
    {tend && <p style={{ fontSize: 12 }}>Tendances au {tend.asOf} (rejouées du journal) : {Object.entries(tend.parMois)
      .map(([m, v]) => `${m} — ${v.n} tx / ${v.volume.toLocaleString("fr-CH")} `).join(" · ") || "aucune"}</p>}
    {flux && flux.length > 0 && <table style={{ borderCollapse: "collapse" }}><tbody>
      {flux.slice(0, 30).map((t) => <tr key={t.id}>
        <td style={td}>{t.dateValeur.slice(0, 10)}</td>
        <td style={td}><strong>{t.sens === "DEBIT" ? "−" : "+"}{Number(t.montant).toLocaleString("fr-CH")} {t.devise}</strong></td>
        <td style={td}>{t.type}</td>
        <td style={td}>{t.compte}</td>
        <td style={{ ...td, color: tokens.color.muted }}>{t.contrepartieNom ?? "—"}{t.contrepartiePays ? ` (${t.contrepartiePays})` : ""}</td>
      </tr>)}
    </tbody></table>}
  </div>;
}
