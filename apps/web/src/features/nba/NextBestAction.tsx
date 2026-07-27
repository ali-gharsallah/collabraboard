import React, { useState } from "react";
import { useApiOrSeed } from "../../lib/useApiOrSeed";
import { apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";

// Écran « Next Best Action » (SPEC-FRONT-CÂBLAGE v2, FE-NBA / FE-40..43 · MOD R243→R246). Câblé au
// backend : GET /v1/nba (suggestions décidables), POST /:id/decision (R244/R245). R44 strict : suggestion
// IA, décision HUMAINE ; Accepter/Ajuster/Rejeter n'exécutent rien directement (l'ACCEPT émet l'événement,
// le service Tâches en fait naître la tâche). Le motif de rejet peut être exigé par le tenant (R244).

type Suggestion = { id: string; contexte: string; subjectId: string; proposition: string; facteurs: string[]; statut: string; decision?: string | null; decidedBy?: string | null };

export function NextBestAction() {
  const { data: suggestions, isDemo, reload } = useApiOrSeed<Suggestion[]>("/v1/nba?status=PROPOSED", []);
  const [msg, setMsg] = useState("");

  async function decider(id: string, decision: "ACCEPT" | "ADJUST" | "REJECT") {
    setMsg("");
    let body: Record<string, unknown> = { decision };
    if (decision === "ADJUST") { const v = window.prompt("Ajustement (ex. délai en jours) :"); if (!v) return; body = { decision, adjustment: { valeur: v } }; }
    if (decision === "REJECT") { const r = window.prompt("Motif de rejet :") ?? undefined; body = { decision, rationale: r }; }
    try { await apiPost(`/v1/nba/${id}/decision`, body); setMsg(`Décision ${decision} enregistrée (tracée, R244).`); reload(); }
    catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }
  }

  const btn = (label: string, bg: string, on: () => void) =>
    <button disabled={isDemoMode()} onClick={on}
      style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: isDemoMode() ? "#ccc" : bg, color: "#fff", cursor: "pointer", fontSize: 12 }}>{label}</button>;
  return <div>
    {isDemo && <DemoModeBanner/>}
    <h3>Next Best Action — suggestion IA, décision humaine (R44)</h3>
    <p style={{ fontSize: tokens.font.sm, color: tokens.color.muted }}>Les suggestions sont générées par le moteur ; la décision
      est <strong>humaine</strong> et <strong>tracée</strong> (R244). Accepter/Ajuster n'exécutent rien directement — l'événement
      décidé est consommé par les modules (ex. une tâche naît du service Tâches). Rejeter peut exiger un motif (R244).</p>
    {msg && <div style={{ margin: "8px 0", padding: 8, borderRadius: 6, background: "#eef4e6", fontSize: 12 }}>{msg}</div>}
    {suggestions.map((s) => <div key={s.id} style={{ padding: 12, marginTop: 10, borderRadius: 10, background: tokens.color.surface, border: `1px solid ${tokens.color.border}` }}>
      <div style={{ fontWeight: 700 }}>{s.proposition}</div>
      <div style={{ fontSize: 12, color: tokens.color.muted, marginTop: 2 }}>Contexte {s.contexte} · sujet {s.subjectId}</div>
      <div style={{ fontSize: 11, color: "#777", margin: "4px 0" }}>Facteurs : {(s.facteurs ?? []).join(", ") || "—"}</div>
      <div style={{ fontSize: 11, color: tokens.color.leaf, marginBottom: 6 }}>Suggestion IA — décision humaine requise</div>
      <div style={{ display: "flex", gap: 6 }}>
        {btn("Accepter", tokens.color.ok, () => decider(s.id, "ACCEPT"))}
        {btn("Ajuster", tokens.color.gold, () => decider(s.id, "ADJUST"))}
        {btn("Rejeter", tokens.color.danger, () => decider(s.id, "REJECT"))}
      </div>
    </div>)}
    {!suggestions.length && <div style={{ marginTop: 12, color: tokens.color.muted, fontSize: 13 }}>Aucune suggestion en attente de décision.</div>}
  </div>;
}
