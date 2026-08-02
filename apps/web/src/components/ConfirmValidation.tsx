import React, { useState } from "react";

// Contrat UX transverse : TOUTE validation / publication / commit passe par cette modale de
// confirmation, qui affiche un PRÉ-VOL « ce qui reste à valider » (items ok/en-attente) avant
// d'engager l'action. Optionnellement, elle recueille un motif/cause (input) transmis à onConfirm.
// Le back reste l'autorité — la modale prévient l'humain, elle ne remplace pas la garde serveur.

export type PreflightItem = { label: string; ok: boolean };

export function ConfirmValidation(props: {
  title: string;
  message?: string;
  items?: PreflightItem[];                 // pré-vol : chaque point à vérifier avant de valider
  input?: { label: string; placeholder?: string; required?: boolean };
  confirmLabel?: string;
  danger?: boolean;                        // action destructrice (rouge) vs. verte
  blockIfIncomplete?: boolean;             // interdit la confirmation tant qu'un item est en attente
  busy?: boolean;
  onConfirm: (value?: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const { title, message, items, input, confirmLabel, danger, blockIfIncomplete, busy } = props;
  const [val, setVal] = useState("");
  const pending = (items ?? []).filter((i) => !i.ok);
  const inputManquant = !!input?.required && !val.trim();
  const bloque = (!!blockIfIncomplete && pending.length > 0) || inputManquant || !!busy;
  return (
    <div role="dialog" aria-modal="true" aria-label={title}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "flex",
        alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={(e) => { if (e.target === e.currentTarget && !busy) props.onCancel(); }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 22, width: 460, maxWidth: "92vw",
        boxShadow: "0 12px 40px rgba(0,0,0,.25)", maxHeight: "88vh", overflowY: "auto" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>{title}</h3>
        {message && <p style={{ margin: "0 0 12px", fontSize: 13, color: "#444" }}>{message}</p>}

        {items && items.length > 0 && <div style={{ margin: "0 0 12px" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: .5, color: "#888", marginBottom: 6 }}>
            À vérifier avant validation</div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {items.map((it, i) => <li key={i} style={{ fontSize: 13, padding: "3px 0",
              color: it.ok ? "#4A6B28" : "#B5483C", display: "flex", gap: 8 }}>
              <span aria-hidden style={{ width: 16 }}>{it.ok ? "✓" : "✗"}</span>{it.label}</li>)}
          </ul>
          {blockIfIncomplete && pending.length > 0 &&
            <p style={{ fontSize: 12, color: "#B5483C", margin: "8px 0 0" }}>
              {pending.length} point(s) restant(s) — validation impossible tant que tout n'est pas prêt.</p>}
        </div>}

        {input && <label style={{ display: "block", margin: "0 0 12px" }}>
          <span style={{ fontSize: 12, color: "#555" }}>{input.label}{input.required && " *"}</span>
          <input autoFocus value={val} placeholder={input.placeholder} onChange={(e) => setVal(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #ccc", fontSize: 13 }} />
        </label>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
          <button onClick={props.onCancel} disabled={busy}
            style={{ padding: "8px 14px", fontSize: 13, borderRadius: 8, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}>
            Annuler</button>
          <button onClick={() => props.onConfirm(input ? val : undefined)} disabled={bloque}
            style={{ padding: "8px 16px", fontSize: 13, borderRadius: 8, border: "none", color: "#fff",
              background: bloque ? "#aaa" : danger ? "#B5483C" : "#4A6B28", cursor: bloque ? "not-allowed" : "pointer" }}>
            {busy ? "…" : (confirmLabel ?? "Confirmer")}</button>
        </div>
      </div>
    </div>
  );
}

// Contrôleur : `const { ask, modal } = useConfirmGate();` — `ask(config)` ouvre la modale,
// `{modal}` la rend. La confirmation exécute `config.onConfirm(value?)` puis referme.
type GateCfg = Omit<Parameters<typeof ConfirmValidation>[0], "onCancel" | "busy">;
export function useConfirmGate() {
  const [cfg, setCfg] = useState<GateCfg | null>(null);
  const [busy, setBusy] = useState(false);
  const ask = (config: GateCfg) => setCfg(config);
  const modal = cfg ? <ConfirmValidation {...cfg} busy={busy}
    onCancel={() => { if (!busy) setCfg(null); }}
    onConfirm={async (value) => { setBusy(true); try { await cfg.onConfirm(value); } finally { setBusy(false); setCfg(null); } }} /> : null;
  return { ask, modal };
}
