// FilterBar uniforme — R404 (R-FB, spec/SPEC-FILTERBAR.md, drop PO 2026-08-04).
// Un seul composant pour tous les filtres de toutes les listes (R-FB.1). Portage TSX du bloc
// « FILTERBAR UNIFORME » de la démo, même contrat (R-FB.2).
//
// Thin component (R-FB.2) : il relaie, il ne décide pas. Seul état interne = open/close du
// panneau ; l'état des filtres reste dans l'écran hôte. `value === allValue` (défaut "ALL")
// ⇒ filtre inactif. Tout `onChange` de filtre est responsable de remettre la pagination à 0
// côté hôte (R-FB.3). Pour un filtre booléen (R-FB.5), utiliser une combobox binaire
// [["ALL","Indifférent"],["ON","Oui"]] et mapper dans le `onChange`, jamais un toggle isolé.
import React from "react";
import { tokens } from "../theme/tokens";

export type FilterOption = [value: string, label: string];

export interface FilterSpec {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: FilterOption[];
  /** Valeur « tous » ; défaut "ALL". `value !== allValue` ⇒ filtre actif. */
  allValue?: string;
}

export interface FilterBarProps {
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  filters: FilterSpec[];
  /** Nombre de résultats après filtre (compteur). */
  shown?: number;
  /** Total avant filtre (compteur `shown / total`). */
  total?: number;
  /** Remet chaque filtre à son allValue (responsabilité de l'hôte). */
  onReset: () => void;
  style?: React.CSSProperties;
}

const T = tokens.color;
const allOf = (f: FilterSpec) => (f.allValue !== undefined ? f.allValue : "ALL");
const labelOf = (f: FilterSpec, v: string) => {
  const o = (f.options || []).find((x) => x[0] === v);
  return o ? o[1] : String(v);
};

export function FilterBar(props: FilterBarProps) {
  const [open, setOpen] = React.useState(false);
  const filters = props.filters || [];
  const active = filters.filter((f) => f.value !== allOf(f));

  return (
    <div
      data-testid="filterbar"
      style={{ marginBottom: 14, flex: "1 1 auto", minWidth: 280, ...(props.style || {}) }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {props.search && (
          <input
            value={props.search.value}
            onChange={(e) => props.search!.onChange(e.target.value)}
            placeholder={props.search.placeholder || "Rechercher…"}
            aria-label={props.search.placeholder || "Rechercher"}
            style={{
              flex: 1, minWidth: 180, boxSizing: "border-box", padding: "9px 13px",
              borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 12.5, background: "#fff",
            }}
          />
        )}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          style={{
            padding: "9px 14px", borderRadius: 10,
            border: `1px solid ${open || active.length ? T.olive600 : T.border}`,
            background: open ? T.olive600 : active.length ? T.surface : "#fff",
            color: open ? "#fff" : active.length ? T.olive700 : T.muted,
            fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
          }}
        >
          {(open ? "▾ " : "▸ ") + "Filtres" + (active.length ? " · " + active.length : "")}
        </button>
        {active.length > 0 && (
          <button
            type="button"
            onClick={props.onReset}
            style={{
              padding: "9px 12px", borderRadius: 10, border: `1px solid ${T.border}`,
              background: "#fff", color: T.muted, fontSize: 11.5, cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            {"✕ Réinitialiser"}
          </button>
        )}
        {props.shown != null && (
          <span style={{ fontSize: 11, color: T.muted, whiteSpace: "nowrap" }}>
            {props.shown + (props.total != null ? " / " + props.total : "") + " résultat(s)"}
          </span>
        )}
      </div>

      {open && (
        <div
          style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10,
            marginTop: 10, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14,
          }}
        >
          {filters.map((f) => {
            const isAct = f.value !== allOf(f);
            return (
              <div key={f.id}>
                <div
                  style={{
                    fontSize: 9.5, fontWeight: 800, color: T.muted, textTransform: "uppercase",
                    letterSpacing: 0.5, marginBottom: 4,
                  }}
                >
                  {f.label}
                </div>
                <select
                  value={f.value}
                  aria-label={f.label}
                  onChange={(e) => f.onChange(e.target.value)}
                  style={{
                    width: "100%", padding: "8px 10px", borderRadius: 9,
                    border: `1px solid ${isAct ? T.olive600 : T.border}`, fontSize: 12, background: "#fff",
                    color: isAct ? T.olive700 : T.muted, fontWeight: isAct ? 700 : 400, cursor: "pointer",
                  }}
                >
                  {(f.options || []).map((o) => (
                    <option key={o[0]} value={o[0]}>
                      {o[1]}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}

      {active.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {active.map((f) => (
            <button
              type="button"
              key={f.id}
              onClick={() => f.onChange(allOf(f))}
              title="Retirer ce filtre"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20,
                border: `1px solid ${T.olive600}`, background: T.surface, color: T.olive700,
                fontSize: 10.5, fontWeight: 700, cursor: "pointer",
              }}
            >
              {f.label + " : " + labelOf(f, f.value)}
              <span style={{ fontWeight: 900 }}>{"×"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default FilterBar;
