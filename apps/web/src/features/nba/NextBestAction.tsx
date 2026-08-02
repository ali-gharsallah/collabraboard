import React, { useState } from "react";
import { useApiOrSeed } from "../../lib/useApiOrSeed";
import { apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { useConfirmGate } from "../../components/ConfirmValidation";  // contrat UX
import { tokens } from "../../theme/tokens";

// Écran « Next Best Action » (SPEC-FRONT-CÂBLAGE v2, FE-NBA / FE-40..43 · MOD R243→R246). Câblé au
// backend : GET /v1/nba (suggestions décidables), POST /:id/decision (R244/R245). R44 strict : suggestion
// IA, décision HUMAINE ; Accepter/Ajuster/Rejeter n'exécutent rien directement (l'ACCEPT émet l'événement,
// le service Tâches en fait naître la tâche). Le motif de rejet peut être exigé par le tenant (R244).

type Suggestion = { id: string; contexte: string; subjectId: string; proposition: string; facteurs: string[]; statut: string; decision?: string | null; decidedBy?: string | null };

export function NextBestAction() {
  const { data: suggestions, isDemo, reload } = useApiOrSeed<Suggestion[]>("/v1/nba?status=PROPOSED", []);
  const [msg, setMsg] = useState("");
  const { ask, modal } = useConfirmGate();               // contrat UX : confirmation + pré-vol

  async function decider(id: string, body: Record<string, unknown>) {
    setMsg("");
    try { await apiPost(`/v1/nba/${id}/decision`, body); setMsg(`Décision ${body.decision} enregistrée (tracée, R244).`); reload(); }
    catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }
  }
  const demander = (id: string, decision: "ACCEPT" | "ADJUST" | "REJECT") => {
    if (decision === "ACCEPT") return ask({ title: "Accepter la suggestion (R244)",
      message: "Décision humaine tracée. L'événement décidé sera consommé par les modules (ex. naissance d'une tâche).",
      confirmLabel: "Accepter", onConfirm: () => decider(id, { decision }) });
    if (decision === "ADJUST") return ask({ title: "Ajuster la suggestion (R244)",
      input: { label: "Ajustement (ex. délai en jours)", required: true }, confirmLabel: "Ajuster",
      onConfirm: (v) => decider(id, { decision, adjustment: { valeur: v } }) });
    return ask({ title: "Rejeter la suggestion (R244)", danger: true,
      input: { label: "Motif de rejet (peut être exigé par le tenant)" }, confirmLabel: "Rejeter",
      onConfirm: (r) => decider(id, { decision, rationale: r || undefined }) });
  };

  const btn = (label: string, bg: string, on: () => void) =>
    <button disabled={isDemoMode()} onClick={on}
      style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: isDemoMode() ? "#ccc" : bg, color: "#fff", cursor: "pointer", fontSize: 12 }}>{label}</button>;
  return <div>
    {modal}
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
        {btn("Accepter", tokens.color.ok, () => demander(s.id, "ACCEPT"))}
        {btn("Ajuster", tokens.color.gold, () => demander(s.id, "ADJUST"))}
        {btn("Rejeter", tokens.color.danger, () => demander(s.id, "REJECT"))}
      </div>
    </div>)}
    {!suggestions.length && <div style={{ marginTop: 12, color: tokens.color.muted, fontSize: 13 }}>Aucune suggestion en attente de décision.</div>}
  </div>;
}
