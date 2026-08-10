import React from "react";
import "./tokens.css";
import { StatusChip } from "./StatusChip";

/**
 * UI v2 — composant 5 : FieldCard (handoff §Bibliothèque).
 * Carte de champ : en-tête libellé + puce RENSEIGNÉ/MANQUANT ; corps valeur ou saisie ; pied de
 * PROVENANCE — document source, empreinte, auteur. « Le pied de provenance est ce qui distingue
 * O-Live d'un formulaire ordinaire. Il ne doit JAMAIS être optionnel » : renseigné ⇒ provenance
 * OBLIGATOIRE (le type l'impose) ; manquant ⇒ bordure et ombre ambre EN PERMANENCE (pas
 * seulement après soumission). L'encart Olivia reste une PROPOSITION — reprendre est un acte.
 */
type Renseigne = { etat: "RENSEIGNE"; valeur: React.ReactNode;
  provenance: string };                          // OBLIGATOIRE — jamais optionnel
type Manquant = { etat: "MANQUANT"; saisie: React.ReactNode; note?: string;
  olivia?: { texte: string; onReprendre: () => void } };

export function FieldCard(props: { label: string; t?: (cle: string) => string } & (Renseigne | Manquant)) {
  const tr = props.t ?? ((s: string) => s);
  const manquant = props.etat === "MANQUANT";
  return (
    <section style={{ background: "var(--bg-surface)", borderRadius: 11, padding: "13px 15px",
      marginBottom: 10,
      border: manquant ? "1px solid var(--warn-card-border)" : "1px solid var(--border)",
      boxShadow: manquant ? "var(--shadow-ai)" : "var(--shadow-card)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", minWidth: 0,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{props.label}</span>
        <span style={{ marginLeft: "auto" }}>
          <StatusChip mode={manquant ? "warn" : "ok"}>{tr(manquant ? "MANQUANT" : "RENSEIGNÉ")}</StatusChip></span>
      </div>
      {props.etat === "RENSEIGNE" ? (<>
        <div style={{ fontSize: 13, color: "var(--text-body)", lineHeight: 1.5 }}>{props.valeur}</div>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 8,
          display: "flex", gap: 6, alignItems: "baseline" }}>
          <span aria-hidden>⎘</span><span>{props.provenance}</span></div>
      </>) : (<>
        {props.saisie}
        {props.olivia && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9 }}>
            <span style={{ fontSize: 11.5, color: "var(--ai-line)", flex: 1 }}>＋ {props.olivia.texte}</span>
            <button onClick={props.olivia.onReprendre} style={{ padding: "5px 11px", borderRadius: 8,
              border: "1px solid var(--ai-card-border)", background: "var(--ai-card)",
              color: "var(--ai-text)", fontFamily: "inherit", fontSize: 11, fontWeight: 600,
              cursor: "pointer", whiteSpace: "nowrap" }}>{tr("Reprendre")}</button>
          </div>)}
        {props.note && <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 8 }}>{props.note}</div>}
      </>)}
    </section>);
}
