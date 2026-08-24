import React, { useState } from "react";
import { useApiOrSeed } from "../../lib/useApiOrSeed";
import { apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { useConfirmGate } from "../../components/ConfirmValidation";  // contrat UX
import { tokens } from "../../theme/tokens";

// Écran « Tâches » (SPEC-FRONT-CÂBLAGE v2, FE-TASK / FE-30..32 · MOD R239→R242). Câblé au backend :
// GET /v1/tasks (liste scopée SERVEUR R240), POST /:id/complete (complétion événementielle R241).
// Le SLA est informatif (R242/R39). La visibilité est décidée côté serveur — le front n'élargit rien.

type Task = { id: string; type: string; assignee: string; subjectId?: string | null; echeance?: string | null; statut: string; completedBy?: string | null };

export function Tasks() {
  const { data: tasks, isDemo, reload } = useApiOrSeed<Task[]>("/v1/tasks", []);
  const [msg, setMsg] = useState("");
  const { ask, modal } = useConfirmGate();                 // contrat UX : confirmation + pré-vol
  const [routage, setRoutage] = useState({ type: "", role: "", subjectId: "", cible: "" });  // R38

  async function completer(id: string, comment?: string) {
    setMsg("");
    try { await apiPost(`/v1/tasks/${id}/complete`, { comment }); setMsg("Tâche complétée."); reload(); }
    catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }
  }
  // R38 — router une tâche vers un rôle (personne in-scope résolue côté serveur).
  async function router() {
    setMsg("");
    try {
      await apiPost("/v1/tasks/routed", { type: routage.type, role: routage.role, subjectType: "KYC",
        subjectId: routage.subjectId || undefined, cible: routage.cible || undefined });
      setMsg("Tâche routée."); setRoutage({ type: "", role: "", subjectId: "", cible: "" }); reload();
    } catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }
  }

  const enRetard = (t: Task) => t.echeance && t.statut === "OPEN" && t.echeance < new Date().toISOString().slice(0, 10);
  const statutColor = (t: Task) => t.statut === "COMPLETED" ? tokens.color.ok : t.statut === "CANCELLED" ? tokens.color.muted : enRetard(t) ? tokens.color.danger : tokens.color.warn;
  const th = { padding: 6, textAlign: "left" as const };
  const inp = { padding: 6, borderRadius: 6, border: `1px solid ${tokens.color.border}`, fontSize: 12 };
  return <div>
    {modal}
    {isDemo && <DemoModeBanner/>}
    <h3>Tâches</h3>

    {/* R38 — routage rôle→personne in-scope (le serveur résout/refuse ; confirmation au contrat) */}
    <div style={{ margin: "8px 0 14px", padding: 10, border: `1px solid ${tokens.color.border}`, borderRadius: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <strong style={{ fontSize: 12 }}>Router une tâche</strong>
      <input style={inp} placeholder="type" value={routage.type} onChange={(e) => setRoutage({ ...routage, type: e.target.value })}/>
      <input style={inp} placeholder="rôle (RM, CO…)" value={routage.role} onChange={(e) => setRoutage({ ...routage, role: e.target.value })}/>
      <input style={inp} placeholder="dossier (code KYC)" value={routage.subjectId} onChange={(e) => setRoutage({ ...routage, subjectId: e.target.value })}/>
      <input style={inp} placeholder="cible (optionnel)" value={routage.cible} onChange={(e) => setRoutage({ ...routage, cible: e.target.value })}/>
      <button disabled={isDemoMode() || !routage.type || !routage.role}
        onClick={() => ask({ title: "Router une tâche (R38)",
          message: "La tâche ne sera routée qu'à une personne connaissant la relation (in-scope) ; sinon le serveur refuse.",
          items: [{ label: `Rôle cible : ${routage.role || "—"}`, ok: !!routage.role },
            { label: routage.cible ? `Cible : ${routage.cible} (doit être in-scope)` : "Auto-affectation au 1er membre in-scope", ok: true }],
          confirmLabel: "Router", onConfirm: router })}
        style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: tokens.color.olive700, color: "#fff", cursor: "pointer", fontSize: 12 }}>Router</button>
    </div>
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
          <td>{t.statut === "OPEN" && <button disabled={isDemoMode()}
            onClick={() => ask({ title: "Compléter la tâche (R241)",
              message: "La complétion est un événement tracé et immuable.",
              input: { label: "Commentaire de complétion", placeholder: "optionnel" }, confirmLabel: "Compléter",
              onConfirm: (comment) => completer(t.id, comment) })}
            style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: tokens.color.olive700, color: "#fff", cursor: "pointer", fontSize: 12 }}>Compléter</button>}</td>
        </tr>)}
        {!tasks.length && <tr><td colSpan={6} style={{ padding: 6, color: tokens.color.muted }}>Aucune tâche dans votre périmètre.</td></tr>}
      </tbody>
    </table>
  </div>;
}
