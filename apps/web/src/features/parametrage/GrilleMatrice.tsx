import React from "react";
import { tokens } from "../../theme/tokens";

// R283/RW-04 — LE composant de grille commun : sections × questions × colonnes paramétrées.
// UN composant, TROIS configurations : sdkyc (droits par rôle), sdar et sdgar (sélection de
// profil de review). Les écrans configurent les cellules — ils ne dupliquent jamais la grille.

export type SectionGrille = { code: string; label: string; visas?: string[];
  questions: { code: string; label: string }[] };

export function GrilleMatrice({ sections, colonnes, cellule, celluleStyle, enTeteSection }: {
  sections: SectionGrille[];
  colonnes: string[];
  cellule: (q: { code: string; label: string }, colonne: string, section: SectionGrille) => React.ReactNode;
  celluleStyle?: (q: { code: string; label: string }, colonne: string, section: SectionGrille) => React.CSSProperties;
  enTeteSection?: (s: SectionGrille) => React.ReactNode;
}) {
  return <div data-testid="grille-matrice">
    {sections.map((s) => <div key={s.code} style={{ marginBottom: 12 }}>
      <h4 style={{ margin: "6px 0 2px" }}>{s.label} {(s.visas ?? []).map((v) => <span key={v} style={{ marginLeft: 6, fontSize: 10,
        padding: "1px 8px", borderRadius: 999, background: tokens.color.gold, color: "#fff" }}>visa {v}</span>)}
        {enTeteSection?.(s)}</h4>
      <table cellPadding={3} style={{ fontSize: 11, borderCollapse: "collapse" }}><thead><tr>
        <th align="left" style={{ minWidth: 220 }}>Question</th>{colonnes.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{s.questions.map((q) => <tr key={q.code}>
          <td>{q.label}</td>
          {colonnes.map((c) => <td key={c} style={{ textAlign: "center", ...(celluleStyle?.(q, c, s) ?? {}) }}>
            {cellule(q, c, s)}</td>)}
        </tr>)}</tbody></table>
    </div>)}
  </div>;
}
