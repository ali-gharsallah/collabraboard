import React, { useState } from "react";
import { useApiOrSeed } from "../../lib/useApiOrSeed";
import { apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";

// Écran « Tâches » (SPEC-FRONT-CÂBLAGE v2, FE-TASK / FE-30..32 · MOD R239→R242). Câblé au backend :
// GET /v1/tasks (liste scopée SERVEUR R240), POST /:id/complete (complétion événementielle R241).
// Le SLA est informatif (R242/R39). La visibilité est décidée côté serveur — le front n'élargit rien.

type Task = { id: string; type: string; assignee: string; subjectId?: string | null; echeance?: string | null; statut: string; completedBy?: string | null };

export function Tasks() {
  const { data: tasks, isDemo, reload } = useApiOrSeed<Task[]>("/v1/tasks", []);
  const [msg, setMsg] = useState("");

  async function completer(id: string) {
    setMsg("");
    const comment = window.prompt("Commentaire de complétion (optionnel) :") ?? undefined;
    try { await apiPost(`/v1/tasks/${id}/complete`, { comment }); setMsg("Tâche complétée."); reload(); }
    catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }
  }

  const enRetard = (t: Task) => t.echeance && t.statut === "OPEN" && t.echeance < new Date().toISOString().slice(0, 10);
  const statutColor = (t: Task) => t.statut === "COMPLETED" ? tokens.color.ok : t.statut === "CANCELLED" ? tokens.color.muted : enRetard(t) ? tokens.color.danger : tokens.color.warn;
  const th = { padding: 6, textAlign: "left" as const };
  return <div>
    {isDemo && <DemoModeBanner/>}
    <h3>Tâches</h3>
    <p style={{ fontSize: tokens.font.sm, color: tokens.color.muted }}>Liste scopée côté serveur (soi / équipe / tout, R240) —
      le front n'élargit jamais le périmètre. La complétion est un événement tracé (R241). Le retard est un signal, jamais un verrou (R242/R39).</p>
    {msg && <div style={{ margin: "8px 0", padding: 8, borderRadius: 6, background: "#eef4e6", fontSize: 12 }}>{msg}</div>}
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: tokens.font.sm }}>
      <thead><tr style={{ borderBottom: `2px solid ${tokens.color.olive700}` }}>
        <th style={th}>Type</th><th style={th}>Assigné</th><th style={th}>Sujet</th><th style={th}>Échéance</th><th style={th}>Statut</th><th style={th}>Action</th></tr></thead>
      <tbody>
        {tasks.map((t) => <tr key={t.id} style={{ borderBottom: `1px solid ${tokens.color.border}` }}>
          <td style={{ padding: 6 }}>{t.type}</td>
          <td style={{ fontSize: 11 }}>{t.assignee}</td><td style={{ fontSize: 11 }}>{t.subjectId ?? "—"}</td>
          <td>{t.echeance ?? "—"}{enRetard(t) && <span style={{ color: tokens.color.danger }}> · en retard</span>}</td>
          <td><span style={{ color: statutColor(t), fontWeight: 700 }}>{t.statut}</span></td>
          <td>{t.statut === "OPEN" && <button disabled={isDemoMode()} onClick={() => completer(t.id)}
            style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: tokens.color.olive700, color: "#fff", cursor: "pointer", fontSize: 12 }}>Compléter</button>}</td>
        </tr>)}
        {!tasks.length && <tr><td colSpan={6} style={{ padding: 6, color: tokens.color.muted }}>Aucune tâche dans votre périmètre.</td></tr>}
      </tbody>
    </table>
  </div>;
}
